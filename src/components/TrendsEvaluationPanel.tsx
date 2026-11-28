import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Flame,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import type {
  AersMetadata,
  AersRecord,
  MrpEnrichment,
  OpeningOfficerBaseline,
} from '../types/recovery';
import {
  analyzeNextMonthBorderline,
  analyzeWorstCategory,
  computeDpdAgeBuckets,
  computeOfficerOpeningClosing,
  formatCompactRs,
  formatCurrencyRs,
  normalizeEvaluableFromAers,
} from '../utils/recoveryEngine';
import { FinancePortfolioIllustration } from './FinanceIllustrations';
import { OfficerEffortSummaryPanel } from './OfficerEffortSummaryPanel';
import { UserAvatar } from './UserAvatar';

interface TrendsEvaluationPanelProps {
  aersRecords: AersRecord[];
  aersMeta: AersMetadata | null;
  mrpMap?: Map<string, MrpEnrichment>;
  openingBaseline: OpeningOfficerBaseline | null;
  isDark: boolean;
  onSetCurrentAsOpening: () => void;
  onOpenWorstRadar?: () => void;
  onOpenBorderlineCards?: () => void;
}

const BUCKET_COLORS: Record<string, string> = {
  '0': '#64748b',
  '1-30': '#2563eb',
  '31-60': '#0ea5e9',
  '61-90': '#d97706',
  '91+': '#dc2626',
};

const EMPTY_SET = new Set<string>();

