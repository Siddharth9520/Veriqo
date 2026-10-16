'use client';

import React, { useState } from 'react';
import { primaryCriticalDefect } from '@/lib/mock-data';
import { Icon } from '@/components/ui/Icons';

interface EvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EvidenceModal({ isOpen, onClose }: EvidenceModalProps) {
  const [downloadToast, setDownloadToast] = useState(false);

  if (!isOpen) return null;

  const handleExport = () => {
    setDownloadToast(true);
    setTimeout(() => setDownloadToast(false), 3000);
  };

  const defect = primaryCriticalDefect;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#191B19]/70 backdrop-blur-xs">
      <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] rounded-2xl brutal-shadow-lg max-w-2xl w-full p-6 flex flex-col gap-4 relative animate-in fade-in zoom-in-95 duration-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b-2 border-[#1A1C1A]">
          <div className="flex items-center gap-2">
            <Icon name="troubleshoot" className="w-6 h-6 text-[#AC3326]" />
            <span className="font-headline text-[18px] sm:text-[20px] uppercase font-bold text-[#1A1C1A]">
              Defect Evidence Dossier // {defect.id}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[#717973] hover:text-[#1A1C1A] p-1 border border-transparent hover:border-[#1A1C1A] rounded-md transition-colors"
          >
            <Icon name="close" className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex flex-col gap-3 font-mono text-[12px]">
          {/* Concurrency Block */}
          <div className="bg-[#F4F4F0] border border-[#1A1C1A] rounded-xl p-3 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#1A1C1A] uppercase">Request Concurrency Discrepancy</span>
              <span className="bg-[#FFDAD5] text-[#AC3326] px-1.5 py-0.5 border border-[#1A1C1A] rounded-md text-[10px] font-bold">
                RACE DETECTED (Δ 12ms)
              </span>
            </div>
            <p className="text-[#404943] font-semibold">{defect.evidence.endpoint}</p>

            <div className="bg-[#191B19] text-[#F1F1ED] p-3 mt-1 border border-[#717973] rounded-lg font-mono text-[11px] leading-relaxed">
              <div className="text-[#9CD2B5] font-bold mb-1">{"// Parallel Network Dispatches:"}</div>
              <div className="text-[#FAF9F6]">{defect.evidence.req1}</div>
              <div className="text-[#FD6E5B]">{defect.evidence.req2}</div>
            </div>
          </div>

          {/* Metadata telemetry */}
          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
            <div className="bg-[#F4F4F0] border border-[#C0C9C1] rounded-lg p-2.5 flex justify-between">
              <span className="text-[#717973]">Associated Network Trace:</span>
              <span className="font-bold text-[#0B442F]">{defect.evidence.harFile} ({defect.evidence.harSize})</span>
            </div>
            <div className="bg-[#F4F4F0] border border-[#C0C9C1] rounded-lg p-2.5 flex justify-between">
              <span className="text-[#717973]">Parsed DOM Tree:</span>
              <span className="font-bold text-[#1A1C1A]">{defect.evidence.domNodesParsed} Nodes</span>
            </div>
          </div>

          {/* Step-by-Step Repro */}
          <div className="bg-[#FAF9F6] border border-[#1A1C1A] rounded-xl p-3 flex flex-col gap-1">
            <span className="font-bold uppercase text-[11px] text-[#1A1C1A]">Autonomous Repro Steps:</span>
            <ol className="list-decimal list-inside text-[#404943] space-y-0.5 text-[11px]">
              {defect.reproductionSteps.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-[#E2E3DF]">
          <span className="font-mono text-[11px] text-[#717973]">
            Target Element: <strong className="text-[#AC3326]">{defect.targetElement}</strong>
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="bg-[#E8E8E5] text-[#1A1C1A] border-2 border-[#1A1C1A] rounded-lg px-3 py-1.5 font-headline text-[12px] uppercase font-bold brutal-shadow-xs hover:bg-[#EEEEEA] brutal-btn"
            >
              Export Artifacts
            </button>
            <button
              onClick={onClose}
              className="bg-[#285C45] text-white border-2 border-[#1A1C1A] rounded-lg px-4 py-1.5 font-headline text-[12px] uppercase font-bold brutal-shadow-xs hover:bg-[#0B442F] brutal-btn"
            >
              Acknowledge &amp; Close
            </button>
          </div>
        </div>

        {/* Toast */}
        {downloadToast && (
          <div className="absolute -bottom-12 right-0 bg-[#191B19] text-[#F1F1ED] px-4 py-2 font-mono text-[11px] border-2 border-[#1A1C1A] rounded-lg brutal-shadow flex items-center gap-2 z-50">
            <Icon name="download_done" className="w-4 h-4 text-[#B7EFD0]" />
            <span>Snapshot exported: har_dump_9482.har (1,418 KB) &amp; playwright_repro.ts</span>
          </div>
        )}
      </div>
    </div>
  );
}
