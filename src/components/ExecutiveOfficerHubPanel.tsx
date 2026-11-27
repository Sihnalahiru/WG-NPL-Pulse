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
  MrpPaymentMonth,
  OfficerEvaluationRow,
  OpeningOfficerBaseline,
  TrackedContract,
  VisitLogEntry,
} from '../types/recovery';
import {
  CAMPAIGN_MONTHS,
  analyzeNextMonthBorderline,
  computeOfficerOpeningClosing,
  formatCompactRs,
  getOfficerByOfficeType,
  isMarketingOfficeType,
  normalizeContractNo,
  normalizeEvaluableFromAers,
  normalizeEvaluableFromTracked,
} from '../utils/recoveryEngine';
import type { EvaluableAccount } from '../utils/recoveryEngine';
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

function asArray<T>(val: unknown): T[] {
  return Array.isArray(val) ? (val as T[]) : [];
}

function asStr(val: unknown): string {
  return typeof val === 'string' ? val : val == null || typeof val === 'boolean' ? '' : String(val);
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
  const [varianceLang, setVarianceLang] = useState<'both' | 'si' | 'en'>('both');
  const [selectedCampaignMonth, setSelectedCampaignMonth] = useState<string>('ALL');
  const [perfScope, setPerfScope] = useState<'individual' | 'branch'>('individual');
  const [bulkText, setBulkText] = useState('');

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

  const safeTracked = useMemo(() => {
    return asArray<TrackedContract>(trackedContracts)
      .filter((c) => c && typeof c === 'object' && !Array.isArray(c))
      .map((c) => ({
        ...c,
        contractNo: asStr(c.contractNo),
        cusName: asStr(c.cusName),
        officeType: asStr(c.officeType),
        recoveryOfficer: asStr(c.recoveryOfficer),
        marketingOfficer: asStr(c.marketingOfficer),
        ro: asStr(c.ro),
        nplReason: asStr(c.nplReason),
        worstCaseProduct: asStr(c.worstCaseProduct),
        visitHistory: asArray<VisitLogEntry>(c.visitHistory),
      }))
      .filter((c) => c.contractNo.length > 0);
  }, [trackedContracts]);

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

  const trackedSet = useMemo(
    () => new Set(safeTracked.map((c) => normalizeContractNo(c.contractNo))),
    [safeTracked],
  );

  const evaluableItems = useMemo<EvaluableAccount[]>(() => {
    try {
      const raw =
        safeAers.length > 0
          ? normalizeEvaluableFromAers(safeAers, trackedSet, safeMrpMap)
          : normalizeEvaluableFromTracked(safeTracked);
      return asArray<EvaluableAccount>(raw);
    } catch {
      return [];
    }
  }, [safeAers, safeTracked, trackedSet, safeMrpMap]);

  const officerRows = useMemo<OfficerEvaluationRow[]>(() => {
    try {
      return asArray<OfficerEvaluationRow>(
        computeOfficerOpeningClosing(evaluableItems, safeBaseline),
      );
    } catch {
      return [];
    }
  }, [evaluableItems, safeBaseline]);

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
      };
    });
  }, [evaluableItems, officerRows]);

  const bulkTokens = useMemo(() => {
    const parts = asStr(bulkText)
      .split(/[\s,;|\n\r]+/)
      .map((t) => normalizeContractNo(t))
      .filter((t) => t.length >= 4);
    return Array.from(new Set(parts));
  }, [bulkText]);

  const monitoredContracts = useMemo(() => {
    const aersByNo = new Map<string, AersRecord>();
    safeAers.forEach((r) => {
      aersByNo.set(normalizeContractNo(r.contractNo), r);
    });

    if (bulkTokens.length > 0) {
      return bulkTokens.map((tok) => {
        const aers = aersByNo.get(tok);
        const tracked = safeTracked.find(
          (c) => normalizeContractNo(c.contractNo) === tok,
        );
        const mrp = safeMrpMap.get(tok) ?? tracked?.mrp;
        const efforts =
          Number(aers?.assignOfficerEfforts ?? tracked?.assignOfficerEfforts) || 0;
        const totalEff = Number(aers?.totalEfforts ?? tracked?.totalEfforts) || 0;
        const officer = aers
          ? asStr(getOfficerByOfficeType(aers)) || 'Unassigned'
          : tracked
            ? asStr(getOfficerByOfficeType(tracked)) || 'Unassigned'
            : 'Unassigned';
        const dpd = Number(aers?.actualDpd ?? tracked?.actualDpd) || 0;
        const npl = Number(aers?.npl ?? tracked?.npl) || 0;
        const debtor = Number(aers?.closingDebtor ?? tracked?.closingDebtor) || 0;
        const progressPct = Math.min(100, Math.round((efforts / 3) * 100));

        return {
          contractNo: tok,
          cusName: asStr(aers?.cusName || tracked?.cusName) || 'Not in AERS Index',
          officer,
          officeType: asStr(aers?.officeType || tracked?.officeType),
          dpd,
          npl,
          debtor,
          efforts,
          totalEff,
          progressPct,
          hasCallOrVisit:
            efforts > 0 || (Array.isArray(tracked?.visitHistory) && tracked.visitHistory.length > 0),
          isTracked: Boolean(tracked),
          aersRecord: aers,
          notPaidSummary: asStr(mrp?.notPaidSummary),
        };
      });
    }

    const pool =
      selectedOfficer === 'ALL'
        ? safeAers.slice(0, 20)
        : safeAers
            .filter((r) => asStr(getOfficerByOfficeType(r)) === selectedOfficer)
            .slice(0, 25);

    return pool.map((aers) => {
      const tok = normalizeContractNo(aers.contractNo);
      const tracked = safeTracked.find(
        (c) => normalizeContractNo(c.contractNo) === tok,
      );
      const mrp = safeMrpMap.get(tok) ?? tracked?.mrp;
      const efforts = Number(aers.assignOfficerEfforts) || 0;
      const progressPct = Math.min(100, Math.round((efforts / 3) * 100));
      return {
        contractNo: tok,
        cusName: asStr(aers.cusName),
        officer: asStr(getOfficerByOfficeType(aers)) || 'Unassigned',
        officeType: asStr(aers.officeType),
        dpd: Number(aers.actualDpd) || 0,
        npl: Number(aers.npl) || 0,
        debtor: Number(aers.closingDebtor) || 0,
        efforts,
        totalEff: Number(aers.totalEfforts) || 0,
        progressPct,
        hasCallOrVisit:
          efforts > 0 || (Array.isArray(tracked?.visitHistory) && tracked.visitHistory.length > 0),
        isTracked: Boolean(tracked),
        aersRecord: aers,
        notPaidSummary: asStr(mrp?.notPaidSummary),
      };
    });
  }, [bulkTokens, safeAers, safeTracked, safeMrpMap, selectedOfficer]);

  const aiVarianceInsights = useMemo(() => {
    const activeCard =
      selectedOfficer !== 'ALL'
        ? officerCards.find((c) => c.officer === selectedOfficer)
        : null;

    const scopedAers =
      selectedOfficer === 'ALL'
        ? safeAers
        : safeAers.filter((r) => asStr(getOfficerByOfficeType(r)) === selectedOfficer);

    const scopedEval =
      selectedOfficer === 'ALL'
        ? evaluableItems
        : evaluableItems.filter((i) => i && i.officer === selectedOfficer);

    const totalOpNpl = officerCards.reduce((s, c) => s + (Number(c.openingNpl) || 0), 0);
    const totalCloseNpl = officerCards.reduce((s, c) => s + (Number(c.closingNpl) || 0), 0);
    const branchNetDelta = totalOpNpl - totalCloseNpl;

    const targetNameEn = activeCard
      ? `${activeCard.officer} (${activeCard.officeType})`
      : 'Entire Branch';
    const targetNameSi = activeCard
      ? `${activeCard.officer} (${activeCard.officeType})`
      : 'සම්පූර්ණ ශාඛාව';

    const targetOpNpl = activeCard ? Number(activeCard.openingNpl) || 0 : totalOpNpl;
    const targetCloseNpl = activeCard ? Number(activeCard.closingNpl) || 0 : totalCloseNpl;
    const targetDelta = targetOpNpl - targetCloseNpl;
    const targetBorderlineCount = activeCard
      ? activeCard.borderlineCount
      : officerCards.reduce((s, c) => s + c.borderlineCount, 0);
    const targetBorderlineExposure = activeCard
      ? activeCard.borderlineAmount
      : officerCards.reduce((s, c) => s + c.borderlineAmount, 0);
    const targetZeroEffort = activeCard
      ? Number(activeCard.zeroEffortBorderlineCount) || 0
      : officerCards.reduce((s, c) => s + (Number(c.zeroEffortBorderlineCount) || 0), 0);
    const targetWorstCount = activeCard
      ? Number(activeCard.worstCount) || 0
      : officerCards.reduce((s, c) => s + (Number(c.worstCount) || 0), 0);

    const totalDue = scopedAers.reduce(
      (s, r) => s + (Number(r.currentMonthDue || r.dueBudgetMonth) || 0),
      0,
    );
    const totalColl = scopedAers.reduce((s, r) => s + (Number(r.totalCollection) || 0), 0);
    const collRatePct = totalDue > 0 ? Math.round((totalColl / totalDue) * 100) : 0;

    // Pick concrete top-priority contracts so advice is immediately practical
    const zeroEffortTop = scopedEval
      .filter((i) => i.actualDpd >= 61 && i.actualDpd < 91 && (Number(i.assignOfficerEfforts) || 0) <= 0)
      .sort((a, b) => (Number(b.closingDebtor) || 0) - (Number(a.closingDebtor) || 0))
      .slice(0, 3);

    const borderlineTop = scopedEval
      .filter((i) => i.actualDpd >= 61 && i.actualDpd < 91)
      .sort((a, b) => (Number(b.actualDpd) || 0) - (Number(a.actualDpd) || 0))
      .slice(0, 3);

    const worstTop = scopedEval
      .filter((i) => i.isWorst)
      .sort((a, b) => (Number(b.npl) || 0) - (Number(a.npl) || 0))
      .slice(0, 3);

    const newlySlippedTop = scopedEval
      .filter((i) => (Number(i.opNpl) || 0) <= 0 && (Number(i.npl) || 0) > 0)
      .sort((a, b) => (Number(b.npl) || 0) - (Number(a.npl) || 0))
      .slice(0, 3);

    const suggestions: {
      tone: 'positive' | 'warning' | 'critical';
      priorityEn: string;
      prioritySi: string;
      titleEn: string;
      titleSi: string;
      detailEn: string;
      detailSi: string;
      actionEn: string;
      actionSi: string;
      focusContracts: { contractNo: string; label: string }[];
    }[] = [];

    // 1. NPL Position (Saved vs Increased)
    if (targetDelta >= 0) {
      suggestions.push({
        tone: 'positive',
        priorityEn: 'On Track',
        prioritySi: 'හොඳ ප්‍රගතියක්',
        titleEn: `NPL Reduced by ${formatCompactRs(targetDelta)}`,
        titleSi: `NPL මුදල ${formatCompactRs(targetDelta)} කින් අඩු කර ඇත`,
        detailEn: `${targetNameEn} lowered NPL from ${formatCompactRs(targetOpNpl)} down to ${formatCompactRs(targetCloseNpl)}. Current due collection stands at ${collRatePct}% (${formatCompactRs(totalColl)}).`,
        detailSi: `${targetNameSi} මුල් NPL (${formatCompactRs(targetOpNpl)}) දැනට ${formatCompactRs(targetCloseNpl)} දක්වා අඩු කර ඇත. මේ මාසයේ දැනට එකතු කර ඇති මුදල ${formatCompactRs(totalColl)} (${collRatePct}%) කි.`,
        actionEn: 'Lock in today’s Promise-to-Pay (PTP) calls and collect full arrears + charges before month-end so recovered accounts do not slip back.',
        actionSi: 'අද දින පොරොන්දු වූ ගෙවීම් (PTP) ලබා ගෙන, මාසය අවසානයට පෙර බේරා ගත් ගිණුම් නැවත NPL නොවීමට දිනපතා පසු විපරම් කරන්න.',
        focusContracts: newlySlippedTop.map((c) => ({
          contractNo: c.contractNo,
          label: `${c.actualDpd} DPD · ${formatCompactRs(c.npl)}`,
        })),
      });
    } else {
      suggestions.push({
        tone: 'critical',
        priorityEn: 'Urgent Recovery',
        prioritySi: 'හදිසි අවධානය',
        titleEn: `NPL Increased by ${formatCompactRs(Math.abs(targetDelta))}`,
        titleSi: `NPL මුදල ${formatCompactRs(Math.abs(targetDelta))} කින් වැඩි වී ඇත`,
        detailEn: `${targetNameEn} moved from ${formatCompactRs(targetOpNpl)} to ${formatCompactRs(targetCloseNpl)}. Newly slipped 91+ DPD accounts are pulling the portfolio down.`,
        detailSi: `${targetNameSi} හි මුල් NPL (${formatCompactRs(targetOpNpl)}) දැනට ${formatCompactRs(targetCloseNpl)} දක්වා ඉහළ ගොස් ඇත. අලුතින් 91+ DPD වූ ගිණුම් නිසා මෙම වැඩිවීම සිදු වී ඇත.`,
        actionEn: 'Visit newly slipped 91+ DPD clients first today; confirm full arrears + DI/charges with the branch cashier before requesting payment.',
        actionSi: 'අලුතින් 91+ DPD වූ ගනුදෙනුකරුවන් හමු වී, DI සහ ගාස්තු ඇතුළු සම්පූර්ණ හිඟ මුදල පරීක්ෂා කර අදම ගෙවීම් ලබා ගැනීමට ක්‍රියා කරන්න.',
        focusContracts: newlySlippedTop.map((c) => ({
          contractNo: c.contractNo,
          label: `${c.actualDpd} DPD · NPL ${formatCompactRs(c.npl)}`,
        })),
      });
    }

    // 2. Borderline Prevention (No minimum amount — uses real Capital+Arrears exposure)
    if (targetBorderlineCount > 0) {
      suggestions.push({
        tone: 'warning',
        priorityEn: 'Month-End Shield',
        prioritySi: 'මාස අග ආරක්ෂාව',
        titleEn: `Protect ${targetBorderlineCount} Borderline Accounts (${formatCompactRs(targetBorderlineExposure)} Exposure)`,
        titleSi: `Borderline ගිණුම් ${targetBorderlineCount} ක් NPL වීම වළක්වන්න (${formatCompactRs(targetBorderlineExposure)})`,
        detailEn: `${targetBorderlineCount} accounts in the 61–90 DPD bracket will cross 91 DPD if unpaid. Saving them prevents ${formatCompactRs(targetBorderlineExposure)} in new NPL.`,
        detailSi: `61–90 DPD මට්ටමේ ඇති ගිණුම් ${targetBorderlineCount} කට ගෙවීම් නොලැබුණහොත් මාසය අවසානයේ NPL වී ${formatCompactRs(targetBorderlineExposure)} ක් අලුතින් එකතු වේ.`,
        actionEn: 'Check live system payoff/arrears (including DI & recovery charges) for the highest DPD accounts below and secure a confirmed payment date.',
        actionSi: 'පහත වැඩිම DPD ඇති ගිණුම් වල DI සහ අනෙකුත් ගාස්තු ඇතුළු නියම හිඟ මුදල පද්ධතියෙන් බලා, මාසය අවසානයට පෙර ගෙවීමක් තහවුරු කර ගන්න.',
        focusContracts: borderlineTop.map((c) => ({
          contractNo: c.contractNo,
          label: `${c.actualDpd} DPD · Debtor ${formatCompactRs(c.closingDebtor)}`,
        })),
      });
    }

    // 3. Zero-Effort Action or Worst Case Priority
    if (targetZeroEffort > 0) {
      suggestions.push({
        tone: 'critical',
        priorityEn: 'Call First Today',
        prioritySi: 'අදම අමතන්න',
        titleEn: `${targetZeroEffort} Borderline Accounts Have 0 Calls / Visits`,
        titleSi: `Borderline ගිණුම් ${targetZeroEffort} කට තවම කිසිදු කෝල්/විසිට් එකක් නැත`,
        detailEn: `These 61–90 DPD accounts have zero recorded officer efforts so far this month and carry the highest risk of silent slippage.`,
        detailSi: `61–90 DPD මට්ටමේ ඇති මෙම ගිණුම් ${targetZeroEffort} ට මේ මාසයේ කිසිදු දුරකථන ඇමතුමක් හෝ ක්ෂේත්‍ර පරීක්ෂාවක් සටහන් වී නැත.`,
        actionEn: 'Assign phone follow-ups immediately or schedule a field visit today and log the customer’s exact PTP date in the Watchlist.',
        actionSi: 'අද උදෑසනම මෙම ගිණුම් වලට කෝල් කර හෝ නිවසට ගොස් ගනුදෙනුකරු සම්බන්ධ කරගෙන ගෙවන දිනය (P/P Date) සටහන් කරන්න.',
        focusContracts: zeroEffortTop.map((c) => ({
          contractNo: c.contractNo,
          label: `${c.actualDpd} DPD · 0 Efforts`,
        })),
      });
    } else if (targetWorstCount > 0) {
      suggestions.push({
        tone: 'warning',
        priorityEn: 'Worst Case (W)',
        prioritySi: 'Worst Case (W) අවධානය',
        titleEn: `${targetWorstCount} Worst Case (W) Accounts Need Cross-Product Follow-Up`,
        titleSi: `Worst Case (W) ගිණුම් ${targetWorstCount} ක් සඳහා විශේෂ පසු විපරම් අවශ්‍යයි`,
        detailEn: `Even when DPD looks low, Worst Case (W) accounts remain NPL due to another linked overdue facility (PB/PBM/TW/MB/FB).`,
        detailSi: `DPD අඩු වුවද, ගනුදෙනුකරුගේ වෙනත් ණය පහසුකමක් හිඟ වීම නිසා මෙම W ගිණුම් ${targetWorstCount} තවමත් NPL ලෙස පවතී.`,
        actionEn: 'Check the customer’s linked worst-case product and coordinate settlement across both facilities to clear the W flag.',
        actionSi: 'ගනුදෙනුකරුගේ අනෙක් හිඟ ණය ගිණුම (Worst Case Product) පරීක්ෂා කර, එයද නිරවුල් කිරීමෙන් මෙම ගිණුම NPL වලින් ඉවත් කර ගන්න.',
        focusContracts: worstTop.map((c) => ({
          contractNo: c.contractNo,
          label: `W·${c.worstCaseProduct || 'W'} · ${formatCompactRs(c.npl)}`,
        })),
      });
    }

    return {
      targetNameEn,
      targetNameSi,
      targetDelta,
      branchNetDelta,
      targetOpNpl,
      targetCloseNpl,
      targetBorderlineCount,
      targetBorderlineExposure,
      targetZeroEffort,
      targetWorstCount,
      totalDue,
      totalColl,
      collRatePct,
      suggestions,
    };
  }, [officerCards, selectedOfficer, safeAers, evaluableItems]);

  const campaignSeries = useMemo(() => {
    const months = asArray<{ monthKey: string; label: string }>(CAMPAIGN_MONTHS);
    return months.map((m) => {
      const snaps = safeSnapshots.filter((s) => s.monthKey === m.monthKey);
      const latest = snaps[snaps.length - 1];
      return {
        ...m,
        hasData: Boolean(latest),
        nplAmount: latest ? Number(latest.branchNpl || latest.trackedNpl) || 0 : 0,
        savedAmount: latest ? Number(latest.nplSavedAmount) || 0 : 0,
        collectionPct: latest
          ? Number(latest.branchCollectionPct || latest.collectionPct) || 0
          : 0,
        snapshotDate: asStr(latest?.snapshotDate) || 'Pending',
      };
    });
  }, [safeSnapshots]);

  return (
    <section
      aria-label="Executive RO MO Performance & Intelligence Hub"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-sm space-y-5"
    >
      {/* Top Control Bar: User Name Selector + Highlighted Feature Menus */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
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
                {c.officer} ({c.officeType}) · {c.closingCount} Accts · NPL{' '}
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
            onClick={() => setActiveHighlightTab('bulk_monitor')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
              activeHighlightTab === 'bulk_monitor'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Bulk Effort Monitor
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
            onClick={() => setActiveHighlightTab('ai_variance')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
              activeHighlightTab === 'ai_variance'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Variance (+/-)
          </button>
        </div>
      </div>

      {/* TAB 1: Creative RO / MO Profile Cards with Real UserAvatar */}
      {activeHighlightTab === 'cards' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Individual Officer Performance Cards (Click any card to filter entire dashboard)
            </span>
            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
              Showing {officerCards.length} Active Officers
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
                            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              {card.closingCount} Contracts
                            </span>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                          variance >= 0
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}
                      >
                        {variance >= 0 ? '+' : '-'}
                        {formatCompactRs(Math.abs(variance))}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-800/80 text-xs tabular-nums">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                          Current NPL
                        </span>
                        <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                          {formatCompactRs(card.closingNpl)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                          Closing Debtor
                        </span>
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {formatCompactRs(card.closingDebtor)}
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
                            {card.effortCoveragePct}%
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

      {/* TAB 2: Bulk-Wise Contract List & Call / Effort Progress Monitor */}
      {activeHighlightTab === 'bulk_monitor' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1 space-y-2">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                Paste Bulk Contract Numbers (Check Call &amp; Effort Progress)
              </label>
              <textarea
                rows={4}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={'Paste CONTRACT_NO list here...\ne.g. WGFBA058325, WGFBA061120'}
                className="w-full p-3 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>
                  {bulkTokens.length > 0
                    ? `Monitoring ${bulkTokens.length} pasted contracts`
                    : `Showing ${selectedOfficer === 'ALL' ? 'Top 20 Branch' : selectedOfficer} contracts`}
                </span>
                {bulkTokens.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setBulkText('')}
                    className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
                  >
                    Clear Paste
                  </button>
                )}
              </div>
            </div>

            <div className="lg:col-span-2 overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-3">Contract &amp; Client</th>
                    <th className="py-2.5 px-3">Officer</th>
                    <th className="py-2.5 px-3 text-right">DPD / Debtor</th>
                    <th className="py-2.5 px-3">Call / Effort Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                  {monitoredContracts.map((item) => (
                    <tr
                      key={item.contractNo}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-2.5 px-3">
                        <div className="font-mono font-bold text-slate-900 dark:text-slate-100">
                          {item.contractNo}
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate max-w-[180px]">
                          {item.cusName}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <UserAvatar
                            name={item.officer}
                            sizeClass="w-6 h-6 text-[9px]"
                          />
                          <div>
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {item.officer}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {item.officeType}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <span
                          className={
                            item.dpd >= 91
                              ? 'text-rose-600 font-bold'
                              : 'text-amber-600 font-semibold'
                          }
                        >
                          {item.dpd} DPD
                        </span>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300">
                          {formatCompactRs(item.debtor)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 min-w-[170px]">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          {item.hasCallOrVisit ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                              <PhoneCall className="w-3 h-3" />
                              {item.efforts} Assign / {item.totalEff} Total
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
                              <AlertTriangle className="w-3 h-3" />
                              0 Efforts Given
                            </span>
                          )}
                          <span className="font-mono text-[10px] text-slate-500">
                            {item.progressPct}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              item.hasCallOrVisit
                                ? 'bg-emerald-500'
                                : 'bg-rose-500 w-1.5'
                            }`}
                            style={{ width: `${Math.max(6, item.progressPct)}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {item.isTracked ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Tracked
                          </span>
                        ) : item.aersRecord && onAddFromMaster ? (
                          <button
                            type="button"
                            onClick={() => onAddFromMaster(item.aersRecord!)}
                            className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                          >
                            + Track
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Nov 2026 - Mar 2027 Campaign Timeline + Individual vs Branch Performance */}
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
                Full Campaign (Nov 2026 – Mar 2027)
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
                  {m.label} {m.hasData ? '●' : ''}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl">
              <button
                type="button"
                onClick={() => setPerfScope('individual')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg ${
                  perfScope === 'individual'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                Individual Performance
              </button>
              <button
                type="button"
                onClick={() => setPerfScope('branch')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg ${
                  perfScope === 'branch'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                Branch Performance
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 tabular-nums">
            {campaignSeries.map((m) => (
              <div
                key={m.monthKey}
                className={`p-3.5 rounded-2xl border ${
                  m.hasData
                    ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800'
                    : 'bg-slate-50/60 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 opacity-75'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-slate-100">
                  <span>{m.label}</span>
                  <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400">
                    {m.hasData ? m.snapshotDate : 'Upcoming'}
                  </span>
                </div>
                <div className="mt-2 text-sm font-mono font-bold text-slate-900 dark:text-slate-100">
                  {m.hasData ? formatCompactRs(m.nplAmount) : '—'}
                </div>
                <div className="mt-0.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-mono">
                  {m.hasData
                    ? `Saved: ${formatCompactRs(m.savedAmount)}`
                    : 'Awaiting AERS'}
                </div>
              </div>
            ))}
          </div>

          {perfScope === 'branch' ? (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4 tabular-nums">
              <div>
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                  Branch Opening NPL
                </span>
                <div className="mt-1 text-base font-mono font-bold text-slate-900 dark:text-slate-100">
                  {formatCompactRs(
                    officerCards.reduce((s, c) => s + (Number(c.openingNpl) || 0), 0),
                  )}
                </div>
              </div>
              <div>
                <span className="text-[11px] text-slate-500">
                  Branch Closing NPL
                </span>
                <div className="mt-1 text-base font-mono font-bold text-rose-600 dark:text-rose-400">
                  {formatCompactRs(
                    officerCards.reduce((s, c) => s + (Number(c.closingNpl) || 0), 0),
                  )}
                </div>
              </div>
              <div>
                <span className="text-[11px] text-slate-500">
                  Branch Borderline Exposure
                </span>
                <div className="mt-1 text-base font-mono font-bold text-amber-600 dark:text-amber-400">
                  {formatCompactRs(
                    officerCards.reduce((s, c) => s + c.borderlineAmount, 0),
                  )}
                </div>
              </div>
              <div>
                <span className="text-[11px] text-slate-500">
                  Branch Net Variance
                </span>
                <div className="mt-1 text-base font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCompactRs(
                    officerCards.reduce(
                      (s, c) => s + ((Number(c.openingNpl) || 0) - (Number(c.closingNpl) || 0)),
                      0,
                    ),
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500">
                    <th className="py-2.5 px-3">Officer (RO / MO)</th>
                    <th className="py-2.5 px-3 text-right">Opening NPL</th>
                    <th className="py-2.5 px-3 text-right">Closing NPL</th>
                    <th className="py-2.5 px-3 text-right">Borderline</th>
                    <th className="py-2.5 px-3 text-right">
                      Net Variance (+/-)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                  {officerCards.map((c) => {
                    const delta = (Number(c.openingNpl) || 0) - (Number(c.closingNpl) || 0);
                    return (
                      <tr key={c.officer}>
                        <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">
                          {c.officer} ({c.officeType})
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {formatCompactRs(c.openingNpl)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-rose-600">
                          {formatCompactRs(c.closingNpl)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-amber-600">
                          {c.borderlineCount} ·{' '}
                          {formatCompactRs(c.borderlineAmount)}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-mono font-bold ${
                            delta >= 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {delta >= 0 ? '+' : '-'}
                          {formatCompactRs(Math.abs(delta))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Daily Intelligence Variance Engine — Practical Bilingual (EN + සිංහල) */}
      {activeHighlightTab === 'ai_variance' && (
        <div className="space-y-4">
          {/* Top Header + Language Switcher */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 p-4 sm:p-5 rounded-2xl bg-slate-900 dark:bg-slate-950 text-white border border-slate-800">
            <div className="flex items-start gap-3">
              <Bot className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-emerald-400">
                  Daily Practical Action &amp; Variance Guide · දෛනික ප්‍රායෝගික විශ්ලේෂණය
                </div>
                <div className="text-sm sm:text-base font-bold mt-0.5">
                  {varianceLang === 'si'
                    ? `තෝරාගත් කොටස: ${aiVarianceInsights.targetNameSi}`
                    : varianceLang === 'en'
                      ? `Scope: ${aiVarianceInsights.targetNameEn}`
                      : `${aiVarianceInsights.targetNameEn} · ${aiVarianceInsights.targetNameSi}`}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                  Snapshot: {aersMeta?.printedDateTime || 'Latest AERS'}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div
                role="group"
                aria-label="Language selection"
                className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-800 border border-slate-700"
              >
                {(
                  [
                    { id: 'both', label: 'EN + සිංහල' },
                    { id: 'si', label: 'සිංහල' },
                    { id: 'en', label: 'English' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setVarianceLang(opt.id)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap ${
                      varianceLang === opt.id
                        ? 'bg-emerald-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4 Simple, Easy-to-Understand Numbers */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 tabular-nums">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {varianceLang === 'si'
                  ? 'NPL වෙනස (මුල් → දැනට)'
                  : varianceLang === 'en'
                    ? 'Net NPL Change (Open → Now)'
                    : 'Net NPL Change · NPL වෙනස'}
              </div>
              <div
                className={`mt-1 text-base sm:text-lg font-mono font-bold ${
                  aiVarianceInsights.targetDelta >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {aiVarianceInsights.targetDelta >= 0 ? 'Saved ' : 'Increased '}
                {formatCompactRs(Math.abs(aiVarianceInsights.targetDelta))}
              </div>
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                {formatCompactRs(aiVarianceInsights.targetOpNpl)} →{' '}
                {formatCompactRs(aiVarianceInsights.targetCloseNpl)}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {varianceLang === 'si'
                  ? 'Borderline ගිණුම් (61–90 DPD)'
                  : varianceLang === 'en'
                    ? 'Borderline Risk (61–90 DPD)'
                    : 'Borderline (61–90) · අවදානම් ගිණුම්'}
              </div>
              <div className="mt-1 text-base sm:text-lg font-mono font-bold text-amber-700 dark:text-amber-400">
                {aiVarianceInsights.targetBorderlineCount} Accts
              </div>
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                Exposure: {formatCompactRs(aiVarianceInsights.targetBorderlineExposure)}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {varianceLang === 'si'
                  ? 'කෝල්/විසිට් 0 ගිණුම්'
                  : varianceLang === 'en'
                    ? 'Uncontacted (0 Efforts)'
                    : '0-Effort Urgent · කෝල්/විසිට් 0'}
              </div>
              <div
                className={`mt-1 text-base sm:text-lg font-mono font-bold ${
                  aiVarianceInsights.targetZeroEffort > 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {aiVarianceInsights.targetZeroEffort} Accts
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {varianceLang === 'si'
                  ? `Worst Case (W): ${aiVarianceInsights.targetWorstCount}`
                  : `Worst Case (W): ${aiVarianceInsights.targetWorstCount} accts`}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {varianceLang === 'si'
                  ? 'මාසික එකතු කිරීම (Due vs Coll.)'
                  : varianceLang === 'en'
                    ? 'Due-Date Collection Progress'
                    : 'Collection · මාසික එකතුව'}
              </div>
              <div className="mt-1 text-base sm:text-lg font-mono font-bold text-slate-900 dark:text-slate-100">
                {aiVarianceInsights.collRatePct}%{' '}
                <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">
                  ({formatCompactRs(aiVarianceInsights.totalColl)})
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                Due: {formatCompactRs(aiVarianceInsights.totalDue)}
              </div>
            </div>
          </div>

          {/* Practical Bilingual Action Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {aiVarianceInsights.suggestions.map((sug, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                  sug.tone === 'positive'
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                    : sug.tone === 'warning'
                      ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                      : 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                    <span
                      className={`inline-flex items-center gap-1.5 ${
                        sug.tone === 'positive'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : sug.tone === 'warning'
                            ? 'text-amber-800 dark:text-amber-300'
                            : 'text-rose-700 dark:text-rose-400'
                      }`}
                    >
                      {sug.tone === 'positive' ? (
                        <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5 shrink-0" />
                      )}
                      {varianceLang === 'si'
                        ? sug.prioritySi
                        : varianceLang === 'en'
                          ? sug.priorityEn
                          : `${sug.priorityEn} · ${sug.prioritySi}`}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                      0{idx + 1}
                    </span>
                  </div>

                  {(varianceLang === 'en' || varianceLang === 'both') && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug">
                        {sug.titleEn}
                      </h4>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {sug.detailEn}
                      </p>
                    </div>
                  )}

                  {(varianceLang === 'si' || varianceLang === 'both') && (
                    <div
                      className={`space-y-1 ${
                        varianceLang === 'both'
                          ? 'pt-2 border-t border-slate-200/70 dark:border-slate-800/70'
                          : ''
                      }`}
                    >
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug">
                        {sug.titleSi}
                      </h4>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {sug.detailSi}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2.5 pt-2.5 border-t border-slate-200/80 dark:border-slate-800">
                  <div className="text-[11px] space-y-1">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {varianceLang === 'si'
                        ? 'අද කළ යුතු පියවර:'
                        : varianceLang === 'en'
                          ? 'Practical Action Today:'
                          : 'Action Today · අද කළ යුතු දේ:'}
                    </div>
                    {(varianceLang === 'en' || varianceLang === 'both') && (
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                        {sug.actionEn}
                      </p>
                    )}
                    {(varianceLang === 'si' || varianceLang === 'both') && (
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                        {sug.actionSi}
                      </p>
                    )}
                  </div>

                  {sug.focusContracts.length > 0 && (
                    <div className="pt-1.5 space-y-1">
                      <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                        {varianceLang === 'si'
                          ? 'ප්‍රමුඛතා ගිණුම් (Top Focus):'
                          : 'Priority Contracts to Contact First:'}
                      </div>
                      <div className="space-y-1 font-mono text-[11px] tabular-nums">
                        {sug.focusContracts.map((fc) => (
                          <div
                            key={fc.contractNo}
                            className="flex items-center justify-between gap-2 text-slate-800 dark:text-slate-200"
                          >
                            <span className="font-semibold">{fc.contractNo}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              {fc.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
