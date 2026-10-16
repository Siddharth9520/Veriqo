import React from 'react';
import { Icon } from '@/components/ui/Icons';

interface SearchInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  shortcut?: string;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  shortcut = '/',
  className = '',
}: SearchInputProps) {
  return (
    <div className={`flex items-center bg-[#FFFFFF] border-2 border-[#1A1C1A] rounded-lg px-3 py-1.5 brutal-shadow-xs focus-within:shadow-[3px_3px_0px_#285c45] transition-shadow ${className}`}>
      <Icon name="search" className="w-5 h-5 text-[#404943] mr-2 flex-shrink-0" />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-transparent font-mono text-[12px] text-[#1A1C1A] placeholder:text-[#717973] focus:outline-none"
      />
      {shortcut && (
        <span className="font-mono text-[10px] bg-[#E2E3DF] border border-[#1A1C1A] rounded px-1.5 py-0.5 text-[#1A1C1A] hidden sm:inline-block">
          {shortcut}
        </span>
      )}
    </div>
  );
}

interface FilterBarProps {
  children: React.ReactNode;
  className?: string;
}

export function FilterBar({ children, className = '' }: FilterBarProps) {
  return (
    <div className={`bg-[#F4F4F0] border-2 border-[#1A1C1A] rounded-xl p-3 sm:p-3.5 brutal-shadow flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between ${className}`}>
      {children}
    </div>
  );
}

interface FormFieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}

export function FormField({ label, error, hint, required, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-mono text-[11px] font-bold uppercase text-[#404943] flex items-center justify-between">
        <span>
          {label} {required && <span className="text-[#AC3326]">*</span>}
        </span>
      </label>
      {children}
      {hint && !error && <span className="font-mono text-[10px] text-[#717973]">{hint}</span>}
      {error && <span className="font-mono text-[10px] text-[#AC3326] font-bold">{error}</span>}
    </div>
  );
}
