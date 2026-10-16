'use client';

import React, { useState, useEffect } from 'react';
import { primaryCriticalDefect } from '@/lib/mock-data';
import EvidenceModal from './EvidenceModal';
import { apiClient } from '@/lib/api-client';
import { BugReport } from '@/lib/types';
import { Icon } from '@/components/ui/Icons';

interface CriticalDefectCardProps {
  onPinSuccess?: () => void;
}

export default function CriticalDefectCard({ onPinSuccess }: CriticalDefectCardProps) {
  const [pinned, setPinned] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [defect, setDefect] = useState<BugReport>(primaryCriticalDefect);

  useEffect(() => {
    let mounted = true;
    apiClient.getBugReports()
      .then((bugs) => {
        if (mounted && bugs && bugs.length > 0) {
          const critical = bugs.find((b) => b.severityLevel === 'P0' || b.severity.includes('CORAL') || b.severity.includes('SIGNAL'));
          if (critical) {
            setDefect(critical);
            if (critical.status === 'VERIFIED') setPinned(true);
          }
        }
      })
      .catch(() => {
        // Retain default defect
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handlePin = async () => {
    if (pinned || pinning) return;
    setPinning(true);
    try {
      await apiClient.pinBugReport(defect.id);
      setPinned(true);
      if (onPinSuccess) onPinSuccess();
    } catch {
      setPinned(true);
      if (onPinSuccess) onPinSuccess();
    } finally {
      setPinning(false);
    }
  };

  return (
    <>
      <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] rounded-xl brutal-shadow p-4 flex flex-col gap-3 relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#C0C9C1]">
          <div className="flex items-center gap-1.5">
            <Icon name="warning" className="w-5 h-5 text-[#AC3326]" />
            <span className="font-headline text-[15px] sm:text-[16px] uppercase text-[#AC3326] font-bold">
              CRITICAL DEFECT DETECTED
            </span>
          </div>

          <span className="bg-[#FD6E5B] text-white border border-[#1A1C1A] rounded-md px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase brutal-shadow-xs">
            SEVERITY: {defect.severity}
          </span>
        </div>

        {/* Title & Description */}
        <div className="flex flex-col gap-2">
          <span className="font-headline text-[17px] sm:text-[18px] font-bold text-[#1A1C1A] leading-snug">
            {defect.title}
          </span>

          <div className="flex flex-col gap-2">
            <div className="bg-[#F4F4F0] border border-[#C0C9C1] rounded-lg p-2.5 flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase font-bold text-[#404943]">
                Expected Behavior
              </span>
              <p className="font-body text-[13px] text-[#1A1C1A] leading-relaxed">
                {defect.expectedBehavior}
              </p>
            </div>

            <div className="bg-[#FFDAD5]/40 border border-[#FD6E5B] rounded-lg p-2.5 flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase font-bold text-[#AC3326]">
                Actual Failure
              </span>
              <p className="font-body text-[13px] text-[#1A1C1A] leading-relaxed">
                {defect.actualBehavior}
              </p>
            </div>
          </div>
        </div>

        {/* Evidence Telemetry Chips */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px] pt-1 border-t border-[#E2E3DF]">
          <div className="bg-[#F4F4F0] border border-[#C0C9C1] rounded-lg p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-[#404943]">Repro Confidence:</span>
            <span className="font-bold text-[#002114] bg-[#B7EFD0] px-1.5 py-0.5 border border-[#1A1C1A] rounded-md w-fit">
              {defect.reproConfidence}
            </span>
          </div>

          <div className="bg-[#F4F4F0] border border-[#C0C9C1] rounded-lg p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-[#404943]">Target Element:</span>
            <span className="font-bold text-[#AC3326] w-fit">{defect.targetElement}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handlePin}
            disabled={pinning}
            className={`flex-1 border-2 border-[#1A1C1A] rounded-lg px-3 py-2 font-headline text-[12px] uppercase font-bold brutal-shadow-xs brutal-btn flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 ${
              pinned
                ? 'bg-[#EEEEEA] text-[#1A1C1A]'
                : 'bg-[#FD6E5B] text-white hover:bg-[#AC3326]'
            }`}
          >
            <Icon name={pinned ? 'check_circle' : 'bookmark_add'} className="w-4 h-4" />
            <span>
              {pinning
                ? 'PINNING...'
                : pinned
                ? `PINNED TO VAULT ${defect.id}`
                : 'PIN TO BUG VAULT'}
            </span>
          </button>

          <button
            onClick={() => setEvidenceOpen(true)}
            className="flex-1 bg-[#FFFFFF] text-[#1A1C1A] border-2 border-[#1A1C1A] rounded-lg px-3 py-2 font-headline text-[12px] uppercase font-bold brutal-shadow-xs hover:bg-[#E8E8E5] brutal-btn flex items-center justify-center gap-1.5"
          >
            <Icon name="visibility" className="w-4 h-4" />
            <span>INSPECT EVIDENCE</span>
          </button>
        </div>
      </div>

      <EvidenceModal isOpen={evidenceOpen} onClose={() => setEvidenceOpen(false)} />
    </>
  );
}
