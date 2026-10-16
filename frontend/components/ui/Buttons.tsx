'use client';

import React from 'react';
import { Icon } from '@/components/ui/Icons';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'danger';
}

export function PrimaryButton({ children, icon, className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`bg-[#285C45] text-white border-2 border-[#1A1C1A] rounded-lg px-4 py-2 font-headline text-[13px] uppercase font-bold brutal-shadow hover:bg-[#0B442F] brutal-btn flex items-center justify-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A1C1A] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {icon && <Icon name={icon} className="w-4 h-4 flex-shrink-0" />}
      <span>{children}</span>
    </button>
  );
}

export function SecondaryButton({ children, icon, className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`bg-[#FFFFFF] text-[#1A1C1A] border-2 border-[#1A1C1A] rounded-lg px-4 py-2 font-headline text-[13px] uppercase font-bold brutal-shadow hover:bg-[#E8E8E5] brutal-btn flex items-center justify-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A1C1A] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {icon && <Icon name={icon} className="w-4 h-4 flex-shrink-0" />}
      <span>{children}</span>
    </button>
  );
}
