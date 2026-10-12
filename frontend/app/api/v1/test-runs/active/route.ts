import { NextResponse } from 'next/server';
import {
  backendFetch,
  BackendTestRun,
  BackendTargetApp,
} from '@/lib/backend-bridge';
import { mapBackendRunToFrontend } from '../route';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const [backendRuns, apps] = await Promise.all([
      backendFetch<BackendTestRun[]>('/api/v1/test-runs'),
      backendFetch<BackendTargetApp[]>('/api/v1/target-apps').catch(() => []),
    ]);

    if (backendRuns && backendRuns.length > 0) {
      // Find active (running) or most recent run
      const runningRun = backendRuns.find((r) => r.status === 'running');
      const targetRun = runningRun || backendRuns[0];
      const mapped = mapBackendRunToFrontend(targetRun, apps);

      return NextResponse.json(mapped, {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-Veriqo-Source': 'fastapi-backend',
        },
      });
    }

    const activeRun = db.getActiveTestRun();
    return NextResponse.json(activeRun, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Veriqo-Source': 'local-db-fallback',
      },
    });
  } catch {
    const activeRun = db.getActiveTestRun();
    return NextResponse.json(activeRun, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Veriqo-Source': 'local-db-cache',
      },
    });
  }
}
