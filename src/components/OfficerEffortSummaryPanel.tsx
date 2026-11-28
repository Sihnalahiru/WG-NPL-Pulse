import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpDown,
  Building2,
  Layers,
  Search,
  UserCheck,
} from 'lucide-react';
import officerFieldEffortsImg from '../assets/images/officer_field_efforts_1795684834158.jpg';
import type {
  AersMetadata,
  AersRecord,
  MrpEnrichment,
} from '../types/recovery';
import {
  computeAgeGroupEfforts,
  computeOfficerEffortSummary,
  formatCompactRs,
} from '../utils/recoveryEngine';
import { UserAvatar } from './UserAvatar';

interface OfficerEffortSummaryPanelProps {
  aersRecords: AersRecord[];
  aersMeta?: AersMetadata | null;
  mrpMap?: Map<string, MrpEnrichment>;
}

type SortKey =
  | 'assignOfficerEfforts'
  | 'totalEfforts'
  | 'highRiskCount'
  | 'avgAssignEfforts'
  | 'zeroEffortCount'
  | 'highRiskExposure';

export function OfficerEffortSummaryPanel({
  aersRecords,
  aersMeta,
  mrpMap,
}: OfficerEffortSummaryPanelProps) {
  const [riskFilter, setRiskFilter] = useState<'all' | 'borderline' | 'npl'>('all');
  const [officeFilter, setOfficeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('assignOfficerEfforts');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const ageGroupRows = useMemo(() => {
    if (aersMeta?.bmBranchSnapshot?.ageGroupEfforts?.length) {
      return aersMeta.bmBranchSnapshot.ageGroupEfforts;
    }
    return computeAgeGroupEfforts(aersRecords);
  }, [aersMeta, aersRecords]);

  const ageGroupTotals = useMemo(
    () =>
      ageGroupRows.reduce(
        (acc, g) => ({
          contracts: acc.contracts + g.count,
          assignEfforts: acc.assignEfforts + g.assignOfficerEfforts,
          totalEfforts: acc.totalEfforts + g.totalEfforts,
          zeroEffortCount: acc.zeroEffortCount + g.zeroEffortCount,
          closingDebtor: acc.closingDebtor + g.closingDebtor,
          nplAmount: acc.nplAmount + g.nplAmount,
        }),
        {
          contracts: 0,
          assignEfforts: 0,
          totalEfforts: 0,
          zeroEffortCount: 0,
          closingDebtor: 0,
          nplAmount: 0,
        },
      ),
    [ageGroupRows],
  );

  const baseRows = useMemo(
    () =>
      computeOfficerEffortSummary(aersRecords, [], {
        scope: 'aers',
        riskFilter,
        mrpMap,
      }),
    [aersRecords, riskFilter, mrpMap],
  );

  const officeTypes = useMemo(() => {
    const set = new Set<string>();
    baseRows.forEach((r) => set.add(r.officeType));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [baseRows]);

  const filteredAndSortedRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = baseRows.filter((r) => {
      if (officeFilter !== 'ALL' && r.officeType !== officeFilter) return false;
      if (q) {
        return (
          r.ro.toLowerCase().includes(q) ||
          r.officeType.toLowerCase().includes(q)
        );
      }
      return true;
    });

    list.sort((a, b) => {
      const diff = a[sortBy] - b[sortBy];
      return sortDir === 'desc' ? -diff : diff;
    });

    return list;
  }, [baseRows, officeFilter, searchQuery, sortBy, sortDir]);

  const totals = useMemo(() => {
    return filteredAndSortedRows.reduce(
      (acc, r) => ({
        highRiskCount: acc.highRiskCount + r.highRiskCount,
        borderlineCount: acc.borderlineCount + r.borderlineCount,
        nplCount: acc.nplCount + r.nplCount,
        assignOfficerEfforts: acc.assignOfficerEfforts + r.assignOfficerEfforts,
        borderlineAssignEfforts:
          acc.borderlineAssignEfforts + r.borderlineAssignEfforts,
        nplAssignEfforts: acc.nplAssignEfforts + r.nplAssignEfforts,
        totalEfforts: acc.totalEfforts + r.totalEfforts,
        zeroEffortCount: acc.zeroEffortCount + r.zeroEffortCount,
        highRiskExposure: acc.highRiskExposure + r.highRiskExposure,
      }),
      {
        highRiskCount: 0,
        borderlineCount: 0,
        nplCount: 0,
        assignOfficerEfforts: 0,
        borderlineAssignEfforts: 0,
        nplAssignEfforts: 0,
        totalEfforts: 0,
        zeroEffortCount: 0,
        highRiskExposure: 0,
      },
    );
  }, [filteredAndSortedRows]);

  const maxAssignEfforts = useMemo(
    () =>
      filteredAndSortedRows.reduce(
        (max, r) => Math.max(max, r.assignOfficerEfforts),
        0,
      ),
    [filteredAndSortedRows],
  );

  const topOfficer = filteredAndSortedRows[0] ?? null;

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(key);
      setSortDir('desc');
    }
  };

  return (
    <section
      aria-label="Officer Effort Summary and Age-Group Breakdown"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
    >
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="hidden sm:block w-24 h-14 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-950">
              <img
                src={officerFieldEffortsImg}
                alt="Officer Effort Analytics Illustration"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
                  Officer Effort Summary &amp; Age-Group Breakdown
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Tracks <strong className="font-medium text-slate-700 dark:text-slate-300">Assign Officer Efforts</strong> and <strong className="font-medium text-slate-700 dark:text-slate-300">Total Efforts</strong> across Age Groups (≤1.00 to 6.00+) and by RO / Office Type.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg">
              {(['all', 'borderline', 'npl'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setRiskFilter(mode)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    riskFilter === mode
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {mode === 'all'
                    ? 'Borderline + NPL'
                    : mode === 'borderline'
                      ? 'Borderline Only'
                      : 'NPL Only'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Age-Group Wise Effort Breakdown */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Age-Group Wise Effort Breakdown (වයස් කාණ්ඩ අනුව උත්සාහයන්)
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              {ageGroupTotals.contracts.toLocaleString()} accts ·{' '}
              {ageGroupTotals.assignEfforts.toLocaleString()} Assign /{' '}
              {ageGroupTotals.totalEfforts.toLocaleString()} Total Efforts
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-2 px-4">Age Group</th>
                  <th className="py-2 px-3 text-right">Contracts</th>
                  <th className="py-2 px-3 text-right">Assign Efforts</th>
                  <th className="py-2 px-3 text-right">Total Efforts</th>
                  <th className="py-2 px-3 text-right">Avg / Acct</th>
                  <th className="py-2 px-3 text-right">0-Effort Accts</th>
                  <th className="py-2 px-3 text-right">Closing Debtor</th>
                  <th className="py-2 px-4 text-right">NPL Exposure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70 tabular-nums">
                {ageGroupRows.map((g) => (
                  <tr
                    key={g.key}
                    className="hover:bg-white/80 dark:hover:bg-slate-900/60"
                  >
                    <td className="py-2 px-4 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {g.label}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                      {g.count.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-blue-700 dark:text-blue-400">
                      {g.assignOfficerEfforts.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {g.totalEfforts.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-mono">
                      <span
                        className={
                          g.avgAssignEfforts >= 2
                            ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                            : g.avgAssignEfforts >= 1
                              ? 'text-slate-900 dark:text-slate-100'
                              : 'text-amber-700 dark:text-amber-400 font-semibold'
                        }
                      >
                        {g.avgAssignEfforts.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono">
                      {g.zeroEffortCount > 0 ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-semibold rounded bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800">
                          {g.zeroEffortCount.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          0
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                      {formatCompactRs(g.closingDebtor)}
                    </td>
                    <td
                      className={`py-2 px-4 text-right font-mono font-semibold ${
                        g.nplAmount > 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {formatCompactRs(g.nplAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Strip & Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs tabular-nums">
            <div className="px-3 py-1.5 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/60">
              <span className="text-slate-600 dark:text-slate-400">
                Assign Efforts:{' '}
              </span>
              <span className="font-mono font-bold text-blue-700 dark:text-blue-300">
                {totals.assignOfficerEfforts.toLocaleString()}
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-400">
                Total Efforts:{' '}
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {totals.totalEfforts.toLocaleString()}
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-red-50/70 dark:bg-red-950/30 border border-red-200/80 dark:border-red-900/60">
              <span className="text-red-700 dark:text-red-300">
                0-Effort Accts:{' '}
              </span>
              <span className="font-mono font-bold text-red-700 dark:text-red-300">
                {totals.zeroEffortCount}
              </span>
            </div>
            {topOfficer && sortBy === 'assignOfficerEfforts' && sortDir === 'desc' && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                <UserCheck className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Top Efforts: <strong>{topOfficer.ro}</strong> ({topOfficer.officeType}) ·{' '}
                  <span className="font-mono font-semibold">
                    {topOfficer.assignOfficerEfforts}
                  </span>
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={officeFilter}
              onChange={(e) => setOfficeFilter(e.target.value)}
              aria-label="Filter by Office Type"
              className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="ALL">All Office Types ({officeTypes.length})</option>
              {officeTypes.map((ot) => (
                <option key={ot} value={ot}>
                  {ot}
                </option>
              ))}
            </select>

            <div className="relative w-52">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search RO or Office Type..."
                aria-label="Search RO or Office Type"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>
        </div>
      </div>

      {filteredAndSortedRows.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
          No Borderline or NPL effort records found. Upload an AERS/MRP workbook to view officer effort metrics.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4 whitespace-nowrap">RO (Recovery Officer)</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Office Type</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('highRiskCount')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    High-Risk Accts
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('assignOfficerEfforts')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    Assign Officer Efforts
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('totalEfforts')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    Total Efforts
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('avgAssignEfforts')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    Avg / Acct
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('zeroEffortCount')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    Zero-Effort
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('highRiskExposure')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    NPL / Risk Exposure
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
              {filteredAndSortedRows.map((row) => {
                const barWidthPct =
                  maxAssignEfforts > 0
                    ? Math.round((row.assignOfficerEfforts / maxAssignEfforts) * 100)
                    : 0;
                return (
                  <tr
                    key={`${row.ro}__${row.officeType}`}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                  >
                    <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        <UserAvatar name={row.ro} sizeClass="w-6 h-6 text-[10px]" />
                        {row.ro}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300">
                        <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                        {row.officeType}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {row.highRiskCount}
                      </span>
                      <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                        {row.borderlineCount} Border · {row.nplCount} NPL
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono min-w-[165px]">
                      <div className="font-bold text-blue-700 dark:text-blue-400">
                        {row.assignOfficerEfforts.toLocaleString()}
                      </div>
                      <div className="mt-1 h-1.5 w-24 ml-auto rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-600 dark:bg-blue-400"
                          style={{ width: `${barWidthPct}%` }}
                        />
                      </div>
                      <span className="block text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        B: {row.borderlineAssignEfforts} · N: {row.nplAssignEfforts}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {row.totalEfforts.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      <span
                        className={
                          row.avgAssignEfforts >= 2
                            ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                            : row.avgAssignEfforts >= 1
                              ? 'text-slate-900 dark:text-slate-100 font-medium'
                              : 'text-amber-700 dark:text-amber-400 font-semibold'
                        }
                      >
                        {row.avgAssignEfforts.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      {row.zeroEffortCount > 0 ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-semibold rounded bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800">
                          {row.zeroEffortCount}
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          0
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {formatCompactRs(row.highRiskExposure)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-semibold tabular-nums">
                <td className="py-2.5 px-4 text-slate-900 dark:text-slate-100" colSpan={2}>
                  Total ({filteredAndSortedRows.length} RO / Office Groups)
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-slate-900 dark:text-slate-100">
                  {totals.highRiskCount}
                  <span className="block text-[10px] font-normal text-slate-500 dark:text-slate-400">
                    {totals.borderlineCount}B · {totals.nplCount}N
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-blue-700 dark:text-blue-400">
                  {totals.assignOfficerEfforts.toLocaleString()}
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-slate-900 dark:text-slate-100">
                  {totals.totalEfforts.toLocaleString()}
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-300">
                  {totals.highRiskCount > 0
                    ? (totals.assignOfficerEfforts / totals.highRiskCount).toFixed(1)
                    : '0.0'}
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-red-600 dark:text-red-400">
                  {totals.zeroEffortCount}
                </td>
                <td className="py-2.5 px-4 text-right font-mono text-slate-900 dark:text-slate-100">
                  {formatCompactRs(totals.highRiskExposure)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
