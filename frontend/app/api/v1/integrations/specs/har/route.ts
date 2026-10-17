import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend-bridge';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await backendFetch<unknown>('/api/v1/integrations/specs/har', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to ingest HAR network archive.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
