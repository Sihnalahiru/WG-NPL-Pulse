import {
  AlertOctagon,
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  History,
  MapPin,
  Plus,
  Search,
  Trash2,
  Truck,
} from 'lucide-react';
import type {
  FilterPreset,
  MrpEnrichment,
  TrackedContract,
} from '../types/recovery';
import {
  exportTrackedToExcel,
  formatCurrencyRs,
  getCapitalNplExposure,
  getDaysRemainingTo30th,
  getMonth30thLabel,
  getSavedNplCapitalValue,
  getTodayISO,
  isBorderlineNplAccount,
  isBrokenPromiseToPay,
  isCrossing91DpdCritical,
  isCurrentNplAccount,
  isNplSavedAccount,
  isPendingHandOver,
  isTodayPromiseToPay,
  isWorstCategory,
  normalizeContractNo,
} from '../utils/recoveryEngine';
import { FinancePortfolioIllustration } from './FinanceIllustrations';
import { PaymentPatternStrip } from './PaymentPatternStrip';

interface TrackingTableProps {
  contracts: TrackedContract[];
  mrpMap?: Map<string, MrpEnrichment>;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  activeFilter: FilterPreset;
  onFilterChange: (filter: FilterPreset) => void;
  onLogVisit: (contract: TrackedContract) => void;
  onEditContract: (contract: TrackedContract) => void;
  onViewHistory: (contract: TrackedContract) => void;
  onRemoveContract: (contractNo: string) => void;
  onOpenAddModal: () => void;
}

