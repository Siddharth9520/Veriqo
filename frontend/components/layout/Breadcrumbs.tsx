'use client';

import React from 'react';
import Link from 'next/link';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 font-mono text-[12px] uppercase text-[#404943]">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={index}>
            {index > 0 && <span className="text-[#717973]">/</span>}
            {item.href && !isLast ? (
              <Link href={item.href} className="hover:text-[#1A1C1A] transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-[#1A1C1A] font-bold' : ''}>{item.label}</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
