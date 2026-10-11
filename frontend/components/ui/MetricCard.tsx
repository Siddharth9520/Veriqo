'use client';

import React from 'react';

interface MetricCardProps {
  label: string;
  value: string;
  icon: string;
  iconBg?: string;
  iconColor?: string;
  footerLeft: React.ReactNode;
  footerRight?: React.ReactNode;
}

export default function MetricCard({
  label,
  value,
  icon,
  iconBg = 'bg-[#B7EFD0]',
  iconColor = 'text-[#002114]',
  footerLeft,
  footerRight,
}: MetricCardProps) {
  return (
    <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] p-4 brutal-shadow-lg flex flex-col justify-between relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#404943] font-bold">
            {label}
          </span>
          <span className="font-headline text-[30px] sm:text-[32px] text-[#1A1C1A] font-bold mt-1 leading-none">
            {value}
          </span>
        </div>
        <div className={`w-10 h-10 ${iconBg} border-2 border-[#1A1C1A] flex items-center justify-center brutal-shadow-sm`}>
          <span className={`material-symbols-outlined ${iconColor} text-[22px]`}>
            {icon}
          </span>
        </div>
      </div>

      <div className="mt-4 pt-2 border-t-2 border-[#1A1C1A] flex items-center justify-between text-[#1A1C1A]">
        <div>{footerLeft}</div>
        {footerRight && <div>{footerRight}</div>}
      </div>
    </div>
  );
}
