import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Clock,
  Layers,
  PhoneCall,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  STAFF_FOLLOWUP_NAMES,
  type AersMetadata,
  type AersRecord,
  type MonthlySnapshot,
  type MrpEnrichment,
  type MrpPaymentMonth,
  type OfficerEvaluationRow,
  type OpeningOfficerBaseline,
  type StaffAssignedContract,
} from '../types/recovery';
import {
  CAMPAIGN_MONTHS,
  analyzeNextMonthBorderline,
  computeOfficerOpeningClosing,
  extractBelowOneQuickWins,
  formatCompactRs,
  formatCurrencyRs,
  getOfficerByOfficeType,
  getTodayISO,
  isMarketingOfficeType,
  isWorstCategory,
  normalizeContractNo,
  normalizeEvaluableFromAers,
} from '../utils/recoveryEngine';
import type { EvaluableAccount } from '../utils/recoveryEngine';
import { PaymentPatternStrip } from './PaymentPatternStrip';
import { UserAvatar } from './UserAvatar';
import { WorstCaseProductBadge } from './WorstCaseProductBadge';

interface ExecutiveOfficerHubPanelProps {
  aersRecords: AersRecord[];
  aersMeta: AersMetadata | null;
  mrpMap?: Map<string, MrpEnrichment>;
  openingBaseline: OpeningOfficerBaseline | null;
  monthlySnapshots: MonthlySnapshot[];
  selectedOfficer: string;
  onSelectOfficer: (officer: string) => void;
  staffAssignments: StaffAssignedContract[];
  onAssignStaffBulk: (newItems: StaffAssignedContract[]) => void;
  onRemoveStaffAssignment: (staffName: string, monthKey: string, contractNo: string) => void;
  onClearStaffMonth: (staffName: string, monthKey: string) => void;
}

type ActionBucketKey =
  | 'borderline'
  | 'zero_effort'
  | 'newly_slipped'
  | 'below_one'
  | 'worst';

interface EvaluatedAssignContract {
  assignment: StaffAssignedContract;
  matchedInAers: boolean;
  cusName: string;
  vehicleNo: string;
  dpd: number;
  closingDebtor: number;
  closingNpl: number;
  currentMonthDue: number;
  totalCollection: number;
  lastPaidAmount: number;
  lastPayDate: string;
  pendingDue: number;
  isPaid: boolean;
  opAge: number;
  closingAge: number;
  ageVariance: number;
  trend: 'reducing' | 'steady' | 'worsening';
  assignEfforts: number;
  totalEfforts: number;
  effortPct: number;
  isWorst: boolean;
  nplReason: string;
  worstCaseProduct: string;
}

const EMPTY_SET = new Set<string>();

function asArray<T>(val: unknown): T[] {
  return Array.isArray(val) ? (val as T[]) : [];
}

function asStr(val: unknown): string {
  return typeof val === 'string'
    ? val
    : val == null || typeof val === 'boolean'
      ? ''
      : String(val);
}

function getDefaultMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(monthKey: string): string {
  const found = CAMPAIGN_MONTHS.find((m) => m.monthKey === monthKey);
  if (found) return found.label;
  const parts = monthKey.split('-');
  if (parts.length !== 2) return monthKey;
  const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
  if (Number.isNaN(dt.getTime())) return monthKey;
  return dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function ExecutiveOfficerHubPanel({
  aersRecords,
  aersMeta,
  mrpMap,
  openingBaseline,
  monthlySnapshots,
  selectedOfficer,
  onSelectOfficer,
  staffAssignments,
  onAssignStaffBulk,
  onRemoveStaffAssignment,
  onClearStaffMonth,
}: ExecutiveOfficerHubPanelProps) {
  const [activeHighlightTab, setActiveHighlightTab] = useState<
    'cards' | 'assign_monitor' | 'campaign_perf' | 'daily_action'
  >('cards');

  // Assign User Monitor state (Tab 2)
  const [selectedAssignUser, setSelectedAssignUser] = useState<string>('ALL');
  const [bulkTargetUser, setBulkTargetUser] = useState<string>(STAFF_FOLLOWUP_NAMES[0]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getDefaultMonthKey());
  const [bulkText, setBulkText] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [modalUser, setModalUser] = useState<string | null>(null);
  const [modalSearch, setModalSearch] = useState('');
  const [modalFilter, setModalFilter] = useState<
    'all' | 'reducing' | 'worsening' | 'paid' | 'pending' | 'zero_effort'
  >('all');
  const [modalPage, setModalPage] = useState(1);
  const [confirmClearModal, setConfirmClearModal] = useState(false);

  // Daily Action & Variance Guide state (Tab 4)
  const [varianceLang, setVarianceLang] = useState<'both' | 'si' | 'en'>('both');
  const [actionBucket, setActionBucket] = useState<ActionBucketKey>('borderline');
  const [actionOfficerFilter, setActionOfficerFilter] = useState<string>('ALL');
  const [actionSearch, setActionSearch] = useState('');
  const [actionPage, setActionPage] = useState(1);

  // Campaign state (Tab 3)
  const [selectedCampaignMonth, setSelectedCampaignMonth] = useState<string>('ALL');

  const safeAers = useMemo(() => {
    return asArray<AersRecord>(aersRecords)
      .filter((r) => r && typeof r === 'object' && !Array.isArray(r))
      .map((r) => ({
        ...r,
        contractNo: asStr(r.contractNo),
        cusName: asStr(r.cusName),
        mobileNo: asStr(r.mobileNo),
        address: asStr(r.address),
        officeType: asStr(r.officeType),
        recoveryOfficer: asStr(r.recoveryOfficer),
        marketingOfficer: asStr(r.marketingOfficer),
        nplReason: asStr(r.nplReason),
        worstCaseProduct: asStr(r.worstCaseProduct),
        lastPayDate: asStr(r.lastPayDate),
        currentStock: asStr(r.currentStock),
      }))
      .filter((r) => r.contractNo.length > 0);
  }, [aersRecords]);

  const aersByNo = useMemo(() => {
    const map = new Map<string, AersRecord>();
    safeAers.forEach((r) => map.set(normalizeContractNo(r.contractNo), r));
    return map;
  }, [safeAers]);

  const safeSnapshots = useMemo(
    () =>
      asArray<MonthlySnapshot>(monthlySnapshots).filter(
        (s) => s && typeof s === 'object' && !Array.isArray(s),
      ),
    [monthlySnapshots],
  );

  const safeMrpMap = useMemo(() => {
    const out = new Map<string, MrpEnrichment>();
    if (mrpMap instanceof Map) {
      mrpMap.forEach((v, k) => {
        if (typeof k === 'string' && v && typeof v === 'object' && !Array.isArray(v)) {
          out.set(k, {
            ...v,
            paymentPattern: asArray<MrpPaymentMonth>(v.paymentPattern),
          });
        }
      });
    }
    return out;
  }, [mrpMap]);

  const safeBaseline = useMemo<OpeningOfficerBaseline | null>(() => {
    if (!openingBaseline || typeof openingBaseline !== 'object' || Array.isArray(openingBaseline)) {
      return null;
    }
    const cleanByOfficer: OpeningOfficerBaseline['byOfficer'] = {};
    if (
      openingBaseline.byOfficer &&
      typeof openingBaseline.byOfficer === 'object' &&
      !Array.isArray(openingBaseline.byOfficer)
    ) {
      for (const [k, v] of Object.entries(openingBaseline.byOfficer)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          cleanByOfficer[k] = v;
        }
      }
    }
    return {
      ...openingBaseline,
      byOfficer: cleanByOfficer,
    };
  }, [openingBaseline]);

  const evaluableItems = useMemo<EvaluableAccount[]>(() => {
    try {
      return asArray<EvaluableAccount>(
        normalizeEvaluableFromAers(safeAers, EMPTY_SET, safeMrpMap),
      );
    } catch {
      return [];
    }
  }, [safeAers, safeMrpMap]);

  const officerRows = useMemo<OfficerEvaluationRow[]>(() => {
    try {
      return asArray<OfficerEvaluationRow>(
        computeOfficerOpeningClosing(evaluableItems, safeBaseline),
      );
    } catch {
      return [];
    }
  }, [evaluableItems, safeBaseline]);

  const bmRatioByOfficer = useMemo(() => {
    const map = new Map<string, { ratio90Pct: number; belowOneCount: number; totalCount: number }>();
    const roList = aersMeta?.bmBranchSnapshot?.roPerformance ?? [];
    const moList = aersMeta?.bmBranchSnapshot?.moPerformance ?? [];
    [...roList, ...moList].forEach((r) => {
      const ratio90Pct =
        r.ratio90Pct !== undefined
          ? r.ratio90Pct
          : r.totalCount > 0
            ? (r.belowOneCount / r.totalCount) * 100
            : 0;
      map.set(r.officer, {
        ratio90Pct,
        belowOneCount: r.belowOneCount,
        totalCount: r.totalCount,
      });
    });
    return map;
  }, [aersMeta]);

  const officerCards = useMemo(() => {
    const officeMap = new Map<string, string>();
    for (const item of evaluableItems) {
      if (item && typeof item.officer === 'string' && item.officer && !officeMap.has(item.officer)) {
        officeMap.set(item.officer, asStr(item.officeType));
      }
    }

    return officerRows.map((row) => {
      const officerItems = evaluableItems.filter((i) => i && i.officer === row.officer);
      let borderline = { totalCount: 0, totalCapitalAtRisk: 0, totalDebtorAtRisk: 0 };
      try {
        const res = analyzeNextMonthBorderline(officerItems);
        if (res && typeof res === 'object') {
          borderline = {
            totalCount: Number(res.totalCount) || 0,
            totalCapitalAtRisk: Number(res.totalCapitalAtRisk) || 0,
            totalDebtorAtRisk: Number(res.totalDebtorAtRisk) || 0,
          };
        }
      } catch {
        // Fallback zeros
      }

      const totalEfforts = officerItems.reduce(
        (sum, i) => sum + (Number(i.assignOfficerEfforts) || 0),
        0,
      );
      const contactedCount = officerItems.filter(
        (i) => (Number(i.assignOfficerEfforts) || 0) > 0,
      ).length;
      const effortCoveragePct =
        officerItems.length > 0
          ? Math.round((contactedCount / officerItems.length) * 100)
          : 0;
      const officeType = officeMap.get(row.officer) || 'RO';
      const isMo = isMarketingOfficeType(officeType);
      const bmRatio = bmRatioByOfficer.get(row.officer);

      return {
        ...row,
        officeType,
        roleBadge: isMo ? 'MO' : 'RO',
        borderlineCount: borderline.totalCount,
        borderlineAmount: borderline.totalCapitalAtRisk,
        borderlineDebtor: borderline.totalDebtorAtRisk,
        totalEfforts,
        contactedCount,
        effortCoveragePct,
        ratio90Pct: bmRatio?.ratio90Pct,
      };
    });
  }, [evaluableItems, officerRows, bmRatioByOfficer]);

  // ========== TAB 2: ASSIGN USER MONITOR (NO RO/MO DETAILS) ==========
  const monthOptions = useMemo(() => {
    const keys = new Set<string>([getDefaultMonthKey()]);
    CAMPAIGN_MONTHS.forEach((m) => keys.add(m.monthKey));
    asArray<StaffAssignedContract>(staffAssignments).forEach((a) => {
      if (a.monthKey) keys.add(a.monthKey);
    });
    return Array.from(keys).sort();
  }, [staffAssignments]);

  const monthAssignments = useMemo(
    () =>
      asArray<StaffAssignedContract>(staffAssignments).filter(
        (a) => a.monthKey === selectedMonth,
      ),
    [staffAssignments, selectedMonth],
  );

  const parsedBulkTokens = useMemo(() => {
    const parts = asStr(bulkText)
      .split(/[\s,;|\t\n\r]+/)
      .map((t) => normalizeContractNo(t))
      .filter((t) => t.length >= 4);
    return Array.from(new Set(parts));
  }, [bulkText]);

  const existingForTargetUser = useMemo(() => {
    const set = new Set<string>();
    monthAssignments
      .filter((a) => a.staffName === bulkTargetUser)
      .forEach((a) => set.add(normalizeContractNo(a.contractNo)));
    return set;
  }, [monthAssignments, bulkTargetUser]);

  const bulkStats = useMemo(() => {
    let matched = 0;
    let duplicates = 0;
    let newCount = 0;
    parsedBulkTokens.forEach((tok) => {
      if (aersByNo.has(tok)) matched += 1;
      if (existingForTargetUser.has(tok)) duplicates += 1;
      else newCount += 1;
    });
    return { total: parsedBulkTokens.length, matched, duplicates, newCount };
  }, [parsedBulkTokens, aersByNo, existingForTargetUser]);

  const handleAssignBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkStats.newCount === 0) return;
    const today = getTodayISO();
    const itemsToAdd: StaffAssignedContract[] = [];
    parsedBulkTokens.forEach((tok) => {
      if (existingForTargetUser.has(tok)) return;
      const aers = aersByNo.get(tok);
      const opAge = Number(aers?.opAge ?? aers?.currentAge ?? 0) || 0;
      const due = Number(aers?.currentMonthDue || aers?.dueBudgetMonth || 0) || 0;
      const coll = Number(aers?.totalCollection ?? 0) || 0;
      itemsToAdd.push({
        contractNo: aers?.contractNo ?? tok,
        staffName: bulkTargetUser,
        monthKey: selectedMonth,
        assignedAt: today,
        assignedOpAge: opAge,
        assignedDebtor: Number(aers?.closingDebtor ?? 0) || 0,
        assignedNpl: Number(aers?.npl ?? 0) || 0,
        assignedDue: due,
        assignedCollection: coll,
        note: assignNote.trim() || undefined,
      });
    });
    if (itemsToAdd.length > 0) {
      onAssignStaffBulk(itemsToAdd);
      setBulkText('');
      setAssignNote('');
      setSelectedAssignUser(bulkTargetUser);
    }
  };

  const evaluatedAssignContracts = useMemo<EvaluatedAssignContract[]>(() => {
    return monthAssignments.map((assignment) => {
      const key = normalizeContractNo(assignment.contractNo);
      const aers = aersByNo.get(key);
      const currentMonthDue =
        Number(aers?.currentMonthDue || aers?.dueBudgetMonth || assignment.assignedDue) || 0;
      const totalCollection = Number(aers?.totalCollection ?? 0) || 0;
      const isPaid = totalCollection > 0;
      const pendingDue = Math.max(0, currentMonthDue - totalCollection);
      const opAge = Number(aers?.opAge ?? assignment.assignedOpAge) || 0;
      const closingAge = Number(aers?.currentAge ?? assignment.assignedOpAge) || 0;
      const ageVariance = Number((closingAge - opAge).toFixed(2));
      let trend: 'reducing' | 'steady' | 'worsening' = 'steady';
      if (ageVariance <= -0.05) {
        trend = 'reducing';
      } else if (ageVariance >= 0.05) {
        trend = 'worsening';
      }
      const assignEfforts = Number(aers?.assignOfficerEfforts ?? 0) || 0;
      const totalEfforts = Number(aers?.totalEfforts ?? 0) || 0;
      const effortPct = Math.min(100, Math.round((assignEfforts / 3) * 100));
      const nplReason = asStr(aers?.nplReason);
      const worstCaseProduct = asStr(aers?.worstCaseProduct);

      return {
        assignment,
        matchedInAers: Boolean(aers),
        cusName: asStr(aers?.cusName) || 'Not in latest AERS',
        vehicleNo: asStr(aers?.currentStock),
        dpd: Number(aers?.actualDpd ?? 0) || 0,
        closingDebtor: Number(aers?.closingDebtor ?? assignment.assignedDebtor) || 0,
        closingNpl: Number(aers?.npl ?? assignment.assignedNpl) || 0,
        currentMonthDue,
        totalCollection,
        lastPaidAmount: Number(aers?.lastPaidAmount ?? 0) || 0,
        lastPayDate: asStr(aers?.lastPayDate),
        pendingDue,
        isPaid,
        opAge,
        closingAge,
        ageVariance,
        trend,
        assignEfforts,
        totalEfforts,
        effortPct,
        isWorst: isWorstCategory(nplReason, worstCaseProduct),
        nplReason,
        worstCaseProduct,
      };
    });
  }, [monthAssignments, aersByNo]);

  const scopedAssignContracts = useMemo(() => {
    if (selectedAssignUser === 'ALL') return evaluatedAssignContracts;
    return evaluatedAssignContracts.filter(
      (c) => c.assignment.staffName === selectedAssignUser,
    );
  }, [evaluatedAssignContracts, selectedAssignUser]);

  const assignDashboardBreakdown = useMemo(() => {
    const total = scopedAssignContracts.length;
    const paid = scopedAssignContracts.filter((c) => c.isPaid).length;
    const pending = total - paid;
    const totalDue = scopedAssignContracts.reduce((s, c) => s + c.currentMonthDue, 0);
    const totalColl = scopedAssignContracts.reduce((s, c) => s + c.totalCollection, 0);
    const totalPendingDue = scopedAssignContracts.reduce((s, c) => s + c.pendingDue, 0);
    const reducing = scopedAssignContracts.filter((c) => c.trend === 'reducing').length;
    const steady = scopedAssignContracts.filter((c) => c.trend === 'steady').length;
    const worsening = scopedAssignContracts.filter((c) => c.trend === 'worsening').length;
    const totalAssignEff = scopedAssignContracts.reduce((s, c) => s + c.assignEfforts, 0);
    const zeroEff = scopedAssignContracts.filter((c) => c.assignEfforts <= 0).length;

    const ageGroups = [
      { key: 'le1', label: '≤ 1.00', count: 0 },
      { key: '1_2', label: '1.01 – 1.99', count: 0 },
      { key: '2_3', label: '2.00 – 2.99', count: 0 },
      { key: '3_6', label: '3.00 – 5.99', count: 0 },
      { key: '6p', label: '6.00+', count: 0 },
    ];
    scopedAssignContracts.forEach((c) => {
      if (c.closingAge <= 1.0) ageGroups[0].count += 1;
      else if (c.closingAge < 2.0) ageGroups[1].count += 1;
      else if (c.closingAge < 3.0) ageGroups[2].count += 1;
      else if (c.closingAge < 6.0) ageGroups[3].count += 1;
      else ageGroups[4].count += 1;
    });

    return {
      total,
      paid,
      pending,
      paidPct: total > 0 ? Math.round((paid / total) * 100) : 0,
      totalDue,
      totalColl,
      totalPendingDue,
      collPct: totalDue > 0 ? Math.round((totalColl / totalDue) * 100) : paid > 0 ? 100 : 0,
      reducing,
      steady,
      worsening,
      totalAssignEff,
      zeroEff,
      ageGroups,
    };
  }, [scopedAssignContracts]);

  const assignUserCards = useMemo(() => {
    return STAFF_FOLLOWUP_NAMES.map((staffName) => {
      const items = evaluatedAssignContracts.filter(
        (c) => c.assignment.staffName === staffName,
      );
      const count = items.length;
      const paid = items.filter((c) => c.isPaid).length;
      const pending = count - paid;
      const reducing = items.filter((c) => c.trend === 'reducing').length;
      const steady = items.filter((c) => c.trend === 'steady').length;
      const worsening = items.filter((c) => c.trend === 'worsening').length;
      const totalDue = items.reduce((s, c) => s + c.currentMonthDue, 0);
      const totalColl = items.reduce((s, c) => s + c.totalCollection, 0);
      const collPct =
        totalDue > 0 ? Math.round((totalColl / totalDue) * 100) : paid > 0 ? 100 : 0;
      const assignEff = items.reduce((s, c) => s + c.assignEfforts, 0);
      const zeroEff = items.filter((c) => c.assignEfforts <= 0).length;
      const avgOpAge = count > 0 ? items.reduce((s, c) => s + c.opAge, 0) / count : 0;
      const avgCloseAge = count > 0 ? items.reduce((s, c) => s + c.closingAge, 0) / count : 0;

      return {
        staffName,
        count,
        paid,
        pending,
        paidPct: count > 0 ? Math.round((paid / count) * 100) : 0,
        reducing,
        steady,
        worsening,
        totalDue,
        totalColl,
        collPct,
        assignEff,
        zeroEff,
        avgVariance: Number((avgCloseAge - avgOpAge).toFixed(2)),
      };
    });
  }, [evaluatedAssignContracts]);

  const modalContracts = useMemo(() => {
    if (!modalUser) return [];
    const q = modalSearch.trim().toLowerCase();
    return evaluatedAssignContracts.filter((c) => {
      if (c.assignment.staffName !== modalUser) return false;
      if (modalFilter === 'reducing' && c.trend !== 'reducing') return false;
      if (modalFilter === 'worsening' && c.trend !== 'worsening') return false;
      if (modalFilter === 'paid' && !c.isPaid) return false;
      if (modalFilter === 'pending' && c.isPaid) return false;
      if (modalFilter === 'zero_effort' && c.assignEfforts > 0) return false;
      if (!q) return true;
      return (
        c.assignment.contractNo.toLowerCase().includes(q) ||
        c.cusName.toLowerCase().includes(q) ||
        c.vehicleNo.toLowerCase().includes(q)
      );
    });
  }, [evaluatedAssignContracts, modalUser, modalSearch, modalFilter]);

  const MODAL_PAGE_SIZE = 25;
  const modalTotalPages = Math.max(1, Math.ceil(modalContracts.length / MODAL_PAGE_SIZE));
  const pagedModalContracts = modalContracts.slice(
    (modalPage - 1) * MODAL_PAGE_SIZE,
    modalPage * MODAL_PAGE_SIZE,
  );

  // ========== TAB 3: CAMPAIGN & DAILY SNAPSHOTS ==========
  const campaignSeries = useMemo(() => {
    const months = asArray<{ monthKey: string; label: string }>(CAMPAIGN_MONTHS);
    return months.map((m) => {
      const snaps = safeSnapshots
        .filter((s) => (s.monthKey || s.snapshotDate.slice(0, 7)) === m.monthKey)
        .sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
      const latest = snaps[snaps.length - 1];
      return {
        ...m,
        dayCount: snaps.length,
        hasData: Boolean(latest),
        openingNpl: latest ? Number(latest.openingNpl ?? 0) || 0 : 0,
        closingNpl: latest ? Number(latest.branchNpl || latest.trackedNpl) || 0 : 0,
        savedAmount: latest ? Number(latest.nplSavedAmount) || 0 : 0,
        ratio90Pct: latest?.ratio90Pct,
        collectionPct: latest
          ? Number(latest.branchCollectionPct || latest.collectionPct) || 0
          : 0,
        snapshotDate: asStr(latest?.snapshotDate) || 'Pending',
      };
    });
  }, [safeSnapshots]);

  const filteredDailySnapshots = useMemo(() => {
    const list =
      selectedCampaignMonth === 'ALL'
        ? safeSnapshots
        : safeSnapshots.filter(
            (s) => (s.monthKey || s.snapshotDate.slice(0, 7)) === selectedCampaignMonth,
          );
    return [...list].sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate));
  }, [safeSnapshots, selectedCampaignMonth]);

  // ========== TAB 4: DAILY PRACTICAL ACTION & VARIANCE GUIDE (REAL CONTRACT LIST + USER IMAGE CARDS) ==========
  const belowOneQuickWins = useMemo(() => {
    if (aersMeta?.bmBranchSnapshot?.belowOneQuickWins?.length) {
      return aersMeta.bmBranchSnapshot.belowOneQuickWins;
    }
    return extractBelowOneQuickWins(safeAers);
  }, [aersMeta, safeAers]);

  const dailyActionData = useMemo(() => {
    const scopedEval =
      selectedOfficer === 'ALL'
        ? evaluableItems
        : evaluableItems.filter((i) => i && i.officer === selectedOfficer);

    const borderlineList = scopedEval
      .filter((i) => i.actualDpd >= 61 && i.actualDpd < 91)
      .sort((a, b) => (Number(b.actualDpd) || 0) - (Number(a.actualDpd) || 0));

    const zeroEffortList = scopedEval
      .filter(
        (i) =>
          i.actualDpd >= 61 &&
          i.actualDpd < 91 &&
          (Number(i.assignOfficerEfforts) || 0) <= 0,
      )
      .sort((a, b) => (Number(b.closingDebtor) || 0) - (Number(a.closingDebtor) || 0));

    const newlySlippedList = scopedEval
      .filter((i) => (Number(i.opNpl) || 0) <= 0 && (Number(i.npl) || 0) > 0)
      .sort((a, b) => (Number(b.npl) || 0) - (Number(a.npl) || 0));

    const worstList = scopedEval
      .filter((i) => i.isWorst)
      .sort((a, b) => (Number(b.npl) || 0) - (Number(a.npl) || 0));

    const scopedBelowOne =
      selectedOfficer === 'ALL'
        ? belowOneQuickWins
        : belowOneQuickWins.filter((q) => q.officer === selectedOfficer);

    const totalOpNpl = officerCards.reduce((s, c) => s + (Number(c.openingNpl) || 0), 0);
    const totalCloseNpl = officerCards.reduce((s, c) => s + (Number(c.closingNpl) || 0), 0);
    const totalOpCount = officerCards.reduce((s, c) => s + (Number(c.openingNplCount) || 0), 0);
    const totalCloseCount = officerCards.reduce((s, c) => s + (Number(c.closingNplCount) || 0), 0);

    const activeCard =
      selectedOfficer !== 'ALL'
        ? officerCards.find((c) => c.officer === selectedOfficer)
        : null;

    const opNpl = activeCard ? Number(activeCard.openingNpl) || 0 : totalOpNpl;
    const closeNpl = activeCard ? Number(activeCard.closingNpl) || 0 : totalCloseNpl;
    const opCount = activeCard ? Number(activeCard.openingNplCount) || 0 : totalOpCount;
    const closeCount = activeCard ? Number(activeCard.closingNplCount) || 0 : totalCloseCount;

    return {
      opNpl,
      closeNpl,
      opCount,
      closeCount,
      netDelta: opNpl - closeNpl,
      borderlineList,
      zeroEffortList,
      newlySlippedList,
      worstList,
      belowOneList: scopedBelowOne,
    };
  }, [evaluableItems, officerCards, selectedOfficer, belowOneQuickWins]);

  // Unified real contract rows for the active bucket in Tab 4
  const activeActionRows = useMemo(() => {
    if (actionBucket === 'below_one') {
      return dailyActionData.belowOneList.map((item) => ({
        contractNo: item.contractNo,
        cusName: item.cusName,
        officer: item.officer,
        officeType: item.officeType,
        dpd: item.actualDpd,
        ageText: `${item.opAge.toFixed(2)} → ${item.currentAge.toFixed(2)}`,
        primaryAmountLabel: 'Gap to ≤1',
        primaryAmount: `+${item.excessAge.toFixed(2)} age`,
        secondaryAmount: formatCompactRs(item.closingDebtor),
        efforts: item.assignOfficerEfforts,
        totalEfforts: item.totalEfforts,
        badgeText: item.currentAge <= 1.35 ? 'Ultra Quick Win' : 'Near ≤1.00',
        badgeTone:
          item.currentAge <= 1.35
            ? ('emerald' as const)
            : ('blue' as const),
        worstProduct: '',
        lastPaidAmount: item.lastPaidAmount,
        lastPayDate: item.lastPayDate,
        totalCollection: item.totalCollection,
      }));
    }

    const source =
      actionBucket === 'borderline'
        ? dailyActionData.borderlineList
        : actionBucket === 'zero_effort'
          ? dailyActionData.zeroEffortList
          : actionBucket === 'newly_slipped'
            ? dailyActionData.newlySlippedList
            : dailyActionData.worstList;

    return source.map((item) => {
      const master = aersByNo.get(normalizeContractNo(item.contractNo));
      return {
        contractNo: item.contractNo,
        cusName: item.cusName,
        officer: item.officer,
        officeType: item.officeType,
        dpd: item.actualDpd,
        ageText: `${item.opAge.toFixed(2)} → ${item.currentAge.toFixed(2)}`,
        primaryAmountLabel: item.npl > 0 ? 'Closing NPL' : 'Closing Debtor',
        primaryAmount: formatCompactRs(item.npl > 0 ? item.npl : item.closingDebtor),
        secondaryAmount: formatCompactRs(item.closingDebtor),
        efforts: item.assignOfficerEfforts,
        totalEfforts: item.totalEfforts,
        badgeText:
          actionBucket === 'zero_effort'
            ? '0 Efforts'
            : actionBucket === 'newly_slipped'
              ? 'New 91+ NPL'
              : actionBucket === 'worst'
                ? `Worst (${item.worstCaseProduct || 'W'})`
                : `${item.actualDpd} DPD`,
        badgeTone:
          actionBucket === 'borderline'
            ? ('amber' as const)
            : ('rose' as const),
        worstProduct: item.isWorst ? item.worstCaseProduct || 'W' : '',
        lastPaidAmount: Number(master?.lastPaidAmount ?? 0) || 0,
        lastPayDate: asStr(master?.lastPayDate),
        totalCollection: Number(master?.totalCollection ?? item.totalCollection ?? 0) || 0,
      };
    });
  }, [actionBucket, dailyActionData, aersByNo]);

  // Officer Image Cards for Tab 4 active bucket
  const actionOfficerSummaries = useMemo(() => {
    const map = new Map<
      string,
      { officer: string; officeType: string; count: number; zeroEff: number; efforts: number }
    >();
    activeActionRows.forEach((row) => {
      const existing = map.get(row.officer);
      if (!existing) {
        map.set(row.officer, {
          officer: row.officer,
          officeType: row.officeType,
          count: 1,
          zeroEff: row.efforts <= 0 ? 1 : 0,
          efforts: row.efforts,
        });
      } else {
        existing.count += 1;
        if (row.efforts <= 0) existing.zeroEff += 1;
        existing.efforts += row.efforts;
      }
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [activeActionRows]);

  const filteredActionRows = useMemo(() => {
    const q = actionSearch.trim().toLowerCase();
    return activeActionRows.filter((row) => {
      if (actionOfficerFilter !== 'ALL' && row.officer !== actionOfficerFilter) {
        return false;
      }
      if (!q) return true;
      return (
        row.contractNo.toLowerCase().includes(q) ||
        row.cusName.toLowerCase().includes(q) ||
        row.officer.toLowerCase().includes(q) ||
        row.officeType.toLowerCase().includes(q)
      );
    });
  }, [activeActionRows, actionOfficerFilter, actionSearch]);

  const ACTION_PAGE_SIZE = 20;
  const actionTotalPages = Math.max(1, Math.ceil(filteredActionRows.length / ACTION_PAGE_SIZE));
  const pagedActionRows = filteredActionRows.slice(
    (actionPage - 1) * ACTION_PAGE_SIZE,
    actionPage * ACTION_PAGE_SIZE,
  );

  const activeBucketCopy = useMemo(() => {
    switch (actionBucket) {
      case 'borderline':
        return {
          titleEn: `Protect ${dailyActionData.borderlineList.length} Borderline Accounts (61–90 DPD)`,
          titleSi: `Borderline ගිණුම් ${dailyActionData.borderlineList.length} ක් NPL වීම වළක්වන්න`,
          tipEn:
            'Follow up on the highest DPD accounts first and confirm payment (including DI & charges) before month-end so they do not cross 91 DPD.',
          tipSi:
            'වැඩිම DPD ඇති ගිණුම් වලට මුලින්ම අමතා, DI සහ ගාස්තු ඇතුළු ගෙවීම මාසය අවසානයට පෙර තහවුරු කර ගන්න.',
        };
      case 'zero_effort':
        return {
          titleEn: `${dailyActionData.zeroEffortList.length} Borderline Accounts Have 0 Recorded Efforts`,
          titleSi: `Borderline ගිණුම් ${dailyActionData.zeroEffortList.length} කට තවම කිසිදු උත්සාහයක් (Effort) නැත`,
          tipEn:
            'These 61–90 DPD accounts have 0 officer efforts this month and carry the highest silent-slippage risk. Contact customers today.',
          tipSi:
            'මෙම 61–90 DPD ගිණුම් වලට මේ මාසයේ කිසිදු Effort එකක් සටහන් වී නැත. අදම ගනුදෙනුකරුවන් සම්බන්ධ කර ගන්න.',
        };
      case 'newly_slipped':
        return {
          titleEn: `${dailyActionData.newlySlippedList.length} Newly Slipped NPL Accounts (Op NPL = 0 → Closing NPL > 0)`,
          titleSi: `මේ මාසයේ අලුතින් NPL වූ ගිණුම් ${dailyActionData.newlySlippedList.length} ක්`,
          tipEn:
            'Prioritize these newly slipped accounts immediately to pull them back under 91 DPD before closing.',
          tipSi:
            'අලුතින් 91+ DPD වූ මෙම ගිණුම් වල හිඟ මුදල පරීක්ෂා කර ඉක්මනින් නැවත සාමාන්‍ය මට්ටමට ගෙන එන්න.',
        };
      case 'below_one':
        return {
          titleEn: `Below 1 (≤ 1.00) · 90 Ratio Quick-Win Contracts (${dailyActionData.belowOneList.length} in 1.01–1.99 Age)`,
          titleSi: `90 Ratio (Below 1) සඳහා පොඩි ගණනකින් 1.00 ට ගත හැකි ගිණුම් ${dailyActionData.belowOneList.length} ක්`,
          tipEn:
            'Focus on contracts closest to 1.01 first (smallest excess age) rather than deep arrears accounts to lift the branch 90 Ratio fastest.',
          tipSi:
            'වාරික ගොඩක් හිඟ ගිණුම් වලට වඩා 1.01 සිට ඉහළට ඇති පොඩි ගණනකින් 1.00 ට අඩු කර ගත හැකි ගිණුම් මුලින්ම අවසන් කරන්න.',
        };
      case 'worst':
        return {
          titleEn: `${dailyActionData.worstList.length} Worst Case (W) Linked Facility Accounts`,
          titleSi: `Worst Case (W) ගිණුම් ${dailyActionData.worstList.length} ක්`,
          tipEn:
            'Even if DPD is low, check the customer’s linked overdue facility (Worst Product) and coordinate settlement across both facilities.',
          tipSi:
            'DPD අඩු වුවද ගනුදෙනුකරුගේ අනෙක් හිඟ ණය ගිණුම නිරවුල් කිරීමෙන් මෙම W ගිණුම් NPL වලින් ඉවත් කර ගත හැක.',
        };
    }
  }, [actionBucket, dailyActionData]);

  return (
    <section
      aria-label="Executive Performance & Assign User Intelligence Hub"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-sm space-y-5"
    >
      {/* Top Control Bar: Dynamic Selector (RO/MO on Tabs 1/3/4, ASSIGN USER on Tab 2) */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        {activeHighlightTab === 'assign_monitor' ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <label
                htmlFor="wg-assign-user-selector"
                className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
              >
                Assign User:
              </label>
            </div>

            <select
              id="wg-assign-user-selector"
              value={selectedAssignUser}
              onChange={(e) => {
                setSelectedAssignUser(e.target.value);
                if (e.target.value !== 'ALL') {
                  setBulkTargetUser(e.target.value);
                }
              }}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-blue-300 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="ALL">
                All Assign Users ({STAFF_FOLLOWUP_NAMES.length}) · {evaluatedAssignContracts.length} Assigned
              </option>
              {assignUserCards.map((u) => (
                <option key={u.staffName} value={u.staffName}>
                  {u.staffName} · {u.count} Assigned ({u.paid} Paid / {u.pending} Pending)
                </option>
              ))}
            </select>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              aria-label="Select assignment month"
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {monthOptions.map((mk) => (
                <option key={mk} value={mk}>
                  {formatMonthLabel(mk)}
                </option>
              ))}
            </select>

            {selectedAssignUser !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedAssignUser('ALL')}
                className="px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Show All 10 Users
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <label
                htmlFor="wg-officer-selector"
                className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
              >
                Select Officer (RO / MO):
              </label>
            </div>

            <select
              id="wg-officer-selector"
              value={selectedOfficer}
              onChange={(e) => onSelectOfficer(e.target.value)}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="ALL">
                All Officers — Branch Portfolio ({officerCards.length})
              </option>
              {officerCards.map((c) => (
                <option key={c.officer} value={c.officer}>
                  {c.officer} ({c.officeType}) · {c.closingNplCount} NPL ·{' '}
                  {formatCompactRs(c.closingNpl)}
                </option>
              ))}
            </select>

            {selectedOfficer !== 'ALL' && (
              <button
                type="button"
                onClick={() => onSelectOfficer('ALL')}
                className="px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Reset to All
              </button>
            )}
          </div>
        )}

        {/* Highlighted Special Menus */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveHighlightTab('cards')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
              activeHighlightTab === 'cards'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            RO / MO Cards
          </button>

          <button
            type="button"
            onClick={() => setActiveHighlightTab('assign_monitor')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
              activeHighlightTab === 'assign_monitor'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Assign User Monitor
          </button>

          <button
            type="button"
            onClick={() => setActiveHighlightTab('campaign_perf')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
              activeHighlightTab === 'campaign_perf'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <CalendarRange className="w-3.5 h-3.5" />
            Nov 26 – Mar 27
          </button>

          <button
            type="button"
            onClick={() => setActiveHighlightTab('daily_action')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
              activeHighlightTab === 'daily_action'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Daily Action Guide
          </button>
        </div>
      </div>

      {/* TAB 1: RO / MO Profile Cards (BM-Reconciled Opening & Closing NPL + 90 Ratio) */}
      {activeHighlightTab === 'cards' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Individual Officer Performance Cards (Click any card to filter dashboard)
            </span>
            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              {officerCards.length} Active Officers
            </span>
          </div>

          {officerCards.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              Upload an AERS/MRP Excel report to generate RO &amp; MO individual performance cards.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {officerCards.map((card) => {
                const isSelected = selectedOfficer === card.officer;
                const variance = (Number(card.openingNpl) || 0) - (Number(card.closingNpl) || 0);
                return (
                  <button
                    key={card.officer}
                    type="button"
                    onClick={() =>
                      onSelectOfficer(isSelected ? 'ALL' : card.officer)
                    }
                    className={`text-left p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                      isSelected
                        ? 'bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-500 ring-2 ring-emerald-500/30 shadow-md'
                        : 'bg-slate-50/70 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-700 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar
                          name={card.officer}
                          sizeClass="w-11 h-11 text-xs ring-2 ring-white dark:ring-slate-800 shadow-xs"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                            {card.officer}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                                card.roleBadge === 'MO'
                                  ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              }`}
                            >
                              {card.officeType}
                            </span>
                            {card.ratio90Pct !== undefined && (
                              <span className="text-[10px] font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                                90R: {card.ratio90Pct.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md whitespace-nowrap ${
                          variance >= 0
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}
                      >
                        {variance >= 0 ? 'Saved ' : '+'}
                        {formatCompactRs(Math.abs(variance))}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-800/80 text-xs tabular-nums">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                          Op NPL ({card.openingNplCount})
                        </span>
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {formatCompactRs(card.openingNpl)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                          Close NPL ({card.closingNplCount})
                        </span>
                        <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                          {formatCompactRs(card.closingNpl)}
                        </span>
                      </div>
                      <div className="col-span-2 p-2 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 block">
                            Next Month Borderline
                          </span>
                          <span className="font-mono font-bold text-amber-900 dark:text-amber-200">
                            {card.borderlineCount} Cases ·{' '}
                            {formatCompactRs(card.borderlineAmount)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                            Efforts
                          </span>
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                            {card.totalEfforts} ({card.effortCoveragePct}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ASSIGN USER MONITOR (Dashboard Breakdown + Name Cards + Popup Modal — NO RO/MO DETAILS) */}
      {activeHighlightTab === 'assign_monitor' && (
        <div className="space-y-5">
          {/* Bulk Assign Box + Dashboard Breakdown Side-by-Side */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Bulk Paste Form */}
            <form
              onSubmit={handleAssignBulkSubmit}
              className="lg:col-span-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Bulk Assign Contracts to User
                </span>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                  {formatMonthLabel(selectedMonth)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                <select
                  value={bulkTargetUser}
                  onChange={(e) => setBulkTargetUser(e.target.value)}
                  aria-label="Select Assign User for bulk paste"
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {STAFF_FOLLOWUP_NAMES.map((name) => {
                    const cnt = monthAssignments.filter((a) => a.staffName === name).length;
                    return (
                      <option key={name} value={name}>
                        Assign User: {name} ({cnt})
                      </option>
                    );
                  })}
                </select>

                <input
                  type="text"
                  value={assignNote}
                  onChange={(e) => setAssignNote(e.target.value)}
                  placeholder="Optional batch note (e.g. Week 2 push)"
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <textarea
                rows={4}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={'Paste 1 to 250+ CONTRACT_NO here...\ne.g. WGFBA073412, WGLVA046117'}
                className="w-full p-2.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />

              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                <span>
                  {bulkStats.total} detected · {bulkStats.matched} in AERS ·{' '}
                  <strong className="text-blue-600 dark:text-blue-400">{bulkStats.newCount} new</strong>
                </span>
                {bulkText && (
                  <button
                    type="button"
                    onClick={() => setBulkText('')}
                    className="text-slate-500 hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={bulkStats.newCount === 0}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Assign {bulkStats.newCount > 0 ? `${bulkStats.newCount} ` : ''}to {bulkTargetUser}
              </button>
            </form>

            {/* Dashboard Breakdown (Summary KPIs + Age Group Distribution + Reducing vs Worsening) */}
            <div className="lg:col-span-8 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Assign User Dashboard Breakdown —{' '}
                    {selectedAssignUser === 'ALL' ? 'All 10 Staff' : selectedAssignUser}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    High-volume summary for 250+ assigned contracts. Click any Assign User card below to open their contract popup table.
                  </p>
                </div>
                <span className="text-xs font-mono font-semibold text-blue-700 dark:text-blue-400 tabular-nums">
                  {assignDashboardBreakdown.total.toLocaleString()} Assigned
                </span>
              </div>

              {/* 4 Breakdown Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-medium uppercase text-slate-500 dark:text-slate-400 block">
                    Paid vs Pending
                  </span>
                  <div className="mt-1 text-lg font-bold font-mono text-slate-900 dark:text-slate-100">
                    {assignDashboardBreakdown.paidPct}% Paid
                  </div>
                  <div className="text-[11px] font-mono">
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      {assignDashboardBreakdown.paid} Paid
                    </span>{' '}
                    ·{' '}
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      {assignDashboardBreakdown.pending} Pend
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-medium uppercase text-slate-500 dark:text-slate-400 block">
                    Collection Achieved
                  </span>
                  <div className="mt-1 text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400">
                    {formatCompactRs(assignDashboardBreakdown.totalColl)}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {assignDashboardBreakdown.collPct}% of {formatCompactRs(assignDashboardBreakdown.totalDue)}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-medium uppercase text-slate-500 dark:text-slate-400 block">
                    Arrears Age Trend
                  </span>
                  <div className="mt-1 flex items-center gap-2 text-xs font-mono font-bold">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      ↓{assignDashboardBreakdown.reducing}
                    </span>
                    <span className="text-slate-500">={assignDashboardBreakdown.steady}</span>
                    <span className="text-rose-600 dark:text-rose-400">
                      ↑{assignDashboardBreakdown.worsening}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    Reducing · Steady · Worsening
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-medium uppercase text-slate-500 dark:text-slate-400 block">
                    Effort Status
                  </span>
                  <div className="mt-1 text-lg font-bold font-mono text-blue-700 dark:text-blue-400">
                    {assignDashboardBreakdown.totalAssignEff.toLocaleString()}
                  </div>
                  <div className="text-[11px] font-mono text-rose-600 dark:text-rose-400">
                    {assignDashboardBreakdown.zeroEff} with 0 efforts
                  </div>
                </div>
              </div>

              {/* Age-Group Distribution Breakdown Bar */}
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    Assigned Contracts by Closing Age Group
                  </span>
                  <span className="font-mono text-slate-500 dark:text-slate-400">
                    Pending Due: {formatCompactRs(assignDashboardBreakdown.totalPendingDue)}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-2 text-center tabular-nums">
                  {assignDashboardBreakdown.ageGroups.map((ag) => (
                    <div
                      key={ag.key}
                      className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800"
                    >
                      <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                        {ag.label}
                      </div>
                      <div className="mt-0.5 text-sm font-mono font-bold text-slate-900 dark:text-slate-100">
                        {ag.count}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 10 Assign User Name Cards — Click any card to open Contract Detail Popup Modal */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Assign User Performance Cards — Click any card to inspect contracts in Popup
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                No RO/MO mixing · Pure Assign User performance
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 tabular-nums">
              {assignUserCards.map((u) => {
                const isSelected = selectedAssignUser === u.staffName;
                return (
                  <button
                    key={u.staffName}
                    type="button"
                    onClick={() => {
                      setModalUser(u.staffName);
                      setModalSearch('');
                      setModalFilter('all');
                      setModalPage(1);
                      setConfirmClearModal(false);
                    }}
                    className={`text-left p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-2.5 ${
                      isSelected
                        ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/25'
                        : u.count > 0
                          ? 'bg-white dark:bg-slate-950/70 border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-sm'
                          : 'bg-slate-50/60 dark:bg-slate-950/30 border-slate-200/70 dark:border-slate-800/70 opacity-80 hover:opacity-100 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar name={u.staffName} sizeClass="w-9 h-9 text-[11px]" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {u.staffName}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            {u.count} Contracts
                          </div>
                        </div>
                      </div>
                      {u.count > 0 && (
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded ${
                            u.reducing >= u.worsening
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {u.paidPct}%
                        </span>
                      )}
                    </div>

                    {u.count > 0 ? (
                      <>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-mono">
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              ↓{u.reducing} Red.
                            </span>
                            <span className="text-slate-500">={u.steady}</span>
                            <span className="text-rose-600 dark:text-rose-400 font-semibold">
                              ↑{u.worsening} Wors.
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${Math.min(100, u.paidPct)}%` }}
                            />
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] font-mono">
                          <span className="text-slate-600 dark:text-slate-300">
                            Coll {u.collPct}%
                          </span>
                          <span
                            className={
                              u.zeroEff > 0
                                ? 'text-rose-600 dark:text-rose-400 font-semibold'
                                : 'text-blue-600 dark:text-blue-400 font-semibold'
                            }
                          >
                            {u.assignEff} Eff ({u.zeroEff} zero)
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 pt-1">
                        Click to view or paste contracts above
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Nov 2026 - Mar 2027 Campaign & Daily Locked Snapshots */}
      {activeHighlightTab === 'campaign_perf' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedCampaignMonth('ALL')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl border ${
                  selectedCampaignMonth === 'ALL'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                All Campaign Months ({safeSnapshots.length} Daily Logs)
              </button>
              {campaignSeries.map((m) => (
                <button
                  key={m.monthKey}
                  type="button"
                  onClick={() => setSelectedCampaignMonth(m.monthKey)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl border ${
                    selectedCampaignMonth === m.monthKey
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {m.label} {m.dayCount > 0 ? `(${m.dayCount}d)` : ''}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Same-day uploads overwrite today&apos;s snapshot · Next-day uploads lock prior day&apos;s last file
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 tabular-nums">
            {campaignSeries.map((m) => (
              <div
                key={m.monthKey}
                className={`p-3.5 rounded-2xl border ${
                  m.hasData
                    ? 'bg-slate-50 dark:bg-slate-950/70 border-indigo-200 dark:border-indigo-900/60'
                    : 'bg-slate-50/40 dark:bg-slate-950/30 border-dashed border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-slate-100">
                  <span>{m.label}</span>
                  <span className="text-[10px] font-mono text-slate-500">{m.snapshotDate}</span>
                </div>
                {m.hasData ? (
                  <div className="mt-2 space-y-1 text-[11px] font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Closing NPL</span>
                      <span className="font-bold text-rose-600 dark:text-rose-400">
                        {formatCompactRs(m.closingNpl)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">NPL Saved</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCompactRs(m.savedAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">90 Ratio</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        {m.ratio90Pct !== undefined
                          ? `${m.ratio90Pct.toFixed(1)}%`
                          : `${m.collectionPct.toFixed(1)}%`}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-slate-400">Awaiting daily upload</p>
                )}
              </div>
            ))}
          </div>

          {filteredDailySnapshots.length > 0 && (
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-4">Snapshot Date</th>
                    <th className="py-2.5 px-3">Last Upload File</th>
                    <th className="py-2.5 px-3 text-right">Opening NPL</th>
                    <th className="py-2.5 px-3 text-right">Closing NPL</th>
                    <th className="py-2.5 px-3 text-right">NPL Saved</th>
                    <th className="py-2.5 px-4 text-right">90 Ratio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                  {filteredDailySnapshots.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                      <td className="py-2 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {s.snapshotDate}
                        {s.uploadedAt && (
                          <span className="block text-[10px] font-normal text-slate-400">
                            {new Date(s.uploadedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                        {s.sourceFile || s.label}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                        {s.openingNpl ? formatCompactRs(s.openingNpl) : '—'}
                        {s.openingNplCount !== undefined && (
                          <span className="block text-[10px] text-slate-400">
                            {s.openingNplCount} accts
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-rose-600 dark:text-rose-400">
                        {formatCompactRs(s.branchNpl ?? s.trackedNpl)}
                        {s.closingNplCount !== undefined && (
                          <span className="block text-[10px] font-normal">
                            {s.closingNplCount} accts
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCompactRs(s.nplSavedAmount)}
                      </td>
                      <td className="py-2 px-4 text-right font-mono font-semibold text-blue-600 dark:text-blue-400">
                        {s.ratio90Pct !== undefined ? `${s.ratio90Pct.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: DAILY PRACTICAL ACTION & VARIANCE GUIDE (REAL CONTRACT LIST + USER IMAGE CARDS — NO SAMPLES) */}
      {activeHighlightTab === 'daily_action' && (
        <div className="space-y-4">
          {/* Header & Language Switcher + BM-Reconciled Opening vs Closing Summary */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <div className="space-y-1">
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Daily Practical Action &amp; Variance Guide (දෛනික ප්‍රායෝගික ක්‍රියාමාර්ග)
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono tabular-nums">
                <span className="text-slate-600 dark:text-slate-300">
                  Opening NPL: <strong>{dailyActionData.opCount} accts · {formatCompactRs(dailyActionData.opNpl)}</strong>
                </span>
                <span>→</span>
                <span className="text-rose-600 dark:text-rose-400">
                  Closing NPL: <strong>{dailyActionData.closeCount} accts · {formatCompactRs(dailyActionData.closeNpl)}</strong>
                </span>
                <span
                  className={
                    dailyActionData.netDelta >= 0
                      ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'text-rose-600 dark:text-rose-400 font-bold'
                  }
                >
                  ({dailyActionData.netDelta >= 0 ? 'Saved ' : '+'}
                  {formatCompactRs(Math.abs(dailyActionData.netDelta))})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shrink-0">
              {(
                [
                  { id: 'both', label: 'සිං + EN' },
                  { id: 'si', label: 'සිංහල' },
                  { id: 'en', label: 'English' },
                ] as const
              ).map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => setVarianceLang(lang.id)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
                    varianceLang === lang.id
                      ? 'bg-amber-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* Action Priority Bucket Selector */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 tabular-nums">
            {(
              [
                {
                  id: 'borderline' as const,
                  label: 'Borderline (61–90)',
                  subSi: 'මාස අග ආරක්ෂාව',
                  count: dailyActionData.borderlineList.length,
                  accent: 'amber',
                },
                {
                  id: 'zero_effort' as const,
                  label: '0-Effort Urgent',
                  subSi: 'අදම අමතන්න',
                  count: dailyActionData.zeroEffortList.length,
                  accent: 'rose',
                },
                {
                  id: 'newly_slipped' as const,
                  label: 'Newly Slipped NPL',
                  subSi: 'අලුතින් 91+ වූ',
                  count: dailyActionData.newlySlippedList.length,
                  accent: 'rose',
                },
                {
                  id: 'below_one' as const,
                  label: '90 Ratio (1.01+)',
                  subSi: 'Below 1 Quick Wins',
                  count: dailyActionData.belowOneList.length,
                  accent: 'emerald',
                },
                {
                  id: 'worst' as const,
                  label: 'Worst Case (W)',
                  subSi: 'විශේෂ අවධානය',
                  count: dailyActionData.worstList.length,
                  accent: 'rose',
                },
              ]
            ).map((b) => {
              const active = actionBucket === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setActionBucket(b.id);
                    setActionOfficerFilter('ALL');
                    setActionPage(1);
                  }}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-blue-600 dark:border-blue-600 shadow-xs'
                      : 'bg-white dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold truncate">{b.label}</span>
                    <span
                      className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {b.count}
                    </span>
                  </div>
                  <div
                    className={`mt-0.5 text-[10px] truncate ${
                      active ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {b.subSi}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Bilingual Practical Action Callout */}
          <div className="p-4 rounded-2xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 space-y-1.5">
            {(varianceLang === 'both' || varianceLang === 'en') && (
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {activeBucketCopy.titleEn}
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">
                  {activeBucketCopy.tipEn}
                </p>
              </div>
            )}
            {(varianceLang === 'both' || varianceLang === 'si') && (
              <div className={varianceLang === 'both' ? 'pt-1.5 border-t border-amber-200/70 dark:border-amber-900/40' : ''}>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {activeBucketCopy.titleSi}
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">
                  {activeBucketCopy.tipSi}
                </p>
              </div>
            )}
          </div>

          {/* Officer Image Cards Strip for Active Bucket */}
          {actionOfficerSummaries.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Filter Contract List by Officer Image Card
                </span>
                {actionOfficerFilter !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => {
                      setActionOfficerFilter('ALL');
                      setActionPage(1);
                    }}
                    className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
                  >
                    Show All Officers ({activeActionRows.length})
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 tabular-nums">
                {actionOfficerSummaries.map((off) => {
                  const active = actionOfficerFilter === off.officer;
                  return (
                    <button
                      key={off.officer}
                      type="button"
                      onClick={() => {
                        setActionOfficerFilter((prev) =>
                          prev === off.officer ? 'ALL' : off.officer,
                        );
                        setActionPage(1);
                      }}
                      className={`text-left p-2.5 rounded-xl border transition-all flex items-center gap-2.5 ${
                        active
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/25'
                          : 'bg-white dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-emerald-400'
                      }`}
                    >
                      <UserAvatar name={off.officer} sizeClass="w-9 h-9 text-[11px] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {off.officer}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                          {off.count} accts · {off.zeroEff} 0-eff
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Full Real Contract List (Searchable & Paginated — NO 3-contract sample!) */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-3.5 bg-slate-50/70 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                Action Contract List ({filteredActionRows.length.toLocaleString()} Contracts
                {actionOfficerFilter !== 'ALL' ? ` · ${actionOfficerFilter}` : ''})
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={actionSearch}
                  onChange={(e) => {
                    setActionSearch(e.target.value);
                    setActionPage(1);
                  }}
                  placeholder="Search contract, client, officer..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {pagedActionRows.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                No contracts in this action category for the selected filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 px-4">Contract &amp; Client</th>
                      <th className="py-2.5 px-3">Officer</th>
                      <th className="py-2.5 px-3 text-right">DPD / Age</th>
                      <th className="py-2.5 px-3 text-right">Exposure / Gap</th>
                      <th className="py-2.5 px-3 text-right">Efforts</th>
                      <th className="py-2.5 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                    {pagedActionRows.map((row) => (
                      <tr
                        key={`${actionBucket}_${row.contractNo}`}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                      >
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                              {row.contractNo}
                            </span>
                            {row.worstProduct && (
                              <WorstCaseProductBadge
                                product={row.worstProduct}
                                compact={true}
                              />
                            )}
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate max-w-[220px]">
                            {row.cusName}
                          </div>
                          <PaymentPatternStrip
                            mrp={mrpMap?.get(normalizeContractNo(row.contractNo))}
                            lastPaidAmount={row.lastPaidAmount}
                            lastPayDate={row.lastPayDate}
                            totalCollection={row.totalCollection}
                            compact={true}
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <UserAvatar name={row.officer} sizeClass="w-7 h-7 text-[10px]" />
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                {row.officer}
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                {row.officeType}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          <span
                            className={`font-semibold ${
                              row.dpd >= 91
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            {row.dpd} DPD
                          </span>
                          <span className="block text-[10px] text-slate-500">
                            Age {row.ageText}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {row.primaryAmount}
                          </span>
                          <span className="block text-[10px] text-slate-500">
                            Debtor {row.secondaryAmount}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          <span
                            className={
                              row.efforts <= 0
                                ? 'text-rose-600 dark:text-rose-400 font-bold'
                                : 'text-emerald-700 dark:text-emerald-400 font-semibold'
                            }
                          >
                            {row.efforts} / {row.totalEfforts}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded border ${
                              row.badgeTone === 'emerald'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                : row.badgeTone === 'blue'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                                  : row.badgeTone === 'amber'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                                    : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                            }`}
                          >
                            {row.badgeText}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {actionTotalPages > 1 && (
              <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex items-center justify-between text-xs">
                <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                  Page {actionPage} of {actionTotalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={actionPage <= 1}
                    onClick={() => setActionPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={actionPage >= actionTotalPages}
                    onClick={() => setActionPage((p) => Math.min(actionTotalPages, p + 1))}
                    className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* POPUP MODAL FOR ASSIGN USER CONTRACT DETAILS (Opened ONLY when clicking a Name Card in Tab 2) */}
      {modalUser && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${modalUser} Assigned Contracts Detail`}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
          onClick={() => setModalUser(null)}
        >
          <div
            className="w-full max-w-5xl max-h-[88vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-950/70">
              <div className="flex items-center gap-3">
                <UserAvatar name={modalUser} sizeClass="w-11 h-11 text-xs" />
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {modalUser} — Assigned Follow-Up Contracts ({modalContracts.length})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatMonthLabel(selectedMonth)} · Arrears Age Movement (Reducing ↓ vs Worsening ↑) &amp; Effort Status
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {evaluatedAssignContracts.some((c) => c.assignment.staffName === modalUser) && (
                  confirmClearModal ? (
                    <div className="inline-flex items-center gap-1.5 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          onClearStaffMonth(modalUser, selectedMonth);
                          setConfirmClearModal(false);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700"
                      >
                        Confirm Clear All
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClearModal(false)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmClearModal(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear Month
                    </button>
                  )
                )}
                <button
                  type="button"
                  onClick={() => setModalUser(null)}
                  aria-label="Close modal"
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Filters */}
            <div className="px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg">
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'reducing', label: 'Reducing ↓' },
                    { id: 'worsening', label: 'Worsening ↑' },
                    { id: 'paid', label: 'Paid' },
                    { id: 'pending', label: 'Pending' },
                    { id: 'zero_effort', label: '0 Efforts' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setModalFilter(f.id);
                      setModalPage(1);
                    }}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                      modalFilter === f.id
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={(e) => {
                    setModalSearch(e.target.value);
                    setModalPage(1);
                  }}
                  placeholder="Search contract or client..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            {/* Modal Contract Table (Exact 4 columns: Contract & Client | DPD / Debtor | Call / Effort Status | Age Trend & Action) */}
            <div className="flex-1 overflow-y-auto">
              {pagedModalContracts.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
                  No contracts assigned to <strong>{modalUser}</strong> matching this filter. Close this popup and paste contracts into the Bulk Assign box above.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-2.5 px-4">Contract &amp; Client</th>
                      <th className="py-2.5 px-3 text-right">DPD / Debtor</th>
                      <th className="py-2.5 px-3">Call / Effort Status</th>
                      <th className="py-2.5 px-4 text-right">Age Trend &amp; Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                    {pagedModalContracts.map((item) => (
                      <tr
                        key={`${item.assignment.monthKey}_${item.assignment.contractNo}`}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                      >
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                              {item.assignment.contractNo}
                            </span>
                            {item.isWorst && (
                              <WorstCaseProductBadge
                                product={item.worstCaseProduct}
                                nplReason={item.nplReason}
                                compact={true}
                              />
                            )}
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate max-w-[240px]">
                            {item.cusName}
                          </div>
                          <PaymentPatternStrip
                            mrp={mrpMap?.get(normalizeContractNo(item.assignment.contractNo))}
                            lastPaidAmount={item.lastPaidAmount}
                            lastPayDate={item.lastPayDate}
                            totalCollection={item.totalCollection}
                            compact={true}
                          />
                          <div className="mt-1 flex items-center gap-2 text-[10px]">
                            {item.isPaid ? (
                              <span className="inline-flex items-center gap-0.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                                <CheckCircle2 className="w-3 h-3" />
                                Paid {formatCompactRs(item.totalCollection)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-400 font-semibold">
                                <Clock className="w-3 h-3" />
                                Pending {formatCompactRs(item.pendingDue)}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono">
                          <span
                            className={`font-bold ${
                              item.dpd >= 91
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {item.dpd} DPD
                          </span>
                          <div className="text-[11px] text-slate-700 dark:text-slate-300">
                            {formatCurrencyRs(item.closingDebtor)}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Age: {item.opAge.toFixed(2)} → {item.closingAge.toFixed(2)}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 min-w-[180px]">
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            {item.assignEfforts > 0 ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                                <PhoneCall className="w-3 h-3" />
                                {item.assignEfforts} Assign / {item.totalEfforts} Total
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
                                <AlertTriangle className="w-3 h-3" />
                                0 Efforts Given
                              </span>
                            )}
                            <span className="font-mono text-[10px] text-slate-500">
                              {item.effortPct}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                item.assignEfforts > 0 ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${Math.max(6, item.effortPct)}%` }}
                            />
                          </div>
                        </td>

                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            {item.trend === 'reducing' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                                <ArrowDownRight className="w-3.5 h-3.5" />
                                Reducing ({item.ageVariance.toFixed(2)})
                              </span>
                            ) : item.trend === 'worsening' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded border bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800">
                                <ArrowUpRight className="w-3.5 h-3.5" />
                                Worsening (+{item.ageVariance.toFixed(2)})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded border bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                                <ArrowRight className="w-3.5 h-3.5" />
                                Steady ({item.ageVariance >= 0 ? '+' : ''}
                                {item.ageVariance.toFixed(2)})
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                onRemoveStaffAssignment(
                                  item.assignment.staffName,
                                  item.assignment.monthKey,
                                  item.assignment.contractNo,
                                )
                              }
                              title="Remove from Assign User"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Pagination Footer */}
            {modalTotalPages > 1 && (
              <div className="px-4 sm:px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex items-center justify-between text-xs">
                <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                  Page {modalPage} of {modalTotalPages} ({modalContracts.length} contracts)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={modalPage <= 1}
                    onClick={() => setModalPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={modalPage >= modalTotalPages}
                    onClick={() => setModalPage((p) => Math.min(modalTotalPages, p + 1))}
                    className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
