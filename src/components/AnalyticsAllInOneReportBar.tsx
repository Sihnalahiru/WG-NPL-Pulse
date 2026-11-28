import { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  FileSpreadsheet,
  FileText,
  Layers,
  MessageCircle,
  Share2,
} from 'lucide-react';
import type {
  AersMetadata,
  AersRecord,
  MonthlySnapshot,
  MrpEnrichment,
} from '../types/recovery';
import {
  downloadAllInOneExcelReport,
  downloadAllInOnePdfReport,
  shareAllInOneReport,
} from '../utils/allInOneReportExporter';
import {
  formatCompactRs,
  getBranchPortfolioTotals,
  reconcileBelowThreeFromBmSnapshot,
} from '../utils/recoveryEngine';

interface AnalyticsAllInOneReportBarProps {
  aersRecords: AersRecord[];
  aersMeta: AersMetadata | null;
  mrpMap?: Map<string, MrpEnrichment>;
  monthlySnapshots: MonthlySnapshot[];
  onNotify?: (title: string, detail: string, tone?: 'success' | 'info' | 'error') => void;
}

export function AnalyticsAllInOneReportBar({
  aersRecords,
  aersMeta,
  mrpMap,
  monthlySnapshots,
  onNotify,
}: AnalyticsAllInOneReportBarProps) {
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const summary = useMemo(() => {
    const branchTotals = getBranchPortfolioTotals(aersMeta, aersRecords, 'ALL');
    const belowThree =
      aersMeta?.bmBranchSnapshot?.belowThreeSummary &&
      aersMeta.bmBranchSnapshot.belowThreeSummary.byOfficer.length > 0
        ? aersMeta.bmBranchSnapshot.belowThreeSummary
        : reconcileBelowThreeFromBmSnapshot(aersRecords, aersMeta?.bmBranchSnapshot);

    return { branchTotals, belowThree };
  }, [aersMeta, aersRecords]);

  const reportInput = useMemo(
    () => ({
      aersRecords,
      aersMeta,
      mrpMap,
      monthlySnapshots,
    }),
    [aersRecords, aersMeta, mrpMap, monthlySnapshots],
  );

  const handleDownloadExcel = () => {
    try {
      setBusyAction('excel');
      const { fileName, sheetCount } = downloadAllInOneExcelReport(reportInput);
      onNotify?.(
        'All-in-One Excel Downloaded',
        `Saved ${fileName} with ${sheetCount} reconciled sheets (Executive Summary, RO & MO Performance, Below 3, Age Buckets, Office Strategy, Borderline/Worst).`,
        'success',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Excel export failed.';
      onNotify?.('Export Failed', msg, 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDownloadPdf = () => {
    try {
      setBusyAction('pdf');
      const { fileName } = downloadAllInOnePdfReport(reportInput);
      onNotify?.(
        'All-in-One PDF Downloaded',
        `Saved ${fileName} with full Branch Portfolio, RO/MO Performance, Below 3 Variance, Age Buckets & Priority Risk tables.`,
        'success',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'PDF export failed.';
      onNotify?.('PDF Export Failed', msg, 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const handleShare = async (
    mode: 'whatsapp' | 'native_excel' | 'native_pdf' | 'copy',
  ) => {
    try {
      setBusyAction(mode);
      const res = await shareAllInOneReport(reportInput, mode);
      if (mode === 'copy' && res.tone === 'success') {
        setCopiedSummary(true);
        setTimeout(() => setCopiedSummary(false), 2000);
      }
      onNotify?.(res.title, res.detail, res.tone);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Share failed.';
      onNotify?.('Share Failed', msg, 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const { branchTotals, belowThree } = summary;

  return (
    <section
      aria-label="All-in-One Total Reports Export and Share"
      className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden"
    >
      <div className="h-1 bg-gradient-to-r from-red-700 via-rose-600 to-amber-500" />
      <div className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200/80 dark:border-red-900/60 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5 text-red-700 dark:text-red-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                All-in-One Total Branch Reports — Download &amp; Share Pack
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                Export or share the complete reconciled branch pack in one click: Executive Summary, RO &amp; MO Performance, Below 3 Collection &amp; Variance, Age Buckets, Office Strategy, and Borderline/Worst Priority List.
              </p>
            </div>
          </div>

          <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 shrink-0 tabular-nums">
            Snapshot: {aersMeta?.printedDateTime || 'Live'}
          </div>
        </div>

        {/* Live Reconciled Pack Preview Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-xs tabular-nums">
          <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Branch Contracts
            </div>
            <div className="font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100 mt-0.5">
              {branchTotals.totalContracts.toLocaleString()}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              RO / MO Split
            </div>
            <div className="font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100 mt-0.5">
              {branchTotals.roContractsCount.toLocaleString()} / {branchTotals.moContractsCount.toLocaleString()}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Closing NPL
            </div>
            <div className="font-mono font-bold text-sm text-red-700 dark:text-red-400 mt-0.5">
              {formatCompactRs(branchTotals.totalClosingNpl)}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              90 Ratio (Below 1)
            </div>
            <div className="font-mono font-bold text-sm text-emerald-700 dark:text-emerald-400 mt-0.5">
              {branchTotals.ratio90Pct.toFixed(1)}%
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Below 3 Collection
            </div>
            <div className="font-mono font-bold text-sm text-amber-700 dark:text-amber-400 mt-0.5">
              {belowThree.collectionPct.toFixed(1)}% · {formatCompactRs(belowThree.collectedAmount)}
            </div>
          </div>
        </div>

        {/* Action Buttons — Touch-friendly on Mobile, Crisp Row on Desktop */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2.5"
          data-snapshot-ignore="true"
        >
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={handleDownloadExcel}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            <span>
              {busyAction === 'excel' ? 'Building Excel…' : 'Download All-in-One Excel'}
            </span>
          </button>

          <button
            type="button"
            disabled={busyAction !== null}
            onClick={handleDownloadPdf}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 active:scale-[0.99] text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span>
              {busyAction === 'pdf' ? 'Building PDF…' : 'Download Total PDF'}
            </span>
          </button>

          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => handleShare('whatsapp')}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 active:scale-[0.99] text-emerald-800 dark:text-emerald-300 text-xs font-semibold transition-all disabled:opacity-50"
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            <span>Share on WhatsApp</span>
          </button>

          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => handleShare('native_pdf')}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 active:scale-[0.99] text-zinc-800 dark:text-zinc-100 text-xs font-semibold transition-all disabled:opacity-50"
          >
            <Share2 className="w-4 h-4 shrink-0 text-red-700 dark:text-red-400" />
            <span>
              {busyAction === 'native_pdf' ? 'Preparing Share…' : 'Share PDF Pack'}
            </span>
          </button>

          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => handleShare('copy')}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-[0.99] text-zinc-700 dark:text-zinc-200 text-xs font-semibold transition-all disabled:opacity-50"
          >
            {copiedSummary ? (
              <>
                <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                <span className="text-emerald-700 dark:text-emerald-400">Summary Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 shrink-0 text-zinc-500" />
                <span>Copy Summary</span>
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
