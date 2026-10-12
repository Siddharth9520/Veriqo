import { NextRequest, NextResponse } from 'next/server';
import { backendFetch, BackendFixPromptResponse } from '@/lib/backend-bridge';

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
        { error: 'Valid numeric defect ID is required for Fix Prompt export.' },
        { status: 400 }
      );
    }

    const fixPrompt = await backendFetch<BackendFixPromptResponse>(
      `/api/v1/defects/${numericId}/fix-prompt`
    );

    return NextResponse.json(fixPrompt, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Veriqo-Service': 'fix-prompt-generator',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate Fix Prompt.';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
