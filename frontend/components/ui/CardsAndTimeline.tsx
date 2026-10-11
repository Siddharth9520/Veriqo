'use client';

import React from 'react';
import SeverityBadge from './SeverityBadge';
import { BugReport } from '@/lib/types';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  badge?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function ChartCard({ title, subtitle, badge, children, footer }: ChartCardProps) {
  return (
    <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] brutal-shadow-lg p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between pb-2 border-b-2 border-[#1A1C1A]">
        <div className="flex flex-col">
          {subtitle && (
            <span className="font-mono text-[11px] uppercase font-bold text-[#717973]">
              {subtitle}
            </span>
          )}
          <h2 className="font-headline text-[18px] font-bold text-[#1A1C1A]">{title}</h2>
        </div>
        {badge && (
          <span className="font-mono text-[11px] font-bold bg-[#E2E3DF] px-2 py-0.5 border border-[#1A1C1A]">
            {badge}
          </span>
        )}
      </div>

      <div className="w-full">{children}</div>

      {footer && <div className="pt-2 border-t border-[#E2E3DF]">{footer}</div>}
    </div>
  );
}

export function BugSummaryCard({ bug, onClick }: { bug: BugReport; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-[#FFFFFF] border-2 border-[#1A1C1A] p-4 brutal-shadow cursor-pointer hover:-translate-y-0.5 transition-transform"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="font-mono text-[11px] font-bold text-[#AC3326]">{bug.id}</span>
          <span className="font-headline font-bold text-[15px] text-[#1A1C1A] mt-0.5">
            {bug.title}
          </span>
        </div>
        <SeverityBadge severity={bug.severity} />
      </div>
      <div className="mt-2 text-[#404943] font-body text-[12px] line-clamp-2">
        {bug.actualBehavior}
      </div>
    </div>
  );
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  type: 'pass' | 'fail' | 'warn' | 'info';
}

export function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
  return (
    <div className="flex flex-col gap-3 font-mono text-[12px]">
      {events.map((evt) => {
        let dotColor = 'bg-[#285C45]';
        if (evt.type === 'fail') dotColor = 'bg-[#AC3326]';
        if (evt.type === 'warn') dotColor = 'bg-[#EBC162]';

        return (
          <div key={evt.id} className="flex items-start gap-3">
            <span className="text-[#717973] shrink-0 text-[11px]">[{evt.timestamp}]</span>
            <div className={`w-2.5 h-2.5 rounded-full ${dotColor} border border-[#1A1C1A] shrink-0 mt-1`} />
            <div className="flex flex-col">
              <span className="font-bold text-[#1A1C1A]">{evt.title}</span>
              <span className="text-[#404943] text-[11px] font-body">{evt.description}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
