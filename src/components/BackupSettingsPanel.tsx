import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  Lock,
  RotateCcw,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import type { AersMetadata, WeeklyBackupSchedule } from '../types/recovery';
import {
  DAY_OF_WEEK_OPTIONS,
  evaluateWeeklyBackupSchedule,
  formatTime12h,
  getDayLabel,
} from '../utils/weeklyBackup';
import { SecurityVaultIllustration } from './FinanceIllustrations';

interface BackupSettingsPanelProps {
  staffAssignmentsCount: number;
  snapshotsCount: number;
  uploadHistoryCount: number;
  aersMeta: AersMetadata | null;
  isAdminAuthenticated: boolean;
  weeklySchedule: WeeklyBackupSchedule;
  onUpdateWeeklySchedule: (next: WeeklyBackupSchedule) => void;
  onTriggerWeeklyBackupPromptNow: () => void;
  onOpenAdminModal: () => void;
  onExportBackup: () => void;
  onRestoreBackup: (file: File) => void;
}

export function BackupSettingsPanel({
  staffAssignmentsCount,
  snapshotsCount,
  uploadHistoryCount,
  aersMeta,
  isAdminAuthenticated,
  weeklySchedule,
  onUpdateWeeklySchedule,
  onTriggerWeeklyBackupPromptNow,
  onOpenAdminModal,
  onExportBackup,
  onRestoreBackup,
}: BackupSettingsPanelProps) {
  const slotStatus = evaluateWeeklyBackupSchedule(weeklySchedule);

  const handleToggleEnabled = () => {
    onUpdateWeeklySchedule({
      ...weeklySchedule,
      enabled: !weeklySchedule.enabled,
      snoozedUntilIso: undefined,
    });
  };

  const handleDayChange = (dayOfWeek: number) => {
    onUpdateWeeklySchedule({
      ...weeklySchedule,
      dayOfWeek,
      snoozedUntilIso: undefined,
    });
  };

  const handleTimeChange = (timeOfDay: string) => {
    onUpdateWeeklySchedule({
      ...weeklySchedule,
      timeOfDay: timeOfDay || '17:00',
      snoozedUntilIso: undefined,
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Recurring Weekly Automated JSON Backup Schedule Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/70 text-red-700 dark:text-red-300 shrink-0">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Recurring Weekly Automated JSON Backup
                </h2>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                    weeklySchedule.enabled
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                  }`}
                >
                  {weeklySchedule.enabled ? 'Active Schedule' : 'Paused'}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                Automatically checks every week at your chosen day &amp; time and prompts the Admin to download a full JSON backup directly to this local computer.
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={weeklySchedule.enabled}
            onClick={handleToggleEnabled}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-red-600/40 ${
              weeklySchedule.enabled
                ? 'bg-emerald-600'
                : 'bg-zinc-300 dark:bg-zinc-700'
            }`}
            title={
              weeklySchedule.enabled
                ? 'Disable recurring weekly backup'
                : 'Enable recurring weekly backup'
            }
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                weeklySchedule.enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Schedule Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
            <label
              htmlFor="weekly-backup-day"
              className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
            >
              Weekly Backup Day
            </label>
            <select
              id="weekly-backup-day"
              value={weeklySchedule.dayOfWeek}
              onChange={(e) => handleDayChange(Number(e.target.value))}
              disabled={!weeklySchedule.enabled}
              className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-600/30"
            >
              {DAY_OF_WEEK_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  Every {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
            <label
              htmlFor="weekly-backup-time"
              className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
            >
              Local Trigger Time
            </label>
            <input
              id="weekly-backup-time"
              type="time"
              value={weeklySchedule.timeOfDay}
              onChange={(e) => handleTimeChange(e.target.value)}
              disabled={!weeklySchedule.enabled}
              className="w-full px-3 py-1.5 text-xs font-mono font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-600/30"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Next Scheduled Prompt
            </div>
            <div className="text-xs font-bold font-mono text-zinc-900 dark:text-zinc-100 pt-1">
              {weeklySchedule.enabled
                ? slotStatus.isDueNow
                  ? 'Due Now (Ready to Save)'
                  : slotStatus.isSnoozed && slotStatus.snoozedUntilLabel
                    ? `Snoozed until ${slotStatus.snoozedUntilLabel}`
                    : slotStatus.nextScheduledLabel
                : 'Schedule Paused'}
            </div>
            <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
              Every {getDayLabel(weeklySchedule.dayOfWeek)} at{' '}
              {formatTime12h(weeklySchedule.timeOfDay)}
            </div>
          </div>
        </div>

        {/* Status Footer + Manual Trigger */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-600 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1.5">
              {weeklySchedule.lastBackupDisplay ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-amber-600" />
              )}
              Last JSON Backup:{' '}
              <strong className="font-mono text-zinc-900 dark:text-zinc-200">
                {weeklySchedule.lastBackupDisplay || 'Not yet saved'}
              </strong>
            </span>
            {!isAdminAuthenticated && (
              <span className="text-amber-700 dark:text-amber-400 font-medium">
                (Auto-prompt triggers when Admin mode is unlocked)
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onTriggerWeeklyBackupPromptNow}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-red-700 hover:bg-red-800 text-white whitespace-nowrap shadow-xs"
          >
            <BellRing className="w-3.5 h-3.5" />
            Prompt Weekly Backup Now
          </button>
        </div>
      </div>

      {/* Persistence & Manual JSON Backup Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              WG Pulse Persistence &amp; JSON Backup
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
              Your latest AERS Master Lookup, Assign User follow-up rosters, Upload History log, daily locked snapshots, and per-officer opening baseline persist in browser storage.
            </p>
          </div>

          <SecurityVaultIllustration className="w-14 h-14 shrink-0 hidden sm:block" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 tabular-nums">
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              AERS Master Indexed
            </div>
            <div className="mt-1 text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
              {aersMeta?.totalContractsCount.toLocaleString() ?? 0}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Assign User Follow-Ups
            </div>
            <div className="mt-1 text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
              {staffAssignmentsCount}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Daily &amp; Monthly Snapshots
            </div>
            <div className="mt-1 text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
              {snapshotsCount}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Upload History Logs
            </div>
            <div className="mt-1 text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
              {uploadHistoryCount}
            </div>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onExportBackup}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export Backup (JSON)
          </button>

          <label className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer whitespace-nowrap">
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
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl border whitespace-nowrap ${
              isAdminAuthenticated
                ? 'border-red-300 dark:border-red-800 bg-red-50/70 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100/70 dark:hover:bg-red-950/70'
                : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800'
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
