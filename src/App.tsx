import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  BarChart3,
  Bell,
  BellRing,
  Bot,
  Building2,
  CheckCircle2,
  Database,
  Flame,
  HardDriveDownload,
  Layers,
  LayoutDashboard,
  Lock,
  MessageSquare,
  Moon,
  Plus,
  RefreshCw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Upload,
  X,
} from 'lucide-react';
import { AdminLoginModal } from './components/AdminLoginModal';
import { AersLookupPanel } from './components/AersLookupPanel';
import { AiRecoveryAgentPanel } from './components/AiRecoveryAgentPanel';
import { AlertsNotificationsPanel } from './components/AlertsNotificationsPanel';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { BackupSettingsPanel } from './components/BackupSettingsPanel';
import { BmPortfolioAnalyticsPanel } from './components/BmPortfolioAnalyticsPanel';
import { ContractModal } from './components/ContractModal';
import strategyHeroImg from './assets/images/finance_strategy_hero_1795684833730.jpg';
import { PulseLogoMark } from './components/FinanceIllustrations';
import { KpiStrip } from './components/KpiStrip';
import { NextMonthBorderlineCardsPanel } from './components/NextMonthBorderlineCardsPanel';
import { OfficeTypeBreakdownPanel } from './components/OfficeTypeBreakdownPanel';
import { TrackingTable } from './components/TrackingTable';
import { TrendsEvaluationPanel } from './components/TrendsEvaluationPanel';
import { VisitHistoryModal } from './components/VisitHistoryModal';
import { WhatsAppSyncModal } from './components/WhatsAppSyncModal';
import { WorstCasePanel } from './components/WorstCasePanel';
import type {
  AersMetadata,
  AersRecord,
  BackupPayload,
  FilterPreset,
  MonthlySnapshot,
  MrpEnrichment,
  NavSection,
  NotificationPreferences,
  OpeningOfficerBaseline,
  TrackedContract,
  WhatsAppLocationMatch,
} from './types/recovery';
import {
  analyzeNextMonthBorderline,
  buildOpeningOfficerBaseline,
  buildRecoveryAlertDigest,
  computeOfficeTypeBreakdown,
  formatCompactRs,
  getDaysRemainingTo30th,
  getMonth30thLabel,
  getTodayISO,
  isWorstCategory,
  normalizeContractNo,
  normalizeEvaluableFromAers,
  normalizeEvaluableFromTracked,
  normalizeVehicleNo,
  parseAersPastedText,
  parseAersWorkbook,
  playAlertChime,
  syncTrackedContractsWithAers,
  triggerDesktopNotifications,
} from './utils/recoveryEngine';
import type { ParsedAersResult } from './utils/recoveryEngine';

const STORAGE_KEYS = {
  TRACKED: 'wg_v2_tracked_contracts',
  AERS_MASTER: 'wg_v2_aers_master',
  AERS_META: 'wg_v2_aers_meta',
  MRP_MAP: 'wg_v2_mrp_map',
  OPENING_BASELINE: 'wg_v2_opening_baseline',
  SNAPSHOTS: 'wg_v2_monthly_snapshots',
  NOTIF_PREFS: 'wg_v2_notification_prefs',
  THEME: 'wg_v2_theme',
};

function readJsonStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

interface ToastBanner {
  id: number;
  title: string;
  detail: string;
  tone: 'info' | 'success' | 'error';
}

