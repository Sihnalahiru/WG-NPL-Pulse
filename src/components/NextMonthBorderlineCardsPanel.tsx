import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Flame,
  Plus,
  Search,
  ShieldAlert,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import borderlineShieldImg from '../assets/images/borderline_shield_card_1795684834875.jpg';
import type {
  AersRecord,
  BorderlineAccountItem,
  MrpEnrichment,
  TrackedContract,
} from '../types/recovery';
import {
  analyzeNextMonthBorderline,
  formatCompactRs,
  formatCurrencyRs,
  normalizeContractNo,
  normalizeEvaluableFromAers,
  normalizeEvaluableFromTracked,
} from '../utils/recoveryEngine';
import { PaymentPatternStrip } from './PaymentPatternStrip';
import { UserAvatar } from './UserAvatar';

interface NextMonthBorderlineCardsPanelProps {
  trackedContracts: TrackedContract[];
  aersRecords: AersRecord[];
  mrpMap?: Map<string, MrpEnrichment>;
  defaultScope?: 'aers' | 'tracked';
  onAddFromMaster?: (record: AersRecord) => void;
  onLogVisit?: (contract: TrackedContract) => void;
}

type RiskFilterMode =
  | 'all'
  | 'month_end'
  | 'next_month'
  | 'zero_effort'
  | 'worst';

interface OfficerBorderlineSummary {
  officer: string;
  officeTypes: string[];
  totalCount: number;
  monthEndCount: number;
  nextMonthCount: number;
  projectedNpl: number;
  debtorAtRisk: number;
  minToSave: number;
  assignEfforts: number;
  zeroEffortCount: number;
  worstCount: number;
}

