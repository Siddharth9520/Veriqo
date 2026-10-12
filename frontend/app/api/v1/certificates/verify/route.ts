import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend-bridge';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { certificate_id, certificate_data, mode } = body;

    if (!certificate_id && !certificate_data) {
      return NextResponse.json(
        { error: 'Either certificate_id or certificate_data must be provided for verification.' },
        { status: 422 }
      );
    }

    const verificationResult = await backendFetch<{
      verified: boolean;
      mode: string;
      system_matched: boolean;
      tamper_detected: boolean;
      computed_hash: string;
      provided_hash?: string;
      stored_hash?: string;
      message: string;
      verification_timestamp: string;
    }>('/api/v1/certificates/verify', {
      method: 'POST',
      body: JSON.stringify({ certificate_id, certificate_data, mode }),
    });

    return NextResponse.json(verificationResult, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Certificate verification failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
