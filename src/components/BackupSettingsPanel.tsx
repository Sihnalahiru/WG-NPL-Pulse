import { Download, Lock, RotateCcw, ShieldCheck, Upload } from 'lucide-react';
import type { AersMetadata } from '../types/recovery';
import { SecurityVaultIllustration } from './FinanceIllustrations';

interface BackupSettingsPanelProps {
  staffAssignmentsCount: number;
  snapshotsCount: number;
  aersMeta: AersMetadata | null;
  isAdminAuthenticated: boolean;
  onOpenAdminModal: () => void;
  onExportBackup: () => void;
  onRestoreBackup: (file: File) => void;
}

export function BackupSettingsPanel({
  staffAssignmentsCount,
  snapshotsCount,
  aersMeta,
  isAdminAuthenticated,
  onOpenAdminModal,
  onExportBackup,
  onRestoreBackup,
}: BackupSettingsPanelProps) {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              WG Pulse Persistence &amp; JSON Backup
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Your latest AERS Master Lookup, Assign User follow-up rosters, daily locked snapshots, and per-officer opening baseline persist in browser storage. Each same-day AERS upload updates today&apos;s snapshot with the latest file while locking prior days cleanly.
            </p>
          </div>

          <SecurityVaultIllustration className="w-14 h-14 shrink-0 hidden sm:block" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 tabular-nums">
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Assign User Follow-Ups
            </div>
            <div className="mt-1 text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
              {staffAssignmentsCount}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Daily &amp; Monthly Snapshots
            </div>
            <div className="mt-1 text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
              {snapshotsCount}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              AERS Master Indexed
            </div>
            <div className="mt-1 text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
              {aersMeta?.totalContractsCount.toLocaleString() ?? 0}
            </div>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onExportBackup}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export Backup (JSON)
          </button>

          <label className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap">
            <Upload className="w-3.5 h-3.5" />
            Restore Backup (JSON)
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onRestoreBackup(f);
                e.target.value = '';
              }}
            />
          </label>

          <button
            type="button"
            onClick={onOpenAdminModal}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border whitespace-nowrap ${
              isAdminAuthenticated
                ? 'border-red-300 dark:border-red-800 bg-red-50/70 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100/70 dark:hover:bg-red-950/70'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {isAdminAuthenticated ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <RotateCcw className="w-3.5 h-3.5" />
                Admin Unlocked · Total App Reset
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" />
                Admin Log In to Reset All Data
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
