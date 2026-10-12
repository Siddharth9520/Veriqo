import { NextRequest, NextResponse } from 'next/server';
import {
  backendFetch,
  BackendCertificate,
  BackendTargetApp,
} from '@/lib/backend-bridge';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const appIdParam = searchParams.get('app_id');

    if (appIdParam) {
      const numericAppId = parseInt(appIdParam, 10);
      const certs = await backendFetch<BackendCertificate[]>(
        `/api/v1/target-apps/${numericAppId}/certificates`
      );
      return NextResponse.json(certs, { status: 200 });
    }

    // If no app_id provided, fetch all registered target apps and aggregate certificates
    const apps = await backendFetch<BackendTargetApp[]>('/api/v1/target-apps');
    const allCerts: BackendCertificate[] = [];

    for (const app of apps) {
      try {
        const appCerts = await backendFetch<BackendCertificate[]>(
          `/api/v1/target-apps/${app.id}/certificates`
        );
        allCerts.push(...appCerts);
      } catch {
        // App may not have certificates yet
      }
    }

    return NextResponse.json(allCerts, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve certificates.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { app_id, test_run_ids } = body;

    const numericAppId = parseInt(app_id, 10);
    if (isNaN(numericAppId)) {
      return NextResponse.json(
        { error: 'Valid numeric app_id is required to issue a QA certificate.' },
        { status: 400 }
      );
    }

    const payload = test_run_ids ? { test_run_ids } : undefined;
    const certificate = await backendFetch<BackendCertificate>(
      `/api/v1/target-apps/${numericAppId}/certificates`,
      {
        method: 'POST',
        body: payload ? JSON.stringify(payload) : undefined,
      }
    );

    return NextResponse.json(certificate, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate QA certificate.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
