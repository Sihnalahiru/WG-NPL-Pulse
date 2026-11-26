import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, CalendarRange, Search, Users } from 'lucide-react';
import type {
  AersMetadata,
  AersRecord,
  MonthlySnapshot,
  MrpEnrichment,
  TrackedContract,
} from '../types/recovery';
import {
  CAMPAIGN_MONTHS,
  computeBmAgeBuckets,
  computeBmOfficerPerformance,
  formatCompactRs,
  formatCurrencyRs,
} from '../utils/recoveryEngine';
import { NextMonthBorderlineCardsPanel } from './NextMonthBorderlineCardsPanel';
import { OfficerEffortSummaryPanel } from './OfficerEffortSummaryPanel';

interface BmPortfolioAnalyticsPanelProps {
  aersRecords: AersRecord[];
  aersMeta?: AersMetadata | null;
  mrpMap?: Map<string, MrpEnrichment>;
  trackedContracts: TrackedContract[];
  monthlySnapshots: MonthlySnapshot[];
  isDark: boolean;
  onAddFromMaster?: (record: AersRecord) => void;
  onLogVisit?: (contract: TrackedContract) => void;
}

export function BmPortfolioAnalyticsPanel({
  aersRecords,
  aersMeta,
  mrpMap,
  trackedContracts,
  monthlySnapshots,
  isDark,
  onAddFromMaster,
  onLogVisit,
}: BmPortfolioAnalyticsPanelProps) {
  const [officerRole, setOfficerRole] = useState<'RO' | 'MO'>('RO');
  const [officerSearch, setOfficerSearch] = useState('');

  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#1e293b' : '#e2e8f0';
  const tooltipBg = isDark ? '#0f172a' : '#ffffff';
  const tooltipBorder = isDark ? '#334155' : '#e2e8f0';

  const ageBuckets = useMemo(() => {
    if (aersMeta?.bmBranchSnapshot?.ageBuckets?.length) {
      return aersMeta.bmBranchSnapshot.ageBuckets;
    }
    return computeBmAgeBuckets(aersRecords, trackedContracts);
  }, [aersMeta, aersRecords, trackedContracts]);

  const totalContracts = useMemo(
    () => ageBuckets.reduce((s, b) => s + b.count, 0),
    [ageBuckets],
  );

  const officerRows = useMemo(() => {
    const snapRows =
      officerRole === 'RO'
        ? aersMeta?.bmBranchSnapshot?.roPerformance
        : aersMeta?.bmBranchSnapshot?.moPerformance;
    const rows =
      snapRows && snapRows.length > 0
        ? snapRows
        : computeBmOfficerPerformance(aersRecords, trackedContracts, officerRole);
    const q = officerSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.officer.toLowerCase().includes(q));
  }, [aersMeta, aersRecords, trackedContracts, officerRole, officerSearch]);

  // Latest saved snapshot per campaign month (Nov 2026 -> Mar 2027)
  const campaignProgress = useMemo(() => {
    const byMonth = new Map<string, MonthlySnapshot>();
    const sorted = [...monthlySnapshots].sort((a, b) =>
      a.snapshotDate.localeCompare(b.snapshotDate),
    );
    for (const s of sorted) {
      const mKey = s.monthKey || s.snapshotDate.slice(0, 7);
      if (mKey) byMonth.set(mKey, s);
    }
    return CAMPAIGN_MONTHS.map((m) => ({
      ...m,
      snapshot: byMonth.get(m.monthKey) ?? null,
    }));
  }, [monthlySnapshots]);

  const dataScopeLabel =
    aersMeta?.bmBranchSnapshot
      ? `Full Branch AERS Snapshot (${totalContracts.toLocaleString()} contracts · ${aersRecords.length.toLocaleString()} NPL/Borderline)`
      : aersRecords.length > 0
        ? `NPL & Borderline AERS (${aersRecords.length.toLocaleString()} contracts)`
        : `Tracked Watchlist (${trackedContracts.length} contracts)`;

  return (
    <div className="space-y-6">
      {/* Monthly Campaign Progress (Nov 2026 - Mar 2027) */}
      <section
        aria-label="Monthly Progress Through March 2027"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <CalendarRange className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
                Monthly Campaign Progress (Nov 2026 – Mar 2027)
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Each month&apos;s branch &amp; watchlist progress is saved automatically on every workbook upload and preserved through March 2027.
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            Source: {dataScopeLabel}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 tabular-nums">
          {campaignProgress.map(({ monthKey, label, snapshot }) => (
            <div
              key={monthKey}
              className={`p-3.5 rounded-xl border transition-colors ${
                snapshot
                  ? 'bg-slate-50/90 dark:bg-slate-950/70 border-blue-200 dark:border-blue-900/70'
                  : 'bg-slate-50/40 dark:bg-slate-950/30 border-dashed border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {label}
                </span>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                  {snapshot ? snapshot.snapshotDate : 'Pending'}
                </span>
              </div>

              {snapshot ? (
                <div className="mt-2 space-y-1 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">
                      Branch NPL
                    </span>
                    <span className="font-mono font-semibold text-red-600 dark:text-red-400">
                      {formatCompactRs(
                        snapshot.branchNpl ?? snapshot.trackedNpl,
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">
                      NPL Saved
                    </span>
                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatCompactRs(snapshot.nplSavedAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">
                      Coll Eff %
                    </span>
                    <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                      {(
                        snapshot.branchCollectionPct ?? snapshot.collectionPct
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                  Upload workbook during {label} to lock month progress.
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Age Bucket Chart [A] to [I] */}
      <section
        aria-label="BM Age Bucket Distribution [A] to [I]"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
                Branch Age Bucket Distribution ([A] to [I])
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Contract counts and NPL exposure (Rs. Millions) across Zero &amp; Below through 12 &amp; Above.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-600 dark:text-slate-300 tabular-nums">
            Total: {totalContracts.toLocaleString()} contracts
          </span>
        </div>

        <div className="h-72 w-full">
          {totalContracts === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg px-4 text-center">
              Upload your WG_MRP_NOV_2026 or AERS Excel workbook to visualize branch-wide [A]–[I] age buckets.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={ageBuckets}
                margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis
                  dataKey="shortLabel"
                  tick={{ fill: axisColor, fontSize: 11 }}
                  axisLine={{ stroke: gridColor }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: axisColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: axisColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}M`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: tooltipBg,
                    borderColor: tooltipBorder,
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: unknown, name: unknown) => {
                    if (String(name).includes('NPL')) {
                      return [`Rs. ${Number(value).toFixed(2)}M`, String(name)];
                    }
                    return [Number(value).toLocaleString(), String(name)];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar
                  yAxisId="left"
                  dataKey="count"
                  name="Contract Count"
                  fill="#2563eb"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  yAxisId="right"
                  dataKey="nplMillions"
                  name="NPL Exposure (Rs. M)"
                  fill="#dc2626"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-t border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <th className="py-2 px-3">Code</th>
                <th className="py-2 px-3">Age Range</th>
                <th className="py-2 px-3 text-right">Contracts</th>
                <th className="py-2 px-3 text-right">Share %</th>
                <th className="py-2 px-3 text-right">Closing Debtor</th>
                <th className="py-2 px-3 text-right">NPL Exposure</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
              {ageBuckets.map((b) => {
                const pct =
                  totalContracts > 0
                    ? ((b.count / totalContracts) * 100).toFixed(1)
                    : '0.0';
                return (
                  <tr
                    key={b.code}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                  >
                    <td className="py-2 px-3 font-mono font-semibold text-blue-700 dark:text-blue-400">
                      {b.code}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100">
                      {b.label}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-900 dark:text-slate-100">
                      {b.count.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-500 dark:text-slate-400">
                      {pct}%
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                      {formatCurrencyRs(b.closingDebtor)}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-mono font-semibold ${
                        b.nplAmount > 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {formatCurrencyRs(b.nplAmount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Officer Performance Table (RO & MO) */}
      <section
        aria-label="Officer Performance Table RO and MO"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
      >
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
                Officer Performance Matrix (RO &amp; MO)
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Compare Collection Efficiency %, Net NPL Variance (Closing NPL − Op Npl), and Below 1 Age retention rate.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-52">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={officerSearch}
                onChange={(e) => setOfficerSearch(e.target.value)}
                placeholder="Filter officer (e.g. madusankal)..."
                aria-label="Filter officer performance table"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg">
              <button
                type="button"
                onClick={() => setOfficerRole('RO')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  officerRole === 'RO'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Recovery Officers (RO)
              </button>
              <button
                type="button"
                onClick={() => setOfficerRole('MO')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  officerRole === 'MO'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Marketing Officers (MO)
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4">
                  {officerRole === 'RO' ? 'Recovery Officer (RO)' : 'Marketing Officer (MO)'}
                </th>
                <th className="py-2.5 px-3 text-right">Accts</th>
                <th className="py-2.5 px-3 text-right">Due Budget</th>
                <th className="py-2.5 px-3 text-right">Total Collection</th>
                <th className="py-2.5 px-3 text-right">Collection Eff %</th>
                <th className="py-2.5 px-3 text-right">Op Npl</th>
                <th className="py-2.5 px-3 text-right">Closing NPL</th>
                <th className="py-2.5 px-3 text-right">Net NPL Variance</th>
                <th className="py-2.5 px-4 text-right">Below 1 Age Retention</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
              {officerRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-8 px-4 text-center text-xs text-slate-500 dark:text-slate-400"
                  >
                    No officer performance rows available. Upload an AERS/MRP workbook to calculate RO &amp; MO efficiency metrics.
                  </td>
                </tr>
              ) : (
                officerRows.map((row) => {
                  const varianceGood = row.netNplVariance <= 0;
                  return (
                    <tr
                      key={`${row.role}_${row.officer}`}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                    >
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                        {row.officer}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                        {row.totalCount.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                        {formatCompactRs(row.dueBudget)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-900 dark:text-slate-100">
                        {formatCompactRs(row.totalCollection)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold">
                        <span
                          className={
                            row.collectionEfficiencyPct >= 90
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : row.collectionEfficiencyPct >= 65
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-red-600 dark:text-red-400'
                          }
                        >
                          {row.collectionEfficiencyPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                        {formatCompactRs(row.opNpl)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-900 dark:text-slate-100">
                        {formatCompactRs(row.closingNpl)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono font-semibold ${
                          varianceGood
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {row.netNplVariance > 0 ? '+' : ''}
                        {formatCompactRs(row.netNplVariance)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono">
                        <span className="font-semibold text-blue-700 dark:text-blue-400">
                          {row.belowOneRetentionPct.toFixed(1)}%
                        </span>
                        <span className="ml-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                          ({row.belowOneCount}/{row.opBelowOneCount || row.totalCount})
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Visual Next-Month Borderline Risk Cards with Per-Officer Filters */}
      <NextMonthBorderlineCardsPanel
        trackedContracts={trackedContracts}
        aersRecords={aersRecords}
        mrpMap={mrpMap}
        onAddFromMaster={onAddFromMaster}
        onLogVisit={onLogVisit}
      />

      {/* High-Risk (Borderline & NPL) Field Effort Summary grouped by RO & Office Type */}
      <OfficerEffortSummaryPanel
        aersRecords={aersRecords}
        trackedContracts={trackedContracts}
        mrpMap={mrpMap}
      />
    </div>
  );
}
