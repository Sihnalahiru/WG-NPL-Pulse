import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  PhoneCall,
  Search,
  Sparkles,
  Target,
  Users,
  X,
} from 'lucide-react';
import type {
  AersMetadata,
  AersRecord,
  BelowOneQuickWinItem,
  MrpEnrichment,
} from '../types/recovery';
import {
  extractBelowOneQuickWins,
  formatCompactRs,
  formatCurrencyRs,
  getBranchPortfolioTotals,
  getOfficerByOfficeType,
  normalizeContractNo,
} from '../utils/recoveryEngine';
import { PaymentPatternStrip } from './PaymentPatternStrip';
import { UserAvatar } from './UserAvatar';

interface BelowOneRatioPanelProps {
  aersRecords: AersRecord[];
  aersMeta: AersMetadata | null;
  mrpMap?: Map<string, MrpEnrichment>;
}

interface OfficerRatioSummary {
  officer: string;
  role: string;
  totalCount: number;
  belowOneCount: number;
  ratio90Pct: number;
  contractsNeededFor90: number;
  ultraQuickCount: number; // 1.01 - 1.35
  nearOneCount: number; // 1.36 - 1.99
  quickWinTotal: number;
}

export function BelowOneRatioPanel({
  aersRecords,
  aersMeta,
  mrpMap,
}: BelowOneRatioPanelProps) {
  const [selectedOfficer, setSelectedOfficer] = useState<string>('ALL');
  const [ageBand, setAgeBand] = useState<'all' | 'ultra' | 'near'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(25);

  const bm = aersMeta?.bmBranchSnapshot;

  // Compute branch-wide 90 Ratio (Below 1 / Total Contracts * 100)
  const branchRatio = useMemo(() => {
    const portfolio = getBranchPortfolioTotals(aersMeta, aersRecords, 'ALL');
    const totalContracts = portfolio.totalContracts;
    const belowOneCount = portfolio.belowOneCount;
    const ratio90Pct = portfolio.ratio90Pct;
    const targetCount = Math.ceil(totalContracts * 0.9);
    const contractsNeeded = portfolio.neededFor90;
    const gapPct = Math.max(0, Math.round((90 - ratio90Pct) * 10) / 10);

    return {
      totalContracts,
      belowOneCount,
      ratio90Pct,
      targetCount,
      contractsNeeded,
      gapPct,
    };
  }, [aersMeta, aersRecords]);

  // All 1.01 - 1.99 quick-win contracts (prefer full workbook snapshot if present, else live AERS)
  const quickWins = useMemo<BelowOneQuickWinItem[]>(() => {
    if (bm?.belowOneQuickWins && bm.belowOneQuickWins.length > 0) {
      return bm.belowOneQuickWins;
    }
    const fromAers = extractBelowOneQuickWins(aersRecords);
    if (fromAers.length > 0) return fromAers;

    // Fallback: lowest currentAge > 1.00 accounts available in loaded AERS
    return aersRecords
      .filter((r) => (r.currentAge || 0) > 1.0)
      .map((r) => {
        const currentAge = Number(r.currentAge) || 0;
        return {
          contractNo: r.contractNo,
          cusName: r.cusName || 'Unnamed Client',
          officer: getOfficerByOfficeType(r),
          officeType: (r.officeType || 'RO').trim() || 'RO',
          opAge: Number(r.opAge) || 0,
          currentAge,
          excessAge: Math.round((currentAge - 1.0) * 100) / 100,
          actualDpd: Number(r.actualDpd) || 0,
          closingDebtor: Number(r.closingDebtor) || 0,
          currentMonthDue: Number(r.currentMonthDue || r.dueBudgetMonth) || 0,
          totalCollection: Number(r.totalCollection) || 0,
          assignOfficerEfforts: Number(r.assignOfficerEfforts) || 0,
          totalEfforts: Number(r.totalEfforts) || 0,
          lastPayDate: r.lastPayDate || '',
          lastPaidAmount: Number(r.lastPaidAmount) || 0,
        };
      })
      .sort((a, b) => a.currentAge - b.currentAge || a.closingDebtor - b.closingDebtor);
  }, [bm, aersRecords]);

  // Per-officer 90 Ratio cards (from full BM branch snapshot when available, merged with quick-win counts)
  const officerSummaries = useMemo<OfficerRatioSummary[]>(() => {
    const quickByOfficer = new Map<string, { ultra: number; near: number; total: number }>();
    for (const q of quickWins) {
      const curr = quickByOfficer.get(q.officer) ?? { ultra: 0, near: 0, total: 0 };
      curr.total += 1;
      if (q.currentAge <= 1.35) curr.ultra += 1;
      else curr.near += 1;
      quickByOfficer.set(q.officer, curr);
    }

    if (bm && (bm.roPerformance.length > 0 || bm.moPerformance.length > 0)) {
      const combined = [...bm.roPerformance, ...bm.moPerformance];
      return combined
        .map((row) => {
          const totalCount = row.totalCount || 0;
          const belowOneCount = row.belowOneCount || 0;
          const ratio90Pct =
            totalCount > 0 ? Math.round((belowOneCount / totalCount) * 1000) / 10 : 0;
          const contractsNeededFor90 = Math.max(
            0,
            Math.ceil(totalCount * 0.9) - belowOneCount,
          );
          const q = quickByOfficer.get(row.officer) ?? { ultra: 0, near: 0, total: 0 };
          return {
            officer: row.officer,
            role: row.role,
            totalCount,
            belowOneCount,
            ratio90Pct,
            contractsNeededFor90,
            ultraQuickCount: q.ultra,
            nearOneCount: q.near,
            quickWinTotal: q.total,
          };
        })
        .sort((a, b) => a.ratio90Pct - b.ratio90Pct);
    }

    // Fallback from aersRecords
    const map = new Map<string, { role: string; total: number; below1: number }>();
    for (const r of aersRecords) {
      const off = getOfficerByOfficeType(r);
      const curr = map.get(off) ?? { role: r.officeType || 'RO', total: 0, below1: 0 };
      curr.total += 1;
      if ((r.currentAge || 0) <= 1.0) curr.below1 += 1;
      map.set(off, curr);
    }
    return Array.from(map.entries())
      .map(([officer, s]) => {
        const ratio90Pct =
          s.total > 0 ? Math.round((s.below1 / s.total) * 1000) / 10 : 0;
        const contractsNeededFor90 = Math.max(0, Math.ceil(s.total * 0.9) - s.below1);
        const q = quickByOfficer.get(officer) ?? { ultra: 0, near: 0, total: 0 };
        return {
          officer,
          role: s.role,
          totalCount: s.total,
          belowOneCount: s.below1,
          ratio90Pct,
          contractsNeededFor90,
          ultraQuickCount: q.ultra,
          nearOneCount: q.near,
          quickWinTotal: q.total,
        };
      })
      .sort((a, b) => a.ratio90Pct - b.ratio90Pct);
  }, [bm, aersRecords, quickWins]);

  const filteredQuickWins = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return quickWins.filter((item) => {
      if (selectedOfficer !== 'ALL' && item.officer !== selectedOfficer) return false;
      if (ageBand === 'ultra' && item.currentAge > 1.35) return false;
      if (ageBand === 'near' && item.currentAge <= 1.35) return false;
      if (q) {
        return (
          item.contractNo.toLowerCase().includes(q) ||
          item.cusName.toLowerCase().includes(q) ||
          item.officer.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [quickWins, selectedOfficer, ageBand, searchQuery]);

  const activeOfficerObj =
    selectedOfficer !== 'ALL'
      ? officerSummaries.find((o) => o.officer === selectedOfficer) ?? null
      : null;

  const displayedQuickWins = filteredQuickWins.slice(0, visibleLimit);
  const usingFullQuickWinPool = Boolean(bm?.belowOneQuickWins?.length);

  return (
    <section
      aria-label="Below 1 and 90 Ratio Quick-Win Planner"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs"
    >
      {/* Top Header & 90 Ratio Meter */}
      <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-br from-emerald-50/60 via-white to-blue-50/40 dark:from-emerald-950/20 dark:via-slate-900 dark:to-slate-900 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              <Target className="w-3.5 h-3.5" />
              Below 1 (≤ 1.00 Age) · 90% Ratio Evaluation &amp; Quick-Win Plan
            </div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
              90 Ratio Control — Pull 1.01+ Accounts Back Under ≤ 1.00
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
              <strong>90 Ratio = (Closing Age ≤ 1.00 Contracts ÷ Total Contracts) × 100.</strong>{' '}
              වැඩි වාරික ප්‍රමාණයක් හිඟ (deep arrears) ගිණුම් වලට වඩා, Closing Age <strong>1.01 සිට 1.50</strong> අතර ඇති පොඩි ගණනකින් <strong>≤ 1.00</strong> ට ගත හැකි ගිණුම් පළමුව අමතා 90% ඉලක්කය ඉක්මනින් සම්පූර්ණ කරන්න.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 min-w-[260px] shrink-0 tabular-nums">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-600 dark:text-slate-400">
                Branch 90 Ratio
              </span>
              <span
                className={`font-mono text-lg font-bold ${
                  branchRatio.ratio90Pct >= 90
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : branchRatio.ratio90Pct >= 80
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {branchRatio.ratio90Pct.toFixed(1)}%
              </span>
            </div>
            <div className="mt-2 h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
              <div
                className={`h-full rounded-full transition-all ${
                  branchRatio.ratio90Pct >= 90
                    ? 'bg-emerald-600'
                    : branchRatio.ratio90Pct >= 80
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(100, branchRatio.ratio90Pct)}%` }}
              />
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-slate-900 dark:bg-white"
                style={{ left: '90%' }}
                title="90% Target Line"
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              <span>
                {branchRatio.belowOneCount.toLocaleString()} /{' '}
                {branchRatio.totalContracts.toLocaleString()} Below 1
              </span>
              {branchRatio.contractsNeeded > 0 ? (
                <span className="font-semibold text-amber-700 dark:text-amber-400">
                  Need +{branchRatio.contractsNeeded} for 90%
                </span>
              ) : (
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  90% Target Met
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Officer-wise 90 Ratio User Cards */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
              <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Officer-Wise 90 Ratio Cards (Click an officer to view their easiest 1.01+ quick-win contracts)
            </div>
            {selectedOfficer !== 'ALL' && (
              <button
                type="button"
                onClick={() => {
                  setSelectedOfficer('ALL');
                  setVisibleLimit(25);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                <X className="w-3.5 h-3.5" />
                Show All Officers
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 tabular-nums">
            {officerSummaries.map((o) => {
              const isSelected = selectedOfficer === o.officer;
              const hit90 = o.ratio90Pct >= 90;
              return (
                <button
                  key={`${o.role}_${o.officer}`}
                  type="button"
                  onClick={() => {
                    setSelectedOfficer((prev) =>
                      prev === o.officer ? 'ALL' : o.officer,
                    );
                    setVisibleLimit(25);
                  }}
                  className={`text-left p-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/30'
                      : 'bg-white dark:bg-slate-950/70 border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <UserAvatar name={o.officer} sizeClass="w-8 h-8 text-[11px]" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {o.officer}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {o.role} · {o.belowOneCount}/{o.totalCount} Below 1
                        </div>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-xs font-mono font-bold rounded-md ${
                        hit90
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : o.ratio90Pct >= 80
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}
                    >
                      {o.ratio90Pct.toFixed(1)}%
                    </span>
                  </div>

                  <div className="mt-2.5 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
                    <div
                      className={`h-full rounded-full ${
                        hit90
                          ? 'bg-emerald-500'
                          : o.ratio90Pct >= 80
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, o.ratio90Pct)}%` }}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10px]">
                    {o.contractsNeededFor90 > 0 ? (
                      <span className="font-semibold text-amber-700 dark:text-amber-400">
                        Need +{o.contractsNeededFor90} to hit 90%
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        Above 90%
                      </span>
                    )}
                    <span className="font-mono text-slate-500 dark:text-slate-400">
                      {o.quickWinTotal} quick-wins
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick-Win Contracts Table (Sorted Closest to 1.00 First) */}
      <div className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {activeOfficerObj
                  ? `${activeOfficerObj.officer} — Quick-Win Contracts to Pull ≤ 1.00 (${filteredQuickWins.length})`
                  : `Branch Quick-Win Action Plan — Easiest 1.01+ Contracts First (${filteredQuickWins.length})`}
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Sorted by smallest excess above Age 1.00 (1.01, 1.02, 1.05…).{' '}
              {!usingFullQuickWinPool && (
                <span className="text-amber-700 dark:text-amber-400 font-medium">
                  Re-upload your latest AERS/MRP workbook to include all [C] 1.01–1.99 accounts from the full branch sheet.
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg">
              {(
                [
                  { id: 'all', label: 'All 1.01+' },
                  { id: 'ultra', label: '1.01 – 1.35 (Fastest)' },
                  { id: 'near', label: '1.36 – 1.99' },
                ] as const
              ).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setAgeBand(b.id);
                    setVisibleLimit(25);
                  }}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap ${
                    ageBand === b.id
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>

            <div className="relative w-52">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setVisibleLimit(25);
                }}
                placeholder="Search contract, client..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>
        </div>

        {displayedQuickWins.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            No 1.01+ quick-win contracts match the current filter. Upload a full AERS/MRP workbook to populate all 1.01–1.99 accounts.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-3">Contract &amp; Client</th>
                  <th className="py-2.5 px-3">Officer</th>
                  <th className="py-2.5 px-3 text-right">Closing Age (Excess)</th>
                  <th className="py-2.5 px-3 text-right">Due / Collection</th>
                  <th className="py-2.5 px-3 text-right">Closing Debtor</th>
                  <th className="py-2.5 px-3 text-right">Efforts</th>
                  <th className="py-2.5 px-3">Practical Plan (EN / සිංහල)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                {displayedQuickWins.map((item) => {
                  const isUltra = item.currentAge <= 1.35;
                  const isNear = item.currentAge > 1.35 && item.currentAge < 2.0;
                  return (
                    <tr
                      key={item.contractNo}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                    >
                      <td className="py-2.5 px-3">
                        <div className="font-mono font-bold text-slate-900 dark:text-slate-100">
                          {item.contractNo}
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate max-w-[190px]">
                          {item.cusName}
                        </div>
                        <PaymentPatternStrip
                          mrp={mrpMap?.get(normalizeContractNo(item.contractNo))}
                          lastPaidAmount={item.lastPaidAmount}
                          lastPayDate={item.lastPayDate}
                          totalCollection={item.totalCollection}
                          compact={true}
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <UserAvatar name={item.officer} sizeClass="w-6 h-6 text-[9px]" />
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {item.officer}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {item.officeType}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold ${
                            isUltra
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : isNear
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {item.currentAge.toFixed(2)}
                        </span>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          +{item.excessAge.toFixed(2)} over 1.00 · Op {item.opAge.toFixed(2)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <div className="text-slate-900 dark:text-slate-100 font-semibold">
                          Due: {formatCompactRs(item.currentMonthDue)}
                        </div>
                        <div className="text-[10px] text-emerald-700 dark:text-emerald-400">
                          Coll: {formatCompactRs(item.totalCollection)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrencyRs(item.closingDebtor)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            item.assignOfficerEfforts > 0
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          <PhoneCall className="w-3 h-3" />
                          {item.assignOfficerEfforts} / {item.totalEfforts}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 max-w-[260px]">
                        {isUltra ? (
                          <div className="space-y-0.5">
                            <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              Quick Win #1 · පොඩි ගෙවීමකින් ≤ 1.00
                            </span>
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                              Small top-up clears +{item.excessAge.toFixed(2)} excess immediately. Call today to boost 90 Ratio.
                            </p>
                          </div>
                        ) : isNear ? (
                          <div className="space-y-0.5">
                            <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                              Near Below-1 · මේ මස ගෙවීම ඉලක්ක කරන්න
                            </span>
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                              Collect current due + small arrears balance to pull below 1.00 before month-end.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              Step-Down · පියවරෙන් පියවර අඩු කරන්න
                            </span>
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                              Prioritize 1.01–1.50 accounts first; collect part-payment here to stop upward slippage.
                            </p>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filteredQuickWins.length > visibleLimit && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleLimit((prev) => prev + 30)}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Show More Quick-Win Contracts ({filteredQuickWins.length - visibleLimit} remaining)
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
