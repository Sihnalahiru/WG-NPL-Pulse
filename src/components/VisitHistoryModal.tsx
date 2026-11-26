import { MapPin, Plus, X } from 'lucide-react';
import type { TrackedContract } from '../types/recovery';
import { formatCurrencyRs } from '../utils/recoveryEngine';
import { PaymentPatternStrip } from './PaymentPatternStrip';

interface VisitHistoryModalProps {
  contract: TrackedContract | null;
  onClose: () => void;
  onLogNewVisit: (contract: TrackedContract) => void;
}

export function VisitHistoryModal({
  contract,
  onClose,
  onLogNewVisit,
}: VisitHistoryModalProps) {
  if (!contract) return null;

  const reversedLogs = [...contract.visitHistory].reverse();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-modal-title"
    >
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h2
              id="history-modal-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Visit History Log · {contract.contractNo}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {contract.cusName} · Vehicle {contract.vehicleNo || '—'} · Closing Debtor{' '}
              {formatCurrencyRs(contract.closingDebtor)}
            </p>
            <PaymentPatternStrip
              mrp={contract.mrp}
              lastPaidAmount={contract.lastPaidAmount}
              lastPayDate={contract.lastPayDate}
              totalCollection={contract.totalCollection}
              showCategoryLine={true}
              compact={true}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onLogNewVisit(contract);
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Log Visit
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close history modal"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {reversedLogs.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                No previous visit entries logged
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Every new follow-up visit is archived here automatically so historical remarks are preserved.
              </p>
            </div>
          ) : (
            reversedLogs.map((entry, idx) => (
              <div
                key={entry.id}
                className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                    Visit #{reversedLogs.length - idx} · {entry.visitDate} · With{' '}
                    {entry.visitWith}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {entry.mrpActionCode && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold">
                        {entry.mrpActionCode}
                      </span>
                    )}
                    <span>
                      {entry.situation} · By {entry.remarkBy}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {entry.remark}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  <span>P/P Date: {entry.ppDate || '—'}</span>
                  <span>Hand Over: {entry.handOverDate || '—'}</span>
                  {entry.locationUrl && (
                    <a
                      href={entry.locationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      <MapPin className="w-3 h-3" />
                      View Location Pin
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
