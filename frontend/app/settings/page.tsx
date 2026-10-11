'use client';

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icons';

export default function SettingsPage() {
  const [browserEngine, setBrowserEngine] = useState('Headless Chromium v128.0');
  const [viewport, setViewport] = useState('1440x900 Desktop @ 60fps');
  const [concurrency, setConcurrency] = useState('16 vCPUs (4 Nodes)');
  const [fuzzInterval, setFuzzInterval] = useState('12ms (Race Stress)');
  const [slackAlerts, setSlackAlerts] = useState(true);
  const [harCapture, setHarCapture] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Autonomous QA Engine configuration saved successfully!');
  };

  return (
    <div className="flex flex-col w-full p-4 sm:p-6 lg:p-8 gap-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 font-mono text-[12px] text-[#404943] uppercase">
          <span>Workspace</span>
          <span className="text-[#717973]">/</span>
          <span className="text-[#1A1C1A] font-bold">Settings</span>
        </div>
        <h1 className="font-headline text-[28px] sm:text-[34px] font-bold text-[#1A1C1A] tracking-tight">
          Cluster &amp; Execution Preferences
        </h1>
        <p className="font-body text-[14px] text-[#404943]">
          Configure autonomous swarm concurrency, DevTools browser containers, and real-time failure notification routes.
        </p>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-6">
        {/* User Profile Card */}
        <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] shadow-[4px_4px_0px_#1a1c1a] p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b-2 border-[#1A1C1A]">
            <h2 className="font-headline text-[18px] font-bold text-[#1A1C1A]">
              Operator Profile
            </h2>
            <span className="font-mono text-[11px] bg-[#B7EFD0] text-[#002114] px-2 py-0.5 border border-[#1A1C1A] font-bold uppercase">
              Authenticated
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#0B442F] border-2 border-[#1A1C1A] flex items-center justify-center text-white shadow-[2px_2px_0px_#1a1c1a] flex-shrink-0">
              <Icon name="person" className="w-7 h-7 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-headline font-bold text-[18px] text-[#1A1C1A]">
                E. Turing
              </span>
              <span className="font-mono text-[12px] text-[#404943]">
                e.turing@acmeflow.dev · Lead QA Architect
              </span>
              <span className="font-mono text-[11px] text-[#717973] mt-0.5">
                Role: Cluster Administrator (Read / Write / Abort)
              </span>
            </div>
          </div>
        </div>

        {/* Headless Browser Execution Engine */}
        <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] shadow-[4px_4px_0px_#1a1c1a] p-5 flex flex-col gap-4 font-mono text-[12px]">
          <div className="flex items-center justify-between pb-3 border-b-2 border-[#1A1C1A]">
            <div className="flex items-center gap-2">
              <Icon name="laptop_chromebook" className="w-5 h-5 text-[#285C45] flex-shrink-0" />
              <h2 className="font-headline text-[18px] font-bold text-[#1A1C1A]">
                Headless Browser &amp; Cluster Engine
              </h2>
            </div>
            <span className="text-[#717973] text-[11px]">Playwright / CDP Protocol</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold uppercase text-[#404943] mb-1">
                Chromium Engine Version
              </label>
              <select
                value={browserEngine}
                onChange={(e) => setBrowserEngine(e.target.value)}
                className="w-full bg-[#FAF9F6] border-2 border-[#1A1C1A] p-2 font-bold focus:outline-none"
              >
                <option value="Headless Chromium v128.0">Headless Chromium v128.0 (Recommended)</option>
                <option value="Headless Chromium v127.0 LTS">Headless Chromium v127.0 LTS</option>
                <option value="WebKit (Safari 17.4 Core)">WebKit (Safari 17.4 Core)</option>
                <option value="Firefox ESR 128">Firefox ESR 128</option>
              </select>
            </div>

            <div>
              <label className="block font-bold uppercase text-[#404943] mb-1">
                Default Viewport Calibration
              </label>
              <select
                value={viewport}
                onChange={(e) => setViewport(e.target.value)}
                className="w-full bg-[#FAF9F6] border-2 border-[#1A1C1A] p-2 font-bold focus:outline-none"
              >
                <option value="1440x900 Desktop @ 60fps">1440x900 Desktop @ 60fps (Standard)</option>
                <option value="1920x1080 1080p FHD">1920x1080 1080p FHD</option>
                <option value="iPhone 15 Pro (393x852)">iPhone 15 Pro (393x852)</option>
                <option value="Pixel 8 (412x915)">Pixel 8 (412x915)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold uppercase text-[#404943] mb-1">
                Runner Cluster Allocation
              </label>
              <select
                value={concurrency}
                onChange={(e) => setConcurrency(e.target.value)}
                className="w-full bg-[#FAF9F6] border-2 border-[#1A1C1A] p-2 font-bold focus:outline-none"
              >
                <option value="16 vCPUs (4 Nodes)">16 vCPUs (4 Distributed Swarm Nodes)</option>
                <option value="8 vCPUs (2 Nodes)">8 vCPUs (2 Swarm Nodes)</option>
                <option value="32 vCPUs (Dedicated Fleet)">32 vCPUs (Dedicated Fleet)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold uppercase text-[#404943] mb-1">
                Idempotency Fuzzer Click Interval
              </label>
              <select
                value={fuzzInterval}
                onChange={(e) => setFuzzInterval(e.target.value)}
                className="w-full bg-[#FAF9F6] border-2 border-[#1A1C1A] p-2 font-bold focus:outline-none"
              >
                <option value="12ms (Race Stress)">12ms (Extreme Race Condition Stress)</option>
                <option value="25ms (Moderate)">25ms (Moderate Rapid Double-Click)</option>
                <option value="50ms (Conservative)">50ms (Conservative Burst)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Telemetry & Notification Toggles */}
        <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] shadow-[4px_4px_0px_#1a1c1a] p-5 flex flex-col gap-4 font-mono text-[12px]">
          <div className="flex items-center justify-between pb-3 border-b-2 border-[#1A1C1A]">
            <div className="flex items-center gap-2">
              <Icon name="notifications_active" className="w-5 h-5 text-[#285C45] flex-shrink-0" />
              <h2 className="font-headline text-[18px] font-bold text-[#1A1C1A]">
                Quality Alerts &amp; Evidence Storage
              </h2>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <label className="flex items-center justify-between p-3 border border-[#C0C9C1] bg-[#FAF9F6] cursor-pointer hover:bg-[#EEEEEA]">
              <div className="flex flex-col">
                <span className="font-bold text-[#1A1C1A]">Broadcast Critical P0 Alerts to Slack</span>
                <span className="text-[#404943] text-[11px]">Send immediate webhook with HAR download links on regression detection</span>
              </div>
              <input
                type="checkbox"
                checked={slackAlerts}
                onChange={(e) => setSlackAlerts(e.target.checked)}
                className="w-5 h-5 accent-[#285C45]"
              />
            </label>

            <label className="flex items-center justify-between p-3 border border-[#C0C9C1] bg-[#FAF9F6] cursor-pointer hover:bg-[#EEEEEA]">
              <div className="flex flex-col">
                <span className="font-bold text-[#1A1C1A]">Auto-Capture HAR Network Dumps on Assert Failure</span>
                <span className="text-[#404943] text-[11px]">Dumps full request headers, payload bodies, and timing waterfalls to S3/GCS</span>
              </div>
              <input
                type="checkbox"
                checked={harCapture}
                onChange={(e) => setHarCapture(e.target.checked)}
                className="w-5 h-5 accent-[#285C45]"
              />
            </label>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => showToast('Changes discarded.')}
            className="px-5 py-2.5 bg-[#FFFFFF] border-2 border-[#1A1C1A] font-headline text-[13px] uppercase font-bold shadow-[3px_3px_0px_#1a1c1a] hover:bg-[#EEEEEA] brutal-btn"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 bg-[#285C45] text-white border-2 border-[#1A1C1A] font-headline text-[13px] uppercase font-bold shadow-[3px_3px_0px_#1a1c1a] hover:bg-[#0B442F] brutal-btn"
          >
            Save Preferences
          </button>
        </div>
      </form>

      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-[#191B19] text-[#F1F1ED] border-2 border-[#1A1C1A] px-4 py-2.5 font-mono text-[12px] shadow-[4px_4px_0px_#1a1c1a] z-50 flex items-center gap-2 animate-in fade-in duration-100">
          <Icon name="check" className="w-4 h-4 text-[#B7EFD0]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
