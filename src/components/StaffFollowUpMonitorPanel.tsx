import { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  ClipboardCheck,
  Plus,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  STAFF_FOLLOWUP_NAMES,
  type AersRecord,
  type StaffAssignedContract,
  type TrackedContract,
} from '../types/recovery';
import {
  CAMPAIGN_MONTHS,
  formatCompactRs,
  formatCurrencyRs,
  getOfficerByOfficeType,
  getTodayISO,
  isWorstCategory,
  normalizeContractNo,
} from '../utils/recoveryEngine';
import { UserAvatar } from './UserAvatar';
import { WorstCaseProductBadge } from './WorstCaseProductBadge';

interface StaffFollowUpMonitorPanelProps {
  aersRecords: AersRecord[];
  trackedContracts: TrackedContract[];
  assignments: StaffAssignedContract[];
  isDark: boolean;
  onAssignBulk: (newItems: StaffAssignedContract[]) => void;
  onRemoveAssignment: (staffName: string, monthKey: string, contractNo: string) => void;
  onClearStaffMonth: (staffName: string, monthKey: string) => void;
}

interface EvaluatedStaffContract {
  assignment: StaffAssignedContract;
  matchedInAers: boolean;
  cusName: string;
  originalOfficer: string;
  officeType: string;
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
  trend: 'improving' | 'stable' | 'worsening';
  actualDpd: number;
  closingDebtor: number;
  closingNpl: number;
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
  improvedCount: number;
  stableCount: number;
  worsenedCount: number;
  overallTrend: 'improving' | 'stable' | 'worsening' | 'idle';
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

export function StaffFollowUpMonitorPanel({
  aersRecords,
  trackedContracts,
  assignments,
  isDark,
  onAssignBulk,
  onRemoveAssignment,
  onClearStaffMonth,
}: StaffFollowUpMonitorPanelProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getDefaultMonthKey());
  const [assignStaff, setAssignStaff] = useState<string>(STAFF_FOLLOWUP_NAMES[0]);
  const [bulkInput, setBulkInput] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [showAssignForm, setShowAssignForm] = useState(true);

