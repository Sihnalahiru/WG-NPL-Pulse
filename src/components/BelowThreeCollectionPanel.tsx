import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Info,
  Layers,
  PhoneCall,
  Search,
  Target,
  TrendingDown,
  TrendingUp,
  Upload,
  Users,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  AersMetadata,
  AersRecord,
  BelowThreeCollectionSnapshot,
  MrpEnrichment,
} from '../types/recovery';
import {
  formatCompactRs,
  formatCurrencyRs,
  normalizeContractNo,
  reconcileBelowThreeFromBmSnapshot,
} from '../utils/recoveryEngine';
import { PaymentPatternStrip } from './PaymentPatternStrip';
import { UserAvatar } from './UserAvatar';

interface BelowThreeCollectionPanelProps {
  aersRecords: AersRecord[];
  aersMeta: AersMetadata | null;
  mrpMap?: Map<string, MrpEnrichment>;
  isDark: boolean;
  isAdmin?: boolean;
  onUploadWorkbook?: (file: File) => void;
}

type TargetPresetMode = 'full_due' | 'target_32m' | 'target_25m' | 'target_20m' | 'custom';

const TARGET_MODE_STORAGE_KEY = 'wg_below3_target_mode_v2';
const CUSTOM_TARGET_M_STORAGE_KEY = 'wg_below3_custom_target_m_v1';

