export type ProjectEnvironment = 'Staging' | 'Prod Canary' | 'Dev Sandbox' | 'Production';

export type ProjectHealth = 'healthy' | 'critical_regression' | 'scanning' | 'warning';

export interface CoverageItem {
  name: string;
  percentage: number;
  flagged?: boolean;
  statusNote?: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  domain: string;
  environment: ProjectEnvironment;
  health: ProjectHealth;
  healthLabel: string;
  lastExecution: string;
  duration: string;
  passRate: number;
  openDefects: number;
  openDefectsLabel: string;
  testCount: number;
  swarmMode: string;
  coverageMatrix: CoverageItem[];
  icon: string;
  liveProgress?: {
    percentage: number;
    step: string;
    eta: string;
  };
}

export type RunStatus = 'running' | 'completed' | 'failed' | 'paused' | 'aborted';

export interface TestRun {
  id: string;
  runNumber: string;
  title: string;
  projectSlug: string;
  projectName: string;
  projectDomain: string;
  environment: string;
  browser: string;
  status: RunStatus;
  startedAt: string;
  elapsedSeconds: number;
  remainingSeconds: number;
  totalAssertions: number;
  evaluatedAssertions: number;
  passedAssertions: number;
  failedAssertions: number;
  criticalDefectId?: string;
  currentStepUrl: string;
  currentStepTitle: string;
}

export interface SwarmAgent {
  id: string;
  role: 'Explorer' | 'Tester' | 'Reporter' | 'Planner';
  title: string;
  description: string;
  status: 'ACTIVE' | 'EXECUTING' | 'STANDBY' | 'IDLE';
  icon: string;
  theme: 'primary' | 'secondary' | 'outline';
}

export interface DefectEvidence {
  requestMethod: string;
  endpoint: string;
  req1: string;
  req2: string;
  harFile: string;
  harSize: string;
  domNodesParsed: number;
  latencyMs: number;
  activeCookies: number;
}

export interface BugReport {
  id: string;
  title: string;
  severity: 'CORAL P0' | 'SIGNAL P1' | 'MEDIUM P2' | 'LOW P3';
  severityLevel: 'P0' | 'P1' | 'P2' | 'P3';
  status: 'OPEN' | 'INVESTIGATING' | 'VERIFIED' | 'RESOLVED';
  projectSlug: string;
  projectName: string;
  runId: string;
  expectedBehavior: string;
  actualBehavior: string;
  reproductionSteps: string[];
  reproConfidence: string;
  targetElement: string;
  evidence: DefectEvidence;
  createdAt: string;
}

export interface TestCase {
  id: string;
  name: string;
  description: string;
  category: string;
  projectSlug: string;
  projectName: string;
  assertions: number;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  lastRun: string;
  duration: string;
  depth: string;
}

export interface TerminalLog {
  id: string;
  timestamp: string;
  agent: 'ORCHESTRATOR' | 'EXPLORER' | 'TESTER' | 'REPORTER' | 'OPERATOR' | 'DISCOVERY' | 'SYSTEM' | 'SWARM_WORKER_02';
  message: string;
  type?: 'default' | 'info' | 'error' | 'warning' | 'success';
  highlight?: boolean;
}

export interface Integration {
  id: string;
  name: string;
  description: string;
  category: 'Source Control' | 'API Spec' | 'Trace & HAR' | 'Issue Tracking' | 'Alerting';
  status: 'CONNECTED' | 'DEMO ACTIVE' | 'AVAILABLE' | 'NOT CONFIGURED';
  icon: string;
  meta: string;
  actionLabel: string;
  configured?: boolean;
}

export interface ClusterHealth {
  status: 'operational' | 'degraded' | 'offline';
  region: string;
  clusterId: string;
  allocatedVCPUs: number;
  availableSwarmNodes: number;
  engineVersion: string;
  latencyMs: number;
  uptimeSeconds: number;
}

export interface AnalyticsData {
  passRate: number;
  totalAssertions: number;
  meanTimeToDetect: string;
  totalDefects: number;
  history: { day: string; passRate: number; runs: number; defects: number }[];
  severityBreakdown: { label: string; count: number; pct: number; color: string; text: string }[];
  projectCoverage: { name: string; coverage: number; status: string; color: string }[];
}