  const [filterStaff, setFilterStaff] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'paid' | 'pending' | 'improving' | 'worsening'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmClearKey, setConfirmClearKey] = useState<string | null>(null);

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

  const trackedByNo = useMemo(() => {
    const map = new Map<string, TrackedContract>();
    trackedContracts.forEach((c) => {
      if (c && c.contractNo) {
        map.set(normalizeContractNo(c.contractNo), c);
      }
    });
    return map;
  }, [trackedContracts]);

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
      if (aersByNo.has(tok) || trackedByNo.has(tok)) matchedAers += 1;
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
  }, [parsedBulkTokens, aersByNo, trackedByNo, existingForStaffMonth]);

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedBulkTokens.length === 0) return;

    const today = getTodayISO();
    const itemsToAdd: StaffAssignedContract[] = [];

    parsedBulkTokens.forEach((tok) => {
      if (existingForStaffMonth.has(tok)) return;
      const aers = aersByNo.get(tok);
      const tracked = trackedByNo.get(tok);
      const opAge = Number(aers?.opAge ?? tracked?.opAge ?? aers?.currentAge ?? tracked?.currentAge) || 0;
      const due =
        Number(aers?.currentMonthDue || aers?.dueBudgetMonth || tracked?.currentMonthDue) || 0;
      const coll = Number(aers?.totalCollection ?? tracked?.totalCollection) || 0;

      itemsToAdd.push({
        contractNo: aers?.contractNo ?? tracked?.contractNo ?? tok,
        staffName: assignStaff,
        monthKey: selectedMonth,
        assignedAt: today,
        assignedOpAge: opAge,
        assignedDebtor: Number(aers?.closingDebtor ?? tracked?.closingDebtor) || 0,
        assignedNpl: Number(aers?.npl ?? tracked?.npl) || 0,
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

  // Evaluate every assigned contract in the selected month against live AERS / Watchlist
  const evaluatedContracts = useMemo<EvaluatedStaffContract[]>(() => {
    return monthAssignments.map((assignment) => {
      const key = normalizeContractNo(assignment.contractNo);
      const aers = aersByNo.get(key);
      const tracked = trackedByNo.get(key);

      const currentMonthDue =
        Number(
          aers?.currentMonthDue ||
            aers?.dueBudgetMonth ||
            tracked?.currentMonthDue ||
            assignment.assignedDue,
        ) || 0;
      const totalCollection =
        Number(aers?.totalCollection ?? tracked?.totalCollection ?? 0) || 0;
      const lastPaidAmount =
        Number(aers?.lastPaidAmount ?? tracked?.lastPaidAmount ?? 0) || 0;
      const lastPayDate = aers?.lastPayDate || tracked?.lastPayDate || '';

      const isPaid = totalCollection > 0;
      const pendingDue = Math.max(0, currentMonthDue - totalCollection);
      const collectionPct =
        currentMonthDue > 0
          ? Math.min(150, Math.round((totalCollection / currentMonthDue) * 100))
          : isPaid
            ? 100
            : 0;

      const opAge =
        Number(aers?.opAge ?? tracked?.opAge ?? assignment.assignedOpAge) || 0;
      const closingAge =
        Number(aers?.currentAge ?? tracked?.currentAge ?? assignment.assignedOpAge) || 0;
      const ageVariance = Number((closingAge - opAge).toFixed(2));

      let trend: 'improving' | 'stable' | 'worsening' = 'stable';
      if (ageVariance <= -0.05 || (isPaid && pendingDue <= 0 && ageVariance <= 0)) {
        trend = 'improving';
      } else if (ageVariance >= 0.05 || (!isPaid && currentMonthDue > 0 && closingAge >= 2.5)) {
        trend = 'worsening';
      }

      const nplReason = aers?.nplReason || tracked?.nplReason || '';
      const worstCaseProduct = aers?.worstCaseProduct || tracked?.worstCaseProduct || '';

      return {
        assignment,
        matchedInAers: Boolean(aers || tracked),
        cusName: aers?.cusName || tracked?.cusName || 'Not in latest AERS',
        originalOfficer: aers
          ? getOfficerByOfficeType(aers)
          : tracked
            ? getOfficerByOfficeType(tracked)
            : '—',
        officeType: aers?.officeType || tracked?.officeType || '—',
        vehicleNo: aers?.currentStock || tracked?.vehicleNo || '',
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
        actualDpd: Number(aers?.actualDpd ?? tracked?.actualDpd ?? 0) || 0,
        closingDebtor: Number(aers?.closingDebtor ?? tracked?.closingDebtor ?? assignment.assignedDebtor) || 0,
        closingNpl: Number(aers?.npl ?? tracked?.npl ?? assignment.assignedNpl) || 0,
        isWorst: isWorstCategory(nplReason, worstCaseProduct),
        nplReason,
        worstCaseProduct,
      };
    });
  }, [monthAssignments, aersByNo, trackedByNo]);

  // Compute per-staff performance metrics for all 10 roster members
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

      const improvedCount = items.filter((i) => i.trend === 'improving').length;
      const stableCount = items.filter((i) => i.trend === 'stable').length;
      const worsenedCount = items.filter((i) => i.trend === 'worsening').length;

      let overallTrend: StaffMemberStats['overallTrend'] = 'idle';
      if (assignedCount > 0) {
        if (avgAgeVariance < 0 || (paymentHitPct >= 60 && improvedCount >= worsenedCount)) {
          overallTrend = 'improving';
        } else if (worsenedCount > improvedCount || paymentHitPct < 30) {
          overallTrend = 'worsening';
        } else {
          overallTrend = 'stable';
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
        improvedCount,
        stableCount,
        worsenedCount,
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
        paidCount: s.paidCount,
        pendingCount: s.pendingCount,
        collectionPct: s.collectionPct,
      }));
  }, [staffStatsList]);

  const scopedContracts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return evaluatedContracts.filter((item) => {
      if (filterStaff !== 'ALL' && item.assignment.staffName !== filterStaff) {
        return false;
      }
      if (statusFilter === 'paid' && !item.isPaid) return false;
      if (statusFilter === 'pending' && item.isPaid) return false;
      if (statusFilter === 'improving' && item.trend !== 'improving') return false;
      if (statusFilter === 'worsening' && item.trend !== 'worsening') return false;
      if (!q) return true;
      return (
        item.assignment.contractNo.toLowerCase().includes(q) ||
        item.cusName.toLowerCase().includes(q) ||
        item.assignment.staffName.toLowerCase().includes(q) ||
        item.originalOfficer.toLowerCase().includes(q) ||
        item.vehicleNo.toLowerCase().includes(q)
      );
    });
  }, [evaluatedContracts, filterStaff, statusFilter, searchQuery]);

  // KPI totals for current view scope (ALL or selected staff)
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
    const improved = base.filter((i) => i.trend === 'improving').length;
    const stable = base.filter((i) => i.trend === 'stable').length;
    const worsened = base.filter((i) => i.trend === 'worsening').length;

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
      improved,
      stable,
      worsened,
    };
  }, [evaluatedContracts, filterStaff]);

  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#1e293b' : '#e2e8f0';
  const tooltipBg = isDark ? '#0f172a' : '#ffffff';
  const tooltipBorder = isDark ? '#334155' : '#e2e8f0';

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              Staff Monthly Follow-Up Assignment &amp; Performance Monitor
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Assign any RO or MO contract in bulk to staff members for monthly follow-up. Automatically monitors payments received vs. pending, due-date collection progress, and Op Age → Closing Age variance &amp; trend.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            aria-label="Select follow-up assignment month"
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            {monthOptions.map((mk) => (
              <option key={mk} value={mk}>
                Month: {formatMonthLabel(mk)} ({mk})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowAssignForm((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              showAssignForm
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            {showAssignForm ? 'Hide Bulk Assign' : 'Assign Bulk Contracts'}
          </button>
        </div>
      </div>

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
                Select a staff member and paste contract numbers (comma, space, or line separated). Any RO/MO contract is accepted.
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
                  Staff Member
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
                  Optional Follow-Up Note
                </label>
                <input
                  id="staff-assign-note"
                  type="text"
                  value={assignNote}
                  onChange={(e) => setAssignNote(e.target.value)}
                  placeholder="e.g. Week 2 due-date push / Borderline batch"
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
                placeholder={'Paste contract numbers here (from Excel, WhatsApp, or AERS)...\nExample:\nWGFBA068748\nWGTWA060977, WGMBA064016'}
                className="w-full p-3 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>
        </form>
      )}

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 tabular-nums">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Assigned Contracts · {filterStaff === 'ALL' ? 'All Staff' : filterStaff}
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
            {kpiTotals.pending} unpaid contracts still pending
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Op Age → Closing Age Variance
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
              {kpiTotals.improved} Improved
            </span>
            <span aria-hidden="true">·</span>
            <span>{kpiTotals.stable} Held</span>
            <span aria-hidden="true">·</span>
            <span className="text-red-600 dark:text-red-400 font-medium">
              {kpiTotals.worsened} Worsened
            </span>
          </div>
        </div>
      </div>

      {/* Staff Comparison Chart (when at least 1 staff has assignments) */}
      {activeStaffChartData.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Staff Due-Date Collection vs. Monthly Due (Rs. Thousands)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Live comparison across assigned follow-up staff for {formatMonthLabel(selectedMonth)}
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              {activeStaffChartData.length} of {STAFF_FOLLOWUP_NAMES.length} staff active
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
                <Bar
                  dataKey="dueK"
                  name="Monthly Due (k)"
                  fill="#94a3b8"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="collectedK"
                  name="Collected (k)"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 10-Staff Performance Cards Grid */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Staff Roster Progress ({formatMonthLabel(selectedMonth)})
            </h3>
          </div>
          {filterStaff !== 'ALL' && (
            <button
              type="button"
              onClick={() => setFilterStaff('ALL')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              <X className="w-3.5 h-3.5" />
              Show All Staff
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
                  setFilterStaff((prev) =>
                    prev === staff.staffName ? 'ALL' : staff.staffName,
                  );
                  setAssignStaff(staff.staffName);
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

                  {staff.overallTrend === 'improving' && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Up
                    </span>
                  )}
                  {staff.overallTrend === 'worsening' && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
                      <TrendingDown className="w-3.5 h-3.5" />
                      Push
                    </span>
                  )}
                  {staff.overallTrend === 'stable' && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                      <ArrowRight className="w-3.5 h-3.5" />
                      Flat
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
                          Age Var.
                        </span>
                        <span
                          className={`font-mono font-semibold ${
                            staff.avgAgeVariance < 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : staff.avgAgeVariance > 0
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {staff.avgAgeVariance > 0 ? '+' : ''}
                          {staff.avgAgeVariance.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 pt-1">
                    Click to select &amp; assign contracts
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Detailed Contract-Level Monitoring Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Assigned Contracts Live Progress ({scopedContracts.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Payment received status, due-date collection vs. pending, and Opening Age → Closing Age variance
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'paid', label: 'Paid' },
                  { id: 'pending', label: 'Pending' },
                  { id: 'improving', label: 'Improved' },
                  { id: 'worsening', label: 'Worsened' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
                    statusFilter === tab.id
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-52">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search contract, client, staff..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            {filterStaff !== 'ALL' &&
              monthAssignments.some((a) => a.staffName === filterStaff) && (
                confirmClearKey === `${filterStaff}:${selectedMonth}` ? (
                  <div className="inline-flex items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        onClearStaffMonth(filterStaff, selectedMonth);
                        setConfirmClearKey(null);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 whitespace-nowrap"
                    >
                      Confirm Clear {filterStaff}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearKey(null)}
                      className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClearKey(`${filterStaff}:${selectedMonth}`)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear {filterStaff}
                  </button>
                )
              )}
          </div>
        </div>

        {scopedContracts.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <ClipboardCheck className="w-6 h-6 text-slate-400 mx-auto" />
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              No assigned contracts found for {filterStaff === 'ALL' ? 'this month' : filterStaff}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Select a staff member above and paste a bulk list of contract numbers to start tracking their payment receipt, due-date collection, and Op Age → Closing Age progress.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-4">Contract &amp; Client</th>
                  <th className="py-2.5 px-3">Assigned Staff</th>
                  <th className="py-2.5 px-3">Payment Status</th>
                  <th className="py-2.5 px-3 text-right">Due vs. Collected</th>
                  <th className="py-2.5 px-3 text-right">Pending Due</th>
                  <th className="py-2.5 px-3 text-right">Op Age → Closing</th>
                  <th className="py-2.5 px-3 text-right">Variance &amp; Trend</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                {scopedContracts.map((item) => (
                  <tr
                    key={`${item.assignment.staffName}_${item.assignment.monthKey}_${item.assignment.contractNo}`}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 align-top"
                  >
                    <td className="py-3 px-4 min-w-[200px]">
                      <div className="flex flex-wrap items-center gap-1.5">
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
                      <div className="text-slate-700 dark:text-slate-300 mt-0.5 truncate max-w-[220px]">
                        {item.cusName}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {item.officeType} · {item.originalOfficer}
                        {item.actualDpd > 0 ? ` · ${item.actualDpd} DPD` : ''}
                      </div>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          name={item.assignment.staffName}
                          sizeClass="w-6 h-6 text-[9px]"
                        />
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {item.assignment.staffName}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                            {item.assignment.assignedAt}
                          </div>
                        </div>
                      </div>
                      {item.assignment.note && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 max-w-[140px] truncate">
                          {item.assignment.note}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      {item.isPaid ? (
                        <div>
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            Payment Received
                          </span>
                          <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 mt-0.5">
                            Last: {formatCompactRs(item.lastPaidAmount || item.totalCollection)}
                            {item.lastPayDate ? ` · ${item.lastPayDate}` : ''}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            Pending Payment
                          </span>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {item.nextDueDate ? `Due: ${item.nextDueDate}` : 'No collection yet'}
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right font-mono min-w-[155px]">
                      <div className="font-semibold text-emerald-700 dark:text-emerald-400">
                        {formatCurrencyRs(item.totalCollection)}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        of {formatCurrencyRs(item.currentMonthDue)} ({item.collectionPct}%)
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            item.collectionPct >= 100
                              ? 'bg-emerald-500'
                              : item.collectionPct > 0
                                ? 'bg-blue-500'
                                : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, item.collectionPct))}%` }}
                        />
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right font-mono">
                      <span
                        className={
                          item.pendingDue > 0
                            ? 'font-semibold text-amber-700 dark:text-amber-400'
                            : 'font-semibold text-emerald-600 dark:text-emerald-400'
                        }
                      >
                        {item.pendingDue > 0 ? formatCurrencyRs(item.pendingDue) : 'Settled'}
                      </span>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        Debtor: {formatCompactRs(item.closingDebtor)}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                      <div className="text-slate-900 dark:text-slate-100 font-semibold">
                        {item.opAge.toFixed(2)} → {item.closingAge.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        Assign Op: {item.assignment.assignedOpAge.toFixed(2)}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div
                        className={`inline-flex items-center gap-1 font-mono font-bold ${
                          item.trend === 'improving'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : item.trend === 'worsening'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {item.trend === 'improving' ? (
                          <ArrowDownRight className="w-3.5 h-3.5" />
                        ) : item.trend === 'worsening' ? (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowRight className="w-3.5 h-3.5" />
                        )}
                        {item.ageVariance > 0 ? '+' : ''}
                        {item.ageVariance.toFixed(2)}
                      </div>
                      <div
                        className={`text-[10px] font-medium ${
                          item.trend === 'improving'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : item.trend === 'worsening'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {item.trend === 'improving'
                          ? 'Improving'
                          : item.trend === 'worsening'
                            ? 'Worsening'
                            : 'Held Steady'}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() =>
                          onRemoveAssignment(
                            item.assignment.staffName,
                            item.assignment.monthKey,
                            item.assignment.contractNo,
                          )
                        }
                        title="Remove from staff follow-up list"
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-red-300 hover:text-red-600 dark:hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
