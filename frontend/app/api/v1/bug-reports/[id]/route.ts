import { NextRequest, NextResponse } from 'next/server';
import {
  backendFetch,
  BackendDefect,
  BackendTestRun,
  BackendTargetApp,
} from '@/lib/backend-bridge';
import { mapBackendDefectToFrontend } from '../route';
import { db } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Extract numeric ID if format is VRQ-9482-D01 or similar
    const numMatch = id.match(/\d+$/);
    const numericId = numMatch ? parseInt(numMatch[0], 10) : parseInt(id, 10);

    if (!isNaN(numericId)) {
      try {
        const [defect, runs, apps] = await Promise.all([
          backendFetch<BackendDefect>(`/api/v1/defects/${numericId}`),
          backendFetch<BackendTestRun[]>('/api/v1/test-runs').catch(() => []),
          backendFetch<BackendTargetApp[]>('/api/v1/target-apps').catch(() => []),
        ]);

        if (defect) {
          const mapped = mapBackendDefectToFrontend(defect, runs, apps);
          return NextResponse.json(mapped, { status: 200 });
        }
      } catch {
        // Fall through to local DB
      }
    }

    const bug = db.getBugReport(id);
    if (!bug) {
      return NextResponse.json(
        { error: `Defect record '${id}' not found in registry.` },
        { status: 404 }
      );
    }

    return NextResponse.json(bug, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to retrieve defect record details.' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numMatch = id.match(/\d+$/);
    const numericId = numMatch ? parseInt(numMatch[0], 10) : parseInt(id, 10);

    if (!isNaN(numericId)) {
      try {
        // Pin/verify in FastAPI
        const updated = await backendFetch<BackendDefect>(`/api/v1/defects/${numericId}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'INVESTIGATING' }),
        });

        if (updated) {
          const mapped = mapBackendDefectToFrontend(updated);
          return NextResponse.json(mapped, { status: 200 });
        }
      } catch {
        // Fallback to local DB
      }
    }

    const pinned = db.pinBugReport(id);
    if (!pinned) {
      return NextResponse.json(
        { error: `Defect '${id}' not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json(pinned, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to pin defect to vault.' },
      { status: 500 }
    );
  }
}
