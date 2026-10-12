import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL } from '@/lib/backend-bridge';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    if (!path || path.length === 0) {
      return new NextResponse('Path parameter required', { status: 400 });
    }

    // Path may be: ['run_2', 'failure_step_1.png'] or ['replay_1', 'confirmed.png']
    const fullRelative = path.join('/');

    let targetUrl = '';
    if (path[0].startsWith('run_')) {
      const runId = path[0].replace('run_', '');
      const filename = path.slice(1).join('/');
      targetUrl = `${BACKEND_URL}/api/v1/test-runs/${runId}/evidence/${filename}`;
    } else if (path[0].startsWith('replay_')) {
      const replayId = path[0].replace('replay_', '');
      const filename = path.slice(1).join('/');
      targetUrl = `${BACKEND_URL}/api/v1/replays/${replayId}/evidence/${filename}`;
    } else {
      targetUrl = `${BACKEND_URL}/api/v1/test-runs/1/evidence/${fullRelative}`;
    }

    const backendRes = await fetch(targetUrl, { cache: 'no-store' });
    if (!backendRes.ok) {
      return new NextResponse('Evidence file not found on cluster storage', { status: backendRes.status });
    }

    const contentType = backendRes.headers.get('content-type') || 'image/png';
    const blob = await backendRes.arrayBuffer();

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return new NextResponse('Internal error fetching evidence', { status: 500 });
  }
}
