import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  ClipboardCheck,
  History,
  Layers,
  PhoneCall,
  Plus,
  Save,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  STAFF_FOLLOWUP_NAMES,
  type AersRecord,
  type MonthlySnapshot,
  type MrpEnrichment,
  type StaffAssignedContract,
} from '../types/recovery';
import {
  CAMPAIGN_MONTHS,
  formatCompactRs,
  formatCurrencyRs,
  getTodayISO,
  isWorstCategory,
  normalizeContractNo,
} from '../utils/recoveryEngine';
import { useLanguage } from '../contexts/LanguageContext';
import { OfficerPerformanceHeatmap } from './OfficerPerformanceHeatmap';
import { PaymentPatternStrip } from './PaymentPatternStrip';
import { UserAvatar } from './UserAvatar';
import { WorstCaseProductBadge } from './WorstCaseProductBadge';

interface StaffFollowUpMonitorPanelProps {
  aersRecords: AersRecord[];
  mrpMap?: Map<string, MrpEnrichment>;
  assignments: StaffAssignedContract[];
  monthlySnapshots?: MonthlySnapshot[];
  isDark: boolean;
  isAdmin?: boolean;
  onAssignBulk: (newItems: StaffAssignedContract[]) => void;
  onRemoveAssignment: (staffName: string, monthKey: string, contractNo: string) => void;
  onClearStaffMonth: (staffName: string, monthKey: string) => void;
  onLogTodaySnapshot?: () => void;
}

interface EvaluatedStaffContract {
  assignment: StaffAssignedContract;
  matchedInAers: boolean;
  cusName: string;
  vehicleNo: string;
  nextDueDate: string;
  lastPayDate: string;
  lastPaidAmount: number;
  currentMonthDue: number;
  totalCollection: number;
  pendingDue: number;
  collectionPct: number;
  isPaid: boolean;
  opAge: number;
  closingAge: number;
  ageVariance: number;
  trend: 'reducing' | 'steady' | 'worsening';
  actualDpd: number;
  closingDebtor: number;
  closingNpl: number;
  assignEfforts: number;
  totalEfforts: number;
  effortPct: number;
  isWorst: boolean;
  nplReason: string;
  worstCaseProduct: string;
}

interface StaffMemberStats {
  staffName: string;
  assignedCount: number;
  paidCount: number;
  pendingCount: number;
  paymentHitPct: number;
  totalDue: number;
  totalCollection: number;
  totalPendingDue: number;
  collectionPct: number;
  avgOpAge: number;
  avgClosingAge: number;
  avgAgeVariance: number;
  reducingCount: number;
  steadyCount: number;
  worseningCount: number;
  assignEfforts: number;
  zeroEffortCount: number;
  overallTrend: 'reducing' | 'steady' | 'worsening' | 'idle';
}

function getDefaultMonthKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
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

const PAGE_SIZE = 25;

