/**
 * Veriqo Backend Bridge — High-reliability HTTP client for FastAPI Backend
 * Connects Next.js route handlers directly to the Python FastAPI engine at http://127.0.0.1:8000
 */

export const BACKEND_URL =
  process.env.FASTAPI_BACKEND_URL?.trim() ||
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
  'http://127.0.0.1:8000';

interface BridgeOptions extends RequestInit {
  timeoutMs?: number;
}

export class BackendUnavailableError extends Error {
  constructor(message = 'Veriqo FastAPI backend is unreachable at ' + BACKEND_URL) {
    super(message);
    this.name = 'BackendUnavailableError';
  }
}

/**
 * Dispatches an HTTP request to the FastAPI backend with timeout and error wrapping
 */
export async function backendFetch<T>(
  path: string,
  options: BridgeOptions = {}
): Promise<T> {
  const { timeoutMs = 12000, headers, ...rest } = options;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${BACKEND_URL}${normalizedPath}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...rest,
      headers: {
        Accept: 'application/json',
        ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      let errDetail: unknown;
      try {
        errDetail = await res.json();
      } catch {
        try {
          errDetail = await res.text();
        } catch {
          errDetail = res.statusText;
        }
      }
      const msg =
        typeof errDetail === 'object' && errDetail !== null && 'detail' in errDetail
          ? String((errDetail as { detail: unknown }).detail)
          : `FastAPI responded with HTTP ${res.status}: ${res.statusText}`;

      const error = new Error(msg);
      (error as Error & { status: number; data: unknown }).status = res.status;
      (error as Error & { status: number; data: unknown }).data = errDetail;
      throw error;
    }

    return (await res.json()) as T;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && (err.name === 'AbortError' || err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED'))) {
      throw new BackendUnavailableError(
        `FastAPI service unreachable at ${url}. Ensure the backend is running via .venv/Scripts/python.exe -m uvicorn app.main:app --port 8000`
      );
    }
    throw err;
  }
}

// ==========================================
// Strongly-typed backend operations
// ==========================================

export interface BackendTargetApp {
  id: number;
  name: string;
  url: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface BackendTestRun {
  id: number;
  target_app_id: number;
  status: 'running' | 'passed' | 'failed' | 'timed_out';
  journey_definition: {
    journey_name?: string;
    actions?: Array<{ action_type: string; [key: string]: unknown }>;
  };
  started_at: string;
  completed_at: string | null;
  action_results: Array<{
    step_index: number;
    action_type: string;
    status: string;
    error_message: string | null;
    screenshot_path: string | null;
    duration_ms?: number;
  }> | null;
  error_message: string | null;
  evidence_paths: string[] | null;
}

export interface BackendDefect {
  id: number;
  test_run_id: number;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'INVESTIGATING' | 'VERIFIED' | 'RESOLVED' | 'CLOSED';
  reproduction_steps: string | null;
  expected_behavior: string | null;
  created_at: string;
  updated_at: string;
}

export interface BackendCertificate {
  id: number;
  certificate_id: string;
  target_app_id: number;
  status: 'ISSUED' | 'REVOKED';
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  tamper_hash: string;
  certificate_data: Record<string, unknown>;
  created_at: string;
}

export interface BackendShowMeResponse {
  defect_id: number;
  title: string;
  severity: string;
  status: string;
  description: string;
  reproduction_steps: string | null;
  expected_behavior: string | null;
  actual_behavior: string | null;
  created_at: string;
  test_run: {
    id: number;
    target_app_id: number;
    target_app_name: string;
    target_app_url: string;
    status: string;
    journey_name: string | null;
    started_at: string;
    completed_at: string | null;
  } | null;
  evidence: {
    status: string;
    total_artifacts: number;
    verified_count: number;
    missing_count: number;
    artifacts: Array<{
      path: string;
      source: string;
      exists: boolean;
      file_size_bytes: number | null;
      download_url: string | null;
      note: string | null;
    }>;
    execution_logs: Array<Record<string, unknown>>;
  };
  blind_replay: {
    replays_count: number;
    latest_outcome: string | null;
    is_verified: boolean;
    attempts: Array<{
      replay_id: number;
      status: string;
      outcome: string | null;
      started_at: string | null;
      completed_at: string | null;
      evidence_count: number;
      error_message: string | null;
    }>;
  };
  explanation: {
    summary: string;
    confidence: string;
    is_ai_generated: boolean;
    disclaimer: string;
  };
}

export interface BackendFixPromptResponse {
  defect_id: number;
  prompt_text: string;
  title: string;
  severity: string;
  status: string;
  description: string;
  reproduction_steps: string | null;
  expected_behavior: string | null;
  actual_behavior: string | null;
  environment_context: {
    target_app_name: string;
    target_app_url: string;
    test_run_id: number;
    test_run_status: string;
    journey_name: string | null;
  } | null;
  verification_context: {
    replays_count: number;
    latest_outcome: string | null;
    is_verified: boolean;
    verification_notes: string;
  };
  evidence_references: Array<{
    path: string;
    source: string;
    exists: boolean;
    note: string | null;
  }>;
  developer_tasks: string[];
  generated_at: string;
}

export interface BackendReplayAttempt {
  id: number;
  defect_id: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  outcome: 'CONFIRMED' | 'NOT_REPRODUCED' | 'INCONCLUSIVE' | 'FAILED' | null;
  target_url: string;
  reproduction_instructions: string;
  expected_behavior: string;
  started_at: string;
  completed_at: string | null;
  execution_log: Array<Record<string, unknown>> | null;
  evidence_paths: string[] | null;
  error_message: string | null;
}

export interface BackendRegressionJourney {
  id: number;
  target_app_id: number;
  name: string;
  description: string | null;
  journey_definition: Record<string, unknown>;
  baseline_test_run_id: number;
  created_at: string;
}
