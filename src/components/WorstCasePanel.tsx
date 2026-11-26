import { useMemo, useState } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  Flame,
  Plus,
  Search,
  ShieldAlert,
} from 'lucide-react';
import type {
  AersRecord,
  MrpEnrichment,
  TrackedContract,
} from '../types/recovery';
import {
  analyzeWorstCategory,
  formatCompactRs,
  formatCurrencyRs,
  normalizeContractNo,
  normalizeEvaluableFromAers,
  normalizeEvaluableFromTracked,
} from '../utils/recoveryEngine';
import { PaymentPatternStrip } from './PaymentPatternStrip';

interface WorstCasePanelProps {
  trackedContracts: TrackedContract[];
  aersRecords: AersRecord[];
  mrpMap?: Map<string, MrpEnrichment>;
  onAddFromMaster: (record: AersRecord) => void;
}

export function WorstCasePanel({
  trackedContracts,
  aersRecords,
  mrpMap,
  onAddFromMaster,
}: WorstCasePanelProps) {
  const [scope, setScope] = useState<'aers' | 'tracked'>(
    aersRecords.length > 0 ? 'aers' : 'tracked',
  );
  const [search, setSearch] = useState('');

  const trackedNos = useMemo(
    () => new Set(trackedContracts.map((c) => normalizeContractNo(c.contractNo))),
    [trackedContracts],
  );

  const trackedByNo = useMemo(() => {
    const m = new Map<string, TrackedContract>();
    trackedContracts.forEach((c) => m.set(normalizeContractNo(c.contractNo), c));
    return m;
  }, [trackedContracts]);

  const aersByNo = useMemo(() => {
    const m = new Map<string, AersRecord>();
    aersRecords.forEach((r) => m.set(normalizeContractNo(r.contractNo), r));
    return m;
  }, [aersRecords]);

  const evaluableItems = useMemo(() => {
    if (scope === 'aers' && aersRecords.length > 0) {
      return normalizeEvaluableFromAers(aersRecords, trackedNos);
    }
    return normalizeEvaluableFromTracked(trackedContracts);
  }, [scope, aersRecords, trackedNos, trackedContracts]);

  const analysis = useMemo(
    () => analyzeWorstCategory(evaluableItems),
    [evaluableItems],
  );

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return analysis.accounts;
    return analysis.accounts.filter(
      (a) =>
        a.contractNo.toLowerCase().includes(q) ||
        a.cusName.toLowerCase().includes(q) ||
        a.officeType.toLowerCase().includes(q) ||
        a.officer.toLowerCase().includes(q) ||
        a.vehicleNo.toLowerCase().includes(q) ||
        a.worstCaseProduct.toLowerCase().includes(q),
    );
  }, [analysis.accounts, search]);

  return (
    <div className="space-y-6">
      {/* Header & Rule Callout */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              WORST Category (Npl Reason: W) Priority Radar
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Any account marked <span className="font-mono font-semibold text-red-600 dark:text-red-400">Npl Reason = W</span> belongs to the WORST category and requires immediate attention regardless of its Current Age or DPD. Accounts with Op Npl &gt; 0 are evaluated strictly by DPD and Op Npl vs. Closing NPL.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg shrink-0 self-start lg:self-center">
          <button
            type="button"
            onClick={() => setScope('aers')}
            disabled={aersRecords.length === 0}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap disabled:opacity-40 ${
              scope === 'aers'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Full AERS ({aersRecords.length})
          </button>
          <button
            type="button"
            onClick={() => setScope('tracked')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              scope === 'tracked'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Tracked Watchlist ({trackedContracts.length})
          </button>
        </div>
      </div>

      {/* Worst Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 tabular-nums">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            WORST (W) Contracts
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-red-700 dark:text-red-400">
            {analysis.totalCount}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {analysis.lowDpdAttentionCount} with DPD &lt; 91 still flagged WORST
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            WORST Op Npl vs. Closing NPL
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
            {formatCurrencyRs(analysis.totalClosingNpl)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Opening Op Npl: {formatCompactRs(analysis.totalOpNpl)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            WORST Closing Debtor
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
            {formatCurrencyRs(analysis.totalClosingDebtor)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Total exposure in W category
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Assign Officer Efforts (WORST)
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
            {analysis.totalAssignEfforts}
          </div>
          <div className="mt-1 text-xs text-red-600 dark:text-red-400">
            {analysis.zeroEffortCount} contracts with 0 officer efforts
          </div>
        </div>
      </div>

      {/* Worst Case Contracts Preview Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              WORST Category Contracts Preview ({filteredAccounts.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Includes all Npl Reason = W contracts across every DPD bracket so high-risk accounts are never missed
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter contract, office type, RO, product..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        {filteredAccounts.length === 0 ? (
          <div className="p-10 text-center">
            <ShieldAlert className="w-6 h-6 text-slate-400 mx-auto" />
            <p className="mt-2 text-xs font-medium text-slate-800 dark:text-slate-200">
              No WORST (W) category contracts found in the current selection
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Upload or paste your daily AERS report containing the &ldquo;Npl Reason&rdquo; column with &ldquo;W&rdquo; entries to preview them here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-4">Contract &amp; Client</th>
                  <th className="py-2.5 px-3">Office Type &amp; RO</th>
                  <th className="py-2.5 px-3">Reason / Product</th>
                  <th className="py-2.5 px-3 text-right">DPD (Cur Age)</th>
                  <th className="py-2.5 px-3 text-right">Op Npl</th>
                  <th className="py-2.5 px-3 text-right">Closing NPL</th>
                  <th className="py-2.5 px-3 text-right">Closing Debtor</th>
                  <th className="py-2.5 px-3 text-right">Officer Efforts</th>
                  <th className="py-2.5 px-4 text-right">Watchlist</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                {filteredAccounts.map((item) => {
                  const normNo = normalizeContractNo(item.contractNo);
                  const masterRec = aersByNo.get(normNo);
                  const trackedRec = trackedByNo.get(normNo);
                  return (
                    <tr
                      key={item.contractNo}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 align-top"
                    >
                      <td className="py-2.5 px-4">
                        <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {item.contractNo}
                        </div>
                        <div className="text-slate-600 dark:text-slate-300">
                          {item.cusName}
                        </div>
                        <PaymentPatternStrip
                          mrp={mrpMap?.get(normNo) ?? trackedRec?.mrp}
                          lastPaidAmount={
                            masterRec?.lastPaidAmount ?? trackedRec?.lastPaidAmount
                          }
                          lastPayDate={
                            masterRec?.lastPayDate ?? trackedRec?.lastPayDate
                          }
                          totalCollection={
                            masterRec?.totalCollection ?? trackedRec?.totalCollection
                          }
                          showCategoryLine={true}
                          compact={true}
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {item.officeType}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          RO: {item.officer} {item.vehicleNo ? `· ${item.vehicleNo}` : ''}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800 whitespace-nowrap">
                          <AlertOctagon className="w-3 h-3 shrink-0" />
                          WORST ({item.nplReason})
                        </span>
                        {item.worstCaseProduct && (
                          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            {item.worstCaseProduct}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <span
                          className={`font-semibold ${
                            item.actualDpd >= 91
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {item.actualDpd} DPD
                        </span>
                        <span className="block text-[11px] text-slate-400">
                          Age {item.currentAge.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                        {formatCurrencyRs(item.opNpl)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-red-600 dark:text-red-400">
                        {formatCurrencyRs(item.closingNpl)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-900 dark:text-slate-100">
                        {formatCurrencyRs(item.closingDebtor)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <span
                          className={
                            item.assignOfficerEfforts <= 0
                              ? 'text-red-600 dark:text-red-400 font-semibold'
                              : 'text-slate-900 dark:text-slate-100'
                          }
                        >
                          {item.assignOfficerEfforts}
                        </span>
                        <span className="block text-[11px] text-slate-400">
                          Total: {item.totalEfforts}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        {item.isTracked ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Tracked
                          </span>
                        ) : masterRec ? (
                          <button
                            type="button"
                            onClick={() => onAddFromMaster(masterRec)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded bg-blue-600 text-white hover:bg-blue-700"
                          >
                            <Plus className="w-3 h-3" />
                            Track
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
