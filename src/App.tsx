import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  BadgeDollarSign,
  Banknote,
  BarChart3,
  Bell,
  BellRing,
  Briefcase,
  Building2,
  Camera,
  CheckCircle2,
  Cloud,
  Crop,
  Database,
  Flame,
  Globe,
  HardDriveDownload,
  History,
  Landmark,
  Lock,
  Menu,
  Moon,
  PieChart,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Trophy,
  Upload,
  X,
} from 'lucide-react';
import { AdminLoginModal } from './components/AdminLoginModal';
import { AersLookupPanel } from './components/AersLookupPanel';
import { AlertsNotificationsPanel } from './components/AlertsNotificationsPanel';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { BackupSettingsPanel } from './components/BackupSettingsPanel';
import { BelowOneRatioPanel } from './components/BelowOneRatioPanel';
import { BelowThreeCollectionPanel } from './components/BelowThreeCollectionPanel';
import { BmPortfolioAnalyticsPanel } from './components/BmPortfolioAnalyticsPanel';
import { ExecutiveOfficerHubPanel } from './components/ExecutiveOfficerHubPanel';
import { FbIncentivePanel } from './components/FbIncentivePanel';
import strategyHeroImg from './assets/images/finance_strategy_hero_1795684833730.jpg';
import { KpiStrip } from './components/KpiStrip';
import { MobileNavigationShell } from './components/MobileNavigationShell';
import { NextMonthBorderlineCardsPanel } from './components/NextMonthBorderlineCardsPanel';
import { OfficeTypeBreakdownPanel } from './components/OfficeTypeBreakdownPanel';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { StaffFollowUpMonitorPanel } from './components/StaffFollowUpMonitorPanel';
import { TrendsEvaluationPanel } from './components/TrendsEvaluationPanel';
import {
  UniversalSnapshotManager,
  type SnapshotMode,
} from './components/UniversalSnapshotManager';
import { UploadHistoryPanel } from './components/UploadHistoryPanel';
import { WeeklyBackupPromptModal } from './components/WeeklyBackupPromptModal';
import { WorstCasePanel } from './components/WorstCasePanel';
import { XpRewardsHubPanel } from './components/XpRewardsHubPanel';
import { useLanguage, type AppLanguage } from './contexts/LanguageContext';
import type {
  AersMetadata,
  AersRecord,
  BackupPayload,
  FileUploadHistoryEntry,
  MonthlySnapshot,
  MrpEnrichment,
  MrpPaymentMonth,
  NavSection,
  NotificationPreferences,
  OpeningOfficerBaseline,
  StaffAssignedContract,
  WeeklyBackupSchedule,
} from './types/recovery';
import {
  analyzeNextMonthBorderline,
  buildDailyAersSnapshot,
  buildOpeningOfficerBaseline,
  captureSystemActiveDateTime,
  computeOfficeTypeBreakdown,
  formatCompactRs,
  getDaysRemainingTo30th,
  getMonth30thLabel,
  getOfficerByOfficeType,
  getTodayISO,
  isBorderlineNplAccount,
  isFallenNplAccount,
  isWorstCategory,
  normalizeContractNo,
  normalizeEvaluableFromAers,
  parseAersWorkbook,
  playAlertChime,
} from './utils/recoveryEngine';
import type { ParsedAersResult } from './utils/recoveryEngine';
import {
  fetchLiveCloudData,
  hydratePermanentGithubToken,
  publishLiveCloudData,
  subscribeLocalTabUpdates,
} from './utils/githubSync';
import {
  DEFAULT_WEEKLY_BACKUP_SCHEDULE,
  evaluateWeeklyBackupSchedule,
} from './utils/weeklyBackup';

const STORAGE_KEYS = {
  TRACKED: 'wg_v2_tracked_contracts',
  AERS_MASTER: 'wg_v2_aers_master',
  AERS_META: 'wg_v2_aers_meta',
  MRP_MAP: 'wg_v2_mrp_map',
  OPENING_BASELINE: 'wg_v2_opening_baseline',
  SNAPSHOTS: 'wg_v2_monthly_snapshots',
  STAFF_ASSIGNMENTS: 'wg_v2_staff_assignments',
  UPLOAD_HISTORY: 'wg_v2_upload_history',
  WEEKLY_BACKUP: 'wg_v2_weekly_backup_schedule',
  NOTIF_PREFS: 'wg_v2_notification_prefs',
  THEME: 'wg_v2_theme',
};

const EMPTY_STRING_SET = new Set<string>();

const COMPANY_LOGO_URL = `${import.meta.env.BASE_URL}og-cc.png`;
const COMPANY_LOGO_FALLBACK_URL =
  'https://raw.githubusercontent.com/Sihnalahiru/WG-NPL-Pulse/main/public/og-cc.png';

function handleCompanyLogoError(e: React.SyntheticEvent<HTMLImageElement>) {
  if (e.currentTarget.src !== COMPANY_LOGO_FALLBACK_URL) {
    e.currentTarget.src = COMPANY_LOGO_FALLBACK_URL;
  }
}

interface DataShapeMismatch {
  source: string;
  field: string;
  expected: string;
  received: string;
  index?: number;
  recordKey?: string;
  action: 'dropped' | 'coerced' | 'fallback';
  message: string;
}

interface SanitizeReport<T> {
  data: T;
  issues: DataShapeMismatch[];
  droppedCount: number;
  coercedCount: number;
}

const MAX_LOGGED_ISSUES_PER_BATCH = 25;

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return Boolean(val && typeof val === 'object' && !Array.isArray(val));
}

function describeValueType(val: unknown): string {
  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (Array.isArray(val)) return `array(len=${val.length})`;
  if (typeof val === 'boolean') return `boolean(${String(val)})`;
  if (typeof val === 'number') return Number.isFinite(val) ? 'number' : `number(${String(val)})`;
  if (typeof val === 'string') return val.length === 0 ? 'string(empty)' : 'string';
  if (val instanceof Map) return `Map(size=${val.size})`;
  if (val instanceof Set) return `Set(size=${val.size})`;
  return typeof val;
}

type IssueReporter = (issue: Omit<DataShapeMismatch, 'source'>) => void;

function runDataSanitizer<T>(
  source: string,
  raw: unknown,
  fallback: T,
  sanitizer: (input: unknown, report: IssueReporter) => T,
): SanitizeReport<T> {
  const issues: DataShapeMismatch[] = [];
  let droppedCount = 0;
  let coercedCount = 0;

  const report: IssueReporter = (issue) => {
    if (issue.action === 'dropped') droppedCount += 1;
    if (issue.action === 'coerced') coercedCount += 1;
    if (issues.length < MAX_LOGGED_ISSUES_PER_BATCH) {
      issues.push({ source, ...issue });
    }
  };

  try {
    const data = sanitizer(raw, report);
    if (issues.length > 0 || droppedCount > 0 || coercedCount > 0) {
      const totalFlagged = droppedCount + coercedCount + issues.filter((i) => i.action === 'fallback').length;
      console.groupCollapsed(
        `[WG Pulse DataGuard] Shape mismatch in "${source}" (${droppedCount} dropped, ${coercedCount} coerced, ${totalFlagged} total issues)`,
      );
      console.warn('Sanitizer recovered before render cycle. Sample mismatches:', issues);
      if (totalFlagged > issues.length) {
        console.warn(`...and ${totalFlagged - issues.length} additional mismatches omitted from log.`);
      }
      console.groupEnd();
    }
    return { data, issues, droppedCount, coercedCount };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const fatalIssue: DataShapeMismatch = {
      source,
      field: '<root>',
      expected: 'valid parseable structure',
      received: describeValueType(raw),
      action: 'fallback',
      message: `Unhandled exception during sanitization: ${errMsg}`,
    };
    console.error(`[WG Pulse DataGuard] Fatal parse error in "${source}":`, err);
    return {
      data: fallback,
      issues: [fatalIssue],
      droppedCount: 0,
      coercedCount: 0,
    };
  }
}

function coerceStringField(
  obj: Record<string, unknown>,
  field: string,
  report: IssueReporter,
  index?: number,
  recordKey?: string,
  defaultValue = '',
): string {
  const val = obj[field];
  if (val === undefined || val === null) return defaultValue;
  if (typeof val === 'string') return val;
  if (typeof val === 'number' && Number.isFinite(val)) {
    report({
      field,
      expected: 'string',
      received: describeValueType(val),
      index,
      recordKey,
      action: 'coerced',
      message: `Coerced numeric "${field}" to string.`,
    });
    return String(val);
  }
  report({
    field,
    expected: 'string',
    received: describeValueType(val),
    index,
    recordKey,
    action: 'coerced',
    message: `Unexpected ${describeValueType(val)} for string field "${field}"; reset to default.`,
  });
  return defaultValue;
}

function coerceNumberField(
  obj: Record<string, unknown>,
  field: string,
  report: IssueReporter,
  index?: number,
  recordKey?: string,
  defaultValue = 0,
): number {
  const val = obj[field];
  if (val === undefined || val === null || val === '') return defaultValue;
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string') {
    const parsed = Number(val.replace(/,/g, '').trim());
    if (Number.isFinite(parsed)) {
      report({
        field,
        expected: 'number',
        received: 'numeric string',
        index,
        recordKey,
        action: 'coerced',
        message: `Parsed string "${field}" into number.`,
      });
      return parsed;
    }
  }
  report({
    field,
    expected: 'finite number',
    received: describeValueType(val),
    index,
    recordKey,
    action: 'coerced',
    message: `Unexpected ${describeValueType(val)} for numeric field "${field}"; reset to ${defaultValue}.`,
  });
  return defaultValue;
}

function sanitizePaymentPattern(
  raw: unknown,
  report: IssueReporter,
  recordKey: string,
  index?: number,
): MrpPaymentMonth[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    report({
      field: 'mrp.paymentPattern',
      expected: 'MrpPaymentMonth[]',
      received: describeValueType(raw),
      index,
      recordKey,
      action: 'coerced',
      message: `Expected array for mrp.paymentPattern, received ${describeValueType(raw)}.`,
    });
    return [];
  }
  const clean: MrpPaymentMonth[] = [];
  raw.forEach((entry, idx) => {
    if (!isPlainObject(entry)) {
      report({
        field: `mrp.paymentPattern[${idx}]`,
        expected: 'object',
        received: describeValueType(entry),
        index,
        recordKey,
        action: 'dropped',
        message: 'Dropped non-object entry in mrp.paymentPattern.',
      });
      return;
    }
    clean.push(entry as unknown as MrpPaymentMonth);
  });
  return clean;
}

const AERS_STRING_FIELDS = [
  'no',
  'cusName',
  'contractDate',
  'nextDueDate',
  'lastPayDate',
  'contractStatus',
  'recoveryStatus',
  'marketingOfficer',
  'recoveryOfficer',
  'currentStock',
  'department',
  'address',
  'mobileNo',
  'nplReason',
  'worstCaseProduct',
  'officeType',
  'currentRc',
] as const;

const AERS_NUMBER_FIELDS = [
  'opAge',
  'currentAge',
  'opBalDebtor',
  'closingDebtor',
  'dueBudgetMonth',
  'currentMonthDue',
  'totalCollection',
  'cashColl',
  'capitalOutstanding',
  'interestInSuspense',
  'actualDpd',
  'monthEndForecastDpd',
  'minAmountToReverseNpl',
  'opNpl',
  'npl',
  'lastPaidAmount',
  'financeAmount',
  'opCapitalOutstanding',
  'totalEfforts',
  'assignOfficerEfforts',
] as const;

function sanitizeAersListWithReport(
  raw: unknown,
  source = 'aersRecords',
): SanitizeReport<AersRecord[]> {
  return runDataSanitizer<AersRecord[]>(source, raw, [], (input, report) => {
    if (!Array.isArray(input)) {
      report({
        field: '<root>',
        expected: 'AersRecord[]',
        received: describeValueType(input),
        action: 'fallback',
        message: `Expected an array of AERS records, got ${describeValueType(input)}.`,
      });
      return [];
    }

    const result: AersRecord[] = [];
    input.forEach((item, index) => {
      if (!isPlainObject(item)) {
        report({
          field: `[${index}]`,
          expected: 'AersRecord object',
          received: describeValueType(item),
          index,
          action: 'dropped',
          message: `Dropped malformed AERS record at index ${index}.`,
        });
        return;
      }

      const rawContractNo = item.contractNo;
      const contractNo =
        typeof rawContractNo === 'string'
          ? rawContractNo.trim()
          : typeof rawContractNo === 'number' && Number.isFinite(rawContractNo)
            ? String(rawContractNo)
            : '';

      if (!contractNo) {
        report({
          field: 'contractNo',
          expected: 'non-empty string',
          received: describeValueType(rawContractNo),
          index,
          action: 'dropped',
          message: `Dropped AERS record at index ${index} missing valid contractNo.`,
        });
        return;
      }

      if (typeof rawContractNo !== 'string') {
        report({
          field: 'contractNo',
          expected: 'string',
          received: describeValueType(rawContractNo),
          index,
          recordKey: contractNo,
          action: 'coerced',
          message: 'Coerced numeric contractNo to string.',
        });
      }

      const cleaned: Record<string, unknown> = { ...item, contractNo };
      for (const field of AERS_STRING_FIELDS) {
        cleaned[field] = coerceStringField(item, field, report, index, contractNo);
      }
      for (const field of AERS_NUMBER_FIELDS) {
        cleaned[field] = coerceNumberField(item, field, report, index, contractNo);
      }
      if (item.capitalArrears !== undefined) {
        cleaned.capitalArrears = coerceNumberField(item, 'capitalArrears', report, index, contractNo);
      }

      result.push(cleaned as unknown as AersRecord);
    });

    return result;
  });
}

