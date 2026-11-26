import { useMemo, useState } from 'react';
import {
  Check,
  Database,
  Download,
  Plus,
  Search,
  Upload,
} from 'lucide-react';
import type { AersMetadata, AersRecord, MrpEnrichment } from '../types/recovery';
import {
  downloadSampleAersExcel,
  formatCurrencyRs,
  normalizeContractNo,
} from '../utils/recoveryEngine';
import { PaymentPatternStrip } from './PaymentPatternStrip';

interface AersLookupPanelProps {
  aersRecords: AersRecord[];
  aersMeta: AersMetadata | null;
  mrpMap?: Map<string, MrpEnrichment>;
  trackedContractNos: Set<string>;
  onUploadAersFile: (file: File) => void;
  onAddFromMaster: (record: AersRecord) => void;
}

export function AersLookupPanel({
  aersRecords,
  aersMeta,
  mrpMap,
  trackedContractNos,
  onUploadAersFile,
  onAddFromMaster,
}: AersLookupPanelProps) {
  const [query, setQuery] = useState('');

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const hits: AersRecord[] = [];
    for (const r of aersRecords) {
      if (
        r.contractNo.toLowerCase().includes(q) ||
        r.cusName.toLowerCase().includes(q) ||
        r.currentStock.toLowerCase().includes(q) ||
        r.recoveryOfficer.toLowerCase().includes(q)
      ) {
        hits.push(r);
        if (hits.length >= 25) break;
      }
    }
    return hits;
  }, [query, aersRecords]);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            NPL &amp; Borderline Master Lookup Database
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Uploaded AERS / MRP workbooks (Row 2 Printed Date &amp; Row 3 headers) are filtered strictly to Current NPL and Borderline NPL contracts in background state and localStorage. Performing accounts are excluded automatically.
          </p>
          {aersMeta && (
            <p className="mt-2 text-xs font-mono text-slate-600 dark:text-slate-300 tabular-nums">
              {aersMeta.fileName} · {aersMeta.totalContractsCount.toLocaleString()} NPL/Borderline indexed
              {aersMeta.excludedRegularCount
                ? ` · ${aersMeta.excludedRegularCount.toLocaleString()} regular excluded`
                : ''}{' '}
              · Printed {aersMeta.printedDateTime}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => downloadSampleAersExcel(aersRecords)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            {aersRecords.length === 0 ? 'Download Blank AERS Template' : 'Export Indexed AERS (.xlsx)'}
          </button>

          <label className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer whitespace-nowrap">
            <Upload className="w-3.5 h-3.5" />
            Upload AERS Report
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUploadAersFile(file);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Query Master Lookup On Demand
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Search by CONTRACT_NO, Client Name, Vehicle/Stock, or RO to pull a contract into your active Watchlist (capped to 25 matches).
            </p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type e.g. WGFBA070001 or client name..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        {!query.trim() ? (
          <div className="py-10 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
            <Database className="w-6 h-6 text-slate-400 mx-auto" />
            <p className="mt-2 text-xs font-medium text-slate-700 dark:text-slate-300">
              {aersRecords.length.toLocaleString()} AERS contracts indexed silently
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Enter a contract number or customer name above to inspect a record or add it to your active Watchlist.
            </p>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
            No matching contracts found in AERS Master Lookup for &ldquo;{query}&rdquo;.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-3">CONTRACT_NO</th>
                  <th className="py-2.5 px-3">CUS_NAME</th>
                  <th className="py-2.5 px-3">RO</th>
                  <th className="py-2.5 px-3 text-right">DPD / Fcst</th>
                  <th className="py-2.5 px-3 text-right">Closing Debtor</th>
                  <th className="py-2.5 px-3 text-right">NPL</th>
                  <th className="py-2.5 px-3 text-right">Watchlist</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                {searchResults.map((r) => {
                  const normNo = normalizeContractNo(r.contractNo);
                  const isTracked = trackedContractNos.has(normNo);
                  return (
                    <tr
                      key={r.contractNo}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 align-top"
                    >
                      <td className="py-2.5 px-3">
                        <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {r.contractNo}
                        </div>
                        <PaymentPatternStrip
                          mrp={mrpMap?.get(normNo)}
                          lastPaidAmount={r.lastPaidAmount}
                          lastPayDate={r.lastPayDate}
                          totalCollection={r.totalCollection}
                          showCategoryLine={true}
                          compact={true}
                        />
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-200">
                        {r.cusName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        {r.recoveryOfficer || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-900 dark:text-slate-100">
                        {r.actualDpd} / {r.monthEndForecastDpd}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-900 dark:text-slate-100">
                        {formatCurrencyRs(r.closingDebtor)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-red-600 dark:text-red-400">
                        {formatCurrencyRs(r.npl)}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {isTracked ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                            <Check className="w-3.5 h-3.5" />
                            Tracked
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onAddFromMaster(r)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded bg-blue-600 text-white hover:bg-blue-700"
                          >
                            <Plus className="w-3 h-3" />
                            Add to Watchlist
                          </button>
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
