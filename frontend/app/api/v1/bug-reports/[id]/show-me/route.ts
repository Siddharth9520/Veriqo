import { NextRequest, NextResponse } from 'next/server';
import { backendFetch, BackendShowMeResponse } from '@/lib/backend-bridge';

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
        { error: 'Valid numeric defect ID is required for Show Me Mode diagnosis.' },
        { status: 400 }
      );
    }

    const showMeReport = await backendFetch<BackendShowMeResponse>(
      `/api/v1/defects/${numericId}/show-me`
    );

    return NextResponse.json(showMeReport, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Veriqo-Service': 'show-me-diagnostics',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve Show Me diagnosis.';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
