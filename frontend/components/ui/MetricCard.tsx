'use client';

import React from 'react';
import { Icon } from './Icons';

interface MetricCardProps {
  label: string;
  value: string;
  icon: string | React.ReactNode;
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
    <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] rounded-xl p-4 sm:p-5 brutal-shadow hover:-translate-y-0.5 transition-transform duration-150 flex flex-col justify-between relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="flex flex-col pr-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#404943] font-bold">
            {label}
          </span>
          <span className="font-headline text-[30px] sm:text-[32px] text-[#1A1C1A] font-bold mt-1 leading-none tracking-tight">
            {value}
          </span>
        </div>
        <div className={`w-10 h-10 ${iconBg} border-2 border-[#1A1C1A] rounded-lg flex items-center justify-center brutal-shadow-xs flex-shrink-0`}>
          {typeof icon === 'string' ? (
            <Icon name={icon} className={`w-5 h-5 ${iconColor}`} />
          ) : (
            icon
          )}
        </div>
      </div>

      <div className="mt-4 pt-2.5 border-t-2 border-[#1A1C1A] flex items-center justify-between text-[#1A1C1A]">
        <div>{footerLeft}</div>
        {footerRight && <div>{footerRight}</div>}
      </div>
    </div>
  );
}
