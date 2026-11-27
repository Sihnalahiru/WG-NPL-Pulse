import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Building2,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  PhoneCall,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import type {
  AersMetadata,
  AersRecord,
  MonthlySnapshot,
  MrpEnrichment,
  OpeningOfficerBaseline,
  TrackedContract,
} from '../types/recovery';
import {
  CAMPAIGN_MONTHS,
  analyzeNextMonthBorderline,
  computeOfficerOpeningClosing,
  formatCompactRs,
  getOfficerByOfficeType,
  isBorderlineNplAccount,
  isCurrentNplAccount,
  isMarketingOfficeType,
  normalizeContractNo,
  normalizeEvaluableFromAers,
  normalizeEvaluableFromTracked,
} from '../utils/recoveryEngine';
import { UserAvatar } from './UserAvatar';

interface ExecutiveOfficerHubPanelProps {
  aersRecords: AersRecord[];
  aersMeta: AersMetadata | null;
  trackedContracts: TrackedContract[];
  mrpMap?: Map<string, MrpEnrichment>;
  openingBaseline: OpeningOfficerBaseline | null;
  monthlySnapshots: MonthlySnapshot[];
  selectedOfficer: string;
  onSelectOfficer: (officer: string) => void;
  onAddFromMaster?: (record: AersRecord) => void;
}

