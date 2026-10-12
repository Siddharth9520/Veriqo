import { NextRequest, NextResponse } from 'next/server';
import {
  backendFetch,
  BackendRegressionJourney,
  BackendTargetApp,
} from '@/lib/backend-bridge';
import { TestCase } from '@/lib/types';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const [journeys, apps] = await Promise.all([
      backendFetch<BackendRegressionJourney[]>('/api/v1/regression-journeys'),
      backendFetch<BackendTargetApp[]>('/api/v1/target-apps').catch(() => []),
    ]);

    if (journeys && journeys.length > 0) {
      const mapped: TestCase[] = journeys.map((j) => {
        const app = apps.find((a) => a.id === j.target_app_id);
        const actionCount = (j.journey_definition?.actions as Array<unknown>)?.length || 5;

        return {
          id: `tc-reg-${j.id}`,
          name: j.name,
          description: j.description || 'Verified regression journey baseline.',
          category: 'E2E Concurrency & Regression',
          projectSlug: app
            ? app.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
            : 'commerce-platform',
          projectName: app?.name || 'Verified Target Application',
          assertions: Math.max(actionCount, 1),
          status: 'PASSED',
          lastRun: new Date(j.created_at).toLocaleDateString(),
          duration: '1m 15s',
          depth: 'L3 Heuristic Baseline',
        };
      });

      return NextResponse.json(mapped, {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-Veriqo-Source': 'fastapi-backend',
        },
      });
    }

    const localTests = db.getTestLibrary();
    return NextResponse.json(localTests, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Veriqo-Source': 'local-db-fallback',
      },
    });
  } catch {
    const tests = db.getTestLibrary();
    return NextResponse.json(tests, {
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
    const { name, description, category, projectSlug, projectName, assertions, baseline_test_run_id } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Test scenario title is required.' },
        { status: 400 }
      );
    }

    if (baseline_test_run_id) {
      try {
        const savedBaseline = await backendFetch<BackendRegressionJourney>(
          '/api/v1/regression-journeys',
          {
            method: 'POST',
            body: JSON.stringify({
              baseline_test_run_id,
              name: name.trim(),
              description: description || 'Regression baseline',
            }),
          }
        );

        const mapped: TestCase = {
          id: `tc-reg-${savedBaseline.id}`,
          name: savedBaseline.name,
          description: savedBaseline.description || 'Verified regression journey baseline.',
          category: category || 'E2E Concurrency & Regression',
          projectSlug: projectSlug || 'commerce-platform',
          projectName: projectName || 'Verified Target Application',
          assertions: typeof assertions === 'number' ? assertions : 18,
          status: 'PASSED',
          lastRun: 'Just saved',
          duration: '1m 15s',
          depth: 'L3 Baseline',
        };

        return NextResponse.json(mapped, { status: 201 });
      } catch {
        // Fall back to local DB if backend refuses
      }
    }

    const created = db.addTestCase({
      name: name.trim(),
      description: description || 'User-defined heuristic boundary assertion.',
      category: category || 'E2E Concurrency & Payments',
      projectSlug: projectSlug || 'commerce-platform',
      projectName: projectName || 'Commerce Platform (Storefront Web)',
      assertions: typeof assertions === 'number' ? assertions : 18,
    });

    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to create new test library scenario.' },
      { status: 500 }
    );
  }
}
