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
        title: `Plus (+) NPL Variance: +${formatCompactRs(targetDelta)} Saved`,
        detail: `${targetName} has reduced Opening NPL from ${formatCompactRs(targetOpNpl)} down to ${formatCompactRs(targetCloseNpl)}. Maintain daily PTP follow-ups to lock month-end gains.`,
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
        title: `Save ${targetBorderlineCount} Borderline Accounts with ${formatCompactRs(targetBorderlineMinSave)}`,
        detail: `Collecting the minimum reversal amount (${formatCompactRs(targetBorderlineMinSave)}) before the 30th prevents forward bucket slippage into NPL.`,
      });
    }

    if (targetZeroEffort > 0) {
      suggestions.push({
        tone: 'critical',
        title: `${targetZeroEffort} Borderline Accounts Have Zero (0) Officer Efforts`,
        detail: `Immediate call/field visit action required on uncontacted 61–90 DPD accounts to secure Promise-to-Pay (PTP) commitments.`,
      });
    }

    return {
      targetName,
      targetDelta,
      branchNetDelta,
      targetOpNpl,
      targetCloseNpl,
      suggestions,
    };
  }, [officerCards, selectedOfficer]);

  // Campaign Nov 2026 - Mar 2027 monthly series
  const campaignSeries = useMemo(() => {
    return CAMPAIGN_MONTHS.map((m) => {
      const snaps = safeSnapshots.filter((s) => s.monthKey === m.monthKey);
      const latest = snaps[snaps.length - 1];
      return {
        ...m,
        hasData: Boolean(latest),
        nplAmount: latest ? latest.branchNpl || latest.trackedNpl : 0,
        savedAmount: latest ? latest.nplSavedAmount : 0,
        collectionPct: latest ? latest.branchCollectionPct || latest.collectionPct : 0,
        snapshotDate: latest?.snapshotDate || 'Pending',
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
            <option value="ALL">All Officers — Branch Portfolio ({officerCards.length})</option>
            {officerCards.map((c) => (
              <option key={c.officer} value={c.officer}>
                {c.officer} ({c.officeType}) · {c.closingCount} Accts · NPL {formatCompactRs(c.closingNpl)}
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

      {/* TAB 1: Creative RO / MO Profile Cards */}
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
                const variance = card.openingNpl - card.closingNpl;
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
                    {/* Card Header: Officer Pic + Name + Role */}
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

                    {/* Core Metrics Grid matching Sketch */}
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
                            {card.borderlineCount} Cases · {formatCompactRs(card.borderlineAmount)}
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
                          <UserAvatar name={item.officer} sizeClass="w-6 h-6 text-[9px]" />
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

          {/* 5-Month Campaign Strip */}
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
                  {m.hasData ? `Saved: ${formatCompactRs(m.savedAmount)}` : 'Awaiting AERS'}
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
                    officerCards.reduce((s, c) => s + c.openingNpl, 0),
                  )}
                </div>
              </div>
              <div>
                <span className="text-[11px] text-slate-500">Branch Closing NPL</span>
                <div className="mt-1 text-base font-mono font-bold text-rose-600 dark:text-rose-400">
                  {formatCompactRs(
                    officerCards.reduce((s, c) => s + c.closingNpl, 0),
                  )}
                </div>
              </div>
              <div>
                <span className="text-[11px] text-slate-500">Branch Borderline Exposure</span>
                <div className="mt-1 text-base font-mono font-bold text-amber-600 dark:text-amber-400">
                  {formatCompactRs(
                    officerCards.reduce((s, c) => s + c.borderlineAmount, 0),
                  )}
                </div>
              </div>
              <div>
                <span className="text-[11px] text-slate-500">Branch Net Variance</span>
                <div className="mt-1 text-base font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCompactRs(
                    officerCards.reduce(
                      (s, c) => s + (c.openingNpl - c.closingNpl),
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
                    <th className="py-2.5 px-3 text-right">Net Variance (+/-)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                  {officerCards.map((c) => {
                    const delta = c.openingNpl - c.closingNpl;
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
                          {c.borderlineCount} · {formatCompactRs(c.borderlineAmount)}
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

      {/* TAB 4: Daily AI Intelligence Variance (+/-) & Suggestions */}
      {activeHighlightTab === 'ai_variance' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-emerald-950 text-white">
            <div className="flex items-center gap-3">
              <Bot className="w-6 h-6 text-emerald-400 shrink-0" />
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Daily Intelligence Variance Engine · {aersMeta?.printedDateTime || 'Latest Snapshot'}
                </div>
                <div className="text-sm font-bold mt-0.5">
                  Target Scope: {aiVarianceInsights.targetName}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 font-mono tabular-nums">
              <div className="px-3 py-1.5 rounded-xl bg-white/10 text-xs">
                <span className="text-slate-300">Daily Variance: </span>
                <span
                  className={`font-bold ${
                    aiVarianceInsights.targetDelta >= 0
                      ? 'text-emerald-300'
                      : 'text-rose-300'
                  }`}
                >
                  {aiVarianceInsights.targetDelta >= 0 ? '+PLUS ' : '-MINUS '}
                  {formatCompactRs(Math.abs(aiVarianceInsights.targetDelta))}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {aiVarianceInsights.suggestions.map((sug, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-2xl border space-y-2 ${
                  sug.tone === 'positive'
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
                    : sug.tone === 'warning'
                      ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
                      : 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                  {sug.tone === 'positive' ? (
                    <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{sug.title}</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {sug.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
