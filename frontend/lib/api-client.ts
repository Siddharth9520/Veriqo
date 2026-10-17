import {
  Project,
  TestRun,
  BugReport,
  TestCase,
  Integration,
  TerminalLog,
  ClusterHealth,
  AnalyticsData,
} from './types';
import {
  BackendShowMeResponse,
  BackendFixPromptResponse,
  BackendReplayAttempt,
  BackendCertificate,
} from './backend-bridge';

/**
 * Structured Custom Errors
 */
export class ApiError extends Error {
  public status: number;
  public data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export class NetworkError extends Error {
  constructor(message = 'Network connection unavailable or request refused.') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends Error {
  constructor(message = 'Request timed out waiting for Veriqo cluster response.') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

export interface CertificateVerifyResult {
  verified: boolean;
  mode: string;
  system_matched: boolean;
  tamper_detected: boolean;
  computed_hash: string;
  provided_hash?: string;
  stored_hash?: string;
  message: string;
  verification_timestamp: string;
}

export interface ExplorationResponse {
  test_run_id: number;
  status: string;
  discovered_urls: string[];
  pages_crawled: number;
  actions_count: number;
  duration_ms: number;
  regression_journey_id: number | null;
  generated_journey: Record<string, unknown>;
}

export interface SpecIngestionResponse {
  status: string;
  spec_type: string;
  routes_discovered: number;
  actions_generated: number;
  scrubbed_secret_count?: number;
  regression_journey_id: number | null;
  generated_journey: Record<string, unknown>;
  warnings: string[];
}

/**
 * Resolve base API URL:
 * If NEXT_PUBLIC_API_BASE_URL is defined, use it.
 * Otherwise, default to relative '/api/v1' which resolves to the Next.js API route handlers.
 */
export function getApiBaseUrl(): string {
  const envUrl = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL)?.trim();
  if (envUrl) {
    return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
  }
  return '/api/v1';
}

/**
 * Core HTTP Request Wrapper with AbortController, Timeout, and Structured Errors
 */
async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = 10000, headers, ...restOptions } = options;
  const baseUrl = getApiBaseUrl();
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  const requestHeaders: Record<string, string> = {
    Accept: 'application/json',
    'X-Veriqo-Client': 'Veriqo-Web/2.4.0',
    'X-Request-Id': `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    ...(restOptions.body ? { 'Content-Type': 'application/json' } : {}),
    ...(headers as Record<string, string>),
  };

  try {
    const response = await fetch(url, {
      ...restOptions,
      headers: requestHeaders,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorData: unknown;
      let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;

      try {
        errorData = await response.json();
        if (typeof errorData === 'object' && errorData !== null) {
          if ('error' in errorData) {
            errorMessage = String((errorData as { error: string }).error);
          } else if ('detail' in errorData) {
            errorMessage = String((errorData as { detail: string }).detail);
          }
        }
      } catch {
        try {
          const text = await response.text();
          if (text) errorMessage = text;
        } catch {
          // Keep default message
        }
      }

      throw new ApiError(errorMessage, response.status, errorData);
    }

    return (await response.json()) as T;
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      if (options.signal?.aborted) {
        throw new NetworkError('Request cancelled by client.');
      }
      throw new TimeoutError(`Request to ${endpoint} timed out after ${timeoutMs}ms`);
    }

    if (error instanceof TypeError) {
      throw new NetworkError(`Network error communicating with Veriqo cluster: ${error.message}`);
    }

    throw new ApiError(
      error instanceof Error ? error.message : 'Unknown communication error occurred',
      500
    );
  }
}

/**
 * Typed Veriqo API Client Layer
 */
export const apiClient = {
  // Cluster Health
  async getClusterHealth(): Promise<ClusterHealth & { backendConnected?: boolean; database?: string }> {
    return request<ClusterHealth & { backendConnected?: boolean; database?: string }>('/health');
  },

  // Projects
  async getProjects(): Promise<Project[]> {
    return request<Project[]>('/projects');
  },

  async getProject(slug: string): Promise<Project> {
    return request<Project>(`/projects/${encodeURIComponent(slug)}`);
  },

  async connectProject(projectData: Partial<Project>): Promise<Project> {
    return request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
  },

  // Test Runs
  async getTestRuns(): Promise<TestRun[]> {
    return request<TestRun[]>('/test-runs');
  },

  async getActiveTestRun(): Promise<TestRun> {
    return request<TestRun>('/test-runs/active');
  },

  async getTestRun(id: string): Promise<TestRun> {
    return request<TestRun>(`/test-runs/${encodeURIComponent(id)}`);
  },

  async startTestRun(options: { projectSlug: string; swarmMode?: string; environment?: string }): Promise<TestRun> {
    return request<TestRun>('/test-runs/start', {
      method: 'POST',
      body: JSON.stringify(options),
      timeoutMs: 35000,
    });
  },

  async updateTestRunStatus(id: string, status: TestRun['status']): Promise<TestRun> {
    return request<TestRun>(`/test-runs/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  // Terminal Swarm Commands
  async sendTerminalCommand(command: string): Promise<{ success: boolean; command: string; logs: TerminalLog[] }> {
    return request<{ success: boolean; command: string; logs: TerminalLog[] }>('/test-runs/commands', {
      method: 'POST',
      body: JSON.stringify({ command }),
    });
  },

  // Bug Reports & Defect Records
  async getBugReports(): Promise<BugReport[]> {
    return request<BugReport[]>('/bug-reports');
  },

  async getBugReport(id: string): Promise<BugReport> {
    return request<BugReport>(`/bug-reports/${encodeURIComponent(id)}`);
  },

  async pinBugReport(id: string): Promise<BugReport> {
    return request<BugReport>(`/bug-reports/${encodeURIComponent(id)}`, {
      method: 'POST',
    });
  },

  // Show Me Mode — Deep Defect Diagnosis
  async getDefectShowMe(id: string | number): Promise<BackendShowMeResponse> {
    return request<BackendShowMeResponse>(`/bug-reports/${encodeURIComponent(id)}/show-me`);
  },

  // Fix Prompt Export — Developer Prompt with Verification Boundary
  async getDefectFixPrompt(id: string | number): Promise<BackendFixPromptResponse> {
    return request<BackendFixPromptResponse>(`/bug-reports/${encodeURIComponent(id)}/fix-prompt`);
  },

  // BlindReplay — Independent Defect Verification
  async triggerBlindReplay(
    id: string | number,
    instructions?: string,
    expected?: string
  ): Promise<BackendReplayAttempt> {
    return request<BackendReplayAttempt>(`/bug-reports/${encodeURIComponent(id)}/replay`, {
      method: 'POST',
      body: JSON.stringify({
        reproduction_instructions: instructions,
        expected_behavior: expected,
      }),
      timeoutMs: 45000,
    });
  },

  async getDefectReplays(id: string | number): Promise<BackendReplayAttempt[]> {
    return request<BackendReplayAttempt[]>(`/bug-reports/${encodeURIComponent(id)}/replay`);
  },

  // Scoring & QA Certificates
  async getCertificates(appId?: string | number): Promise<BackendCertificate[]> {
    const query = appId ? `?app_id=${encodeURIComponent(appId)}` : '';
    return request<BackendCertificate[]>(`/certificates${query}`);
  },

  async generateCertificate(appId: string | number, testRunIds?: number[]): Promise<BackendCertificate> {
    return request<BackendCertificate>('/certificates', {
      method: 'POST',
      body: JSON.stringify({ app_id: appId, test_run_ids: testRunIds }),
    });
  },

  async verifyCertificate(payload: {
    certificate_id?: string;
    certificate_data?: unknown;
    mode?: string;
  }): Promise<CertificateVerifyResult> {
    return request<CertificateVerifyResult>('/certificates/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Test Library & Regression Baselines
  async getTestLibrary(): Promise<TestCase[]> {
    return request<TestCase[]>('/test-library');
  },

  async createTestCase(data: Partial<TestCase> & { baseline_test_run_id?: number }): Promise<TestCase> {
    return request<TestCase>('/test-library', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Analytics Metrics
  async getAnalytics(): Promise<AnalyticsData> {
    return request<AnalyticsData>('/analytics');
  },

  // Third-Party Integrations
  async getIntegrations(): Promise<Integration[]> {
    return request<Integration[]>('/integrations');
  },

  async updateIntegration(id: string, patch: Partial<Integration>): Promise<Integration> {
    return request<Integration>('/integrations', {
      method: 'PATCH',
      body: JSON.stringify({ id, ...patch }),
    });
  },

  // Execution Terminal Logs
  async getLogs(): Promise<TerminalLog[]> {
    return request<TerminalLog[]>('/logs');
  },

  async addLog(log: { agent?: string; message: string; type?: 'info' | 'warning' | 'error' | 'success' }): Promise<TerminalLog> {
    return request<TerminalLog>('/logs', {
      method: 'POST',
      body: JSON.stringify(log),
    });
  },

  // Evidence file URL helper
  getEvidenceFileUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `/api/v1/evidence/${cleanPath}`;
  },

  // Autonomous Exploration & Synthesis
  async exploreTargetApp(
    appId: number,
    options?: { max_pages?: number; max_actions?: number; save_as_regression?: boolean }
  ): Promise<ExplorationResponse> {
    const params = new URLSearchParams();
    if (options?.max_pages) params.set('max_pages', String(options.max_pages));
    if (options?.max_actions) params.set('max_actions', String(options.max_actions));
    if (options?.save_as_regression !== undefined) {
      params.set('save_as_regression', String(options.save_as_regression));
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<ExplorationResponse>(`/target-apps/${appId}/explore${query}`, {
      method: 'POST',
      timeoutMs: 45000,
    });
  },

  // OpenAPI & HAR Spec Ingestion
  async ingestOpenApiSpec(
    targetAppId: number,
    specContent: Record<string, unknown> | string,
    maxEndpoints = 15
  ): Promise<SpecIngestionResponse> {
    return request<SpecIngestionResponse>('/integrations/specs/openapi', {
      method: 'POST',
      body: JSON.stringify({
        target_app_id: targetAppId,
        spec_content: specContent,
        max_endpoints: maxEndpoints,
      }),
    });
  },

  async ingestHarSpec(
    targetAppId: number,
    harContent: Record<string, unknown> | string,
    maxRoutes = 15
  ): Promise<SpecIngestionResponse> {
    return request<SpecIngestionResponse>('/integrations/specs/har', {
      method: 'POST',
      body: JSON.stringify({
        target_app_id: targetAppId,
        har_content: harContent,
        max_routes: maxRoutes,
      }),
    });
  },
};
