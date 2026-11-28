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

type TargetLevelMode = 'level_100' | 'level_150' | 'level_200';

// Exact FY 2026/2027 BM DASHBOARD Sheet Below 3 Collection Targets (WG_MRP_NOV_2026.xlsx)
const BM_SHEET_BELOW3_TARGETS: Record<
  string,
  {
    role: string;
    actual: number;
    target100: number;
    target150: number;
    target200: number;
  }
> = {
  rameshl: { role: 'MO', actual: 2808808, target100: 3779922, target150: 3836148, target200: 3892375 },
  madurangab: { role: 'MO', actual: 4257199, target100: 5657834, target150: 5753152, target200: 5848469 },
  ravishanw: { role: 'MO', actual: 0, target100: 0, target150: 0, target200: 0 },
  kavidik: { role: 'MO', actual: 728456, target100: 1056704, target150: 1080190, target200: 1103676 },
  shanukama: { role: 'MO-MF', actual: 2281184, target100: 3376162, target150: 3426915, target200: 3477668 },
  darshikasa: { role: 'MO-MF', actual: 1907023, target100: 2490765, target150: 2523712, target200: 2556658 },
  mihirangah: { role: 'MO-MF', actual: 203838, target100: 225210, target150: 225147, target200: 225084 },
  tharushadi: { role: 'MO-MF', actual: 0, target100: 0, target150: 0, target200: 0 },
  kavishkat: { role: 'MO-MF', actual: 1796099, target100: 2346696, target150: 2399291, target200: 2451886 },
  upekshag: { role: 'MO-MF', actual: 0, target100: 0, target150: 0, target200: 0 },
  shanilkad: { role: 'MO-MF', actual: 0, target100: 0, target150: 0, target200: 0 },
  madusankal: { role: 'RO', actual: 4137941, target100: 5240636, target150: 5452327, target200: 5664018 },
  shadeeshan: { role: 'RO', actual: 7173800, target100: 9359420, target150: 9555873, target200: 9752325 },
};

