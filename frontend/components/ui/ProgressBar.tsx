'use client';

import React from 'react';

interface ProgressBarProps {
  percentage: number;
  secondaryPercentage?: number;
  height?: string;
  flagged?: boolean;
}

export default function ProgressBar({
  percentage,
  secondaryPercentage = 0,
  height = 'h-2',
  flagged = false,
}: ProgressBarProps) {
  const primaryColor = flagged ? 'bg-[#AC3326]' : 'bg-[#285C45]';

  return (
    <div className={`w-full ${height} bg-[#E2E3DF] border border-[#1A1C1A] rounded-full overflow-hidden flex relative`}>
      <div
        className={`${primaryColor} h-full transition-all duration-300 rounded-full`}
        style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
      />
      {secondaryPercentage > 0 && (
        <div
          className="bg-[#FD6E5B] h-full transition-all duration-300 rounded-full"
          style={{ width: `${Math.min(100, Math.max(0, secondaryPercentage))}%` }}
        />
      )}
    </div>
  );
}
