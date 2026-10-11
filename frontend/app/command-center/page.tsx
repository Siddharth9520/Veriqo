'use client';

import React, { useState } from 'react';
import CommandBar from '@/components/testing/CommandBar';
import BrowserPreview from '@/components/testing/BrowserPreview';
import AgentStatusCard from '@/components/agents/AgentStatusCard';
import CriticalDefectCard from '@/components/evidence/CriticalDefectCard';
import TerminalPanel from '@/components/agents/TerminalPanel';
import EvidenceModal from '@/components/evidence/EvidenceModal';
import { Icon } from '@/components/ui/Icons';

export default function CommandCenterPage() {
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const scrollToTerminal = () => {
    const el = document.getElementById('live-terminal-panel');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleDownloadHar = () => {
    showToast('Snapshot exported: har_dump_9482.har (1,418 KB)');
  };

  return (
    <div className="flex flex-col w-full pb-12">
      {/* Top Execution Command Bar */}
      <CommandBar
        onScrollToTerminal={scrollToTerminal}
        onDownloadHar={handleDownloadHar}
      />

      {/* Main Split Layout: 60% Left / 40% Right */}
      <section className="w-full p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN (60% on desktop): Live Browser Session Runner & DOM Inspector */}
          <div className="lg:col-span-7 flex flex-col gap-6 min-w-0">
            <BrowserPreview onInspectEvidence={() => setEvidenceModalOpen(true)} />
          </div>

          {/* RIGHT COLUMN (40% on desktop): Swarm Agent Trace & Real-Time Heuristics */}
          <div className="lg:col-span-5 flex flex-col gap-6 min-w-0">
            {/* Swarm Agent Collaboration Header */}
            <AgentStatusCard />

            {/* Pinned Critical Defect Alert Card */}
            <CriticalDefectCard onPinSuccess={() => showToast('Defect pinned to Vault #BUG-4402 with Playwright repro script.')} />

            {/* Real-Time Terminal Log / Activity Stream */}
            <div id="live-terminal-panel">
              <TerminalPanel />
            </div>
          </div>
        </div>
      </section>

      {/* Evidence Inspector Modal */}
      <EvidenceModal
        isOpen={evidenceModalOpen}
        onClose={() => setEvidenceModalOpen(false)}
      />

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-[#191B19] text-[#F1F1ED] border-2 border-[#1A1C1A] px-4 py-2.5 font-mono text-[12px] brutal-shadow-lg z-50 flex items-center gap-2 animate-in fade-in duration-100">
          <Icon name="download_done" className="w-4 h-4 text-[#B7EFD0]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
