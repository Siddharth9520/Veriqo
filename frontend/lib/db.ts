import { Project, TestRun, BugReport, TestCase, Integration, TerminalLog, ClusterHealth, AnalyticsData } from './types';
import { initialProjects, activeTestRun, initialTestRuns, initialBugReports, initialTestLibrary, initialIntegrations, initialLogs } from './mock-data';

// Server-side in-memory singleton store
class VeriqoDatabase {
  private projects: Project[] = [...initialProjects];
  private testRuns: TestRun[] = [...initialTestRuns];
  private bugReports: BugReport[] = [...initialBugReports];
  private testLibrary: TestCase[] = [...initialTestLibrary];
  private integrations: Integration[] = [...initialIntegrations];
  private logs: TerminalLog[] = [...initialLogs];
  private startTime = Date.now();

  getClusterHealth(): ClusterHealth {
    return {
      status: 'operational',
      region: 'us-east-01',
      clusterId: 'us-east-prod-runner',
      allocatedVCPUs: 16,
      availableSwarmNodes: 3,
      engineVersion: 'v2.4.1b',
      latencyMs: Math.floor(18 + Math.random() * 15),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000) + 14200,
    };
  }

  getProjects(): Project[] {
    return this.projects;
  }

  getProject(slug: string): Project | undefined {
    return this.projects.find((p) => p.slug === slug);
  }

  addProject(projectData: Partial<Project>): Project {
    const slug = (projectData.name || 'app').toLowerCase().replace(/[^a-z0-9]/g, '-');
    const domain = projectData.domain || 'staging.acmeflow.dev';
    const newProj: Project = {
      id: `proj-${Date.now()}`,
      name: projectData.name || 'Connected Web App',
      slug,
      domain,
      environment: projectData.environment || 'Staging',
      health: 'healthy',
      healthLabel: 'Healthy',
      lastExecution: 'Just connected',
      duration: 'Ready',
      passRate: 100,
      openDefects: 0,
      openDefectsLabel: '0 Bugs',
      testCount: 18,
      swarmMode: projectData.swarmMode || 'Deep Heuristic',
      icon: 'dns',
      coverageMatrix: [
        { name: 'Core Landing & Nav', percentage: 100 },
        { name: 'Autonomous Route Discovery', percentage: 100 },
      ],
    };
    this.projects.unshift(newProj);
    return newProj;
  }

  getTestRuns(): TestRun[] {
    return this.testRuns;
  }

  getTestRun(id: string): TestRun | undefined {
    return this.testRuns.find((r) => r.id === id || r.runNumber.toLowerCase() === id.toLowerCase());
  }

  getActiveTestRun(): TestRun {
    const running = this.testRuns.find((r) => r.status === 'running');
    return running || activeTestRun;
  }

  startTestRun(opts: { projectSlug: string; swarmMode: string; environment: string }): TestRun {
    const proj = this.getProject(opts.projectSlug) || this.projects[0];
    const runNum = `#VRQ-${Math.floor(1000 + Math.random() * 9000)}`;
    const newRun: TestRun = {
      id: `run-${Date.now()}`,
      runNumber: runNum,
      title: `RUN ${runNum} // ${opts.swarmMode.toUpperCase()}`,
      projectSlug: proj.slug,
      projectName: proj.name,
      projectDomain: `https://${proj.domain}`,
      environment: opts.environment,
      browser: 'Headless Chromium v128.0.6613',
      status: 'running',
      startedAt: new Date().toISOString().substring(11, 19) + ' UTC',
      elapsedSeconds: 1,
      remainingSeconds: 240,
      totalAssertions: 48,
      evaluatedAssertions: 3,
      passedAssertions: 3,
      failedAssertions: 0,
      currentStepUrl: `https://${proj.domain}/checkout`,
      currentStepTitle: 'Autonomous Crawl In-Flight',
    };
    this.testRuns.unshift(newRun);

    this.addLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().substring(11, 19),
      agent: 'ORCHESTRATOR',
      message: `Dispatched new autonomous execution ${runNum} against ${proj.domain} (${opts.swarmMode})`,
    });

    return newRun;
  }

  updateTestRunStatus(id: string, status: TestRun['status']): TestRun | undefined {
    const run = this.getTestRun(id);
    if (run) {
      run.status = status;
      this.addLog({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString().substring(11, 19),
        agent: 'ORCHESTRATOR',
        message: `Execution ${run.runNumber} status transitioned to: ${status.toUpperCase()}`,
      });
    }
    return run;
  }

  getBugReports(): BugReport[] {
    return this.bugReports;
  }

  getBugReport(id: string): BugReport | undefined {
    return this.bugReports.find((b) => b.id.toLowerCase() === id.toLowerCase());
  }

  pinBugReport(id: string): BugReport | undefined {
    const bug = this.getBugReport(id);
    if (bug) {
      bug.status = 'VERIFIED';
      this.addLog({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString().substring(11, 19),
        agent: 'REPORTER',
        message: `Defect ${bug.id} pinned to Vault with verified Playwright trace.`,
        type: 'success',
      });
    }
    return bug;
  }

  getTestLibrary(): TestCase[] {
    return this.testLibrary;
  }

  addTestCase(tcData: Partial<TestCase>): TestCase {
    const newCase: TestCase = {
      id: `tc-${Date.now()}`,
      name: tcData.name || 'Custom Autonomous Test',
      description: tcData.description || 'User-defined heuristic boundary invariant.',
      category: tcData.category || 'E2E Concurrency & Payments',
      projectSlug: tcData.projectSlug || 'commerce-platform',
      projectName: tcData.projectName || 'Commerce Platform (Storefront Web)',
      assertions: tcData.assertions || 20,
      status: 'PASSED',
      lastRun: 'Just now',
      duration: '1m 10s',
      depth: 'L3 Heuristic',
    };
    this.testLibrary.unshift(newCase);
    return newCase;
  }

  getAnalytics(): AnalyticsData {
    return {
      passRate: 96.2,
      totalAssertions: 48210,
      meanTimeToDetect: '4m 12s',
      totalDefects: this.bugReports.length,
      history: [
        { day: 'Mon', passRate: 98.2, runs: 142, defects: 1 },
        { day: 'Tue', passRate: 97.4, runs: 168, defects: 3 },
        { day: 'Wed', passRate: 99.1, runs: 154, defects: 0 },
        { day: 'Thu', passRate: 95.8, runs: 189, defects: 5 },
        { day: 'Fri', passRate: 92.4, runs: 210, defects: 8 },
        { day: 'Sat', passRate: 94.6, runs: 120, defects: 3 },
        { day: 'Sun', passRate: 96.8, runs: 94, defects: 2 },
      ],
      severityBreakdown: [
        { label: 'Critical P0', count: 3, pct: 25, color: 'bg-[#AC3326]', text: 'text-[#AC3326]' },
        { label: 'High P1', count: 4, pct: 33, color: 'bg-[#FD6E5B]', text: 'text-[#FD6E5B]' },
        { label: 'Medium P2', count: 5, pct: 42, color: 'bg-[#EBC162]', text: 'text-[#4C3800]' },
      ],
      projectCoverage: [
        { name: 'Commerce Platform (Storefront Web)', coverage: 92.4, status: 'Regression Detected', color: 'bg-[#AC3326]' },
        { name: 'Merchant Dashboard & Billing', coverage: 99.4, status: 'Optimal', color: 'bg-[#285C45]' },
        { name: 'Developer API & Webhook Ingestion', coverage: 97.1, status: 'Fuzzing Active', color: 'bg-[#EBC162]' },
        { name: 'Customer Identity & SSO Hub', coverage: 99.8, status: 'Optimal', color: 'bg-[#285C45]' },
        { name: 'Mobile Web Progressive App', coverage: 94.6, status: 'UI Shifts Found', color: 'bg-[#FD6E5B]' },
      ],
    };
  }

  getIntegrations(): Integration[] {
    return this.integrations;
  }

  updateIntegration(id: string, patch: Partial<Integration>): Integration | undefined {
    const item = this.integrations.find((i) => i.id === id);
    if (item) {
      Object.assign(item, patch);
    }
    return item;
  }

  getLogs(): TerminalLog[] {
    return this.logs;
  }

  addLog(log: TerminalLog): TerminalLog {
    this.logs.push(log);
    // Maintain sliding window buffer to prevent memory leakage in long sessions
    if (this.logs.length > 500) {
      this.logs.splice(0, this.logs.length - 500);
    }
    return log;
  }
}

// Global declaration to maintain singleton across Next.js HMR reloads
const globalForDb = globalThis as unknown as { veriqoDb: VeriqoDatabase };
export const db = globalForDb.veriqoDb || new VeriqoDatabase();
if (process.env.NODE_ENV !== 'production') globalForDb.veriqoDb = db;
