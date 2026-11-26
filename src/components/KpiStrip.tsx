import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import type {
  AersRecord,
  MrpEnrichment,
  TrackedContract,
} from '../types/recovery';
import {
  analyzeNextMonthBorderline,
  formatCompactRs,
  formatCurrencyRs,
  getCapitalNplExposure,
  getDaysRemainingTo30th,
  getMonth30thLabel,
  getSavedNplCapitalValue,
  isBorderlineNplAccount,
  isCrossing91DpdCritical,
  isCurrentNplAccount,
  isNplSavedAccount,
  isWorstCategory,
  normalizeContractNo,
  normalizeEvaluableFromAers,
  normalizeEvaluableFromTracked,
} from '../utils/recoveryEngine';
import { useCountUp } from '../hooks/useCountUp';

interface KpiStripProps {
  contracts: TrackedContract[];
  aersRecords?: AersRecord[];
  mrpMap?: Map<string, MrpEnrichment>;
  animKey?: number;
}

export function KpiStrip({
  contracts,
  aersRecords = [],
  mrpMap,
  animKey = 0,
}: KpiStripProps) {
  const [scope, setScope] = useState<'aers' | 'tracked'>(
    aersRecords.length > 0 ? 'aers' : 'tracked',
  );

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

  const effectiveScope: 'aers' | 'tracked' =
    scope === 'aers' && aersRecords.length > 0 ? 'aers' : 'tracked';

  const daysTo30th = getDaysRemainingTo30th();
  const month30thLabel = getMonth30thLabel();

  const trackedNos = useMemo(
    () => new Set(contracts.map((c) => normalizeContractNo(c.contractNo))),
    [contracts],
  );

  const evaluableItems = useMemo(() => {
    if (effectiveScope === 'aers' && aersRecords.length > 0) {
      return normalizeEvaluableFromAers(aersRecords, trackedNos, mrpMap);
    }
    return normalizeEvaluableFromTracked(contracts);
  }, [effectiveScope, aersRecords, trackedNos, mrpMap, contracts]);

  const outcome = useMemo(
    () => analyzeNextMonthBorderline(evaluableItems),
    [evaluableItems],
  );

  const metrics = useMemo(() => {
    const sourceList =
      effectiveScope === 'aers' && aersRecords.length > 0
        ? aersRecords.map((r) => ({
            contractNo: r.contractNo,
            npl: r.npl || 0,
            opNpl: r.opNpl || 0,
            actualDpd: r.actualDpd || 0,
            opAge: r.opAge || 0,
            currentAge: r.currentAge || 0,
            monthEndForecastDpd: r.monthEndForecastDpd || 0,
            capitalOutstanding: r.capitalOutstanding || 0,
            opCapitalOutstanding: r.opCapitalOutstanding || 0,
            capitalArrears: r.capitalArrears || 0,
            closingDebtor: r.closingDebtor || 0,
            totalCollection: r.totalCollection || 0,
            lastPaidAmount: r.lastPaidAmount || 0,
            nplReason: r.nplReason || '',
            worstCaseProduct: r.worstCaseProduct || '',
            nplSavedAmount: 0,
            mrp: mrpMap?.get(normalizeContractNo(r.contractNo)),
            currentSituation: undefined,
          }))
        : contracts.map((c) => ({
            contractNo: c.contractNo,
            npl: c.npl || 0,
            opNpl: c.opNpl || 0,
            actualDpd: c.actualDpd || 0,
            opAge: c.opAge || 0,
            currentAge: c.currentAge || 0,
            monthEndForecastDpd: c.monthEndForecastDpd || 0,
            capitalOutstanding: c.capitalOutstanding || 0,
            opCapitalOutstanding: c.opCapitalOutstanding || 0,
            capitalArrears: c.capitalArrears || 0,
            closingDebtor: c.closingDebtor || 0,
            totalCollection: c.totalCollection || 0,
            lastPaidAmount: c.lastPaidAmount || 0,
            nplReason: c.nplReason || '',
            worstCaseProduct: c.worstCaseProduct || '',
            nplSavedAmount: c.nplSavedAmount || 0,
            mrp: c.mrp ?? mrpMap?.get(normalizeContractNo(c.contractNo)),
            currentSituation: c.currentSituation,
          }));

    const currentNplContracts = sourceList.filter((c) => isCurrentNplAccount(c));
    const currentNplExposure = currentNplContracts.reduce(
      (sum, c) => sum + getCapitalNplExposure(c),
      0,
    );
    const current91PlusCapOs = currentNplContracts
      .filter((c) => c.actualDpd >= 91)
      .reduce(
        (sum, c) =>
          sum + (c.capitalOutstanding || 0) + (c.capitalArrears || 0),
        0,
      );
    const worstCount = currentNplContracts.filter((c) =>
      isWorstCategory(c.nplReason, c.worstCaseProduct),
    ).length;

    const borderlineContracts = sourceList.filter((c) =>
      isBorderlineNplAccount(c, c.mrp),
    );
    const borderlineProjectedNplExposure = borderlineContracts.reduce(
      (sum, c) => sum + getCapitalNplExposure(c),
      0,
    );
    const borderlineDebtorExposure = borderlineContracts.reduce(
      (sum, c) => sum + (c.closingDebtor || 0),
      0,
    );
    const crossing91Count = borderlineContracts.filter((c) =>
      isCrossing91DpdCritical({
        actualDpd: c.actualDpd,
        monthEndForecastDpd: c.monthEndForecastDpd,
      } as TrackedContract),
    ).length;

    const nplSavedContracts = sourceList.filter((c) => isNplSavedAccount(c));
    const nplSavedAmount = nplSavedContracts.reduce(
      (sum, c) => sum + getSavedNplCapitalValue(c),
      0,
    );

    const totalOpNpl = sourceList.reduce((sum, c) => sum + (c.opNpl || 0), 0);
    const totalCurrentNpl = sourceList.reduce((sum, c) => sum + (c.npl || 0), 0);
    const netNplMovement = totalCurrentNpl - totalOpNpl;
    const movementImproved = netNplMovement <= 0;
    const movementPct =
      totalOpNpl > 0 ? (netNplMovement / totalOpNpl) * 100 : 0;

    return {
      currentNplContracts,
      currentNplExposure,
      current91PlusCapOs,
      worstCount,
      borderlineContracts,
      borderlineProjectedNplExposure,
      borderlineDebtorExposure,
      crossing91Count,
      nplSavedContracts,
      nplSavedAmount,
      totalOpNpl,
      totalCurrentNpl,
      netNplMovement,
      movementImproved,
      movementPct,
    };
  }, [effectiveScope, aersRecords, contracts, mrpMap]);

  const animatedCurrentNpl = useCountUp(metrics.currentNplExposure, 1200, animKey);
  const animatedBorderline = useCountUp(metrics.borderlineProjectedNplExposure, 1200, animKey);
  const animatedSaved = useCountUp(metrics.nplSavedAmount, 1200, animKey);
  const animatedMovement = useCountUp(metrics.netNplMovement, 1200, animKey);

  return (
    <section
      aria-label="Current NPL and Borderline Key Metrics"
      className="space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            LIVE TELEMETRY · MONTH-END CUTDOWN: {formatCountdown(secondsLeft)}
          </span>
        </div>

        {aersRecords.length > 0 && (
          <div className="inline-flex items-center gap-1 p-0.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 rounded-lg shadow-xs">
            <button
              type="button"
              onClick={() => setScope('aers')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                effectiveScope === 'aers'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Full AERS ({aersRecords.length})
            </button>
            <button
              type="button"
              onClick={() => setScope('tracked')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                effectiveScope === 'tracked'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Watchlist ({contracts.length})
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* KPI 1: Current NPL Portfolio */}
        <div
          style={{ animationDelay: '50ms' }}
          className="animate-fade-slide-up animate-border-glow bg-gradient-to-br from-emerald-900 via-emerald-950 to-slate-950 text-white rounded-2xl p-5 shadow-xl shadow-emerald-950/20 border border-emerald-800/60 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/10 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
          <div className="absolute bottom-0 left-0 right-0 h-6 overflow-hidden pointer-events-none opacity-25">
            <svg className="absolute bottom-0 w-[200%] h-full animate-wave-flow" viewBox="0 0 1200 120" preserveAspectRatio="none">
              <path d="M0,0 C150,90 350,-40 500,40 C650,120 900,10 1200,30 L1200,120 L0,120 Z" fill="currentColor" className="text-emerald-400" />
            </svg>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-emerald-300">
            <span>Current NPL Portfolio</span>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-800/80 text-emerald-100 border border-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active 91+
              </span>
              <AlertTriangle className="w-4 h-4 text-emerald-400 shrink-0" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-white tabular-nums font-mono">
            {formatCurrencyRs(animatedCurrentNpl)}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-emerald-200/80 tabular-nums">
              {metrics.currentNplContracts.length}{' '}
              {metrics.currentNplContracts.length === 1 ? 'account' : 'accounts'}
              <span aria-hidden="true"> · </span>
              Cap+Arr {formatCompactRs(metrics.current91PlusCapOs)}
            </p>
            <svg className="w-16 h-5 text-emerald-400/60" viewBox="0 0 64 20" fill="none">
              <path
                d="M2 15C12 12 18 16 28 9C38 2 48 11 62 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* KPI 2: Borderline NPL at Risk */}
        <div
          style={{ animationDelay: '100ms' }}
          className="animate-fade-slide-up animate-border-glow bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-lg shadow-slate-900/5 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
          <div className="absolute bottom-0 left-0 right-0 h-6 overflow-hidden pointer-events-none opacity-20">
            <svg className="absolute bottom-0 w-[200%] h-full animate-wave-flow" viewBox="0 0 1200 120" preserveAspectRatio="none">
              <path d="M0,0 C150,90 350,-40 500,40 C650,120 900,10 1200,30 L1200,120 L0,120 Z" fill="currentColor" className="text-amber-500" />
            </svg>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Borderline NPL at Risk (Cap+Arr)</span>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                Danger Zone
              </span>
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-amber-700 dark:text-amber-400 tabular-nums font-mono">
            {formatCurrencyRs(animatedBorderline)}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {metrics.borderlineContracts.length} accts ({metrics.crossing91Count}{' '}
              → 91 by {month30thLabel}) · {daysTo30th}d left
            </p>
            <svg className="w-16 h-5 text-amber-500/60" viewBox="0 0 64 20" fill="none">
              <path
                d="M2 14C12 16 20 8 30 12C40 16 50 5 62 8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* KPI 3: NPL Saved This Month */}
        <div
          style={{ animationDelay: '150ms' }}
          className="animate-fade-slide-up animate-border-glow bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-lg shadow-slate-900/5 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
          <div className="absolute bottom-0 left-0 right-0 h-6 overflow-hidden pointer-events-none opacity-20">
            <svg className="absolute bottom-0 w-[200%] h-full animate-wave-flow" viewBox="0 0 1200 120" preserveAspectRatio="none">
              <path d="M0,0 C150,90 350,-40 500,40 C650,120 900,10 1200,30 L1200,120 L0,120 Z" fill="currentColor" className="text-emerald-500" />
            </svg>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>NPL Saved This Month</span>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                +12% Saved
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400 tabular-nums font-mono">
            {formatCurrencyRs(animatedSaved)}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {metrics.nplSavedContracts.length} saved · Border{' '}
              {formatCompactRs(outcome.borderSavedAmount)} · Above-3{' '}
              {formatCompactRs(outcome.above3SavedAmount)}
            </p>
            <svg className="w-16 h-5 text-emerald-500/60" viewBox="0 0 64 20" fill="none">
              <path
                d="M2 18C12 14 20 10 30 7C40 4 50 8 62 2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* KPI 4: Net NPL Movement */}
        <div
          style={{ animationDelay: '200ms' }}
          className="animate-fade-slide-up animate-border-glow bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-lg shadow-slate-900/5 relative overflow-hidden group"
        >
          <div
            className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform ${
              metrics.movementImproved ? 'bg-emerald-500/5' : 'bg-red-500/5'
            }`}
          />
          <div className="absolute bottom-0 left-0 right-0 h-6 overflow-hidden pointer-events-none opacity-20">
            <svg className="absolute bottom-0 w-[200%] h-full animate-wave-flow" viewBox="0 0 1200 120" preserveAspectRatio="none">
              <path d="M0,0 C150,90 350,-40 500,40 C650,120 900,10 1200,30 L1200,120 L0,120 Z" fill="currentColor" className={metrics.movementImproved ? 'text-emerald-500' : 'text-red-500'} />
            </svg>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Net NPL Movement</span>
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full ${
                  metrics.movementImproved
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    metrics.movementImproved ? 'bg-emerald-600' : 'bg-red-600'
                  } animate-pulse`}
                />
                {metrics.movementImproved ? 'Decreased' : 'Increased'}
              </span>
              {metrics.movementImproved ? (
                <ArrowDownRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <ArrowUpRight className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
              )}
            </div>
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
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              Op {formatCompactRs(metrics.totalOpNpl)} → Cur{' '}
              {formatCompactRs(metrics.totalCurrentNpl)}
              {outcome.movedToNplCount > 0
                ? ` · Moved ${outcome.movedToNplCount}`
                : ''}
            </p>
            <svg
              className={`w-16 h-5 ${
                metrics.movementImproved ? 'text-emerald-500/60' : 'text-red-500/60'
              }`}
              viewBox="0 0 64 20"
              fill="none"
            >
              <path
                d={metrics.movementImproved ? 'M2 4C12 8 20 12 30 15C40 18 50 12 62 16' : 'M2 16C12 12 20 8 30 5C40 2 50 10 62 4'}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