export function StaffFollowUpMonitorPanel({
  aersRecords,
  mrpMap,
  assignments,
  monthlySnapshots = [],
  isDark,
  isAdmin = false,
  onAssignBulk,
  onRemoveAssignment,
  onClearStaffMonth,
  onLogTodaySnapshot,
}: StaffFollowUpMonitorPanelProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getDefaultMonthKey());
  const [assignStaff, setAssignStaff] = useState<string>(STAFF_FOLLOWUP_NAMES[0]);
  const [bulkInput, setBulkInput] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [showAssignForm, setShowAssignForm] = useState(true);

  const [filterStaff, setFilterStaff] = useState<string>('ALL');
  const [modalStaff, setModalStaff] = useState<string | null>(null);
  const [modalFilter, setModalFilter] = useState<
    'all' | 'paid' | 'pending' | 'reducing' | 'worsening' | 'zero_effort'
  >('all');
  const [modalSearch, setModalSearch] = useState('');
  const [modalPage, setModalPage] = useState(1);
  const [confirmClearModal, setConfirmClearModal] = useState(false);

  const monthOptions = useMemo(() => {
    const keys = new Set<string>([getDefaultMonthKey()]);
    CAMPAIGN_MONTHS.forEach((m) => keys.add(m.monthKey));
    assignments.forEach((a) => {
      if (a.monthKey) keys.add(a.monthKey);
    });
    return Array.from(keys).sort();
  }, [assignments]);

  const aersByNo = useMemo(() => {
    const map = new Map<string, AersRecord>();
    aersRecords.forEach((r) => {
      if (r && r.contractNo) {
        map.set(normalizeContractNo(r.contractNo), r);
      }
    });
    return map;
  }, [aersRecords]);

  const monthAssignments = useMemo(
    () => assignments.filter((a) => a.monthKey === selectedMonth),
    [assignments, selectedMonth],
  );

  const parsedBulkTokens = useMemo(() => {
    const tokens = bulkInput
      .split(/[\s,;|\t\n\r]+/)
      .map((t) => normalizeContractNo(t))
      .filter((t) => t.length >= 4);
    return Array.from(new Set(tokens));
  }, [bulkInput]);

  const existingForStaffMonth = useMemo(() => {
    const set = new Set<string>();
    monthAssignments
      .filter((a) => a.staffName === assignStaff)
      .forEach((a) => set.add(normalizeContractNo(a.contractNo)));
    return set;
  }, [monthAssignments, assignStaff]);

  const bulkPreview = useMemo(() => {
    let matchedAers = 0;
    let duplicates = 0;
    let newCount = 0;

    parsedBulkTokens.forEach((tok) => {
      if (aersByNo.has(tok)) matchedAers += 1;
      if (existingForStaffMonth.has(tok)) {
        duplicates += 1;
      } else {
        newCount += 1;
      }
    });

    return {
      total: parsedBulkTokens.length,
      matchedAers,
      duplicates,
      newCount,
    };
  }, [parsedBulkTokens, aersByNo, existingForStaffMonth]);

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedBulkTokens.length === 0) return;

    const today = getTodayISO();
    const itemsToAdd: StaffAssignedContract[] = [];

    parsedBulkTokens.forEach((tok) => {
      if (existingForStaffMonth.has(tok)) return;
      const aers = aersByNo.get(tok);
      const opAge = Number(aers?.opAge ?? aers?.currentAge) || 0;
      const due = Number(aers?.currentMonthDue || aers?.dueBudgetMonth) || 0;
      const coll = Number(aers?.totalCollection) || 0;

      itemsToAdd.push({
        contractNo: aers?.contractNo ?? tok,
        staffName: assignStaff,
        monthKey: selectedMonth,
        assignedAt: today,
        assignedOpAge: opAge,
        assignedDebtor: Number(aers?.closingDebtor) || 0,
        assignedNpl: Number(aers?.npl) || 0,
        assignedDue: due,
        assignedCollection: coll,
        note: assignNote.trim() || undefined,
      });
    });

    if (itemsToAdd.length > 0) {
      onAssignBulk(itemsToAdd);
      setBulkInput('');
      setAssignNote('');
      setFilterStaff(assignStaff);
    }
  };

  const evaluatedContracts = useMemo<EvaluatedStaffContract[]>(() => {
    return monthAssignments.map((assignment) => {
      const key = normalizeContractNo(assignment.contractNo);
      const aers = aersByNo.get(key);

      const currentMonthDue =
        Number(aers?.currentMonthDue || aers?.dueBudgetMonth || assignment.assignedDue) || 0;
      const totalCollection = Number(aers?.totalCollection ?? 0) || 0;
      const lastPaidAmount = Number(aers?.lastPaidAmount ?? 0) || 0;
      const lastPayDate = aers?.lastPayDate || '';
      const hasRecentPayDate = Boolean(
        lastPayDate &&
        (lastPayDate.includes('Nov') ||
         lastPayDate.startsWith('2026-11') ||
         lastPayDate.includes('2026') ||
         lastPayDate.includes('Oct') ||
         lastPayDate.startsWith('2026-10')),
      );

      const isPaid = totalCollection > 0 || lastPaidAmount > 0 || hasRecentPayDate;
      const pendingDue = Math.max(0, currentMonthDue - totalCollection);
      const collectionPct =
        currentMonthDue > 0
          ? Math.min(150, Math.round((totalCollection / currentMonthDue) * 100))
          : isPaid
            ? 100
            : 0;

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

      const nplReason = aers?.nplReason || '';
      const worstCaseProduct = aers?.worstCaseProduct || '';

      return {
        assignment,
        matchedInAers: Boolean(aers),
        cusName: aers?.cusName || 'Not in latest AERS',
        vehicleNo: aers?.currentStock || '',
        nextDueDate: aers?.nextDueDate || '',
        lastPayDate,
        lastPaidAmount,
        currentMonthDue,
        totalCollection,
        pendingDue,
        collectionPct,
        isPaid,
        opAge,
        closingAge,
        ageVariance,
        trend,
        actualDpd: Number(aers?.actualDpd ?? 0) || 0,
        closingDebtor: Number(aers?.closingDebtor ?? assignment.assignedDebtor) || 0,
        closingNpl: Number(aers?.npl ?? assignment.assignedNpl) || 0,
        assignEfforts,
        totalEfforts,
        effortPct,
        isWorst: isWorstCategory(nplReason, worstCaseProduct),
        nplReason,
        worstCaseProduct,
      };
    });
  }, [monthAssignments, aersByNo]);

  const staffStatsList = useMemo<StaffMemberStats[]>(() => {
    return STAFF_FOLLOWUP_NAMES.map((staffName) => {
      const items = evaluatedContracts.filter(
        (e) => e.assignment.staffName === staffName,
      );
      const assignedCount = items.length;
      const paidCount = items.filter((i) => i.isPaid).length;
      const pendingCount = assignedCount - paidCount;
      const paymentHitPct =
        assignedCount > 0 ? Math.round((paidCount / assignedCount) * 100) : 0;

      const totalDue = items.reduce((s, i) => s + i.currentMonthDue, 0);
      const totalCollection = items.reduce((s, i) => s + i.totalCollection, 0);
      const totalPendingDue = items.reduce((s, i) => s + i.pendingDue, 0);
      const collectionPct =
        totalDue > 0
          ? Math.round((totalCollection / totalDue) * 100)
          : paidCount > 0
            ? 100
            : 0;

      const avgOpAge =
        assignedCount > 0
          ? items.reduce((s, i) => s + i.opAge, 0) / assignedCount
          : 0;
      const avgClosingAge =
        assignedCount > 0
          ? items.reduce((s, i) => s + i.closingAge, 0) / assignedCount
          : 0;
      const avgAgeVariance = Number((avgClosingAge - avgOpAge).toFixed(2));

      const reducingCount = items.filter((i) => i.trend === 'reducing').length;
      const steadyCount = items.filter((i) => i.trend === 'steady').length;
      const worseningCount = items.filter((i) => i.trend === 'worsening').length;
      const assignEfforts = items.reduce((s, i) => s + i.assignEfforts, 0);
      const zeroEffortCount = items.filter((i) => i.assignEfforts <= 0).length;

      let overallTrend: StaffMemberStats['overallTrend'] = 'idle';
      if (assignedCount > 0) {
        if (avgAgeVariance < 0 || reducingCount > worseningCount) {
          overallTrend = 'reducing';
        } else if (worseningCount > reducingCount || paymentHitPct < 30) {
          overallTrend = 'worsening';
        } else {
          overallTrend = 'steady';
        }
      }

      return {
        staffName,
        assignedCount,
        paidCount,
        pendingCount,
        paymentHitPct,
        totalDue,
        totalCollection,
        totalPendingDue,
        collectionPct,
        avgOpAge,
        avgClosingAge,
        avgAgeVariance,
        reducingCount,
        steadyCount,
        worseningCount,
        assignEfforts,
        zeroEffortCount,
        overallTrend,
      };
    });
  }, [evaluatedContracts]);

  const activeStaffChartData = useMemo(() => {
    return staffStatsList
      .filter((s) => s.assignedCount > 0)
      .map((s) => ({
        name: s.staffName,
        dueK: Number((s.totalDue / 1000).toFixed(1)),
        collectedK: Number((s.totalCollection / 1000).toFixed(1)),
      }));
  }, [staffStatsList]);

  const kpiTotals = useMemo(() => {
    const base =
      filterStaff === 'ALL'
        ? evaluatedContracts
        : evaluatedContracts.filter((e) => e.assignment.staffName === filterStaff);

    const assigned = base.length;
    const paid = base.filter((i) => i.isPaid).length;
    const pending = assigned - paid;
    const totalDue = base.reduce((s, i) => s + i.currentMonthDue, 0);
    const totalCollection = base.reduce((s, i) => s + i.totalCollection, 0);
    const totalPendingDue = base.reduce((s, i) => s + i.pendingDue, 0);
    const collectionPct =
      totalDue > 0 ? Math.round((totalCollection / totalDue) * 100) : paid > 0 ? 100 : 0;
    const avgOpAge =
      assigned > 0 ? base.reduce((s, i) => s + i.opAge, 0) / assigned : 0;
    const avgClosingAge =
      assigned > 0 ? base.reduce((s, i) => s + i.closingAge, 0) / assigned : 0;
    const avgVariance = Number((avgClosingAge - avgOpAge).toFixed(2));
    const reducing = base.filter((i) => i.trend === 'reducing').length;
    const steady = base.filter((i) => i.trend === 'steady').length;
    const worsening = base.filter((i) => i.trend === 'worsening').length;

    const ageBuckets = [
      { label: '≤ 1.00', count: 0 },
      { label: '1.01 – 1.99', count: 0 },
      { label: '2.00 – 2.99', count: 0 },
      { label: '3.00 – 5.99', count: 0 },
      { label: '6.00+', count: 0 },
    ];
    base.forEach((i) => {
      if (i.closingAge <= 1.0) ageBuckets[0].count += 1;
      else if (i.closingAge < 2.0) ageBuckets[1].count += 1;
      else if (i.closingAge < 3.0) ageBuckets[2].count += 1;
      else if (i.closingAge < 6.0) ageBuckets[3].count += 1;
      else ageBuckets[4].count += 1;
    });

    return {
      assigned,
      paid,
      pending,
      paymentHitPct: assigned > 0 ? Math.round((paid / assigned) * 100) : 0,
      totalDue,
      totalCollection,
      totalPendingDue,
      collectionPct,
      avgOpAge,
      avgClosingAge,
      avgVariance,
      reducing,
      steady,
      worsening,
      ageBuckets,
    };
  }, [evaluatedContracts, filterStaff]);

  const modalContracts = useMemo(() => {
    if (!modalStaff) return [];
    const q = modalSearch.trim().toLowerCase();
    return evaluatedContracts.filter((item) => {
      if (item.assignment.staffName !== modalStaff) return false;
      if (modalFilter === 'paid' && !item.isPaid) return false;
      if (modalFilter === 'pending' && item.isPaid) return false;
      if (modalFilter === 'reducing' && item.trend !== 'reducing') return false;
      if (modalFilter === 'worsening' && item.trend !== 'worsening') return false;
      if (modalFilter === 'zero_effort' && item.assignEfforts > 0) return false;
      if (!q) return true;
      return (
        item.assignment.contractNo.toLowerCase().includes(q) ||
        item.cusName.toLowerCase().includes(q) ||
        item.vehicleNo.toLowerCase().includes(q)
      );
    });
  }, [evaluatedContracts, modalStaff, modalFilter, modalSearch]);

  const modalTotalPages = Math.max(1, Math.ceil(modalContracts.length / PAGE_SIZE));
  const pagedModalContracts = modalContracts.slice(
    (modalPage - 1) * PAGE_SIZE,
    modalPage * PAGE_SIZE,
  );

  const historyTimeline = useMemo(() => {
    const todayIso = getTodayISO();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    const cutoffIso = cutoffDate.toISOString().slice(0, 10);

    interface DailyHistoryRow {
      date: string;
      shortDate: string;
      officerScope: string;
      assignedCount: number;
      paidCount: number;
      pendingCount: number;
      totalDue: number;
      totalCollection: number;
      totalCollectionK: number;
      collectionPct: number;
      avgClosingAge: number;
      assignEfforts: number;
      dayDelta: number | null;
      source: 'snapshot' | 'live' | 'branch_est';
    }

    const rawRows: Omit<DailyHistoryRow, 'dayDelta'>[] = [];
    const seenDates = new Set<string>();

    const recentSnapshots = [...monthlySnapshots]
      .filter((s) => s.snapshotDate && s.snapshotDate >= cutoffIso)
      .sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));

    for (const snap of recentSnapshots) {
      const dateStr = snap.snapshotDate;
      const shortDate = dateStr.length >= 10 ? dateStr.slice(5) : dateStr;
      const staffStatsMap = snap.staffDailyStats;

      if (staffStatsMap && Object.keys(staffStatsMap).length > 0) {
        if (filterStaff === 'ALL') {
          const allEntries = Object.values(staffStatsMap);
          const assignedCount = allEntries.reduce((s, e) => s + e.assignedCount, 0);
          const paidCount = allEntries.reduce((s, e) => s + e.paidCount, 0);
          const pendingCount = allEntries.reduce((s, e) => s + e.pendingCount, 0);
          const totalDue = allEntries.reduce((s, e) => s + e.totalDue, 0);
          const totalCollection = allEntries.reduce((s, e) => s + e.totalCollection, 0);
          const assignEfforts = allEntries.reduce((s, e) => s + e.assignEfforts, 0);
          const avgClosingAge =
            assignedCount > 0
              ? Number(
                  (
                    allEntries.reduce(
                      (s, e) => s + e.avgClosingAge * e.assignedCount,
                      0,
                    ) / assignedCount
                  ).toFixed(2),
                )
              : 0;
          const collectionPct =
            totalDue > 0 ? Math.round((totalCollection / totalDue) * 100) : 0;

          rawRows.push({
            date: dateStr,
            shortDate,
            officerScope: `All Assigned (${allEntries.filter((e) => e.assignedCount > 0).length})`,
            assignedCount,
            paidCount,
            pendingCount,
            totalDue,
            totalCollection,
            totalCollectionK: Number((totalCollection / 1000).toFixed(1)),
            collectionPct,
            avgClosingAge,
            assignEfforts,
            source: 'snapshot',
          });
          seenDates.add(dateStr);
        } else {
          const entry = staffStatsMap[filterStaff];
          if (entry) {
            rawRows.push({
              date: dateStr,
              shortDate,
              officerScope: filterStaff,
              assignedCount: entry.assignedCount,
              paidCount: entry.paidCount,
              pendingCount: entry.pendingCount,
              totalDue: entry.totalDue,
              totalCollection: entry.totalCollection,
              totalCollectionK: Number((entry.totalCollection / 1000).toFixed(1)),
              collectionPct: entry.collectionPct,
              avgClosingAge: entry.avgClosingAge,
              assignEfforts: entry.assignEfforts,
              source: 'snapshot',
            });
            seenDates.add(dateStr);
          }
        }
      } else if (filterStaff === 'ALL' && snap.collectionPct > 0) {
        const estColl = Math.round((kpiTotals.totalDue * snap.collectionPct) / 100);
        rawRows.push({
          date: dateStr,
          shortDate,
          officerScope: 'Branch Historical Snapshot',
          assignedCount: kpiTotals.assigned || snap.trackedCount,
          paidCount: Math.round(((kpiTotals.assigned || 0) * snap.collectionPct) / 100),
          pendingCount: Math.max(
            0,
            (kpiTotals.assigned || 0) -
              Math.round(((kpiTotals.assigned || 0) * snap.collectionPct) / 100),
          ),
          totalDue: kpiTotals.totalDue,
          totalCollection: estColl,
          totalCollectionK: Number((estColl / 1000).toFixed(1)),
          collectionPct: Math.round(snap.collectionPct),
          avgClosingAge: Number(kpiTotals.avgClosingAge.toFixed(2)),
          assignEfforts: 0,
          source: 'branch_est',
        });
        seenDates.add(dateStr);
      }
    }

    if (!seenDates.has(todayIso) && kpiTotals.assigned > 0) {
      const liveEfforts =
        filterStaff === 'ALL'
          ? staffStatsList.reduce((s, st) => s + st.assignEfforts, 0)
          : staffStatsList.find((st) => st.staffName === filterStaff)?.assignEfforts ?? 0;

      rawRows.push({
        date: todayIso,
        shortDate: todayIso.slice(5),
        officerScope: filterStaff === 'ALL' ? 'All Assigned (Live)' : filterStaff,
        assignedCount: kpiTotals.assigned,
        paidCount: kpiTotals.paid,
        pendingCount: kpiTotals.pending,
        totalDue: kpiTotals.totalDue,
        totalCollection: kpiTotals.totalCollection,
        totalCollectionK: Number((kpiTotals.totalCollection / 1000).toFixed(1)),
        collectionPct: kpiTotals.collectionPct,
        avgClosingAge: Number(kpiTotals.avgClosingAge.toFixed(2)),
        assignEfforts: liveEfforts,
        source: 'live',
      });
    }

    rawRows.sort((a, b) => a.date.localeCompare(b.date));

    return rawRows.map((row, idx): DailyHistoryRow => {
      const prev = idx > 0 ? rawRows[idx - 1] : null;
      return {
        ...row,
        dayDelta: prev ? row.totalCollection - prev.totalCollection : null,
      };
    });
  }, [monthlySnapshots, filterStaff, kpiTotals, staffStatsList]);

  const historySummary = useMemo(() => {
    if (historyTimeline.length === 0) {
      return {
        daysLogged: 0,
        latestCollection: 0,
        latestPct: 0,
        peakCollection: 0,
        peakDate: '—',
        periodGrowth: 0,
      };
    }
    const first = historyTimeline[0];
    const latest = historyTimeline[historyTimeline.length - 1];
    let peak = first;
    for (const row of historyTimeline) {
      if (row.totalCollection >= peak.totalCollection) peak = row;
    }
    return {
      daysLogged: historyTimeline.length,
      latestCollection: latest.totalCollection,
      latestPct: latest.collectionPct,
      peakCollection: peak.totalCollection,
      peakDate: peak.date,
      periodGrowth: latest.totalCollection - first.totalCollection,
    };
  }, [historyTimeline]);

  const axisColor = isDark ? '#a1a1aa' : '#52525b';
  const gridColor = isDark ? '#27272a' : '#e4e4e7';
  const tooltipBg = isDark ? '#18181b' : '#ffffff';
  const tooltipBorder = isDark ? '#3f3f46' : '#e4e4e7';

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0" />
              <h2 className="font-display text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Assign User Follow-Up &amp; Performance Dashboard
              </h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-3xl leading-relaxed">
              Assign bulk contracts (250+ supported) to your 10 Assign Users, inspect contract-level popups, or audit 30-day chronological collection history.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <select
              value={filterStaff}
              onChange={(e) => setFilterStaff(e.target.value)}
              aria-label="Filter dashboard by Assign User"
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-900/70 bg-red-50/60 dark:bg-red-950/30 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-600"
            >
              <option value="ALL">Assign User: All ({STAFF_FOLLOWUP_NAMES.length})</option>
              {STAFF_FOLLOWUP_NAMES.map((name) => (
                <option key={name} value={name}>
                  Assign User: {name}
                </option>
              ))}
            </select>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              aria-label="Select follow-up assignment month"
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-600"
            >
              {monthOptions.map((mk) => (
                <option key={mk} value={mk}>
                  Month: {formatMonthLabel(mk)}
                </option>
              ))}
            </select>

            {activeTab === 'overview' && (
              <button
                type="button"
                onClick={() => setShowAssignForm((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  showAssignForm
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-red-700 text-white hover:bg-red-800'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                {showAssignForm ? 'Hide Bulk Assign' : 'Assign Bulk Contracts'}
              </button>
            )}
          </div>
        </div>

        {/* Sub-Tab Bar: Overview vs Performance History (30d) */}
        <div className="pt-3 border-t border-zinc-200/80 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Assign User Dashboard Tabs"
            className="inline-flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'bg-red-700 text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              {t('tabOverviewCards')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'history'}
              onClick={() => setActiveTab('history')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'history'
                  ? 'bg-red-700 text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              {t('tabPerfHistory')}
              <span
                className={`ml-0.5 px-1.5 py-0.5 text-[10px] font-mono rounded-md ${
                  activeTab === 'history'
                    ? 'bg-white/20 text-white'
                    : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                {historyTimeline.length}d
              </span>
            </button>
          </div>

          {activeTab === 'history' && isAdmin && onLogTodaySnapshot && (
            <button
              type="button"
              onClick={onLogTodaySnapshot}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-zinc-900 dark:bg-red-700 text-white hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5" />
              {t('logTodaySnapshot')}
            </button>
          )}
        </div>
      </div>

      {activeTab === 'history' ? (
        <div className="space-y-6">
          {/* 30-Day Performance History KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 tabular-nums">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Snapshots Logged (Last 30 Days)
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
                  {historySummary.daysLogged}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">days</span>
              </div>
              <div className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                Scope: {filterStaff === 'ALL' ? 'All Assigned Officers' : filterStaff}
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Latest Logged Collection
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
                  {formatCompactRs(historySummary.latestCollection)}
                </span>
                <span className="text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                  ({historySummary.latestPct}%)
                </span>
              </div>
              <div className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                Most recent chronological record
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                30-Day Peak Collection
              </div>
              <div className="mt-2 text-xl font-bold font-mono text-red-700 dark:text-red-400">
                {formatCompactRs(historySummary.peakCollection)}
              </div>
              <div className="mt-1.5 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                Peak Date: {historySummary.peakDate}
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                30-Day Net Growth
              </div>
              <div
                className={`mt-2 text-xl font-bold font-mono ${
                  historySummary.periodGrowth >= 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {historySummary.periodGrowth >= 0 ? '+' : ''}
                {formatCompactRs(historySummary.periodGrowth)}
              </div>
              <div className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                First logged day → Latest day
              </div>
            </div>
          </div>

          {/* 30-Day Collection Trend Chart */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-red-700 dark:text-red-400" />
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    30-Day Daily Collection Trend — {filterStaff === 'ALL' ? 'All Assigned Officers' : filterStaff}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Pulled from daily AERS snapshots (Rs. Thousands collected vs. Collection % achievement)
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                Rolling 30-day window
              </span>
            </div>

            {historyTimeline.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-500 dark:text-zinc-400">
                No historical daily snapshots found for this selection yet. Upload a daily AERS workbook or click{' '}
                <strong>{t('logTodaySnapshot')}</strong> (Admin) to start tracking 30-day officer trends.
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={historyTimeline}
                    margin={{ top: 10, right: 16, left: 0, bottom: 4 }}
                  >
                    <defs>
                      <linearGradient id="staffHistCollGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#b91c1c" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#b91c1c" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis
                      dataKey="shortDate"
                      tick={{ fill: axisColor, fontSize: 11 }}
                      axisLine={{ stroke: gridColor }}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fill: axisColor, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}k`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={[0, 120]}
                      tick={{ fill: axisColor, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: tooltipBg,
                        borderColor: tooltipBorder,
                        borderRadius: '10px',
                        fontSize: '12px',
                      }}
                      formatter={(value: unknown, name: unknown) => {
                        const label = String(name);
                        if (label.includes('%')) return [`${Number(value || 0)}%`, label];
                        return [`Rs. ${Number(value || 0).toLocaleString()}k`, label];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="totalCollectionK"
                      name="Collected (Rs. k)"
                      stroke="#b91c1c"
                      strokeWidth={2.5}
                      fill="url(#staffHistCollGrad)"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="collectionPct"
                      name="Collection %"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ r: 3.5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* 30-Day Officer Collection Progress Heatmap (Recharts) */}
          <OfficerPerformanceHeatmap
            monthlySnapshots={monthlySnapshots}
            staffLiveStats={staffStatsList}
            selectedStaff={filterStaff}
            isDark={isDark}
            onSelectOfficer={(name) => setFilterStaff(name)}
          />

          {/* Chronological Daily Log Table */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Chronological Daily Collection Log (Last 30 Days)
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Day-by-day collection progression, paid ratio, and average closing age per assigned officer
                </p>
              </div>
              <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                {historyTimeline.length} daily entries
              </span>
            </div>

            {historyTimeline.length === 0 ? (
              <div className="p-10 text-center text-xs text-zinc-500 dark:text-zinc-400">
                No chronological records yet for {filterStaff === 'ALL' ? 'assigned officers' : filterStaff}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                    <tr>
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-3">Assigned Officer</th>
                      <th className="py-2.5 px-3 text-right">Assigned</th>
                      <th className="py-2.5 px-3 text-right">Paid / Pending</th>
                      <th className="py-2.5 px-3 text-right">Collection Achieved</th>
                      <th className="py-2.5 px-3 text-right">Day Change</th>
                      <th className="py-2.5 px-3 text-right">Coll %</th>
                      <th className="py-2.5 px-3 text-right">Avg Age</th>
                      <th className="py-2.5 px-4 text-right">Efforts / Tag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 tabular-nums">
                    {[...historyTimeline].reverse().map((row) => (
                      <tr
                        key={`${row.date}_${row.officerScope}`}
                        className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40"
                      >
                        <td className="py-2.5 px-4 font-mono font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                          {row.date}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-zinc-800 dark:text-zinc-200">
                          {row.officerScope}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-zinc-700 dark:text-zinc-300">
                          {row.assignedCount}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                          <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                            {row.paidCount}P
                          </span>
                          <span className="text-zinc-400 mx-1">/</span>
                          <span className="text-amber-700 dark:text-amber-400 font-semibold">
                            {row.pendingCount}U
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                          {formatCurrencyRs(row.totalCollection)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                          {row.dayDelta === null ? (
                            <span className="text-zinc-400">Baseline</span>
                          ) : row.dayDelta > 0 ? (
                            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                              +{formatCompactRs(row.dayDelta)}
                            </span>
                          ) : row.dayDelta < 0 ? (
                            <span className="text-red-600 dark:text-red-400 font-semibold">
                              {formatCompactRs(row.dayDelta)}
                            </span>
                          ) : (
                            <span className="text-zinc-500">0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          <span
                            className={`px-2 py-0.5 rounded-md font-semibold ${
                              row.collectionPct >= 75
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : row.collectionPct >= 45
                                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                  : 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                            }`}
                          >
                            {row.collectionPct}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-zinc-700 dark:text-zinc-300">
                          {row.avgClosingAge.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <span className="font-mono text-zinc-700 dark:text-zinc-300 mr-2">
                            {row.assignEfforts}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              row.source === 'live'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : row.source === 'snapshot'
                                  ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}
                          >
                            {row.source === 'live'
                              ? 'Live'
                              : row.source === 'snapshot'
                                ? 'Locked'
                                : 'Est'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
      {/* Bulk Assignment Form */}
      {showAssignForm && (
        <form
          onSubmit={handleAssignSubmit}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Assign Monthly Follow-Up Contracts (Bulk Paste)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Select an Assign User and paste contract numbers (comma, space, or line separated).
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              {formatMonthLabel(selectedMonth)} · {existingForStaffMonth.size} already assigned to {assignStaff}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-4 space-y-3">
              <div>
                <label
                  htmlFor="staff-assign-select"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Assign User
                </label>
                <select
                  id="staff-assign-select"
                  value={assignStaff}
                  onChange={(e) => setAssignStaff(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  {STAFF_FOLLOWUP_NAMES.map((name) => {
                    const count = monthAssignments.filter((a) => a.staffName === name).length;
                    return (
                      <option key={name} value={name}>
                        {name} ({count} assigned)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label
                  htmlFor="staff-assign-note"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Optional Batch Note
                </label>
                <input
                  id="staff-assign-note"
                  type="text"
                  value={assignNote}
                  onChange={(e) => setAssignNote(e.target.value)}
                  placeholder="e.g. Week 2 due-date push"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="pt-1 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={bulkPreview.newCount === 0}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors whitespace-nowrap"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Assign {bulkPreview.newCount > 0 ? `${bulkPreview.newCount} ` : ''}to {assignStaff}
                </button>
                {bulkInput.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => setBulkInput('')}
                    className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="lg:col-span-8 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label
                  htmlFor="staff-bulk-contracts"
                  className="font-medium text-slate-700 dark:text-slate-300"
                >
                  Bulk Contract Numbers
                </label>
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {bulkPreview.total} detected · {bulkPreview.matchedAers} in AERS · {bulkPreview.newCount} new
                  {bulkPreview.duplicates > 0 ? ` · ${bulkPreview.duplicates} duplicate` : ''}
                </span>
              </div>
              <textarea
                id="staff-bulk-contracts"
                rows={4}
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder={'Paste contract numbers here (supports 250+ contracts at once)...\nExample:\nWGFBA068748\nWGTWA060977, WGMBA064016'}
                className="w-full p-3 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>
        </form>
      )}

      {/* KPI Breakdown Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 tabular-nums">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Assigned Contracts · {filterStaff === 'ALL' ? 'All Users' : filterStaff}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
              {kpiTotals.assigned}
            </span>
            <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
              {kpiTotals.paymentHitPct}% Paid
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="text-emerald-700 dark:text-emerald-400 font-medium">
              {kpiTotals.paid} Paid
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-700 dark:text-amber-400 font-medium">
              {kpiTotals.pending} Pending
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Due-Date Collection Achieved
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
              {formatCompactRs(kpiTotals.totalCollection)}
            </span>
            <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
              ({kpiTotals.collectionPct}%)
            </span>
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
            Monthly Due: {formatCompactRs(kpiTotals.totalDue)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Pending Due Balance
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-amber-700 dark:text-amber-400">
            {formatCompactRs(kpiTotals.totalPendingDue)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {kpiTotals.pending} unpaid contracts pending
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Op Age → Closing Age Movement
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-xl font-bold font-mono ${
                kpiTotals.avgVariance < 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : kpiTotals.avgVariance > 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {kpiTotals.avgVariance > 0 ? '+' : ''}
              {kpiTotals.avgVariance.toFixed(2)}
            </span>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              ({kpiTotals.avgOpAge.toFixed(2)} → {kpiTotals.avgClosingAge.toFixed(2)})
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              ↓{kpiTotals.reducing} Reducing
            </span>
            <span aria-hidden="true">·</span>
            <span>={kpiTotals.steady} Steady</span>
            <span aria-hidden="true">·</span>
            <span className="text-red-600 dark:text-red-400 font-medium">
              ↑{kpiTotals.worsening} Worsening
            </span>
          </div>
        </div>
      </div>

      {/* Age-Group Breakdown Strip */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
          <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          Assigned Portfolio Breakdown by Closing Age Group
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 tabular-nums">
          {kpiTotals.ageBuckets.map((b) => (
            <div
              key={b.label}
              className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
            >
              <span className="text-xs text-slate-500 dark:text-slate-400">{b.label}</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {b.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Staff Comparison Chart */}
      {activeStaffChartData.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Assign User Due vs. Collection (Rs. Thousands)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Live comparison across active Assign Users for {formatMonthLabel(selectedMonth)}
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              {activeStaffChartData.length} of {STAFF_FOLLOWUP_NAMES.length} active
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={activeStaffChartData}
                margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: axisColor, fontSize: 11 }}
                  axisLine={{ stroke: gridColor }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: axisColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: tooltipBg,
                    borderColor: tooltipBorder,
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: unknown, name: unknown) => [
                    `Rs. ${Number(value || 0).toLocaleString()}k`,
                    String(name),
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="dueK" name="Monthly Due (k)" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="collectedK" name="Collected (k)" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 10 Assign User Name Cards — Clicking opens Contract Detail Popup Modal */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Assign User Performance Cards ({formatMonthLabel(selectedMonth)})
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Click any user card to open their contract-wise popup table (DPD / Debtor, Call / Effort Status, Arrears Age Reducing vs Worsening).
              </p>
            </div>
          </div>
          {filterStaff !== 'ALL' && (
            <button
              type="button"
              onClick={() => setFilterStaff('ALL')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              <X className="w-3.5 h-3.5" />
              Show All Users
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 tabular-nums">
          {staffStatsList.map((staff) => {
            const isSelected = filterStaff === staff.staffName;
            return (
              <button
                key={staff.staffName}
                type="button"
                onClick={() => {
                  setModalStaff(staff.staffName);
                  setModalFilter('all');
                  setModalSearch('');
                  setModalPage(1);
                  setConfirmClearModal(false);
                }}
                className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                  isSelected
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/25'
                    : staff.assignedCount > 0
                      ? 'bg-white dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600'
                      : 'bg-slate-50/70 dark:bg-slate-950/30 border-slate-200/70 dark:border-slate-800/70 opacity-75 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <UserAvatar name={staff.staffName} sizeClass="w-8 h-8 text-[10px]" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {staff.staffName}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        {staff.assignedCount} assigned
                      </div>
                    </div>
                  </div>

                  {staff.overallTrend === 'reducing' && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                      <TrendingDown className="w-3.5 h-3.5" />
                      Red.
                    </span>
                  )}
                  {staff.overallTrend === 'worsening' && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Wors.
                    </span>
                  )}
                  {staff.overallTrend === 'steady' && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                      <ArrowRight className="w-3.5 h-3.5" />
                      Steady
                    </span>
                  )}
                </div>

                {staff.assignedCount > 0 ? (
                  <>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                          {staff.paidCount} Paid
                        </span>
                        <span className="text-amber-700 dark:text-amber-400 font-medium">
                          {staff.pendingCount} Pending
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${Math.min(100, staff.paymentHitPct)}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block text-[10px]">
                          Due Coll.
                        </span>
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {staff.collectionPct}%
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 dark:text-slate-400 block text-[10px]">
                          Efforts
                        </span>
                        <span
                          className={`font-mono font-semibold ${
                            staff.zeroEffortCount > 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          {staff.assignEfforts} ({staff.zeroEffortCount} 0-eff)
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 pt-1">
                    Click to inspect or assign above
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
        </>
      )}

      {/* POPUP MODAL FOR SELECTED ASSIGN USER */}
      {modalStaff && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${modalStaff} Assigned Contracts Popup`}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
          onClick={() => setModalStaff(null)}
        >
          <div
            className="w-full max-w-5xl max-h-[88vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-950/70">
              <div className="flex items-center gap-3">
                <UserAvatar name={modalStaff} sizeClass="w-11 h-11 text-xs" />
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {modalStaff} — Assigned Contracts ({modalContracts.length})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatMonthLabel(selectedMonth)} · DPD / Debtor, Call / Effort Status, and Arrears Age Movement
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {evaluatedContracts.some((c) => c.assignment.staffName === modalStaff) && (
                  confirmClearModal ? (
                    <div className="inline-flex items-center gap-1.5 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          onClearStaffMonth(modalStaff, selectedMonth);
                          setConfirmClearModal(false);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700"
                      >
                        Confirm Clear
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
                  onClick={() => setModalStaff(null)}
                  aria-label="Close popup"
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

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
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setModalFilter(tab.id);
                      setModalPage(1);
                    }}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
                      modalFilter === tab.id
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
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

            <div className="flex-1 overflow-y-auto">
              {pagedModalContracts.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
                  No contracts assigned to <strong>{modalStaff}</strong> matching this filter.
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
                        key={`${item.assignment.staffName}_${item.assignment.monthKey}_${item.assignment.contractNo}`}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
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
                          <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate max-w-[230px]">
                            {item.cusName}
                          </div>
                          <PaymentPatternStrip
                            mrp={mrpMap?.get(normalizeContractNo(item.assignment.contractNo))}
                            lastPaidAmount={item.lastPaidAmount}
                            lastPayDate={item.lastPayDate}
                            totalCollection={item.totalCollection}
                            compact={true}
                          />
                          <div className="mt-1 text-[10px] font-mono">
                            {item.isPaid ? (
                              <span className="inline-flex items-center gap-0.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                                <CheckCircle2 className="w-3 h-3" />
                                Paid {formatCompactRs(item.totalCollection)} / Due {formatCompactRs(item.currentMonthDue)}
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
                              item.actualDpd >= 91
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {item.actualDpd} DPD
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
                                onRemoveAssignment(
                                  item.assignment.staffName,
                                  item.assignment.monthKey,
                                  item.assignment.contractNo,
                                )
                              }
                              title="Remove contract"
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
    </div>
  );
}