const TARGET_LEVEL_STORAGE_KEY = 'wg_below3_level_mode_v1';

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

  const [levelMode, setLevelMode] = useState<TargetLevelMode>(() => {
    try {
      const saved = window.localStorage.getItem(TARGET_LEVEL_STORAGE_KEY);
      if (saved === 'level_100' || saved === 'level_150' || saved === 'level_200') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'level_100';
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(TARGET_LEVEL_STORAGE_KEY, levelMode);
    } catch {
      // ignore
    }
  }, [levelMode]);

  const bm = aersMeta?.bmBranchSnapshot;

  const snapshot = useMemo<BelowThreeCollectionSnapshot>(() => {
    if (bm?.belowThreeSummary && bm.belowThreeSummary.totalCount > 0) {
      return bm.belowThreeSummary;
    }
    return reconcileBelowThreeFromBmSnapshot(aersRecords, bm);
  }, [bm, aersRecords]);

  const isFromBmDashboardSheet = snapshot.source === 'bm_dashboard_sheet';

  const activeLevelMeta = useMemo(() => {
    if (levelMode === 'level_150') {
      return { label: '150 Level Target', shortLabel: '150 Level' };
    }
    if (levelMode === 'level_200') {
      return { label: '200 Level Target', shortLabel: '200 Level' };
    }
    return { label: '100 Level Target', shortLabel: '100 Level' };
  }, [levelMode]);

  // Merge live snapshot contract counts with exact BM DASHBOARD sheet 100 / 150 / 200 Level Targets
  const evaluatedOfficers = useMemo(() => {
    const byKey = new Map<string, (typeof snapshot.byOfficer)[number]>();
    for (const o of snapshot.byOfficer) {
      byKey.set((o.officer || '').trim().toLowerCase(), o);
    }

    const allKeys = Array.from(
      new Set([
        ...Object.keys(BM_SHEET_BELOW3_TARGETS),
        ...Array.from(byKey.keys()),
      ]),
    );

    const rows = allKeys.map((key) => {
      const snapRow = byKey.get(key);
      const sheetRow = BM_SHEET_BELOW3_TARGETS[key];

      const officerName = snapRow?.officer || key;
      const role = sheetRow?.role || snapRow?.role || 'RO';

      // Prefer exact parsed BM sheet levels if present on snapRow, else exact BM_SHEET_BELOW3_TARGETS
      const anySnap = snapRow as Record<string, unknown> | undefined;
      const actualCollected =
        typeof anySnap?.sheetActualCollection === 'number'
          ? anySnap.sheetActualCollection
          : sheetRow
            ? sheetRow.actual
            : snapRow?.collectedAmount || 0;

      const t100 =
        typeof anySnap?.target100 === 'number'
          ? anySnap.target100
          : sheetRow
            ? sheetRow.target100
            : snapRow?.dueAmount || 0;

      const t150 =
        typeof anySnap?.target150 === 'number'
          ? anySnap.target150
          : sheetRow
            ? sheetRow.target150
            : Math.round(t100 * 1.0215);

      const t200 =
        typeof anySnap?.target200 === 'number'
          ? anySnap.target200
          : sheetRow
            ? sheetRow.target200
            : Math.round(t100 * 1.043);

      const targetAmount =
        levelMode === 'level_150' ? t150 : levelMode === 'level_200' ? t200 : t100;

      const targetVariance = Math.round(actualCollected - targetAmount);
      const targetAchPct =
        targetAmount > 0
          ? Math.round((actualCollected / targetAmount) * 1000) / 10
          : actualCollected > 0
            ? 100
            : 0;

      const totalCount = snapRow?.totalCount || 0;
      const paidCount = snapRow?.paidCount || 0;
      const notPaidCount = snapRow?.notPaidCount || 0;
      const partialPaidCount = snapRow?.partialPaidCount || 0;
      const paidRatioPct =
        totalCount > 0 ? Math.round((paidCount / totalCount) * 1000) / 10 : 0;

      const avgDue =
        snapRow?.avgDuePerUnpaid && snapRow.avgDuePerUnpaid > 0
          ? snapRow.avgDuePerUnpaid
          : totalCount > 0 && targetAmount > 0
            ? targetAmount / totalCount
            : 25000;

      const targetShortfall = Math.max(0, -targetVariance);
      const contractsNeededForTarget =
        targetShortfall <= 0
          ? 0
          : Math.ceil(targetShortfall / Math.max(1, avgDue));

      const perfTier: 'exceeded' | 'near' | 'behind' =
        targetAmount === 0 || targetAchPct >= 100
          ? 'exceeded'
          : targetAchPct >= 75
            ? 'near'
            : 'behind';

      return {
        officer: officerName,
        role,
        totalCount,
        paidCount,
        notPaidCount,
        partialPaidCount,
        paidRatioPct,
        dueAmount: t100,
        target100: t100,
        target150: t150,
        target200: t200,
        targetAmount,
        collectedAmount: actualCollected,
        targetVariance,
        targetAchPct,
        contractsNeededForTarget,
        perfTier,
      };
    });

    const totalBranchTarget = rows.reduce((s, r) => s + r.targetAmount, 0);
    return rows.map((r) => ({
      ...r,
      portfolioSharePct:
        totalBranchTarget > 0
          ? Math.round((r.targetAmount / totalBranchTarget) * 1000) / 10
          : 0,
    }));
  }, [snapshot, levelMode]);

  const visibleEvaluatedOfficers = useMemo(() => {
    if (roleFilter === 'ALL') return evaluatedOfficers;
    if (roleFilter === 'MO') {
      return evaluatedOfficers.filter((o) =>
        (o.role || '').toUpperCase().startsWith('MO'),
      );
    }
    return evaluatedOfficers.filter(
      (o) => (o.role || '').toUpperCase() === roleFilter,
    );
  }, [evaluatedOfficers, roleFilter]);

  const branchTargetStats = useMemo(() => {
    const targetAmount = evaluatedOfficers.reduce((s, o) => s + o.targetAmount, 0);
    const collectedAmount = evaluatedOfficers.reduce((s, o) => s + o.collectedAmount, 0);
    const targetVariance = Math.round(collectedAmount - targetAmount);
    const targetAchPct =
      targetAmount > 0 ? Math.round((collectedAmount / targetAmount) * 1000) / 10 : 0;
    const contractsNeededForTarget = evaluatedOfficers.reduce(
      (s, o) => s + o.contractsNeededForTarget,
      0,
    );
    const activeWithTarget = evaluatedOfficers.filter((o) => o.targetAmount > 0);
    const exceededCount = activeWithTarget.filter((o) => o.perfTier === 'exceeded').length;
    const nearCount = activeWithTarget.filter((o) => o.perfTier === 'near').length;
    const behindCount = activeWithTarget.filter((o) => o.perfTier === 'behind').length;

    return {
      targetAmount,
      collectedAmount,
      targetVariance,
      targetAchPct,
      contractsNeededForTarget,
      exceededCount,
      nearCount,
      behindCount,
      activeOfficerCount: activeWithTarget.length,
    };
  }, [evaluatedOfficers]);

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
        contractsNeededForTarget: activeOfficerRow.contractsNeededForTarget,
        targetAmount: activeOfficerRow.targetAmount,
        collectedAmount: activeOfficerRow.collectedAmount,
        varianceAmount: activeOfficerRow.targetVariance,
        collectionPct: activeOfficerRow.targetAchPct,
      };
    }
    return {
      label: 'Branch Total (All Officers)',
      totalCount: snapshot.totalCount,
      paidCount: snapshot.paidCount,
      notPaidCount: snapshot.notPaidCount,
      paidRatioPct: snapshot.paidRatioPct,
      partialPaidCount: snapshot.partialPaidCount,
      contractsNeededForTarget: branchTargetStats.contractsNeededForTarget,
      targetAmount: branchTargetStats.targetAmount,
      collectedAmount: branchTargetStats.collectedAmount,
      varianceAmount: branchTargetStats.targetVariance,
      collectionPct: branchTargetStats.targetAchPct,
    };
  }, [activeOfficerRow, snapshot, branchTargetStats]);

  const officerChartData = useMemo(() => {
    return evaluatedOfficers
      .filter((o) => o.targetAmount > 0 || o.collectedAmount > 0)
      .map((o) => ({
        officer: o.officer,
        targetM: Number((o.targetAmount / 1_000_000).toFixed(2)),
        collectedM: Number((o.collectedAmount / 1_000_000).toFixed(2)),
        varianceM: Number((o.targetVariance / 1_000_000).toFixed(2)),
        collectionPct: o.targetAchPct,
        paidCount: o.paidCount,
        notPaidCount: o.notPaidCount,
      }));
  }, [evaluatedOfficers]);

  const paymentSplitPie = useMemo(() => {
    const fullPaid = Math.max(0, activeTotals.paidCount - activeTotals.partialPaidCount);
    return [
      { name: 'Full Paid', value: fullPaid, color: '#059669' },
      { name: 'Partial Paid', value: activeTotals.partialPaidCount, color: '#d97706' },
      { name: 'Not Paid', value: activeTotals.notPaidCount, color: '#b91c1c' },
    ].filter((d) => d.value > 0);
  }, [activeTotals]);

  const filteredContracts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return snapshot.contracts.filter((c) => {
      if (selectedOfficer !== 'ALL' && c.officer.toLowerCase() !== selectedOfficer.toLowerCase()) {
        return false;
      }
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
      {/* Executive Header & Exact BM Sheet Variance Banner */}
      <section
        aria-label="Below 3 Collection & Variance Overview"
        className="bg-gradient-to-br from-zinc-900 via-[#1d1719] to-red-950 text-white border border-red-900/40 rounded-2xl p-5 sm:p-6 shadow-lg relative overflow-hidden"
      >
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-red-600 via-amber-500 to-emerald-500" />

        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5 relative z-10">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-red-300">
              <Banknote className="w-4 h-4 text-red-400" />
              FY 2026/2027 TARGETS · BELOW 3 COLLECTION TARGET ({activeLevelMeta.label})
            </div>
            <h2 className="font-display text-lg sm:text-2xl font-extrabold tracking-tight text-white">
              Below 3 Collection &amp; Variance — {activeTotals.label}
            </h2>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Synced with <strong>BM DASHBOARD</strong> sheet <strong>100 Level</strong> (Rs. 33.53M),{' '}
              <strong>150 Level</strong> (Rs. 34.25M), and <strong>200 Level</strong> (Rs. 34.97M) Below 3 Collection Targets.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0 tabular-nums">
            <div className="px-4 py-3 rounded-xl bg-white/10 border border-white/15 backdrop-blur-md min-w-[175px]">
              <div className="text-[11px] text-zinc-300">Actual Collection</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-emerald-300">
                  {formatCurrencyRs(activeTotals.collectedAmount)}
                </span>
              </div>
              <div className="text-[10px] font-mono text-zinc-200 mt-0.5">
                {activeTotals.collectionPct.toFixed(1)}% of {activeLevelMeta.shortLabel}
              </div>
            </div>

            <div className="px-4 py-3 rounded-xl bg-white/10 border border-white/15 backdrop-blur-md min-w-[185px]">
              <div className="text-[11px] text-zinc-300">
                {activeLevelMeta.shortLabel} Variance
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span
                  className={`text-xl font-bold font-mono ${
                    varianceIsPositive ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                >
                  {varianceIsPositive ? '+' : ''}
                  {formatCurrencyRs(activeTotals.varianceAmount)}
                </span>
              </div>
              <div className="text-[10px] text-zinc-300 font-mono mt-0.5">
                Target: {formatCurrencyRs(activeTotals.targetAmount)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BM Dashboard Sheet Sync Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-900 dark:text-emerald-200">
        <div className="flex items-start gap-2.5">
          <FileSpreadsheet className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
          <div>
            <strong>
              {isFromBmDashboardSheet
                ? `Synced from "${snapshot.bmSheetName || 'BM DASHBOARD'}" Sheet:`
                : 'Aligned to FY 2026/2027 BM DASHBOARD Sheet:'}
            </strong>{' '}
            Actual Collection <strong className="font-mono">Rs. {branchTargetStats.collectedAmount.toLocaleString()}</strong> ·{' '}
            100 Level Target <strong className="font-mono">Rs. 33,533,348</strong> (Var: <strong className="font-mono text-rose-700 dark:text-rose-300">-8,239,002</strong>) ·{' '}
            150 Level <strong className="font-mono">Rs. 34,252,753</strong> ·{' '}
            200 Level <strong className="font-mono">Rs. 34,972,158</strong>
          </div>
        </div>
        {onUploadWorkbook && (
          <button
            type="button"
            onClick={() => uploadInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-[11px] transition-colors shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            {isAdmin ? 'Update Excel' : 'Sync Excel'}
          </button>
        )}
      </div>

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

      {/* 100 Level / 150 Level / 200 Level Target Selector & Milestone Gauge */}
      <section
        aria-label="Below 3 Level Target Selector"
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 tabular-nums"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Target className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                FY 2026/2027 Target Level Switcher (100 / 150 / 200 Level)
              </h3>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Switch between 100 Level, 150 Level, and 200 Level targets from the BM DASHBOARD sheet to compare officer-wise variances.
            </p>
          </div>

          <div
            role="group"
            aria-label="Select Below 3 Target Level"
            className="inline-flex items-center gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
          >
            {(
              [
                { id: 'level_100', label: '100 Level Target (33.53M)' },
                { id: 'level_150', label: '150 Level Target (34.25M)' },
                { id: 'level_200', label: '200 Level Target (34.97M)' },
              ] as const
            ).map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setLevelMode(preset.id)}
                className={`min-h-[34px] px-3 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  levelMode === preset.id
                    ? 'bg-red-700 text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2.5 pt-1">
          <div className="relative h-4 w-full rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div
              className={`h-full rounded-lg transition-all duration-300 ${
                branchTargetStats.targetAchPct >= 100
                  ? 'bg-emerald-600'
                  : branchTargetStats.targetAchPct >= 75
                    ? 'bg-amber-500'
                    : 'bg-red-700'
              }`}
              style={{ width: `${Math.min(100, branchTargetStats.targetAchPct)}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-zinc-600 dark:text-zinc-400">
              <span>
                Actual Collection:{' '}
                <strong className="font-mono text-zinc-900 dark:text-zinc-100">
                  {formatCurrencyRs(branchTargetStats.collectedAmount)}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {activeLevelMeta.label}:{' '}
                <strong className="font-mono text-zinc-900 dark:text-zinc-100">
                  {formatCurrencyRs(branchTargetStats.targetAmount)}
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
                {formatCurrencyRs(branchTargetStats.targetVariance)} (
                {branchTargetStats.targetAchPct.toFixed(1)}%)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium">
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                {branchTargetStats.exceededCount} Met (≥100%)
              </span>
              <span aria-hidden="true" className="text-zinc-400">·</span>
              <span className="text-amber-700 dark:text-amber-400 font-semibold">
                {branchTargetStats.nearCount} Near (75–99%)
              </span>
              <span aria-hidden="true" className="text-zinc-400">·</span>
              <span className="text-red-700 dark:text-red-400 font-semibold">
                {branchTargetStats.behindCount} Shortfall (&lt;75%)
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 tabular-nums">
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

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <span>Actual Collection vs {activeLevelMeta.shortLabel}</span>
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
                  : activeTotals.collectionPct >= 75
                    ? 'bg-amber-500'
                    : 'bg-red-700'
              }`}
              style={{ width: `${Math.min(100, activeTotals.collectionPct)}%` }}
            />
          </div>
          <div className="mt-2 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
            Target:{' '}
            <strong className="text-zinc-800 dark:text-zinc-200">
              {formatCurrencyRs(activeTotals.targetAmount)}
            </strong>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <span>{activeLevelMeta.shortLabel} Variance (Rs.)</span>
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
                Surplus above {activeLevelMeta.shortLabel}
              </span>
            ) : (
              <span>
                Shortfall vs {activeLevelMeta.shortLabel} (
                {Math.max(0, 100 - activeTotals.collectionPct).toFixed(1)}% gap)
              </span>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <span>Est. Contracts Needed ({activeLevelMeta.shortLabel})</span>
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
                : 'contracts to cover variance'}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
            <span>100L: {formatCompactRs(branchTargetStats.targetAmount)}</span>
            <span>Partial: {activeTotals.partialPaidCount}</span>
          </div>
        </div>
      </div>

      {/* Officer-Wise Chart + Payment Split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Officer-Wise Below 3 Collection vs {activeLevelMeta.label}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {chartMode === 'amount'
                  ? `${activeLevelMeta.label} vs Actual Collection (Rs. Millions) & Achievement %`
                  : chartMode === 'variance'
                    ? `${activeLevelMeta.shortLabel} Variance (Actual − Target) in Rs. Millions`
                    : 'Paid vs Not Paid Below-3 contracts per officer'}
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
                    domain={[0, 120]}
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
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="targetM"
                    name={`${activeLevelMeta.shortLabel} (M)`}
                    fill={isDark ? '#52525b' : '#a1a1aa'}
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="collectedM"
                    name="Actual Collection (M)"
                    fill="#059669"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="collectionPct"
                    name="Ach %"
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
                        `${activeLevelMeta.shortLabel} Variance`,
                      ];
                    }}
                  />
                  <ReferenceLine y={0} stroke={isDark ? '#71717a' : '#52525b'} strokeWidth={1.5} />
                  <Bar
                    dataKey="varianceM"
                    name={`${activeLevelMeta.shortLabel} Variance (M)`}
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
                  <Bar dataKey="paidCount" name="Paid" stackId="a" fill="#059669" />
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
        </div>

        {/* Payment Split Donut + Age Sub-Bands */}
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

      {/* Exact FY 2026/2027 BELOW 3 COLLECTION TARGET Matrix Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-red-700 dark:text-red-400" />
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                FY 2026/2027 Below 3 Collection Target Matrix (100 / 150 / 200 Level)
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Matches BM DASHBOARD sheet (Row 199–233). Click any officer row to inspect contracts below.
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
                    label: `MO / MO-MF (${evaluatedOfficers.filter((o) => (o.role || '').toUpperCase().startsWith('MO')).length})`,
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
                Show Branch Total
              </button>
            )}
          </div>
        </div>

        {/* Desktop / Tablet Matrix Table matching BM DASHBOARD Sheet */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="py-3 px-4">Officer</th>
                <th className="py-3 px-2.5 text-center">Type</th>
                <th className="py-3 px-3 text-right">Actual Collection</th>
                <th className="py-3 px-3 text-right">100 Level Target</th>
                <th className="py-3 px-3 text-right">100 Variance</th>
                <th className="py-3 px-3 text-right">150 Level Target</th>
                <th className="py-3 px-3 text-right">150 Variance</th>
                <th className="py-3 px-3 text-right">200 Level Target</th>
                <th className="py-3 px-4 text-right">200 Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 tabular-nums font-mono">
              {visibleEvaluatedOfficers.map((row) => {
                const isSelected = selectedOfficer === row.officer;
                const var100 = row.collectedAmount - row.target100;
                const var150 = row.collectedAmount - row.target150;
                const var200 = row.collectedAmount - row.target200;

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
                    <td className="py-2.5 px-4 font-sans">
                      <div className="flex items-center gap-2">
                        <UserAvatar name={row.officer} sizeClass="w-6 h-6 text-[9px]" />
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">
                          {row.officer}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2.5 text-center">
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                        {row.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                      {row.collectedAmount === 0 ? '-' : row.collectedAmount.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                      {row.target100 === 0 ? '-' : row.target100.toLocaleString()}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-semibold whitespace-nowrap ${
                        var100 < 0
                          ? 'text-red-600 dark:text-red-400'
                          : var100 > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-zinc-500'
                      }`}
                    >
                      {var100 === 0
                        ? '0'
                        : var100 < 0
                          ? `(${Math.abs(var100).toLocaleString()})`
                          : `+${var100.toLocaleString()}`}
                    </td>
                    <td className="py-2.5 px-3 text-right text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                      {row.target150 === 0 ? '-' : row.target150.toLocaleString()}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-semibold whitespace-nowrap ${
                        var150 < 0
                          ? 'text-red-600 dark:text-red-400'
                          : var150 > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-zinc-500'
                      }`}
                    >
                      {var150 === 0
                        ? '0'
                        : var150 < 0
                          ? `(${Math.abs(var150).toLocaleString()})`
                          : `+${var150.toLocaleString()}`}
                    </td>
                    <td className="py-2.5 px-3 text-right text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                      {row.target200 === 0 ? '-' : row.target200.toLocaleString()}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-semibold whitespace-nowrap ${
                        var200 < 0
                          ? 'text-red-600 dark:text-red-400'
                          : var200 > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-zinc-500'
                      }`}
                    >
                      {var200 === 0
                        ? '0'
                        : var200 < 0
                          ? `(${Math.abs(var200).toLocaleString()})`
                          : `+${var200.toLocaleString()}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Exact BM DASHBOARD Total Row */}
            <tfoot className="bg-zinc-900 text-white dark:bg-zinc-950 border-t-2 border-red-700 font-mono tabular-nums">
              {(() => {
                const totActual = visibleEvaluatedOfficers.reduce((s, r) => s + r.collectedAmount, 0);
                const tot100 = visibleEvaluatedOfficers.reduce((s, r) => s + r.target100, 0);
                const tot150 = visibleEvaluatedOfficers.reduce((s, r) => s + r.target150, 0);
                const tot200 = visibleEvaluatedOfficers.reduce((s, r) => s + r.target200, 0);
                const v100 = totActual - tot100;
                const v150 = totActual - tot150;
                const v200 = totActual - tot200;

                return (
                  <tr>
                    <td colSpan={2} className="py-3.5 px-4 font-sans font-bold text-xs uppercase tracking-wide">
                      Total ({visibleEvaluatedOfficers.length} Officers)
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-emerald-400 whitespace-nowrap">
                      {totActual.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold whitespace-nowrap">
                      {tot100.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-rose-400 whitespace-nowrap">
                      {v100 < 0 ? `(${Math.abs(v100).toLocaleString()})` : `+${v100.toLocaleString()}`}
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold whitespace-nowrap">
                      {tot150.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-rose-400 whitespace-nowrap">
                      {v150 < 0 ? `(${Math.abs(v150).toLocaleString()})` : `+${v150.toLocaleString()}`}
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold whitespace-nowrap">
                      {tot200.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-rose-400 whitespace-nowrap">
                      {v200 < 0 ? `(${Math.abs(v200).toLocaleString()})` : `+${v200.toLocaleString()}`}
                    </td>
                  </tr>
                );
              })()}
            </tfoot>
          </table>
        </div>
      </div>

      {/* Contract-Level Below-3 Drill-Down List */}
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
