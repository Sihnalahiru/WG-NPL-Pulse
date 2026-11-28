import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ShieldAlert,
  Target,
} from 'lucide-react';
import type {
  AersMetadata,
  AersRecord,
  MrpEnrichment,
} from '../types/recovery';
import {
  analyzeNextMonthBorderline,
  formatCompactRs,
  formatCurrencyRs,
  getCapitalNplExposure,
  getDaysRemainingTo30th,
  getMonth30thLabel,
  isBorderlineNplAccount,
  isCrossing91DpdCritical,
  isWorstCategory,
  normalizeContractNo,
  normalizeEvaluableFromAers,
} from '../utils/recoveryEngine';
import { useCountUp } from '../hooks/useCountUp';

interface KpiStripProps {
  aersRecords: AersRecord[];
  aersMeta?: AersMetadata | null;
  mrpMap?: Map<string, MrpEnrichment>;
  isFilteredOfficer?: boolean;
  animKey?: number;
}

export function KpiStrip({
  aersRecords = [],
  aersMeta = null,
  mrpMap,
  isFilteredOfficer = false,
  animKey = 0,
}: KpiStripProps) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (totalSecs: number) => {
    const days = Math.floor(totalSecs / (3600 * 24));
    const hours = Math.floor((totalSecs % (3600 * 24)) / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${days}d ${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  };

  const daysTo30th = getDaysRemainingTo30th();
  const month30thLabel = getMonth30thLabel();

  const emptySet = useMemo(() => new Set<string>(), []);

  const evaluableItems = useMemo(
    () => normalizeEvaluableFromAers(aersRecords, emptySet, mrpMap),
    [aersRecords, emptySet, mrpMap],
  );

  const outcome = useMemo(
    () => analyzeNextMonthBorderline(evaluableItems),
    [evaluableItems],
  );

  const metrics = useMemo(() => {
    // Reconcile Opening NPL and Closing NPL strictly with BM Dashboard (OP_NPL > 0 and NPL > 0)
    const openingNplContracts = aersRecords.filter((r) => (r.opNpl || 0) > 0);
    const closingNplContracts = aersRecords.filter((r) => (r.npl || 0) > 0);

    const totalOpNpl = aersRecords.reduce((sum, r) => sum + (r.opNpl || 0), 0);
    const totalClosingNpl = aersRecords.reduce((sum, r) => sum + (r.npl || 0), 0);
    const openingNplCount = openingNplContracts.length;
    const closingNplCount = closingNplContracts.length;

    const worstCount = aersRecords.filter((r) =>
      isWorstCategory(r.nplReason, r.worstCaseProduct),
    ).length;

    const borderlineContracts = aersRecords.filter((r) =>
      isBorderlineNplAccount(r, mrpMap?.get(normalizeContractNo(r.contractNo))),
    );
    const borderlineProjectedNplExposure = borderlineContracts.reduce(
      (sum, r) => sum + getCapitalNplExposure(r),
      0,
    );
    const crossing91Count = borderlineContracts.filter((r) =>
      isCrossing91DpdCritical({
        actualDpd: r.actualDpd,
        monthEndForecastDpd: r.monthEndForecastDpd,
      } as never),
    ).length;

    // Below 1 (<= 1.00) 90 Ratio — use full branch BM snapshot when viewing entire branch
    const bm = !isFilteredOfficer ? aersMeta?.bmBranchSnapshot : undefined;
    const totalPortfolioCount =
      bm?.totalContracts ??
      (bm?.ageBuckets?.reduce((s, b) => s + b.count, 0) || aersRecords.length);
    const belowOneCount =
      bm?.belowOneCount ??
      (bm?.ageBuckets
        ? (bm.ageBuckets[0]?.count || 0) + (bm.ageBuckets[1]?.count || 0)
        : aersRecords.filter((r) => (r.currentAge || 0) <= 1.0).length);
    const ratio90Pct =
      totalPortfolioCount > 0
        ? Math.round((belowOneCount / totalPortfolioCount) * 1000) / 10
        : 0;
    const neededFor90 = Math.max(
      0,
      Math.ceil(totalPortfolioCount * 0.9) - belowOneCount,
    );

    const netNplMovement = totalClosingNpl - totalOpNpl;
    const netCountDelta = closingNplCount - openingNplCount;
    const movementImproved = netNplMovement <= 0;

    return {
      openingNplCount,
      closingNplCount,
      totalOpNpl,
      totalClosingNpl,
      worstCount,
      borderlineCount: borderlineContracts.length,
      borderlineProjectedNplExposure,
      crossing91Count,
      totalPortfolioCount,
      belowOneCount,
      ratio90Pct,
      neededFor90,
      netNplMovement,
      netCountDelta,
      movementImproved,
    };
  }, [aersRecords, aersMeta, mrpMap, isFilteredOfficer]);

  const animatedClosingNpl = useCountUp(metrics.totalClosingNpl, 900, animKey);
  const animatedBorderline = useCountUp(metrics.borderlineProjectedNplExposure, 900, animKey);
  const animatedMovement = useCountUp(metrics.netNplMovement, 900, animKey);

  return (
    <section
      aria-label="Opening vs Closing NPL, Borderline and 90 Ratio Metrics"
      className="space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 tabular-nums font-mono">
          MONTH-END COUNTDOWN: {formatCountdown(secondsLeft)}
        </span>

        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
          BM-Reconciled NPL · Op {metrics.openingNplCount} accts ({formatCompactRs(metrics.totalOpNpl)}) → Close {metrics.closingNplCount} accts ({formatCompactRs(metrics.totalClosingNpl)})
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* KPI 1: Closing NPL Portfolio (Exact BM Match) */}
        <div
          style={{ animationDelay: '50ms' }}
          className="animate-fade-slide-up bg-gradient-to-br from-emerald-900 via-emerald-950 to-slate-950 text-white rounded-2xl p-5 shadow-md border border-emerald-800/60"
        >
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-emerald-300">
            <span>Closing NPL (Exact BM Total)</span>
            <AlertTriangle className="w-4 h-4 text-emerald-400 shrink-0" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-white tabular-nums font-mono">
            {formatCurrencyRs(animatedClosingNpl)}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-emerald-200/90 tabular-nums">
            <span>
              <strong className="font-mono text-white">{metrics.closingNplCount}</strong> NPL accts · {metrics.worstCount} Worst (W)
            </span>
            <span className="font-mono text-[11px] text-emerald-300">
              Op: {metrics.openingNplCount} ({formatCompactRs(metrics.totalOpNpl)})
            </span>
          </div>
        </div>

        {/* KPI 2: Borderline NPL at Risk */}
        <div
          style={{ animationDelay: '100ms' }}
          className="animate-fade-slide-up bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs"
        >
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Borderline NPL Risk (Cap+Arr)</span>
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-amber-700 dark:text-amber-400 tabular-nums font-mono">
            {formatCurrencyRs(animatedBorderline)}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            <strong className="font-mono text-slate-800 dark:text-slate-200">{metrics.borderlineCount}</strong> accts ({metrics.crossing91Count} → 91 by {month30thLabel}) · {daysTo30th}d left
          </p>
        </div>

        {/* KPI 3: Below 1 (<= 1.00) 90 Ratio */}
        <div
          style={{ animationDelay: '150ms' }}
          className="animate-fade-slide-up bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs"
        >
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Below 1 (≤ 1.00) · 90 Ratio</span>
            <Target className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          </div>
          <p
            className={`mt-2 text-2xl font-bold tracking-tight tabular-nums font-mono ${
              metrics.ratio90Pct >= 90
                ? 'text-emerald-700 dark:text-emerald-400'
                : metrics.ratio90Pct >= 80
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-blue-700 dark:text-blue-400'
            }`}
          >
            {metrics.ratio90Pct.toFixed(1)}%
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            <strong className="font-mono text-slate-800 dark:text-slate-200">
              {metrics.belowOneCount.toLocaleString()}
            </strong>
            /{metrics.totalPortfolioCount.toLocaleString()} accts ·{' '}
            {metrics.neededFor90 > 0
              ? `Need +${metrics.neededFor90} for 90%`
              : '90% Target Met'}
          </p>
        </div>

        {/* KPI 4: Opening vs Closing NPL Movement */}
        <div
          style={{ animationDelay: '200ms' }}
          className="animate-fade-slide-up bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs"
        >
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Net NPL Movement (Op → Close)</span>
            {metrics.movementImproved ? (
              <ArrowDownRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <ArrowUpRight className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            )}
          </div>
          <p
            className={`mt-2 text-2xl font-bold tracking-tight tabular-nums font-mono ${
              metrics.movementImproved
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-red-700 dark:text-red-400'
            }`}
          >
            {metrics.netNplMovement > 0 ? '+' : ''}
            {formatCurrencyRs(animatedMovement)}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Count: {metrics.openingNplCount} → {metrics.closingNplCount} (
            {metrics.netCountDelta > 0 ? `+${metrics.netCountDelta}` : metrics.netCountDelta})
            {outcome.borderSavedCount > 0
              ? ` · Saved ${outcome.borderSavedCount}`
              : ''}
          </p>
        </div>
      </div>
    </section>
  );
}
