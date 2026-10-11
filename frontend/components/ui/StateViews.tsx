'use client';

import React from 'react';
import { Icon } from '@/components/ui/Icons';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  icon = 'folder_open',
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="bg-[#FFFFFF] border-2 border-dashed border-[#1A1C1A] p-10 flex flex-col items-center text-center gap-3 brutal-shadow">
      <div className="w-12 h-12 bg-[#F4F4F0] border-2 border-[#1A1C1A] flex items-center justify-center">
        <Icon name={icon} className="w-7 h-7 text-[#717973]" />
      </div>
      <h3 className="font-headline font-bold text-[18px] text-[#1A1C1A]">{title}</h3>
      <p className="font-body text-[13px] text-[#404943] max-w-sm">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-2 bg-[#285C45] text-white px-4 py-2 border-2 border-[#1A1C1A] font-headline text-[12px] uppercase font-bold brutal-shadow-sm brutal-btn"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export function LoadingState({ message = 'Orchestrating autonomous crawler nodes...' }: { message?: string }) {
  return (
    <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] p-10 flex flex-col items-center justify-center gap-3 brutal-shadow">
      <div className="w-8 h-8 border-3 border-[#285C45] border-t-transparent rounded-full animate-spin"></div>
      <span className="font-mono text-[12px] text-[#404943] font-bold uppercase">{message}</span>
    </div>
  );
}

export function ErrorState({
  message = 'An unexpected execution flaw occurred.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="bg-[#FFDAD6] border-2 border-[#AC3326] p-6 flex flex-col items-center text-center gap-2 brutal-shadow">
      <Icon name="error" className="w-8 h-8 text-[#AC3326]" />
      <h3 className="font-headline font-bold text-[16px] text-[#AC3326]">Cluster Error</h3>
      <p className="font-mono text-[12px] text-[#404943]">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 bg-[#AC3326] text-white px-4 py-1.5 border border-[#1A1C1A] font-mono text-[11px] uppercase font-bold brutal-shadow-sm"
        >
          Retry Execution
        </button>
      )}
    </div>
  );
}