function sanitizeAersList(raw: unknown, source = 'aersRecords'): AersRecord[] {
  return sanitizeAersListWithReport(raw, source).data;
}

function sanitizeStaffAssignmentsWithReport(
  raw: unknown,
  source = 'staffAssignments',
): SanitizeReport<StaffAssignedContract[]> {
  return runDataSanitizer<StaffAssignedContract[]>(source, raw, [], (input, report) => {
    if (!Array.isArray(input)) {
      report({
        field: '<root>',
        expected: 'StaffAssignedContract[]',
        received: describeValueType(input),
        action: 'fallback',
        message: `Expected an array of staff assignments, got ${describeValueType(input)}.`,
      });
      return [];
    }

    const result: StaffAssignedContract[] = [];
    input.forEach((item, index) => {
      if (!isPlainObject(item)) {
        report({
          field: `[${index}]`,
          expected: 'StaffAssignedContract object',
          received: describeValueType(item),
          index,
          action: 'dropped',
          message: `Dropped malformed staff assignment at index ${index}.`,
        });
        return;
      }

      const contractNo =
        typeof item.contractNo === 'string'
          ? item.contractNo.trim()
          : typeof item.contractNo === 'number' && Number.isFinite(item.contractNo)
            ? String(item.contractNo)
            : '';
      const staffName = typeof item.staffName === 'string' ? item.staffName.trim() : '';
      const monthKey = typeof item.monthKey === 'string' ? item.monthKey.trim() : '';

      if (!contractNo || !staffName || !monthKey) {
        report({
          field: !contractNo ? 'contractNo' : !staffName ? 'staffName' : 'monthKey',
          expected: 'non-empty string',
          received: describeValueType(
            !contractNo ? item.contractNo : !staffName ? item.staffName : item.monthKey,
          ),
          index,
          action: 'dropped',
          message: `Dropped staff assignment at index ${index} missing contractNo, staffName, or monthKey.`,
        });
        return;
      }

      const toFiniteNum = (val: unknown): number => {
        if (typeof val === 'number' && Number.isFinite(val)) return val;
        const parsed = Number(val);
        return Number.isFinite(parsed) ? parsed : 0;
      };

      result.push({
        contractNo,
        staffName,
        monthKey,
        assignedAt:
          typeof item.assignedAt === 'string' && item.assignedAt.trim()
            ? item.assignedAt.trim()
            : getTodayISO(),
        assignedOpAge: toFiniteNum(item.assignedOpAge),
        assignedDebtor: toFiniteNum(item.assignedDebtor),
        assignedNpl: toFiniteNum(item.assignedNpl),
        assignedDue: toFiniteNum(item.assignedDue),
        assignedCollection: toFiniteNum(item.assignedCollection),
        note: typeof item.note === 'string' && item.note.trim() ? item.note.trim() : undefined,
      });
    });

    return result;
  });
}

function sanitizeStaffAssignments(
  raw: unknown,
  source = 'staffAssignments',
): StaffAssignedContract[] {
  return sanitizeStaffAssignmentsWithReport(raw, source).data;
}

function sanitizeMrpMapWithReport(
  raw: unknown,
  source = 'mrpMap',
): SanitizeReport<Map<string, MrpEnrichment>> {
  return runDataSanitizer<Map<string, MrpEnrichment>>(
    source,
    raw,
    new Map<string, MrpEnrichment>(),
    (input, report) => {
      const map = new Map<string, MrpEnrichment>();
      if (input === null || input === undefined) return map;

      const entries: [string, unknown][] =
        input instanceof Map
          ? Array.from(input.entries()).map(([k, v]) => [String(k), v])
          : isPlainObject(input)
            ? Object.entries(input)
            : [];

      if (!(input instanceof Map) && !isPlainObject(input)) {
        report({
          field: '<root>',
          expected: 'Record<string, MrpEnrichment> | Map',
          received: describeValueType(input),
          action: 'fallback',
          message: `Expected plain object or Map for mrpMap, got ${describeValueType(input)}.`,
        });
        return map;
      }

      for (const [k, v] of entries) {
        if (!isPlainObject(v)) {
          report({
            field: k,
            expected: 'MrpEnrichment object',
            received: describeValueType(v),
            recordKey: k,
            action: 'dropped',
            message: `Dropped malformed MRP entry for "${k}".`,
          });
          continue;
        }
        const obj = v as unknown as MrpEnrichment;
        map.set(k, {
          ...obj,
          nplCategory: coerceStringField(v, 'nplCategory', report, undefined, k),
          bucketMovement: coerceStringField(v, 'bucketMovement', report, undefined, k),
          impairmentStage: coerceStringField(v, 'impairmentStage', report, undefined, k),
          recoveryAttention: coerceStringField(v, 'recoveryAttention', report, undefined, k),
          notPaidSummary: coerceStringField(v, 'notPaidSummary', report, undefined, k),
          paymentPattern: sanitizePaymentPattern(v.paymentPattern, report, k),
        });
      }
      return map;
    },
  );
}

function sanitizeMrpMap(raw: unknown, source = 'mrpMap'): Map<string, MrpEnrichment> {
  return sanitizeMrpMapWithReport(raw, source).data;
}

function sanitizeSnapshotsListWithReport(
  raw: unknown,
  source = 'monthlySnapshots',
): SanitizeReport<MonthlySnapshot[]> {
  return runDataSanitizer<MonthlySnapshot[]>(source, raw, [], (input, report) => {
    if (!Array.isArray(input)) {
      report({
        field: '<root>',
        expected: 'MonthlySnapshot[]',
        received: describeValueType(input),
        action: 'fallback',
        message: `Expected array of monthly snapshots, got ${describeValueType(input)}.`,
      });
      return [];
    }

    const result: MonthlySnapshot[] = [];
    input.forEach((item, index) => {
      if (!isPlainObject(item)) {
        report({
          field: `[${index}]`,
          expected: 'MonthlySnapshot object',
          received: describeValueType(item),
          index,
          action: 'dropped',
          message: `Dropped malformed snapshot at index ${index}.`,
        });
        return;
      }
      const id = coerceStringField(item, 'id', report, index, undefined, `snap_${index}`);
      const snapshotDate = coerceStringField(item, 'snapshotDate', report, index, id);
      if (!snapshotDate) {
        report({
          field: 'snapshotDate',
          expected: 'non-empty date string',
          received: describeValueType(item.snapshotDate),
          index,
          recordKey: id,
          action: 'dropped',
          message: `Dropped snapshot "${id}" with missing snapshotDate.`,
        });
        return;
      }
      result.push({
        ...(item as unknown as MonthlySnapshot),
        id,
        snapshotDate,
        label: coerceStringField(item, 'label', report, index, id, snapshotDate),
        trackedCount: coerceNumberField(item, 'trackedCount', report, index, id),
        trackedDebtor: coerceNumberField(item, 'trackedDebtor', report, index, id),
        trackedNpl: coerceNumberField(item, 'trackedNpl', report, index, id),
        nplSavedAmount: coerceNumberField(item, 'nplSavedAmount', report, index, id),
        nplSavedCount: coerceNumberField(item, 'nplSavedCount', report, index, id),
        newNplAmount: coerceNumberField(item, 'newNplAmount', report, index, id),
        fallenNplCount: coerceNumberField(item, 'fallenNplCount', report, index, id),
        collectionPct: coerceNumberField(item, 'collectionPct', report, index, id),
      });
    });

    return result;
  });
}

function sanitizeOpeningBaseline(
  raw: unknown,
  source = 'openingBaseline',
): OpeningOfficerBaseline | null {
  return runDataSanitizer<OpeningOfficerBaseline | null>(source, raw, null, (input, report) => {
    if (input === null || input === undefined) return null;
    if (!isPlainObject(input)) {
      report({
        field: '<root>',
        expected: 'OpeningOfficerBaseline object',
        received: describeValueType(input),
        action: 'fallback',
        message: `Expected OpeningOfficerBaseline object, got ${describeValueType(input)}.`,
      });
      return null;
    }

    const rawByOfficer = input.byOfficer;
    const cleanByOfficer: OpeningOfficerBaseline['byOfficer'] = {};

    if (!isPlainObject(rawByOfficer)) {
      report({
        field: 'byOfficer',
        expected: 'Record<string, OfficerBaselineTotals>',
        received: describeValueType(rawByOfficer),
        action: 'coerced',
        message: `Missing or invalid "byOfficer" map (${describeValueType(rawByOfficer)}); initialized empty.`,
      });
    } else {
      for (const [officerKey, totals] of Object.entries(rawByOfficer)) {
        if (!isPlainObject(totals)) {
          report({
            field: `byOfficer.${officerKey}`,
            expected: 'object',
            received: describeValueType(totals),
            recordKey: officerKey,
            action: 'dropped',
            message: `Dropped malformed opening baseline entry for officer "${officerKey}".`,
          });
          continue;
        }
        cleanByOfficer[officerKey] = {
          openingCount: coerceNumberField(totals, 'openingCount', report, undefined, officerKey),
          openingDebtor: coerceNumberField(totals, 'openingDebtor', report, undefined, officerKey),
          openingNpl: coerceNumberField(totals, 'openingNpl', report, undefined, officerKey),
          openingNplCount: coerceNumberField(totals, 'openingNplCount', report, undefined, officerKey),
        };
      }
    }

    return {
      printedDateTime: coerceStringField(input, 'printedDateTime', report),
      byOfficer: cleanByOfficer,
    };
  }).data;
}

function sanitizeUploadHistoryList(
  raw: unknown,
): FileUploadHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const validTypes = new Set([
    'AERS Workbook',
    'JSON Backup Restore',
    'Manual Live Publish',
  ]);
  const validStatuses = new Set(['published_live', 'local_only', 'sync_failed']);
  const result: FileUploadHistoryEntry[] = [];
  for (const item of raw) {
    if (!isPlainObject(item)) continue;
    const id = typeof item.id === 'string' && item.id ? item.id : `upl_${result.length}`;
    const fileName =
      typeof item.fileName === 'string' && item.fileName
        ? item.fileName
        : 'Uploaded File';
    const fileType = validTypes.has(String(item.fileType))
      ? (item.fileType as FileUploadHistoryEntry['fileType'])
      : 'AERS Workbook';
    const cloudSyncStatus = validStatuses.has(String(item.cloudSyncStatus))
      ? (item.cloudSyncStatus as FileUploadHistoryEntry['cloudSyncStatus'])
      : 'local_only';
    result.push({
      id,
      fileName,
      fileType,
      fileSizeBytes:
        typeof item.fileSizeBytes === 'number' && Number.isFinite(item.fileSizeBytes)
          ? item.fileSizeBytes
          : undefined,
      uploadedAtIso:
        typeof item.uploadedAtIso === 'string' ? item.uploadedAtIso : '',
      systemDate: typeof item.systemDate === 'string' ? item.systemDate : '',
      systemTime: typeof item.systemTime === 'string' ? item.systemTime : '',
      systemDateTimeLabel:
        typeof item.systemDateTimeLabel === 'string'
          ? item.systemDateTimeLabel
          : `${String(item.systemDate || '')} ${String(item.systemTime || '')}`.trim(),
      timeZone: typeof item.timeZone === 'string' ? item.timeZone : 'Local',
      excelPrintedDateTime:
        typeof item.excelPrintedDateTime === 'string'
          ? item.excelPrintedDateTime
          : undefined,
      recordsCount:
        typeof item.recordsCount === 'number' && Number.isFinite(item.recordsCount)
          ? item.recordsCount
          : 0,
      totalPortfolioCount:
        typeof item.totalPortfolioCount === 'number' &&
        Number.isFinite(item.totalPortfolioCount)
          ? item.totalPortfolioCount
          : undefined,
      nplCount:
        typeof item.nplCount === 'number' && Number.isFinite(item.nplCount)
          ? item.nplCount
          : undefined,
      closingNplAmount:
        typeof item.closingNplAmount === 'number' &&
        Number.isFinite(item.closingNplAmount)
          ? item.closingNplAmount
          : undefined,
      snapshotAction:
        typeof item.snapshotAction === 'string' ? item.snapshotAction : undefined,
      cloudSyncStatus,
      cloudSyncNote:
        typeof item.cloudSyncNote === 'string' ? item.cloudSyncNote : undefined,
      uploadedBy:
        typeof item.uploadedBy === 'string' && item.uploadedBy
          ? item.uploadedBy
          : 'Admin',
    });
  }
  return result.slice(0, 200);
}

function readJsonStorageSafe(key: string): { found: boolean; value: unknown } {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return { found: false, value: undefined };
    return { found: true, value: JSON.parse(raw) };
  } catch (err) {
    console.warn(`[WG Pulse DataGuard] Failed to parse localStorage key "${key}":`, err);
    return { found: false, value: undefined };
  }
}

