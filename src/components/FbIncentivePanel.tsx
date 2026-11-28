import { useMemo } from 'react';
import {
  BadgeDollarSign,
  Banknote,
  Calculator,
  CheckCircle2,
  ClipboardList,
  Landmark,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import type { AersMetadata, AersRecord } from '../types/recovery';
import {
  formatCompactRs,
  getBranchPortfolioTotals,
  getOfficerByOfficeType,
} from '../utils/recoveryEngine';
import { useLanguage } from '../contexts/LanguageContext';

interface FbIncentivePanelProps {
  aersRecords: AersRecord[];
  aersMeta: AersMetadata | null;
}

export function FbIncentivePanel({ aersRecords, aersMeta }: FbIncentivePanelProps) {
  const { t } = useLanguage();
  const bm = aersMeta?.bmBranchSnapshot;

  const liveReadiness = useMemo(() => {
    const officers = new Set<string>();
    let due = 0;
    let coll = 0;
    let opNpl = 0;
    let closeNpl = 0;
    let belowOne = 0;

    aersRecords.forEach((r) => {
      officers.add(getOfficerByOfficeType(r));
      due += Number(r.currentMonthDue || r.dueBudgetMonth) || 0;
      coll += Number(r.totalCollection) || 0;
      opNpl += Number(r.opNpl) || 0;
      closeNpl += Number(r.npl) || 0;
      if ((r.currentAge || 0) <= 1.0) belowOne += 1;
    });

    const portfolio = getBranchPortfolioTotals(aersMeta, aersRecords, 'ALL');
    const totalContracts = portfolio.totalContracts;
    const ratio90 = portfolio.ratio90Pct;
    const collPct =
      bm && (bm.roPerformance.length > 0 || bm.moPerformance.length > 0)
        ? (() => {
            const all = [...bm.roPerformance, ...bm.moPerformance];
            const d = all.reduce((s, o) => s + (o.dueBudget || 0), 0);
            const c = all.reduce((s, o) => s + (o.totalCollection || 0), 0);
            return d > 0 ? Math.round((c / d) * 1000) / 10 : 0;
          })()
        : due > 0
          ? Math.round((coll / due) * 1000) / 10
          : 0;

    const netOpNpl = bm?.totalOpNpl ?? opNpl;
    const netCloseNpl = bm?.totalClosingNpl ?? closeNpl;

    return {
      officerCount:
        bm && (bm.roPerformance.length > 0 || bm.moPerformance.length > 0)
          ? bm.roPerformance.length + bm.moPerformance.length
          : officers.size,
      totalContracts,
      collPct,
      ratio90,
      nplDelta: netOpNpl - netCloseNpl,
    };
  }, [aersRecords, bm]);

  return (
    <div className="space-y-6">
      {/* Header Hero */}
      <section
        aria-label="FB Incentive Command Header"
        className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-red-950 text-white border border-red-900/40 rounded-2xl p-6 shadow-lg relative overflow-hidden"
      >
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-red-600 via-red-400 to-amber-400" />
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-red-300">
              <BadgeDollarSign className="w-3.5 h-3.5" />
              Commercial Credit · Financial Business Incentive Engine
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight">
              {t('fbTitle')}
            </h2>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {t('fbSubtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-xs font-semibold text-amber-200 shrink-0">
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
            Ready for Your Incentive Slabs &amp; Formulas
          </div>
        </div>

        {/* Live Data Readiness Strip */}
        <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-white/10 tabular-nums">
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="text-[10px] text-zinc-400 uppercase font-semibold">
              Eligible Officers Loaded
            </div>
            <div className="mt-1 text-lg font-mono font-bold text-white">
              {liveReadiness.officerCount}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="text-[10px] text-zinc-400 uppercase font-semibold">
              Branch Collection Efficiency
            </div>
            <div className="mt-1 text-lg font-mono font-bold text-emerald-300">
              {liveReadiness.collPct.toFixed(1)}%
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="text-[10px] text-zinc-400 uppercase font-semibold">
              Branch 90 Ratio (≤1.00)
            </div>
            <div className="mt-1 text-lg font-mono font-bold text-amber-300">
              {liveReadiness.ratio90.toFixed(1)}%
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="text-[10px] text-zinc-400 uppercase font-semibold">
              Net NPL Variance
            </div>
            <div
              className={`mt-1 text-lg font-mono font-bold ${
                liveReadiness.nplDelta >= 0 ? 'text-emerald-300' : 'text-red-300'
              }`}
            >
              {liveReadiness.nplDelta >= 0 ? '+' : ''}
              {formatCompactRs(liveReadiness.nplDelta)}
            </div>
          </div>
        </div>
      </section>

      {/* Modular Slots Ready for User's Upcoming FB Incentive Specification */}
      <section
        aria-label="FB Incentive Module Blueprint"
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              Module 01
            </span>
          </div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Target Slabs &amp; Eligibility Gates
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Ready to configure your exact FB Incentive thresholds (90 Ratio gate, Collection % tiers, NPL reduction criteria, and product-wise targets).
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
              <Calculator className="w-4 h-4" />
            </div>
            <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              Module 02
            </span>
          </div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Automated Officer Payout Calculator
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Will auto-calculate per-officer Rs. payout sheets directly from your uploaded AERS &amp; MRP workbooks with zero manual Excel formulas.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400">
              <Banknote className="w-4 h-4" />
            </div>
            <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              Module 03
            </span>
          </div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Payout Slip PDF, Excel &amp; WhatsApp Share
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Once your rules are added, export individual officer incentive slips and branch summary sheets via PDF, .xlsx, or WhatsApp in one click.
          </p>
        </div>
      </section>

      <div className="p-4 rounded-xl bg-zinc-100/80 dark:bg-zinc-900/70 border border-dashed border-zinc-300 dark:border-zinc-700 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-600 dark:text-zinc-400">
        <div className="flex items-center gap-2">
          <Landmark className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0" />
          <span>
            Share your <strong>FB Incentive criteria, product slabs, and payout rates</strong> whenever ready — this main menu workspace is wired to live branch AERS data and ready to build out immediately.
          </span>
        </div>
        <div className="inline-flex items-center gap-3 font-mono text-[11px] text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            AERS Connected
          </span>
          <span className="inline-flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-red-600" />
            BM Snapshot Connected
          </span>
          <span className="inline-flex items-center gap-1">
            <ClipboardList className="w-3.5 h-3.5 text-zinc-500" />
            {liveReadiness.totalContracts.toLocaleString()} Contracts
          </span>
        </div>
      </div>
    </div>
  );
}