export default function App() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return false;
  });

  const [aersRecords, setAersRecords] = useState<AersRecord[]>(() =>
    readJsonStorage<AersRecord[]>(STORAGE_KEYS.AERS_MASTER, []),
  );
  const [aersMeta, setAersMeta] = useState<AersMetadata | null>(() =>
    readJsonStorage<AersMetadata | null>(STORAGE_KEYS.AERS_META, null),
  );
  const [openingBaseline, setOpeningBaseline] =
    useState<OpeningOfficerBaseline | null>(() =>
      readJsonStorage<OpeningOfficerBaseline | null>(
        STORAGE_KEYS.OPENING_BASELINE,
        null,
      ),
    );
  const [trackedContracts, setTrackedContracts] = useState<TrackedContract[]>(
    () => readJsonStorage<TrackedContract[]>(STORAGE_KEYS.TRACKED, []),
  );
  const [monthlySnapshots, setMonthlySnapshots] = useState<MonthlySnapshot[]>(
    () => readJsonStorage<MonthlySnapshot[]>(STORAGE_KEYS.SNAPSHOTS, []),
  );
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(() =>
    readJsonStorage<NotificationPreferences>(STORAGE_KEYS.NOTIF_PREFS, {
      enabled: true,
      soundEnabled: true,
      hourlyReminder: true,
    }),
  );

  const [activeNav, setActiveNav] = useState<NavSection>('overview');
  const [toolsSubTab, setToolsSubTab] = useState<
    'office_breakdown' | 'bm_analytics' | 'ai' | 'alerts'
  >('office_breakdown');
  const [settingsSubTab, setSettingsSubTab] = useState<'lookup' | 'backup'>('lookup');
  const [mrpMap, setMrpMap] = useState<Map<string, MrpEnrichment>>(() => {
    const rawObj = readJsonStorage<Record<string, MrpEnrichment>>(
      STORAGE_KEYS.MRP_MAP,
      {},
    );
    return new Map(Object.entries(rawObj));
  });
  const [regularContractNos, setRegularContractNos] = useState<Set<string>>(() => new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterPreset>('all');
  const [animKey, setAnimKey] = useState(0);

  // Admin session token kept strictly in React JS memory (never localStorage/sessionStorage)
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  // Modals
  const [contractModalState, setContractModalState] = useState<{
    isOpen: boolean;
    mode: 'add' | 'edit' | 'log_visit';
    contract: TrackedContract | null;
  }>({ isOpen: false, mode: 'add', contract: null });
  const [historyContract, setHistoryContract] =
    useState<TrackedContract | null>(null);
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastBanner | null>(null);
  const [permissionState, setPermissionState] = useState<
    NotificationPermission | 'unsupported'
  >(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  });

  const startupNotifiedRef = useRef(false);

  const showToast = (
    title: string,
    detail: string,
    tone: 'info' | 'success' | 'error' = 'info',
  ) => {
    setToast({ id: Date.now(), title, detail, tone });
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  // Sync theme to <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem(STORAGE_KEYS.THEME, isDark ? 'dark' : 'light');
  }, [isDark]);

  // Remove legacy duplicate storage keys so storage never piles up
  useEffect(() => {
    try {
      localStorage.removeItem('wg_v2_opening_master');
      localStorage.removeItem('wg_v2_opening_meta');
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith('wg_v1_')) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // Ignore storage access restrictions
    }
  }, []);

  // Persist domain state to localStorage (single-copy replace-on-upload)
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.TRACKED,
        JSON.stringify(trackedContracts),
      );
    } catch {
      // Ignore quota errors
    }
  }, [trackedContracts]);

  useEffect(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.AERS_MASTER);
      localStorage.setItem(
        STORAGE_KEYS.AERS_MASTER,
        JSON.stringify(aersRecords),
      );
      if (aersMeta) {
        localStorage.setItem(STORAGE_KEYS.AERS_META, JSON.stringify(aersMeta));
      } else {
        localStorage.removeItem(STORAGE_KEYS.AERS_META);
      }
      if (openingBaseline) {
        localStorage.setItem(
          STORAGE_KEYS.OPENING_BASELINE,
          JSON.stringify(openingBaseline),
        );
      } else {
        localStorage.removeItem(STORAGE_KEYS.OPENING_BASELINE);
      }
      localStorage.removeItem(STORAGE_KEYS.MRP_MAP);
      if (mrpMap.size > 0) {
        localStorage.setItem(
          STORAGE_KEYS.MRP_MAP,
          JSON.stringify(Object.fromEntries(mrpMap)),
        );
      }
    } catch {
      // Ignore quota errors if Excel is huge; kept cleanly in React memory
    }
  }, [aersRecords, aersMeta, openingBaseline, mrpMap]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.SNAPSHOTS,
        JSON.stringify(monthlySnapshots),
      );
    } catch {
      // Ignore quota errors
    }
  }, [monthlySnapshots]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.NOTIF_PREFS,
        JSON.stringify(notifPrefs),
      );
    } catch {
      // Ignore quota errors
    }
  }, [notifPrefs]);

  // Lookup indices & unified strategy metrics (updates immediately on AERS upload/paste)
  const aersMap = useMemo(() => {
    const map = new Map<string, AersRecord>();
    aersRecords.forEach((r) => {
      map.set(normalizeContractNo(r.contractNo), r);
    });
    return map;
  }, [aersRecords]);

  const trackedContractNos = useMemo(
    () => new Set(trackedContracts.map((c) => normalizeContractNo(c.contractNo))),
    [trackedContracts],
  );

  const strategySummary = useMemo(() => {
    const items =
      aersRecords.length > 0
        ? normalizeEvaluableFromAers(aersRecords, trackedContractNos, mrpMap)
        : normalizeEvaluableFromTracked(trackedContracts);
    const offices = computeOfficeTypeBreakdown(items);
    const borderline = analyzeNextMonthBorderline(items);
    const worstTotal = items.filter((i) => i.isWorst).length;
    return {
      officeTypesCount: offices.length,
      borderlineCount: borderline.totalCount,
      borderlineMinToSave: borderline.totalMinToSave,
      borderlineEfforts: borderline.totalBorderlineEfforts,
      worstCount: worstTotal,
    };
  }, [aersRecords, trackedContracts, trackedContractNos, mrpMap]);

  const worstCount = useMemo(() => {
    if (aersRecords.length > 0) {
      return aersRecords.filter((r) =>
        isWorstCategory(r.nplReason, r.worstCaseProduct),
      ).length;
    }
    return trackedContracts.filter((c) =>
      isWorstCategory(c.nplReason, c.worstCaseProduct),
    ).length;
  }, [aersRecords, trackedContracts]);

  const alertDigest = useMemo(
    () => buildRecoveryAlertDigest(trackedContracts),
    [trackedContracts],
  );

  const urgentAlertsCount =
    alertDigest.todayPp.length +
    alertDigest.brokenPp.length +
    alertDigest.dpd91Danger.length +
    alertDigest.pendingHandOver.length;

  // Startup Notification request + hourly check
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'default') {
      Notification.requestPermission()
        .then((perm) => {
          setPermissionState(perm);
          if (perm === 'granted' && notifPrefs.enabled && !startupNotifiedRef.current) {
            startupNotifiedRef.current = true;
            triggerDesktopNotifications(alertDigest, notifPrefs.soundEnabled);
          }
        })
        .catch(() => {});
    } else if (
      Notification.permission === 'granted' &&
      notifPrefs.enabled &&
      !startupNotifiedRef.current
    ) {
      startupNotifiedRef.current = true;
      triggerDesktopNotifications(alertDigest, false);
    }
  }, [alertDigest, notifPrefs.enabled, notifPrefs.soundEnabled]);

  useEffect(() => {
    if (!notifPrefs.enabled || !notifPrefs.hourlyReminder) return;
    const interval = setInterval(() => {
      const digest = buildRecoveryAlertDigest(trackedContracts);
      const res = triggerDesktopNotifications(digest, notifPrefs.soundEnabled);
      if (res.sentCount > 0) {
        setNotifPrefs((prev) => ({
          ...prev,
          lastNotifiedAt: new Date().toLocaleTimeString(),
        }));
      }
    }, 3600000);
    return () => clearInterval(interval);
  }, [
    notifPrefs.enabled,
    notifPrefs.hourlyReminder,
    notifPrefs.soundEnabled,
    trackedContracts,
  ]);

  const handleRequestNotifPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      showToast(
        'Browser Notifications Unavailable',
        'Your current browser environment does not support the Notification API.',
        'error',
      );
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setPermissionState(perm);
      if (perm === 'granted') {
        showToast(
          'PC Pop-up Alerts Enabled',
          'Desktop notifications are now permitted for P/P and 91 DPD alerts.',
          'success',
        );
      } else {
        showToast(
          'Notification Permission Not Granted',
          `Permission status is "${perm}". Check browser site settings to allow pop-ups.`,
          'error',
        );
      }
    } catch {
      showToast(
        'Permission Request Blocked',
        'Please enable notifications in browser settings.',
        'error',
      );
    }
  };

  const handleTestPopup = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        const perm = await Notification.requestPermission();
        setPermissionState(perm);
      }
    }

    const res = triggerDesktopNotifications(
      alertDigest,
      notifPrefs.soundEnabled,
      true,
    );

    if (notifPrefs.soundEnabled) {
      playAlertChime();
    }

    setNotifPrefs((prev) => ({
      ...prev,
      lastNotifiedAt: new Date().toLocaleTimeString(),
    }));

    if (res.sentCount > 0) {
      showToast(
        `Sent ${res.sentCount} PC Pop-up Notification${res.sentCount === 1 ? '' : 's'}`,
        `Today P/P: ${alertDigest.todayPp.length} · Broken P/P: ${alertDigest.brokenPp.length} · 91 DPD Danger: ${alertDigest.dpd91Danger.length} · Hand Over: ${alertDigest.pendingHandOver.length}`,
        'success',
      );
    } else {
      showToast(
        'In-App Recovery Alert Digest',
        `Today P/P: ${alertDigest.todayPp.length} · Broken P/P: ${alertDigest.brokenPp.length} · 91 DPD Danger: ${alertDigest.dpd91Danger.length} · Hand Over: ${alertDigest.pendingHandOver.length} (OS pop-up permission: ${res.permission})`,
        'info',
      );
    }
  };

  const applyParsedAersResult = (parsed: ParsedAersResult) => {
    const nextMap = new Map<string, AersRecord>();
    parsed.records.forEach((r) => {
      nextMap.set(normalizeContractNo(r.contractNo), r);
    });

    const effectiveMrpMap = parsed.mrpMap ?? mrpMap;
    if (parsed.mrpMap) {
      setMrpMap(parsed.mrpMap);
    }

    const syncResult = syncTrackedContractsWithAers(
      trackedContracts,
      nextMap,
      parsed.metadata,
      {
        mrpMap: effectiveMrpMap,
        watchlistImports: parsed.watchlistImports,
      },
    );

    if (!openingBaseline) {
      setOpeningBaseline(
        buildOpeningOfficerBaseline(
          parsed.records,
          parsed.metadata.printedDateTime,
        ),
      );
    }

    // Track excluded regular/performing accounts in memory for manual entry validation
    setRegularContractNos(new Set(parsed.excludedRegularContractNos ?? []));

    // Replace previous daily AERS master completely rather than piling up copies
    setAersRecords(parsed.records);
    setAersMeta(parsed.metadata);
    setTrackedContracts(syncResult.updatedContracts);
    setAnimKey((k) => k + 1);

    // Upsert snapshot by snapshotDate so same-day uploads update cleanly while each month's progress (through Mar 2027) stays preserved
    setMonthlySnapshots((prev) => {
      const idx = prev.findIndex(
        (s) => s.snapshotDate === syncResult.snapshot.snapshotDate,
      );
      let next: MonthlySnapshot[];
      if (idx >= 0) {
        next = [...prev];
        next[idx] = { ...syncResult.snapshot, id: next[idx].id };
      } else {
        next = [...prev, syncResult.snapshot];
      }
      return next.sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
    });

    const excludedCount = parsed.excludedRegularContractNos?.length ?? 0;
    const excludedNote =
      excludedCount > 0
        ? ` · ${excludedCount.toLocaleString()} regular excluded`
        : '';
    const multiSheetNote = parsed.isMultiSheetWorkbook
      ? ` · Sheet2 imported ${syncResult.importedFromSheet2Count} NPL/Borderline${
          syncResult.skippedRegularSheet2Count > 0
            ? ` (${syncResult.skippedRegularSheet2Count} regular skipped)`
            : ''
        } · MRP enriched ${syncResult.mrpEnrichedCount}`
      : '';

    showToast(
      `Workbook Replaced & Auto-Synced (${parsed.records.length.toLocaleString()} NPL/Borderline)`,
      `Synced ${syncResult.syncedCount} tracked${excludedNote}${multiSheetNote} · ${syncResult.newlySavedCount} saved from NPL · Snapshot ${parsed.metadata.printedDateTime}.`,
      'success',
    );
  };

  // Upload & Auto-Sync AERS Excel/CSV
  const handleUploadAersFile = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseAersWorkbook(buffer, file.name);
      applyParsedAersResult(parsed);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to parse AERS Excel/CSV file.';
      showToast('AERS Upload Error', msg, 'error');
    }
  };

  // Paste & Auto-Sync Daily AERS Evaluation from Excel
  const handlePasteAersText = (rawText: string) => {
    try {
      const parsed = parseAersPastedText(
        rawText,
        `Daily Paste (${getTodayISO()})`,
      );
      applyParsedAersResult(parsed);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to parse pasted Age Evaluation rows.';
      showToast('Daily Paste Error', msg, 'error');
    }
  };

  const handleSetCurrentAsOpening = () => {
    if (aersRecords.length === 0) return;
    setOpeningBaseline(
      buildOpeningOfficerBaseline(
        aersRecords,
        aersMeta?.printedDateTime || getTodayISO(),
      ),
    );
    showToast(
      'Opening Baseline Updated',
      `Locked lightweight per-officer Opening totals (${aersMeta?.printedDateTime || getTodayISO()}).`,
      'success',
    );
  };

  const handleSaveSingleContract = (contract: TrackedContract) => {
    setTrackedContracts((prev) => {
      const exists = prev.some(
        (c) =>
          normalizeContractNo(c.contractNo) ===
          normalizeContractNo(contract.contractNo),
      );
      if (exists) {
        return prev.map((c) =>
          normalizeContractNo(c.contractNo) ===
          normalizeContractNo(contract.contractNo)
            ? contract
            : c,
        );
      }
      return [contract, ...prev];
    });
    showToast(
      'Watchlist Updated',
      `${contract.contractNo} (${contract.cusName}) saved.`,
      'success',
    );
  };

  const handleBulkAddContracts = (contractsToAdd: TrackedContract[]) => {
    setTrackedContracts((prev) => [...contractsToAdd, ...prev]);
    showToast(
      'Bulk Import Complete',
      `Added ${contractsToAdd.length} contract${contractsToAdd.length === 1 ? '' : 's'} to active Watchlist.`,
      'success',
    );
  };

  const handleAddFromMaster = (record: AersRecord) => {
    if (trackedContractNos.has(normalizeContractNo(record.contractNo))) return;
    const today = getTodayISO();
    const newTracked: TrackedContract = {
      contractNo: record.contractNo,
      cusName: record.cusName,
      mobileNo: record.mobileNo,
      address: record.address,
      officeType: record.officeType,
      opAge: record.opAge,
      currentAge: record.currentAge,
      opBalDebtor: record.opBalDebtor,
      closingDebtor: record.closingDebtor,
      capitalOutstanding: record.capitalOutstanding,
      opCapitalOutstanding: record.opCapitalOutstanding,
      capitalArrears: record.capitalArrears,
      currentMonthDue: record.currentMonthDue,
      totalCollection: record.totalCollection,
      opNpl: record.opNpl,
      npl: record.npl,
      actualDpd: record.actualDpd,
      monthEndForecastDpd: record.monthEndForecastDpd,
      minAmountToReverseNpl: record.minAmountToReverseNpl,
      recoveryOfficer: record.recoveryOfficer,
      marketingOfficer: record.marketingOfficer,
      lastPayDate: record.lastPayDate,
      lastPaidAmount: record.lastPaidAmount,
      nplReason: record.nplReason,
      worstCaseProduct: record.worstCaseProduct,
      assignOfficerEfforts: record.assignOfficerEfforts,
      totalEfforts: record.totalEfforts,
      vehicleNo: record.currentStock
        ? normalizeVehicleNo(record.currentStock)
        : '',
      visitWith: 'My Self',
      visitDate: today,
      ppDate: '',
      handOverDate: '',
      remark: 'Added from AERS Master Lookup.',
      remarkBy: record.recoveryOfficer || 'RO',
      ro: record.recoveryOfficer,
      currentSituation: 'Active Follow-Up',
      mrp: mrpMap.get(normalizeContractNo(record.contractNo)),
      locationUrl: '',
      nplSavedAmount: 0,
      addedAt: today,
      lastSyncedAt: aersMeta?.printedDateTime,
      visitHistory: [],
    };
    setTrackedContracts((prev) => [newTracked, ...prev]);
    showToast(
      'Added to Watchlist',
      `${record.contractNo} (${record.cusName}) is now tracked.`,
      'success',
    );
  };

  const handleRemoveContract = (contractNo: string) => {
    setTrackedContracts((prev) =>
      prev.filter(
        (c) =>
          normalizeContractNo(c.contractNo) !== normalizeContractNo(contractNo),
      ),
    );
    showToast(
      'Removed from Watchlist',
      `${contractNo} removed from active tracking (remains in AERS Lookup).`,
      'info',
    );
  };

  const handleApplyWhatsAppMatches = (matches: WhatsAppLocationMatch[]) => {
    const byContract = new Map<string, WhatsAppLocationMatch>();
    matches.forEach((m) => {
      if (m.matchedContractNo) {
        byContract.set(normalizeContractNo(m.matchedContractNo), m);
      }
    });

    setTrackedContracts((prev) =>
      prev.map((c) => {
        const hit = byContract.get(normalizeContractNo(c.contractNo));
        if (!hit) return c;
        return {
          ...c,
          locationUrl: hit.locationUrl,
          locationUpdatedAt: hit.timestampText,
          locationText: hit.locationText,
        };
      }),
    );

    showToast(
      'WhatsApp Locations Synced',
      `Updated Google Maps pins on ${byContract.size} tracked contract${byContract.size === 1 ? '' : 's'}.`,
      'success',
    );
  };

  // Backup Export / Restore / Admin-Protected Total App Reset
  const handleExportBackup = () => {
    const payload: BackupPayload = {
      version: 3,
      exportedAt: new Date().toISOString(),
      trackedContracts,
      monthlySnapshots,
      aersMeta,
      aersMasterList: aersRecords,
      openingBaseline,
      notificationPrefs: notifPrefs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WG_Pulse_Backup_${getTodayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(
      'Backup Exported',
      'Downloaded full JSON backup of Watchlist, Visit Histories, AERS Lookup, and Snapshots.',
      'success',
    );
  };

  const handleRestoreBackup = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<BackupPayload>;
      if (!Array.isArray(parsed.trackedContracts)) {
        throw new Error('Invalid backup file: missing trackedContracts.');
      }
      setTrackedContracts(parsed.trackedContracts);
      if (Array.isArray(parsed.monthlySnapshots)) {
        setMonthlySnapshots(parsed.monthlySnapshots);
      }
      if (Array.isArray(parsed.aersMasterList)) {
        setAersRecords(parsed.aersMasterList);
      }
      if (parsed.aersMeta !== undefined) {
        setAersMeta(parsed.aersMeta);
      }
      if (parsed.openingBaseline !== undefined) {
        setOpeningBaseline(parsed.openingBaseline);
      }
      if (parsed.notificationPrefs) {
        setNotifPrefs(parsed.notificationPrefs);
      }
      showToast(
        'Backup Restored',
        `Restored ${parsed.trackedContracts.length} tracked contracts and ${parsed.monthlySnapshots?.length ?? 0} snapshots.`,
        'success',
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to parse JSON backup.';
      showToast('Restore Failed', msg, 'error');
    }
  };

  const handleAuthorizedReset = async () => {
    if (!adminToken) {
      throw new Error('Admin login is required to reset the application.');
    }
    const res = await fetch('/api/admin/authorize-reset', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const data = (await res.json()) as { authorized?: boolean; error?: string };
    if (!res.ok || !data.authorized) {
      if (res.status === 401) {
        setAdminToken(null);
      }
      throw new Error(data.error || 'Admin reset authorization rejected.');
    }

    setAersRecords([]);
    setAersMeta(null);
    setMrpMap(new Map());
    setRegularContractNos(new Set());
    setOpeningBaseline(null);
    setTrackedContracts([]);
    setMonthlySnapshots([]);
    localStorage.removeItem(STORAGE_KEYS.AERS_MASTER);
    localStorage.removeItem(STORAGE_KEYS.AERS_META);
    localStorage.removeItem(STORAGE_KEYS.MRP_MAP);
    localStorage.removeItem(STORAGE_KEYS.OPENING_BASELINE);
    localStorage.removeItem(STORAGE_KEYS.TRACKED);
    localStorage.removeItem(STORAGE_KEYS.SNAPSHOTS);
    showToast(
      'Total App Reset Complete',
      'Authorized by Admin. Watchlist, AERS Lookup, Opening Baseline, and Monthly Snapshots have been cleared.',
      'info',
    );
  };

  const primaryNavItems: {
    id: NavSection;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    {
      id: 'overview',
      label: 'Strategy Dashboard',
      shortLabel: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'borderline',
      label: 'Next Month Borderline',
      shortLabel: 'Next Borderline',
      icon: <ShieldAlert className="w-4 h-4 shrink-0" />,
      badge:
        strategySummary.borderlineCount > 0
          ? strategySummary.borderlineCount
          : undefined,
    },
    {
      id: 'worst',
      label: 'Worst Case (W) Radar',
      shortLabel: 'Worst (W)',
      icon: <Flame className="w-4 h-4 shrink-0" />,
      badge: worstCount > 0 ? worstCount : undefined,
    },
  ];

  const secondaryNavItems: {
    id: NavSection;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    {
      id: 'tools',
      label: 'BM Analytics, AI & Alerts',
      shortLabel: 'Tools Menu',
      icon: <Layers className="w-4 h-4 shrink-0" />,
      badge: urgentAlertsCount > 0 ? urgentAlertsCount : undefined,
    },
    {
      id: 'settings',
      label: 'Settings & Master Lookup',
      shortLabel: 'Settings',
      icon: <Settings className="w-4 h-4 shrink-0" />,
    },
  ];

  const daysTo30th = getDaysRemainingTo30th();
  const month30thLabel = getMonth30thLabel();

  const breadcrumbLabel: Record<NavSection, string> = {
    overview: 'Strategy Dashboard, Trends & Watchlist',
    borderline: 'Next-Month Borderline Control',
    worst: 'Worst Case (W) Radar',
    tools: 'BM Analytics, AI Strategist & Alerts',
    settings: 'Settings · NPL Master Lookup & Admin Reset',
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Premium Sticky Glass Header with WG PULSE Luxury Branding & Glass Nav */}
      <header className="sticky top-0 z-30 h-16 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0 shadow-xs">
        {/* Brand Zone: Executive WG PULSE Wordmark with Telemetry Beacon */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="relative flex items-center justify-center p-2 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-600 to-slate-900 shadow-md shadow-emerald-950/20 border border-emerald-400/30 shrink-0">
            <PulseLogoMark className="w-6 h-6 text-white drop-shadow" />
            {/* Live Telemetry Blinking Beacon */}
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white dark:border-slate-900" />
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
                WG PULSE
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-xs">
                COMMAND
              </span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700 hidden 2xl:inline">·</span>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate hidden 2xl:inline">
                {breadcrumbLabel[activeNav]}
              </span>
            </div>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 tracking-wide uppercase truncate block">
              Leasing &amp; Finance Recovery Control · Live Telemetry
            </span>
          </div>
        </div>

        {/* Center Zone: Executive Glass Navigation Menu (Desktop/Tablet) */}
        <nav
          aria-label="Executive Glass Header Navigation"
          className="hidden xl:flex items-center gap-1 p-1 bg-slate-100/90 dark:bg-slate-950/80 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-800/90 rounded-2xl shadow-xs shrink-0"
        >
          {primaryNavItems.map((item) => {
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveNav(item.id)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl transition-all whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-900/50'
                }`}
              >
                <span className={active ? 'text-emerald-600 dark:text-emerald-400' : ''}>
                  {item.icon}
                </span>
                <span>{item.shortLabel}</span>
                {item.badge !== undefined && (
                  <span
                    className={`ml-0.5 font-mono text-[9px] font-bold tabular-nums px-1.5 py-0.2 rounded-full ${
                      active
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/50'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div aria-hidden="true" className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

          {secondaryNavItems.map((item) => {
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveNav(item.id)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl transition-all whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-900/50'
                }`}
              >
                <span className={active ? 'text-emerald-600 dark:text-emerald-400' : ''}>
                  {item.icon}
                </span>
                <span>{item.shortLabel}</span>
                {item.badge !== undefined && (
                  <span
                    className={`ml-0.5 font-mono text-[9px] font-bold tabular-nums px-1.5 py-0.2 rounded-full ${
                      active
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/50'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Zone: Primary Quick Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors whitespace-nowrap shrink-0 shadow-xs">
            <Upload className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden md:inline">Upload AERS</span>
            <span className="md:hidden">AERS</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadAersFile(file);
                e.target.value = '';
              }}
            />
          </label>

          <button
            type="button"
            onClick={() =>
              setContractModalState({
                isOpen: true,
                mode: 'add',
                contract: null,
              })
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 shadow-sm transition-all whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Contract</span>
            <span className="sm:hidden">Add</span>
          </button>

          <button
            type="button"
            onClick={() => setAdminModalOpen(true)}
            aria-label="Admin login and reset controls"
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition-colors whitespace-nowrap shrink-0 shadow-xs ${
              adminToken
                ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                : 'border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {adminToken ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Admin Active</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Admin</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setAnimKey((k) => k + 1)}
            title="Replay all dashboard and chart animations"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden 2xl:inline">Replay Animations</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDark((prev) => !prev)}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="inline-flex items-center justify-center p-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0 shadow-xs"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>
        </div>
      </header>

      {/* Sub-Header Live Strategy Strip */}
      <div className="bg-white/60 dark:bg-slate-900/40 border-b border-slate-200/80 dark:border-slate-800/80 px-4 sm:px-6 py-2.5">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-600 dark:text-slate-400 tabular-nums">
            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
              <RefreshCw className="w-3 h-3 shrink-0" />
              Auto-Sync Active
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Snapshot:{' '}
              <span className="font-mono text-slate-900 dark:text-slate-200">
                {aersMeta?.printedDateTime || '—'}
              </span>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Office Types:{' '}
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {strategySummary.officeTypesCount}
              </span>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {month30thLabel} Cutoff:{' '}
              <span className="font-mono font-semibold text-amber-700 dark:text-amber-400">
                {daysTo30th} {daysTo30th === 1 ? 'day' : 'days'} left
              </span>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Watchlist:{' '}
              <span className="font-mono text-slate-900 dark:text-slate-200">
                {trackedContracts.length}
              </span>{' '}
              of {aersRecords.length.toLocaleString()} indexed
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setWaModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Sync WhatsApp
            </button>

            <button
              type="button"
              onClick={handleTestPopup}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <BellRing className="w-3.5 h-3.5" />
              Test Pop-up
            </button>
          </div>
        </div>
      </div>

      {/* Live Scrolling Recovery Ticker */}
      <div className="bg-emerald-950/90 text-emerald-100 border-b border-emerald-900 overflow-hidden py-2 text-xs font-mono relative">
        <div className="absolute left-0 top-0 bottom-0 z-10 w-12 bg-gradient-to-r from-emerald-950 to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 z-10 w-12 bg-gradient-to-l from-emerald-950 to-transparent pointer-events-none" />
        <div className="animate-marquee flex items-center gap-8 whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5 font-bold text-emerald-300">
            <Bell className="w-3.5 h-3.5 animate-bounce" />
            LIVE RECOVERY ALERTS:
          </span>
          <span>· Today P/P: {alertDigest.todayPp.length} accounts committed</span>
          <span>· Broken P/P: {alertDigest.brokenPp.length} high priority follow-ups</span>
          <span>· 91-DPD Danger Zone: {alertDigest.dpd91Danger.length} contracts crossing this month</span>
          <span>· Hand Over Pending: {alertDigest.pendingHandOver.length} repossession files</span>
          <span>· WhatsApp GPS Pins Synced: {trackedContracts.filter(c => c.locationUrl).length} active locations</span>
          <span className="inline-flex items-center gap-1.5 font-bold text-emerald-300 ml-8">
            <Bell className="w-3.5 h-3.5 animate-bounce" />
            LIVE RECOVERY ALERTS:
          </span>
          <span>· Today P/P: {alertDigest.todayPp.length} accounts committed</span>
          <span>· Broken P/P: {alertDigest.brokenPp.length} high priority follow-ups</span>
          <span>· 91-DPD Danger Zone: {alertDigest.dpd91Danger.length} contracts crossing this month</span>
          <span>· Hand Over Pending: {alertDigest.pendingHandOver.length} repossession files</span>
          <span>· WhatsApp GPS Pins Synced: {trackedContracts.filter(c => c.locationUrl).length} active locations</span>
        </div>
      </div>

      {/* Dismissible Action Feedback Toast */}
      {toast && (
        <div className="px-4 sm:px-6 pt-4 max-w-[1600px] w-full mx-auto">
          <div
            role="status"
            className={`px-4 py-3 rounded-xl border flex items-start justify-between gap-3 text-xs ${
              toast.tone === 'error'
                ? 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                : toast.tone === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">{toast.title}</div>
                <div className="mt-0.5 opacity-90">{toast.detail}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Dismiss notification"
              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Viewport */}
      <main className="flex-1 p-4 sm:p-6 space-y-6 max-w-[1600px] w-full mx-auto">
        <motion.div
          key={activeNav}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-6"
        >
          {activeNav === 'overview' && (
            <>
              {/* Executive Strategy Dashboard Banner - Donezo Style Premium Elements */}
              <section
                aria-label="Recovery Strategy Summary"
                className="bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 text-white border border-emerald-800/40 rounded-3xl p-6 sm:p-7 shadow-xl shadow-slate-950/25 relative overflow-hidden backdrop-blur-xl"
              >
                {/* Continuous Ambient Energy Wave along Bottom Edge */}
                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 animate-pulse opacity-75" />

                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
                  <div className="space-y-3.5 max-w-2xl">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                        WG Pulse Executive Command · Campaign Nov 2026 – Mar 2027
                      </span>
                    </div>

                    <h1 className="font-display text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white leading-tight">
                      Current NPL &amp; Borderline Recovery Control
                    </h1>

                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
                      Strict NPL &amp; Borderline isolation separating 91+ DPD Classified, Opening NPL, and Critical 76–90 DPD Borderline accounts while excluding regular performing contracts.
                    </p>

                    {/* Executive Metric Cards Strip */}
                    <div className="grid grid-cols-3 gap-3 pt-1 tabular-nums max-w-xl">
                      <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                        <div className="text-[11px] font-medium text-slate-400">
                          Office Types
                        </div>
                        <div className="mt-1 text-lg sm:text-xl font-bold font-mono text-white">
                          {strategySummary.officeTypesCount}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveNav('borderline')}
                        className="text-left p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 hover:border-amber-400/60 backdrop-blur-md transition-all group"
                      >
                        <div className="text-[11px] font-medium text-amber-300 flex items-center justify-between">
                          <span>Next-Mo Borderline</span>
                          <span className="text-[9px] text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                        </div>
                        <div className="mt-1 text-lg sm:text-xl font-bold font-mono text-amber-200">
                          {strategySummary.borderlineCount}{' '}
                          <span className="text-xs font-normal text-amber-300/80 block sm:inline">
                            · {formatCompactRs(strategySummary.borderlineMinToSave)}
                          </span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveNav('worst')}
                        className="text-left p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 hover:border-rose-400/60 backdrop-blur-md transition-all group"
                      >
                        <div className="text-[11px] font-medium text-rose-300 flex items-center justify-between">
                          <span>WORST (W)</span>
                          <span className="text-[9px] text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                        </div>
                        <div className="mt-1 text-lg sm:text-xl font-bold font-mono text-rose-200">
                          {strategySummary.worstCount}
                        </div>
                      </button>
                    </div>

                    {/* Executive Action Bar */}
                    <div className="flex flex-wrap items-center gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() =>
                          setContractModalState({
                            isOpen: true,
                            mode: 'add',
                            contract: null,
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-md transition-all whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        + Add Contract
                      </button>

                      <label className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white cursor-pointer transition-all whitespace-nowrap">
                        <Upload className="w-3.5 h-3.5 text-emerald-400" />
                        Upload Daily AERS
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadAersFile(file);
                            e.target.value = '';
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => setActiveNav('borderline')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 text-amber-200 transition-all whitespace-nowrap"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Next Month Borderline
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setToolsSubTab('ai');
                          setActiveNav('tools');
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-slate-200 transition-all whitespace-nowrap"
                      >
                        <Bot className="w-3.5 h-3.5 text-teal-300" />
                        AI &amp; Google Maps
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-center shrink-0">
                    <div className="w-full sm:w-72 h-44 rounded-2xl overflow-hidden border border-emerald-500/20 shadow-lg bg-slate-950">
                      <img
                        src={strategyHeroImg}
                        alt="WG Pulse Leasing & Finance Recovery Strategy Illustration"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <KpiStrip
                contracts={trackedContracts}
                aersRecords={aersRecords}
                mrpMap={mrpMap}
                animKey={animKey}
              />

              {/* Trends & Daily Age Evaluation Sections Integrated Directly on Main Dashboard */}
              <TrendsEvaluationPanel
                trackedContracts={trackedContracts}
                aersRecords={aersRecords}
                aersMeta={aersMeta}
                mrpMap={mrpMap}
                openingBaseline={openingBaseline}
                isDark={isDark}
                onUploadAersFile={handleUploadAersFile}
                onPasteAersText={handlePasteAersText}
                onSetCurrentAsOpening={handleSetCurrentAsOpening}
                onOpenWorstRadar={() => setActiveNav('worst')}
                onOpenBorderlineCards={() => setActiveNav('borderline')}
              />

              <TrackingTable
                contracts={trackedContracts}
                mrpMap={mrpMap}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                onLogVisit={(c) =>
                  setContractModalState({
                    isOpen: true,
                    mode: 'log_visit',
                    contract: c,
                  })
                }
                onEditContract={(c) =>
                  setContractModalState({
                    isOpen: true,
                    mode: 'edit',
                    contract: c,
                  })
                }
                onViewHistory={(c) => setHistoryContract(c)}
                onRemoveContract={handleRemoveContract}
                onOpenAddModal={() =>
                  setContractModalState({
                    isOpen: true,
                    mode: 'add',
                    contract: null,
                  })
                }
              />

              <AnalyticsCharts
                contracts={trackedContracts}
                aersRecords={aersRecords}
                snapshots={monthlySnapshots}
                isDark={isDark}
                showSnapshotLedger={true}
                animKey={animKey}
                onAddSnapshot={(s) =>
                  setMonthlySnapshots((prev) => [...prev, s])
                }
                onUpdateSnapshot={(s) =>
                  setMonthlySnapshots((prev) =>
                    prev.map((x) => (x.id === s.id ? s : x)),
                  )
                }
                onDeleteSnapshot={(id) =>
                  setMonthlySnapshots((prev) =>
                    prev.filter((x) => x.id !== id),
                  )
                }
              />
            </>
          )}

          {activeNav === 'borderline' && (
            <NextMonthBorderlineCardsPanel
              trackedContracts={trackedContracts}
              aersRecords={aersRecords}
              mrpMap={mrpMap}
              onAddFromMaster={handleAddFromMaster}
              onLogVisit={(c) =>
                setContractModalState({
                  isOpen: true,
                  mode: 'log_visit',
                  contract: c,
                })
              }
            />
          )}

          {activeNav === 'worst' && (
            <WorstCasePanel
              trackedContracts={trackedContracts}
              aersRecords={aersRecords}
              mrpMap={mrpMap}
              onAddFromMaster={handleAddFromMaster}
            />
          )}

          {activeNav === 'tools' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div
                  role="tablist"
                  aria-label="Recovery Tools Menu"
                  className="inline-flex flex-wrap items-center gap-1 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={toolsSubTab === 'office_breakdown'}
                    onClick={() => setToolsSubTab('office_breakdown')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      toolsSubTab === 'office_breakdown'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    Office Type → RO Breakdown
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={toolsSubTab === 'bm_analytics'}
                    onClick={() => setToolsSubTab('bm_analytics')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      toolsSubTab === 'bm_analytics'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    BM &amp; Portfolio Analytics
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={toolsSubTab === 'ai'}
                    onClick={() => setToolsSubTab('ai')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      toolsSubTab === 'ai'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Bot className="w-3.5 h-3.5" />
                    AI Agent &amp; Google Maps
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={toolsSubTab === 'alerts'}
                    onClick={() => setToolsSubTab('alerts')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      toolsSubTab === 'alerts'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Bell className="w-3.5 h-3.5" />
                    Alerts &amp; Pop-ups
                    {urgentAlertsCount > 0 && (
                      <span
                        className={`ml-1 px-1.5 py-0.5 text-[10px] font-mono rounded-md ${
                          toolsSubTab === 'alerts'
                            ? 'bg-white/20 text-white'
                            : 'bg-red-500/15 text-red-700 dark:text-red-300'
                        }`}
                      >
                        {urgentAlertsCount}
                      </span>
                    )}
                  </button>
                </div>

                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  {monthlySnapshots.length} saved monthly snapshots
                </span>
              </div>

              {toolsSubTab === 'office_breakdown' && (
                <OfficeTypeBreakdownPanel
                  trackedContracts={trackedContracts}
                  aersRecords={aersRecords}
                  title="Office Type -> RO Breakdown (NPL & Borderline)"
                />
              )}

              {toolsSubTab === 'bm_analytics' && (
                <BmPortfolioAnalyticsPanel
                  aersRecords={aersRecords}
                  aersMeta={aersMeta}
                  mrpMap={mrpMap}
                  trackedContracts={trackedContracts}
                  monthlySnapshots={monthlySnapshots}
                  isDark={isDark}
                  onAddFromMaster={handleAddFromMaster}
                  onLogVisit={(c) =>
                    setContractModalState({
                      isOpen: true,
                      mode: 'log_visit',
                      contract: c,
                    })
                  }
                />
              )}

              {toolsSubTab === 'ai' && (
                <AiRecoveryAgentPanel
                  trackedContracts={trackedContracts}
                  aersRecords={aersRecords}
                  aersMeta={aersMeta}
                  openingBaseline={openingBaseline}
                />
              )}

              {toolsSubTab === 'alerts' && (
                <AlertsNotificationsPanel
                  contracts={trackedContracts}
                  prefs={notifPrefs}
                  permissionState={permissionState}
                  onUpdatePrefs={setNotifPrefs}
                  onRequestPermission={handleRequestNotifPermission}
                  onTestPopup={handleTestPopup}
                  onLogVisit={(c) =>
                    setContractModalState({
                      isOpen: true,
                      mode: 'log_visit',
                      contract: c,
                    })
                  }
                />
              )}
            </div>
          )}

          {activeNav === 'settings' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div
                  role="tablist"
                  aria-label="Settings Menu"
                  className="inline-flex flex-wrap items-center gap-1 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={settingsSubTab === 'lookup'}
                    onClick={() => setSettingsSubTab('lookup')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      settingsSubTab === 'lookup'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Database className="w-3.5 h-3.5" />
                    NPL &amp; Borderline Master Lookup ({aersRecords.length.toLocaleString()})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={settingsSubTab === 'backup'}
                    onClick={() => setSettingsSubTab('backup')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      settingsSubTab === 'backup'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <HardDriveDownload className="w-3.5 h-3.5" />
                    Backup, Restore &amp; Admin Reset
                  </button>
                </div>
              </div>

              {settingsSubTab === 'lookup' ? (
                <AersLookupPanel
                  aersRecords={aersRecords}
                  aersMeta={aersMeta}
                  mrpMap={mrpMap}
                  trackedContractNos={trackedContractNos}
                  onUploadAersFile={handleUploadAersFile}
                  onAddFromMaster={handleAddFromMaster}
                />
              ) : (
                <BackupSettingsPanel
                  trackedCount={trackedContracts.length}
                  snapshotsCount={monthlySnapshots.length}
                  aersMeta={aersMeta}
                  isAdminAuthenticated={Boolean(adminToken)}
                  onOpenAdminModal={() => setAdminModalOpen(true)}
                  onExportBackup={handleExportBackup}
                  onRestoreBackup={handleRestoreBackup}
                />
              )}
            </div>
          )}
        </motion.div>
      </main>

      {/* Premium Footer (with bottom clearance for the floating glass dock) */}
      <footer className="mt-8 pb-28 px-4 sm:px-6 border-t border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/50 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <PulseLogoMark className="w-7 h-7 shrink-0" />
            <div>
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                WG Pulse · Leasing &amp; Finance Recovery Control
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Single-copy daily AERS sync · Office Type → RO Strategy · AI Strategist &amp; Google Maps Grounding
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-600 dark:text-slate-400 tabular-nums">
            <span>
              Office Types:{' '}
              <strong className="font-mono text-slate-900 dark:text-slate-200">
                {strategySummary.officeTypesCount}
              </strong>
            </span>
            <span>
              AERS Indexed:{' '}
              <strong className="font-mono text-slate-900 dark:text-slate-200">
                {aersRecords.length.toLocaleString()}
              </strong>
            </span>
            <span>
              Watchlist:{' '}
              <strong className="font-mono text-slate-900 dark:text-slate-200">
                {trackedContracts.length}
              </strong>
            </span>
            <span>
              Cutoff:{' '}
              <strong className="font-mono text-amber-700 dark:text-amber-400">
                {daysTo30th}d remaining
              </strong>
            </span>
            <button
              type="button"
              onClick={() => setAdminModalOpen(true)}
              className="inline-flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              {adminToken ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Admin Unlocked
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  Admin Reset Gateway
                </>
              )}
            </button>
          </div>
        </div>
      </footer>

      {/* Transparent Floating Glass Bottom Menu Dock */}
      <nav
        aria-label="Primary Floating Glass Bottom Menu"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-[95vw] overflow-x-auto bg-white/65 dark:bg-slate-900/65 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 shadow-[0_12px_40px_-10px_rgba(15,23,42,0.28)] rounded-2xl p-1.5"
      >
        <div className="flex items-center gap-1">
          {primaryNavItems.map((item) => {
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveNav(item.id)}
                className={`relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="glassDockActive"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 bg-blue-600/95 dark:bg-blue-500/95 rounded-xl shadow-sm"
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  {item.icon}
                  <span>{item.shortLabel}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`ml-0.5 font-mono text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md ${
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-red-500/15 text-red-700 dark:text-red-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </span>
              </button>
            );
          })}

          <div
            aria-hidden="true"
            className="h-6 w-px bg-slate-300/70 dark:bg-slate-700/70 mx-1 shrink-0"
          />

          {secondaryNavItems.map((item) => {
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveNav(item.id)}
                className={`relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="glassDockActive"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 bg-slate-900/90 dark:bg-blue-500/95 rounded-xl shadow-sm"
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  {item.icon}
                  <span>{item.shortLabel}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`ml-0.5 font-mono text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md ${
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-red-500/15 text-red-700 dark:text-red-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modals */}
      <AdminLoginModal
        isOpen={adminModalOpen}
        isAdminAuthenticated={Boolean(adminToken)}
        onClose={() => setAdminModalOpen(false)}
        onLoginSuccess={(token) => {
          setAdminToken(token);
          showToast(
            'Admin Session Unlocked',
            'Total App Reset control is now unlocked for this session.',
            'success',
          );
        }}
        onLogoutAdmin={() => {
          setAdminToken(null);
          showToast(
            'Admin Session Locked',
            'Admin reset privilege has been locked.',
            'info',
          );
        }}
        onConfirmReset={handleAuthorizedReset}
      />

      <ContractModal
        isOpen={contractModalState.isOpen}
        mode={contractModalState.mode}
        initialContract={contractModalState.contract}
        aersMap={aersMap}
        mrpMap={mrpMap}
        existingContractNos={trackedContractNos}
        regularContractNos={regularContractNos}
        onClose={() =>
          setContractModalState({ isOpen: false, mode: 'add', contract: null })
        }
        onSaveSingle={handleSaveSingleContract}
        onBulkAdd={handleBulkAddContracts}
      />

      <VisitHistoryModal
        contract={historyContract}
        onClose={() => setHistoryContract(null)}
        onLogNewVisit={(c) =>
          setContractModalState({
            isOpen: true,
            mode: 'log_visit',
            contract: c,
          })
        }
      />

      <WhatsAppSyncModal
        isOpen={waModalOpen}
        trackedContracts={trackedContracts}
        onClose={() => setWaModalOpen(false)}
        onApplyMatches={handleApplyWhatsAppMatches}
      />
    </div>
  );
}