export function ExecutiveOfficerHubPanel({
  aersRecords,
  aersMeta,
  trackedContracts,
  mrpMap,
  openingBaseline,
  monthlySnapshots,
  selectedOfficer,
  onSelectOfficer,
  onAddFromMaster,
}: ExecutiveOfficerHubPanelProps) {
  const [activeHighlightTab, setActiveHighlightTab] = useState<
    'cards' | 'bulk_monitor' | 'campaign_perf' | 'ai_variance'
  >('cards');
  const [selectedCampaignMonth, setSelectedCampaignMonth] = useState<string>('ALL');
  const [perfScope, setPerfScope] = useState<'individual' | 'branch'>('individual');
  const [bulkText, setBulkText] = useState('');

  const safeAers = Array.isArray(aersRecords) ? aersRecords : [];
  const safeTracked = Array.isArray(trackedContracts) ? trackedContracts : [];
  const safeSnapshots = Array.isArray(monthlySnapshots) ? monthlySnapshots : [];

  const trackedSet = useMemo(
    () =>
      new Set(
        safeTracked
          .filter((c) => c && c.contractNo)
          .map((c) => normalizeContractNo(c.contractNo)),
      ),
    [safeTracked],
  );

  const evaluableItems = useMemo(() => {
    return safeAers.length > 0
      ? normalizeEvaluableFromAers(safeAers, trackedSet, mrpMap)
      : normalizeEvaluableFromTracked(safeTracked);
  }, [safeAers, safeTracked, trackedSet, mrpMap]);

  const officerRows = useMemo(
    () => computeOfficerOpeningClosing(evaluableItems, openingBaseline),
    [evaluableItems, openingBaseline],
  );

  // Build rich creative cards per RO / MO
  const officerCards = useMemo(() => {
    const officeMap = new Map<string, string>();
    for (const item of evaluableItems) {
      if (item.officer && !officeMap.has(item.officer)) {
        officeMap.set(item.officer, item.officeType);
      }
    }

    return officerRows.map((row) => {
      const officerItems = evaluableItems.filter((i) => i.officer === row.officer);
      const borderline = analyzeNextMonthBorderline(officerItems);
      const totalEfforts = officerItems.reduce(
        (sum, i) => sum + (i.assignOfficerEfforts || 0),
        0,
      );
      const contactedCount = officerItems.filter(
        (i) => (i.assignOfficerEfforts || 0) > 0,
      ).length;
      const effortCoveragePct =
        officerItems.length > 0
          ? Math.round((contactedCount / officerItems.length) * 100)
          : 0;
      const officeType = officeMap.get(row.officer) || 'RO';
      const isMo = isMarketingOfficeType(officeType);

      return {
        ...row,
        officeType,
        roleBadge: isMo ? 'MO' : 'RO',
        borderlineCount: borderline.totalCount,
        borderlineAmount: borderline.totalCapitalAtRisk,
        borderlineMinSave: borderline.totalMinToSave,
        totalEfforts,
        contactedCount,
        effortCoveragePct,
      };
    });
  }, [evaluableItems, officerRows]);

  // Bulk-wise contract monitor list
  const bulkTokens = useMemo(() => {
    return Array.from(
      new Set(
        bulkText
          .split(/[\s,;|\n\r]+/)
          .map((t) => normalizeContractNo(t))
          .filter((t) => t.length >= 4),
      ),
    );
  }, [bulkText]);

  const monitoredContracts = useMemo(() => {
    const aersByNo = new Map<string, AersRecord>();
    safeAers.forEach((r) => {
      if (r && r.contractNo) {
        aersByNo.set(normalizeContractNo(r.contractNo), r);
      }
    });

    if (bulkTokens.length > 0) {
      return bulkTokens.map((tok) => {
        const aers = aersByNo.get(tok);
        const tracked = safeTracked.find(
          (c) => normalizeContractNo(c.contractNo) === tok,
        );
        const mrp = mrpMap?.get(tok) ?? tracked?.mrp;
        const efforts = aers?.assignOfficerEfforts ?? tracked?.assignOfficerEfforts ?? 0;
        const totalEff = aers?.totalEfforts ?? tracked?.totalEfforts ?? 0;
        const officer = aers
          ? getOfficerByOfficeType(aers)
          : tracked
            ? getOfficerByOfficeType(tracked)
            : 'Unassigned';
        const dpd = aers?.actualDpd ?? tracked?.actualDpd ?? 0;
        const npl = aers?.npl ?? tracked?.npl ?? 0;
        const debtor = aers?.closingDebtor ?? tracked?.closingDebtor ?? 0;
        const minSave =
          aers?.minAmountToReverseNpl ?? tracked?.minAmountToReverseNpl ?? 0;
        const progressPct = Math.min(100, Math.round((efforts / 3) * 100));

        return {
          contractNo: tok,
          cusName: aers?.cusName || tracked?.cusName || 'Not in AERS Index',
          officer,
          officeType: aers?.officeType || tracked?.officeType || '',
          dpd,
          npl,
          debtor,
          minSave,
          efforts,
          totalEff,
          progressPct,
          hasCallOrVisit: efforts > 0 || (tracked?.visitHistory?.length ?? 0) > 0,
          isTracked: Boolean(tracked),
          aersRecord: aers,
          notPaidSummary: mrp?.notPaidSummary || '',
        };
      });
    }

    // Default: show selected officer's high-risk contracts for instant monitoring
    const pool =
      selectedOfficer === 'ALL'
        ? safeAers.slice(0, 20)
        : safeAers
            .filter((r) => getOfficerByOfficeType(r) === selectedOfficer)
            .slice(0, 25);

    return pool.map((aers) => {
      const tok = normalizeContractNo(aers.contractNo);
      const tracked = safeTracked.find(
        (c) => normalizeContractNo(c.contractNo) === tok,
      );
      const mrp = mrpMap?.get(tok) ?? tracked?.mrp;
      const efforts = aers.assignOfficerEfforts || 0;
      const progressPct = Math.min(100, Math.round((efforts / 3) * 100));
      return {
        contractNo: tok,
        cusName: aers.cusName,
        officer: getOfficerByOfficeType(aers),
        officeType: aers.officeType || '',
        dpd: aers.actualDpd || 0,
        npl: aers.npl || 0,
        debtor: aers.closingDebtor || 0,
        minSave: aers.minAmountToReverseNpl || 0,
        efforts,
        totalEff: aers.totalEfforts || 0,
        progressPct,
        hasCallOrVisit: efforts > 0 || (tracked?.visitHistory?.length ?? 0) > 0,
        isTracked: Boolean(tracked),
        aersRecord: aers,
        notPaidSummary: mrp?.notPaidSummary || '',
      };
    });
  }, [bulkTokens, safeAers, safeTracked, mrpMap, selectedOfficer]);

  // Daily AI Intelligence Variance & Suggestions (Individual vs Branch)
  const aiVarianceInsights = useMemo(() => {
    const activeCard =
      selectedOfficer !== 'ALL'
        ? officerCards.find((c) => c.officer === selectedOfficer)
        : null;

    const totalOpNpl = officerCards.reduce((s, c) => s + c.openingNpl, 0);
    const totalCloseNpl = officerCards.reduce((s, c) => s + c.closingNpl, 0);
    const branchNetDelta = totalOpNpl - totalCloseNpl; // Positive = NPL Reduced (Good), Negative = NPL Increased

    const targetName = activeCard ? `${activeCard.officer} (${activeCard.officeType})` : 'Entire Branch';
    const targetOpNpl = activeCard ? activeCard.openingNpl : totalOpNpl;
    const targetCloseNpl = activeCard ? activeCard.closingNpl : totalCloseNpl;
    const targetDelta = targetOpNpl - targetCloseNpl;
    const targetBorderlineCount = activeCard
      ? activeCard.borderlineCount
      : officerCards.reduce((s, c) => s + c.borderlineCount, 0);
    const targetBorderlineMinSave = activeCard
      ? activeCard.borderlineMinSave
      : officerCards.reduce((s, c) => s + c.borderlineMinSave, 0);
    const targetZeroEffort = activeCard
      ? activeCard.zeroEffortBorderlineCount
      : officerCards.reduce((s, c) => s + c.zeroEffortBorderlineCount, 0);

    const suggestions: {
      tone: 'positive' | 'warning' | 'critical';
      title: string;
      detail: string;
    }[] = [];

    if (targetDelta >= 0) {
      suggestions.push({
        tone: 'positive',
        title: `Plus (+) NPL Variance: +${formatCompactRs(targetDelta)} Saved`, detail: `${targetName} has reduced Opening NPL from ${formatCompactRs(targetOpNpl)} down to${formatCompactRs(targetCloseNpl)}. Maintain daily PTP follow-ups to lock month-end gains.`,
      });
    } else {
      suggestions.push({
        tone: 'critical',
        title: `Minus (-) NPL Variance: -${formatCompactRs(Math.abs(targetDelta))} Net Slippage`,
        detail: `${targetName} Closing NPL (${formatCompactRs(targetCloseNpl)}) exceeded Opening NPL (${formatCompactRs(targetOpNpl)}). Prioritize immediate arrears collection on newly slipped 91+ DPD accounts.`,
      });
    }

    if (targetBorderlineCount > 0) {
      suggestions.push({
        tone: 'warning',
        title: `Save ${targetBorderlineCount} Borderline Accounts with${formatCompactRs(targetBorderlineMinSave)}`,
        detail: `Collecting the minimum reversal amount (${formatCompactRs(targetBorderlineMinSave)}) before the 30th prevents forward bucket slippage into NPL.`,
      });
    }

    if (targetZeroEffort > 0) {
      suggestions.push({
        tone: 'critical',
        title: `${targetZeroEffort} Borderline Accounts Have Zero