function readObjectStorage<T extends object>(key: string, fallback: T): T {
  const { found, value } = readJsonStorageSafe(key);
  if (!found) return fallback;
  return runDataSanitizer<T>(`localStorage:${key}`, value, fallback, (input, report) => {
    if (!isPlainObject(input)) {
      report({
        field: '<root>',
        expected: 'plain object',
        received: describeValueType(input),
        action: 'fallback',
        message: `Expected object in localStorage "${key}", got ${describeValueType(input)}.`,
      });
      return fallback;
    }
    return { ...fallback, ...(input as T) };
  }).data;
}

function readNullableObjectStorage<T extends object>(key: string): T | null {
  const { found, value } = readJsonStorageSafe(key);
  if (!found || value === null) return null;
  return runDataSanitizer<T | null>(`localStorage:${key}`, value, null, (input, report) => {
    if (!isPlainObject(input)) {
      report({
        field: '<root>',
        expected: 'plain object | null',
        received: describeValueType(input),
        action: 'fallback',
        message: `Expected object in localStorage "${key}", got ${describeValueType(input)}.`,
      });
      return null;
    }
    return input as T;
  }).data;
}

// Local isolation boundary so a child panel error NEVER crashes the entire app
interface SectionSafeBoundaryProps {
  name: string;
  resetKey?: string | number;
  children: React.ReactNode;
}

interface SectionSafeBoundaryState {
  errorMsg: string | null;
  errorStack: string;
  componentStack: string;
  retryCount: number;
}

class SectionSafeBoundary extends React.Component<
  SectionSafeBoundaryProps,
  SectionSafeBoundaryState
