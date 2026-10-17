import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend-bridge';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const queryString = searchParams.toString();
    const endpoint = `/api/v1/target-apps/${id}/explore${queryString ? `?${queryString}` : ''}`;

    const result = await backendFetch<unknown>(endpoint, {
      method: 'POST',
      timeoutMs: 45000,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Autonomous exploration failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
