import { NextResponse } from 'next/server';
import {
  backendFetch,
  BackendTestRun,
  BackendTargetApp,
} from '@/lib/backend-bridge';
import { TestRun } from '@/lib/types';
import { db } from '@/lib/db';

export function mapBackendRunToFrontend(
  run: BackendTestRun,
  apps: BackendTargetApp[] = []
): TestRun {
  const targetApp = apps.find((a) => a.id === run.target_app_id);
  const actionCount = run.action_results?.length || 0;
  const passedActions = run.action_results?.filter((a) => a.status === 'passed').length || 0;
  const failedActions = run.action_results?.filter((a) => a.status === 'failed').length || 0;

  const frontendStatus: TestRun['status'] =
    run.status === 'passed'
      ? 'completed'
      : run.status === 'failed'
      ? 'failed'
      : run.status === 'running'
      ? 'running'
      : 'aborted';

  return {
    id: `run-${run.id}`,
    runNumber: `#VRQ-${run.id}`,
    title: run.journey_definition?.journey_name || `RUN #VRQ-${run.id} // AUTONOMOUS AUDIT`,
    projectSlug: targetApp
      ? targetApp.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      : `app-${run.target_app_id}`,
    projectName: targetApp?.name || `Target App #${run.target_app_id}`,
    projectDomain: targetApp?.url || 'http://127.0.0.1:8000',
    environment: 'Staging',
    browser: 'Headless Chromium (Playwright)',
    status: frontendStatus,
    startedAt: run.started_at ? new Date(run.started_at).toISOString().substring(11, 19) + ' UTC' : '00:00:00 UTC',
    elapsedSeconds: run.completed_at && run.started_at
      ? Math.max(1, Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000))
      : 12,
    remainingSeconds: run.status === 'running' ? 45 : 0,
    totalAssertions: Math.max(actionCount, 1),
    evaluatedAssertions: actionCount,
    passedAssertions: passedActions,
    failedAssertions: failedActions,
    criticalDefectId: failedActions > 0 ? `BUG-VRQ-${run.id}` : undefined,
    currentStepUrl: targetApp?.url || 'http://127.0.0.1:8000',
    currentStepTitle: run.error_message || (run.status === 'passed' ? 'All Assertions Verified' : 'In-Flight Execution'),
  };
}

export async function GET() {
  try {
    const [backendRuns, apps] = await Promise.all([
      backendFetch<BackendTestRun[]>('/api/v1/test-runs'),
      backendFetch<BackendTargetApp[]>('/api/v1/target-apps').catch(() => []),
    ]);

    if (backendRuns && backendRuns.length > 0) {
      const mapped = backendRuns.map((r) => mapBackendRunToFrontend(r, apps));
      return NextResponse.json(mapped, {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-Veriqo-Source': 'fastapi-backend',
        },
      });
    }

    const localRuns = db.getTestRuns();
    return NextResponse.json(localRuns, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Veriqo-Source': 'local-db-fallback',
      },
    });
  } catch {
    const runs = db.getTestRuns();
    return NextResponse.json(runs, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Veriqo-Source': 'local-db-cache',
      },
    });
  }
}
