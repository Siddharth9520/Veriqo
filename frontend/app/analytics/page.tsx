'use client';

import React, { useState, useEffect, useCallback } from 'react';
import MetricCard from '@/components/ui/MetricCard';
import { apiClient } from '@/lib/api-client';
import { AnalyticsData } from '@/lib/types';
import { Icon } from '@/components/ui/Icons';

const defaultAnalytics: AnalyticsData = {
  passRate: 96.2,
  totalAssertions: 48210,
  meanTimeToDetect: '4m 12s',
  totalDefects: 12,
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

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData>(defaultAnalytics);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [timeRange, setTimeRange] = useState('7D');
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getAnalytics();
      setData(res);
      setIsLive(true);
    } catch (err: unknown) {
      setIsLive(false);
      const msg = err instanceof Error ? err.message : 'Cluster unreachable';
      setError(msg);
      setData(defaultAnalytics);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    apiClient.getAnalytics()
      .then((res) => {
        if (isMounted) {
          setData(res);
          setIsLive(true);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setIsLive(false);
          const msg = err instanceof Error ? err.message : 'Cluster unreachable';
          setError(msg);
          setData(defaultAnalytics);
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="flex flex-col w-full p-4 sm:p-6 lg:p-8 gap-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 font-mono text-[12px] text-[#404943] uppercase flex-wrap">
            <span>Workspace</span>
            <span className="text-[#717973]">/</span>
            <span className="text-[#1A1C1A] font-bold">Analytics</span>
            <span
              className={`ml-1 text-[10px] font-mono px-2 py-0.5 border border-[#1A1C1A] uppercase font-bold rounded-md brutal-shadow-xs ${
                isLive ? 'bg-[#B7EFD0] text-[#002114]' : 'bg-[#FFDAD6] text-[#93000A]'
              }`}
            >
              {isLive ? '● [Live Cluster Telemetry]' : '▲ [Demo Offline Cache]'}
            </span>
          </div>
          <h1 className="font-headline text-[28px] sm:text-[34px] font-bold text-[#1A1C1A] tracking-tight">
            Quality Engineering &amp; Coverage Metrics
          </h1>
          <p className="font-body text-[14px] text-[#404943]">
            Track flakiness ratios, idempotency stress trends, and defect escape rates across autonomous testing runs.
          </p>
        </div>

        {/* Time-Range Switcher */}
        <div className="flex border-2 border-[#1A1C1A] bg-[#FFFFFF] p-1 font-mono text-[11px] font-bold rounded-lg brutal-shadow-sm gap-1">
          {['24H', '7D', '30D', '90D'].map((range) => (
            <button
              key={range}
              onClick={() => {
                setTimeRange(range);
                showToast(`Aggregated metrics scoped to ${range} window.`);
              }}
              className={`px-3 py-1 transition-colors rounded-md ${
                timeRange === range ? 'bg-[#285C45] text-white shadow-xs' : 'text-[#404943] hover:bg-[#EEEEEA]'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] p-4 flex items-center justify-center gap-3 brutal-shadow-sm rounded-xl font-mono text-[12px]">
          <div className="w-4 h-4 border-2 border-[#285C45] border-t-transparent rounded-full animate-spin"></div>
          <span className="font-bold uppercase text-[#1A1C1A]">Retrieving real-time telemetry from cluster nodes...</span>
        </div>
      )}

      {error && (
        <div className="bg-[#FFDAD6] border-2 border-[#AC3326] p-3 flex items-center justify-between gap-3 font-mono text-[12px] text-[#93000A] brutal-shadow-sm rounded-xl">
          <span>Failed to query cluster telemetry: {error}. Displaying local cached metrics.</span>
          <button
            onClick={loadAnalytics}
            className="bg-[#FFFFFF] text-[#1A1C1A] border border-[#1A1C1A] px-2.5 py-1 font-bold uppercase hover:bg-[#E8E8E5] rounded-md brutal-btn"
          >
            Retry
          </button>
        </div>
      )}

      {/* Top Telemetry Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          label="Overall Pass Rate"
          value={`${data.passRate}%`}
          icon="verified"
          iconBg="bg-[#B7EFD0]"
          iconColor="text-[#002114]"
          footerLeft={<span className="font-mono text-[11px] text-[#0B442F] font-bold">+1.4% vs last cycle</span>}
        />
        <MetricCard
          label="Total Assertions Evaluated"
          value={data.totalAssertions.toLocaleString()}
          icon="check_circle"
          iconBg="bg-[#EEEEEA]"
          iconColor="text-[#1A1C1A]"
          footerLeft={<span className="font-mono text-[11px] text-[#404943]">Across active projects</span>}
        />
        <MetricCard
          label="Mean Time To Detect (MTTD)"
          value={data.meanTimeToDetect}
          icon="speed"
          iconBg="bg-[#B7EFD0]"
          iconColor="text-[#002114]"
          footerLeft={<span className="font-mono text-[11px] text-[#0B442F] font-bold">88% faster than manual QA</span>}
        />
        <MetricCard
          label="Defect Hotspots"
          value={`${data.totalDefects} Logged`}
          icon="bug_report"
          iconBg="bg-[#FFDAD5]"
          iconColor="text-[#AC3326]"
          footerLeft={<span className="font-mono text-[10px] bg-[#AC3326] text-white px-2 py-0.5 font-bold uppercase rounded-md brutal-shadow-xs">3 Critical P0</span>}
        />
      </div>

      {/* Charts Split Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pass Rate Trend Chart (7 cols) */}
        <div className="lg:col-span-7 bg-[#FFFFFF] border-2 border-[#1A1C1A] brutal-shadow-lg rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-2 border-b-2 border-[#1A1C1A]">
            <div className="flex flex-col">
              <span className="font-mono text-[11px] uppercase font-bold text-[#717973]">Historical Trajectory</span>
              <h2 className="font-headline text-[18px] font-bold text-[#1A1C1A]">
                Pass Rate Trend ({timeRange})
              </h2>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 bg-[#285C45] rounded-xs inline-block"></span> Pass %
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 bg-[#FD6E5B] rounded-xs inline-block"></span> Defects
              </span>
            </div>
          </div>

          {/* SVG Bar Chart Visualization */}
          <div className="h-64 w-full flex items-end justify-between gap-3 pt-6 pb-2 px-2 border border-[#C0C9C1] bg-[#FAF9F6] rounded-xl">
            {data.history.map((d, idx) => {
              const heightPct = ((d.passRate - 80) / 20) * 100;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end gap-1 group relative">
                  {/* Tooltip */}
                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-[#191B19] text-[#F1F1ED] font-mono text-[10px] px-2 py-1 border border-[#1A1C1A] whitespace-nowrap z-20 pointer-events-none brutal-shadow-sm rounded-md">
                    {d.day}: {d.passRate}% ({d.runs} runs, {d.defects} defects)
                  </div>

                  <div className="w-full flex items-end justify-center gap-1 h-48">
                    {/* Pass rate bar */}
                    <div
                      className="w-full max-w-[28px] bg-[#285C45] border border-[#1A1C1A] rounded-t-md transition-all duration-300 group-hover:bg-[#0B442F]"
                      style={{ height: `${Math.max(15, heightPct)}%` }}
                    ></div>
                  </div>

                  <span className="font-mono text-[11px] font-bold text-[#1A1C1A] mt-1">
                    {d.day}
                  </span>
                  <span className="font-mono text-[9px] text-[#717973]">
                    {d.passRate}%
                  </span>
                </div>
              );
            })}
          </div>

          <div className="font-mono text-[11px] text-[#404943] flex items-center justify-between">
            <span>Benchmark Baseline: 95.0% Pass Threshold</span>
            <span className="text-[#0B442F] font-bold">Stable Compliance</span>
          </div>
        </div>

        {/* Defect Severity Distribution (5 cols) */}
        <div className="lg:col-span-5 bg-[#FFFFFF] border-2 border-[#1A1C1A] brutal-shadow-lg rounded-xl p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between pb-2 border-b-2 border-[#1A1C1A]">
              <div className="flex flex-col">
                <span className="font-mono text-[11px] uppercase font-bold text-[#717973]">Risk Breakdown</span>
                <h2 className="font-headline text-[18px] font-bold text-[#1A1C1A]">
                  Defect Severity Breakdown
                </h2>
              </div>
              <span className="font-mono text-[11px] font-bold bg-[#E2E3DF] px-2 py-0.5 border border-[#1A1C1A] rounded-md">
                {data.totalDefects} ACTIVE
              </span>
            </div>

            {/* Severity bars */}
            <div className="flex flex-col gap-3 mt-4">
              {data.severityBreakdown.map((item, idx) => (
                <div key={idx} className="flex flex-col gap-1">
                  <div className="flex justify-between font-mono text-[12px]">
                    <span className="font-bold text-[#1A1C1A]">{item.label}</span>
                    <span className={`font-bold ${item.text}`}>{item.count} defects ({item.pct}%)</span>
                  </div>
                  <div className="w-full h-3 bg-[#E2E3DF] border border-[#1A1C1A] rounded-full overflow-hidden">
                    <div
                      className={`${item.color} h-full transition-all duration-300 rounded-full`}
                      style={{ width: `${item.pct}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick takeaway note */}
          <div className="bg-[#FAF9F6] border border-[#1A1C1A] p-3 font-mono text-[11px] text-[#404943] leading-relaxed rounded-xl">
            <strong className="text-[#1A1C1A] block mb-0.5">Autonomous Insight:</strong>
            Rapid double-click idempotency failures account for 66% of Critical P0 classifications detected in staging this week.
          </div>
        </div>
      </div>

      {/* Subsystem Fleet Coverage Table */}
      <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] brutal-shadow-lg rounded-xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between pb-2 border-b-2 border-[#1A1C1A]">
          <h2 className="font-headline text-[18px] font-bold text-[#1A1C1A]">
            Project Fleet Health Index Comparison
          </h2>
          <span className="font-mono text-[11px] text-[#717973]">Depth Matrix L1-L4</span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-[#1A1C1A]">
          <table className="w-full text-left font-mono text-[12px]">
            <thead>
              <tr className="border-b-2 border-[#1A1C1A] bg-[#F4F4F0] text-[#1A1C1A] uppercase font-bold text-[11px]">
                <th className="py-2.5 px-3">Application Project</th>
                <th className="py-2.5 px-3">Autonomous Coverage</th>
                <th className="py-2.5 px-3">Quality Health Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E3DF]">
              {data.projectCoverage.map((proj, idx) => (
                <tr key={idx} className="hover:bg-[#FAF9F6] transition-colors">
                  <td className="py-3 px-3 font-bold text-[#1A1C1A]">{proj.name}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2 max-w-xs">
                      <div className="w-full h-2.5 bg-[#E2E3DF] border border-[#1A1C1A] rounded-full overflow-hidden">
                        <div className={`${proj.color} h-full rounded-full`} style={{ width: `${proj.coverage}%` }}></div>
                      </div>
                      <span className="font-bold">{proj.coverage}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 bg-[#EEEEEA] border border-[#1A1C1A] font-bold uppercase text-[10px] rounded-md">
                      {proj.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => showToast(`Audit Report requested for ${proj.name}`)}
                      className="text-[#285C45] hover:underline font-bold text-[11px]"
                    >
                      Audit Report &rarr;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-[#191B19] text-[#F1F1ED] border-2 border-[#1A1C1A] px-4 py-2.5 font-mono text-[12px] brutal-shadow rounded-lg z-50 flex items-center gap-2 animate-in fade-in duration-100">
          <Icon name="verified" className="w-4 h-4 text-[#B7EFD0]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
