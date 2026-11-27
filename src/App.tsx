import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  BarChart3,
  Bell,
  BellRing,
  Bot,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Cloud,
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
import { ExecutiveOfficerHubPanel } from './components/ExecutiveOfficerHubPanel';
import strategyHeroImg from './assets/images/finance_strategy_hero_1795684833730.jpg';
import { PulseLogoMark } from './components/FinanceIllustrations';
import { KpiStrip } from './components/KpiStrip';
import { NextMonthBorderlineCardsPanel } from './components/NextMonthBorderlineCardsPanel';
import { OfficeTypeBreakdownPanel } from './components/OfficeTypeBreakdownPanel';
import { StaffFollowUpMonitorPanel } from './components/StaffFollowUpMonitorPanel';
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
  MrpPaymentMonth,
  NavSection,
  NotificationPreferences,
  OpeningOfficerBaseline,
  StaffAssignedContract,
  TrackedContract,
  VisitLogEntry,
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
  getOfficerByOfficeType,
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
import {
  fetchLiveCloudData,
  getSavedGithubToken,
  publishLiveCloudData,
} from './utils/githubSync';

const STORAGE_KEYS = {
  TRACKED: 'wg_v2_tracked_contracts',
  AERS_MASTER: 'wg_v2_aers_master',
  AERS_META: 'wg_v2_aers_meta',
  MRP_MAP: 'wg_v2_mrp_map',
  OPENING_BASELINE: 'wg_v2_opening_baseline',
  SNAPSHOTS: 'wg_v2_monthly_snapshots',
  STAFF_ASSIGNMENTS: 'wg_v2_staff_assignments',
  NOTIF_PREFS: 'wg_v2_notification_prefs',
  THEME: 'wg_v2_theme',
};

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

const TRACKED_STRING_FIELDS = [
  'cusName',
  'mobileNo',
  'address',
  'recoveryOfficer',
  'marketingOfficer',
  'lastPayDate',
  'vehicleNo',
  'visitDate',
  'ppDate',
  'handOverDate',
  'remark',
  'remarkBy',
  'ro',
  'locationUrl',
  'addedAt',
] as const;

const TRACKED_NUMBER_FIELDS = [
  'opAge',
  'currentAge',
  'closingDebtor',
  'capitalOutstanding',
  'opNpl',
  'npl',
  'actualDpd',
  'monthEndForecastDpd',
  'minAmountToReverseNpl',
  'lastPaidAmount',
  'nplSavedAmount',
] as const;

function sanitizeTrackedListWithReport(
  raw: unknown,
  source = 'trackedContracts',
): SanitizeReport<TrackedContract[]> {
  return runDataSanitizer<TrackedContract[]>(source, raw, [], (input, report) => {
    if (!Array.isArray(input)) {
      report({
        field: '<root>',
        expected: 'TrackedContract[]',
        received: describeValueType(input),
        action: 'fallback',
        message: `Expected an array of tracked contracts, got ${describeValueType(input)}.`,
      });
      return [];
    }

    const result: TrackedContract[] = [];
    input.forEach((item, index) => {
      if (!isPlainObject(item)) {
        report({
          field: `[${index}]`,
          expected: 'TrackedContract object',
          received: describeValueType(item),
          index,
          action: 'dropped',
          message: `Dropped malformed tracked contract at index ${index}.`,
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
          message: `Dropped tracked contract at index ${index} missing valid contractNo.`,
        });
        return;
      }

      const cleaned: Record<string, unknown> = { ...item, contractNo };
      for (const field of TRACKED_STRING_FIELDS) {
        cleaned[field] = coerceStringField(item, field, report, index, contractNo);
      }
      for (const field of TRACKED_NUMBER_FIELDS) {
        cleaned[field] = coerceNumberField(item, field, report, index, contractNo);
      }

      // Sanitize visitHistory array
      const rawHistory = item.visitHistory;
      if (rawHistory === undefined || rawHistory === null) {
        cleaned.visitHistory = [];
      } else if (!Array.isArray(rawHistory)) {
        report({
          field: 'visitHistory',
          expected: 'VisitLogEntry[]',
          received: describeValueType(rawHistory),
          index,
          recordKey: contractNo,
          action: 'coerced',
          message: `Non-array visitHistory (${describeValueType(rawHistory)}); reset to [].`,
        });
        cleaned.visitHistory = [];
      } else {
        const cleanHistory: VisitLogEntry[] = [];
        rawHistory.forEach((entry, hIdx) => {
          if (!isPlainObject(entry)) {
            report({
              field: `visitHistory[${hIdx}]`,
              expected: 'VisitLogEntry object',
              received: describeValueType(entry),
              index,
              recordKey: contractNo,
              action: 'dropped',
              message: 'Dropped non-object entry in visitHistory.',
            });
            return;
          }
          cleanHistory.push(entry as unknown as VisitLogEntry);
        });
        cleaned.visitHistory = cleanHistory;
      }

      // Sanitize optional mrp enrichment
      if (item.mrp === undefined || item.mrp === null) {
        cleaned.mrp = undefined;
      } else if (!isPlainObject(item.mrp)) {
        report({
          field: 'mrp',
          expected: 'MrpEnrichment object',
          received: describeValueType(item.mrp),
          index,
          recordKey: contractNo,
          action: 'coerced',
          message: `Invalid mrp shape (${describeValueType(item.mrp)}); cleared.`,
        });
        cleaned.mrp = undefined;
      } else {
        cleaned.mrp = {
          ...item.mrp,
          paymentPattern: sanitizePaymentPattern(item.mrp.paymentPattern, report, contractNo, index),
        };
      }

      result.push(cleaned as unknown as TrackedContract);
    });

    return result;
  });
}

