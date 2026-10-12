import { NextRequest, NextResponse } from 'next/server';
import {
  backendFetch,
  BackendTargetApp,
  BackendTestRun,
  BackendDefect,
} from '@/lib/backend-bridge';
import { Project } from '@/lib/types';
import { db } from '@/lib/db';

function mapTargetAppToProject(
  app: BackendTargetApp,
  runs: BackendTestRun[],
  defects: BackendDefect[]
): Project {
  const appRuns = runs.filter((r) => r.target_app_id === app.id);
  const appDefects = defects.filter((d) => appRuns.some((r) => r.id === d.test_run_id));
  const passedRuns = appRuns.filter((r) => r.status === 'passed').length;
  const passRate = appRuns.length > 0 ? Math.round((passedRuns / appRuns.length) * 100) : 100;
  const openDefects = appDefects.filter((d) => d.status !== 'RESOLVED' && d.status !== 'CLOSED').length;
  const domain = app.url.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  const slug = app.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `app-${app.id}`;
  const lastRun = appRuns[0];

  return {
    id: String(app.id),
    name: app.name,
    slug,
    domain,
    environment: 'Staging',
    health: openDefects > 0 ? 'critical_regression' : 'healthy',
    healthLabel: openDefects > 0 ? `${openDefects} Regressions Detected` : 'Healthy',
    lastExecution: lastRun ? (lastRun.completed_at ? new Date(lastRun.completed_at).toLocaleTimeString() : 'In-Flight') : 'Ready',
    duration: 'Autonomous',
    passRate,
    openDefects,
    openDefectsLabel: `${openDefects} Bugs`,
    testCount: Math.max(appRuns.length, 1),
    swarmMode: 'Deep Heuristic',
    icon: 'dns',
    coverageMatrix: [
      { name: 'Core Landing & Nav', percentage: passRate },
      { name: 'Autonomous Route Discovery', percentage: passRate },
    ],
  };
}

export async function GET() {
  try {
    // Attempt live fetch from FastAPI
    const [targetApps, testRuns, defects] = await Promise.all([
      backendFetch<BackendTargetApp[]>('/api/v1/target-apps'),
      backendFetch<BackendTestRun[]>('/api/v1/test-runs').catch(() => []),
      backendFetch<BackendDefect[]>('/api/v1/defects').catch(() => []),
    ]);

    if (targetApps && targetApps.length > 0) {
      const liveProjects = targetApps.map((app) =>
        mapTargetAppToProject(app, testRuns, defects)
      );
      return NextResponse.json(liveProjects, {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-Veriqo-Source': 'fastapi-backend',
        },
      });
    }

    // Fall back to local DB if no live apps registered yet
    const localProjects = db.getProjects();
    return NextResponse.json(localProjects, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Veriqo-Source': 'local-db-fallback',
      },
    });
  } catch {
    // If backend is unreachable, return local cached project records
    const projects = db.getProjects();
    return NextResponse.json(projects, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Veriqo-Source': 'local-db-cache',
      },
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, domain, environment, swarmMode } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Project name is required and cannot be empty.' },
        { status: 400 }
      );
    }

    if (!domain || typeof domain !== 'string' || domain.trim().length === 0) {
      return NextResponse.json(
        { error: 'Application URL or domain is required.' },
        { status: 400 }
      );
    }

    // Clean and validate URL/domain with strict SSRF and protocol protection
    let hostname = domain.trim();
    let targetUrl = '';
    if (hostname.includes('://')) {
      try {
        const parsed = new URL(hostname);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return NextResponse.json(
            { error: 'Security policy: Only http:// and https:// application endpoints are allowed.' },
            { status: 400 }
          );
        }
        targetUrl = hostname;
        hostname = parsed.hostname;
      } catch {
        return NextResponse.json(
          { error: 'Malformed application URL provided.' },
          { status: 400 }
        );
      }
    } else {
      targetUrl = `https://${hostname}`;
      hostname = hostname.replace(/\/.*$/, '').split(':')[0].trim();
    }

    // SSRF Safeguards: Protect internal cloud metadata and dangerous targets
    const FORBIDDEN_SSRF = [
      '169.254.169.254',
      'metadata.google.internal',
      '169.254.',
      'instance-data',
    ];

    if (FORBIDDEN_SSRF.some((blocked) => hostname === blocked || hostname.startsWith(blocked))) {
      return NextResponse.json(
        { error: 'Security Policy Violation: Access to internal cloud metadata services is strictly forbidden.' },
        { status: 403 }
      );
    }

    const sanitizedName = name.replace(/[<>]/g, '').trim();

    try {
      // Register with real FastAPI backend
      const registeredApp = await backendFetch<BackendTargetApp>('/api/v1/target-apps', {
        method: 'POST',
        body: JSON.stringify({
          name: sanitizedName,
          url: targetUrl,
          description: `Environment: ${environment || 'Staging'} | Swarm: ${swarmMode || 'Deep Heuristic'}`,
        }),
      });

      const mapped = mapTargetAppToProject(registeredApp, [], []);
      // Also sync to local DB singleton for backward compatibility
      db.addProject(mapped);

      return NextResponse.json(mapped, { status: 201 });
    } catch {
      // Fallback to local DB store if FastAPI is unreachable
      const created = db.addProject({
        name: sanitizedName,
        domain: hostname,
        environment: environment || 'Staging',
        swarmMode: swarmMode || 'Deep Heuristic',
      });

      return NextResponse.json(created, { status: 201 });
    }
  } catch {
    return NextResponse.json(
      { error: 'Malformed request payload or server processing error.' },
      { status: 500 }
    );
  }
}
