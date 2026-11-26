import { useMemo, useState } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Flame,
  ShieldAlert,
  Users,
} from 'lucide-react';
import type { AersRecord, TrackedContract } from '../types/recovery';
import {
  computeOfficeTypeBreakdown,
  formatCompactRs,
  formatCurrencyRs,
  normalizeContractNo,
  normalizeEvaluableFromAers,
  normalizeEvaluableFromTracked,
} from '../utils/recoveryEngine';

interface OfficeTypeBreakdownPanelProps {
  trackedContracts: TrackedContract[];
  aersRecords: AersRecord[];
  defaultScope?: 'aers' | 'tracked';
  title?: string;
}

export function OfficeTypeBreakdownPanel({
  trackedContracts,
  aersRecords,
  defaultScope,
  title = 'Office Type -> RO Strategy Breakdown (NPL & Borderline)',
}: OfficeTypeBreakdownPanelProps) {
  const resolvedDefaultScope: 'aers' | 'tracked' =
    defaultScope ?? (aersRecords.length > 0 ? 'aers' : 'tracked');
  const [scope, setScope] = useState<'aers' | 'tracked'>(resolvedDefaultScope);
  const [focusMode, setFocusMode] = useState<'all' | 'npl' | 'borderline' | 'worst'>('all');
  const [expandedOffices, setExpandedOffices] = useState<Record<string, boolean>>({});

  const effectiveScope: 'aers' | 'tracked' =
    scope === 'aers' && aersRecords.length === 0 ? 'tracked' : scope;

  const trackedNos = useMemo(
    () => new Set(trackedContracts.map((c) => normalizeContractNo(c.contractNo))),
    [trackedContracts],
  );

  const evaluableItems = useMemo(() => {
    if (effectiveScope === 'aers' && aersRecords.length > 0) {
      return normalizeEvaluableFromAers(aersRecords, trackedNos);
    }
    return normalizeEvaluableFromTracked(trackedContracts);
  }, [effectiveScope, aersRecords, trackedNos, trackedContracts]);

  const officeSummaries = useMemo(
    () => computeOfficeTypeBreakdown(evaluableItems),
    [evaluableItems],
  );

  const visibleOffices = useMemo(() => {
    return officeSummaries.filter((o) => {
      if (focusMode === 'npl') return o.activeNplCount > 0 || o.closingNpl > 0;
      if (focusMode === 'borderline') return o.borderlineCount > 0;
      if (focusMode === 'worst') return o.worstCount > 0;
      return true;
    });
  }, [officeSummaries, focusMode]);

  const totals = useMemo(() => {
    return visibleOffices.reduce(
      (acc, o) => ({
        totalCount: acc.totalCount + o.totalCount,
        activeNplCount: acc.activeNplCount + o.activeNplCount,
        opNpl: acc.opNpl + o.opNpl,
        closingNpl: acc.closingNpl + o.closingNpl,
        closingDebtor: acc.closingDebtor + o.closingDebtor,
        borderlineCount: acc.borderlineCount + o.borderlineCount,
        borderlineMinToSave: acc.borderlineMinToSave + o.borderlineMinToSave,
        borderlineEfforts: acc.borderlineEfforts + o.borderlineEfforts,
        zeroEffortBorderlineCount:
          acc.zeroEffortBorderlineCount + o.zeroEffortBorderlineCount,
        worstCount: acc.worstCount + o.worstCount,
      }),
      {
        totalCount: 0,
        activeNplCount: 0,
        opNpl: 0,
        closingNpl: 0,
        closingDebtor: 0,
        borderlineCount: 0,
        borderlineMinToSave: 0,
        borderlineEfforts: 0,
        zeroEffortBorderlineCount: 0,
        worstCount: 0,
      },
    );
  }, [visibleOffices]);

  const toggleOffice = (officeType: string) => {
    setExpandedOffices((prev) => ({
      ...prev,
      [officeType]: !(prev[officeType] ?? true),
    }));
  };

  return (
    <section
      aria-label="Office Type and RO Hierarchy Breakdown"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
    >
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Primary grouping by <strong className="font-medium text-slate-700 dark:text-slate-300">Office Type</strong> with nested <strong className="font-medium text-slate-700 dark:text-slate-300">RO Name</strong> breakdown across Active NPL, Borderline (61–90 DPD), Assign Officer Efforts, and WORST (W).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg">
            {(['all', 'npl', 'borderline', 'worst'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFocusMode(mode)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
                  focusMode === mode
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {mode === 'all'
                  ? 'All Categories'
                  : mode === 'npl'
                    ? 'NPL Only'
                    : mode === 'borderline'
                      ? 'Borderline 61-90'
                      : 'WORST (W)'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg">
            <button
              type="button"
              onClick={() => setScope('aers')}
              disabled={aersRecords.length === 0}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap disabled:opacity-40 ${
                effectiveScope === 'aers'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Full AERS ({aersRecords.length})
            </button>
            <button
              type="button"
              onClick={() => setScope('tracked')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
                effectiveScope === 'tracked'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Watchlist ({trackedContracts.length})
            </button>
          </div>
        </div>
      </div>

      {visibleOffices.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
          No Office Type records yet. Upload or paste your daily AERS report to populate the Office Type → RO hierarchy automatically.
        </div>
      ) : (
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {visibleOffices.map((office) => {
            const isOpen = expandedOffices[office.officeType] ?? true;
            const visibleOfficers = office.officers.filter((ro) => {
              if (focusMode === 'npl') return ro.activeNplCount > 0 || ro.closingNpl > 0;
              if (focusMode === 'borderline') return ro.borderlineCount > 0;
              if (focusMode === 'worst') return ro.worstCount > 0;
              return true;
            });

            return (
              <div key={office.officeType}>
                <button
                  type="button"
                  onClick={() => toggleOffice(office.officeType)}
                  className="w-full px-4 sm:px-5 py-3.5 bg-slate-50/70 dark:bg-slate-950/50 hover:bg-slate-100/70 dark:hover:bg-slate-800/40 transition-colors flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {office.officeType}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                          {office.officers.length} ROs · {office.totalCount} accts
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums pl-6 lg:pl-0">
                    <span className="text-red-600 dark:text-red-400 font-mono font-semibold">
                      NPL: {office.activeNplCount} ({formatCompactRs(office.closingNpl)})
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 font-mono">
                      Op Npl: {formatCompactRs(office.opNpl)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-mono font-medium">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                      Borderline: {office.borderlineCount} ({formatCompactRs(office.borderlineMinToSave)})
                    </span>
                    <span className="text-slate-700 dark:text-slate-300 font-mono">
                      Efforts: {office.borderlineEfforts}
                      {office.zeroEffortBorderlineCount > 0 && (
                        <span className="text-red-600 dark:text-red-400 ml-1">
                          ({office.zeroEffortBorderlineCount} zero)
                        </span>
                      )}
                    </span>
                    {office.worstCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400 font-mono font-semibold">
                        <Flame className="w-3.5 h-3.5 shrink-0" />
                        W: {office.worstCount}
                      </span>
                    )}
                  </div>
                </button>

                {isOpen && visibleOfficers.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-t border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          <th className="py-2 pl-10 pr-3">RO Name</th>
                          <th className="py-2 px-3 text-right">Accts</th>
                          <th className="py-2 px-3 text-right">Active NPL</th>
                          <th className="py-2 px-3 text-right">Op Npl</th>
                          <th className="py-2 px-3 text-right">Closing NPL</th>
                          <th className="py-2 px-3 text-right">Closing Debtor</th>
                          <th className="py-2 px-3 text-right">Borderline (61-90)</th>
                          <th className="py-2 px-3 text-right">Min to Save</th>
                          <th className="py-2 px-3 text-right">RO Efforts (0-Eff)</th>
                          <th className="py-2 px-4 text-right">WORST (W)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 tabular-nums">
                        {visibleOfficers.map((ro) => (
                          <tr
                            key={`${office.officeType}_${ro.officer}`}
                            className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                          >
                            <td className="py-2 pl-10 pr-3 font-medium text-slate-900 dark:text-slate-100">
                              <span className="inline-flex items-center gap-1.5">
                                <Users className="w-3 h-3 text-slate-400 shrink-0" />
                                {ro.officer}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-300">
                              {ro.totalCount}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-semibold text-red-600 dark:text-red-400">
                              {ro.activeNplCount}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-300">
                              {formatCurrencyRs(ro.opNpl)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-semibold text-red-600 dark:text-red-400">
                              {formatCurrencyRs(ro.closingNpl)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-900 dark:text-slate-100">
                              {formatCurrencyRs(ro.closingDebtor)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-medium text-amber-700 dark:text-amber-400">
                              {ro.borderlineCount}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-blue-700 dark:text-blue-400">
                              {formatCurrencyRs(ro.borderlineMinToSave)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              <span className="text-slate-900 dark:text-slate-100 font-medium">
                                {ro.borderlineEfforts}
                              </span>
                              {ro.zeroEffortBorderlineCount > 0 && (
                                <span className="ml-1 text-[10px] text-red-600 dark:text-red-400 font-semibold">
                                  ({ro.zeroEffortBorderlineCount} zero)
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-4 text-right font-mono">
                              {ro.worstCount > 0 ? (
                                <span className="text-red-600 dark:text-red-400 font-semibold">
                                  {ro.worstCount} ({formatCompactRs(ro.worstNpl)})
                                </span>
                              ) : (
                                <span className="text-slate-400">0</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}

          {/* Overall Totals Footer Strip */}
          <div className="px-4 sm:px-5 py-3 bg-slate-100/70 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold tabular-nums">
            <span className="text-slate-900 dark:text-slate-100">
              All Visible Office Types ({visibleOffices.length}) · {totals.totalCount} Contracts
            </span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono">
              <span className="text-red-600 dark:text-red-400">
                Active NPL: {totals.activeNplCount} ({formatCompactRs(totals.closingNpl)})
              </span>
              <span className="text-slate-600 dark:text-slate-300">
                Op Npl: {formatCompactRs(totals.opNpl)}
              </span>
              <span className="text-amber-700 dark:text-amber-400">
                Borderline: {totals.borderlineCount} (Save {formatCompactRs(totals.borderlineMinToSave)})
              </span>
              <span className="text-slate-800 dark:text-slate-200">
                Efforts: {totals.borderlineEfforts} ({totals.zeroEffortBorderlineCount} zero)
              </span>
              <span className="text-red-700 dark:text-red-400">
                WORST (W): {totals.worstCount}
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
