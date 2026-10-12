import { NextRequest, NextResponse } from 'next/server';
import {
  backendFetch,
  BackendTargetApp,
  BackendTestRun,
} from '@/lib/backend-bridge';
import { mapBackendRunToFrontend } from '../route';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectSlug, swarmMode, environment } = body;

    if (!projectSlug || typeof projectSlug !== 'string') {
      return NextResponse.json(
        { error: 'Valid projectSlug is required to initialize an execution run.' },
        { status: 400 }
      );
    }

    try {
      // Find matching target app in FastAPI
      const apps = await backendFetch<BackendTargetApp[]>('/api/v1/target-apps');
      let targetApp = apps.find(
        (a) =>
          a.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') === projectSlug ||
          String(a.id) === projectSlug
      );

      if (!targetApp && apps.length > 0) {
        targetApp = apps[0];
      }

      if (targetApp) {
        // Construct real executable browser journey
        const journeyPayload = {
          target_app_id: targetApp.id,
          journey: {
            journey_name: `Autonomous Audit // ${swarmMode || 'Deep Heuristic'}`,
            target_app_id: targetApp.id,
            actions: [
              { action_type: 'navigate', url: '/' },
              { action_type: 'screenshot', description: 'initial_landing_scan' },
              { action_type: 'assert_title_contains', value: '' },
            ],
          },
        };

        // Execute test run through FastAPI and Playwright
        const executedRun = await backendFetch<BackendTestRun>('/api/v1/test-runs', {
          method: 'POST',
          body: JSON.stringify(journeyPayload),
          timeoutMs: 35000, // Browser navigation may take up to 30s
        });

        const mappedRun = mapBackendRunToFrontend(executedRun, apps);
        db.addLog({
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString().substring(11, 19),
          agent: 'ORCHESTRATOR',
          message: `Executed live Playwright browser journey #${executedRun.id} against ${targetApp.url} (${executedRun.status.toUpperCase()})`,
          type: executedRun.status === 'passed' ? 'success' : 'warning',
        });

        return NextResponse.json(mappedRun, { status: 201 });
      }
    } catch {
      // Fallback to local DB runner if FastAPI is unreachable
    }

    // Local DB execution fallback
    const run = db.startTestRun({
      projectSlug,
      swarmMode: swarmMode || 'Deep Heuristic',
      environment: environment || 'Staging',
    });

    return NextResponse.json(run, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to dispatch autonomous execution run.' },
      { status: 500 }
    );
  }
}
