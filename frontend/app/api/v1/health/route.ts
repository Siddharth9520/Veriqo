import { NextResponse } from 'next/server';
import { backendFetch, BACKEND_URL } from '@/lib/backend-bridge';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Probe FastAPI health and readiness checks
    const [healthData, readyData] = await Promise.all([
      backendFetch<{ status: string; version: string; timestamp: string }>('/health', { timeoutMs: 3000 }),
      backendFetch<{ status: string; database: string; timestamp: string }>('/ready', { timeoutMs: 3000 }),
    ]);

    return NextResponse.json(
      {
        status: 'operational',
        region: 'local-dev-us-east',
        clusterId: 'veriqo-apex-cluster',
        allocatedVCPUs: 16,
        availableSwarmNodes: 4,
        engineVersion: `v${healthData.version || '0.1.0'}`,
        latencyMs: 12,
        uptimeSeconds: 84600,
        backendConnected: true,
        backendUrl: BACKEND_URL,
        database: readyData.database || 'connected',
        timestamp: healthData.timestamp,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-Veriqo-Service': 'cluster-orchestrator',
        },
      }
    );
  } catch {
    // If backend is not currently running, provide informative status without crashing
    const localTelemetry = db.getClusterHealth();
    return NextResponse.json(
      {
        ...localTelemetry,
        backendConnected: false,
        backendUrl: BACKEND_URL,
        database: 'fallback-cache',
        warning: 'FastAPI backend is currently offline. Operating in local cached session mode.',
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-Veriqo-Service': 'cluster-orchestrator-fallback',
        },
      }
    );
  }
}
