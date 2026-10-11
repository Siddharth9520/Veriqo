'use client';

import React, { useState, useEffect, useCallback } from 'react';
import MetricCard from '@/components/ui/MetricCard';
import ProjectCard from '@/components/dashboard/ProjectCard';
import ConnectAppModal from '@/components/forms/ConnectAppModal';
import { initialProjects } from '@/lib/mock-data';
import { Project } from '@/lib/types';
import { apiClient, ApiError } from '@/lib/api-client';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [envFilter, setEnvFilter] = useState('All');
  const [healthFilter, setHealthFilter] = useState('All');
  const [sortOrder, setSortOrder] = useState('Recent Execution');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [quickUrl, setQuickUrl] = useState('');
  const [quickConnecting, setQuickConnecting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await apiClient.getProjects();
      setProjects(data);
      setIsLive(true);
    } catch (err: unknown) {
      setIsLive(false);
      const msg = err instanceof Error ? err.message : 'Failed to reach Veriqo cluster';
      setFetchError(msg);
      setProjects(initialProjects);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    apiClient.getProjects()
      .then((data) => {
        if (isMounted) {
          setProjects(data);
          setIsLive(true);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setIsLive(false);
          const msg = err instanceof Error ? err.message : 'Failed to reach Veriqo cluster';
          setFetchError(msg);
          setProjects(initialProjects);
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleQuickConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickUrl.trim();
    if (!trimmed) return;

    setQuickConnecting(true);
    try {
      let domain = trimmed;
      try {
        const parsed = trimmed.includes('://') ? new URL(trimmed) : new URL(`https://${trimmed}`);
        domain = parsed.hostname;
      } catch {
        domain = trimmed.replace(/^https?:\/\//i, '').split('/')[0];
      }

      const newProj = await apiClient.connectProject({
        name: `Connected: ${domain}`,
        domain,
        environment: 'Staging',
        swarmMode: 'Deep Heuristic',
      });

      setQuickUrl('');
      showToast(`Connected ${newProj.domain} to Autonomic Runner!`);
      // Reload projects from server
      await loadProjects();
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Invalid URL or cluster connection error.';
      showToast(`Connection failed: ${msg}`);
    } finally {
      setQuickConnecting(false);
    }
  };

  const handleFlushQueues = async () => {
    try {
      await apiClient.addLog({
        agent: 'OPERATOR',
        message: 'Flushed runner queues. 16 vCPUs re-allocated to idle pool.',
        type: 'info',
      });
      showToast('Flushed runner queues. 16 vCPUs re-allocated to idle pool.');
    } catch {
      showToast('Flushed local runner queues.');
    }
  };

  // Filter logic
  const filteredProjects = projects.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.domain.toLowerCase().includes(searchQuery.toLowerCase());
    const matchEnv = envFilter === 'All' || p.environment.toLowerCase().includes(envFilter.toLowerCase());
    const matchHealth =
      healthFilter === 'All' ||
      (healthFilter === 'healthy' && p.health === 'healthy') ||
      (healthFilter === 'regression' && (p.health === 'critical_regression' || p.health === 'warning')) ||
      (healthFilter === 'scanning' && p.health === 'scanning');
    return matchSearch && matchEnv && matchHealth;
  });

  // Calculate dynamic metrics
  const totalBugs = projects.reduce((acc, p) => acc + (p.openDefects || 0), 0);
  const healthyCount = projects.filter((p) => p.health === 'healthy').length;
  const healthPercent = projects.length > 0 ? Math.round((healthyCount / projects.length) * 100) : 100;

  return (
    <div className="flex flex-col w-full p-4 sm:p-6 lg:p-8 gap-6 max-w-7xl mx-auto">
      {/* Top Header Section */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 font-mono text-[12px] text-[#404943] uppercase tracking-wider flex-wrap">
            <span>Workspace</span>
            <span className="text-[#717973]">/</span>
            <span className="text-[#1A1C1A] font-semibold">Projects</span>
            <span
              className={`ml-1 text-[10px] font-mono px-1.5 py-0.5 border border-[#1A1C1A] uppercase font-bold ${
                isLive ? 'bg-[#B7EFD0] text-[#002114]' : 'bg-[#FFDAD6] text-[#93000A]'
              }`}
            >
              {isLive ? '● [Live Cluster Sync]' : '▲ [Demo Fallback Mode]'}
            </span>
          </div>
          <h1 className="font-headline text-[28px] sm:text-[34px] text-[#1A1C1A] tracking-tight font-bold">
            Your projects.
          </h1>
          <p className="font-body text-[14px] sm:text-[15px] leading-relaxed text-[#404943] max-w-2xl">
            Manage connected applications, inspect automated coverage health, and trigger autonomous regression runs across your web fleets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start xl:self-end">
          <button
            onClick={() => setConnectModalOpen(true)}
            className="bg-[#FFFFFF] text-[#1A1C1A] border-2 border-[#1A1C1A] px-4 py-2 font-headline text-[13px] uppercase brutal-shadow hover:bg-[#E8E8E5] brutal-btn flex items-center gap-1.5 font-bold"
          >
            <span className="material-symbols-outlined text-[18px]">file_upload</span>
            <span>Import OpenAPI / HAR Spec</span>
          </button>
          <button
            onClick={() => setConnectModalOpen(true)}
            className="bg-[#285C45] text-white border-2 border-[#1A1C1A] px-4 py-2 font-headline text-[13px] uppercase brutal-shadow hover:bg-[#0B442F] brutal-btn flex items-center gap-1.5 font-bold"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>+ Connect New Application</span>
          </button>
        </div>
      </div>

      {/* Error state if cluster fetch failed */}
      {fetchError && (
        <div className="bg-[#FFDAD6] border-2 border-[#AC3326] p-3 flex items-center justify-between gap-3 font-mono text-[12px] text-[#93000A] brutal-shadow-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">warning</span>
            <span>Live cluster sync unavailable: {fetchError}. Serving local offline cache.</span>
          </div>
          <button
            onClick={loadProjects}
            className="bg-[#FFFFFF] text-[#1A1C1A] border border-[#1A1C1A] px-2.5 py-1 font-bold uppercase hover:bg-[#E8E8E5]"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Fleet Telemetry / Metrics Summary Strips */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        <MetricCard
          label="Connected Projects"
          value={`${projects.length} Connected`}
          icon="dns"
          iconBg="bg-[#B7EFD0]"
          iconColor="text-[#002114]"
          footerLeft={
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#285C45] inline-block"></span>
              <span className="font-mono text-[11px] uppercase font-bold text-[#1A1C1A]">
                100% Online
              </span>
            </div>
          }
          footerRight={
            <span className="font-mono text-[11px] text-[#404943]">0 unreachable</span>
          }
        />

        <MetricCard
          label="Fleet Health Index"
          value={`${healthPercent}%`}
          icon="verified"
          iconBg="bg-[#EEEEEA]"
          iconColor="text-[#0B442F]"
          footerLeft={
            <span className="font-mono text-[11px] uppercase text-[#404943]">
              {healthyCount} of {projects.length} Healthy
            </span>
          }
          footerRight={
            <span className="font-mono text-[11px] font-bold text-[#0B442F]">
              +1.8% vs last week
            </span>
          }
        />

        <MetricCard
          label="Defect Hotspots"
          value={`${totalBugs} Pending`}
          icon="crisis_alert"
          iconBg="bg-[#FFDAD5]"
          iconColor="text-[#AC3326]"
          footerLeft={
            <span className="font-mono text-[10px] bg-[#AC3326] text-white px-1.5 py-0.5 border border-[#1A1C1A] font-bold uppercase">
              3 Critical P0
            </span>
          }
          footerRight={
            <span className="font-mono text-[10px] bg-[#E8E8E5] text-[#1A1C1A] px-1.5 py-0.5 border border-[#1A1C1A] font-semibold uppercase">
              {Math.max(0, totalBugs - 3)} Medium P2
            </span>
          }
        />
      </div>

      {/* Search & Filter Console Controls */}
      <div className="bg-[#F4F4F0] border-2 border-[#1A1C1A] p-3 brutal-shadow flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        {/* Search Bar */}
        <div className="flex-1 flex items-center bg-[#FFFFFF] border-2 border-[#1A1C1A] px-3 py-1.5 brutal-shadow-sm focus-within:shadow-[3px_3px_0px_#285c45]">
          <span className="material-symbols-outlined text-[#404943] text-[20px] mr-2">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by project name, host or branch..."
            className="w-full bg-transparent font-mono text-[12px] text-[#1A1C1A] placeholder:text-[#717973] focus:outline-none"
          />
          <span className="font-mono text-[10px] bg-[#E2E3DF] border border-[#1A1C1A] px-1.5 py-0.5 text-[#1A1C1A] hidden sm:inline-block">
            /
          </span>
        </div>

        {/* Filter Dropdowns & View Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Environment Dropdown */}
          <div className="relative flex items-center bg-[#FFFFFF] border-2 border-[#1A1C1A] px-3 py-1.5 brutal-shadow-sm">
            <span className="font-mono text-[11px] uppercase font-bold text-[#717973] mr-1.5">Env:</span>
            <select
              value={envFilter}
              onChange={(e) => setEnvFilter(e.target.value)}
              className="bg-transparent font-mono text-[11px] text-[#1A1C1A] font-bold focus:outline-none cursor-pointer uppercase"
            >
              <option value="All">All Environments</option>
              <option value="Staging">Staging</option>
              <option value="Prod Canary">Prod Canary</option>
              <option value="Dev Sandbox">Dev Sandbox</option>
            </select>
          </div>

          {/* Health Status Dropdown */}
          <div className="relative flex items-center bg-[#FFFFFF] border-2 border-[#1A1C1A] px-3 py-1.5 brutal-shadow-sm">
            <span className="font-mono text-[11px] uppercase font-bold text-[#717973] mr-1.5">Health:</span>
            <select
              value={healthFilter}
              onChange={(e) => setHealthFilter(e.target.value)}
              className="bg-transparent font-mono text-[11px] text-[#1A1C1A] font-bold focus:outline-none cursor-pointer uppercase"
            >
              <option value="All">All Statuses</option>
              <option value="healthy">Healthy (No Regressions)</option>
              <option value="regression">Regressions Found</option>
              <option value="scanning">Scanning in Progress</option>
            </select>
          </div>

          {/* Sort Dropdown */}
          <div className="relative flex items-center bg-[#FFFFFF] border-2 border-[#1A1C1A] px-3 py-1.5 brutal-shadow-sm">
            <span className="font-mono text-[11px] uppercase font-bold text-[#717973] mr-1.5">Sort:</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="bg-transparent font-mono text-[11px] text-[#1A1C1A] font-bold focus:outline-none cursor-pointer uppercase"
            >
              <option value="Recent Execution">Recent Execution</option>
              <option value="Highest Risk">Highest Risk</option>
              <option value="Assertion Count">Assertion Count</option>
            </select>
          </div>

          {/* View Switcher */}
          <div className="flex items-center border-2 border-[#1A1C1A] bg-[#FFFFFF] brutal-shadow-sm p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 flex items-center justify-center transition-colors ${
                viewMode === 'grid' ? 'bg-[#285C45] text-white' : 'text-[#1A1C1A] hover:bg-[#E8E8E5]'
              }`}
              title="Grid View"
            >
              <span className="material-symbols-outlined text-[18px]">grid_view</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 flex items-center justify-center transition-colors ${
                viewMode === 'list' ? 'bg-[#285C45] text-white' : 'text-[#1A1C1A] hover:bg-[#E8E8E5]'
              }`}
              title="List View"
            >
              <span className="material-symbols-outlined text-[18px]">view_list</span>
            </button>
          </div>
        </div>
      </div>

      {/* Projects Grid / List */}
      {loading && projects.length === 0 ? (
        <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] p-12 text-center flex flex-col items-center gap-3 brutal-shadow">
          <div className="w-8 h-8 border-4 border-[#285C45] border-t-transparent rounded-full animate-spin"></div>
          <span className="font-mono text-[13px] font-bold uppercase text-[#1A1C1A]">
            Querying Veriqo Cluster Registry...
          </span>
        </div>
      ) : (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 lg:grid-cols-2 gap-6'
              : 'flex flex-col gap-4'
          }
        >
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              viewMode={viewMode}
              onOpenDetails={(p) => showToast(`Opened fleet inspector for ${p.name}`)}
            />
          ))}

          {/* Quick Connect Promo Card */}
          <div className="bg-[#F4F4F0] border-2 border-dashed border-[#1A1C1A] p-6 flex flex-col justify-between items-center text-center gap-4 hover:bg-[#EEEEEA] transition-colors brutal-shadow">
            <div className="flex flex-col items-center gap-2 mt-2">
              <div className="w-14 h-14 bg-[#FFFFFF] border-2 border-[#1A1C1A] flex items-center justify-center brutal-shadow">
                <span className="material-symbols-outlined text-[#1A1C1A] text-[32px]">add_link</span>
              </div>
              <h3 className="font-headline text-[20px] text-[#1A1C1A] font-bold mt-1">
                Connect Another Web App
              </h3>
              <p className="font-body text-[13px] text-[#404943] max-w-sm">
                Paste your staging URL, connect a repository via GitHub App, or ingest Swagger schemas to launch an autonomous crawler suite in seconds.
              </p>
            </div>

            <form onSubmit={handleQuickConnect} className="w-full max-w-md flex flex-col gap-2">
              <div className="flex items-center bg-[#FFFFFF] border-2 border-[#1A1C1A] brutal-shadow-sm p-1">
                <input
                  type="text"
                  value={quickUrl}
                  onChange={(e) => setQuickUrl(e.target.value)}
                  placeholder="https://preview.yourdomain.com"
                  className="w-full bg-transparent font-mono text-[12px] text-[#1A1C1A] px-2 focus:outline-none"
                  disabled={quickConnecting}
                />
                <button
                  type="submit"
                  disabled={quickConnecting}
                  className="bg-[#285C45] text-white px-3 py-1 font-headline text-[11px] uppercase border border-[#1A1C1A] whitespace-nowrap hover:bg-[#0B442F] font-bold brutal-shadow-sm brutal-btn disabled:opacity-50"
                >
                  {quickConnecting ? 'Connecting...' : 'Connect & Crawl'}
                </button>
              </div>

              <div className="flex items-center justify-center gap-4 font-mono text-[11px] text-[#404943]">
                <button
                  type="button"
                  onClick={() => setConnectModalOpen(true)}
                  className="flex items-center gap-1 hover:text-[#1A1C1A] underline"
                >
                  <span className="material-symbols-outlined text-[14px]">code</span>
                  &lt;&gt; Link GitHub Repo
                </button>
                <span className="text-[#717973]">·</span>
                <button
                  type="button"
                  onClick={() => setConnectModalOpen(true)}
                  className="flex items-center gap-1 hover:text-[#1A1C1A] underline"
                >
                  <span className="material-symbols-outlined text-[14px]">description</span>
                  Upload OpenAPI/Swagger Spec
                </button>
              </div>
            </form>

            <div className="font-mono text-[11px] text-[#717973] mb-1">
              Zero SDK configuration required · Autonomous state mapper
            </div>
          </div>
        </div>
      )}

      {/* Bottom Workspace Diagnostics Strip */}
      <div className="bg-[#191B19] text-[#F1F1ED] border-2 border-[#1A1C1A] p-4 brutal-shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-[#B7EFD0] border border-[#1A1C1A] animate-pulse"></div>
          <div className="flex flex-col">
            <span className="font-mono text-[12px] font-bold uppercase tracking-wider text-[#B7EFD0]">
              Autonomic Runner Health
            </span>
            <span className="font-mono text-[11px] text-[#C0C9C1]">
              Cluster us-east-prod-runner · 16 vCPUs allocated · Idle swarms: 3 available
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="bg-[#1A1C1A] border border-[#717973] px-2 py-1 text-[#FAF9F6]">
            Engine: v2.4.1b
          </span>
          <button
            onClick={handleFlushQueues}
            className="bg-[#285C45] text-white px-3 py-1 border border-[#1A1C1A] font-semibold hover:bg-[#0B442F] uppercase brutal-shadow-sm brutal-btn"
          >
            Flush Runner Queues
          </button>
        </div>
      </div>

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-[#191B19] text-[#F1F1ED] border-2 border-[#1A1C1A] px-4 py-2.5 font-mono text-[12px] brutal-shadow-lg z-50 flex items-center gap-2 animate-in fade-in duration-100">
          <span className="material-symbols-outlined text-[#B7EFD0] text-[18px]">verified</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Connection Modal */}
      <ConnectAppModal
        isOpen={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        onSuccess={async (newP) => {
          showToast(`Connected ${newP.name} to Veriqo Cluster!`);
          await loadProjects();
        }}
      />
    </div>
  );
}
