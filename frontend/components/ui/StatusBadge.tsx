'use client';

import React from 'react';
import { ProjectHealth, RunStatus } from '@/lib/types';

interface StatusBadgeProps {
  status: ProjectHealth | RunStatus | string;
  label?: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, label, size = 'sm' }: StatusBadgeProps) {
  const norm = status.toLowerCase();

  const isSmall = size === 'sm';
  const padding = isSmall ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[12px]';

  if (norm === 'healthy' || norm === 'completed') {
    return (
      <div className={`bg-[#B7EFD0] text-[#002114] border-2 border-[#1A1C1A] brutal-shadow-sm font-mono font-bold uppercase tracking-wider flex items-center gap-1 ${padding}`}>
        <span className="material-symbols-outlined text-[14px] text-[#0B442F]">check_circle</span>
        <span>{label || 'Healthy'}</span>
      </div>
    );
  }

  if (norm === 'critical_regression' || norm === 'failed') {
    return (
      <div className={`bg-[#AC3326] text-[#FFFFFF] border-2 border-[#1A1C1A] brutal-shadow-sm font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 ${padding}`}>
        <span className="w-2 h-2 rounded-full bg-white inline-block"></span>
        <span>{label || 'Critical Regression'}</span>
      </div>
    );
  }

  if (norm === 'scanning' || norm === 'running') {
    return (
      <div className={`bg-[#FFDF9B] text-[#251A00] border-2 border-[#1A1C1A] brutal-shadow-sm font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 ${padding}`}>
        <span className="w-2 h-2 rounded-full bg-[#694E00] animate-ping inline-block"></span>
        <span>{label || (norm === 'running' ? 'STATUS: RUNNING' : 'Scanning in Progress')}</span>
      </div>
    );
  }

  if (norm === 'paused') {
    return (
      <div className={`bg-[#FFDF9B] text-[#4C3800] border-2 border-[#1A1C1A] brutal-shadow-sm font-mono font-bold uppercase tracking-wider flex items-center gap-1 ${padding}`}>
        <span className="material-symbols-outlined text-[14px]">pause</span>
        <span>{label || 'PAUSED'}</span>
      </div>
    );
  }

  // Fallback
  return (
    <div className={`bg-[#EEEEEA] text-[#1A1C1A] border-2 border-[#1A1C1A] brutal-shadow-sm font-mono font-bold uppercase tracking-wider flex items-center gap-1 ${padding}`}>
      <span className="w-2 h-2 rounded-full bg-[#717973] inline-block"></span>
      <span>{label || status}</span>
    </div>
  );
}
