'use client';

import React from 'react';

interface SeverityBadgeProps {
  severity: string;
  className?: string;
}

export default function SeverityBadge({ severity, className = '' }: SeverityBadgeProps) {
  const norm = severity.toUpperCase();

  if (norm.includes('CORAL') || norm.includes('P0')) {
    return (
      <span className={`bg-[#FD6E5B] text-white border border-[#1A1C1A] px-2 py-0.5 font-mono text-[11px] font-bold uppercase brutal-shadow-sm ${className}`}>
        SEVERITY: CORAL P0
      </span>
    );
  }

  if (norm.includes('SIGNAL') || norm.includes('P1')) {
    return (
      <span className={`bg-[#FFDF9B] text-[#4C3800] border border-[#1A1C1A] px-2 py-0.5 font-mono text-[11px] font-bold uppercase brutal-shadow-sm ${className}`}>
        SEVERITY: SIGNAL P1
      </span>
    );
  }

  if (norm.includes('P2')) {
    return (
      <span className={`bg-[#E2E3DF] text-[#1A1C1A] border border-[#1A1C1A] px-2 py-0.5 font-mono text-[11px] font-bold uppercase brutal-shadow-sm ${className}`}>
        SEVERITY: MEDIUM P2
      </span>
    );
  }

  return (
    <span className={`bg-[#F4F4F0] text-[#717973] border border-[#1A1C1A] px-2 py-0.5 font-mono text-[11px] font-bold uppercase brutal-shadow-sm ${className}`}>
      {severity}
    </span>
  );
}