export function NextMonthBorderlineCardsPanel({
  trackedContracts,
  aersRecords,
  mrpMap,
  defaultScope,
  onAddFromMaster,
  onLogVisit,
}: NextMonthBorderlineCardsPanelProps) {
  const initialScope: 'aers' | 'tracked' =
    defaultScope ?? (aersRecords.length > 0 ? 'aers' : 'tracked');
  const [scope, setScope] = useState<'aers' | 'tracked'>(initialScope);
  const [selectedOfficer, setSelectedOfficer] = useState<string>('ALL');
  const [selectedOffice, setSelectedOffice] = useState<string>('ALL');
  const [riskFilter, setRiskFilter] = useState<RiskFilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState<number>(12);

  const effectiveScope: 'aers' | 'tracked' =
    scope === 'aers' && aersRecords.length === 0 ? 'tracked' : scope;

  const trackedByNo = useMemo(() => {
    const map = new Map<string, TrackedContract>();
    trackedContracts.forEach((c) =>
      map.set(normalizeContractNo(c.contractNo), c),
    );
    return map;
  }, [trackedContracts]);

  const trackedNos = useMemo(
    () => new Set(trackedContracts.map((c) => normalizeContractNo(c.contractNo))),
    [trackedContracts],
  );

  const aersByNo = useMemo(() => {
    const map = new Map<string, AersRecord>();
    aersRecords.forEach((r) => map.set(normalizeContractNo(r.contractNo), r));
    return map;
  }, [aersRecords]);

  const evaluableItems = useMemo(() => {
    if (effectiveScope === 'aers' && aersRecords.length > 0) {
      return normalizeEvaluableFromAers(aersRecords, trackedNos, mrpMap);
    }
    return normalizeEvaluableFromTracked(trackedContracts);
  }, [effectiveScope, aersRecords, trackedNos, mrpMap, trackedContracts]);

  const borderlineAnalysis = useMemo(
    () => analyzeNextMonthBorderline(evaluableItems),
    [evaluableItems],
  );

  const officeTypes = useMemo(() => {
    const set = new Set<string>();
    borderlineAnalysis.accounts.forEach((a) => set.add(a.officeType));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [borderlineAnalysis.accounts]);

  const officeFilteredAccounts = useMemo(() => {
    if (selectedOffice === 'ALL') return borderlineAnalysis.accounts;
    return borderlineAnalysis.accounts.filter(
      (a) => a.officeType === selectedOffice,
    );
  }, [borderlineAnalysis.accounts, selectedOffice]);

  const officerSummaries = useMemo<OfficerBorderlineSummary[]>(() => {
    const map = new Map<string, OfficerBorderlineSummary>();
    for (const acc of officeFilteredAccounts) {
      const existing = map.get(acc.officer);
      if (!existing) {
        map.set(acc.officer, {
          officer: acc.officer,
          officeTypes: [acc.officeType],
          totalCount: 1,
          monthEndCount: acc.riskTier === 'This Month-End (91+)' ? 1 : 0,
          nextMonthCount:
            acc.riskTier === 'Next Month Borderline (61-90)' ? 1 : 0,
          projectedNpl: acc.projectedNpl,
          debtorAtRisk: acc.closingDebtor,
          minToSave: acc.minToSave,
          assignEfforts: acc.assignOfficerEfforts,
          zeroEffortCount: acc.assignOfficerEfforts <= 0 ? 1 : 0,
          worstCount: acc.isWorst ? 1 : 0,
        });
      } else {
        if (!existing.officeTypes.includes(acc.officeType)) {
          existing.officeTypes.push(acc.officeType);
        }
        existing.totalCount += 1;
        if (acc.riskTier === 'This Month-End (91+)') {
          existing.monthEndCount += 1;
        } else {
          existing.nextMonthCount += 1;
        }
        existing.projectedNpl += acc.projectedNpl;
        existing.debtorAtRisk += acc.closingDebtor;
        existing.minToSave += acc.minToSave;
        existing.assignEfforts += acc.assignOfficerEfforts;
        if (acc.assignOfficerEfforts <= 0) existing.zeroEffortCount += 1;
        if (acc.isWorst) existing.worstCount += 1;
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => b.projectedNpl - a.projectedNpl || b.totalCount - a.totalCount,
    );
  }, [officeFilteredAccounts]);

  const activeOfficerSummary = useMemo(() => {
    if (selectedOfficer === 'ALL') return null;
    return (
      officerSummaries.find((o) => o.officer === selectedOfficer) ?? null
    );
  }, [officerSummaries, selectedOfficer]);

  const filteredAccounts = useMemo<BorderlineAccountItem[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    return officeFilteredAccounts.filter((item) => {
      if (selectedOfficer !== 'ALL' && item.officer !== selectedOfficer) {
        return false;
      }
      if (
        riskFilter === 'month_end' &&
        item.riskTier !== 'This Month-End (91+)'
      ) {
        return false;
      }
      if (
        riskFilter === 'next_month' &&
        item.riskTier !== 'Next Month Borderline (61-90)'
      ) {
        return false;
      }
      if (riskFilter === 'zero_effort' && item.assignOfficerEfforts > 0) {
        return false;
      }
      if (riskFilter === 'worst' && !item.isWorst) {
        return false;
      }
      if (q) {
        return (
          item.contractNo.toLowerCase().includes(q) ||
          item.cusName.toLowerCase().includes(q) ||
          item.vehicleNo.toLowerCase().includes(q) ||
          item.officer.toLowerCase().includes(q) ||
          item.officeType.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [officeFilteredAccounts, selectedOfficer, riskFilter, searchQuery]);

  const filteredTotals = useMemo(() => {
    return filteredAccounts.reduce(
      (acc, item) => ({
        count: acc.count + 1,
        monthEnd:
          acc.monthEnd + (item.riskTier === 'This Month-End (91+)' ? 1 : 0),
        nextMonth:
          acc.nextMonth +
          (item.riskTier === 'Next Month Borderline (61-90)' ? 1 : 0),
        projectedNpl: acc.projectedNpl + item.projectedNpl,
        minToSave: acc.minToSave + item.minToSave,
        efforts: acc.efforts + item.assignOfficerEfforts,
        zeroEffort: acc.zeroEffort + (item.assignOfficerEfforts <= 0 ? 1 : 0),
      }),
      {
        count: 0,
        monthEnd: 0,
        nextMonth: 0,
        projectedNpl: 0,
        minToSave: 0,
        efforts: 0,
        zeroEffort: 0,
      },
    );
  }, [filteredAccounts]);

  const displayedAccounts = filteredAccounts.slice(0, visibleLimit);

  return (
    <section
      aria-label="Next-Month Borderline Command Cards"
      className="bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-900/50 rounded-2xl overflow-hidden shadow-xs"
    >
      {/* Hero Focus Header with Custom Illustration */}
      <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-br from-amber-50/70 via-white to-blue-50/40 dark:from-amber-950/20 dark:via-slate-900 dark:to-slate-900">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 min-w-0">
            <div className="w-full sm:w-44 h-28 rounded-xl overflow-hidden border border-amber-200/80 dark:border-amber-800/60 shadow-xs shrink-0 bg-slate-950">
              <img
                src={borderlineShieldImg}
                alt="Next-Month Borderline Risk Shield Illustration"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-1.5 min-w-0">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                Next-Month Borderline Focus · Prevent 91 DPD Slippage
              </div>
              <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Borderline &amp; Pre-NPL Card Control ({borderlineAnalysis.totalCount} Accounts)
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
                Filter by Recovery Officer and Office Type to isolate every{' '}
                <strong className="font-semibold text-slate-800 dark:text-slate-200">
                  &lt; 91 DPD
                </strong>{' '}
                account crossing into NPL this month-end or next month (+30d), with projected Capital + Arrears NPL impact and minimum save payments.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setScope('aers');
                  setSelectedOfficer('ALL');
                  setSelectedOffice('ALL');
                }}
                disabled={aersRecords.length === 0}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 ${
                  effectiveScope === 'aers'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Full AERS ({aersRecords.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setScope('tracked');
                  setSelectedOfficer('ALL');
                  setSelectedOffice('ALL');
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  effectiveScope === 'tracked'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Watchlist ({trackedContracts.length})
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Scope KPI Strip */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 tabular-nums">
          <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Filtered Borderline
            </div>
            <div className="mt-0.5 text-lg font-bold font-mono text-slate-900 dark:text-slate-100">
              {filteredTotals.count}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              {filteredTotals.monthEnd} Month-End · {filteredTotals.nextMonth} Next-Mo
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-950/80 border border-amber-200 dark:border-amber-900/60">
            <div className="text-[11px] font-medium text-amber-800 dark:text-amber-300">
              Projected NPL (Cap + Arr)
            </div>
            <div className="mt-0.5 text-lg font-bold font-mono text-amber-900 dark:text-amber-200">
              {formatCompactRs(filteredTotals.projectedNpl)}
            </div>
            <div className="text-[10px] text-amber-700 dark:text-amber-400">
              Capital exposure at 91 DPD
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-950/80 border border-blue-200 dark:border-blue-900/60">
            <div className="text-[11px] font-medium text-blue-800 dark:text-blue-300">
              Min Payment to Save
            </div>
            <div className="mt-0.5 text-lg font-bold font-mono text-blue-900 dark:text-blue-200">
              {formatCompactRs(filteredTotals.minToSave)}
            </div>
            <div className="text-[10px] text-blue-700 dark:text-blue-400">
              Target collection &lt; 91 DPD
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-950/80 border border-emerald-200 dark:border-emerald-900/60">
            <div className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
              Assign Officer Efforts
            </div>
            <div className="mt-0.5 text-lg font-bold font-mono text-emerald-900 dark:text-emerald-200">
              {filteredTotals.efforts.toLocaleString()}
            </div>
            <div className="text-[10px] text-emerald-700 dark:text-emerald-400">
              Avg{' '}
              {filteredTotals.count > 0
                ? (filteredTotals.efforts / filteredTotals.count).toFixed(1)
                : '0.0'}{' '}
              visits / acct
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-950/80 border border-red-200 dark:border-red-900/60 col-span-2 sm:col-span-1">
            <div className="text-[11px] font-medium text-red-700 dark:text-red-300">
              Zero-Effort Borderline
            </div>
            <div className="mt-0.5 text-lg font-bold font-mono text-red-700 dark:text-red-300">
              {filteredTotals.zeroEffort}
            </div>
            <div className="text-[10px] text-red-600 dark:text-red-400">
              Immediate RO field action needed
            </div>
          </div>
        </div>

        {/* Excel-Reconciled Month-to-Date Borderline & Above-3 Outcome Bar */}
        <div className="mt-3 p-3 rounded-xl bg-white/85 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs tabular-nums">
          <div>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block">
              Forecasted Border NPL (1st)
            </span>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
              {formatCurrencyRs(borderlineAnalysis.forecastedBorderAmount)}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
              {borderlineAnalysis.forecastedBorderCount} contracts (OP_AGE 2.01–2.99)
            </span>
          </div>
          <div>
            <span className="text-[10px] font-medium text-red-700 dark:text-red-400 block">
              Moved to NPL (Fallen)
            </span>
            <span className="font-mono font-bold text-red-700 dark:text-red-400">
              {formatCurrencyRs(borderlineAnalysis.movedToNplAmount)}
            </span>
            <span className="text-[10px] text-red-600 dark:text-red-400 block">
              {borderlineAnalysis.movedToNplCount} moved to 91+ DPD
            </span>
          </div>
          <div>
            <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 block">
              Paid &amp; Saved (Border Saving)
            </span>
            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
              {formatCurrencyRs(borderlineAnalysis.borderSavedAmount)}
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block">
              {borderlineAnalysis.borderSavedCount} kept &lt;91 DPD
            </span>
          </div>
          <div>
            <span className="text-[10px] font-medium text-blue-700 dark:text-blue-400 block">
              Saved From Above 3 + Total Saved
            </span>
            <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
              {formatCurrencyRs(borderlineAnalysis.savedAmount)}
            </span>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 block">
              Above-3: {formatCompactRs(borderlineAnalysis.above3SavedAmount)} ({borderlineAnalysis.above3SavedCount}) · Total {borderlineAnalysis.savedCount}
            </span>
          </div>
        </div>
      </div>

      {/* Per-Person (RO) & Office Filter Toolbar */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 space-y-4 bg-slate-50/50 dark:bg-slate-950/40">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          {/* Risk Tier Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: 'All Borderline' },
                { id: 'month_end', label: 'Month-End Crossing 91+' },
                { id: 'next_month', label: 'Next Month (61-90)' },
                { id: 'zero_effort', label: '0-Effort Only' },
                { id: 'worst', label: 'WORST (W)' },
              ] as const
            ).map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => {
                  setRiskFilter(pill.id);
                  setVisibleLimit(12);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                  riskFilter === pill.id
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-blue-600 dark:border-blue-600'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* Office Type Selector, RO Dropdown & Search */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedOffice}
              onChange={(e) => {
                setSelectedOffice(e.target.value);
                setSelectedOfficer('ALL');
                setVisibleLimit(12);
              }}
              aria-label="Filter borderline cards by Office Type"
              className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Office Types ({officeTypes.length})</option>
              {officeTypes.map((ot) => (
                <option key={ot} value={ot}>
                  {ot}
                </option>
              ))}
            </select>

            <select
              value={selectedOfficer}
              onChange={(e) => {
                setSelectedOfficer(e.target.value);
                setVisibleLimit(12);
              }}
              aria-label="Filter borderline cards by Recovery Officer"
              className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">
                All Officers / Persons ({officerSummaries.length})
              </option>
              {officerSummaries.map((o) => (
                <option key={o.officer} value={o.officer}>
                  {o.officer} ({o.totalCount} accts · {formatCompactRs(o.projectedNpl)})
                </option>
              ))}
            </select>

            <div className="relative w-52">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setVisibleLimit(12);
                }}
                placeholder="Search contract, client, RO..."
                aria-label="Search borderline accounts"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Per-Person (RO) Selectable Pill Strip & Summary Cards */}
        {officerSummaries.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                <Users className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Per-Person Borderline Breakdown (Click an officer card to filter)
              </div>
              {selectedOfficer !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setSelectedOfficer('ALL')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear Officer Filter ({selectedOfficer})
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 tabular-nums">
              {officerSummaries.map((person) => {
                const isSelected = selectedOfficer === person.officer;
                return (
                  <button
                    key={person.officer}
                    type="button"
                    onClick={() => {
                      setSelectedOfficer((prev) =>
                        prev === person.officer ? 'ALL' : person.officer,
                      );
                      setVisibleLimit(12);
                    }}
                    className={`text-left p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/30'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <UserAvatar name={person.officer} sizeClass="w-8 h-8 text-[11px]" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {person.officer}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {person.officeTypes.join(', ')}
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded-md bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 shrink-0">
                        {person.totalCount}
                      </span>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block">
                          Proj. NPL
                        </span>
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {formatCompactRs(person.projectedNpl)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 dark:text-slate-400 block">
                          Min Save
                        </span>
                        <span className="font-mono font-semibold text-blue-700 dark:text-blue-400">
                          {formatCompactRs(person.minToSave)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[10px]">
                      <span className="text-slate-500 dark:text-slate-400">
                        {person.monthEndCount} M-End · {person.nextMonthCount} Next-Mo
                      </span>
                      <span
                        className={`font-mono font-semibold ${
                          person.zeroEffortCount > 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {person.assignEfforts} eff ({person.zeroEffortCount} 0-eff)
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Selected Officer Spotlight Banner */}
      {activeOfficerSummary && (
        <div className="px-4 sm:px-5 py-3 bg-amber-50/70 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/60 flex flex-wrap items-center justify-between gap-3 text-xs tabular-nums">
          <div className="flex items-center gap-2.5">
            <UserAvatar name={activeOfficerSummary.officer} sizeClass="w-7 h-7 text-[10px]" />
            <UserCheck className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              Officer View: {activeOfficerSummary.officer}
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              ({activeOfficerSummary.officeTypes.join(' · ')})
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span>
              Borderline:{' '}
              <strong className="font-mono">{activeOfficerSummary.totalCount}</strong>
            </span>
            <span>
              Projected Cap+Arr:{' '}
              <strong className="font-mono text-amber-800 dark:text-amber-300">
                {formatCurrencyRs(activeOfficerSummary.projectedNpl)}
              </strong>
            </span>
            <span>
              Target Min Save:{' '}
              <strong className="font-mono text-blue-700 dark:text-blue-400">
                {formatCurrencyRs(activeOfficerSummary.minToSave)}
              </strong>
            </span>
            <span>
              Officer Efforts:{' '}
              <strong className="font-mono">{activeOfficerSummary.assignEfforts}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Card Grid for Borderline Contracts */}
      <div className="p-4 sm:p-5">
        {displayedAccounts.length === 0 ? (
          <div className="py-12 px-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-500 dark:text-slate-400">
            No borderline accounts match the selected officer or filter criteria. Try selecting &quot;All Officers&quot; or uploading a daily AERS workbook.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {displayedAccounts.map((item) => {
                const normNo = normalizeContractNo(item.contractNo);
                const masterRec = aersByNo.get(normNo);
                const trackedRec = trackedByNo.get(normNo);
                const isMonthEnd = item.riskTier === 'This Month-End (91+)';
                const dpdPct = Math.min(
                  100,
                  Math.max(8, Math.round((item.actualDpd / 91) * 100)),
                );

                return (
                  <article
                    key={item.contractNo}
                    className={`rounded-xl border p-4 flex flex-col justify-between gap-3.5 transition-shadow hover:shadow-sm ${
                      isMonthEnd
                        ? 'bg-red-50/30 dark:bg-red-950/15 border-red-200/80 dark:border-red-900/50'
                        : 'bg-white dark:bg-slate-950/60 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {/* Card Top: Contract No + Risk Badges + Officer Avatar */}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                              {item.contractNo}
                            </span>
                            {item.isWorst && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-100 text-red-800 border border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800">
                                <Flame className="w-2.5 h-2.5" />
                                WORST (W)
                              </span>
                            )}
                          </div>
                          <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5">
                            {item.cusName}
                          </h3>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded border whitespace-nowrap ${
                              isMonthEnd
                                ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800'
                                : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                            }`}
                          >
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            {isMonthEnd ? 'Month-End 91+' : 'Next-Mo 61-90'}
                          </span>
                          <UserAvatar
                            name={item.officer}
                            sizeClass="w-11 h-11 text-xs shadow-xs"
                          />
                        </div>
                      </div>

                      {/* Vehicle, Office Type & RO Meta */}
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                        <span className="font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                          {item.vehicleNo || 'No Vehicle'}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                          <Building2 className="w-3 h-3 shrink-0" />
                          {item.officeType}
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          RO: {item.officer}
                        </span>
                      </div>

                      {/* Payment History Strip (Jan-Oct MRP Pattern + Last Payment) */}
                      <PaymentPatternStrip
                        mrp={mrpMap?.get(normNo) ?? trackedRec?.mrp}
                        lastPaidAmount={
                          masterRec?.lastPaidAmount ?? trackedRec?.lastPaidAmount
                        }
                        lastPayDate={
                          masterRec?.lastPayDate ?? trackedRec?.lastPayDate
                        }
                        totalCollection={
                          masterRec?.totalCollection ?? trackedRec?.totalCollection
                        }
                        showCategoryLine={true}
                        compact={true}
                      />
                    </div>

                    {/* DPD Progression Gauge */}
                    <div className="space-y-1.5 tabular-nums">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 dark:text-slate-400">
                          DPD Trajectory
                          {item.currentAge !== undefined && item.currentAge > 0
                            ? ` · Age ${item.currentAge.toFixed(2)}`
                            : ''}
                        </span>
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          <span className="text-amber-700 dark:text-amber-400">
                            {item.actualDpd}d
                          </span>{' '}
                          → Forecast{' '}
                          <span className="text-red-600 dark:text-red-400">
                            {item.monthEndForecastDpd}d
                          </span>{' '}
                          / +30d{' '}
                          <span className="text-red-700 dark:text-red-300">
                            {item.nextMonthProjectedDpd}d
                          </span>
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isMonthEnd ? 'bg-red-600' : 'bg-amber-500'
                          }`}
                          style={{ width: `${dpdPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Financial Numbers & Officer Efforts */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-800 text-xs tabular-nums">
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                          Proj. NPL (Cap+Arr)
                        </span>
                        <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                          {formatCompactRs(item.projectedNpl)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                          Min to Save
                        </span>
                        <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                          {formatCurrencyRs(item.minToSave)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                          Officer Efforts
                        </span>
                        <span
                          className={`font-mono font-bold ${
                            item.assignOfficerEfforts <= 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {item.assignOfficerEfforts}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1">
                          / {item.totalEfforts}
                        </span>
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        Debtor: {formatCompactRs(item.closingDebtor)}
                      </span>

                      <div className="flex items-center gap-2 shrink-0">
                        {trackedRec && onLogVisit ? (
                          <button
                            type="button"
                            onClick={() => onLogVisit(trackedRec)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 whitespace-nowrap"
                          >
                            <ClipboardCheck className="w-3 h-3" />
                            Log Visit
                          </button>
                        ) : item.isTracked ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Tracked
                          </span>
                        ) : masterRec && onAddFromMaster ? (
                          <button
                            type="button"
                            onClick={() => onAddFromMaster(masterRec)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap"
                          >
                            <Plus className="w-3 h-3" />
                            Track
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {filteredAccounts.length > visibleLimit && (
              <div className="mt-5 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleLimit((prev) => prev + 18)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  Show More Borderline Cards ({filteredAccounts.length - visibleLimit} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
