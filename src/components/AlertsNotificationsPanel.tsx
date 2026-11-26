import {
  AlertOctagon,
  AlertTriangle,
  Bell,
  BellRing,
  CalendarCheck,
  Truck,
  Volume2,
} from 'lucide-react';
import type {
  NotificationPreferences,
  TrackedContract,
} from '../types/recovery';
import {
  buildRecoveryAlertDigest,
  formatCurrencyRs,
  getDaysRemainingTo30th,
} from '../utils/recoveryEngine';

interface AlertsNotificationsPanelProps {
  contracts: TrackedContract[];
  prefs: NotificationPreferences;
  permissionState: NotificationPermission | 'unsupported';
  onUpdatePrefs: (next: NotificationPreferences) => void;
  onRequestPermission: () => void;
  onTestPopup: () => void;
  onLogVisit: (contract: TrackedContract) => void;
}

export function AlertsNotificationsPanel({
  contracts,
  prefs,
  permissionState,
  onUpdatePrefs,
  onRequestPermission,
  onTestPopup,
  onLogVisit,
}: AlertsNotificationsPanelProps) {
  const digest = buildRecoveryAlertDigest(contracts);
  const daysTo30th = getDaysRemainingTo30th();

  const renderSection = (
    title: string,
    subtitle: string,
    items: TrackedContract[],
    icon: React.ReactNode,
    emptyText: string,
  ) => (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {icon}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {title} ({items.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
          {emptyText}
        </div>
      ) : (
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {items.map((c) => (
            <div
              key={c.contractNo}
              className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
            >
              <div>
                <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {c.contractNo} · {c.vehicleNo || 'No Vehicle'}
                </div>
                <div className="text-slate-700 dark:text-slate-200 mt-0.5">
                  {c.cusName} · RO: {c.ro || c.recoveryOfficer || '—'}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                  Debtor: {formatCurrencyRs(c.closingDebtor)} · DPD {c.actualDpd} (Fcst{' '}
                  {c.monthEndForecastDpd}) · P/P: {c.ppDate || '—'} · H/O:{' '}
                  {c.handOverDate || '—'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onLogVisit(c)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap shrink-0 self-start sm:self-center"
              >
                + Log Follow-Up
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Browser &amp; PC Pop-up Notification Settings
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Triggers native desktop pop-up alerts on startup and hourly for Today&apos;s P/P Due, Broken P/P, 91 DPD Danger (within 4 days), and Pending Hand Overs.
            </p>
            <p className="mt-2 text-xs font-mono text-slate-600 dark:text-slate-300">
              Browser Permission: <span className="font-semibold">{permissionState}</span>
              {prefs.lastNotifiedAt ? ` · Last Triggered: ${prefs.lastNotifiedAt}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {permissionState !== 'granted' && permissionState !== 'unsupported' && (
              <button
                type="button"
                onClick={onRequestPermission}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <Bell className="w-3.5 h-3.5" />
                Enable PC Permissions
              </button>
            )}
            <button
              type="button"
              onClick={onTestPopup}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap"
            >
              <BellRing className="w-3.5 h-3.5" />
              Test PC Pop-up
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <label className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer">
            <span className="font-medium text-slate-800 dark:text-slate-200">
              Auto Pop-ups on Startup
            </span>
            <input
              type="checkbox"
              checked={prefs.enabled}
              onChange={(e) =>
                onUpdatePrefs({ ...prefs, enabled: e.target.checked })
              }
              className="w-4 h-4 accent-blue-600"
            />
          </label>

          <label className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
              <Volume2 className="w-3.5 h-3.5 text-slate-500" />
              Alert Sound Chime
            </span>
            <input
              type="checkbox"
              checked={prefs.soundEnabled}
              onChange={(e) =>
                onUpdatePrefs({ ...prefs, soundEnabled: e.target.checked })
              }
              className="w-4 h-4 accent-blue-600"
            />
          </label>

          <label className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer">
            <span className="font-medium text-slate-800 dark:text-slate-200">
              Hourly Reminder Check
            </span>
            <input
              type="checkbox"
              checked={prefs.hourlyReminder}
              onChange={(e) =>
                onUpdatePrefs({ ...prefs, hourlyReminder: e.target.checked })
              }
              className="w-4 h-4 accent-blue-600"
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderSection(
          "Today's P/P Due",
          'Contracts with Promise to Pay scheduled for today',
          digest.todayPp,
          <CalendarCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />,
          'No Promise to Pay dates due today.',
        )}

        {renderSection(
          'Broken P/P Alerts',
          'P/P Date has passed and Last Pay Date is older than Visit Date',
          digest.brokenPp,
          <AlertOctagon className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />,
          'No broken Promises to Pay detected.',
        )}

        {renderSection(
          '91 DPD Danger Alert',
          `Within 4 days of crossing 91 DPD (${daysTo30th}d remaining to 30th)`,
          digest.dpd91Danger,
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />,
          'No tracked contracts within the 4-day 91 DPD threshold.',
        )}

        {renderSection(
          'Pending Hand Overs',
          'Contracts where Hand Over Date is today or overdue',
          digest.pendingHandOver,
          <Truck className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />,
          'No pending vehicle hand overs due.',
        )}
      </div>
    </div>
  );
}
