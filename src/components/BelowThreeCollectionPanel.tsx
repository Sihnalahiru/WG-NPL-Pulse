import { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Clock,
  Info,
  Layers,
  PhoneCall,
  Search,
  TrendingUp,
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
  computeBelowThreeCollectionSnapshot,
  formatCompactRs,
  formatCurrencyRs,
  normalizeContractNo,
} from '../utils/recoveryEngine';
import { PaymentPatternStrip } from './PaymentPatternStrip';
import { UserAvatar } from './UserAvatar';

interface BelowThreeCollectionPanelProps {
  aersRecords: AersRecord[];
  aersMeta: AersMetadata | null;
  mrpMap?: Map<string, MrpEnrichment>;
  isDark: boolean;
}

export function BelowThreeCollectionPanel({
  aersRecords,
  aersMeta,
  mrpMap,
  isDark,
}: BelowThreeCollectionPanelProps) {
  const [selectedOfficer, setSelectedOfficer] = useState<string>('ALL');
  const [chartMode, setChartMode] = useState<'amount' | 'contracts'>('amount');
  const [statusFilter, setStatusFilter] = useState<'all' | 'not_paid' | 'partial' | 'paid'>('not_paid');
  const [ageBandFilter, setAgeBandFilter] = useState<'all' | 'below1' | 'age1to2' | 'age2to3'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(30);

  const bm = aersMeta?.bmBranchSnapshot;
  const usingFullWorkbookSnapshot = Boolean(bm?.belowThreeSummary && bm.belowThreeSummary.totalCount > 0);

  // Full Below-3 dataset: prefer full workbook snapshot (captures all <3.00 accounts including regular performing),
  // otherwise compute live from loaded AERS records (<3.00 age)
  const snapshot = useMemo<BelowThreeCollectionSnapshot>(() => {
    if (bm?.belowThreeSummary && bm.belowThreeSummary.totalCount > 0) {
      return bm.belowThreeSummary;
    }
    return computeBelowThreeCollectionSnapshot(aersRecords, 2000);
  }, [bm, aersRecords]);

  // If using legacy pre-upload snapshot, show full BM age-bucket Below-3 count context ([A]+[B]+[C]+[D])
  const fullBranchBmBelow3Count = useMemo(() => {
    if (!bm?.ageBuckets || bm.ageBuckets.length < 4) return null;
    return (
      (bm.ageBuckets[0]?.count || 0) +
      (bm.ageBuckets[1]?.count || 0) +
      (bm.ageBuckets[2]?.count || 0) +
      (bm.ageBuckets[3]?.count || 0)
    );
  }, [bm]);

  // Scoped metrics when an individual officer is selected vs Branch Total
  const activeOfficerRow = useMemo(() => {
    if (selectedOfficer === 'ALL') return null;
    return snapshot.byOfficer.find((o) => o.officer === selectedOfficer) ?? null;
  }, [snapshot, selectedOfficer]);

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
        dueAmount: activeOfficerRow.dueAmount,
        collectedAmount: activeOfficerRow.collectedAmount,
        varianceAmount: activeOfficerRow.varianceAmount,
        collectionPct: activeOfficerRow.collectionPct,
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
      dueAmount: snapshot.dueAmount,
      collectedAmount: snapshot.collectedAmount,
      varianceAmount: snapshot.varianceAmount,
      collectionPct: snapshot.collectionPct,
    };
  }, [activeOfficerRow, snapshot]);

  // Chart data per officer
  const officerChartData = useMemo(() => {
    return snapshot.byOfficer.map((o) => ({
      officer: o.officer,
      dueK: Number((o.dueAmount / 1000).toFixed(1)),
      collectedK: Number((o.collectedAmount / 1000).toFixed(1)),
      varianceK: Number((o.varianceAmount / 1000).toFixed(1)),
      collectionPct: o.collectionPct,
      paidCount: o.paidCount,
      notPaidCount: o.notPaidCount,
      needed: o.contractsNeededAgainstDue,
    }));
  }, [snapshot.byOfficer]);

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
            <div className="px-4 py-3 rounded-xl bg-white/10 border border-white/15 backdrop-blur-md min-w-[165px]">
              <div className="text-[11px] text-zinc-300">Paid This Month</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-emerald-300">
                  {activeTotals.paidCount.toLocaleString()}
                </span>
                <span className="text-xs font-mono text-emerald-200/90">
                  ({activeTotals.paidRatioPct.toFixed(1)}%)
                </span>
              </div>
              <div className="text-[10px] text-red-300 font-mono mt-0.5">
                {activeTotals.notPaidCount.toLocaleString()} Not Paid
              </div>
            </div>

            <div className="px-4 py-3 rounded-xl bg-white/10 border border-white/15 backdrop-blur-md min-w-[185px]">
              <div className="text-[11px] text-zinc-300">Contracts Needed vs Due</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span
                  className={`text-xl font-bold font-mono ${
                    activeTotals.contractsNeededAgainstDue === 0
                      ? 'text-emerald-300'
                      : 'text-amber-300'
                  }`}
                >
                  {activeTotals.contractsNeededAgainstDue === 0
                    ? '✓ Covered'
                    : `${activeTotals.contractsNeededAgainstDue.toLocaleString()} more`}
                </span>
              </div>
              <div className="text-[10px] text-zinc-300 font-mono mt-0.5">
                Variance: {varianceIsPositive ? '+' : ''}
                {formatCompactRs(activeTotals.varianceAmount)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Context Notice when viewing pre-upgrade snapshot without full workbook Below-3 breakdown */}
      {!usingFullWorkbookSnapshot && fullBranchBmBelow3Count !== null && fullBranchBmBelow3Count > snapshot.totalCount && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/70 text-xs text-amber-900 dark:text-amber-200">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div>
            <strong>Full-Workbook Sync Tip:</strong> Your BM Snapshot shows{' '}
            <strong className="font-mono">{fullBranchBmBelow3Count.toLocaleString()}</strong> total Below-3 accounts across the entire branch (including regular &lt;2.00 accounts), while{' '}
            <strong className="font-mono">{snapshot.totalCount.toLocaleString()}</strong> active AERS accounts are currently indexed below. Re-upload the original Excel file once in Admin Mode to lock exact Paid / Not-Paid counts for all{' '}
            <strong className="font-mono">{fullBranchBmBelow3Count.toLocaleString()}</strong> Below-3 contracts!
          </div>
        </div>
      )}

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
              ✓ {activeTotals.paidCount.toLocaleString()} Paid
            </span>
            <span className="text-red-700 dark:text-red-400 font-semibold">
              ✗ {activeTotals.notPaidCount.toLocaleString()} Not Paid
            </span>
          </div>
        </div>

        {/* Card 2: Monthly Due vs Collected */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <span>Below-3 Collection vs. Monthly Due</span>
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
            Monthly Due: <strong className="text-zinc-800 dark:text-zinc-200">{formatCompactRs(activeTotals.dueAmount)}</strong>
          </div>
        </div>

        {/* Card 3: Collection Variance (Rs.) */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <span>Due Collection Variance (Rs.)</span>
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
                Surplus collected above monthly Due
              </span>
            ) : (
              <span>
                Shortfall remaining against Due ({(100 - activeTotals.collectionPct).toFixed(1)}% gap)
              </span>
            )}
          </div>
        </div>

        {/* Card 4: Contracts Needed Against Due */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <span>Contracts Needing Payment vs. Due</span>
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono ${
                activeTotals.contractsNeededAgainstDue === 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-amber-700 dark:text-amber-400'
              }`}
            >
              {activeTotals.contractsNeededAgainstDue.toLocaleString()}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {activeTotals.contractsNeededAgainstDue === 0
                ? 'Due achieved!'
                : 'contracts to cover Due'}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
            <span>Unpaid w/ Due: <strong className="text-red-700 dark:text-red-400">{activeTotals.unpaidWithDueCount}</strong></span>
            <span>Partial: <strong className="text-amber-700 dark:text-amber-400">{activeTotals.partialPaidCount}</strong></span>
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
                  ? 'Monthly Due vs. Collected (Rs. Thousands) and Collection % achievement per officer'
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
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                  chartMode === 'amount'
                    ? 'bg-red-700 text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                Due vs Coll (Rs.)
              </button>
              <button
                type="button"
                onClick={() => setChartMode('contracts')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
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
                      tickFormatter={(v) => `${v}k`}
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
                        return [`Rs. ${Number(value || 0).toLocaleString()}k`, label];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar
                      yAxisId="left"
                      dataKey="dueK"
                      name="Monthly Due (k)"
                      fill={isDark ? '#52525b' : '#a1a1aa'}
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="collectedK"
                      name="Collected (k)"
                      fill="#059669"
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="collectionPct"
                      name="Collection %"
                      stroke="#b91c1c"
                      strokeWidth={2.5}
                      dot={{ r: 3.5 }}
                    />
                  </ComposedChart>
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

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="py-3 px-4">Officer</th>
                <th className="py-3 px-3 text-right">Below-3 Total</th>
                <th className="py-3 px-3 text-right">Paid (This Mo)</th>
                <th className="py-3 px-3 text-right">Not Paid</th>
                <th className="py-3 px-3 text-right">Monthly Due</th>
                <th className="py-3 px-3 text-right">Collected</th>
                <th className="py-3 px-3 text-right">Variance (Rs.)</th>
                <th className="py-3 px-3 text-right">Coll %</th>
                <th className="py-3 px-4 text-right">Contracts Needed vs Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 tabular-nums">
              {snapshot.byOfficer.map((row) => {
                const isSelected = selectedOfficer === row.officer;
                const isSurplus = row.varianceAmount >= 0;
                return (
                  <tr
                    key={row.officer}
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
                            {row.role} · Paid {row.paidRatioPct.toFixed(0)}%
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100">
                      {row.totalCount.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                        {row.paidCount.toLocaleString()}
                      </span>
                      {row.partialPaidCount > 0 && (
                        <div className="text-[10px] text-amber-600 dark:text-amber-400">
                          ({row.partialPaidCount} partial)
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      <span className="text-red-700 dark:text-red-400 font-bold">
                        {row.notPaidCount.toLocaleString()}
                      </span>
                      <div className="text-[10px] text-zinc-500">
                        ({row.unpaidWithDueCount} w/ due)
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                      {formatCompactRs(row.dueAmount)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                      {formatCompactRs(row.collectedAmount)}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-mono font-bold whitespace-nowrap ${
                        isSurplus
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-700 dark:text-red-400'
                      }`}
                    >
                      {isSurplus ? '+' : ''}
                      {formatCompactRs(row.varianceAmount)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold ${
                          row.collectionPct >= 100
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                            : row.collectionPct >= 75
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300'
                        }`}
                      >
                        {row.collectionPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                      {row.contractsNeededAgainstDue === 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          0 (Due Covered)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800/70">
                          {row.contractsNeededAgainstDue} contracts
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
                  Branch Total ({snapshot.byOfficer.length} Officers)
                </td>
                <td className="py-3.5 px-3 text-right font-bold">
                  {snapshot.totalCount.toLocaleString()}
                </td>
                <td className="py-3.5 px-3 text-right font-bold text-emerald-400">
                  {snapshot.paidCount.toLocaleString()} ({snapshot.paidRatioPct.toFixed(0)}%)
                </td>
                <td className="py-3.5 px-3 text-right font-bold text-red-400">
                  {snapshot.notPaidCount.toLocaleString()}
                </td>
                <td className="py-3.5 px-3 text-right font-bold whitespace-nowrap">
                  {formatCompactRs(snapshot.dueAmount)}
                </td>
                <td className="py-3.5 px-3 text-right font-bold text-emerald-400 whitespace-nowrap">
                  {formatCompactRs(snapshot.collectedAmount)}
                </td>
                <td
                  className={`py-3.5 px-3 text-right font-bold whitespace-nowrap ${
                    snapshot.varianceAmount >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {snapshot.varianceAmount >= 0 ? '+' : ''}
                  {formatCompactRs(snapshot.varianceAmount)}
                </td>
                <td className="py-3.5 px-3 text-right font-bold">
                  {snapshot.collectionPct.toFixed(1)}%
                </td>
                <td className="py-3.5 px-4 text-right font-bold text-amber-300 whitespace-nowrap">
                  {snapshot.contractsNeededAgainstDue === 0
                    ? '✓ Due Covered'
                    : `${snapshot.contractsNeededAgainstDue.toLocaleString()} contracts needed`}
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
