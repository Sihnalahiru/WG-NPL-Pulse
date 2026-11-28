import {
  CalendarClock,
  Clock,
  Download,
  FileJson,
  HardDriveDownload,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { WeeklyBackupSchedule } from '../types/recovery';
import { formatTime12h, getDayLabel } from '../utils/weeklyBackup';
import { captureSystemActiveDateTime, getTodayISO } from '../utils/recoveryEngine';

interface WeeklyBackupPromptModalProps {
  isOpen: boolean;
  schedule: WeeklyBackupSchedule;
  aersCount: number;
  snapshotsCount: number;
  staffAssignmentsCount: number;
  uploadHistoryCount: number;
  onConfirmDownload: () => void;
  onSnoozeTwoHours: () => void;
  onSkipThisWeek: () => void;
}

export function WeeklyBackupPromptModal({
  isOpen,
  schedule,
  aersCount,
  snapshotsCount,
  staffAssignmentsCount,
  uploadHistoryCount,
  onConfirmDownload,
  onSnoozeTwoHours,
  onSkipThisWeek,
}: WeeklyBackupPromptModalProps) {
  if (!isOpen) return null;

  const activeSys = captureSystemActiveDateTime();
  const fileNamePreview = `WG_Pulse_Weekly_Backup_${getTodayISO()}.json`;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-zinc-950/65 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="weekly-backup-prompt-title"
    >
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-red-50/70 dark:bg-red-950/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-700 text-white shadow-xs shrink-0">
              <HardDriveDownload className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="weekly-backup-prompt-title"
                className="text-sm font-bold text-zinc-900 dark:text-zinc-100"
              >
                Weekly Automated JSON Backup Ready
              </h2>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                Scheduled: Every {getDayLabel(schedule.dayOfWeek)} at{' '}
                {formatTime12h(schedule.timeOfDay)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onSnoozeTwoHours}
            aria-label="Snooze weekly backup prompt"
            className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            Your recurring weekly backup is due. Would you like to download and save a full WG Pulse JSON backup to your local computer now?
          </p>

          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1.5 font-semibold text-zinc-800 dark:text-zinc-200">
                <FileJson className="w-3.5 h-3.5 text-red-600" />
                {fileNamePreview}
              </span>
              <span className="font-mono text-[10px] text-zinc-500">
                {activeSys.systemDate}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 tabular-nums text-[11px]">
              <div className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
                <span className="text-zinc-500">AERS Accounts</span>
                <strong className="font-mono text-zinc-900 dark:text-zinc-100">
                  {aersCount.toLocaleString()}
                </strong>
              </div>
              <div className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
                <span className="text-zinc-500">Snapshots</span>
                <strong className="font-mono text-zinc-900 dark:text-zinc-100">
                  {snapshotsCount}
                </strong>
              </div>
              <div className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
                <span className="text-zinc-500">Staff Follow-Ups</span>
                <strong className="font-mono text-zinc-900 dark:text-zinc-100">
                  {staffAssignmentsCount}
                </strong>
              </div>
              <div className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
                <span className="text-zinc-500">Upload Logs</span>
                <strong className="font-mono text-zinc-900 dark:text-zinc-100">
                  {uploadHistoryCount}
                </strong>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 dark:text-emerald-400 pt-0.5">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              Includes Opening Baseline, MRP history, Upload Logs &amp; Weekly Schedule
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            <CalendarClock className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
            System Active Time: <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">{activeSys.displayLabel}</span>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={onConfirmDownload}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-red-700 hover:bg-red-800 text-white shadow-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              Save JSON Backup to This PC Now
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onSnoozeTwoHours}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <Clock className="w-3.5 h-3.5" />
                Remind in 2 Hours
              </button>
              <button
                type="button"
                onClick={onSkipThisWeek}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Skip This Week
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
