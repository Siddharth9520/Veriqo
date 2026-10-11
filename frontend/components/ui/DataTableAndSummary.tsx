'use client';

import React from 'react';
import { TestRun } from '@/lib/types';
import StatusBadge from './StatusBadge';
import ProgressBar from './ProgressBar';

interface Column<T> {
  header: string;
  accessor: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = 'No records found.',
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] p-8 text-center font-mono text-[12px] text-[#717973] brutal-shadow">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] brutal-shadow overflow-x-auto">
      <table className="w-full text-left font-mono text-[12px]">
        <thead>
          <tr className="border-b-2 border-[#1A1C1A] bg-[#F4F4F0] text-[#1A1C1A] uppercase font-bold text-[11px]">
            {columns.map((col, idx) => (
              <th key={idx} className={`py-2.5 px-3 ${col.className || ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E2E3DF]">
          {data.map((item) => (
            <tr
              key={keyExtractor(item)}
              onClick={() => onRowClick && onRowClick(item)}
              className={`hover:bg-[#FAF9F6] transition-colors ${
                onRowClick ? 'cursor-pointer' : ''
              }`}
            >
              {columns.map((col, idx) => (
                <td key={idx} className={`py-3 px-3 ${col.className || ''}`}>
                  {col.accessor(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TestRunSummary({ run }: { run: TestRun }) {
  const passPct = (run.passedAssertions / (run.totalAssertions || 1)) * 100;
  const failPct = (run.failedAssertions / (run.totalAssertions || 1)) * 100;

  return (
    <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] p-4 brutal-shadow flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <span className="font-mono text-[11px] font-bold text-[#0B442F]">{run.runNumber}</span>
          <span className="font-headline font-bold text-[15px] text-[#1A1C1A]">{run.title}</span>
          <span className="font-mono text-[11px] text-[#717973]">{run.projectName} · {run.environment}</span>
        </div>
        <StatusBadge status={run.status} />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between font-mono text-[11px]">
          <span>Assertions: {run.passedAssertions} passed / {run.failedAssertions} failed</span>
          <span className="font-bold">{passPct.toFixed(1)}%</span>
        </div>
        <ProgressBar percentage={passPct} secondaryPercentage={failPct} height="h-2.5" />
      </div>
    </div>
  );
}