export function TrendsEvaluationPanel({
  aersRecords,
  aersMeta,
  mrpMap,
  openingBaseline,
  isDark,
  onSetCurrentAsOpening,
  onOpenWorstRadar,
  onOpenBorderlineCards,
}: TrendsEvaluationPanelProps) {
  const evaluableItems = useMemo(
    () => normalizeEvaluableFromAers(aersRecords, EMPTY_SET, mrpMap),
    [aersRecords, mrpMap],
  );

  const ageBuckets = useMemo(
    () => computeDpdAgeBuckets(evaluableItems),
    [evaluableItems],
  );

  const borderlineAnalysis = useMemo(
    () => analyzeNextMonthBorderline(evaluableItems),
    [evaluableItems],
  );

  const worstAnalysis = useMemo(
    () => analyzeWorstCategory(evaluableItems),
    [evaluableItems],
  );

  const officerRows = useMemo(
    () => computeOfficerOpeningClosing(evaluableItems, openingBaseline),
    [evaluableItems, openingBaseline],
  );

  const officerTotals = useMemo(() => {
    return officerRows.reduce(
      (acc, r) => ({
        openingCount: acc.openingCount + r.openingCount,
        openingNplCount: acc.openingNplCount + r.openingNplCount,
        openingDebtor: acc.openingDebtor + r.openingDebtor,
        openingNpl: acc.openingNpl + r.openingNpl,
        closingCount: acc.closingCount + r.closingCount,
        closingNplCount: acc.closingNplCount + r.closingNplCount,
        closingDebtor: acc.closingDebtor + r.closingDebtor,
        closingNpl: acc.closingNpl + r.closingNpl,
        forecastedBorderCount:
          acc.forecastedBorderCount + r.forecastedBorderCount,
        forecastedBorderAmount:
          acc.forecastedBorderAmount + r.forecastedBorderAmount,
        movedToNplCount: acc.movedToNplCount + r.movedToNplCount,
        movedToNplAmount: acc.movedToNplAmount + r.movedToNplAmount,
        borderSavedCount: acc.borderSavedCount + r.borderSavedCount,
        borderSavedAmount: acc.borderSavedAmount + r.borderSavedAmount,
        borderlineCount: acc.borderlineCount + r.borderlineCount,
        borderlineEfforts: acc.borderlineEfforts + r.borderlineEfforts,
        zeroEffortBorderlineCount:
          acc.zeroEffortBorderlineCount + r.zeroEffortBorderlineCount,
        worstCount: acc.worstCount + r.worstCount,
        worstNpl: acc.worstNpl + r.worstNpl,
        nplReduction: acc.nplReduction + r.nplReduction,
        savedFromOpNplCount: acc.savedFromOpNplCount + r.savedFromOpNplCount,
        savedFromOpNplAmount: acc.savedFromOpNplAmount + r.savedFromOpNplAmount,
      }),
      {
        openingCount: 0,
        openingNplCount: 0,
        openingDebtor: 0,
        openingNpl: 0,
        closingCount: 0,
        closingNplCount: 0,
        closingDebtor: 0,
        closingNpl: 0,
        forecastedBorderCount: 0,
        forecastedBorderAmount: 0,
        movedToNplCount: 0,
        movedToNplAmount: 0,
        borderSavedCount: 0,
        borderSavedAmount: 0,
        borderlineCount: 0,
        borderlineEfforts: 0,
        zeroEffortBorderlineCount: 0,
        worstCount: 0,
        worstNpl: 0,
        nplReduction: 0,
        savedFromOpNplCount: 0,
        savedFromOpNplAmount: 0,
      },
    );
  }, [officerRows]);

  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#1e293b' : '#e2e8f0';
  const tooltipBg = isDark ? '#0f172a' : '#ffffff';
  const tooltipBorder = isDark ? '#334155' : '#e2e8f0';

  return (
    <div className="space-y-6">
      {/* Daily Age Evaluation Auto-Sync Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Daily Age Evaluation &amp; Borderline Risk Engine
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              Age buckets, next-month borderline exposure, and BM-reconciled Opening vs. Closing NPL per officer update automatically from your daily AERS report.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
              <span>
                Opening NPL:{' '}
                <strong className="font-mono text-slate-900 dark:text-slate-100">
                  {officerTotals.openingNplCount} accts · {formatCompactRs(officerTotals.openingNpl)}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Closing NPL:{' '}
                <strong className="font-mono text-red-600 dark:text-red-400">
                  {officerTotals.closingNplCount} accts · {formatCompactRs(officerTotals.closingNpl)}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Report:{' '}
                <span className="font-mono">
                  {aersMeta?.printedDateTime || 'No AERS loaded yet'}
                </span>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {aersRecords.length > 0 && (
              <button
                type="button"
                onClick={onSetCurrentAsOpening}
                title="Lock current AERS snapshot as Opening Baseline for this month"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Set Opening Baseline
              </button>
            )}
          </div>
        </div>
      </div>

      {/* DPD Age Bucket Distribution Bar Chart + Next-Month Borderline Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                DPD Age Bucket Distribution (AERS Portfolio)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Contract count across delinquency clusters (61-90 DPD highlights next-month NPL risk)
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              {evaluableItems.length} total accounts
            </span>
          </div>

          {evaluableItems.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg px-4">
              <FinancePortfolioIllustration className="w-44 h-auto mb-2" />
              No contracts to display yet. Upload an Age Evaluation report to populate charts.
            </div>
          ) : (
            <>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={ageBuckets}
                    margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis
                      dataKey="bucket"
                      tick={{ fill: axisColor, fontSize: 11 }}
                      axisLine={{ stroke: gridColor }}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: axisColor, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: tooltipBg,
                        borderColor: tooltipBorder,
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(
                        value: unknown,
                        _name: unknown,
                        props: { payload?: { closingDebtor?: number } },
                      ) => {
                        const debtor = props?.payload?.closingDebtor ?? 0;
                        return [
                          `${value} contracts (${formatCompactRs(debtor)})`,
                          'Cluster',
                        ];
                      }}
                    />
                    <Bar dataKey="count" name="Contracts" radius={[4, 4, 0, 0]}>
                      {ageBuckets.map((entry) => (
                        <Cell
                          key={entry.rangeKey}
                          fill={BUCKET_COLORS[entry.rangeKey] || '#2563eb'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs tabular-nums">
                {ageBuckets.map((b) => (
                  <div key={b.rangeKey}>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {b.bucket}
                    </div>
                    <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {b.count} · {formatCompactRs(b.closingDebtor)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Next-Month Borderline Save Analysis Summary */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Next-Month Borderline Save Analysis
              </h3>
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Accounts currently &lt; 91 DPD that cross 91 DPD this month-end or next month (+30d)
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 tabular-nums">
              <div className="p-3.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
                <div className="text-[11px] font-medium text-amber-800 dark:text-amber-300">
                  Borderline Accounts
                </div>
                <div className="mt-1 text-xl font-bold font-mono text-amber-900 dark:text-amber-200">
                  {borderlineAnalysis.totalCount}
                </div>
                <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                  {borderlineAnalysis.thisMonthEndCount} Month-End ·{' '}
                  {borderlineAnalysis.nextMonthOnlyCount} Next Month
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Projected NPL (Cap + Arr)
                </div>
                <div className="mt-1 text-lg font-bold font-mono text-slate-900 dark:text-slate-100">
                  {formatCompactRs(borderlineAnalysis.totalCapitalAtRisk)}
                </div>
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Debtor: {formatCompactRs(borderlineAnalysis.totalDebtorAtRisk)}
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
                <div className="text-[11px] font-medium text-blue-800 dark:text-blue-300">
                  Borderline Closing Debtor
                </div>
                <div className="mt-1 text-lg font-bold font-mono text-blue-900 dark:text-blue-200">
                  {formatCurrencyRs(borderlineAnalysis.totalDebtorAtRisk)}
                </div>
                <div className="mt-1 text-[11px] text-blue-700 dark:text-blue-400">
                  Total debtor balance in 61–90 DPD
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
                <div className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
                  Assign Officer Efforts (Borderline)
                </div>
                <div className="mt-1 text-lg font-bold font-mono text-emerald-900 dark:text-emerald-200">
                  {borderlineAnalysis.totalBorderlineEfforts} Efforts
                </div>
                <div className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                  Avg {borderlineAnalysis.avgEffortsPerBorderline}/acct ·{' '}
                  <span className={borderlineAnalysis.zeroEffortCount > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>
                    {borderlineAnalysis.zeroEffortCount} with 0 efforts
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {borderlineAnalysis.totalCount > 0 ? (
              <div className="space-y-1.5">
                <div>
                  <strong className="font-mono text-slate-900 dark:text-slate-100">
                    {borderlineAnalysis.totalCount}
                  </strong>{' '}
                  borderline accounts currently hold{' '}
                  <strong className="font-mono text-slate-900 dark:text-slate-100">
                    {formatCurrencyRs(borderlineAnalysis.totalCapitalAtRisk)}
                  </strong>{' '}
                  (Capital + Arrears) projected NPL exposure across{' '}
                  <strong className="font-mono text-slate-900 dark:text-slate-100">
                    {formatCurrencyRs(borderlineAnalysis.totalDebtorAtRisk)}
                  </strong>{' '}
                  closing debtor before month-end.
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono">
                  <span className="text-emerald-700 dark:text-emerald-400">
                    Border Saved ({borderlineAnalysis.borderSavedCount}):{' '}
                    {formatCompactRs(borderlineAnalysis.borderSavedAmount)}
                  </span>
                  <span className="text-blue-700 dark:text-blue-400">
                    Above-3 Saved ({borderlineAnalysis.above3SavedCount}):{' '}
                    {formatCompactRs(borderlineAnalysis.above3SavedAmount)}
                  </span>
                  <span className="text-red-700 dark:text-red-400">
                    Moved to NPL ({borderlineAnalysis.movedToNplCount}):{' '}
                    {formatCompactRs(borderlineAnalysis.movedToNplAmount)}
                  </span>
                </div>
              </div>
            ) : (
              <div>
                No accounts are currently sitting in the 61–90 DPD borderline window.
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              {worstAnalysis.totalCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-red-700 dark:text-red-400 font-medium">
                  <Flame className="w-3.5 h-3.5 shrink-0" />
                  {worstAnalysis.totalCount} WORST (W) ·{' '}
                  {formatCompactRs(worstAnalysis.totalClosingNpl)}
                </span>
              ) : (
                <span />
              )}
              <div className="flex flex-wrap items-center gap-3">
                {onOpenBorderlineCards && (
                  <button
                    type="button"
                    onClick={onOpenBorderlineCards}
                    className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline whitespace-nowrap"
                  >
                    Next-Month Borderline Cards →
                  </button>
                )}
                {onOpenWorstRadar && worstAnalysis.totalCount > 0 && (
                  <button
                    type="button"
                    onClick={onOpenWorstRadar}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                  >
                    Open WORST (W) Radar →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Officer Efforts & Age-Group Breakdown */}
      <OfficerEffortSummaryPanel
        aersRecords={aersRecords}
        aersMeta={aersMeta}
        mrpMap={mrpMap}
      />

      {/* Per-Officer Opening vs Closing Evaluation Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Per-Officer Opening vs. Closing NPL Summary (BM Reconciled)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Compares Opening NPL (Op Npl &gt; 0) against Closing NPL (NPL &gt; 0) per Recovery Officer with exact contract counts.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
            {officerRows.length} officers
          </span>
        </div>

        {officerRows.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
            No officer evaluation data yet. Upload an Age Evaluation report to generate Opening vs. Closing per officer.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-4">Recovery Officer</th>
                  <th className="py-2.5 px-3 text-right">Opening NPL</th>
                  <th className="py-2.5 px-3 text-right">Forecasted Border</th>
                  <th className="py-2.5 px-3 text-right">Moved to NPL</th>
                  <th className="py-2.5 px-3 text-right">Border Saving</th>
                  <th className="py-2.5 px-3 text-right">Saved Above 3</th>
                  <th className="py-2.5 px-3 text-right">Closing Debtor</th>
                  <th className="py-2.5 px-3 text-right">Closing NPL</th>
                  <th className="py-2.5 px-3 text-right">Next Border</th>
                  <th className="py-2.5 px-3 text-right">Efforts</th>
                  <th className="py-2.5 px-3 text-right">Worst (W)</th>
                  <th className="py-2.5 px-4 text-right">NPL Net Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                {officerRows.map((row) => {
                  const improved = row.nplReduction > 0;
                  const worsened = row.nplReduction < 0;
                  return (
                    <tr
                      key={row.officer}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar name={row.officer} sizeClass="w-7 h-7 text-[10px]" />
                          <div>
                            <span>{row.officer}</span>
                            <span className="block text-[10px] font-normal text-slate-500 dark:text-slate-400">
                              {row.closingCount} risk accts
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-900 dark:text-slate-100">
                        {formatCurrencyRs(row.openingNpl)}
                        <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                          {row.openingNplCount} accts
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                        {formatCurrencyRs(row.forecastedBorderAmount)}
                        <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                          {row.forecastedBorderCount} accts
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-red-600 dark:text-red-400">
                        {formatCurrencyRs(row.movedToNplAmount)}
                        <span className="block text-[10px]">
                          {row.movedToNplCount} moved
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-700 dark:text-emerald-400">
                        {formatCurrencyRs(row.borderSavedAmount)}
                        <span className="block text-[10px]">
                          {row.borderSavedCount} saved
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-blue-700 dark:text-blue-400">
                        {formatCurrencyRs(row.savedFromOpNplAmount)}
                        <span className="block text-[10px]">
                          {row.savedFromOpNplCount} accts
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-900 dark:text-slate-100">
                        {formatCompactRs(row.closingDebtor)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-red-600 dark:text-red-400">
                        {formatCurrencyRs(row.closingNpl)}
                        <span className="block text-[10px] font-normal">
                          {row.closingNplCount} accts
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-700 dark:text-amber-400">
                        {row.borderlineCount}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <span className="text-slate-900 dark:text-slate-100 font-medium">
                          {row.borderlineEfforts}
                        </span>
                        {row.zeroEffortBorderlineCount > 0 && (
                          <span className="block text-[10px] text-red-600 dark:text-red-400">
                            {row.zeroEffortBorderlineCount} zero-eff
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {row.worstCount > 0 ? (
                          <>
                            <span className="text-red-600 dark:text-red-400 font-semibold">
                              {row.worstCount}
                            </span>
                            <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                              {formatCompactRs(row.worstNpl)}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right font-mono font-semibold ${
                          improved
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : worsened
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {improved ? '+' : ''}
                        {formatCurrencyRs(row.nplReduction)}
                        {row.openingNpl > 0 && (
                          <span className="block text-[11px] font-normal">
                            {row.nplSaveRatePct > 0 ? '+' : ''}
                            {row.nplSaveRatePct.toFixed(1)}% saved
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-semibold tabular-nums">
                  <td className="py-2.5 px-4 text-slate-900 dark:text-slate-100">
                    Total Portfolio
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {formatCurrencyRs(officerTotals.openingNpl)}
                    <span className="block text-[10px] font-normal text-slate-500 dark:text-slate-400">
                      {officerTotals.openingNplCount} accts
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {formatCurrencyRs(officerTotals.forecastedBorderAmount)}
                    <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                      {officerTotals.forecastedBorderCount} accts
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-red-600 dark:text-red-400">
                    {formatCurrencyRs(officerTotals.movedToNplAmount)}
                    <span className="block text-[10px]">
                      {officerTotals.movedToNplCount} moved
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-700 dark:text-emerald-400">
                    {formatCurrencyRs(officerTotals.borderSavedAmount)}
                    <span className="block text-[10px]">
                      {officerTotals.borderSavedCount} saved
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-blue-700 dark:text-blue-400">
                    {formatCurrencyRs(officerTotals.savedFromOpNplAmount)}
                    <span className="block text-[10px]">
                      {officerTotals.savedFromOpNplCount} accts
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {formatCompactRs(officerTotals.closingDebtor)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-red-600 dark:text-red-400">
                    {formatCurrencyRs(officerTotals.closingNpl)}
                    <span className="block text-[10px] font-normal">
                      {officerTotals.closingNplCount} accts
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-amber-700 dark:text-amber-400">
                    {officerTotals.borderlineCount}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {officerTotals.borderlineEfforts}
                    {officerTotals.zeroEffortBorderlineCount > 0 && (
                      <span className="block text-[10px] text-red-600 dark:text-red-400">
                        {officerTotals.zeroEffortBorderlineCount} zero
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-red-600 dark:text-red-400">
                    {officerTotals.worstCount}
                  </td>
                  <td
                    className={`py-2.5 px-4 text-right font-mono ${
                      officerTotals.nplReduction > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : officerTotals.nplReduction < 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-slate-500'
                    }`}
                  >
                    {officerTotals.nplReduction > 0 ? '+' : ''}
                    {formatCurrencyRs(officerTotals.nplReduction)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