function sanitizeTrackedList(raw: unknown, source = 'trackedContracts'): TrackedContract[] {
  return sanitizeTrackedListWithReport(raw, source).data;
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

  const [trackedContracts, setTrackedContracts] = useState<TrackedContract[]>(() => {
    const { found, value } = readJsonStorageSafe(STORAGE_KEYS.TRACKED);
    return found ? sanitizeTrackedList(value, `localStorage:${STORAGE_KEYS.TRACKED}`) : [];
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

  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(() =>
    readObjectStorage<NotificationPreferences>(STORAGE_KEYS.NOTIF_PREFS, {
      enabled: true,
      soundEnabled: true,
      hourlyReminder: true,
    }),
  );

  const [activeNav, setActiveNav] = useState<NavSection>('overview');
  const [toolsSubTab, setToolsSubTab] = useState<
    'staff_monitor' | 'office_breakdown' | 'bm_analytics' | 'ai' | 'alerts'
  >('staff_monitor');
  const [settingsSubTab, setSettingsSubTab] = useState<'lookup' | 'backup'>('lookup');
  const [mrpMap, setMrpMap] = useState<Map<string, MrpEnrichment>>(() => {
    const { found, value } = readJsonStorageSafe(STORAGE_KEYS.MRP_MAP);
    return found
      ? sanitizeMrpMap(value, `localStorage:${STORAGE_KEYS.MRP_MAP}`)
      : new Map<string, MrpEnrichment>();
  });

  const [regularContractNos, setRegularContractNos] = useState<Set<string>>(() => new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterPreset>('all');
  const [selectedOfficer, setSelectedOfficer] = useState<string>('ALL');
  const [animKey, setAnimKey] = useState(0);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const isAdmin = Boolean(adminToken);

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
    async (silent = true) => {
      setIsSyncingCloud(true);
      try {
        const cloud = await fetchLiveCloudData();
        if (isPlainObject(cloud)) {
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

          if (cloud.trackedContracts !== undefined) {
            const trackedReport = sanitizeTrackedListWithReport(
              cloud.trackedContracts,
              'cloud:trackedContracts',
            );
            setTrackedContracts(trackedReport.data);
            totalDropped += trackedReport.droppedCount;
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

          setAnimKey((k) => k + 1);
          if (!silent || totalDropped > 0) {
            const droppedNote =
              totalDropped > 0
                ? ` · ${totalDropped} malformed record${totalDropped === 1 ? '' : 's'} skipped (see console)`
                : '';
            const metaPrinted = isPlainObject(cloud.aersMeta)
              ? String(cloud.aersMeta.printedDateTime || '')
              : '';
            const updatedAt = typeof cloud.updatedAt === 'string' ? cloud.updatedAt : '';
            showToast(
              totalDropped > 0 ? 'Live Data Loaded with Warnings' : 'Live Data Refreshed',
              `Loaded ${aersReport.data.length.toLocaleString()} accounts (${metaPrinted || updatedAt || 'Latest'})${droppedNote}.`,
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
        setIsSyncingCloud(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    syncFromLiveCloud(true);
  }, [syncFromLiveCloud]);

  const pushToLiveCloudIfConfigured = async (override?: {
    aersRecords?: AersRecord[];
    aersMeta?: AersMetadata | null;
    mrpMap?: Map<string, MrpEnrichment>;
    openingBaseline?: OpeningOfficerBaseline | null;
    trackedContracts?: TrackedContract[];
    monthlySnapshots?: MonthlySnapshot[];
    staffAssignments?: StaffAssignedContract[];
  }) => {
    const ghToken = getSavedGithubToken();
    if (!ghToken) return false;

    const payload = {
      updatedAt: new Date().toISOString(),
      updatedBy: 'Admin',
      aersRecords: override?.aersRecords ?? aersRecords,
      aersMeta: override?.aersMeta !== undefined ? override.aersMeta : aersMeta,
      mrpMap: Object.fromEntries(override?.mrpMap ?? mrpMap),
      openingBaseline:
        override?.openingBaseline !== undefined
          ? override.openingBaseline
          : openingBaseline,
      trackedContracts: override?.trackedContracts ?? trackedContracts,
      monthlySnapshots: override?.monthlySnapshots ?? monthlySnapshots,
      staffAssignments: override?.staffAssignments ?? staffAssignments,
    };

    await publishLiveCloudData(payload, ghToken);
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
      localStorage.setItem(
        STORAGE_KEYS.TRACKED,
        JSON.stringify(trackedContracts),
      );
    } catch {
      // Ignore
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
        STORAGE_KEYS.NOTIF_PREFS,
        JSON.stringify(notifPrefs),
      );
    } catch {
      // Ignore
    }
  }, [notifPrefs]);

  const visibleAersRecords = useMemo(() => {
    const safeAers = Array.isArray(aersRecords) ? aersRecords : [];
    if (selectedOfficer === 'ALL') return safeAers;
    return safeAers.filter((r) => getOfficerByOfficeType(r) === selectedOfficer);
  }, [aersRecords, selectedOfficer]);

  const visibleTrackedContracts = useMemo(() => {
    const safeTracked = Array.isArray(trackedContracts) ? trackedContracts : [];
    if (selectedOfficer === 'ALL') return safeTracked;
    return safeTracked.filter((c) => getOfficerByOfficeType(c) === selectedOfficer);
  }, [trackedContracts, selectedOfficer]);

  const aersMap = useMemo(() => {
    const map = new Map<string, AersRecord>();
    if (Array.isArray(aersRecords)) {
      aersRecords.forEach((r) => {
        if (r && typeof r.contractNo === 'string') {
          map.set(normalizeContractNo(r.contractNo), r);
        }
      });
    }
    return map;
  }, [aersRecords]);

  const trackedContractNos = useMemo(() => {
    if (!Array.isArray(trackedContracts)) return new Set<string>();
    return new Set(
      trackedContracts
        .filter((c) => c && typeof c.contractNo === 'string')
        .map((c) => normalizeContractNo(c.contractNo)),
    );
  }, [trackedContracts]);

  const strategySummary = useMemo(() => {
    try {
      const items =
        visibleAersRecords.length > 0
          ? normalizeEvaluableFromAers(visibleAersRecords, trackedContractNos, mrpMap)
          : normalizeEvaluableFromTracked(visibleTrackedContracts);
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
  }, [visibleAersRecords, visibleTrackedContracts, trackedContractNos, mrpMap]);

  const worstCount = useMemo(() => {
    try {
      if (visibleAersRecords.length > 0) {
        return visibleAersRecords.filter((r) =>
          isWorstCategory(r.nplReason, r.worstCaseProduct),
        ).length;
      }
      return visibleTrackedContracts.filter((c) =>
        isWorstCategory(c.nplReason, c.worstCaseProduct),
      ).length;
    } catch {
      return 0;
    }
  }, [visibleAersRecords, visibleTrackedContracts]);

  const alertDigest = useMemo(() => {
    try {
      const d = buildRecoveryAlertDigest(visibleTrackedContracts);
      return {
        todayPp: Array.isArray(d?.todayPp) ? d.todayPp : [],
        brokenPp: Array.isArray(d?.brokenPp) ? d.brokenPp : [],
        dpd91Danger: Array.isArray(d?.dpd91Danger) ? d.dpd91Danger : [],
        pendingHandOver: Array.isArray(d?.pendingHandOver) ? d.pendingHandOver : [],
      };
    } catch {
      return {
        todayPp: [],
        brokenPp: [],
        dpd91Danger: [],
        pendingHandOver: [],
      };
    }
  }, [visibleTrackedContracts]);

  const urgentAlertsCount =
    alertDigest.todayPp.length +
    alertDigest.brokenPp.length +
    alertDigest.dpd91Danger.length +
    alertDigest.pendingHandOver.length;

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

  const applyParsedAersResult = async (parsed: ParsedAersResult) => {
    if (!isAdmin) {
      setAdminModalOpen(true);
      showToast(
        'Admin Login Required',
        'Only Admin can upload and update AERS reports for everyone.',
        'error',
      );
      return;
    }

    const sanitizedAersReport = sanitizeAersListWithReport(
      parsed.records,
      `upload:${parsed.metadata?.fileName || 'aers'}`,
    );
    const cleanParsedRecords = sanitizedAersReport.data;

    const nextMap = new Map<string, AersRecord>();
    cleanParsedRecords.forEach((r) => {
      nextMap.set(normalizeContractNo(r.contractNo), r);
    });

    const effectiveMrpMap = parsed.mrpMap
      ? sanitizeMrpMap(parsed.mrpMap, `upload:${parsed.metadata?.fileName || 'aers'}:mrp`)
      : mrpMap;
    if (parsed.mrpMap) {
      setMrpMap(effectiveMrpMap);
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

    const nextBaseline = sanitizeOpeningBaseline(
      parsed.excelOfficerOpeningBaseline ??
        buildOpeningOfficerBaseline(
          cleanParsedRecords,
          parsed.metadata.printedDateTime,
        ),
      'upload:openingBaseline',
    );
    setOpeningBaseline(nextBaseline);

    const cleanSyncedContracts = sanitizeTrackedList(
      syncResult.updatedContracts,
      'upload:syncedTrackedContracts',
    );

    setRegularContractNos(new Set(parsed.excludedRegularContractNos ?? []));
    setAersRecords(cleanParsedRecords);
    setAersMeta(parsed.metadata);
    setTrackedContracts(cleanSyncedContracts);
    setAnimKey((k) => k + 1);

    const idx = monthlySnapshots.findIndex(
      (s) => s.snapshotDate === syncResult.snapshot.snapshotDate,
    );
    let nextSnapshots: MonthlySnapshot[];
    if (idx >= 0) {
      nextSnapshots = [...monthlySnapshots];
      nextSnapshots[idx] = { ...syncResult.snapshot, id: nextSnapshots[idx].id };
    } else {
      nextSnapshots = [...monthlySnapshots, syncResult.snapshot];
    }
    nextSnapshots.sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
    setMonthlySnapshots(nextSnapshots);

    let cloudNote = ' · Saved locally (Add GitHub Token in Admin to publish live to everyone)';
    try {
      const published = await pushToLiveCloudIfConfigured({
        aersRecords: cleanParsedRecords,
        aersMeta: parsed.metadata,
        mrpMap: effectiveMrpMap,
        openingBaseline: nextBaseline,
        trackedContracts: cleanSyncedContracts,
        monthlySnapshots: nextSnapshots,
      });
      if (published) {
        cloudNote = ' · Published LIVE to GitHub for all users!';
      }
    } catch (err) {
      cloudNote = ` · Cloud sync error: ${err instanceof Error ? err.message : 'Failed'}`;
    }

    const excludedCount = parsed.excludedRegularContractNos?.length ?? 0;
    const excludedNote =
      excludedCount > 0
        ? ` · ${excludedCount.toLocaleString()} regular excluded`
        : '';

    showToast(
      `Workbook Replaced & Auto-Synced (${parsed.records.length.toLocaleString()} NPL/Borderline)`,
      `Synced ${syncResult.syncedCount} tracked${excludedNote}${cloudNote}`,
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
      await applyParsedAersResult(parsed);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to parse AERS Excel/CSV file.';
      showToast('AERS Upload Error', msg, 'error');
    }
  };

  const handlePasteAersText = async (rawText: string) => {
    if (!isAdmin) {
      setAdminModalOpen(true);
      return;
    }
    try {
      const parsed = parseAersPastedText(
        rawText,
        `Daily Paste (${getTodayISO()})`,
      );
      await applyParsedAersResult(parsed);
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
      const next = exists
        ? prev.map((c) =>
            normalizeContractNo(c.contractNo) ===
            normalizeContractNo(contract.contractNo)
              ? contract
              : c,
          )
        : [contract, ...prev];
      if (isAdmin) {
        pushToLiveCloudIfConfigured({ trackedContracts: next }).catch(() => {});
      }
      return next;
    });
    showToast(
      'Watchlist Updated',
      `${contract.contractNo} (${contract.cusName}) saved.`,
      'success',
    );
  };

  const handleBulkAddContracts = (contractsToAdd: TrackedContract[]) => {
    setTrackedContracts((prev) => {
      const next = [...contractsToAdd, ...prev];
      if (isAdmin) {
        pushToLiveCloudIfConfigured({ trackedContracts: next }).catch(() => {});
      }
      return next;
    });
    showToast(
      'Bulk Import Complete',
      `Added ${contractsToAdd.length} contract${contractsToAdd.length === 1 ? '' : 's'} to active Watchlist.`,
      'success',
    );
  };

  const handleAddFromMaster = (record: AersRecord) => {
    if (trackedContractNos.has(normalizeContractNo(record.contractNo))) return;
    const today = getTodayISO();
    const assignedOfficer = getOfficerByOfficeType(record);
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
      remarkBy: assignedOfficer || 'Officer',
      ro: assignedOfficer,
      currentSituation: 'Active Follow-Up',
      mrp: mrpMap.get(normalizeContractNo(record.contractNo)),
      locationUrl: '',
      nplSavedAmount: 0,
      addedAt: today,
      lastSyncedAt: aersMeta?.printedDateTime,
      visitHistory: [],
    };
    setTrackedContracts((prev) => {
      const next = [newTracked, ...prev];
      if (isAdmin) {
        pushToLiveCloudIfConfigured({ trackedContracts: next }).catch(() => {});
      }
      return next;
    });
    showToast(
      'Added to Watchlist',
      `${record.contractNo} (${record.cusName}) is now tracked.`,
      'success',
    );
  };

  const handleRemoveContract = (contractNo: string) => {
    setTrackedContracts((prev) => {
      const next = prev.filter(
        (c) =>
          normalizeContractNo(c.contractNo) !== normalizeContractNo(contractNo),
      );
      if (isAdmin) {
        pushToLiveCloudIfConfigured({ trackedContracts: next }).catch(() => {});
      }
      return next;
    });
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

    setTrackedContracts((prev) => {
      const next = prev.map((c) => {
        const hit = byContract.get(normalizeContractNo(c.contractNo));
        if (!hit) return c;
        return {
          ...c,
          locationUrl: hit.locationUrl,
          locationUpdatedAt: hit.timestampText,
          locationText: hit.locationText,
        };
      });
      if (isAdmin) {
        pushToLiveCloudIfConfigured({ trackedContracts: next }).catch(() => {});
      }
      return next;
    });

    showToast(
      'WhatsApp Locations Synced',
      `Updated Google Maps pins on ${byContract.size} tracked contract${byContract.size === 1 ? '' : 's'}.`,
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

  const handleExportBackup = () => {
    const payload: BackupPayload = {
      version: 3,
      exportedAt: new Date().toISOString(),
      trackedContracts,
      monthlySnapshots,
      aersMeta,
      aersMasterList: aersRecords,
      openingBaseline,
      staffAssignments,
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
      if (!isPlainObject(parsed) || !Array.isArray(parsed.trackedContracts)) {
        throw new Error(
          `Invalid backup file: expected object with trackedContracts array, got ${describeValueType(parsed)}.`,
        );
      }

      const trackedReport = sanitizeTrackedListWithReport(
        parsed.trackedContracts,
        `backup:${file.name}:trackedContracts`,
      );
      setTrackedContracts(trackedReport.data);

      let totalDropped = trackedReport.droppedCount;
      let restoredSnapCount = 0;

      if (parsed.monthlySnapshots !== undefined) {
        const snapReport = sanitizeSnapshotsListWithReport(
          parsed.monthlySnapshots,
          `backup:${file.name}:monthlySnapshots`,
        );
        setMonthlySnapshots(snapReport.data);
        restoredSnapCount = snapReport.data.length;
        totalDropped += snapReport.droppedCount;
      }

      if (parsed.aersMasterList !== undefined) {
        const aersReport = sanitizeAersListWithReport(
          parsed.aersMasterList,
          `backup:${file.name}:aersMasterList`,
        );
        setAersRecords(aersReport.data);
        totalDropped += aersReport.droppedCount;
      }

      if (parsed.aersMeta !== undefined) {
        setAersMeta(
          isPlainObject(parsed.aersMeta)
            ? (parsed.aersMeta as unknown as AersMetadata)
            : null,
        );
      }

      if (parsed.openingBaseline !== undefined) {
        setOpeningBaseline(
          sanitizeOpeningBaseline(
            parsed.openingBaseline,
            `backup:${file.name}:openingBaseline`,
          ),
        );
      }

      if (parsed.staffAssignments !== undefined) {
        const staffReport = sanitizeStaffAssignmentsWithReport(
          parsed.staffAssignments,
          `backup:${file.name}:staffAssignments`,
        );
        setStaffAssignments(staffReport.data);
        totalDropped += staffReport.droppedCount;
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

      const droppedNote =
        totalDropped > 0
          ? ` (${totalDropped} malformed record${totalDropped === 1 ? '' : 's'} skipped — see console)`
          : '';
      showToast(
        totalDropped > 0 ? 'Backup Restored with Warnings' : 'Backup Restored',
        `Restored ${trackedReport.data.length} tracked contracts and ${restoredSnapCount} snapshots${droppedNote}.`,
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
    const ok = await pushToLiveCloudIfConfigured();
    if (!ok) {
      throw new Error('Please paste and save your GitHub Personal Access Token first.');
    }
    showToast(
      'Published Live to Everyone',
      `All ${aersRecords.length.toLocaleString()} accounts & ${trackedContracts.length} watchlist contracts are now live for all users.`,
      'success',
    );
  };

  const handleAuthorizedReset = async () => {
    if (!adminToken) {
      throw new Error('Admin login is required to reset the application.');
    }
    setAersRecords([]);
    setAersMeta(null);
    setMrpMap(new Map());
    setRegularContractNos(new Set());
    setOpeningBaseline(null);
    setTrackedContracts([]);
    setMonthlySnapshots([]);
    setStaffAssignments([]);
    setSelectedOfficer('ALL');
    localStorage.removeItem(STORAGE_KEYS.AERS_MASTER);
    localStorage.removeItem(STORAGE_KEYS.AERS_META);
    localStorage.removeItem(STORAGE_KEYS.MRP_MAP);
    localStorage.removeItem(STORAGE_KEYS.OPENING_BASELINE);
    localStorage.removeItem(STORAGE_KEYS.TRACKED);
    localStorage.removeItem(STORAGE_KEYS.SNAPSHOTS);
    localStorage.removeItem(STORAGE_KEYS.STAFF_ASSIGNMENTS);

    await pushToLiveCloudIfConfigured({
      aersRecords: [],
      aersMeta: null,
      mrpMap: new Map(),
      openingBaseline: null,
      trackedContracts: [],
      monthlySnapshots: [],
      staffAssignments: [],
    }).catch(() => {});

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
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 h-16 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0 shadow-xs">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="relative flex items-center justify-center p-2 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-600 to-slate-900 shadow-md shadow-emerald-950/20 border border-emerald-400/30 shrink-0">
            <PulseLogoMark className="w-6 h-6 text-white drop-shadow" />
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
              Leasing &amp; Finance Recovery Control · {isAdmin ? 'Admin Mode' : 'Live View-Only'}
            </span>
          </div>
        </div>

        {/* Center Navigation */}
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

        {/* Right Zone */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => syncFromLiveCloud(false)}
            disabled={isSyncingCloud}
            title="Fetch latest Admin-published data"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 shadow-xs disabled:opacity-50"
          >
            <Cloud className={`w-3.5 h-3.5 text-emerald-600 ${isSyncingCloud ? 'animate-pulse' : ''}`} />
            <span className="hidden md:inline">{isSyncingCloud ? 'Syncing...' : 'Refresh Live'}</span>
          </button>

          {isAdmin && (
            <>
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
            </>
          )}

          <button
            type="button"
            onClick={() => setAdminModalOpen(true)}
            aria-label="Admin login and reset controls"
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition-colors whitespace-nowrap shrink-0 shadow-xs ${
              isAdmin
                ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                : 'border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {isAdmin ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Admin Active</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Admin Login</span>
              </>
            )}
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
              {isAdmin ? 'Admin Live Publish Enabled' : 'Live View Mode (Admin Controlled)'}
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
              Scope:{' '}
              <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                {selectedOfficer === 'ALL' ? 'All Officers (Branch)' : selectedOfficer}
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
                {visibleTrackedContracts.length}
              </span>{' '}
              of {visibleAersRecords.length.toLocaleString()} indexed
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setWaModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Sync WhatsApp
              </button>
            )}

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
          <span>· WhatsApp GPS Pins Synced: {visibleTrackedContracts.filter((c) => c.locationUrl).length} active locations</span>
          <span className="inline-flex items-center gap-1.5 font-bold text-emerald-300 ml-8">
            <Bell className="w-3.5 h-3.5 animate-bounce" />
            LIVE RECOVERY ALERTS:
          </span>
          <span>· Today P/P: {alertDigest.todayPp.length} accounts committed</span>
          <span>· Broken P/P: {alertDigest.brokenPp.length} high priority follow-ups</span>
          <span>· 91-DPD Danger Zone: {alertDigest.dpd91Danger.length} contracts crossing this month</span>
          <span>· Hand Over Pending: {alertDigest.pendingHandOver.length} repossession files</span>
          <span>· WhatsApp GPS Pins Synced: {visibleTrackedContracts.filter((c) => c.locationUrl).length} active locations</span>
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
              <section
                aria-label="Recovery Strategy Summary"
                className="bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 text-white border border-emerald-800/40 rounded-3xl p-6 sm:p-7 shadow-xl shadow-slate-950/25 relative overflow-hidden backdrop-blur-xl"
              >
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
                            · {formatCompactRs(strategySummary.borderlineCapitalAtRisk)}
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

                    <div className="flex flex-wrap items-center gap-2.5 pt-2">
                      {isAdmin ? (
                        <>
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
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAdminModalOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-emerald-300 transition-all whitespace-nowrap"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          Admin Login to Upload Data
                        </button>
                      )}

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

              <SectionSafeBoundary name="Executive Officer Hub" resetKey={animKey}>
                <ExecutiveOfficerHubPanel
                  aersRecords={aersRecords}
                  aersMeta={aersMeta}
                  trackedContracts={trackedContracts}
                  mrpMap={mrpMap}
                  openingBaseline={openingBaseline}
                  monthlySnapshots={monthlySnapshots}
                  selectedOfficer={selectedOfficer}
                  onSelectOfficer={setSelectedOfficer}
                  onAddFromMaster={handleAddFromMaster}
                />
              </SectionSafeBoundary>

              <SectionSafeBoundary name="KPI Strip" resetKey={animKey}>
                <KpiStrip
                  contracts={visibleTrackedContracts}
                  aersRecords={visibleAersRecords}
                  mrpMap={mrpMap}
                  animKey={animKey}
                />
              </SectionSafeBoundary>

              <SectionSafeBoundary name="Trends Evaluation" resetKey={animKey}>
                <TrendsEvaluationPanel
                  trackedContracts={visibleTrackedContracts}
                  aersRecords={visibleAersRecords}
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
              </SectionSafeBoundary>

              <SectionSafeBoundary name="Tracking Table" resetKey={animKey}>
                <TrackingTable
                  contracts={visibleTrackedContracts}
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
              </SectionSafeBoundary>

              <SectionSafeBoundary name="Analytics Charts" resetKey={animKey}>
                <AnalyticsCharts
                  contracts={visibleTrackedContracts}
                  aersRecords={visibleAersRecords}
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

          {activeNav === 'borderline' && (
            <SectionSafeBoundary name="Next Month Borderline" resetKey={animKey}>
              <NextMonthBorderlineCardsPanel
                trackedContracts={visibleTrackedContracts}
                aersRecords={visibleAersRecords}
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
            </SectionSafeBoundary>
          )}

          {activeNav === 'worst' && (
            <SectionSafeBoundary name="Worst Case Radar" resetKey={animKey}>
              <WorstCasePanel
                trackedContracts={visibleTrackedContracts}
                aersRecords={visibleAersRecords}
                mrpMap={mrpMap}
                onAddFromMaster={handleAddFromMaster}
              />
            </SectionSafeBoundary>
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
                    aria-selected={toolsSubTab === 'staff_monitor'}
                    onClick={() => setToolsSubTab('staff_monitor')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      toolsSubTab === 'staff_monitor'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    Staff Follow-Up &amp; Performance
                    {staffAssignments.length > 0 && (
                      <span
                        className={`ml-1 px-1.5 py-0.5 text-[10px] font-mono rounded-md ${
                          toolsSubTab === 'staff_monitor'
                            ? 'bg-white/20 text-white'
                            : 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                        }`}
                      >
                        {staffAssignments.length}
                      </span>
                    )}
                  </button>
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
                    Office Type → Officer Breakdown
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

              {toolsSubTab === 'staff_monitor' && (
                <SectionSafeBoundary name="Staff Follow-Up Monitor" resetKey={animKey}>
                  <StaffFollowUpMonitorPanel
                    aersRecords={aersRecords}
                    trackedContracts={trackedContracts}
                    assignments={staffAssignments}
                    isDark={isDark}
                    onAssignBulk={handleAssignStaffBulk}
                    onRemoveAssignment={handleRemoveStaffAssignment}
                    onClearStaffMonth={handleClearStaffMonth}
                  />
                </SectionSafeBoundary>
              )}

              {toolsSubTab === 'office_breakdown' && (
                <SectionSafeBoundary name="Office Type Breakdown" resetKey={animKey}>
                  <OfficeTypeBreakdownPanel
                    trackedContracts={visibleTrackedContracts}
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
                    trackedContracts={visibleTrackedContracts}
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
                </SectionSafeBoundary>
              )}

              {toolsSubTab === 'ai' && (
                <SectionSafeBoundary name="AI Recovery Agent" resetKey={animKey}>
                  <AiRecoveryAgentPanel
                    trackedContracts={visibleTrackedContracts}
                    aersRecords={visibleAersRecords}
                    aersMeta={aersMeta}
                    openingBaseline={openingBaseline}
                  />
                </SectionSafeBoundary>
              )}

              {toolsSubTab === 'alerts' && (
                <SectionSafeBoundary name="Alerts & Notifications" resetKey={animKey}>
                  <AlertsNotificationsPanel
                    contracts={visibleTrackedContracts}
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
                <SectionSafeBoundary name="AERS Master Lookup" resetKey={animKey}>
                  <AersLookupPanel
                    aersRecords={aersRecords}
                    aersMeta={aersMeta}
                    mrpMap={mrpMap}
                    trackedContractNos={trackedContractNos}
                    onUploadAersFile={handleUploadAersFile}
                    onAddFromMaster={handleAddFromMaster}
                  />
                </SectionSafeBoundary>
              ) : (
                <SectionSafeBoundary name="Backup & Settings" resetKey={animKey}>
                  <BackupSettingsPanel
                    trackedCount={trackedContracts.length}
                    snapshotsCount={monthlySnapshots.length}
                    aersMeta={aersMeta}
                    isAdminAuthenticated={isAdmin}
                    onOpenAdminModal={() => setAdminModalOpen(true)}
                    onExportBackup={handleExportBackup}
                    onRestoreBackup={handleRestoreBackup}
                  />
                </SectionSafeBoundary>
              )}
            </div>
          )}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="mt-8 pb-28 px-4 sm:px-6 border-t border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/50 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <PulseLogoMark className="w-7 h-7 shrink-0" />
            <div>
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                WG Pulse · Leasing &amp; Finance Recovery Control
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Admin Live Cloud Sync · Office Type → MO/RO Strategy · AI Strategist &amp; Google Maps
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

      {/* Bottom Floating Glass Menu Dock */}
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
        isAdminAuthenticated={isAdmin}
        onClose={() => setAdminModalOpen(false)}
        onLoginSuccess={(token) => {
          setAdminToken(token);
          showToast(
            'Admin Mode Unlocked',
            'You can now upload AERS reports, edit watchlist contracts, and publish live updates to everyone.',
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
