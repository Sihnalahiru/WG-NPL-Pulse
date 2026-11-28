import { useMemo } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Bell,
  BellRing,
  Flame,
  PhoneOff,
  Volume2,
} from 'lucide-react';
import type {
  AersRecord,
  MrpEnrichment,
  NotificationPreferences,
} from '../types/recovery';
import {
  formatCompactRs,
  getDaysRemainingTo30th,
  getOfficerByOfficeType,
  isBorderlineNplAccount,
  isFallenNplAccount,
  isWorstCategory,
  normalizeContractNo,
} from '../utils/recoveryEngine';
import { PaymentPatternStrip } from './PaymentPatternStrip';
import { UserAvatar } from './UserAvatar';
import { WorstCaseProductBadge } from './WorstCaseProductBadge';

interface AlertsNotificationsPanelProps {
  aersRecords: AersRecord[];
  mrpMap?: Map<string, MrpEnrichment>;
  prefs: NotificationPreferences;
  permissionState: NotificationPermission | 'unsupported';
  onUpdatePrefs: (next: NotificationPreferences) => void;
  onRequestPermission: () => void;
  onTestPopup: () => void;
}

export function AlertsNotificationsPanel({
  aersRecords,
  mrpMap,
  prefs,
  permissionState,
  onUpdatePrefs,
  onRequestPermission,
  onTestPopup,
}: AlertsNotificationsPanelProps) {
  const daysTo30th = getDaysRemainingTo30th();

  const {
    dpd91Danger,
    zeroEffortBorderline,
    newlySlippedNpl,
    worstAccounts,
  } = useMemo(() => {
    const danger: AersRecord[] = [];
    const zeroEff: AersRecord[] = [];
    const slipped: AersRecord[] = [];
    const worst: AersRecord[] = [];

    for (const r of aersRecords) {
      const isBorderline = isBorderlineNplAccount({
        actualDpd: r.actualDpd,
        opAge: r.opAge,
        currentAge: r.currentAge,
        monthEndForecastDpd: r.monthEndForecastDpd,
        opNpl: r.opNpl,
        npl: r.npl,
        totalCollection: r.totalCollection,
        lastPaidAmount: r.lastPaidAmount,
      });

      if (
        (r.npl || 0) <= 0 &&
        ((r.actualDpd >= 80 && r.actualDpd <= 90) ||
          (r.monthEndForecastDpd >= 91 && r.actualDpd < 91))
      ) {
        danger.push(r);
      }

      if (isBorderline && (r.assignOfficerEfforts || 0) === 0) {
        zeroEff.push(r);
      }

      if (isFallenNplAccount(r)) {
        slipped.push(r);
      }

      if (isWorstCategory(r.nplReason, r.worstCaseProduct)) {
        worst.push(r);
      }
    }

    danger.sort((a, b) => (b.closingDebtor || 0) - (a.closingDebtor || 0));
    zeroEff.sort((a, b) => (b.closingDebtor || 0) - (a.closingDebtor || 0));
    slipped.sort((a, b) => (b.npl || b.closingDebtor || 0) - (a.npl || a.closingDebtor || 0));
    worst.sort((a, b) => (b.npl || b.closingDebtor || 0) - (a.npl || a.closingDebtor || 0));

    return {
      dpd91Danger: danger,
      zeroEffortBorderline: zeroEff,
      newlySlippedNpl: slipped,
      worstAccounts: worst,
    };
  }, [aersRecords]);

  const renderSection = (
    title: string,
    subtitle: string,
    items: AersRecord[],
    icon: React.ReactNode,
    emptyText: string,
    showWorstBadge = false,
  ) => (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {icon}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {title}{' '}
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                ({items.length})
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {subtitle}
            </p>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
          {emptyText}
        </div>
      ) : (
        <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-96 overflow-y-auto">
          {items.slice(0, 40).map((r) => {
            const officer = getOfficerByOfficeType(r);
            return (
              <div
                key={r.contractNo}
                className="p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar name={officer} sizeClass="w-8 h-8 text-xs" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {r.contractNo}
                      </span>
                      {showWorstBadge && (
                        <WorstCaseProductBadge
                          product={r.worstCaseProduct}
                          nplReason={r.nplReason}
                          compact
                        />
                      )}
                    </div>
                    <div className="text-slate-700 dark:text-slate-200 truncate">
                      {r.cusName} · <span className="font-medium">{officer}</span>
                    </div>
                    <PaymentPatternStrip
                      mrp={mrpMap?.get(normalizeContractNo(r.contractNo))}
                      lastPaidAmount={r.lastPaidAmount}
                      lastPayDate={r.lastPayDate}
                      totalCollection={r.totalCollection}
                      compact={true}
                    />
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums font-mono">
                      Age {(r.opAge || 0).toFixed(2)} → {(r.currentAge || 0).toFixed(2)} · DPD {r.actualDpd} (Fcst {r.monthEndForecastDpd}) · Efforts: {r.assignOfficerEfforts || 0}/{r.totalEfforts || 0}
                    </div>
                  </div>
                </div>
                <div className="text-right font-mono shrink-0 tabular-nums">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {formatCompactRs(r.npl > 0 ? r.npl : r.closingDebtor)}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    {r.npl > 0 ? 'NPL Exposure' : 'Closing Debtor'}
                  </div>
                </div>
              </div>
            );
          })}
          {items.length > 40 && (
            <div className="p-2.5 text-center text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-50/60 dark:bg-slate-950/40">
              Showing top 40 of {items.length} contracts by exposure
            </div>
          )}
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
              Triggers native desktop pop-up alerts on startup and hourly directly from live AERS data for 91 DPD Crossing Danger, Zero-Effort Borderline, Newly Slipped NPL, and WORST (W) accounts.
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
          '91 DPD Crossing Danger',
          `Pre-NPL contracts forecasting ≥91 DPD before cutoff (${daysTo30th}d left)`,
          dpd91Danger,
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />,
          'No contracts currently in the immediate 91 DPD crossing danger zone.',
        )}

        {renderSection(
          'Zero-Effort Borderline Accounts',
          'Borderline accounts with 0 assigned officer efforts logged in AERS',
          zeroEffortBorderline,
          <PhoneOff className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />,
          'All borderline contracts have at least one officer effort logged.',
        )}

        {renderSection(
          'Newly Slipped NPL',
          'Contracts that opened non-NPL and crossed into NPL this cycle',
          newlySlippedNpl,
          <AlertOctagon className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />,
          'No newly slipped NPL contracts detected.',
        )}

        {renderSection(
          'WORST (W) Priority Radar',
          'Classified Worst Case (W) accounts requiring immediate recovery intervention',
          worstAccounts,
          <Flame className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />,
          'No WORST (W) contracts in current filter scope.',
          true,
        )}
      </div>
    </div>
  );
}
