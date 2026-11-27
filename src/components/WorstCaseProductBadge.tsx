import React from 'react';

export interface WorstProductMeta {
  code: string;
  label: string;
  toneClass: string;
  iconBgClass: string;
}

export function getWorstProductMeta(productCode?: string): WorstProductMeta {
  const code = (productCode || '').trim().toUpperCase();

  if (code === 'TW' || code.includes('THREE') || code.includes('3W')) {
    return {
      code: code || 'TW',
      label: 'Three-Wheeler',
      toneClass:
        'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800',
      iconBgClass: 'bg-rose-600 text-white',
    };
  }
  if (code === 'MB' || code.includes('BIKE') || code.includes('CYCLE')) {
    return {
      code: code || 'MB',
      label: 'Motor Bike',
      toneClass:
        'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-200 dark:border-orange-800',
      iconBgClass: 'bg-orange-600 text-white',
    };
  }
  if (code === 'FB' || code.includes('FOUR') || code.includes('FLEET')) {
    return {
      code: code || 'FB',
      label: 'Vehicle Finance (FB)',
      toneClass:
        'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-200 dark:border-red-800',
      iconBgClass: 'bg-red-600 text-white',
    };
  }
  if (code === 'AU' || code.includes('AUTO') || code.includes('CAR')) {
    return {
      code: code || 'AU',
      label: 'Auto Loan',
      toneClass:
        'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-200 dark:border-indigo-800',
      iconBgClass: 'bg-indigo-600 text-white',
    };
  }
  if (code === 'PBM') {
    return {
      code: 'PBM',
      label: 'PB Micro / Gold',
      toneClass:
        'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800',
      iconBgClass: 'bg-amber-600 text-white',
    };
  }
  if (code === 'PB' || code.includes('PAWN') || code.includes('GOLD')) {
    return {
      code: code || 'PB',
      label: 'Personal / Gold (PB)',
      toneClass:
        'bg-yellow-50 text-amber-900 border-amber-300 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800',
      iconBgClass: 'bg-amber-700 text-white',
    };
  }
  if (code === 'BQ' || code.includes('QUICK') || code.includes('DRAFT')) {
    return {
      code: code || 'BQ',
      label: 'Business Quick (BQ)',
      toneClass:
        'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200 dark:bg-fuchsia-950/60 dark:text-fuchsia-200 dark:border-fuchsia-800',
      iconBgClass: 'bg-fuchsia-600 text-white',
    };
  }

  return {
    code: code || 'W',
    label: code ? `Product ${code}` : 'Worst Case (W)',
    toneClass:
      'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-200 dark:border-red-800',
    iconBgClass: 'bg-red-700 text-white',
  };
}

function ProductVectorIcon({ code, className = 'w-3.5 h-3.5' }: { code: string; className?: string }) {
  const c = code.trim().toUpperCase();

  // Three-Wheeler (TW)
  if (c === 'TW' || c.includes('THREE') || c.includes('3W')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path
          d="M5 15V9.5C5 7.57 6.57 6 8.5 6H14.5L18.2 10.5L19.5 13V15H5Z"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
        <path d="M10.5 6V11.5H17.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="8" cy="17" r="2.2" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.5" cy="17" r="2.2" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  // Motor Bike (MB)
  if (c === 'MB' || c.includes('BIKE') || c.includes('CYCLE')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <circle cx="6.2" cy="16.8" r="2.7" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.8" cy="16.8" r="2.7" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M6.2 16.8L10.5 11.2H14.8L17.8 16.8M14.8 11.2L16.2 7.5H18.5M9.2 11.2L7.5 9.5H5.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // Four-Wheel / Commercial Finance (FB)
  if (c === 'FB' || c.includes('FOUR') || c.includes('FLEET')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path
          d="M3.5 15.5V12L5.8 7.5H15.5L18.5 11H20.5V15.5H3.5Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <circle cx="7.5" cy="16.8" r="2" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="16.8" cy="16.8" r="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9.5 7.5V11H18" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }

  // Auto Loan / Sedan (AU)
  if (c === 'AU' || c.includes('AUTO') || c.includes('CAR')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path
          d="M4 14.5L6.2 9C6.6 8 7.5 7.3 8.6 7.3H15.4C16.5 7.3 17.4 8 17.8 9L20 14.5V17H4V14.5Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <circle cx="7.5" cy="17.2" r="1.8" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="16.5" cy="17.2" r="1.8" stroke="currentColor" strokeWidth="1.8" />
        <path d="M6.5 12H17.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  // PB Micro (PBM) — stacked coins / micro-loan badge
  if (c === 'PBM') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <ellipse cx="12" cy="7" rx="6.5" ry="2.6" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M5.5 7V12C5.5 13.4 8.4 14.6 12 14.6C15.6 14.6 18.5 13.4 18.5 12V7"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M5.5 12V16.8C5.5 18.2 8.4 19.4 12 19.4C15.6 19.4 18.5 18.2 18.5 16.8V12"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  // Personal / Gold Business (PB) — diamond / gold seal
  if (c === 'PB' || c.includes('PAWN') || c.includes('GOLD')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path
          d="M6.5 6H17.5L21 10.5L12 19.5L3 10.5L6.5 6Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M3 10.5H21M9 6L7.5 10.5L12 19.5M15 6L16.5 10.5L12 19.5" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }

  // Business Quick (BQ) — fast bolt / briefcase
  if (c === 'BQ' || c.includes('QUICK') || c.includes('DRAFT')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path
          d="M13 3L5.5 13.5H12L11 21L18.5 10.5H12L13 3Z"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // Default Worst Case shield-alert icon
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 3L4.5 6.2V11.8C4.5 16.4 7.7 20.1 12 21.5C16.3 20.1 19.5 16.4 19.5 11.8V6.2L12 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 8.5V13M12 16H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

interface WorstCaseProductBadgeProps {
  product?: string;
  nplReason?: string;
  compact?: boolean;
  showLabel?: boolean;
}

export function WorstCaseProductBadge({
  product,
  nplReason,
  compact = false,
  showLabel = false,
}: WorstCaseProductBadgeProps) {
  const meta = getWorstProductMeta(product);
  const reasonTag = (nplReason || 'W').trim().toUpperCase();

  return (
    <span
      title={`Worst Case (${reasonTag}) · ${meta.label}`}
      className={`inline-flex items-center gap-1.5 border rounded-md font-medium whitespace-nowrap ${meta.toneClass} ${
        compact ? 'pr-1.5 pl-0.5 py-0.5 text-[10px]' : 'pr-2 pl-1 py-0.5 text-[11px]'
      }`}
    >
      <span
        className={`inline-flex items-center justify-center rounded ${meta.iconBgClass} ${
          compact ? 'w-4 h-4' : 'w-5 h-5'
        }`}
      >
        <ProductVectorIcon code={meta.code} className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      </span>
      <span className="font-mono font-bold tracking-tight">
        W·{meta.code}
      </span>
      {showLabel && (
        <span className="text-[10px] opacity-80 font-sans hidden sm:inline">
          {meta.label}
        </span>
      )}
    </span>
  );
}
