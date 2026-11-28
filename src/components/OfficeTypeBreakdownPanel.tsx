import { useMemo, useState } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Flame,
  ShieldAlert,
} from 'lucide-react';
import type { AersMetadata, AersRecord } from '../types/recovery';
import {
  computeOfficeTypeBreakdown,
  formatCompactRs,
  formatCurrencyRs,
  getBranchPortfolioTotals,
  getNormalizedOfficerRole,
  normalizeEvaluableFromAers,
} from '../utils/recoveryEngine';
import { UserAvatar } from './UserAvatar';

interface OfficeTypeBreakdownPanelProps {
  aersRecords: AersRecord[];
  aersMeta?: AersMetadata | null;
  title?: string;
}

const EMPTY_SET = new Set<string>();

export function OfficeTypeBreakdownPanel({
  aersRecords,
  aersMeta = null,
  title = 'Office Type (RO / MO) → Officer Strategy Breakdown',
}: OfficeTypeBreakdownPanelProps) {
  const [focusMode, setFocusMode] = useState<'all' | 'npl' | 'borderline' | 'worst'>('all');
  const [expandedOffices, setExpandedOffices] = useState<Record<string, boolean>>({});

  const evaluableItems = useMemo(
    () => normalizeEvaluableFromAers(aersRecords, EMPTY_SET),
    [aersRecords],
  );

  const officeSummaries = useMemo(
    () => computeOfficeTypeBreakdown(evaluableItems),
    [evaluableItems],
  );

  const branchPortfolio = useMemo(
    () => getBranchPortfolioTotals(aersMeta, aersRecords, 'ALL'),
    [aersMeta, aersRecords],
  );

  // Map full BM portfolio assigned contract counts per (ROLE::officer)
  const bmAssignedMap = useMemo(() => {
    const map = new Map<string, { totalCount: number; belowOneCount: number; ratio90Pct: number }>();
    const roPerf = aersMeta?.bmBranchSnapshot?.roPerformance ?? [];
    const moPerf = aersMeta?.bmBranchSnapshot?.moPerformance ?? [];
    for (const row of [...roPerf, ...moPerf]) {
      const ratio90Pct =
        row.ratio90Pct !== undefined
          ? row.ratio90Pct
          : row.totalCount > 0
            ? Math.round((row.belowOneCount / row.totalCount) * 1000) / 10
            : 0;
      map.set(`${row.role}::${row.officer.toLowerCase()}`, {
        totalCount: row.totalCount || 0,
        belowOneCount: row.belowOneCount || 0,
        ratio90Pct,
      });
    }
    return map;
  }, [aersMeta]);

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
      aria-label="Office Type RO and MO Hierarchy Breakdown"
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
            Strict <strong className="font-medium text-slate-700 dark:text-slate-300">Office Type</strong> classification: <strong className="text-emerald-700 dark:text-emerald-400">RO → Recovery Officer</strong> and <strong className="text-indigo-700 dark:text-indigo-400">MO → Marketing Officer</strong>, reconciling full assigned portfolio ({branchPortfolio.totalContracts.toLocaleString()} contracts) with NPL &amp; Borderline risk accounts.
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
        </div>
      </div>

      {/* Full Branch Assigned Contracts Reconciliation Banner */}
      {branchPortfolio.totalContracts > 0 && (
        <div className="px-4 sm:px-5 py-2.5 bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono">
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              Branch Total: {branchPortfolio.totalContracts.toLocaleString()} Contracts
            </span>
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
              RO (Recovery): {branchPortfolio.roContractsCount.toLocaleString()} ({branchPortfolio.roOfficerCount} officers)
            </span>
            <span className="text-indigo-700 dark:text-indigo-400 font-semibold">
              MO (Marketing): {branchPortfolio.moContractsCount.toLocaleString()} ({branchPortfolio.moOfficerCount} officers)
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            NPL &amp; Borderline Focus: {totals.totalCount.toLocaleString()} accts
          </span>
        </div>
      )}

      {visibleOffices.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
          No Office Type records yet. Upload your daily AERS report to populate the RO / MO hierarchy automatically.
        </div>
      ) : (
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {visibleOffices.map((office) => {
            const isOpen = expandedOffices[office.officeType] ?? true;
            const roleNorm = getNormalizedOfficerRole(office.officeType);
            const isMoGroup = roleNorm === 'MO';
            const roleTitle = isMoGroup
              ? 'MO — Marketing Officers'
              : roleNorm === 'RO'
                ? 'RO — Recovery Officers'
                : office.officeType;
            const officerColLabel = isMoGroup
              ? 'Marketing Officer (MO)'
              : roleNorm === 'RO'
                ? 'Recovery Officer (RO)'
                : 'Officer Name';
            const groupAssignedTotal = isMoGroup
              ? branchPortfolio.moContractsCount
              : roleNorm === 'RO'
                ? branchPortfolio.roContractsCount
                : office.totalCount;

            // Merge BM officers of this role who have 0 NPL/Borderline when viewing 'all'
            const bmRoleRows = isMoGroup
              ? aersMeta?.bmBranchSnapshot?.moPerformance ?? []
              : roleNorm === 'RO'
                ? aersMeta?.bmBranchSnapshot?.roPerformance ?? []
                : [];
            const existingOfficerNames = new Set(
              office.officers.map((o) => o.officer.toLowerCase()),
            );
            const zeroRiskBmOfficers =
              focusMode === 'all'
                ? bmRoleRows
                    .filter((r) => !existingOfficerNames.has(r.officer.toLowerCase()))
                    .map((r) => ({
                      officer: r.officer,
                      totalCount: 0,
                      activeNplCount: 0,
                      opNpl: r.opNpl || 0,
                      closingNpl: r.closingNpl || 0,
                      closingDebtor: r.closingDebtor || 0,
                      borderlineCount: 0,
                      borderlineMinToSave: 0,
                      borderlineEfforts: 0,
                      zeroEffortBorderlineCount: 0,
                      worstCount: 0,
                      worstNpl: 0,
                    }))
                : [];

            const visibleOfficers = [...office.officers, ...zeroRiskBmOfficers].filter((off) => {
              if (focusMode === 'npl') return off.activeNplCount > 0 || off.closingNpl > 0;
              if (focusMode === 'borderline') return off.borderlineCount > 0;
              if (focusMode === 'worst') return off.worstCount > 0;
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
                        <span
                          className={`text-xs sm:text-sm font-semibold ${
                            isMoGroup
                              ? 'text-indigo-800 dark:text-indigo-300'
                              : 'text-emerald-800 dark:text-emerald-300'
                          }`}
                        >
                          {roleTitle}
                        </span>
                        <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                          {visibleOfficers.length} {isMoGroup ? 'MOs' : roleNorm === 'RO' ? 'ROs' : 'Officers'} ·{' '}
                          <strong>{groupAssignedTotal.toLocaleString()}</strong> Assigned · {office.totalCount} Risk
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
                      Borderline: {office.borderlineCount} accts
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
                          <th className="py-2 pl-10 pr-3">{officerColLabel}</th>
                          <th className="py-2 px-3 text-right">Assigned Total</th>
                          <th className="py-2 px-3 text-right">Risk Accts</th>
                          <th className="py-2 px-3 text-right">Active NPL</th>
                          <th className="py-2 px-3 text-right">Op Npl</th>
                          <th className="py-2 px-3 text-right">Closing NPL</th>
                          <th className="py-2 px-3 text-right">Closing Debtor</th>
                          <th className="py-2 px-3 text-right">Borderline (61-90)</th>
                          <th className="py-2 px-3 text-right">Efforts (0-Eff)</th>
                          <th className="py-2 px-4 text-right">WORST (W)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 tabular-nums">
                        {visibleOfficers.map((off) => {
                          const roleKey = `${isMoGroup ? 'MO' : 'RO'}::${off.officer.toLowerCase()}`;
                          const bmInfo = bmAssignedMap.get(roleKey);
                          const assignedTotal = bmInfo?.totalCount ?? off.totalCount;
                          return (
                            <tr
                              key={`${office.officeType}_${off.officer}`}
                              className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                            >
                              <td className="py-2 pl-10 pr-3 font-medium text-slate-900 dark:text-slate-100">
                                <span className="inline-flex items-center gap-2">
                                  <UserAvatar name={off.officer} sizeClass="w-6 h-6 text-[10px]" />
                                  <span>{off.officer}</span>
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                                {assignedTotal.toLocaleString()}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-300">
                                {off.totalCount}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-semibold text-red-600 dark:text-red-400">
                                {off.activeNplCount}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-300">
                                {formatCurrencyRs(off.opNpl)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-semibold text-red-600 dark:text-red-400">
                                {formatCurrencyRs(off.closingNpl)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-900 dark:text-slate-100">
                                {formatCurrencyRs(off.closingDebtor)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-medium text-amber-700 dark:text-amber-400">
                                {off.borderlineCount}
                              </td>
                              <td className="py-2 px-3 text-right font-mono">
                                <span className="text-slate-900 dark:text-slate-100 font-medium">
                                  {off.borderlineEfforts}
                                </span>
                                {off.zeroEffortBorderlineCount > 0 && (
                                  <span className="ml-1 text-[10px] text-red-600 dark:text-red-400 font-semibold">
                                    ({off.zeroEffortBorderlineCount} zero)
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-4 text-right font-mono">
                                {off.worstCount > 0 ? (
                                  <span className="text-red-600 dark:text-red-400 font-semibold">
                                    {off.worstCount} ({formatCompactRs(off.worstNpl)})
                                  </span>
                                ) : (
                                  <span className="text-slate-400">0</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
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
              Branch Total: {branchPortfolio.totalContracts.toLocaleString()} Assigned · {totals.totalCount} Risk Contracts
            </span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono">
              <span className="text-red-600 dark:text-red-400">
                Active NPL: {totals.activeNplCount} ({formatCompactRs(totals.closingNpl)})
              </span>
              <span className="text-slate-600 dark:text-slate-300">
                Op Npl: {formatCompactRs(totals.opNpl)}
              </span>
              <span className="text-amber-700 dark:text-amber-400">
                Borderline: {totals.borderlineCount} accts
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
