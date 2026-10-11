import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { TestRun } from '@/lib/types';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const run = db.getTestRun(id);

    if (!run) {
      return NextResponse.json(
        { error: `Test run execution '${id}' not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json(run, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to retrieve test run execution details.' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status } = body;

    const allowedStatuses: TestRun['status'][] = ['running', 'paused', 'completed', 'failed', 'aborted'];
    if (!status || !allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status '${status}'. Must be one of: ${allowedStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const updated = db.updateTestRunStatus(id, status);
    if (!updated) {
      return NextResponse.json(
        { error: `Test run execution '${id}' not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json(updated, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to update test run status.' },
      { status: 500 }
    );
  }
}