export function BelowThreeCollectionPanel({
  aersRecords,
  aersMeta,
  mrpMap,
  isDark,
  isAdmin,
  onUploadWorkbook,
}: BelowThreeCollectionPanelProps) {
  const [selectedOfficer, setSelectedOfficer] = useState<string>('ALL');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'RO' | 'MO'>('ALL');
  const [chartMode, setChartMode] = useState<'amount' | 'variance' | 'contracts'>('amount');
  const [statusFilter, setStatusFilter] = useState<'all' | 'not_paid' | 'partial' | 'paid'>('not_paid');
  const [ageBandFilter, setAgeBandFilter] = useState<'all' | 'below1' | 'age1to2' | 'age2to3'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(30);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const [targetMode, setTargetMode] = useState<TargetPresetMode>(() => {
    try {
      const saved = window.localStorage.getItem(TARGET_MODE_STORAGE_KEY);
      if (
        saved === 'full_due' ||
        saved === 'target_32m' ||
        saved === 'target_25m' ||
        saved === 'target_20m' ||
        saved === 'custom'
      ) {
        return saved;
      }
    } catch {
      // ignore storage access issues
    }
    return 'full_due';
  });

  const [customTargetM, setCustomTargetM] = useState<string>(() => {
    try {
      const saved = window.localStorage.getItem(CUSTOM_TARGET_M_STORAGE_KEY);
      if (saved && Number.isFinite(Number(saved)) && Number(saved) >= 1) {
        return saved;
      }
    } catch {
      // ignore
    }
    return '22';
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(TARGET_MODE_STORAGE_KEY, targetMode);
    } catch {
      // ignore
    }
  }, [targetMode]);

  useEffect(() => {
    const parsed = Number(customTargetM);
    if (Number.isFinite(parsed) && parsed >= 1) {
      try {
        window.localStorage.setItem(CUSTOM_TARGET_M_STORAGE_KEY, customTargetM);
      } catch {
        // ignore
      }
    }
  }, [customTargetM]);

  const bm = aersMeta?.bmBranchSnapshot;

  // Full Below-3 dataset:
  // 1) Prefer stored `bmBranchSnapshot.belowThreeSummary` (parsed directly from BM Dashboard sheet + full AERS workbook)
  // 2) Otherwise reconcile mathematically from `bmBranchSnapshot.roPerformance + moPerformance` minus exact >=3.00 AERS rows
  const snapshot = useMemo<BelowThreeCollectionSnapshot>(() => {
    if (bm?.belowThreeSummary && bm.belowThreeSummary.totalCount > 0) {
      return bm.belowThreeSummary;
    }
    return reconcileBelowThreeFromBmSnapshot(aersRecords, bm);
  }, [bm, aersRecords]);

  const isFromBmDashboardSheet = snapshot.source === 'bm_dashboard_sheet';
  const isBmReconciledSnapshot = snapshot.source === 'bm_reconciled_snapshot';

  // When exact BM Dashboard sheet Below-3 data arrives, automatically align tracker to BM Sheet Target
  useEffect(() => {
    if (isFromBmDashboardSheet) {
      setTargetMode('full_due');
    }
  }, [isFromBmDashboardSheet, snapshot.bmSheetTargetAmount]);

  // Active Monthly Target benchmark (BM Dashboard Below-3 Target default, or optional 32M / 25M / 20M / Custom comparisons)
  const activeBranchTarget = useMemo(() => {
    if (targetMode === 'target_20m') {
      return { amount: 20_000_000, label: 'Rs. 20M Floor Benchmark', shortLabel: '20M Floor' };
    }
    if (targetMode === 'target_25m') {
      return { amount: 25_000_000, label: 'Rs. 25M Stretch Benchmark', shortLabel: '25M Stretch' };
    }
    if (targetMode === 'target_32m') {
      return { amount: 32_000_000, label: 'Rs. 32M Plan Benchmark', shortLabel: '32M Plan' };
    }
    if (targetMode === 'custom') {
      const m = Math.max(1, Number(customTargetM) || 32);
      return {
        amount: Math.round(m * 1_000_000),
        label: `Rs. ${m.toFixed(m % 1 === 0 ? 0 : 1)}M Custom Target`,
        shortLabel: `${m.toFixed(m % 1 === 0 ? 0 : 1)}M Custom`,
      };
    }
    return {
      amount: snapshot.dueAmount,
      label: isFromBmDashboardSheet
        ? `BM Dashboard Below-3 Target (${snapshot.bmSheetName || 'BM Dashboard'})`
        : 'Branch Below-3 Monthly Target (BM Portfolio)',
      shortLabel: isFromBmDashboardSheet ? 'BM Sheet Target' : 'Branch Below-3',
    };
  }, [
    targetMode,
    customTargetM,
    snapshot.dueAmount,
    snapshot.bmSheetName,
    isFromBmDashboardSheet,
  ]);

  // Officer-wise target allocation, variance vs. target, and visual performance tiers
  const evaluatedOfficers = useMemo(() => {
    const totalDue = snapshot.dueAmount > 0
      ? snapshot.dueAmount
      : snapshot.byOfficer.reduce((s, o) => s + o.dueAmount, 0);
    const officerCount = Math.max(1, snapshot.byOfficer.length);

    return snapshot.byOfficer
      .map((o) => {
        const portfolioShare = totalDue > 0 ? o.dueAmount / totalDue : 1 / officerCount;
        const targetAmount =
          targetMode === 'full_due'
            ? o.dueAmount
            : Math.round(activeBranchTarget.amount * portfolioShare);
        const targetVariance = Math.round(o.collectedAmount - targetAmount);
        const targetAchPct =
          targetAmount > 0
            ? Math.round((o.collectedAmount / targetAmount) * 1000) / 10
            : 0;
        const contributionTo20MPct =
          Math.round((o.collectedAmount / 20_000_000) * 1000) / 10;

        const avgDue =
          o.avgDuePerUnpaid > 0
            ? o.avgDuePerUnpaid
            : o.totalCount > 0
              ? o.dueAmount / o.totalCount
              : 0;
        const targetShortfall = Math.max(0, -targetVariance);
        const contractsNeededForTarget =
          targetMode === 'full_due'
            ? o.contractsNeededAgainstDue
            : targetShortfall <= 0
              ? 0
              : avgDue > 0
                ? Math.min(
                    Math.max(o.notPaidCount + o.partialPaidCount, 1),
                    Math.ceil(targetShortfall / avgDue),
                  )
                : o.unpaidWithDueCount;

        const perfTier: 'exceeded' | 'near' | 'behind' =
          targetAchPct >= 100 ? 'exceeded' : targetAchPct >= 85 ? 'near' : 'behind';

        return {
          ...o,
          portfolioSharePct: Math.round(portfolioShare * 1000) / 10,
          targetAmount,
          targetVariance,
          targetAchPct,
          contributionTo20MPct,
          contractsNeededForTarget,
          perfTier,
        };
      })
      .sort((a, b) => a.targetVariance - b.targetVariance);
  }, [snapshot.byOfficer, snapshot.dueAmount, targetMode, activeBranchTarget.amount]);

  const visibleEvaluatedOfficers = useMemo(() => {
    if (roleFilter === 'ALL') return evaluatedOfficers;
    return evaluatedOfficers.filter((o) => (o.role || '').toUpperCase() === roleFilter);
  }, [evaluatedOfficers, roleFilter]);

  const branchTargetStats = useMemo(() => {
    const targetAmount = activeBranchTarget.amount;
    const collectedAmount = snapshot.collectedAmount;
    const targetVariance = Math.round(collectedAmount - targetAmount);
    const targetAchPct =
      targetAmount > 0 ? Math.round((collectedAmount / targetAmount) * 1000) / 10 : 0;
    const contractsNeededForTarget = evaluatedOfficers.reduce(
      (s, o) => s + o.contractsNeededForTarget,
      0,
    );
    const exceededCount = evaluatedOfficers.filter((o) => o.perfTier === 'exceeded').length;
    const nearCount = evaluatedOfficers.filter((o) => o.perfTier === 'near').length;
    const behindCount = evaluatedOfficers.filter((o) => o.perfTier === 'behind').length;
    const surplusVs20M = Math.round(collectedAmount - 20_000_000);
    const achVs20MPct = Math.round((collectedAmount / 20_000_000) * 1000) / 10;

    return {
      targetAmount,
      collectedAmount,
      targetVariance,
      targetAchPct,
      contractsNeededForTarget,
      exceededCount,
      nearCount,
      behindCount,
      surplusVs20M,
      achVs20MPct,
    };
  }, [activeBranchTarget.amount, snapshot.collectedAmount, evaluatedOfficers]);

  // Scoped metrics when an individual officer is selected vs Branch Total
  const activeOfficerRow = useMemo(() => {
    if (selectedOfficer === 'ALL') return null;
    return evaluatedOfficers.find((o) => o.officer === selectedOfficer) ?? null;
  }, [evaluatedOfficers, selectedOfficer]);

  const activeTotals = useMemo(() => {
    if (activeOfficerRow) {
      return {
        label: `${activeOfficerRow.officer} (${activeOfficerRow.role})`,
        totalCount: activeOfficerRow.totalCount,
        paidCount: activeOfficerRow.paidCount,
        notPaidCount: activeOfficerRow.notPaidCount,
        paidRatioPct: activeOfficerRow.paidRatioPct,
        partialPaidCount: activeOfficerRow.partialPaidCount,
        unpaidWithDueCount: activeOfficerRow.unpaidWithDueCount,
        contractsNeededAgainstDue: activeOfficerRow.contractsNeededAgainstDue,
        contractsNeededForTarget: activeOfficerRow.contractsNeededForTarget,
        dueAmount: activeOfficerRow.dueAmount,
        targetAmount: activeOfficerRow.targetAmount,
        collectedAmount: activeOfficerRow.collectedAmount,
        varianceAmount: activeOfficerRow.targetVariance,
        dueVarianceAmount: activeOfficerRow.varianceAmount,
        collectionPct: activeOfficerRow.targetAchPct,
        dueCollectionPct: activeOfficerRow.collectionPct,
        perfTier: activeOfficerRow.perfTier,
      };
    }
    return {
      label: 'Branch Total (All Officers)',
      totalCount: snapshot.totalCount,
      paidCount: snapshot.paidCount,
      notPaidCount: snapshot.notPaidCount,
      paidRatioPct: snapshot.paidRatioPct,
      partialPaidCount: snapshot.partialPaidCount,
      unpaidWithDueCount: snapshot.unpaidWithDueCount,
      contractsNeededAgainstDue: snapshot.contractsNeededAgainstDue,
      contractsNeededForTarget: branchTargetStats.contractsNeededForTarget,
      dueAmount: snapshot.dueAmount,
      targetAmount: branchTargetStats.targetAmount,
      collectedAmount: snapshot.collectedAmount,
      varianceAmount: branchTargetStats.targetVariance,
      dueVarianceAmount: snapshot.varianceAmount,
      collectionPct: branchTargetStats.targetAchPct,
      dueCollectionPct: snapshot.collectionPct,
      perfTier:
        branchTargetStats.targetAchPct >= 100
          ? ('exceeded' as const)
          : branchTargetStats.targetAchPct >= 85
            ? ('near' as const)
            : ('behind' as const),
    };
  }, [activeOfficerRow, snapshot, branchTargetStats]);

  // Chart data per officer (use Rs. Millions for clean branch-scale readability)
  const officerChartData = useMemo(() => {
    return evaluatedOfficers.map((o) => ({
      officer: o.officer,
      targetM: Number((o.targetAmount / 1_000_000).toFixed(2)),
      dueM: Number((o.dueAmount / 1_000_000).toFixed(2)),
      collectedM: Number((o.collectedAmount / 1_000_000).toFixed(2)),
      varianceM: Number((o.targetVariance / 1_000_000).toFixed(2)),
      collectionPct: o.targetAchPct,
      paidCount: o.paidCount,
      notPaidCount: o.notPaidCount,
      needed: o.contractsNeededForTarget,
      perfTier: o.perfTier,
    }));
  }, [evaluatedOfficers]);

  // Paid vs Not Paid Donut Data
  const paymentSplitPie = useMemo(() => {
    const fullPaid = Math.max(0, activeTotals.paidCount - activeTotals.partialPaidCount);
    return [
      { name: 'Full Paid', value: fullPaid, color: '#059669' },
      { name: 'Partial Paid', value: activeTotals.partialPaidCount, color: '#d97706' },
      { name: 'Not Paid', value: activeTotals.notPaidCount, color: '#b91c1c' },
    ].filter((d) => d.value > 0);
  }, [activeTotals]);

  // Filtered contract drill-down list
  const filteredContracts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return snapshot.contracts.filter((c) => {
      if (selectedOfficer !== 'ALL' && c.officer !== selectedOfficer) return false;
      if (statusFilter === 'not_paid' && c.isPaid) return false;
      if (statusFilter === 'paid' && !c.isPaid) return false;
      if (statusFilter === 'partial' && !(c.isPaid && !c.isFullPaid)) return false;
      if (ageBandFilter === 'below1' && c.currentAge > 1.0) return false;
      if (ageBandFilter === 'age1to2' && (c.currentAge <= 1.0 || c.currentAge >= 2.0)) return false;
      if (ageBandFilter === 'age2to3' && (c.currentAge < 2.0 || c.currentAge >= 3.0)) return false;
      if (q) {
        return (
          c.contractNo.toLowerCase().includes(q) ||
          c.cusName.toLowerCase().includes(q) ||
          c.officer.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [snapshot.contracts, selectedOfficer, statusFilter, ageBandFilter, searchQuery]);

  const displayedContracts = filteredContracts.slice(0, visibleLimit);

  const axisColor = isDark ? '#a1a1aa' : '#52525b';
  const gridColor = isDark ? '#27272a' : '#e4e4e7';
  const tooltipBg = isDark ? '#18181b' : '#ffffff';
  const tooltipBorder = isDark ? '#3f3f46' : '#e4e4e7';

  const varianceIsPositive = activeTotals.varianceAmount >= 0;

  return (
    <div className="space-y-6">
      {/* Executive Commercial Credit Header & Live Variance Banner */}
      <section
        aria-label="Below 3 Collection & Variance Overview"
        className="bg-gradient-to-br from-zinc-900 via-[#1d1719] to-red-950 text-white border border-red-900/40 rounded-2xl p-5 sm:p-6 shadow-lg relative overflow-hidden"
      >
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-red-600 via-amber-500 to-emerald-500" />

        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5 relative z-10">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-red-300">
              <Banknote className="w-4 h-4 text-red-400" />
              Below 3 Collection (&lt; 3.00 Arrears Age) · Monthly Due vs. Variance Control
            </div>
            <h2 className="font-display text-lg sm:text-2xl font-extrabold tracking-tight text-white">
              Below 3 Collection &amp; Payment Variance — {activeTotals.label}
            </h2>
            <p className="text-xs text-zinc-300 leading-relaxed">
              <strong>Below 3 = Arrears Age &lt; 3.00</strong> (0–2.99 ගිණුම් වල මෙම මාසයේ ගෙවීම් ලැබී ඇත්ද සහ Monthly Due එකට සාපේක්ෂව තව කොන්ත්‍රාත් කීයක ගෙවීම් අවශ්‍යද යන්න නිලධාරී අනුව සහ මුළු ශාඛාව අනුව).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0 tabular-nums">
            <div className="px-4 py-3 rounded-xl bg-white/10 border border-white/15 backdrop-blur-md min-w-[175px]">
              <div className="text-[11px] text-zinc-300">20M+ Monthly Target</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span
                  className={`text-xl font-bold font-mono ${
                    branchTargetStats.surplusVs20M >= 0 ? 'text-emerald-300' : 'text-red-300'
                  }`}
                >
                  {branchTargetStats.achVs20MPct.toFixed(1)}%
                </span>
                <span className="text-[11px] font-mono text-zinc-200">
                  {branchTargetStats.surplusVs20M >= 0 ? 'Exceeded' : 'Shortfall'}
                </span>
              </div>
              <div
                className={`text-[10px] font-mono mt-0.5 ${
                  branchTargetStats.surplusVs20M >= 0 ? 'text-emerald-300' : 'text-red-300'
                }`}
              >
                {branchTargetStats.surplusVs20M >= 0 ? '+' : ''}
                {formatCompactRs(branchTargetStats.surplusVs20M)} vs 20M
              </div>
            </div>

            <div className="px-4 py-3 rounded-xl bg-white/10 border border-white/15 backdrop-blur-md min-w-[185px]">
              <div className="text-[11px] text-zinc-300">
                Variance ({activeBranchTarget.shortLabel})
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span
                  className={`text-xl font-bold font-mono ${
                    varianceIsPositive ? 'text-emerald-300' : 'text-amber-300'
                  }`}
                >
                  {varianceIsPositive ? '+' : ''}
                  {formatCompactRs(activeTotals.varianceAmount)}
                </span>
              </div>
              <div className="text-[10px] text-zinc-300 font-mono mt-0.5">
                {activeTotals.contractsNeededForTarget === 0
                  ? '✓ Target achieved'
                  : `${activeTotals.contractsNeededForTarget.toLocaleString()} contracts needed`}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BM Dashboard Sheet Sync & Source Status Strip */}
      {isFromBmDashboardSheet ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-900 dark:text-emerald-200">
          <div className="flex items-start gap-2.5">
            <FileSpreadsheet className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <strong>Synced directly from &ldquo;{snapshot.bmSheetName || 'BM Dashboard'}&rdquo; Sheet:</strong>{' '}
              Target <strong className="font-mono">{formatCompactRs(snapshot.dueAmount)}</strong> · Collected{' '}
              <strong className="font-mono">{formatCompactRs(snapshot.collectedAmount)}</strong> ({snapshot.collectionPct.toFixed(1)}%)
              {snapshot.aersDueAmount && snapshot.aersDueAmount !== snapshot.dueAmount ? (
                <span className="ml-2 text-emerald-700/80 dark:text-emerald-300/80">
                  (AERS &lt;3.00 Due Budget: {formatCompactRs(snapshot.aersDueAmount)} · Coll: {formatCompactRs(snapshot.aersCollectedAmount || 0)})
                </span>
              ) : null}
            </div>
          </div>
          {onUploadWorkbook && (
            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-[11px] transition-colors shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              Re-Sync Excel
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/70 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-start gap-2.5 max-w-4xl">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div>
              <strong>
                {isBmReconciledSnapshot
                  ? `BM Branch Portfolio Reconciled (All ${snapshot.totalCount.toLocaleString()} Below-3 Accounts):`
                  : 'Sync Exact BM Dashboard Sheet:'}
              </strong>{' '}
              Showing exact Full-Branch Below-3 Due Budget ({formatCompactRs(snapshot.dueAmount)}) &amp; Collection ({formatCompactRs(snapshot.collectedAmount)}) across{' '}
              <strong className="font-mono">{snapshot.totalCount.toLocaleString()}</strong> contracts. Upload your{' '}
              <strong className="font-mono">WG_MRP</strong> Excel file once to pull the exact{' '}
              <strong>BM Dashboard sheet</strong> Below-3 Target (e.g. Rs. 32M+) &amp; exact contract-level Paid / Not-Paid counts directly from the worksheet.
            </div>
          </div>
          {onUploadWorkbook && (
            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white font-semibold text-[11px] shadow-xs transition-colors shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              {isAdmin ? 'Sync BM Dashboard Excel' : 'Unlock Admin & Sync Excel'}
            </button>
          )}
        </div>
      )}

      {onUploadWorkbook && (
        <input
          ref={uploadInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              onUploadWorkbook(file);
              e.target.value = '';
            }
          }}
        />
      )}

      {/* Interactive Monthly Target Benchmark (BM Dashboard Below-3 Target) & Milestone Tracker */}
      <section
        aria-label="Monthly Target Benchmark and Variance Progress"
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 tabular-nums"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Target className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Monthly Target Benchmark &amp; Variance Tracker
              </h3>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                  isFromBmDashboardSheet
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                }`}
              >
                {isFromBmDashboardSheet
                  ? `Exact "${snapshot.bmSheetName || 'BM Dashboard'}" Below-3 Report`
                  : 'Reconciled BM Portfolio (Upload Excel for Exact BM Sheet Bottom Table)'}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Tracks exact Below-3 Collection against the BM Dashboard sheet Below-3 target ({formatCompactRs(snapshot.dueAmount)}) with officer-wise actual variance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 max-w-full">
            <div
              role="group"
              aria-label="Select Monthly Target Benchmark"
              className="inline-flex max-w-full overflow-x-auto no-scrollbar items-center gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
            >
              {(
                [
                  {
                    id: 'full_due',
                    label: isFromBmDashboardSheet ? 'BM Sheet Target' : 'Branch Below-3',
                  },
                  { id: 'target_32m', label: '32M Plan' },
                  { id: 'target_25m', label: '25M Stretch' },
                  { id: 'target_20m', label: '20M Floor' },
                  { id: 'custom', label: 'Custom' },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setTargetMode(preset.id)}
                  className={`min-h-[34px] px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    targetMode === preset.id
                      ? 'bg-red-700 text-white shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {targetMode === 'custom' && (
              <div className="inline-flex items-center gap-1.5 text-xs">
                <label htmlFor="custom-target-m" className="text-zinc-500 dark:text-zinc-400 font-medium whitespace-nowrap">
                  Rs.
                </label>
                <input
                  id="custom-target-m"
                  type="number"
                  min={1}
                  max={200}
                  step={0.5}
                  value={customTargetM}
                  onChange={(e) => setCustomTargetM(e.target.value)}
                  className="w-20 px-2 py-1 text-xs font-mono font-bold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-600"
                />
                <span className="text-zinc-500 dark:text-zinc-400 font-mono">M</span>
              </div>
            )}
          </div>
        </div>

        {/* Visual Milestone Gauge */}
        {(() => {
          const maxScale = Math.max(
            snapshot.dueAmount * 1.05,
            activeBranchTarget.amount * 1.05,
            snapshot.collectedAmount * 1.05,
            25_000_000,
          );
          const collectedPctBar = Math.min(100, (snapshot.collectedAmount / maxScale) * 100);
          const m20Pos = Math.min(98, (20_000_000 / maxScale) * 100);
          const bmTargetPos = Math.min(98, (snapshot.dueAmount / maxScale) * 100);
          const activeTargetPos = Math.min(99, (activeBranchTarget.amount / maxScale) * 100);

          return (
            <div className="space-y-2.5 pt-1">
              <div className="relative h-4 w-full rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 overflow-visible">
                <div
                  className={`h-full rounded-lg transition-all duration-300 ${
                    branchTargetStats.targetAchPct >= 100
                      ? 'bg-emerald-600'
                      : branchTargetStats.targetAchPct >= 85
                        ? 'bg-amber-500'
                        : 'bg-red-700'
                  }`}
                  style={{ width: `${collectedPctBar}%` }}
                />

                {/* 20M Reference Tick */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-zinc-900/60 dark:bg-white/60"
                  style={{ left: `${m20Pos}%` }}
                  title="Rs. 20M Milestone Reference"
                />
                {/* BM Below-3 Target Tick */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-zinc-500/70 dark:bg-zinc-400/70"
                  style={{ left: `${bmTargetPos}%` }}
                  title={`BM Below-3 Target: ${formatCompactRs(snapshot.dueAmount)}`}
                />
                {/* Active Selected Target Pin */}
                <div
                  className="absolute -top-1 -bottom-1 w-1 rounded-full bg-red-600 dark:bg-red-400 ring-2 ring-white dark:ring-zinc-900"
                  style={{ left: `${activeTargetPos}%` }}
                  title={`${activeBranchTarget.label}: ${formatCompactRs(activeBranchTarget.amount)}`}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-zinc-600 dark:text-zinc-400">
                  <span>
                    Actual:{' '}
                    <strong className="font-mono text-zinc-900 dark:text-zinc-100">
                      {formatCompactRs(snapshot.collectedAmount)}
                    </strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Selected ({activeBranchTarget.shortLabel}):{' '}
                    <strong className="font-mono text-zinc-900 dark:text-zinc-100">
                      {formatCompactRs(branchTargetStats.targetAmount)}
                    </strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={`font-mono font-bold inline-flex items-center gap-0.5 ${
                      branchTargetStats.targetVariance >= 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-red-700 dark:text-red-400'
                    }`}
                  >
                    {branchTargetStats.targetVariance >= 0 ? (
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5" />
                    )}
                    {branchTargetStats.targetVariance >= 0 ? '+' : ''}
                    {formatCompactRs(branchTargetStats.targetVariance)} ({branchTargetStats.targetAchPct.toFixed(1)}%)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium">
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                    {branchTargetStats.exceededCount} Exceeded (≥100%)
                  </span>
                  <span aria-hidden="true" className="text-zinc-400">·</span>
                  <span className="text-amber-700 dark:text-amber-400 font-semibold">
                    {branchTargetStats.nearCount} Near (85–99%)
                  </span>
                  <span aria-hidden="true" className="text-zinc-400">·</span>
                  <span className="text-red-700 dark:text-red-400 font-semibold">
                    {branchTargetStats.behindCount} Below (&lt;85%)
                  </span>
                </div>
              </div>
            </div>
          );
        })()}
      </section>

      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 tabular-nums">
        {/* Card 1: Paid vs Not Paid Contracts */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <span>Below-3 Contracts (Paid vs Not Paid)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
              {activeTotals.totalCount.toLocaleString()}
            </span>
            <span className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400">
              {activeTotals.paidRatioPct.toFixed(1)}% Paid
            </span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-red-100 dark:bg-red-950/60 overflow-hidden flex">
            <div
              className="h-full bg-emerald-600 transition-all"
              style={{ width: `${Math.min(100, activeTotals.paidRatioPct)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
              {activeTotals.paidCount.toLocaleString()} Paid
            </span>
            <span className="text-red-700 dark:text-red-400 font-semibold">
              {activeTotals.notPaidCount.toLocaleString()} Not Paid
            </span>
          </div>
        </div>

        {/* Card 2: Actual Collection vs Selected Target */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <span>Actual vs. {activeBranchTarget.shortLabel}</span>
            <TrendingUp className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
              {formatCompactRs(activeTotals.collectedAmount)}
            </span>
            <span className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300">
              ({activeTotals.collectionPct.toFixed(1)}%)
            </span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                activeTotals.collectionPct >= 100
                  ? 'bg-emerald-600'
                  : activeTotals.collectionPct >= 85
                    ? 'bg-amber-500'
                    : 'bg-red-700'
              }`}
              style={{ width: `${Math.min(100, activeTotals.collectionPct)}%` }}
            />
          </div>
          <div className="mt-2 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
            Target:{' '}
            <strong className="text-zinc-800 dark:text-zinc-200">
              {formatCompactRs(activeTotals.targetAmount)}
            </strong>{' '}
            · Full Due: {formatCompactRs(activeTotals.dueAmount)}
          </div>
        </div>

        {/* Card 3: Actual vs Target Variance (Rs.) */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <span>Target Variance ({activeBranchTarget.shortLabel})</span>
            {varianceIsPositive ? (
              <ArrowUpRight className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-red-600 shrink-0" />
            )}
          </div>
          <div
            className={`mt-2 text-xl font-bold font-mono ${
              varianceIsPositive
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-red-700 dark:text-red-400'
            }`}
          >
            {varianceIsPositive ? '+' : ''}
            {formatCurrencyRs(activeTotals.varianceAmount)}
          </div>
          <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            {varianceIsPositive ? (
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                Surplus above {activeBranchTarget.shortLabel} (+{(activeTotals.collectionPct - 100).toFixed(1)}%)
              </span>
            ) : (
              <span>
                Shortfall vs {activeBranchTarget.shortLabel} ({Math.max(0, 100 - activeTotals.collectionPct).toFixed(1)}% gap)
              </span>
            )}
          </div>
        </div>

        {/* Card 4: Contracts Needed Against Target */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <span>Contracts Needed vs. {activeBranchTarget.shortLabel}</span>
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono ${
                activeTotals.contractsNeededForTarget === 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-amber-700 dark:text-amber-400'
              }`}
            >
              {activeTotals.contractsNeededForTarget.toLocaleString()}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {activeTotals.contractsNeededForTarget === 0
                ? 'Target achieved'
                : 'contracts to cover gap'}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
            <span>
              Full Due Need:{' '}
              <strong className="text-red-700 dark:text-red-400">
                {activeTotals.contractsNeededAgainstDue}
              </strong>
            </span>
            <span>
              Partial:{' '}
              <strong className="text-amber-700 dark:text-amber-400">
                {activeTotals.partialPaidCount}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Visualizations Row: Officer-Wise Collection & Variance Chart + Payment Split & Age Sub-Buckets */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Main Officer-Wise Chart (8 cols) */}
        <div className="xl:col-span-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Officer-Wise Below 3 Collection &amp; Variance
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {chartMode === 'amount'
                  ? `Officer Target Share (${activeBranchTarget.shortLabel}) vs. Actual Collected (Rs. Millions) & Achievement %`
                  : chartMode === 'variance'
                    ? `Diverging Target Variance (Actual − ${activeBranchTarget.shortLabel}) in Rs. Millions per officer`
                    : 'Paid vs. Not Paid Below-3 contracts this month per officer'}
              </p>
            </div>

            <div
              role="group"
              aria-label="Below 3 Chart Mode"
              className="inline-flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
            >
              <button
                type="button"
                onClick={() => setChartMode('amount')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  chartMode === 'amount'
                    ? 'bg-red-700 text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                Target vs Coll
              </button>
              <button
                type="button"
                onClick={() => setChartMode('variance')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  chartMode === 'variance'
                    ? 'bg-red-700 text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                Variance (+/-)
              </button>
              <button
                type="button"
                onClick={() => setChartMode('contracts')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  chartMode === 'contracts'
                    ? 'bg-red-700 text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                Paid vs Not Paid
              </button>
            </div>
          </div>

          {officerChartData.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-500 dark:text-zinc-400">
              No Below-3 officer records loaded yet.
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {chartMode === 'amount' ? (
                  <ComposedChart
                    data={officerChartData}
                    margin={{ top: 10, right: 14, left: 0, bottom: 6 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis
                      dataKey="officer"
                      tick={{ fill: axisColor, fontSize: 11 }}
                      axisLine={{ stroke: gridColor }}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fill: axisColor, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}M`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={[0, 160]}
                      tick={{ fill: axisColor, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: tooltipBg,
                        borderColor: tooltipBorder,
                        borderRadius: '10px',
                        fontSize: '12px',
                      }}
                      formatter={(value: unknown, name: unknown) => {
                        const label = String(name);
                        if (label.includes('%')) return [`${Number(value || 0)}%`, label];
                        return [`Rs. ${Number(value || 0).toFixed(2)}M`, label];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <ReferenceLine
                      yAxisId="right"
                      y={100}
                      stroke="#059669"
                      strokeDasharray="4 4"
                      label={{
                        value: '100% Target',
                        position: 'insideTopRight',
                        fill: '#059669',
                        fontSize: 10,
                      }}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="targetM"
                      name={`${activeBranchTarget.shortLabel} Share (M)`}
                      fill={isDark ? '#52525b' : '#a1a1aa'}
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="collectedM"
                      name="Actual Collected (M)"
                      fill="#059669"
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="collectionPct"
                      name="Target Ach %"
                      stroke="#b91c1c"
                      strokeWidth={2.5}
                      dot={{ r: 3.5 }}
                    />
                  </ComposedChart>
                ) : chartMode === 'variance' ? (
                  <BarChart
                    data={officerChartData}
                    margin={{ top: 10, right: 14, left: 0, bottom: 6 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis
                      dataKey="officer"
                      tick={{ fill: axisColor, fontSize: 11 }}
                      axisLine={{ stroke: gridColor }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: axisColor, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}M`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: tooltipBg,
                        borderColor: tooltipBorder,
                        borderRadius: '10px',
                        fontSize: '12px',
                      }}
                      formatter={(value: unknown) => {
                        const n = Number(value || 0);
                        return [
                          `${n >= 0 ? '+' : ''}Rs. ${n.toFixed(2)}M`,
                          `Variance vs ${activeBranchTarget.shortLabel}`,
                        ];
                      }}
                    />
                    <ReferenceLine y={0} stroke={isDark ? '#71717a' : '#52525b'} strokeWidth={1.5} />
                    <Bar
                      dataKey="varianceM"
                      name={`Variance vs ${activeBranchTarget.shortLabel} (M)`}
                      radius={[4, 4, 4, 4]}
                    >
                      {officerChartData.map((entry) => (
                        <Cell
                          key={entry.officer}
                          fill={entry.varianceM >= 0 ? '#059669' : '#b91c1c'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                ) : (
                  <BarChart
                    data={officerChartData}
                    margin={{ top: 10, right: 14, left: 0, bottom: 6 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis
                      dataKey="officer"
                      tick={{ fill: axisColor, fontSize: 11 }}
                      axisLine={{ stroke: gridColor }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: axisColor, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: tooltipBg,
                        borderColor: tooltipBorder,
                        borderRadius: '10px',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar
                      dataKey="paidCount"
                      name="Paid This Month"
                      stackId="a"
                      fill="#059669"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey="notPaidCount"
                      name="Not Paid"
                      stackId="a"
                      fill="#b91c1c"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Payment Split Donut + Below-3 Age Sub-Bands (4 cols) */}
        <div className="xl:col-span-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex flex-col justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              This Month Payment Split
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Full Paid vs. Partial Paid vs. Not Paid ({activeTotals.label})
            </p>
          </div>

          <div className="h-44 w-full">
            {paymentSplitPie.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentSplitPie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={68}
                    paddingAngle={3}
                  >
                    {paymentSplitPie.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: tooltipBg,
                      borderColor: tooltipBorder,
                      borderRadius: '10px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-zinc-400">
                No contracts in scope
              </div>
            )}
          </div>

          {/* Age Band Mini Summary */}
          <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800 tabular-nums">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
              <Layers className="w-3.5 h-3.5 text-red-700 dark:text-red-400" />
              Branch Below-3 Age Breakdown
            </div>
            {snapshot.subBuckets.map((b) => (
              <div
                key={b.key}
                className="flex items-center justify-between gap-2 text-[11px] px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800"
              >
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  {b.shortLabel}
                </span>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                    {b.paidCount}P
                  </span>
                  <span className="text-zinc-400">/</span>
                  <span className="text-red-700 dark:text-red-400 font-semibold">
                    {b.notPaidCount}NP
                  </span>
                  <span className="text-zinc-500">({b.collectionPct.toFixed(0)}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Officer-Wise Below 3 Collection, Variance & Contracts Needed Matrix Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-red-700 dark:text-red-400" />
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Officer-Wise &amp; Branch Total Below-3 Collection Matrix
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Click any officer row to filter KPIs and inspect their unpaid / partial-paid Below-3 contracts below.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Filter Below 3 officers by Office Type"
              className="inline-flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
            >
              {(
                [
                  { id: 'ALL', label: `All (${evaluatedOfficers.length})` },
                  {
                    id: 'RO',
                    label: `RO (${evaluatedOfficers.filter((o) => (o.role || '').toUpperCase() === 'RO').length})`,
                  },
                  {
                    id: 'MO',
                    label: `MO (${evaluatedOfficers.filter((o) => (o.role || '').toUpperCase() === 'MO').length})`,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRoleFilter(tab.id)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap ${
                    roleFilter === tab.id
                      ? 'bg-red-700 text-white shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {selectedOfficer !== 'ALL' && (
              <button
                type="button"
                onClick={() => {
                  setSelectedOfficer('ALL');
                  setVisibleLimit(30);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-900 bg-red-50/70 dark:bg-red-950/40 text-red-800 dark:text-red-300 hover:bg-red-100"
              >
                <X className="w-3.5 h-3.5" />
                Show Branch Total (All Officers)
              </button>
            )}
          </div>
        </div>

        {/* Mobile Touch Cards View (No Sideways Table Scroll on Phones) */}
        <div className="md:hidden divide-y divide-zinc-200 dark:divide-zinc-800 tabular-nums">
          {visibleEvaluatedOfficers.map((row) => {
            const isSelected = selectedOfficer === row.officer;
            const isSurplus = row.targetVariance >= 0;
            const barWidthPct = Math.min(100, (row.targetAchPct / 130) * 100);
            const targetTickPct = (100 / 130) * 100;

            return (
              <button
                key={`${row.role}_${row.officer}`}
                type="button"
                onClick={() => {
                  setSelectedOfficer(isSelected ? 'ALL' : row.officer);
                  setVisibleLimit(30);
                }}
                className={`w-full text-left p-4 space-y-3 transition-colors active:bg-zinc-100/80 dark:active:bg-zinc-800/60 ${
                  isSelected ? 'bg-red-50/80 dark:bg-red-950/35' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <UserAvatar name={row.officer} sizeClass="w-8 h-8 text-[10px]" />
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                        {row.officer}
                      </div>
                      <div className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                        {row.role} · {row.totalCount.toLocaleString()} accts ·{' '}
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                          {row.paidCount}P
                        </span>
                        /
                        <span className="text-red-700 dark:text-red-400 font-semibold">
                          {row.notPaidCount}NP
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`font-mono text-xs font-bold ${
                        isSurplus
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-700 dark:text-red-400'
                      }`}
                    >
                      {isSurplus ? '+' : ''}
                      {formatCompactRs(row.targetVariance)}
                    </div>
                    <div className="text-[10px] font-mono font-bold text-zinc-700 dark:text-zinc-300">
                      {row.targetAchPct.toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px] font-mono bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200/70 dark:border-zinc-800 rounded-xl p-2.5">
                  <div>
                    <div className="text-[10px] font-sans text-zinc-500">Target</div>
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatCompactRs(row.targetAmount)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-sans text-zinc-500">Collected</div>
                    <div className="font-bold text-emerald-700 dark:text-emerald-400">
                      {formatCompactRs(row.collectedAmount)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-sans text-zinc-500">Needed</div>
                    <div
                      className={`font-bold ${
                        row.contractsNeededForTarget === 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {row.contractsNeededForTarget === 0
                        ? 'Met'
                        : `${row.contractsNeededForTarget} accts`}
                    </div>
                  </div>
                </div>

                <div className="relative h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-visible">
                  <div
                    className={`h-full rounded-full transition-all ${
                      row.perfTier === 'exceeded'
                        ? 'bg-emerald-600'
                        : row.perfTier === 'near'
                          ? 'bg-amber-500'
                          : 'bg-red-600'
                    }`}
                    style={{ width: `${barWidthPct}%` }}
                  />
                  <div
                    className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-zinc-900/60 dark:bg-white/60"
                    style={{ left: `${targetTickPct}%` }}
                  />
                </div>
              </button>
            );
          })}

          {/* Mobile Branch Total Summary Card */}
          <div className="p-4 bg-zinc-900 text-white dark:bg-zinc-950 border-t-2 border-red-700 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold uppercase tracking-wide">
                Branch Total ({evaluatedOfficers.length} Officers)
              </div>
              <span className="font-mono text-xs font-bold text-amber-300">
                {branchTargetStats.targetAchPct.toFixed(1)}%
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 font-mono text-xs">
              <div>
                <div className="text-[10px] font-sans text-zinc-400">Target</div>
                <div className="font-bold">{formatCompactRs(branchTargetStats.targetAmount)}</div>
              </div>
              <div>
                <div className="text-[10px] font-sans text-zinc-400">Collected</div>
                <div className="font-bold text-emerald-400">
                  {formatCompactRs(snapshot.collectedAmount)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-sans text-zinc-400">Variance</div>
                <div
                  className={`font-bold ${
                    branchTargetStats.targetVariance >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {branchTargetStats.targetVariance >= 0 ? '+' : ''}
                  {formatCompactRs(branchTargetStats.targetVariance)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop / Tablet Matrix Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="py-3 px-4">Officer</th>
                <th className="py-3 px-3 text-right">Paid / Not Paid</th>
                <th className="py-3 px-3 text-right">{activeBranchTarget.shortLabel}</th>
                <th className="py-3 px-3 text-right">Actual Collected</th>
                <th className="py-3 px-3 text-right">Variance (Rs.)</th>
                <th className="py-3 px-3 min-w-[175px]">Performance vs Target</th>
                <th className="py-3 px-4 text-right">Contracts Needed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 tabular-nums">
              {visibleEvaluatedOfficers.map((row) => {
                const isSelected = selectedOfficer === row.officer;
                const isSurplus = row.targetVariance >= 0;
                const barWidthPct = Math.min(100, (row.targetAchPct / 130) * 100);
                const targetTickPct = (100 / 130) * 100;

                return (
                  <tr
                    key={`${row.role}_${row.officer}`}
                    onClick={() => {
                      setSelectedOfficer(isSelected ? 'ALL' : row.officer);
                      setVisibleLimit(30);
                    }}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-red-50/80 dark:bg-red-950/35'
                        : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar name={row.officer} sizeClass="w-7 h-7 text-[10px]" />
                        <div>
                          <div className="font-bold text-zinc-900 dark:text-zinc-100">
                            {row.officer}
                          </div>
                          <div className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                            {row.role} · {row.portfolioSharePct.toFixed(1)}% share · {row.totalCount.toLocaleString()} accts
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                      <div>
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                          {row.paidCount.toLocaleString()}P
                        </span>
                        <span className="text-zinc-400 mx-1">/</span>
                        <span className="text-red-700 dark:text-red-400 font-bold">
                          {row.notPaidCount.toLocaleString()}NP
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        {row.paidRatioPct.toFixed(0)}% paid
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                      <div className="font-semibold">{formatCompactRs(row.targetAmount)}</div>
                      {targetMode !== 'full_due' && (
                        <div className="text-[10px] text-zinc-400">
                          Due: {formatCompactRs(row.dueAmount)}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                      <div>{formatCompactRs(row.collectedAmount)}</div>
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-normal">
                        {row.contributionTo20MPct.toFixed(1)}% of 20M
                      </div>
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-mono font-bold whitespace-nowrap ${
                        isSurplus
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-700 dark:text-red-400'
                      }`}
                    >
                      <span className="inline-flex items-center justify-end gap-0.5">
                        {isSurplus ? (
                          <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
                        )}
                        {isSurplus ? '+' : ''}
                        {formatCompactRs(row.targetVariance)}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span
                            className={`inline-flex items-center gap-1 font-semibold ${
                              row.perfTier === 'exceeded'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : row.perfTier === 'near'
                                  ? 'text-amber-700 dark:text-amber-400'
                                  : 'text-red-700 dark:text-red-400'
                            }`}
                          >
                            {row.perfTier === 'exceeded' ? (
                              <TrendingUp className="w-3 h-3 shrink-0" />
                            ) : row.perfTier === 'near' ? (
                              <Clock className="w-3 h-3 shrink-0" />
                            ) : (
                              <TrendingDown className="w-3 h-3 shrink-0" />
                            )}
                            {row.perfTier === 'exceeded'
                              ? 'Exceeded'
                              : row.perfTier === 'near'
                                ? 'Near Target'
                                : 'Shortfall'}
                          </span>
                          <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                            {row.targetAchPct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="relative h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-visible">
                          <div
                            className={`h-full rounded-full transition-all ${
                              row.perfTier === 'exceeded'
                                ? 'bg-emerald-600'
                                : row.perfTier === 'near'
                                  ? 'bg-amber-500'
                                  : 'bg-red-600'
                            }`}
                            style={{ width: `${barWidthPct}%` }}
                          />
                          <div
                            className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-zinc-900/60 dark:bg-white/60"
                            style={{ left: `${targetTickPct}%` }}
                            title="100% Target Line"
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                      {row.contractsNeededForTarget === 0 ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Target Met
                        </span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-400 font-bold">
                          {row.contractsNeededForTarget.toLocaleString()} contracts
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Branch Total Footer Row */}
            <tfoot className="bg-zinc-900 text-white dark:bg-zinc-950 border-t-2 border-red-700 font-mono tabular-nums">
              <tr>
                <td className="py-3.5 px-4 font-sans font-bold text-xs uppercase tracking-wide">
                  Branch Total ({evaluatedOfficers.length} Officers · {snapshot.totalCount.toLocaleString()} Accts)
                </td>
                <td className="py-3.5 px-3 text-right font-bold whitespace-nowrap">
                  <span className="text-emerald-400">{snapshot.paidCount.toLocaleString()}P</span>
                  <span className="text-zinc-500 mx-1">/</span>
                  <span className="text-red-400">{snapshot.notPaidCount.toLocaleString()}NP</span>
                </td>
                <td className="py-3.5 px-3 text-right font-bold whitespace-nowrap">
                  {formatCompactRs(branchTargetStats.targetAmount)}
                </td>
                <td className="py-3.5 px-3 text-right font-bold text-emerald-400 whitespace-nowrap">
                  {formatCompactRs(snapshot.collectedAmount)}
                </td>
                <td
                  className={`py-3.5 px-3 text-right font-bold whitespace-nowrap ${
                    branchTargetStats.targetVariance >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {branchTargetStats.targetVariance >= 0 ? '+' : ''}
                  {formatCompactRs(branchTargetStats.targetVariance)}
                </td>
                <td className="py-3.5 px-3 font-bold whitespace-nowrap">
                  <span
                    className={
                      branchTargetStats.targetAchPct >= 100
                        ? 'text-emerald-400'
                        : branchTargetStats.targetAchPct >= 85
                          ? 'text-amber-300'
                          : 'text-red-400'
                    }
                  >
                    {branchTargetStats.targetAchPct.toFixed(1)}% ({branchTargetStats.exceededCount}/{evaluatedOfficers.length} Met)
                  </span>
                </td>
                <td className="py-3.5 px-4 text-right font-bold text-amber-300 whitespace-nowrap">
                  {branchTargetStats.contractsNeededForTarget === 0
                    ? '✓ Target Achieved'
                    : `${branchTargetStats.contractsNeededForTarget.toLocaleString()} contracts needed`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Contract-Level Below-3 Drill-Down List (with PaymentPatternStrip under every Contract No) */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Below-3 Contract Payment Verification ({filteredContracts.length.toLocaleString()} matching)
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Inspect paid, partial-paid, and unpaid contracts (&lt; 3.00 age) sorted by highest monthly due priority.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setVisibleLimit(30);
                }}
                placeholder="Search contract, client, officer..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Payment Status Filter */}
            <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-950">
              {(
                [
                  { id: 'not_paid', label: 'Not Paid Only' },
                  { id: 'partial', label: 'Partial Paid' },
                  { id: 'paid', label: 'All Paid' },
                  { id: 'all', label: 'All Below-3' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setStatusFilter(tab.id);
                    setVisibleLimit(30);
                  }}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap ${
                    statusFilter === tab.id
                      ? 'bg-red-700 text-white shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Age Sub-Band Filter */}
            <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-950">
              {(
                [
                  { id: 'all', label: 'All <3.00' },
                  { id: 'below1', label: '≤ 1.00' },
                  { id: 'age1to2', label: '1.01–1.99' },
                  { id: 'age2to3', label: '2.00–2.99' },
                ] as const
              ).map((band) => (
                <button
                  key={band.id}
                  type="button"
                  onClick={() => {
                    setAgeBandFilter(band.id);
                    setVisibleLimit(30);
                  }}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap ${
                    ageBandFilter === band.id
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  {band.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {displayedContracts.length === 0 ? (
          <div className="p-10 text-center text-xs text-zinc-500 dark:text-zinc-400">
            No Below-3 contracts match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                <tr>
                  <th className="py-2.5 px-4">Contract &amp; Payment Pattern</th>
                  <th className="py-2.5 px-3">Officer</th>
                  <th className="py-2.5 px-3 text-right">Age / DPD</th>
                  <th className="py-2.5 px-3 text-right">Monthly Due</th>
                  <th className="py-2.5 px-3 text-right">Collected</th>
                  <th className="py-2.5 px-3 text-right">Variance</th>
                  <th className="py-2.5 px-4 text-right">Status &amp; Efforts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 tabular-nums">
                {displayedContracts.map((item) => (
                  <tr
                    key={item.contractNo}
                    className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40"
                  >
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                        {item.contractNo}
                      </div>
                      <div className="text-[11px] text-zinc-600 dark:text-zinc-300 truncate max-w-[230px]">
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
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <UserAvatar name={item.officer} sizeClass="w-6 h-6 text-[9px]" />
                        <div>
                          <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                            {item.officer}
                          </div>
                          <div className="text-[10px] font-mono text-zinc-500">
                            {item.officeType}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                      <div className="font-bold text-zinc-900 dark:text-zinc-100">
                        {item.currentAge.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        Op {item.opAge.toFixed(2)} · {item.actualDpd} DPD
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
                      {formatCurrencyRs(item.currentMonthDue)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                      {formatCurrencyRs(item.totalCollection)}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-mono font-bold whitespace-nowrap ${
                        item.varianceAmount >= 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-700 dark:text-red-400'
                      }`}
                    >
                      {item.varianceAmount >= 0 ? '+' : ''}
                      {formatCurrencyRs(item.varianceAmount)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex flex-col items-end gap-1">
                        {item.isFullPaid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />
                            Paid
                          </span>
                        ) : item.isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Clock className="w-3 h-3" />
                            Partial
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                            <AlertCircle className="w-3 h-3" />
                            Not Paid
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-500">
                          <PhoneCall className="w-3 h-3" />
                          {item.assignOfficerEfforts} / {item.totalEfforts} eff
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredContracts.length > visibleLimit && (
          <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 flex items-center justify-between text-xs">
            <span className="font-mono text-zinc-500 dark:text-zinc-400">
              Showing {displayedContracts.length} of {filteredContracts.length.toLocaleString()} contracts
            </span>
            <button
              type="button"
              onClick={() => setVisibleLimit((v) => v + 50)}
              className="px-3.5 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white font-semibold transition-colors"
            >
              Load 50 More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