> {
  constructor(props: SectionSafeBoundaryProps) {
    super(props);
    this.state = {
      errorMsg: null,
      errorStack: '',
      componentStack: '',
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(err: Error): Partial<SectionSafeBoundaryState> {
    return {
      errorMsg: err?.message || String(err),
      errorStack: err?.stack || '',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[WG Pulse SectionBoundary] "${this.props.name}" crashed during render:`, {
      message: error?.message || String(error),
      stack: error?.stack,
      componentStack: info?.componentStack,
    });
    this.setState({ componentStack: info?.componentStack || '' });
  }

  componentDidUpdate(prevProps: SectionSafeBoundaryProps) {
    if (
      this.state.errorMsg &&
      this.props.resetKey !== undefined &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ errorMsg: null, errorStack: '', componentStack: '' });
    }
  }

  render() {
    if (this.state.errorMsg) {
      return (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-2"
        >
          <div className="flex items-center justify-between gap-3">
            <span>
              <strong>{this.props.name}:</strong> {this.state.errorMsg}
            </span>
            <button
              type="button"
              onClick={() =>
                this.setState((prev) => ({
                  errorMsg: null,
                  errorStack: '',
                  componentStack: '',
                  retryCount: prev.retryCount + 1,
                }))
              }
              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold shrink-0"
            >
              Retry{this.state.retryCount > 0 ? ` (${this.state.retryCount + 1})` : ''}
            </button>
          </div>
          {(this.state.componentStack || this.state.errorStack) && (
            <details className="text-[11px] opacity-85">
              <summary className="cursor-pointer font-medium select-none">
                Technical error details
              </summary>
              <pre className="mt-1.5 p-2 rounded-lg bg-amber-100/70 dark:bg-amber-950/80 overflow-x-auto max-h-40 whitespace-pre-wrap font-mono text-[10px]">
                {this.state.componentStack || this.state.errorStack}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

interface ToastBanner {
  id: number;
  title: string;
  detail: string;
  tone: 'info' | 'success' | 'error';
}

export default function App() {
  const { lang, setLang, t } = useLanguage();
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.THEME);
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
    } catch {
      // Ignore
    }
    return false;
  });

  const [aersRecords, setAersRecords] = useState<AersRecord[]>(() => {
    const { found, value } = readJsonStorageSafe(STORAGE_KEYS.AERS_MASTER);
    return found ? sanitizeAersList(value, `localStorage:${STORAGE_KEYS.AERS_MASTER}`) : [];
  });

  const [aersMeta, setAersMeta] = useState<AersMetadata | null>(() =>
    readNullableObjectStorage<AersMetadata>(STORAGE_KEYS.AERS_META),
  );

  const [openingBaseline, setOpeningBaseline] =
    useState<OpeningOfficerBaseline | null>(() => {
      const { found, value } = readJsonStorageSafe(STORAGE_KEYS.OPENING_BASELINE);
      return found
        ? sanitizeOpeningBaseline(value, `localStorage:${STORAGE_KEYS.OPENING_BASELINE}`)
        : null;
    });

  const [monthlySnapshots, setMonthlySnapshots] = useState<MonthlySnapshot[]>(() => {
    const { found, value } = readJsonStorageSafe(STORAGE_KEYS.SNAPSHOTS);
    return found
      ? sanitizeSnapshotsListWithReport(value, `localStorage:${STORAGE_KEYS.SNAPSHOTS}`).data
      : [];
  });

  const [staffAssignments, setStaffAssignments] = useState<StaffAssignedContract[]>(() => {
    const { found, value } = readJsonStorageSafe(STORAGE_KEYS.STAFF_ASSIGNMENTS);
    return found
      ? sanitizeStaffAssignments(value, `localStorage:${STORAGE_KEYS.STAFF_ASSIGNMENTS}`)
      : [];
  });

  const [uploadHistory, setUploadHistory] = useState<FileUploadHistoryEntry[]>(() => {
    const { found, value } = readJsonStorageSafe(STORAGE_KEYS.UPLOAD_HISTORY);
    return found ? sanitizeUploadHistoryList(value) : [];
  });

  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(() =>
    readObjectStorage<NotificationPreferences>(STORAGE_KEYS.NOTIF_PREFS, {
      enabled: true,
      soundEnabled: true,
      hourlyReminder: true,
    }),
  );

  const [weeklyBackupSchedule, setWeeklyBackupSchedule] =
    useState<WeeklyBackupSchedule>(() =>
      readObjectStorage<WeeklyBackupSchedule>(
        STORAGE_KEYS.WEEKLY_BACKUP,
        DEFAULT_WEEKLY_BACKUP_SCHEDULE,
      ),
    );
  const [weeklyBackupPromptOpen, setWeeklyBackupPromptOpen] = useState(false);

  const [activeNav, setActiveNav] = useState<NavSection>('overview');
  const [toolsSubTab, setToolsSubTab] = useState<
    'office_breakdown' | 'bm_analytics'
  >('office_breakdown');
  const [settingsSubTab, setSettingsSubTab] = useState<'lookup' | 'history' | 'backup'>('lookup');
  const [mrpMap, setMrpMap] = useState<Map<string, MrpEnrichment>>(() => {
    const { found, value } = readJsonStorageSafe(STORAGE_KEYS.MRP_MAP);
    return found
      ? sanitizeMrpMap(value, `localStorage:${STORAGE_KEYS.MRP_MAP}`)
      : new Map<string, MrpEnrichment>();
  });

  const [selectedOfficer, setSelectedOfficer] = useState<string>('ALL');
  const [animKey, setAnimKey] = useState(0);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<string | null>(null);
  const lastCloudUpdatedAtRef = useRef<string | null>(null);

  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAdmin = Boolean(adminToken);

  const [snapshotMode, setSnapshotMode] = useState<SnapshotMode>('off');
  const [hoverSnapEnabled, setHoverSnapEnabled] = useState<boolean>(true);

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

  const showToast = useCallback(
    (
      title: string,
      detail: string,
      tone: 'info' | 'success' | 'error' = 'info',
    ) => {
      setToast({ id: Date.now(), title, detail, tone });
    },
    [],
  );

  const syncFromLiveCloud = useCallback(
    async (
      silent = true,
      options?: { background?: boolean; onlyIfNewer?: boolean },
    ) => {
      if (!options?.background) {
        setIsSyncingCloud(true);
      }
      try {
        const cloud = await fetchLiveCloudData({
          background: options?.background,
        });
        const checkedSys = captureSystemActiveDateTime();
        setLastCloudSyncAt(checkedSys.displayLabel);

        if (isPlainObject(cloud)) {
          const incomingUpdatedAt =
            typeof cloud.updatedAt === 'string' ? cloud.updatedAt : '';

          // Skip redundant re-renders during background auto-polling if no new Admin upload occurred
          if (
            options?.onlyIfNewer &&
            incomingUpdatedAt &&
            lastCloudUpdatedAtRef.current &&
            incomingUpdatedAt === lastCloudUpdatedAtRef.current
          ) {
            return;
          }

          const wasAlreadySynced = Boolean(lastCloudUpdatedAtRef.current);
          if (incomingUpdatedAt) {
            lastCloudUpdatedAtRef.current = incomingUpdatedAt;
          }

          let totalDropped = 0;

          const aersReport = sanitizeAersListWithReport(
            cloud.aersRecords,
            'cloud:aersRecords',
          );
          if (cloud.aersRecords !== undefined) {
            setAersRecords(aersReport.data);
            totalDropped += aersReport.droppedCount;
          }

          if (isPlainObject(cloud.aersMeta)) {
            setAersMeta(cloud.aersMeta as unknown as AersMetadata);
          } else if (cloud.aersMeta !== undefined && cloud.aersMeta !== null) {
            console.warn(
              `[WG Pulse DataGuard] Ignored malformed "cloud:aersMeta" (${describeValueType(cloud.aersMeta)}).`,
            );
          }

          if (cloud.mrpMap !== undefined) {
            const mrpReport = sanitizeMrpMapWithReport(cloud.mrpMap, 'cloud:mrpMap');
            setMrpMap(mrpReport.data);
            totalDropped += mrpReport.droppedCount;
          }

          if (cloud.openingBaseline !== undefined) {
            setOpeningBaseline(
              sanitizeOpeningBaseline(cloud.openingBaseline, 'cloud:openingBaseline'),
            );
          }

          if (cloud.monthlySnapshots !== undefined) {
            const snapReport = sanitizeSnapshotsListWithReport(
              cloud.monthlySnapshots,
              'cloud:monthlySnapshots',
            );
            setMonthlySnapshots(snapReport.data);
            totalDropped += snapReport.droppedCount;
          }

          if (cloud.staffAssignments !== undefined) {
            const staffReport = sanitizeStaffAssignmentsWithReport(
              cloud.staffAssignments,
              'cloud:staffAssignments',
            );
            setStaffAssignments(staffReport.data);
            totalDropped += staffReport.droppedCount;
          }

          if (cloud.uploadHistory !== undefined) {
            setUploadHistory(sanitizeUploadHistoryList(cloud.uploadHistory));
          }

          setAnimKey((k) => k + 1);
          const isLiveBackgroundPush = Boolean(options?.background && wasAlreadySynced);
          if (!silent || isLiveBackgroundPush || totalDropped > 0) {
            const droppedNote =
              totalDropped > 0
                ? ` · ${totalDropped} malformed record${totalDropped === 1 ? '' : 's'} skipped (see console)`
                : '';
            const metaPrinted = isPlainObject(cloud.aersMeta)
              ? String(cloud.aersMeta.printedDateTime || '')
              : '';
            showToast(
              isLiveBackgroundPush
                ? 'Live Update Received Automatically'
                : totalDropped > 0
                  ? 'Live Data Loaded with Warnings'
                  : 'Live Data Refreshed',
              `Loaded ${aersReport.data.length.toLocaleString()} accounts (${metaPrinted || incomingUpdatedAt || 'Latest'})${droppedNote}.`,
              totalDropped > 0 ? 'info' : 'success',
            );
          }
        } else if (cloud !== null) {
          console.warn(
            `[WG Pulse DataGuard] Expected object payload from cloud sync, got ${describeValueType(cloud)}.`,
          );
          if (!silent) {
            showToast(
              'Invalid Cloud Snapshot Format',
              `Expected JSON object payload, received ${describeValueType(cloud)}.`,
              'error',
            );
          }
        } else if (!silent) {
          showToast(
            'No Cloud Snapshot Yet',
            'Admin has not published a live snapshot yet.',
            'info',
          );
        }
      } catch (err) {
        console.error('[WG Pulse DataGuard] Cloud sync failed:', err);
        if (!silent) {
          showToast(
            'Sync Failed',
            'Could not fetch live data from GitHub.',
            'error',
          );
        }
      } finally {
        if (!options?.background) {
          setIsSyncingCloud(false);
        }
      }
    },
    [showToast],
  );

  // Initial load + Automatic live polling (every 60s, on window focus, online reconnect, and cross-tab/PWA updates)
  useEffect(() => {
    syncFromLiveCloud(true);

    const pollInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      syncFromLiveCloud(true, { background: true, onlyIfNewer: true });
    }, 60_000);

    const handleFocusOrOnline = () => {
      syncFromLiveCloud(true, { background: true, onlyIfNewer: true });
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncFromLiveCloud(true, { background: true, onlyIfNewer: true });
      }
    };

    window.addEventListener('focus', handleFocusOrOnline);
    window.addEventListener('online', handleFocusOrOnline);
    document.addEventListener('visibilitychange', handleVisibility);

    const unsubscribeTabs = subscribeLocalTabUpdates(() => {
      syncFromLiveCloud(true, { background: true, onlyIfNewer: true });
    });

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocusOrOnline);
      window.removeEventListener('online', handleFocusOrOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
      unsubscribeTabs();
    };
  }, [syncFromLiveCloud]);

  const pushToLiveCloudIfConfigured = async (override?: {
    aersRecords?: AersRecord[];
    aersMeta?: AersMetadata | null;
    mrpMap?: Map<string, MrpEnrichment>;
    openingBaseline?: OpeningOfficerBaseline | null;
    monthlySnapshots?: MonthlySnapshot[];
    staffAssignments?: StaffAssignedContract[];
    uploadHistory?: FileUploadHistoryEntry[];
  }) => {
    const ghToken = await hydratePermanentGithubToken();
    if (!ghToken) return false;

    const activeSys = captureSystemActiveDateTime();
    const payload = {
      updatedAt: activeSys.isoTimestamp,
      updatedBy: 'Admin',
      aersRecords: override?.aersRecords ?? aersRecords,
      aersMeta: override?.aersMeta !== undefined ? override.aersMeta : aersMeta,
      mrpMap: Object.fromEntries(override?.mrpMap ?? mrpMap),
      openingBaseline:
        override?.openingBaseline !== undefined
          ? override.openingBaseline
          : openingBaseline,
      trackedContracts: [],
      monthlySnapshots: override?.monthlySnapshots ?? monthlySnapshots,
      staffAssignments: override?.staffAssignments ?? staffAssignments,
      uploadHistory: override?.uploadHistory ?? uploadHistory,
    };

    await publishLiveCloudData(payload, ghToken);
    lastCloudUpdatedAtRef.current = payload.updatedAt;
    setLastCloudSyncAt(activeSys.displayLabel);
    return true;
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, isDark ? 'dark' : 'light');
    } catch {
      // Ignore
    }
  }, [isDark]);

  useEffect(() => {
    try {
      localStorage.removeItem('wg_v2_opening_master');
      localStorage.removeItem('wg_v2_opening_meta');
      localStorage.removeItem(STORAGE_KEYS.TRACKED);
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith('wg_v1_')) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // Ignore
    }
  }, []);

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
      // Ignore
    }
  }, [aersRecords, aersMeta, openingBaseline, mrpMap]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.SNAPSHOTS,
        JSON.stringify(monthlySnapshots),
      );
    } catch {
      // Ignore
    }
  }, [monthlySnapshots]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.STAFF_ASSIGNMENTS,
        JSON.stringify(staffAssignments),
      );
    } catch {
      // Ignore
    }
  }, [staffAssignments]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.UPLOAD_HISTORY,
        JSON.stringify(uploadHistory),
      );
    } catch {
      // Ignore
    }
  }, [uploadHistory]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.NOTIF_PREFS,
        JSON.stringify(notifPrefs),
      );
    } catch {
      // Ignore
    }
  }, [notifPrefs]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.WEEKLY_BACKUP,
        JSON.stringify(weeklyBackupSchedule),
      );
    } catch {
      // Ignore
    }
  }, [weeklyBackupSchedule]);

  // Recurring weekly automated JSON backup check — prompts Admin when scheduled weekly slot is due
  useEffect(() => {
    if (!isAdmin || !weeklyBackupSchedule.enabled) return;

    const checkWeeklyDue = () => {
      if (adminModalOpen || weeklyBackupPromptOpen) return;
      const status = evaluateWeeklyBackupSchedule(weeklyBackupSchedule);
      if (status.isDueNow) {
        setWeeklyBackupPromptOpen(true);
      }
    };

    checkWeeklyDue();
    const timer = setInterval(checkWeeklyDue, 30_000);
    window.addEventListener('focus', checkWeeklyDue);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', checkWeeklyDue);
    };
  }, [isAdmin, weeklyBackupSchedule, adminModalOpen, weeklyBackupPromptOpen]);

  const visibleAersRecords = useMemo(() => {
    const safeAers = Array.isArray(aersRecords) ? aersRecords : [];
    if (selectedOfficer === 'ALL') return safeAers;
    return safeAers.filter((r) => getOfficerByOfficeType(r) === selectedOfficer);
  }, [aersRecords, selectedOfficer]);

  const strategySummary = useMemo(() => {
    try {
      const items = normalizeEvaluableFromAers(
        visibleAersRecords,
        EMPTY_STRING_SET,
        mrpMap,
      );
      const safeItems = Array.isArray(items) ? items : [];
      const offices = computeOfficeTypeBreakdown(safeItems);
      const safeOffices = Array.isArray(offices) ? offices : [];
      const borderline = analyzeNextMonthBorderline(safeItems);
      const worstTotal = safeItems.filter((i) => i && i.isWorst).length;
      return {
        officeTypesCount: safeOffices.length,
        borderlineCount: Number(borderline?.totalCount) || 0,
        borderlineCapitalAtRisk: Number(borderline?.totalCapitalAtRisk) || 0,
        borderlineEfforts: Number(borderline?.totalBorderlineEfforts) || 0,
        worstCount: worstTotal,
      };
    } catch {
      return {
        officeTypesCount: 0,
        borderlineCount: 0,
        borderlineCapitalAtRisk: 0,
        borderlineEfforts: 0,
        worstCount: 0,
      };
    }
  }, [visibleAersRecords, mrpMap]);

  const worstCount = useMemo(() => {
    try {
      return visibleAersRecords.filter((r) =>
        isWorstCategory(r.nplReason, r.worstCaseProduct),
      ).length;
    } catch {
      return 0;
    }
  }, [visibleAersRecords]);

  const aersAlertSummary = useMemo(() => {
    let dpd91Danger = 0;
    let zeroEffortBorderline = 0;
    let newlySlippedNpl = 0;
    let worst = 0;
    let belowOne = 0;

    for (const r of visibleAersRecords) {
      if ((r.currentAge || 0) <= 1.0) belowOne += 1;
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
        dpd91Danger += 1;
      }
      if (isBorderline && (r.assignOfficerEfforts || 0) === 0) {
        zeroEffortBorderline += 1;
      }
      if (isFallenNplAccount(r)) newlySlippedNpl += 1;
      if (isWorstCategory(r.nplReason, r.worstCaseProduct)) worst += 1;
    }

    const bm = selectedOfficer === 'ALL' ? aersMeta?.bmBranchSnapshot : undefined;
    const ratio90Pct: number =
      typeof bm?.ratio90Pct === 'number' && bm.ratio90Pct > 0
        ? bm.ratio90Pct
        : visibleAersRecords.length > 0
          ? (belowOne / visibleAersRecords.length) * 100
          : 0;

    return {
      dpd91Danger,
      zeroEffortBorderline,
      newlySlippedNpl,
      worst,
      ratio90Pct,
    };
  }, [visibleAersRecords, aersMeta, selectedOfficer]);

  const urgentAlertsCount =
    aersAlertSummary.dpd91Danger +
    aersAlertSummary.zeroEffortBorderline +
    aersAlertSummary.newlySlippedNpl;

  const sendAersDesktopNotification = useCallback(
    (
      summary: typeof aersAlertSummary,
      withSound: boolean,
      force = false,
    ): { sentCount: number; permission: NotificationPermission | 'unsupported' } => {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        return { sentCount: 0, permission: 'unsupported' };
      }
      const perm = Notification.permission;
      if (perm !== 'granted') {
        return { sentCount: 0, permission: perm };
      }
      const total =
        summary.dpd91Danger +
        summary.zeroEffortBorderline +
        summary.newlySlippedNpl;
      if (total === 0 && !force) {
        return { sentCount: 0, permission: perm };
      }
      try {
        new Notification('WG Pulse — Live Recovery Alert', {
          body: `91-DPD Danger: ${summary.dpd91Danger} · 0-Effort Borderline: ${summary.zeroEffortBorderline} · Newly Slipped NPL: ${summary.newlySlippedNpl} · 90 Ratio: ${summary.ratio90Pct.toFixed(1)}%`,
        });
        if (withSound) playAlertChime();
        return { sentCount: 1, permission: perm };
      } catch {
        return { sentCount: 0, permission: perm };
      }
    },
    [],
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'default') {
      Notification.requestPermission()
        .then((perm) => {
          setPermissionState(perm);
          if (perm === 'granted' && notifPrefs.enabled && !startupNotifiedRef.current) {
            startupNotifiedRef.current = true;
            sendAersDesktopNotification(aersAlertSummary, notifPrefs.soundEnabled);
          }
        })
        .catch(() => {});
    } else if (
      Notification.permission === 'granted' &&
      notifPrefs.enabled &&
      !startupNotifiedRef.current
    ) {
      startupNotifiedRef.current = true;
      sendAersDesktopNotification(aersAlertSummary, false);
    }
  }, [
    aersAlertSummary,
    notifPrefs.enabled,
    notifPrefs.soundEnabled,
    sendAersDesktopNotification,
  ]);

  useEffect(() => {
    if (!notifPrefs.enabled || !notifPrefs.hourlyReminder) return;
    const interval = setInterval(() => {
      const res = sendAersDesktopNotification(
        aersAlertSummary,
        notifPrefs.soundEnabled,
      );
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
    aersAlertSummary,
    sendAersDesktopNotification,
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
          'Desktop notifications are now permitted for 91 DPD Danger & NPL alerts.',
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

    const res = sendAersDesktopNotification(
      aersAlertSummary,
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

    const detail = `91-DPD Danger: ${aersAlertSummary.dpd91Danger} · 0-Effort Borderline: ${aersAlertSummary.zeroEffortBorderline} · Newly Slipped NPL: ${aersAlertSummary.newlySlippedNpl} · WORST (W): ${aersAlertSummary.worst}`;
    if (res.sentCount > 0) {
      showToast('Sent PC Pop-up Alert', detail, 'success');
    } else {
      showToast(
        'In-App Recovery Alert Summary',
        `${detail} (OS pop-up permission: ${res.permission})`,
        'info',
      );
    }
  };

  const applyParsedAersResult = async (
    parsed: ParsedAersResult,
    fileMeta?: { size?: number },
  ) => {
    if (!isAdmin) {
      setAdminModalOpen(true);
      showToast(
        'Admin Login Required',
        'Only Admin can upload and update AERS reports for everyone.',
        'error',
      );
      return;
    }

    // Always capture exact active system date & time at upload moment
    const activeSys = captureSystemActiveDateTime();
    const stampedMeta: AersMetadata = {
      ...parsed.metadata,
      printedDateTime: activeSys.systemDateTime,
      uploadedAt: activeSys.isoTimestamp,
      systemDate: activeSys.systemDate,
      systemTime: activeSys.systemTime,
      systemTimeZone: activeSys.timeZone,
    };

    const sanitizedAersReport = sanitizeAersListWithReport(
      parsed.records,
      `upload:${stampedMeta.fileName || 'aers'}`,
    );
    const cleanParsedRecords = sanitizedAersReport.data;

    const effectiveMrpMap = parsed.mrpMap
      ? sanitizeMrpMap(parsed.mrpMap, `upload:${stampedMeta.fileName || 'aers'}:mrp`)
      : mrpMap;
    if (parsed.mrpMap) {
      setMrpMap(effectiveMrpMap);
    }

    const nextBaseline = sanitizeOpeningBaseline(
      parsed.excelOfficerOpeningBaseline ??
        buildOpeningOfficerBaseline(
          cleanParsedRecords,
          stampedMeta.printedDateTime,
        ),
      'upload:openingBaseline',
    );
    setOpeningBaseline(nextBaseline);

    setAersRecords(cleanParsedRecords);
    setAersMeta(stampedMeta);
    setAnimKey((k) => k + 1);

    // Daily-keyed snapshot: same-day uploads overwrite today's snapshot with the latest file;
    // a new day locks the previous day's last upload and appends a fresh daily record.
    const dailySnapshot = buildDailyAersSnapshot(
      cleanParsedRecords,
      stampedMeta,
      staffAssignments,
    );
    const existingIdx = monthlySnapshots.findIndex(
      (s) => s.snapshotDate === dailySnapshot.snapshotDate,
    );
    let nextSnapshots: MonthlySnapshot[];
    if (existingIdx >= 0) {
      nextSnapshots = [...monthlySnapshots];
      nextSnapshots[existingIdx] = {
        ...dailySnapshot,
        id: nextSnapshots[existingIdx].id,
      };
    } else {
      nextSnapshots = [...monthlySnapshots, dailySnapshot];
    }
    nextSnapshots.sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
    setMonthlySnapshots(nextSnapshots);

    const snapAction =
      existingIdx >= 0
        ? `Updated ${dailySnapshot.snapshotDate} snapshot`
        : `Locked previous day & created ${dailySnapshot.snapshotDate} snapshot`;

    const hasToken = Boolean((await hydratePermanentGithubToken()).trim());
    const baseHistoryEntry: FileUploadHistoryEntry = {
      id: `upl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      fileName: stampedMeta.fileName || 'AERS Workbook',
      fileType: 'AERS Workbook',
      fileSizeBytes: fileMeta?.size,
      uploadedAtIso: activeSys.isoTimestamp,
      systemDate: activeSys.systemDate,
      systemTime: activeSys.systemTime,
      systemDateTimeLabel: activeSys.displayLabel,
      timeZone: activeSys.timeZone,
      excelPrintedDateTime: stampedMeta.excelPrintedDateTime,
      recordsCount: cleanParsedRecords.length,
      totalPortfolioCount:
        stampedMeta.bmBranchSnapshot?.totalContracts ??
        dailySnapshot.totalPortfolioCount ??
        cleanParsedRecords.length,
      nplCount:
        stampedMeta.bmBranchSnapshot?.closingNplCount ??
        dailySnapshot.closingNplCount,
      closingNplAmount:
        stampedMeta.bmBranchSnapshot?.totalClosingNpl ??
        dailySnapshot.trackedNpl,
      snapshotAction: snapAction,
      cloudSyncStatus: hasToken ? 'published_live' : 'local_only',
      cloudSyncNote: hasToken
        ? 'Auto-published live to URL & Windows PC Apps'
        : 'Saved locally — add GitHub Token in Admin to auto-publish live',
      uploadedBy: 'Admin',
    };

    const optimisticHistory = [baseHistoryEntry, ...uploadHistory].slice(0, 200);
    setUploadHistory(optimisticHistory);

    let cloudNote = ' · Saved locally (Add GitHub Token in Admin to auto-publish live to everyone)';
    try {
      const published = await pushToLiveCloudIfConfigured({
        aersRecords: cleanParsedRecords,
        aersMeta: stampedMeta,
        mrpMap: effectiveMrpMap,
        openingBaseline: nextBaseline,
        monthlySnapshots: nextSnapshots,
        uploadHistory: optimisticHistory,
      });
      if (published) {
        cloudNote = ' · Auto-Published LIVE to URL & PC Apps!';
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed';
      cloudNote = ` · Cloud sync error: ${errMsg}`;
      setUploadHistory((prev) =>
        prev.map((item) =>
          item.id === baseHistoryEntry.id
            ? {
                ...item,
                cloudSyncStatus: 'sync_failed',
                cloudSyncNote: `Auto-publish failed: ${errMsg}`,
              }
            : item,
        ),
      );
    }

    showToast(
      `AERS Loaded (${activeSys.displayLabel})`,
      `${cleanParsedRecords.length.toLocaleString()} accounts · ${snapAction}${cloudNote}`,
      'success',
    );
  };

  const handleUploadAersFile = async (file: File) => {
    if (!isAdmin) {
      setAdminModalOpen(true);
      showToast(
        'Admin Login Required',
        'Please unlock Admin mode first before uploading AERS files.',
        'error',
      );
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseAersWorkbook(buffer, file.name);
      await applyParsedAersResult(parsed, { size: file.size });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to parse AERS Excel/CSV file.';
      showToast('AERS Upload Error', msg, 'error');
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
      `Locked per-officer Opening totals (${aersMeta?.printedDateTime || getTodayISO()}).`,
      'success',
    );
  };

  const handleAssignStaffBulk = (newItems: StaffAssignedContract[]) => {
    if (newItems.length === 0) return;
    setStaffAssignments((prev) => {
      const incomingKeys = new Set(
        newItems.map((item) => `${item.monthKey}::${normalizeContractNo(item.contractNo)}`),
      );
      const retained = prev.filter(
        (existing) =>
          !incomingKeys.has(
            `${existing.monthKey}::${normalizeContractNo(existing.contractNo)}`,
          ),
      );
      const next = [...newItems, ...retained];
      if (isAdmin) {
        pushToLiveCloudIfConfigured({ staffAssignments: next }).catch(() => {});
      }
      return next;
    });
    const targetStaff = newItems[0]?.staffName ?? 'Staff';
    const targetMonth = newItems[0]?.monthKey ?? '';
    showToast(
      'Follow-Up Contracts Assigned',
      `Assigned ${newItems.length} contract${newItems.length === 1 ? '' : 's'} to ${targetStaff} (${targetMonth}).`,
      'success',
    );
  };

  const handleRemoveStaffAssignment = (
    staffName: string,
    monthKey: string,
    contractNo: string,
  ) => {
    const norm = normalizeContractNo(contractNo);
    setStaffAssignments((prev) => {
      const next = prev.filter(
        (item) =>
          !(
            item.staffName === staffName &&
            item.monthKey === monthKey &&
            normalizeContractNo(item.contractNo) === norm
          ),
      );
      if (isAdmin) {
        pushToLiveCloudIfConfigured({ staffAssignments: next }).catch(() => {});
      }
      return next;
    });
    showToast(
      'Assignment Removed',
      `Removed ${contractNo} from ${staffName} (${monthKey}).`,
      'info',
    );
  };

  const handleClearStaffMonth = (staffName: string, monthKey: string) => {
    setStaffAssignments((prev) => {
      const next = prev.filter((item) => {
        if (item.monthKey !== monthKey) return true;
        if (staffName === 'ALL') return false;
        return item.staffName !== staffName;
      });
      if (isAdmin) {
        pushToLiveCloudIfConfigured({ staffAssignments: next }).catch(() => {});
      }
      return next;
    });
    showToast(
      'Assignments Cleared',
      staffName === 'ALL'
        ? `Cleared all staff assignments for ${monthKey}.`
        : `Cleared ${staffName}'s assignments for ${monthKey}.`,
      'info',
    );
  };

  const handleLogTodayStaffSnapshot = () => {
    if (!isAdmin) {
      setAdminModalOpen(true);
      return;
    }
    const todaySnap = buildDailyAersSnapshot(
      aersRecords,
      aersMeta ?? {
        fileName: 'Manual Daily Snapshot',
        printedDateTime: getTodayISO(),
        uploadedAt: new Date().toISOString(),
        totalContractsCount: aersRecords.length,
        isSampleData: false,
      },
      staffAssignments,
    );
    const existingIdx = monthlySnapshots.findIndex(
      (s) => s.snapshotDate === todaySnap.snapshotDate,
    );
    let nextSnapshots: MonthlySnapshot[];
    if (existingIdx >= 0) {
      nextSnapshots = [...monthlySnapshots];
      nextSnapshots[existingIdx] = {
        ...todaySnap,
        id: nextSnapshots[existingIdx].id,
      };
    } else {
      nextSnapshots = [...monthlySnapshots, todaySnap];
    }
    nextSnapshots.sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
    setMonthlySnapshots(nextSnapshots);
    pushToLiveCloudIfConfigured({ monthlySnapshots: nextSnapshots }).catch(() => {});
    showToast(
      'Daily Performance Snapshot Logged',
      `Saved ${todaySnap.snapshotDate} daily collection progress for all assigned officers.`,
      'success',
    );
  };

  const handleExportBackup = (isAutomatedWeekly = false) => {
    const activeSys = captureSystemActiveDateTime();
    const slotInfo = evaluateWeeklyBackupSchedule(weeklyBackupSchedule);
    const updatedSchedule: WeeklyBackupSchedule = {
      ...weeklyBackupSchedule,
      lastBackupAtIso: activeSys.isoTimestamp,
      lastBackupDisplay: activeSys.displayLabel,
      lastPromptedSlotKey: slotInfo.currentSlotKey,
      snoozedUntilIso: undefined,
    };
    setWeeklyBackupSchedule(updatedSchedule);

    const payload: BackupPayload = {
      version: 5,
      exportedAt: activeSys.isoTimestamp,
      trackedContracts: [],
      monthlySnapshots,
      aersMeta,
      aersMasterList: aersRecords,
      openingBaseline,
      staffAssignments,
      uploadHistory,
      weeklyBackupSchedule: updatedSchedule,
      notificationPrefs: notifPrefs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = isAutomatedWeekly
      ? `WG_Pulse_Weekly_Backup_${getTodayISO()}.json`
      : `WG_Pulse_Backup_${getTodayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setWeeklyBackupPromptOpen(false);
    showToast(
      isAutomatedWeekly ? 'Weekly JSON Backup Saved' : 'Backup Exported',
      `Downloaded full JSON backup (${activeSys.displayLabel}) including AERS Master Lookup, Upload History, Assign User Follow-Ups, and Daily Snapshots.`,
      'success',
    );
  };

  const handleSnoozeWeeklyBackup = () => {
    const twoHoursLater = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    setWeeklyBackupSchedule((prev) => ({
      ...prev,
      snoozedUntilIso: twoHoursLater,
    }));
    setWeeklyBackupPromptOpen(false);
    showToast(
      'Weekly Backup Snoozed',
      'We will prompt you again in 2 hours to save your local JSON backup.',
      'info',
    );
  };

  const handleSkipWeeklyBackup = () => {
    const slotInfo = evaluateWeeklyBackupSchedule(weeklyBackupSchedule);
    setWeeklyBackupSchedule((prev) => ({
      ...prev,
      lastPromptedSlotKey: slotInfo.currentSlotKey,
      snoozedUntilIso: undefined,
    }));
    setWeeklyBackupPromptOpen(false);
    showToast(
      'Weekly Backup Skipped',
      `Skipped this week's backup. Next automated prompt: ${slotInfo.nextScheduledLabel}.`,
      'info',
    );
  };

  const handleRestoreBackup = async (file: File) => {
    try {
      const activeSys = captureSystemActiveDateTime();
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<BackupPayload>;
      if (!isPlainObject(parsed)) {
        throw new Error(
          `Invalid backup file: expected JSON object, got ${describeValueType(parsed)}.`,
        );
      }

      let totalDropped = 0;
      let restoredSnapCount = 0;
      let restoredAersCount = 0;
      let nextSnapshots = monthlySnapshots;
      let nextAers = aersRecords;
      let nextMeta = aersMeta;
      let nextBaseline = openingBaseline;
      let nextStaff = staffAssignments;
      let baseHistory = uploadHistory;

      if (parsed.monthlySnapshots !== undefined) {
        const snapReport = sanitizeSnapshotsListWithReport(
          parsed.monthlySnapshots,
          `backup:${file.name}:monthlySnapshots`,
        );
        nextSnapshots = snapReport.data;
        setMonthlySnapshots(nextSnapshots);
        restoredSnapCount = snapReport.data.length;
        totalDropped += snapReport.droppedCount;
      }

      if (parsed.aersMasterList !== undefined) {
        const aersReport = sanitizeAersListWithReport(
          parsed.aersMasterList,
          `backup:${file.name}:aersMasterList`,
        );
        nextAers = aersReport.data;
        setAersRecords(nextAers);
        restoredAersCount = aersReport.data.length;
        totalDropped += aersReport.droppedCount;
      }

      if (parsed.aersMeta !== undefined) {
        nextMeta = isPlainObject(parsed.aersMeta)
          ? (parsed.aersMeta as unknown as AersMetadata)
          : null;
        setAersMeta(nextMeta);
      }

      if (parsed.openingBaseline !== undefined) {
        nextBaseline = sanitizeOpeningBaseline(
          parsed.openingBaseline,
          `backup:${file.name}:openingBaseline`,
        );
        setOpeningBaseline(nextBaseline);
      }

      if (parsed.staffAssignments !== undefined) {
        const staffReport = sanitizeStaffAssignmentsWithReport(
          parsed.staffAssignments,
          `backup:${file.name}:staffAssignments`,
        );
        nextStaff = staffReport.data;
        setStaffAssignments(nextStaff);
        totalDropped += staffReport.droppedCount;
      }

      if (parsed.uploadHistory !== undefined) {
        baseHistory = sanitizeUploadHistoryList(parsed.uploadHistory);
      }

      if (isPlainObject(parsed.notificationPrefs)) {
        setNotifPrefs({
          enabled: Boolean(parsed.notificationPrefs.enabled),
          soundEnabled: Boolean(parsed.notificationPrefs.soundEnabled),
          hourlyReminder: Boolean(parsed.notificationPrefs.hourlyReminder),
          lastNotifiedAt:
            typeof parsed.notificationPrefs.lastNotifiedAt === 'string'
              ? parsed.notificationPrefs.lastNotifiedAt
              : undefined,
        });
      }

      if (isPlainObject(parsed.weeklyBackupSchedule)) {
        setWeeklyBackupSchedule({
          ...DEFAULT_WEEKLY_BACKUP_SCHEDULE,
          ...(parsed.weeklyBackupSchedule as unknown as Partial<WeeklyBackupSchedule>),
        });
      }

      const canPublish =
        isAdmin && Boolean((await hydratePermanentGithubToken()).trim());
      const restoreEntry: FileUploadHistoryEntry = {
        id: `upl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        fileName: file.name,
        fileType: 'JSON Backup Restore',
        fileSizeBytes: file.size,
        uploadedAtIso: activeSys.isoTimestamp,
        systemDate: activeSys.systemDate,
        systemTime: activeSys.systemTime,
        systemDateTimeLabel: activeSys.displayLabel,
        timeZone: activeSys.timeZone,
        recordsCount: restoredAersCount,
        totalPortfolioCount:
          nextMeta?.bmBranchSnapshot?.totalContracts ?? restoredAersCount,
        snapshotAction: `Restored ${restoredSnapCount} snapshots`,
        cloudSyncStatus: canPublish ? 'published_live' : 'local_only',
        cloudSyncNote: canPublish
          ? 'Auto-published restored backup live to URL & PC Apps'
          : 'Restored locally (unlock Admin + GitHub Token to publish live)',
        uploadedBy: isAdmin ? 'Admin' : 'Local User',
      };

      const nextHistory = [restoreEntry, ...baseHistory].slice(0, 200);
      setUploadHistory(nextHistory);

      let cloudNote = '';
      if (isAdmin) {
        try {
          const published = await pushToLiveCloudIfConfigured({
            aersRecords: nextAers,
            aersMeta: nextMeta,
            openingBaseline: nextBaseline,
            monthlySnapshots: nextSnapshots,
            staffAssignments: nextStaff,
            uploadHistory: nextHistory,
          });
          if (published) {
            cloudNote = ' · Auto-Published LIVE!';
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Failed';
          cloudNote = ` · Cloud sync error: ${errMsg}`;
          setUploadHistory((prev) =>
            prev.map((item) =>
              item.id === restoreEntry.id
                ? {
                    ...item,
                    cloudSyncStatus: 'sync_failed',
                    cloudSyncNote: `Auto-publish failed: ${errMsg}`,
                  }
                : item,
            ),
          );
        }
      }

      const droppedNote =
        totalDropped > 0
          ? ` (${totalDropped} malformed record${totalDropped === 1 ? '' : 's'} skipped — see console)`
          : '';
      showToast(
        totalDropped > 0 ? 'Backup Restored with Warnings' : 'Backup Restored',
        `Restored ${restoredAersCount.toLocaleString()} AERS accounts and ${restoredSnapCount} daily snapshots (${activeSys.displayLabel})${droppedNote}${cloudNote}.`,
        totalDropped > 0 ? 'info' : 'success',
      );
    } catch (err) {
      console.error('[WG Pulse DataGuard] Backup restore failed:', err);
      const msg =
        err instanceof Error ? err.message : 'Failed to parse JSON backup.';
      showToast('Restore Failed', msg, 'error');
    }
  };

  const handleForcePublishNow = async () => {
    const activeSys = captureSystemActiveDateTime();
    const publishEntry: FileUploadHistoryEntry = {
      id: `upl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      fileName: aersMeta?.fileName || 'Current Portfolio Snapshot',
      fileType: 'Manual Live Publish',
      uploadedAtIso: activeSys.isoTimestamp,
      systemDate: activeSys.systemDate,
      systemTime: activeSys.systemTime,
      systemDateTimeLabel: activeSys.displayLabel,
      timeZone: activeSys.timeZone,
      excelPrintedDateTime: aersMeta?.excelPrintedDateTime,
      recordsCount: aersRecords.length,
      totalPortfolioCount:
        aersMeta?.bmBranchSnapshot?.totalContracts ?? aersRecords.length,
      nplCount: aersMeta?.bmBranchSnapshot?.closingNplCount,
      closingNplAmount: aersMeta?.bmBranchSnapshot?.totalClosingNpl,
      snapshotAction: 'Manual live broadcast to all users',
      cloudSyncStatus: 'published_live',
      cloudSyncNote: 'Published live to Web URL & installed Windows PC Apps',
      uploadedBy: 'Admin',
    };

    const nextHistory = [publishEntry, ...uploadHistory].slice(0, 200);
    const ok = await pushToLiveCloudIfConfigured({
      uploadHistory: nextHistory,
    });
    if (!ok) {
      throw new Error('Please paste and save your GitHub Personal Access Token first.');
    }
    setUploadHistory(nextHistory);
    showToast(
      `Published Live (${activeSys.displayLabel})`,
      `All ${aersRecords.length.toLocaleString()} AERS accounts & ${staffAssignments.length} assigned follow-ups are now live for all users.`,
      'success',
    );
  };

  const handleClearUploadHistory = () => {
    if (!isAdmin) return;
    setUploadHistory([]);
    localStorage.removeItem(STORAGE_KEYS.UPLOAD_HISTORY);
    pushToLiveCloudIfConfigured({ uploadHistory: [] }).catch(() => {});
    showToast(
      'Upload History Cleared',
      'Cleared recorded file upload history log.',
      'info',
    );
  };

  const handleAuthorizedReset = async () => {
    if (!adminToken) {
      throw new Error('Admin login is required to reset the application.');
    }
    setAersRecords([]);
    setAersMeta(null);
    setMrpMap(new Map());
    setOpeningBaseline(null);
    setMonthlySnapshots([]);
    setStaffAssignments([]);
    setUploadHistory([]);
    setSelectedOfficer('ALL');
    localStorage.removeItem(STORAGE_KEYS.AERS_MASTER);
    localStorage.removeItem(STORAGE_KEYS.AERS_META);
    localStorage.removeItem(STORAGE_KEYS.MRP_MAP);
    localStorage.removeItem(STORAGE_KEYS.OPENING_BASELINE);
    localStorage.removeItem(STORAGE_KEYS.TRACKED);
    localStorage.removeItem(STORAGE_KEYS.SNAPSHOTS);
    localStorage.removeItem(STORAGE_KEYS.STAFF_ASSIGNMENTS);
    localStorage.removeItem(STORAGE_KEYS.UPLOAD_HISTORY);

    await pushToLiveCloudIfConfigured({
      aersRecords: [],
      aersMeta: null,
      mrpMap: new Map(),
      openingBaseline: null,
      monthlySnapshots: [],
      staffAssignments: [],
      uploadHistory: [],
    }).catch(() => {});

    showToast(
      'Total App Reset Complete',
      'Authorized by Admin. AERS Lookup, Assign User Follow-Ups, Opening Baseline, and Daily Snapshots have been cleared.',
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
      label: t('breadcrumbOverview'),
      shortLabel: t('navOverview'),
      icon: <Landmark className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'assign_user',
      label: t('breadcrumbAssignUser'),
      shortLabel: t('navAssignUser'),
      icon: <Briefcase className="w-4 h-4 shrink-0" />,
      badge: staffAssignments.length > 0 ? staffAssignments.length : undefined,
    },
    {
      id: 'below_one',
      label: t('breadcrumbBelowOne'),
      shortLabel: t('navBelowOne'),
      icon: <Scale className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'below_three',
      label: t('breadcrumbBelowThree'),
      shortLabel: t('navBelowThree'),
      icon: <Banknote className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'borderline',
      label: t('breadcrumbBorderline'),
      shortLabel: t('navBorderline'),
      icon: <ShieldAlert className="w-4 h-4 shrink-0" />,
      badge:
        strategySummary.borderlineCount > 0
          ? strategySummary.borderlineCount
          : undefined,
    },
    {
      id: 'worst',
      label: t('breadcrumbWorst'),
      shortLabel: t('navWorst'),
      icon: <Flame className="w-4 h-4 shrink-0" />,
      badge: worstCount > 0 ? worstCount : undefined,
    },
    {
      id: 'alerts',
      label: t('breadcrumbAlerts'),
      shortLabel: t('navAlerts'),
      icon: <BellRing className="w-4 h-4 shrink-0" />,
      badge: urgentAlertsCount > 0 ? urgentAlertsCount : undefined,
    },
    {
      id: 'rewards',
      label: t('breadcrumbRewards'),
      shortLabel: t('navRewards'),
      icon: <Trophy className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'fb_incentive',
      label: t('breadcrumbFbIncentive'),
      shortLabel: t('navFbIncentive'),
      icon: <BadgeDollarSign className="w-4 h-4 shrink-0" />,
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
      label: t('breadcrumbTools'),
      shortLabel: t('navTools'),
      icon: <PieChart className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'settings',
      label: t('breadcrumbSettings'),
      shortLabel: t('navSettings'),
      icon: <SlidersHorizontal className="w-4 h-4 shrink-0" />,
    },
  ];

  const daysTo30th = getDaysRemainingTo30th();
  const month30thLabel = getMonth30thLabel();

  const breadcrumbLabel: Record<NavSection, string> = {
    overview: t('breadcrumbOverview'),
    assign_user: t('breadcrumbAssignUser'),
    below_one: t('breadcrumbBelowOne'),
    below_three: t('breadcrumbBelowThree'),
    borderline: t('breadcrumbBorderline'),
    worst: t('breadcrumbWorst'),
    alerts: t('breadcrumbAlerts'),
    rewards: t('breadcrumbRewards'),
    fb_incentive: t('breadcrumbFbIncentive'),
    tools: t('breadcrumbTools'),
    settings: t('breadcrumbSettings'),
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f6f4] dark:bg-[#0f1115] text-zinc-900 dark:text-zinc-100">
      {/* Sticky Commercial Credit Corporate Header (Compact on Mobile, Full Enterprise Bar on Web) */}
      <header className="sticky top-0 z-30 min-h-14 md:h-16 pt-safe bg-white/94 dark:bg-[#16181e]/94 backdrop-blur-xl border-b border-zinc-200/90 dark:border-zinc-800/90 px-3 sm:px-5 md:px-6 flex items-center justify-between gap-2 sm:gap-3 shrink-0 shadow-xs">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="relative flex items-center justify-center px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-xl bg-white shadow-xs border border-zinc-200/90 dark:border-zinc-700 shrink-0">
            <img
              src={COMPANY_LOGO_URL}
              onError={handleCompanyLogoError}
              referrerPolicy="no-referrer"
              alt="Commercial Credit Logo"
              className="h-6 sm:h-7 md:h-8 w-auto object-contain"
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-display text-sm sm:text-base font-extrabold tracking-tight text-zinc-900 dark:text-white whitespace-nowrap">
                WG PULSE
              </span>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-800 dark:bg-red-950/70 dark:text-red-300 border border-red-200 dark:border-red-800/80">
                RECOVERY
              </span>
              <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700 hidden xl:inline">·</span>
              <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 truncate hidden xl:inline">
                {breadcrumbLabel[activeNav]}
              </span>
            </div>
            {/* Mobile shows active section breadcrumb cleanly; desktop shows brand subtitle */}
            <span className="md:hidden text-[11px] font-semibold text-red-700 dark:text-red-400 truncate block leading-tight">
              {breadcrumbLabel[activeNav]}
            </span>
            <span className="hidden md:block text-[10px] font-medium text-zinc-500 dark:text-zinc-400 tracking-wide truncate">
              {t('brandSubtitle')} · {isAdmin ? t('adminMode') : t('viewOnlyMode')}
            </span>
          </div>
        </div>

        {/* Mobile Compact Header Actions (3 ergonomic >=40px touch buttons) */}
        <div className="flex md:hidden items-center gap-1.5 shrink-0" data-snapshot-ignore="true">
          <button
            type="button"
            onClick={() => syncFromLiveCloud(false)}
            disabled={isSyncingCloud}
            aria-label="Refresh live cloud data"
            className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 active:scale-95 transition-transform disabled:opacity-50"
          >
            <Cloud className={`w-4 h-4 text-emerald-600 ${isSyncingCloud ? 'animate-pulse' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setAdminModalOpen(true)}
            aria-label="Admin login and live sync"
            className={`min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl border active:scale-95 transition-transform ${
              isAdmin
                ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300'
            }`}
          >
            {isAdmin ? (
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu, language and quick controls"
            className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl border border-red-200 dark:border-red-900/70 bg-red-50/80 dark:bg-red-950/40 text-red-700 dark:text-red-300 active:scale-95 transition-transform"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        {/* Desktop / Web Full Right Utility Zone */}
        <div className="hidden md:flex items-center gap-1.5 lg:gap-2 shrink-0" data-snapshot-ignore="true">
          {/* Trilingual Switcher: English · සිංහල · தமிழ் */}
          <div
            role="group"
            aria-label="Language selector"
            className="inline-flex items-center p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100/80 dark:bg-zinc-900"
          >
            <Globe className="w-3.5 h-3.5 text-zinc-400 ml-1.5 mr-1 hidden xl:block" />
            {(
              [
                { code: 'en', label: 'EN' },
                { code: 'si', label: 'සිං' },
                { code: 'ta', label: 'தமி' },
              ] as { code: AppLanguage; label: string }[]
            ).map((opt) => (
              <button
                key={opt.code}
                type="button"
                onClick={() => setLang(opt.code)}
                className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                  lang === opt.code
                    ? 'bg-red-700 text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setSnapshotMode((prev) => (prev === 'pick' ? 'off' : 'pick'))
            }
            title="Select any section, card, or chart to Copy PNG / Download PNG / PDF / Excel / Share WhatsApp (Ctrl+Shift+S)"
            className={`inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-2 text-xs font-semibold rounded-xl border transition-colors whitespace-nowrap shrink-0 shadow-xs ${
              snapshotMode === 'pick'
                ? 'border-red-600 bg-red-700 text-white'
                : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }`}
          >
            <Camera
              className={`w-3.5 h-3.5 shrink-0 ${
                snapshotMode === 'pick'
                  ? 'text-white'
                  : 'text-red-700 dark:text-red-400'
              }`}
            />
            <span className="hidden lg:inline">
              {snapshotMode === 'pick' ? t('pickingSection') : t('snapExport')}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setSnapshotMode((prev) => (prev === 'crop' ? 'off' : 'crop'))
            }
            title="Drag a custom box anywhere on screen to copy, save, or WhatsApp share a snapshot"
            className={`inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-xl border transition-colors whitespace-nowrap shrink-0 shadow-xs ${
              snapshotMode === 'crop'
                ? 'border-zinc-800 bg-zinc-900 text-white'
                : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }`}
          >
            <Crop
              className={`w-3.5 h-3.5 shrink-0 ${
                snapshotMode === 'crop'
                  ? 'text-white'
                  : 'text-zinc-700 dark:text-zinc-300'
              }`}
            />
            <span className="hidden xl:inline">{t('areaSnap')}</span>
          </button>

          <PWAInstallButton />

          <button
            type="button"
            onClick={() => syncFromLiveCloud(false)}
            disabled={isSyncingCloud}
            title="Fetch latest Admin-published data"
            className="inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-2 text-xs font-medium rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 shadow-xs disabled:opacity-50"
          >
            <Cloud className={`w-3.5 h-3.5 text-emerald-600 ${isSyncingCloud ? 'animate-pulse' : ''}`} />
            <span className="hidden xl:inline">{isSyncingCloud ? t('syncing') : t('refreshLive')}</span>
          </button>

          {isAdmin && (
            <label className="inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-2 text-xs font-medium rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors whitespace-nowrap shrink-0 shadow-xs">
              <Upload className="w-3.5 h-3.5 text-red-700 dark:text-red-400" />
              <span className="hidden lg:inline">{t('uploadAers')}</span>
              <span className="lg:hidden">AERS</span>
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
          )}

          <button
            type="button"
            onClick={() => setAdminModalOpen(true)}
            aria-label="Admin login and reset controls"
            className={`inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-2 text-xs font-medium rounded-xl border transition-colors whitespace-nowrap shrink-0 shadow-xs ${
              isAdmin
                ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }`}
          >
            {isAdmin ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden lg:inline">{t('adminActive')}</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-zinc-500" />
                <span className="hidden lg:inline">{t('adminLogin')}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsDark((prev) => !prev)}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="inline-flex items-center justify-center p-2 text-xs font-medium rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shrink-0 shadow-xs"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-zinc-600" />
            )}
          </button>
        </div>
      </header>

      {/* Sub-Header Live Strategy Strip (Single-Line Swipeable on Mobile, Full Toolbar on Web) */}
      <div className="bg-white/75 dark:bg-zinc-900/50 border-b border-zinc-200/80 dark:border-zinc-800/80 px-3 sm:px-6 py-2">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-3 text-[11px] sm:text-xs">
          <div className="flex items-center gap-x-2.5 sm:gap-x-3 overflow-x-auto no-scrollbar whitespace-nowrap text-zinc-600 dark:text-zinc-400 tabular-nums py-0.5">
            <span className="inline-flex items-center gap-1 font-semibold text-red-700 dark:text-red-400 shrink-0">
              <RefreshCw className="w-3 h-3 shrink-0" />
              {isAdmin ? t('adminMode') : t('viewOnlyMode')}
            </span>
            <span aria-hidden="true">·</span>
            <span className="shrink-0">
              Snapshot:{' '}
              <span className="font-mono text-zinc-900 dark:text-zinc-200">
                {aersMeta?.printedDateTime || '—'}
              </span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="shrink-0">
              Scope:{' '}
              <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                {selectedOfficer === 'ALL' ? 'All Officers' : selectedOfficer}
              </span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="shrink-0">
              {month30thLabel} Cutoff:{' '}
              <span className="font-mono font-semibold text-amber-700 dark:text-amber-400">
                {daysTo30th}d left
              </span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="shrink-0">
              90 Ratio:{' '}
              <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                {aersAlertSummary.ratio90Pct.toFixed(1)}%
              </span>
            </span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span className="hidden sm:inline shrink-0">
              AERS Indexed:{' '}
              <span className="font-mono text-zinc-900 dark:text-zinc-200">
                {visibleAersRecords.length.toLocaleString()}
              </span>
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2 shrink-0" data-snapshot-ignore="true">
            <button
              type="button"
              onClick={() => setHoverSnapEnabled((prev) => !prev)}
              title="Toggle instant Copy / PNG / PDF / Excel / WhatsApp quick bar when hovering over any card or section"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                hoverSnapEnabled
                  ? 'border-red-200 dark:border-red-900/70 bg-red-50/70 dark:bg-red-950/35 text-red-800 dark:text-red-300'
                  : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              {t('hoverSnap')}: {hoverSnapEnabled ? 'ON' : 'OFF'}
            </button>
            <button
              type="button"
              onClick={handleTestPopup}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0"
            >
              <BellRing className="w-3.5 h-3.5 text-red-700 dark:text-red-400" />
              {t('testPopup')}
            </button>
          </div>
        </div>
      </div>

      {/* Live Scrolling Recovery Ticker (Commercial Credit Charcoal + Crimson) */}
      <div className="bg-zinc-900 text-zinc-100 border-b border-red-900/60 overflow-hidden py-2 text-xs font-mono relative">
        <div className="absolute left-0 top-0 bottom-0 z-10 w-12 bg-gradient-to-r from-zinc-900 to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 z-10 w-12 bg-gradient-to-l from-zinc-900 to-transparent pointer-events-none" />
        <div className="animate-marquee flex items-center gap-8 whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5 font-bold text-red-400">
            <Bell className="w-3.5 h-3.5" />
            {t('liveAlertsPrefix')}
          </span>
          <span>· 91-DPD Danger Zone: {aersAlertSummary.dpd91Danger} pre-NPL accounts</span>
          <span>· 0-Effort Borderline: {aersAlertSummary.zeroEffortBorderline} uncontacted files</span>
          <span>· Newly Slipped NPL: {aersAlertSummary.newlySlippedNpl} accounts</span>
          <span>· WORST (W) Priority: {aersAlertSummary.worst} files</span>
          <span>· Below 1 (90 Ratio): {aersAlertSummary.ratio90Pct.toFixed(1)}% (Target 90.0%)</span>
          <span className="inline-flex items-center gap-1.5 font-bold text-red-400 ml-8">
            <Bell className="w-3.5 h-3.5" />
            {t('liveAlertsPrefix')}
          </span>
          <span>· 91-DPD Danger Zone: {aersAlertSummary.dpd91Danger} pre-NPL accounts</span>
          <span>· 0-Effort Borderline: {aersAlertSummary.zeroEffortBorderline} uncontacted files</span>
          <span>· Newly Slipped NPL: {aersAlertSummary.newlySlippedNpl} accounts</span>
          <span>· WORST (W) Priority: {aersAlertSummary.worst} files</span>
          <span>· Below 1 (90 Ratio): {aersAlertSummary.ratio90Pct.toFixed(1)}% (Target 90.0%)</span>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="px-4 sm:px-6 pt-4 max-w-[1600px] w-full mx-auto">
          <div
            role="status"
            className={`px-4 py-3 rounded-xl border flex items-start justify-between gap-3 text-xs ${
              toast.tone === 'error'
                ? 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                : toast.tone === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200'
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
      <main className="flex-1 px-3 py-4 sm:p-6 space-y-5 sm:space-y-6 max-w-[1600px] w-full mx-auto">
        <motion.div
          key={activeNav}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-5 sm:space-y-6"
        >
          {activeNav === 'overview' && (
            <>
              <section
                aria-label="Recovery Strategy Summary"
                className="bg-gradient-to-br from-zinc-900 via-[#1d1719] to-red-950 text-white border border-red-900/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7 shadow-xl shadow-zinc-950/20 relative overflow-hidden"
              >
                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-red-700 via-red-500 to-zinc-800 opacity-90" />

                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 lg:gap-6 relative z-10">
                  <div className="space-y-3 sm:space-y-3.5 max-w-2xl">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/95">
                        <img
                          src={COMPANY_LOGO_URL}
                          onError={handleCompanyLogoError}
                          referrerPolicy="no-referrer"
                          alt="Commercial Credit"
                          className="h-4 w-auto object-contain"
                        />
                      </span>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-red-300">
                        {t('heroEyebrow')}
                      </span>
                    </div>

                    <h1 className="font-display text-lg sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white leading-tight [text-wrap:balance]">
                      {t('heroTitle')}
                    </h1>

                    <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-xl">
                      {t('heroDesc')}
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 pt-1 tabular-nums max-w-xl">
                      <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                        <div className="text-[11px] font-medium text-zinc-400">
                          {t('officeTypes')}
                        </div>
                        <div className="mt-1 text-lg sm:text-xl font-bold font-mono text-white">
                          {strategySummary.officeTypesCount}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveNav('worst')}
                        className="text-left p-3 rounded-2xl bg-red-500/15 border border-red-500/35 hover:border-red-400/70 backdrop-blur-md transition-all group"
                      >
                        <div className="text-[11px] font-medium text-red-300 flex items-center justify-between">
                          <span>{t('worstCase')}</span>
                          <span className="text-[9px] text-red-400 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">→</span>
                        </div>
                        <div className="mt-1 text-lg sm:text-xl font-bold font-mono text-red-200">
                          {strategySummary.worstCount}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveNav('borderline')}
                        className="col-span-2 sm:col-span-1 text-left p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 hover:border-amber-400/60 backdrop-blur-md transition-all group"
                      >
                        <div className="text-[11px] font-medium text-amber-300 flex items-center justify-between">
                          <span>{t('nextMoBorderline')}</span>
                          <span className="text-[9px] text-amber-400 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">→</span>
                        </div>
                        <div className="mt-1 text-lg sm:text-xl font-bold font-mono text-amber-200">
                          {strategySummary.borderlineCount}{' '}
                          <span className="text-xs font-normal text-amber-300/85">
                            · {formatCompactRs(strategySummary.borderlineCapitalAtRisk)}
                          </span>
                        </div>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1.5">
                      {isAdmin ? (
                        <label className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3.5 sm:px-4 py-2 text-xs font-bold rounded-xl bg-red-600 text-white hover:bg-red-500 shadow-md cursor-pointer transition-all whitespace-nowrap">
                          <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
                          {t('uploadDailyAers')}
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
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAdminModalOpen(true)}
                          className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-red-200 transition-all whitespace-nowrap"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          {t('adminLoginToUpload')}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setActiveNav('assign_user')}
                        className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-all whitespace-nowrap"
                      >
                        <Briefcase className="w-3.5 h-3.5 text-red-300" />
                        {t('navAssignUser')}
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveNav('below_one')}
                        className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-emerald-200 transition-all whitespace-nowrap"
                      >
                        <Scale className="w-3.5 h-3.5 text-emerald-400" />
                        {t('belowOnePlan')}
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveNav('below_three')}
                        className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-all whitespace-nowrap"
                      >
                        <Banknote className="w-3.5 h-3.5 text-emerald-300" />
                        {t('navBelowThree')}
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveNav('rewards')}
                        className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 text-amber-200 transition-all whitespace-nowrap"
                      >
                        <Trophy className="w-3.5 h-3.5 text-amber-300" />
                        {t('navRewards')}
                      </button>
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center justify-center shrink-0">
                    <div className="w-full sm:w-72 h-44 rounded-2xl overflow-hidden border border-red-500/25 shadow-lg bg-zinc-950">
                      <img
                        src={strategyHeroImg}
                        alt="Commercial Credit Leasing & Finance Recovery Strategy Illustration"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <SectionSafeBoundary name="Executive Officer Hub" resetKey={animKey}>
                <ExecutiveOfficerHubPanel
                  aersRecords={aersRecords}
                  aersMeta={aersMeta}
                  mrpMap={mrpMap}
                  openingBaseline={openingBaseline}
                  monthlySnapshots={monthlySnapshots}
                  selectedOfficer={selectedOfficer}
                  onSelectOfficer={setSelectedOfficer}
                  staffAssignments={staffAssignments}
                  onAssignStaffBulk={handleAssignStaffBulk}
                  onRemoveStaffAssignment={handleRemoveStaffAssignment}
                  onClearStaffMonth={handleClearStaffMonth}
                />
              </SectionSafeBoundary>

              <SectionSafeBoundary name="KPI Strip" resetKey={animKey}>
                <KpiStrip
                  aersRecords={visibleAersRecords}
                  aersMeta={aersMeta}
                  mrpMap={mrpMap}
                  isFilteredOfficer={selectedOfficer !== 'ALL'}
                  animKey={animKey}
                />
              </SectionSafeBoundary>

              <SectionSafeBoundary name="Trends Evaluation" resetKey={animKey}>
                <TrendsEvaluationPanel
                  aersRecords={visibleAersRecords}
                  aersMeta={aersMeta}
                  mrpMap={mrpMap}
                  openingBaseline={openingBaseline}
                  isDark={isDark}
                  onSetCurrentAsOpening={handleSetCurrentAsOpening}
                  onOpenWorstRadar={() => setActiveNav('worst')}
                  onOpenBorderlineCards={() => setActiveNav('borderline')}
                />
              </SectionSafeBoundary>

              <SectionSafeBoundary name="Analytics Charts" resetKey={animKey}>
                <AnalyticsCharts
                  aersRecords={visibleAersRecords}
                  aersMeta={aersMeta}
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
              </SectionSafeBoundary>
            </>
          )}

          {activeNav === 'assign_user' && (
            <SectionSafeBoundary name="Assign User Follow-Up Dashboard" resetKey={animKey}>
              <StaffFollowUpMonitorPanel
                aersRecords={aersRecords}
                mrpMap={mrpMap}
                assignments={staffAssignments}
                monthlySnapshots={monthlySnapshots}
                isDark={isDark}
                isAdmin={isAdmin}
                onAssignBulk={handleAssignStaffBulk}
                onRemoveAssignment={handleRemoveStaffAssignment}
                onClearStaffMonth={handleClearStaffMonth}
                onLogTodaySnapshot={handleLogTodayStaffSnapshot}
              />
            </SectionSafeBoundary>
          )}

          {activeNav === 'below_one' && (
            <SectionSafeBoundary name="Below 1 — 90 Ratio Plan" resetKey={animKey}>
              <BelowOneRatioPanel
                aersRecords={visibleAersRecords}
                aersMeta={aersMeta}
                mrpMap={mrpMap}
              />
            </SectionSafeBoundary>
          )}

          {activeNav === 'below_three' && (
            <SectionSafeBoundary name="Below 3 Collection & Variance" resetKey={animKey}>
              <BelowThreeCollectionPanel
                aersRecords={visibleAersRecords}
                aersMeta={aersMeta}
                mrpMap={mrpMap}
                isDark={isDark}
                isAdmin={isAdmin}
                onUploadWorkbook={handleUploadAersFile}
              />
            </SectionSafeBoundary>
          )}

          {activeNav === 'borderline' && (
            <SectionSafeBoundary name="Next Month Borderline" resetKey={animKey}>
              <NextMonthBorderlineCardsPanel
                aersRecords={visibleAersRecords}
                mrpMap={mrpMap}
              />
            </SectionSafeBoundary>
          )}

          {activeNav === 'worst' && (
            <SectionSafeBoundary name="Worst Case Radar" resetKey={animKey}>
              <WorstCasePanel
                aersRecords={visibleAersRecords}
                mrpMap={mrpMap}
              />
            </SectionSafeBoundary>
          )}

          {activeNav === 'alerts' && (
            <SectionSafeBoundary name="Alerts & Pop-ups" resetKey={animKey}>
              <AlertsNotificationsPanel
                aersRecords={visibleAersRecords}
                mrpMap={mrpMap}
                prefs={notifPrefs}
                permissionState={permissionState}
                onUpdatePrefs={setNotifPrefs}
                onRequestPermission={handleRequestNotifPermission}
                onTestPopup={handleTestPopup}
              />
            </SectionSafeBoundary>
          )}

          {activeNav === 'rewards' && (
            <SectionSafeBoundary name="XP & Rewards Hub" resetKey={animKey}>
              <XpRewardsHubPanel
                aersRecords={aersRecords}
                aersMeta={aersMeta}
                staffAssignments={staffAssignments}
              />
            </SectionSafeBoundary>
          )}

          {activeNav === 'fb_incentive' && (
            <SectionSafeBoundary name="FB Incentive Hub" resetKey={animKey}>
              <FbIncentivePanel
                aersRecords={visibleAersRecords}
                aersMeta={aersMeta}
              />
            </SectionSafeBoundary>
          )}

          {activeNav === 'tools' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div
                  role="tablist"
                  aria-label="Recovery Analytics Menu"
                  className="inline-flex max-w-full overflow-x-auto no-scrollbar items-center gap-1 p-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={toolsSubTab === 'office_breakdown'}
                    onClick={() => setToolsSubTab('office_breakdown')}
                    className={`inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      toolsSubTab === 'office_breakdown'
                        ? 'bg-red-700 text-white'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    Office Type → Officer Breakdown
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={toolsSubTab === 'bm_analytics'}
                    onClick={() => setToolsSubTab('bm_analytics')}
                    className={`inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      toolsSubTab === 'bm_analytics'
                        ? 'bg-red-700 text-white'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    BM &amp; Portfolio Analytics
                  </button>
                </div>

                <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                  {monthlySnapshots.length} daily/monthly snapshots saved
                </span>
              </div>

              {toolsSubTab === 'office_breakdown' && (
                <SectionSafeBoundary name="Office Type Breakdown" resetKey={animKey}>
                  <OfficeTypeBreakdownPanel
                    aersRecords={visibleAersRecords}
                    title="Office Type -> Officer Strategy Breakdown (NPL & Borderline)"
                  />
                </SectionSafeBoundary>
              )}

              {toolsSubTab === 'bm_analytics' && (
                <SectionSafeBoundary name="BM Portfolio Analytics" resetKey={animKey}>
                  <BmPortfolioAnalyticsPanel
                    aersRecords={visibleAersRecords}
                    aersMeta={aersMeta}
                    mrpMap={mrpMap}
                    monthlySnapshots={monthlySnapshots}
                    isDark={isDark}
                  />
                </SectionSafeBoundary>
              )}
            </div>
          )}

          {activeNav === 'settings' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div
                  role="tablist"
                  aria-label="Settings Menu"
                  className="inline-flex max-w-full overflow-x-auto no-scrollbar items-center gap-1 p-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={settingsSubTab === 'lookup'}
                    onClick={() => setSettingsSubTab('lookup')}
                    className={`inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      settingsSubTab === 'lookup'
                        ? 'bg-red-700 text-white'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <Database className="w-3.5 h-3.5" />
                    NPL &amp; Borderline Master Lookup ({aersRecords.length.toLocaleString()})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={settingsSubTab === 'history'}
                    onClick={() => setSettingsSubTab('history')}
                    className={`inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      settingsSubTab === 'history'
                        ? 'bg-red-700 text-white'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    Upload History &amp; Live Sync ({uploadHistory.length})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={settingsSubTab === 'backup'}
                    onClick={() => setSettingsSubTab('backup')}
                    className={`inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      settingsSubTab === 'backup'
                        ? 'bg-red-700 text-white'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <HardDriveDownload className="w-3.5 h-3.5" />
                    Backup, Restore &amp; Admin Reset
                  </button>
                </div>
              </div>

              {settingsSubTab === 'lookup' ? (
                <SectionSafeBoundary name="AERS Master Lookup" resetKey={animKey}>
                  <AersLookupPanel
                    aersRecords={aersRecords}
                    aersMeta={aersMeta}
                    mrpMap={mrpMap}
                    onUploadAersFile={handleUploadAersFile}
                  />
                </SectionSafeBoundary>
              ) : settingsSubTab === 'history' ? (
                <SectionSafeBoundary name="Upload History & Live Sync" resetKey={animKey}>
                  <UploadHistoryPanel
                    uploadHistory={uploadHistory}
                    aersMeta={aersMeta}
                    isAdmin={isAdmin}
                    isSyncingCloud={isSyncingCloud}
                    lastCloudSyncAt={lastCloudSyncAt}
                    onSyncLiveNow={() => syncFromLiveCloud(false)}
                    onForcePublishNow={handleForcePublishNow}
                    onOpenAdminModal={() => setAdminModalOpen(true)}
                    onClearHistory={handleClearUploadHistory}
                  />
                </SectionSafeBoundary>
              ) : (
                <SectionSafeBoundary name="Backup & Settings" resetKey={animKey}>
                  <BackupSettingsPanel
                    staffAssignmentsCount={staffAssignments.length}
                    snapshotsCount={monthlySnapshots.length}
                    uploadHistoryCount={uploadHistory.length}
                    aersMeta={aersMeta}
                    isAdminAuthenticated={isAdmin}
                    weeklySchedule={weeklyBackupSchedule}
                    onUpdateWeeklySchedule={setWeeklyBackupSchedule}
                    onTriggerWeeklyBackupPromptNow={() =>
                      setWeeklyBackupPromptOpen(true)
                    }
                    onOpenAdminModal={() => setAdminModalOpen(true)}
                    onExportBackup={() => handleExportBackup(false)}
                    onRestoreBackup={handleRestoreBackup}
                  />
                </SectionSafeBoundary>
              )}
            </div>
          )}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="mt-8 pb-24 md:pb-28 px-4 sm:px-6 border-t border-zinc-200/90 dark:border-zinc-800/90 bg-white/80 dark:bg-zinc-900/60 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="px-2 py-1 rounded-lg bg-white border border-zinc-200 shadow-xs shrink-0">
              <img
                src={COMPANY_LOGO_URL}
                onError={handleCompanyLogoError}
                referrerPolicy="no-referrer"
                alt="Commercial Credit"
                className="h-6 w-auto object-contain"
              />
            </div>
            <div>
              <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                WG Pulse · {t('brandSubtitle')}
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Mobile &amp; Web Live Sync · Below 1 (90 Ratio) · Below 3 Collection · XP Rewards · Trilingual EN / සිංහල / தமிழ்
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-zinc-600 dark:text-zinc-400 tabular-nums">
            <span>
              Office Types:{' '}
              <strong className="font-mono text-zinc-900 dark:text-zinc-200">
                {strategySummary.officeTypesCount}
              </strong>
            </span>
            <span>
              AERS Indexed:{' '}
              <strong className="font-mono text-zinc-900 dark:text-zinc-200">
                {aersRecords.length.toLocaleString()}
              </strong>
            </span>
            <span>
              90 Ratio:{' '}
              <strong className="font-mono text-emerald-700 dark:text-emerald-400">
                {aersAlertSummary.ratio90Pct.toFixed(1)}%
              </strong>
            </span>
            <span>
              Assign Follow-Ups:{' '}
              <strong className="font-mono text-zinc-900 dark:text-zinc-200">
                {staffAssignments.length}
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
              className="inline-flex items-center gap-1 font-medium text-red-700 dark:text-red-400 hover:underline"
            >
              {isAdmin ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Admin Unlocked
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  Admin Gateway
                </>
              )}
            </button>
          </div>
        </div>
      </footer>

      {/* Mobile Native Bottom Tab Bar + Slide-Up Modules & Quick Controls Sheet */}
      <MobileNavigationShell
        activeNav={activeNav}
        onSelectNav={setActiveNav}
        primaryNavItems={primaryNavItems}
        secondaryNavItems={secondaryNavItems}
        menuOpen={mobileMenuOpen}
        onOpenMenu={() => setMobileMenuOpen(true)}
        onCloseMenu={() => setMobileMenuOpen(false)}
        lang={lang}
        onChangeLang={setLang}
        isDark={isDark}
        onToggleDark={() => setIsDark((prev) => !prev)}
        isAdmin={isAdmin}
        isSyncingCloud={isSyncingCloud}
        onSyncLive={() => syncFromLiveCloud(false)}
        onOpenAdminModal={() => setAdminModalOpen(true)}
        onUploadAersFile={handleUploadAersFile}
        onStartSnapPick={() => setSnapshotMode('pick')}
        borderlineBadge={
          strategySummary.borderlineCount > 0
            ? strategySummary.borderlineCount
            : undefined
        }
        assignBadge={
          staffAssignments.length > 0 ? staffAssignments.length : undefined
        }
        moreBadgeCount={urgentAlertsCount + worstCount}
        labels={{
          overview: t('navOverview'),
          belowThree: t('navBelowThree'),
          borderline: t('navBorderline'),
          assign: t('navAssignUser'),
          menu: 'Menu',
          adminActive: t('adminActive'),
          adminLogin: t('adminLogin'),
          uploadAers: t('uploadAers'),
          refreshLive: t('refreshLive'),
          snapExport: t('snapExport'),
        }}
      />

      {/* Desktop / Web Bottom Floating Glass Menu Dock (Commercial Credit Crimson + Obsidian) */}
      <nav
        aria-label="Primary Floating Glass Bottom Menu"
        data-snapshot-ignore="true"
        className="hidden md:block fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-[96vw] overflow-x-auto no-scrollbar bg-white/88 dark:bg-zinc-900/88 backdrop-blur-2xl border border-zinc-200/90 dark:border-zinc-700/80 shadow-[0_14px_40px_-10px_rgba(24,24,27,0.32)] rounded-2xl p-1.5"
      >
        <div className="flex items-center gap-1">
          {primaryNavItems.map((item) => {
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveNav(item.id)}
                title={item.label}
                className={`relative flex items-center gap-1.5 px-2.5 lg:px-3 py-2 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'text-white'
                    : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100/80 dark:hover:bg-zinc-800/70'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="glassDockActive"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 bg-red-700 dark:bg-red-600 rounded-xl shadow-sm"
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
                          : 'bg-red-600/15 text-red-700 dark:text-red-300'
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
            className="h-6 w-px bg-zinc-300/80 dark:bg-zinc-700/80 mx-1 shrink-0"
          />

          {secondaryNavItems.map((item) => {
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveNav(item.id)}
                title={item.label}
                className={`relative flex items-center gap-1.5 px-2.5 lg:px-3 py-2 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'text-white'
                    : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100/80 dark:hover:bg-zinc-800/70'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="glassDockActive"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 bg-zinc-900 dark:bg-red-600 rounded-xl shadow-sm"
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
                          : 'bg-red-600/15 text-red-700 dark:text-red-300'
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

      {/* Universal Snapshot & Export Engine (Hover Quick Bar + Pick Section + Freeform Crop + PNG/PDF/XLSX) */}
      <UniversalSnapshotManager
        mode={snapshotMode}
        hoverQuickBarEnabled={hoverSnapEnabled}
        isDark={isDark}
        onChangeMode={setSnapshotMode}
        onNotify={showToast}
      />

      {/* Offline Connectivity Indicator */}
      <OfflineIndicator />

      {/* Weekly Automated JSON Backup Prompt Modal */}
      <WeeklyBackupPromptModal
        isOpen={weeklyBackupPromptOpen}
        schedule={weeklyBackupSchedule}
        aersCount={aersRecords.length}
        snapshotsCount={monthlySnapshots.length}
        staffAssignmentsCount={staffAssignments.length}
        uploadHistoryCount={uploadHistory.length}
        onConfirmDownload={() => handleExportBackup(true)}
        onSnoozeTwoHours={handleSnoozeWeeklyBackup}
        onSkipThisWeek={handleSkipWeeklyBackup}
      />

      {/* Admin Modal */}
      <AdminLoginModal
        isOpen={adminModalOpen}
        isAdminAuthenticated={isAdmin}
        onClose={() => setAdminModalOpen(false)}
        onLoginSuccess={(token) => {
          setAdminToken(token);
          showToast(
            'Admin Mode Unlocked',
            'You can now upload daily AERS reports, manage Assign User rosters, and publish live updates to everyone.',
            'success',
          );
        }}
        onLogoutAdmin={() => {
          setAdminToken(null);
          showToast(
            'Admin Session Locked',
            'Switched back to View-Only mode.',
            'info',
          );
        }}
        onConfirmReset={handleAuthorizedReset}
        onForcePublishNow={handleForcePublishNow}
      />
    </div>
  );
}
