import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Cloud,
  CloudOff,
  CloudUpload,
  FileSpreadsheet,
  FileText,
  Globe,
  HardDrive,
  History,
  KeyRound,
  Laptop,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import type { AersMetadata, FileUploadHistoryEntry } from '../types/recovery';
import {
  captureSystemActiveDateTime,
  formatCompactRs,
  getTodayISO,
} from '../utils/recoveryEngine';
import {
  hasConfiguredGithubToken,
  hydratePermanentGithubToken,
  LIVE_SYNC_REPO_LABEL,
  subscribeGithubTokenChange,
} from '../utils/githubSync';

interface UploadHistoryPanelProps {
  uploadHistory: FileUploadHistoryEntry[];
  aersMeta: AersMetadata | null;
  isAdmin: boolean;
  isSyncingCloud: boolean;
  lastCloudSyncAt: string | null;
  onSyncLiveNow: () => void;
  onForcePublishNow: () => Promise<void>;
  onOpenAdminModal: () => void;
  onClearHistory: () => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function UploadHistoryPanel({
  uploadHistory,
  aersMeta,
  isAdmin,
  isSyncingCloud,
  lastCloudSyncAt,
  onSyncLiveNow,
  onForcePublishNow,
  onOpenAdminModal,
  onClearHistory,
}: UploadHistoryPanelProps) {
  const [nowClock, setNowClock] = useState(() => captureSystemActiveDateTime());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'published_live' | 'local_only' | 'sync_failed'
  >('all');
  const [isPublishing, setIsPublishing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [hasGhToken, setHasGhToken] = useState(() => hasConfiguredGithubToken());

  useEffect(() => {
    const refresh = () => setHasGhToken(hasConfiguredGithubToken());
    hydratePermanentGithubToken().then(refresh).catch(() => {});
    return subscribeGithubTokenChange(refresh);
  }, []);

  // Keep live active system clock ticking every second so Admin sees exact date/time stamped on uploads
  useEffect(() => {
    const timer = setInterval(() => {
      setNowClock(captureSystemActiveDateTime());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const filteredHistory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return uploadHistory.filter((entry) => {
      if (statusFilter !== 'all' && entry.cloudSyncStatus !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        entry.fileName.toLowerCase().includes(q) ||
        entry.systemDate.toLowerCase().includes(q) ||
        entry.systemTime.toLowerCase().includes(q) ||
        entry.fileType.toLowerCase().includes(q) ||
        (entry.snapshotAction || '').toLowerCase().includes(q) ||
        (entry.cloudSyncNote || '').toLowerCase().includes(q)
      );
    });
  }, [uploadHistory, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = uploadHistory.length;
    const livePublished = uploadHistory.filter(
      (e) => e.cloudSyncStatus === 'published_live',
    ).length;
    const localOnly = uploadHistory.filter(
      (e) => e.cloudSyncStatus === 'local_only',
    ).length;
    const failed = uploadHistory.filter(
      (e) => e.cloudSyncStatus === 'sync_failed',
    ).length;
    const latest = uploadHistory[0] ?? null;
    return { total, livePublished, localOnly, failed, latest };
  }, [uploadHistory]);

  const handlePublishClick = async () => {
    if (isPublishing) return;
    setIsPublishing(true);
    try {
      await onForcePublishNow();
    } catch {
      // Handled via App toast / Admin modal
    } finally {
      setIsPublishing(false);
    }
  };

  const handleExportExcel = () => {
    const rows = uploadHistory.map((item, idx) => ({
      '#': idx + 1,
      'System Active Date': item.systemDate,
      'System Active Time': item.systemTime,
      'Display Date & Time': item.systemDateTimeLabel,
      'Time Zone': item.timeZone,
      'File Name': item.fileName,
      'Upload Type': item.fileType,
      'File Size': formatBytes(item.fileSizeBytes),
      'Excel Header Printed Time': item.excelPrintedDateTime || '—',
      'Indexed Accounts': item.recordsCount,
      'Total Portfolio': item.totalPortfolioCount ?? item.recordsCount,
      'Closing NPL Count': item.nplCount ?? '',
      'Closing NPL Amount (Rs.)': item.closingNplAmount ?? '',
      'Snapshot Action': item.snapshotAction || '—',
      'Live Cloud Status':
        item.cloudSyncStatus === 'published_live'
          ? 'Published Live'
          : item.cloudSyncStatus === 'sync_failed'
            ? 'Sync Failed'
            : 'Local Only',
      'Sync Detail': item.cloudSyncNote || '',
      'Uploaded By': item.uploadedBy,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Upload History');
    XLSX.writeFile(wb, `WG_Pulse_Upload_History_${getTodayISO()}.xlsx`);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Live Auto-Sync & Active System Clock Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/70 text-red-700 dark:text-red-300">
                <History className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  File Upload History &amp; Live Auto-Sync Log
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Active system date &amp; time is automatically stamped on every upload and broadcast live to Web URL &amp; installed Windows PC Apps.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onSyncLiveNow}
              disabled={isSyncingCloud}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin text-red-600' : ''}`}
              />
              {isSyncingCloud ? 'Checking Live...' : 'Check Live Update Now'}
            </button>

            {isAdmin && hasGhToken ? (
              <button
                type="button"
                onClick={handlePublishClick}
                disabled={isPublishing}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
              >
                <CloudUpload className="w-3.5 h-3.5" />
                {isPublishing ? 'Publishing Live...' : 'Publish Live Now'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAdminModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-red-700 hover:bg-red-800 text-white"
              >
                <KeyRound className="w-3.5 h-3.5" />
                {isAdmin ? 'Set Live Publish Token' : 'Admin Live Setup'}
              </button>
            )}

            {uploadHistory.length > 0 && (
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-emerald-200 dark:border-emerald-900/70 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Export Log (.xlsx)
              </button>
            )}
          </div>
        </div>

        {/* Live System Clock + Web URL & Windows PC App Sync Architecture Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Active System Clock */}
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5 text-red-600" />
                Active System Date &amp; Time
              </span>
              <span className="font-mono text-[10px] text-zinc-400">
                {nowClock.timeZone}
              </span>
            </div>
            <div className="text-lg font-bold font-mono text-zinc-900 dark:text-zinc-100 tabular-nums">
              {nowClock.systemDate} · {nowClock.systemTime12h}
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Auto-picked automatically when Admin uploads any AERS Excel or Backup file.
            </p>
          </div>

          {/* Web URL & Windows PC App Live Viewer Sync */}
          <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900/60 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              <span className="inline-flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                URL &amp; Windows PC App Live Sync
              </span>
              <Laptop className="w-3.5 h-3.5" />
            </div>
            <div className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
              Auto-Checking Live Updates (Every 60s)
            </div>
            <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 leading-relaxed">
              Anyone opening the live URL or installed Windows PC app receives new Admin uploads automatically without refreshing.
              {lastCloudSyncAt ? ` Last checked: ${lastCloudSyncAt}.` : ''}
            </p>
          </div>

          {/* Admin Auto-Publish Engine */}
          <div
            className={`p-4 rounded-xl border space-y-1.5 ${
              hasGhToken
                ? 'bg-blue-50/60 dark:bg-blue-950/25 border-blue-200 dark:border-blue-900/60'
                : 'bg-amber-50/70 dark:bg-amber-950/25 border-amber-200 dark:border-amber-900/60'
            }`}
          >
            <div
              className={`flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider ${
                hasGhToken
                  ? 'text-blue-800 dark:text-blue-300'
                  : 'text-amber-800 dark:text-amber-300'
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                {hasGhToken ? (
                  <Cloud className="w-3.5 h-3.5" />
                ) : (
                  <CloudOff className="w-3.5 h-3.5" />
                )}
                Admin Auto-Publish on Upload
              </span>
              <span className="font-mono text-[10px]">{LIVE_SYNC_REPO_LABEL}</span>
            </div>
            <div
              className={`text-sm font-bold ${
                hasGhToken
                  ? 'text-blue-900 dark:text-blue-200'
                  : 'text-amber-900 dark:text-amber-200'
              }`}
            >
              {hasGhToken
                ? 'Permanent Token Locked · Never Expires'
                : 'One-Time GitHub Token Setup Needed'}
            </div>
            <p
              className={`text-[11px] leading-relaxed ${
                hasGhToken
                  ? 'text-blue-800/80 dark:text-blue-300/80'
                  : 'text-amber-800/85 dark:text-amber-300/85'
              }`}
            >
              {hasGhToken
                ? 'Saved permanently in dual browser vault (never asks again). Every file upload auto-publishes live to all URL & PC App users.'
                : 'Open Admin Login -> paste your GitHub Token once. After saving, it locks permanently and never asks again.'}
            </p>
          </div>
        </div>

        {/* Sinhala quick operational note */}
        <div className="px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200/80 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
          <strong className="text-zinc-800 dark:text-zinc-200">සිංහල සටහන:</strong>{' '}
          Admin කෙනෙක් අලුත් Excel file එකක් upload කරන හැම වාරයකම පරිගණකයේ Active System Date &amp; Time එක ස්වයංක්‍රීයව ලබාගෙන මෙම History Log එකේ සටහන් වේ. GitHub Token එක Admin panel එකේ එක් වරක් save කළ පසු, හැම upload එකකදීම Web URL එකෙන් සහ Windows PC App එකෙන් බලන සියලුම දෙනාට app එක ස්වයංක්‍රීයව Live Update වේ.
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Total Upload Records
            </div>
            <div className="mt-1 text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
              {stats.total}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/50">
            <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
              Published Live to Everyone
            </div>
            <div className="mt-1 text-xl font-bold font-mono text-emerald-800 dark:text-emerald-300">
              {stats.livePublished}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/50">
            <div className="text-[11px] text-amber-700 dark:text-amber-400">
              Local Only / Retry Needed
            </div>
            <div className="mt-1 text-xl font-bold font-mono text-amber-800 dark:text-amber-300">
              {stats.localOnly + stats.failed}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Latest Upload Timestamp
            </div>
            <div className="mt-1 text-xs font-bold font-mono text-zinc-900 dark:text-zinc-100 truncate">
              {stats.latest?.systemDateTimeLabel ||
                aersMeta?.printedDateTime ||
                'No uploads yet'}
            </div>
          </div>
        </div>
      </div>

      {/* Upload History Audit Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search file name, date, note..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 w-60 focus:outline-none focus:ring-2 focus:ring-red-600/30"
              />
            </div>

            <div className="inline-flex items-center gap-1 p-0.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
              {(
                [
                  { id: 'all', label: `All (${stats.total})` },
                  { id: 'published_live', label: `Live (${stats.livePublished})` },
                  { id: 'local_only', label: `Local (${stats.localOnly})` },
                  { id: 'sync_failed', label: `Failed (${stats.failed})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
                    statusFilter === tab.id
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {isAdmin && uploadHistory.length > 0 && (
            <div className="flex items-center gap-2">
              {!confirmClear ? (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Log
                </button>
              ) : (
                <div className="inline-flex items-center gap-1.5 text-[11px]">
                  <span className="text-red-700 dark:text-red-300 font-semibold">
                    Confirm clear?
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onClearHistory();
                      setConfirmClear(false);
                    }}
                    className="px-2 py-1 rounded-md bg-red-600 text-white font-semibold hover:bg-red-700"
                  >
                    Yes, Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="px-2 py-1 rounded-md border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {filteredHistory.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <div className="w-11 h-11 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
              <Clock className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
              {uploadHistory.length === 0
                ? 'No file uploads recorded yet'
                : 'No upload records match your filter'}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
              Whenever Admin uploads an AERS Excel file or restores a JSON backup, the active system date &amp; time, file summary, and live publish status are automatically logged here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50/90 dark:bg-zinc-950/80 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <th className="py-3 px-4 w-14">#</th>
                  <th className="py-3 px-4">System Active Date &amp; Time</th>
                  <th className="py-3 px-4">Uploaded File &amp; Type</th>
                  <th className="py-3 px-4">Portfolio &amp; Snapshot</th>
                  <th className="py-3 px-4">Live Update Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80 tabular-nums">
                {filteredHistory.map((item, idx) => {
                  const isLatest = uploadHistory[0]?.id === item.id;
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 align-top font-mono text-zinc-500">
                        <div className="flex flex-col items-start gap-1">
                          <span>{idx + 1}</span>
                          {isLatest && (
                            <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 text-[9px] font-bold uppercase tracking-wider">
                              Latest
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <div className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                          {item.systemDate}
                        </div>
                        <div className="font-mono text-[11px] text-red-700 dark:text-red-400 font-semibold mt-0.5">
                          {item.systemDateTimeLabel.includes('·')
                            ? item.systemDateTimeLabel.split('·')[1].trim()
                            : item.systemTime}
                        </div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">
                          {item.timeZone} · {item.uploadedBy}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 text-zinc-400 shrink-0">
                            {item.fileType === 'AERS Workbook' ? (
                              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                            ) : item.fileType === 'Manual Live Publish' ? (
                              <CloudUpload className="w-4 h-4 text-blue-600" />
                            ) : (
                              <FileText className="w-4 h-4 text-amber-600" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-zinc-900 dark:text-zinc-100 break-all">
                              {item.fileName}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                              <span className="font-medium">{item.fileType}</span>
                              {item.fileSizeBytes ? (
                                <span>· {formatBytes(item.fileSizeBytes)}</span>
                              ) : null}
                            </div>
                            {item.excelPrintedDateTime && (
                              <div className="text-[10px] text-zinc-400 mt-0.5">
                                Excel header date: {item.excelPrintedDateTime}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        <div className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                          {item.recordsCount.toLocaleString()} indexed
                          {item.totalPortfolioCount &&
                          item.totalPortfolioCount > item.recordsCount ? (
                            <span className="text-zinc-500 font-normal">
                              {' '}
                              / {item.totalPortfolioCount.toLocaleString()} total
                            </span>
                          ) : null}
                        </div>
                        {typeof item.closingNplAmount === 'number' &&
                          item.closingNplAmount > 0 && (
                            <div className="text-[11px] text-zinc-600 dark:text-zinc-400 font-mono mt-0.5">
                              NPL: {item.nplCount?.toLocaleString() ?? 0} ·{' '}
                              {formatCompactRs(item.closingNplAmount)}
                            </div>
                          )}
                        {item.snapshotAction && (
                          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {item.snapshotAction}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        {item.cloudSyncStatus === 'published_live' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-semibold text-[11px]">
                            <CheckCircle2 className="w-3 h-3" />
                            Published Live
                          </span>
                        ) : item.cloudSyncStatus === 'sync_failed' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 font-semibold text-[11px]">
                            <AlertTriangle className="w-3 h-3" />
                            Sync Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-semibold text-[11px]">
                            <HardDrive className="w-3 h-3" />
                            Local Only
                          </span>
                        )}
                        {item.cloudSyncNote && (
                          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs leading-snug">
                            {item.cloudSyncNote}
                          </div>
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
