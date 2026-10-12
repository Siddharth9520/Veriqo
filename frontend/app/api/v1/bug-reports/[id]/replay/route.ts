import { NextRequest, NextResponse } from 'next/server';
import { backendFetch, BackendReplayAttempt } from '@/lib/backend-bridge';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numMatch = id.match(/\d+$/);
    const numericId = numMatch ? parseInt(numMatch[0], 10) : parseInt(id, 10);

    if (isNaN(numericId)) {
      return NextResponse.json(
        { error: 'Valid numeric defect ID is required to query replay history.' },
        { status: 400 }
      );
    }

    const replays = await backendFetch<BackendReplayAttempt[]>(
      `/api/v1/defects/${numericId}/replays`
    );

    return NextResponse.json(replays, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve replay history.';
    return NextResponse.json({ error: message }, { status: 500 });
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

    if (isNaN(numericId)) {
      return NextResponse.json(
        { error: 'Valid numeric defect ID is required to execute BlindReplay.' },
        { status: 400 }
      );
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }

    // Execute independent BlindReplay in fresh browser context
    const replayAttempt = await backendFetch<BackendReplayAttempt>(
      `/api/v1/defects/${numericId}/replay`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
        timeoutMs: 45000, // Replay in Playwright may take up to 40s
      }
    );

    return NextResponse.json(replayAttempt, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to execute BlindReplay verification.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
