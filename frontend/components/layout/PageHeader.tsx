'use client';

import React from 'react';

interface PageHeaderProps {
  section?: string;
  title: string;
  description?: string;
  tag?: string;
  children?: React.ReactNode;
}

export default function PageHeader({
  section = 'Workspace',
  title,
  description,
  tag,
  children,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 font-mono text-[12px] text-[#404943] uppercase tracking-wider flex-wrap">
          <span>{section}</span>
          <span className="text-[#717973]">/</span>
          <span className="text-[#1A1C1A] font-semibold">{title}</span>
          {tag && (
            <span className="ml-1 text-[10px] font-mono px-1.5 py-0.5 bg-[#E8E8E5] border border-[#1A1C1A] rounded-md text-[#1A1C1A] uppercase font-bold">
              {tag}
            </span>
          )}
        </div>
        <h1 className="font-headline text-[28px] sm:text-[34px] text-[#1A1C1A] tracking-tight font-bold">
          {title}
        </h1>
        {description && (
          <p className="font-body text-[14px] sm:text-[15px] leading-relaxed text-[#404943] max-w-2xl">
            {description}
          </p>
        )}
      </div>

      {children && (
        <div className="flex flex-wrap items-center gap-2 self-start xl:self-end">
          {children}
        </div>
      )}
    </div>
  );
}
