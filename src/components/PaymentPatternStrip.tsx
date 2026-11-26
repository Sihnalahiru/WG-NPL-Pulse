import type { MrpEnrichment } from '../types/recovery';
import { formatCompactRs, formatCurrencyRs } from '../utils/recoveryEngine';

interface PaymentPatternStripProps {
  mrp?: MrpEnrichment;
  lastPaidAmount?: number;
  lastPayDate?: string;
  totalCollection?: number;
  showCategoryLine?: boolean;
  compact?: boolean;
}

export function PaymentPatternStrip({
  mrp,
  lastPaidAmount,
  lastPayDate,
  totalCollection,
  showCategoryLine = false,
  compact = false,
}: PaymentPatternStripProps) {
  const pattern = mrp?.paymentPattern;
  const hasPattern = Boolean(pattern && pattern.length > 0);
  const paidCount = hasPattern
    ? pattern!.filter((p) => p.status === 'PAID').length
    : 0;
  const npCount = hasPattern
    ? pattern!.filter((p) => p.status === 'NP').length
    : 0;

  return (
    <div className={compact ? 'mt-1.5 space-y-1' : 'mt-2 space-y-1'}>
      {showCategoryLine && (mrp?.nplCategory || mrp?.recoveryAttention) && (
        <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
          {mrp.nplCategory || 'MRP'}
          {mrp.recoveryAttention ? ` · ${mrp.recoveryAttention}` : ''}
        </div>
      )}

      {hasPattern ? (
        <div title="2026 Payment Pattern (Jan–Oct)">
          <div className="flex flex-wrap items-center gap-0.5">
            {pattern!.map((pm) => {
              const boxClass =
                pm.status === 'NP'
                  ? 'bg-red-500 text-white border-red-600'
                  : pm.status === 'PAID'
                    ? 'bg-emerald-500 text-white border-emerald-600'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700';
              const tip =
                pm.status === 'NP'
                  ? `${pm.month} (${pm.dateKey}): NP (Not Paid)`
                  : pm.status === 'PAID'
                    ? `${pm.month} (${pm.dateKey}): Paid ${formatCurrencyRs(pm.amount)}`
                    : `${pm.month} (${pm.dateKey}): —`;
              return (
                <span
                  key={pm.month}
                  title={tip}
                  className={`inline-flex items-center justify-center ${
                    compact ? 'w-4 h-4 text-[8px]' : 'w-[18px] h-[18px] text-[9px]'
                  } font-mono font-bold rounded-[3px] border leading-none select-none shadow-2xs ${boxClass}`}
                >
                  {pm.month[0]}
                </span>
              );
            })}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-slate-400 dark:text-slate-500 font-mono tabular-nums">
            <span>Jan-Oct Pattern</span>
            {(paidCount > 0 || npCount > 0) && (
              <span className="text-slate-500 dark:text-slate-400">
                ({paidCount}P / {npCount}NP)
              </span>
            )}
            {(lastPaidAmount !== undefined && lastPaidAmount > 0) || lastPayDate ? (
              <span className="text-slate-500 dark:text-slate-400">
                · Last: {formatCompactRs(lastPaidAmount || 0)}
                {lastPayDate ? ` (${lastPayDate})` : ''}
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums flex flex-wrap items-center gap-x-2">
          <span>
            Last Paid:{' '}
            <strong className="text-slate-700 dark:text-slate-300 font-semibold">
              {lastPaidAmount && lastPaidAmount > 0
                ? formatCurrencyRs(lastPaidAmount)
                : 'Rs. 0.00'}
            </strong>
            {lastPayDate ? ` (${lastPayDate})` : ''}
          </span>
          {totalCollection !== undefined && totalCollection > 0 && (
            <span>· Mo Coll: {formatCompactRs(totalCollection)}</span>
          )}
        </div>
      )}
    </div>
  );
}