export function TrackingTable({
  contracts,
  mrpMap,
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange,
  onLogVisit,
  onEditContract,
  onViewHistory,
  onRemoveContract,
  onOpenAddModal,
}: TrackingTableProps) {
  const todayISO = getTodayISO();
  const daysTo30th = getDaysRemainingTo30th();
  const month30thLabel = getMonth30thLabel();

  const q = searchQuery.trim().toLowerCase();
  const searchMatchedContracts = q
    ? contracts.filter(
        (c) =>
          c.contractNo.toLowerCase().includes(q) ||
          c.cusName.toLowerCase().includes(q) ||
          c.vehicleNo.toLowerCase().includes(q) ||
          (c.ro || c.recoveryOfficer).toLowerCase().includes(q),
      )
    : contracts;

  const counts = {
    all: searchMatchedContracts.length,
    borderline_crossing: searchMatchedContracts.filter((c) =>
      isBorderlineNplAccount(c),
    ).length,
    current_npl: searchMatchedContracts.filter((c) => isCurrentNplAccount(c))
      .length,
    npl_saved: searchMatchedContracts.filter((c) => isNplSavedAccount(c))
      .length,
    today_pp: searchMatchedContracts.filter((c) =>
      isTodayPromiseToPay(c, todayISO),
    ).length,
    broken_pp: searchMatchedContracts.filter((c) =>
      isBrokenPromiseToPay(c, todayISO),
    ).length,
  };

  const filtered = searchMatchedContracts.filter((c) => {
    switch (activeFilter) {
      case 'borderline_crossing':
        return isBorderlineNplAccount(c);
      case 'current_npl':
        return isCurrentNplAccount(c);
      case 'npl_saved':
        return isNplSavedAccount(c);
      case 'today_pp':
        return isTodayPromiseToPay(c, todayISO);
      case 'broken_pp':
        return isBrokenPromiseToPay(c, todayISO);
      default:
        return true;
    }
  });

  const filterButtons: { id: FilterPreset; label: string; count: number }[] = [
    { id: 'all', label: 'All NPL & Borderline', count: counts.all },
    {
      id: 'borderline_crossing',
      label: 'Borderline (Crossing 91 DPD)',
      count: counts.borderline_crossing,
    },
    { id: 'current_npl', label: 'Current NPL (91+ DPD)', count: counts.current_npl },
    { id: 'npl_saved', label: 'NPL Saved', count: counts.npl_saved },
    { id: 'today_pp', label: "Today's PTP", count: counts.today_pp },
    { id: 'broken_pp', label: 'Broken PTP', count: counts.broken_pp },
  ];

  const renderSituationBadge = (c: TrackedContract) => {
    const broken = isBrokenPromiseToPay(c, todayISO);
    const todayPp = isTodayPromiseToPay(c, todayISO);
    const pendingHo = isPendingHandOver(c, todayISO);

    if (isNplSavedAccount(c)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          NPL SAVED
        </span>
      );
    }

    if (broken || c.currentSituation === 'BROKEN P/P') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800 whitespace-nowrap animate-heartbeat">
          <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
          BROKEN P/P
        </span>
      );
    }

    if (pendingHo || c.currentSituation === 'Hand Over Pending') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 whitespace-nowrap">
          <Truck className="w-3.5 h-3.5 shrink-0" />
          Hand Over Due
        </span>
      );
    }

    if (todayPp) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 whitespace-nowrap">
          <CalendarCheck className="w-3.5 h-3.5 shrink-0" />
          Today P/P
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 whitespace-nowrap">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        {c.currentSituation}
      </span>
    );
  };

  const renderBucketMovementStyle = (movement: string) => {
    const m = movement.toLowerCase();
    if (m.includes('forward')) {
      return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800';
    }
    if (m.includes('back')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    }
    return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800';
  };

  return (
    <section
      aria-label="Tracked Recovery Watchlist"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
    >
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Active Watchlist &amp; Field Visit Control
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Showing only explicitly tracked contracts ({filtered.length} of{' '}
              {contracts.length}). Master AERS records stay indexed in background.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:w-64 sm:flex-none">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search contract, client, vehicle, RO..."
                aria-label="Search tracked contracts"
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <button
              type="button"
              onClick={() => exportTrackedToExcel(filtered, 'xlsx')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Export Excel
            </button>

            <button
              type="button"
              onClick={() => exportTrackedToExcel(filtered, 'csv')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Watchlist quick filters"
          className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg overflow-x-auto"
        >
          {filterButtons.map((btn) => {
            const active = activeFilter === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onFilterChange(btn.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                  active
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {btn.label} ({btn.count})
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-10 sm:p-12 text-center flex flex-col items-center">
          <FinancePortfolioIllustration className="w-56 h-auto mb-4" />
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {contracts.length === 0
              ? 'Your Active Watchlist is empty'
              : 'No tracked contracts match the current filter'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            {contracts.length === 0
              ? 'Upload your AERS/MRP Excel report to index Current NPL and Borderline contracts, then add contracts by CONTRACT_NO or paste a contract list.'
              : 'Add an NPL or Borderline contract by CONTRACT_NO to auto-fill from Master Lookup, or switch back to All NPL & Borderline.'}
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            {activeFilter !== 'all' || searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  onFilterChange('all');
                  onSearchChange('');
                }}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                Reset Filters
              </button>
            ) : null}
            <button
              type="button"
              onClick={onOpenAddModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Contract
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4 whitespace-nowrap">Contract &amp; Client</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Vehicle &amp; RO</th>
                <th className="py-2.5 px-3 whitespace-nowrap text-right">DPD / Age</th>
                <th className="py-2.5 px-3 whitespace-nowrap text-right">Debtor &amp; NPL (Rs.)</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Visit / P/P / H/O</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Situation &amp; Remark</th>
                <th className="py-2.5 px-4 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {filtered.map((c) => {
                const crossingCritical = isCrossing91DpdCritical(c);
                const isNpl = c.actualDpd >= 91 || c.npl > 0;
                const isWorst = isWorstCategory(c.nplReason, c.worstCaseProduct);
                const todayPp = isTodayPromiseToPay(c, todayISO);
                const brokenPp = isBrokenPromiseToPay(c, todayISO);

                return (
                  <tr
                    key={c.contractNo}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors align-top"
                  >
                    <td className="py-3 px-4 min-w-[215px]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {c.contractNo}
                        </span>
                        {c.mrp?.borderNpl && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 whitespace-nowrap">
                            BORDER NPL
                          </span>
                        )}
                        {isWorst && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800 whitespace-nowrap">
                            WORST ({c.nplReason || 'W'})
                          </span>
                        )}
                      </div>
                      <div className="font-medium text-slate-700 dark:text-slate-200 mt-0.5">
                        {c.cusName}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                        {c.mobileNo || 'No mobile'}
                      </div>
                      <PaymentPatternStrip
                        mrp={c.mrp ?? mrpMap?.get(normalizeContractNo(c.contractNo))}
                        lastPaidAmount={c.lastPaidAmount}
                        lastPayDate={c.lastPayDate}
                        totalCollection={c.totalCollection}
                        showCategoryLine={true}
                        compact={true}
                      />
                    </td>

                    <td className="py-3 px-3 min-w-[140px]">
                      <div className="font-mono font-medium text-slate-900 dark:text-slate-100">
                        {c.vehicleNo || '—'}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {c.officeType ? `${c.officeType} · ` : ''}RO: {c.ro || c.recoveryOfficer || '—'}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        With: {c.visitWith}
                        {c.assignOfficerEfforts !== undefined
                          ? ` · Efforts: ${c.assignOfficerEfforts}`
                          : ''}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right min-w-[175px] tabular-nums">
                      <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                        <span
                          className={
                            isNpl
                              ? 'text-red-600 dark:text-red-400'
                              : crossingCritical
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-900 dark:text-slate-100'
                          }
                        >
                          {c.actualDpd} DPD
                        </span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className="text-slate-600 dark:text-slate-300">
                          Fcst {c.monthEndForecastDpd}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Op Age {c.opAge.toFixed(2)} · Cur {c.currentAge.toFixed(2)}
                      </div>
                      {(c.mrp?.bucketMovement || c.mrp?.impairmentStage) && (
                        <div className="mt-1 flex flex-wrap items-center justify-end gap-1">
                          {c.mrp.bucketMovement && (
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border whitespace-nowrap ${renderBucketMovementStyle(c.mrp.bucketMovement)}`}
                            >
                              {c.mrp.bucketMovement}
                            </span>
                          )}
                          {c.mrp.impairmentStage && (
                            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {c.mrp.impairmentStage}
                            </span>
                          )}
                        </div>
                      )}
                      {crossingCritical && (
                        <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium rounded bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800 whitespace-nowrap animate-heartbeat">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          CRITICAL: 91 DPD ({daysTo30th}d to {month30thLabel})
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right min-w-[180px] tabular-nums">
                      <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrencyRs(c.closingDebtor)}
                      </div>
                      <div
                        className={`font-mono text-[11px] mt-0.5 ${
                          c.npl > 0
                            ? 'text-red-600 dark:text-red-400 font-medium'
                            : isBorderlineNplAccount(c)
                              ? 'text-amber-700 dark:text-amber-400 font-medium'
                              : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {c.npl > 0
                          ? `Close NPL: ${formatCurrencyRs(c.npl)}`
                          : isBorderlineNplAccount(c)
                            ? `30th NPL Risk: ${formatCurrencyRs(getCapitalNplExposure(c))}`
                            : `Close NPL: ${formatCurrencyRs(c.npl)}`}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        Op Npl: {formatCurrencyRs(c.opNpl)}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Last Paid: {formatCurrencyRs(c.lastPaidAmount)}
                        {c.lastPayDate ? ` (${c.lastPayDate})` : ''}
                      </div>
                    </td>

                    <td className="py-3 px-3 min-w-[155px] tabular-nums">
                      <div className="text-slate-700 dark:text-slate-300">
                        Visit: <span className="font-mono">{c.visitDate || '—'}</span>
                      </div>
                      <div
                        className={`mt-0.5 ${
                          brokenPp
                            ? 'text-red-600 dark:text-red-400 font-semibold'
                            : todayPp
                              ? 'text-blue-600 dark:text-blue-400 font-semibold'
                              : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        P/P: <span className="font-mono">{c.ppDate || '—'}</span>
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                        H/O: <span className="font-mono">{c.handOverDate || '—'}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3 min-w-[230px] max-w-[290px]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {renderSituationBadge(c)}
                        {c.mrpActionCode && (
                          <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 whitespace-nowrap">
                            {c.mrpActionCode}
                          </span>
                        )}
                        {isNplSavedAccount(c) && getSavedNplCapitalValue(c) > 0 && (
                          <span className="text-[11px] font-mono font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
                            +{formatCurrencyRs(getSavedNplCapitalValue(c))}
                          </span>
                        )}
                      </div>
                      {c.mrp?.notPaidSummary && (
                        <div className="mt-1 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                          {c.mrp.notPaidSummary}
                        </div>
                      )}
                      <p className="mt-1.5 text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                        {c.remark || 'No remarks logged yet.'}
                      </p>
                      {c.remarkBy && (
                        <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                          By {c.remarkBy}
                        </p>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onLogVisit(c)}
                          title="Log Follow-Up Visit"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
                        >
                          <Plus className="w-3 h-3" />
                          Log Visit
                        </button>

                        {c.locationUrl ? (
                          <a
                            href={c.locationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={
                              c.locationText
                                ? `${c.locationText} (${c.locationUpdatedAt || ''})`
                                : 'Open Vehicle Location in Google Maps'
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors whitespace-nowrap shrink-0"
                          >
                            <MapPin className="w-3 h-3" />
                            Map
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onEditContract(c)}
                            title="Add Location Pin"
                            className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                          >
                            <MapPin className="w-3 h-3" />
                            Pin
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onViewHistory(c)}
                          title="View Visit History Log"
                          className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 tabular-nums"
                        >
                          <History className="w-3 h-3" />
                          {c.visitHistory.length}
                        </button>

                        <button
                          type="button"
                          onClick={() => onEditContract(c)}
                          title="Edit Contract Details"
                          aria-label={`Edit ${c.contractNo}`}
                          className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onRemoveContract(c.contractNo)}
                          title="Remove from Watchlist"
                          aria-label={`Remove ${c.contractNo}`}
                          className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-900 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
