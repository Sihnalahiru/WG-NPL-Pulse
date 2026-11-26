import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Layers, Search, X } from 'lucide-react';
import type {
  AersRecord,
  ContractSituation,
  MrpEnrichment,
  TrackedContract,
  VisitLogEntry,
  VisitWithOption,
} from '../types/recovery';
import {
  MRP_ACTION_CODE_GROUPS,
  formatCurrencyRs,
  getTodayISO,
  isEligibleNplOrBorderline,
  normalizeContractNo,
  normalizeVehicleNo,
} from '../utils/recoveryEngine';
import { PaymentPatternStrip } from './PaymentPatternStrip';

interface ContractModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit' | 'log_visit';
  initialContract: TrackedContract | null;
  aersMap: Map<string, AersRecord>;
  mrpMap?: Map<string, MrpEnrichment>;
  existingContractNos: Set<string>;
  regularContractNos?: Set<string>;
  onClose: () => void;
  onSaveSingle: (contract: TrackedContract) => void;
  onBulkAdd: (contracts: TrackedContract[]) => void;
}

const VISIT_WITH_OPTIONS: VisitWithOption[] = [
  'My Self',
  'Mr. Damith',
  'BM',
  'Marketing',
];

const SITUATION_OPTIONS: ContractSituation[] = [
  'Active Follow-Up',
  'P/P Promised',
  'NPL SAVED',
  'BROKEN P/P',
  'Hand Over Pending',
  'Legal / Seize',
  'Settled',
];

export function ContractModal({
  isOpen,
  mode,
  initialContract,
  aersMap,
  mrpMap,
  existingContractNos,
  regularContractNos,
  onClose,
  onSaveSingle,
  onBulkAdd,
}: ContractModalProps) {
  const [tab, setTab] = useState<'single' | 'bulk'>('single');
  const [bulkInput, setBulkInput] = useState('');
  const [allowPerformingOverride, setAllowPerformingOverride] = useState(false);
  const [allowBulkOverride, setAllowBulkOverride] = useState(false);

  // Single contract state
  const [contractNo, setContractNo] = useState('');
  const [cusName, setCusName] = useState('');
  const [mobileNo, setMobileNo] = useState('');
  const [address, setAddress] = useState('');
  const [opAge, setOpAge] = useState('0');
  const [currentAge, setCurrentAge] = useState('0');
  const [closingDebtor, setClosingDebtor] = useState('0');
  const [capitalOutstanding, setCapitalOutstanding] = useState('0');
  const [capitalArrears, setCapitalArrears] = useState('0');
  const [opNpl, setOpNpl] = useState('0');
  const [npl, setNpl] = useState('0');
  const [actualDpd, setActualDpd] = useState('0');
  const [monthEndForecastDpd, setMonthEndForecastDpd] = useState('0');
  const [minAmountToReverseNpl, setMinAmountToReverseNpl] = useState('0');
  const [recoveryOfficer, setRecoveryOfficer] = useState('');
  const [lastPayDate, setLastPayDate] = useState('');
  const [lastPaidAmount, setLastPaidAmount] = useState('0');

  // Field visit fields
  const [vehicleNo, setVehicleNo] = useState('');
  const [visitWith, setVisitWith] = useState<VisitWithOption>('My Self');
  const [visitDate, setVisitDate] = useState(getTodayISO());
  const [ppDate, setPpDate] = useState('');
  const [handOverDate, setHandOverDate] = useState('');
  const [remark, setRemark] = useState('');
  const [remarkBy, setRemarkBy] = useState('');
  const [ro, setRo] = useState('');
  const [currentSituation, setCurrentSituation] =
    useState<ContractSituation>('Active Follow-Up');
  const [mrpActionCode, setMrpActionCode] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  const [matchedFromAers, setMatchedFromAers] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTab('single');
    setBulkInput('');
    setAllowPerformingOverride(false);
    setAllowBulkOverride(false);

    if (initialContract) {
      setContractNo(initialContract.contractNo);
      setCusName(initialContract.cusName);
      setMobileNo(initialContract.mobileNo);
      setAddress(initialContract.address);
      setOpAge(String(initialContract.opAge));
      setCurrentAge(String(initialContract.currentAge));
      setClosingDebtor(String(initialContract.closingDebtor));
      setCapitalOutstanding(String(initialContract.capitalOutstanding));
      setCapitalArrears(String(initialContract.capitalArrears ?? 0));
      setOpNpl(String(initialContract.opNpl));
      setNpl(String(initialContract.npl));
      setActualDpd(String(initialContract.actualDpd));
      setMonthEndForecastDpd(String(initialContract.monthEndForecastDpd));
      setMinAmountToReverseNpl(String(initialContract.minAmountToReverseNpl));
      setRecoveryOfficer(initialContract.recoveryOfficer);
      setLastPayDate(initialContract.lastPayDate);
      setLastPaidAmount(String(initialContract.lastPaidAmount));
      setVehicleNo(initialContract.vehicleNo);
      setVisitWith(initialContract.visitWith);
      setVisitDate(
        mode === 'log_visit' ? getTodayISO() : initialContract.visitDate,
      );
      setPpDate(initialContract.ppDate);
      setHandOverDate(initialContract.handOverDate);
      setRemark(mode === 'log_visit' ? '' : initialContract.remark);
      setRemarkBy(initialContract.remarkBy || initialContract.ro || '');
      setRo(initialContract.ro || initialContract.recoveryOfficer);
      setCurrentSituation(initialContract.currentSituation);
      setMrpActionCode(initialContract.mrpActionCode || '');
      setLocationUrl(initialContract.locationUrl);
      setMatchedFromAers(aersMap.has(normalizeContractNo(initialContract.contractNo)));
    } else {
      setContractNo('');
      setCusName('');
      setMobileNo('');
      setAddress('');
      setOpAge('0');
      setCurrentAge('0');
      setClosingDebtor('0');
      setCapitalOutstanding('0');
      setCapitalArrears('0');
      setOpNpl('0');
      setNpl('0');
      setActualDpd('0');
      setMonthEndForecastDpd('0');
      setMinAmountToReverseNpl('0');
      setRecoveryOfficer('');
      setLastPayDate('');
      setLastPaidAmount('0');
      setVehicleNo('');
      setVisitWith('My Self');
      setVisitDate(getTodayISO());
      setPpDate('');
      setHandOverDate('');
      setRemark('');
      setRemarkBy('');
      setRo('');
      setCurrentSituation('Active Follow-Up');
      setMrpActionCode('');
      setLocationUrl('');
      setMatchedFromAers(false);
    }
  }, [isOpen, initialContract, mode, aersMap]);

  const applyAersMatch = (record: AersRecord) => {
    setContractNo(record.contractNo);
    setCusName(record.cusName);
    setMobileNo(record.mobileNo);
    setAddress(record.address);
    setOpAge(String(record.opAge));
    setCurrentAge(String(record.currentAge));
    setClosingDebtor(String(record.closingDebtor));
    setCapitalOutstanding(String(record.capitalOutstanding));
    setCapitalArrears(String(record.capitalArrears ?? 0));
    setOpNpl(String(record.opNpl));
    setNpl(String(record.npl));
    setActualDpd(String(record.actualDpd));
    setMonthEndForecastDpd(String(record.monthEndForecastDpd));
    setMinAmountToReverseNpl(String(record.minAmountToReverseNpl));
    setRecoveryOfficer(record.recoveryOfficer);
    setLastPayDate(record.lastPayDate);
    setLastPaidAmount(String(record.lastPaidAmount));
    if (!vehicleNo && record.currentStock) {
      setVehicleNo(record.currentStock);
    }
    if (!ro && record.recoveryOfficer) {
      setRo(record.recoveryOfficer);
    }
    if (!remarkBy && record.recoveryOfficer) {
      setRemarkBy(record.recoveryOfficer);
    }
    setMatchedFromAers(true);
  };

  const handleContractNoChange = (val: string) => {
    setContractNo(val);
    setAllowPerformingOverride(false);
    const key = normalizeContractNo(val);
    const found = aersMap.get(key);
    if (found) {
      applyAersMatch(found);
    } else {
      setMatchedFromAers(false);
    }
  };

  const cleanContractNo = normalizeContractNo(contractNo);
  const isKnownRegularAccount = Boolean(
    mode === 'add' &&
      cleanContractNo &&
      !matchedFromAers &&
      regularContractNos?.has(cleanContractNo),
  );
  const isManualNonNplAccount = Boolean(
    mode === 'add' &&
      cleanContractNo.length >= 4 &&
      !matchedFromAers &&
      !isKnownRegularAccount &&
      !mrpMap?.get(cleanContractNo)?.borderNpl &&
      !isEligibleNplOrBorderline({
        npl: Number(npl) || 0,
        opNpl: Number(opNpl) || 0,
        actualDpd: Number(actualDpd) || 0,
        opAge: Number(opAge) || 0,
        monthEndForecastDpd: Number(monthEndForecastDpd) || 0,
      }),
  );
  const showNonNplWarning = isKnownRegularAccount || isManualNonNplAccount;

  const suggestions = useMemo(() => {
    if (mode !== 'add') return [];
    const q = contractNo.trim().toUpperCase();
    if (q.length < 2 || matchedFromAers) return [];
    const list: AersRecord[] = [];
    for (const rec of aersMap.values()) {
      if (
        rec.contractNo.includes(q) ||
        rec.cusName.toUpperCase().includes(q)
      ) {
        list.push(rec);
        if (list.length >= 6) break;
      }
    }
    return list;
  }, [contractNo, aersMap, mode, matchedFromAers]);

  const bulkPreview = useMemo(() => {
    const tokens = Array.from(
      new Set(
        bulkInput
          .split(/[\s,;|\n\r]+/)
          .map((t) => normalizeContractNo(t))
          .filter((t) => t.length >= 4),
      ),
    );
    return tokens.map((tok) => {
      const aers = aersMap.get(tok);
      const alreadyTracked = existingContractNos.has(tok);
      const isRegular = !aers && Boolean(regularContractNos?.has(tok));
      return { contractNo: tok, aers, alreadyTracked, isRegular };
    });
  }, [bulkInput, aersMap, existingContractNos, regularContractNos]);

  if (!isOpen) return null;

  const handleSubmitSingle = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNo = normalizeContractNo(contractNo);
    if (!cleanNo) return;

    const existingHistory = initialContract?.visitHistory ?? [];
    const shouldAppendLog =
      mode === 'log_visit' ||
      (!initialContract && (remark.trim() !== '' || visitDate !== '')) ||
      (initialContract &&
        remark.trim() !== '' &&
        remark.trim() !== initialContract.remark.trim());

    const newLog: VisitLogEntry | null = shouldAppendLog
      ? {
          id: `v_${Date.now()}`,
          visitDate: visitDate || getTodayISO(),
          visitWith,
          mrpActionCode: mrpActionCode || undefined,
          ppDate,
          handOverDate,
          remark: remark.trim() || 'Follow-up visit logged',
          remarkBy: remarkBy.trim() || ro.trim() || recoveryOfficer || 'Officer',
          situation: currentSituation,
          locationUrl: locationUrl.trim() || undefined,
          loggedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
        }
      : null;

    const updatedHistory = newLog
      ? [...existingHistory, newLog]
      : existingHistory;

    const parsedOpNpl = Number(opNpl) || 0;
    const parsedCap = Number(capitalOutstanding) || 0;
    const parsedCapArrears = Number(capitalArrears) || 0;
    const matchedAers = aersMap.get(cleanNo);
    const matchedMrp = mrpMap?.get(cleanNo);

    const payload: TrackedContract = {
      contractNo: cleanNo,
      cusName: cusName.trim() || 'Unnamed Client',
      mobileNo: mobileNo.trim(),
      address: address.trim(),
      opAge: Number(opAge) || 0,
      currentAge: Number(currentAge) || 0,
      opBalDebtor: matchedAers?.opBalDebtor ?? initialContract?.opBalDebtor,
      closingDebtor: Number(closingDebtor) || 0,
      capitalOutstanding: parsedCap,
      opCapitalOutstanding:
        matchedAers?.opCapitalOutstanding ?? initialContract?.opCapitalOutstanding,
      capitalArrears: parsedCapArrears,
      currentMonthDue:
        matchedAers?.currentMonthDue ?? initialContract?.currentMonthDue,
      totalCollection:
        matchedAers?.totalCollection ?? initialContract?.totalCollection,
      opNpl: parsedOpNpl,
      npl: Number(npl) || 0,
      actualDpd: Number(actualDpd) || 0,
      monthEndForecastDpd: Number(monthEndForecastDpd) || 0,
      minAmountToReverseNpl: Number(minAmountToReverseNpl) || 0,
      recoveryOfficer: recoveryOfficer.trim() || ro.trim(),
      marketingOfficer:
        matchedAers?.marketingOfficer ?? initialContract?.marketingOfficer ?? '',
      lastPayDate: lastPayDate.trim(),
      lastPaidAmount: Number(lastPaidAmount) || 0,
      nplReason: matchedAers?.nplReason ?? initialContract?.nplReason,
      worstCaseProduct:
        matchedAers?.worstCaseProduct ?? initialContract?.worstCaseProduct,
      officeType: matchedAers?.officeType ?? initialContract?.officeType,
      assignOfficerEfforts:
        matchedAers?.assignOfficerEfforts ?? initialContract?.assignOfficerEfforts,
      totalEfforts: matchedAers?.totalEfforts ?? initialContract?.totalEfforts,
      vehicleNo: vehicleNo ? normalizeVehicleNo(vehicleNo) : '',
      visitWith,
      visitDate,
      ppDate,
      handOverDate,
      remark: remark.trim() || initialContract?.remark || '',
      remarkBy: remarkBy.trim() || ro.trim(),
      ro: ro.trim() || recoveryOfficer.trim(),
      currentSituation,
      mrpActionCode: mrpActionCode || undefined,
      mrp: matchedMrp ?? initialContract?.mrp,
      locationUrl: locationUrl.trim(),
      locationUpdatedAt:
        locationUrl.trim() && locationUrl.trim() !== initialContract?.locationUrl
          ? getTodayISO()
          : initialContract?.locationUpdatedAt,
      locationText: initialContract?.locationText,
      nplSavedAmount:
        currentSituation === 'NPL SAVED'
          ? initialContract?.nplSavedAmount ||
            parsedOpNpl ||
            parsedCap + parsedCapArrears ||
            Number(closingDebtor) ||
            0
          : 0,
      addedAt: initialContract?.addedAt ?? getTodayISO(),
      lastSyncedAt: initialContract?.lastSyncedAt,
      visitHistory: updatedHistory,
    };

    onSaveSingle(payload);
    onClose();
  };

  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const toAdd: TrackedContract[] = bulkPreview
      .filter(
        (item) =>
          !item.alreadyTracked && (!item.isRegular || allowBulkOverride),
      )
      .map((item) => {
        const a = item.aers;
        const today = getTodayISO();
        if (a) {
          return {
            contractNo: a.contractNo,
            cusName: a.cusName,
            mobileNo: a.mobileNo,
            address: a.address,
            opAge: a.opAge,
            currentAge: a.currentAge,
            opBalDebtor: a.opBalDebtor,
            closingDebtor: a.closingDebtor,
            capitalOutstanding: a.capitalOutstanding,
            opCapitalOutstanding: a.opCapitalOutstanding,
            capitalArrears: a.capitalArrears,
            currentMonthDue: a.currentMonthDue,
            totalCollection: a.totalCollection,
            opNpl: a.opNpl,
            npl: a.npl,
            actualDpd: a.actualDpd,
            monthEndForecastDpd: a.monthEndForecastDpd,
            minAmountToReverseNpl: a.minAmountToReverseNpl,
            recoveryOfficer: a.recoveryOfficer,
            marketingOfficer: a.marketingOfficer,
            lastPayDate: a.lastPayDate,
            lastPaidAmount: a.lastPaidAmount,
            nplReason: a.nplReason,
            worstCaseProduct: a.worstCaseProduct,
            officeType: a.officeType,
            assignOfficerEfforts: a.assignOfficerEfforts,
            totalEfforts: a.totalEfforts,
            vehicleNo: a.currentStock ? normalizeVehicleNo(a.currentStock) : '',
            visitWith: 'My Self',
            visitDate: today,
            ppDate: '',
            handOverDate: '',
            remark: 'Added via bulk watchlist import.',
            remarkBy: a.recoveryOfficer || 'RO',
            ro: a.recoveryOfficer,
            currentSituation: 'Active Follow-Up',
            mrp: mrpMap?.get(normalizeContractNo(a.contractNo)),
            locationUrl: '',
            nplSavedAmount: 0,
            addedAt: today,
            visitHistory: [],
          };
        }
        return {
          contractNo: item.contractNo,
          cusName: 'Pending AERS Match',
          mobileNo: '',
          address: '',
          opAge: 0,
          currentAge: 0,
          closingDebtor: 0,
          capitalOutstanding: 0,
          opNpl: 0,
          npl: 0,
          actualDpd: 0,
          monthEndForecastDpd: 0,
          minAmountToReverseNpl: 0,
          recoveryOfficer: '',
          marketingOfficer: '',
          lastPayDate: '',
          lastPaidAmount: 0,
          vehicleNo: '',
          visitWith: 'My Self',
          visitDate: today,
          ppDate: '',
          handOverDate: '',
          remark: 'Added manually (not yet in uploaded AERS lookup).',
          remarkBy: '',
          ro: '',
          currentSituation: 'Active Follow-Up',
          locationUrl: '',
          nplSavedAmount: 0,
          addedAt: today,
          visitHistory: [],
        };
      });

    if (toAdd.length > 0) {
      onBulkAdd(toAdd);
    }
    onClose();
  };

  const modalTitle =
    mode === 'log_visit'
      ? `Log Follow-Up Visit · ${initialContract?.contractNo}`
      : mode === 'edit'
        ? `Edit Tracked Contract · ${initialContract?.contractNo}`
        : 'Add Contract to Active Watchlist';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contract-modal-title"
    >
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h2
              id="contract-modal-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              {modalTitle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Type a CONTRACT_NO (e.g. WGFBA058325) to auto-fill balances, DPD, and RO from AERS Master Lookup.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {mode === 'add' && (
          <div className="px-5 pt-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('single')}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === 'single'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Single Entry &amp; Auto-Fill
            </button>
            <button
              type="button"
              onClick={() => setTab('bulk')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === 'bulk'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Bulk Paste Contract List
            </button>
          </div>
        )}

        {tab === 'bulk' && mode === 'add' ? (
          <form
            onSubmit={handleBulkSubmit}
            className="p-5 overflow-y-auto space-y-4 flex-1"
          >
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Paste CONTRACT_NO list (separated by commas, spaces, or new lines)
              </label>
              <textarea
                rows={5}
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder={'WGFBA070001\nWGFBA070002, WGFBA070003'}
                className="w-full p-3 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            {bulkPreview.length > 0 && (
              <div className="space-y-3">
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                    Detected {bulkPreview.length} contracts ·{' '}
                    {bulkPreview.filter((x) => x.aers).length} NPL/Borderline matched ·{' '}
                    {bulkPreview.filter((x) => x.isRegular).length} regular excluded ·{' '}
                    {
                      bulkPreview.filter(
                        (x) =>
                          !x.alreadyTracked && (!x.isRegular || allowBulkOverride),
                      ).length
                    }{' '}
                    new to add
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                    {bulkPreview.map((item) => (
                      <div
                        key={item.contractNo}
                        className="px-3 py-2 flex items-center justify-between gap-2"
                      >
                        <div>
                          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                            {item.contractNo}
                          </span>
                          <span className="ml-2 text-slate-600 dark:text-slate-300">
                            {item.aers
                              ? item.aers.cusName
                              : item.isRegular
                                ? 'Performing / Regular account'
                                : 'Manual entry (not in AERS)'}
                          </span>
                        </div>
                        <div className="text-right tabular-nums whitespace-nowrap">
                          {item.alreadyTracked ? (
                            <span className="text-slate-400">Already Tracked</span>
                          ) : item.isRegular ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              Not an NPL or Borderline contract
                            </span>
                          ) : item.aers ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                              {formatCurrencyRs(item.aers.closingDebtor)} ·{' '}
                              {item.aers.actualDpd} DPD
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400">
                              Will add manual
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {bulkPreview.some((x) => x.isRegular && !x.alreadyTracked) && (
                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowBulkOverride}
                      onChange={(e) => setAllowBulkOverride(e.target.checked)}
                      className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                    />
                    <span>
                      Override: Include regular/performing contracts in this bulk import
                    </span>
                  </label>
                )}
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  bulkPreview.filter(
                    (x) =>
                      !x.alreadyTracked && (!x.isRegular || allowBulkOverride),
                  ).length === 0
                }
                className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Add{' '}
                {
                  bulkPreview.filter(
                    (x) =>
                      !x.alreadyTracked && (!x.isRegular || allowBulkOverride),
                  ).length
                }{' '}
                Contracts
              </button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={handleSubmitSingle}
            className="p-5 overflow-y-auto space-y-5 flex-1"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="relative sm:col-span-1">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  CONTRACT_NO *
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    disabled={mode !== 'add'}
                    value={contractNo}
                    onChange={(e) => handleContractNoChange(e.target.value)}
                    placeholder="WGFBA058325"
                    className="w-full pl-8 pr-3 py-2 text-xs font-mono uppercase rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                {matchedFromAers && (
                  <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" />
                    Auto-filled from NPL &amp; Borderline Lookup
                  </p>
                )}
                {showNonNplWarning && (
                  <div className="mt-1.5 space-y-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      Not an NPL or Borderline contract
                    </span>
                    <label className="flex items-start gap-1.5 text-[11px] text-amber-800 dark:text-amber-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowPerformingOverride}
                        onChange={(e) =>
                          setAllowPerformingOverride(e.target.checked)
                        }
                        className="mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                      />
                      <span>Override &amp; add anyway</span>
                    </label>
                  </div>
                )}
                {suggestions.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {suggestions.map((rec) => (
                      <button
                        key={rec.contractNo}
                        type="button"
                        onClick={() => applyAersMatch(rec)}
                        className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between gap-2"
                      >
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {rec.contractNo}
                        </span>
                        <span className="truncate text-slate-500 dark:text-slate-400">
                          {rec.cusName}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="sm:col-span-1">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Client Name (CUS_NAME)
                </label>
                <input
                  type="text"
                  required
                  value={cusName}
                  onChange={(e) => setCusName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="sm:col-span-1">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Mobile No (MOBILE_NO)
                </label>
                <input
                  type="text"
                  value={mobileNo}
                  onChange={(e) => setMobileNo(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Payment History (Jan–Oct Pattern)
              </div>
              <PaymentPatternStrip
                mrp={mrpMap?.get(normalizeContractNo(contractNo)) ?? initialContract?.mrp}
                lastPaidAmount={Number(lastPaidAmount) || initialContract?.lastPaidAmount}
                lastPayDate={lastPayDate || initialContract?.lastPayDate}
                showCategoryLine={true}
                compact={false}
              />
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs tabular-nums">
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  CLOSING_DEBTOR
                </label>
                <input
                  type="number"
                  step="any"
                  value={closingDebtor}
                  onChange={(e) => setClosingDebtor(e.target.value)}
                  className="w-full px-2 py-1.5 font-mono rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  Cap O/S &amp; Cap Arrears
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="number"
                    step="any"
                    value={capitalOutstanding}
                    onChange={(e) => setCapitalOutstanding(e.target.value)}
                    title="CAPITAL_OUTSTANDING"
                    className="w-full px-2 py-1.5 font-mono rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="number"
                    step="any"
                    value={capitalArrears}
                    onChange={(e) => setCapitalArrears(e.target.value)}
                    title="CAPITAL_ARREARS"
                    className="w-full px-2 py-1.5 font-mono rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  Op Npl / Current NPL
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="number"
                    step="any"
                    value={opNpl}
                    onChange={(e) => setOpNpl(e.target.value)}
                    title="Op Npl"
                    className="w-full px-2 py-1.5 font-mono rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="number"
                    step="any"
                    value={npl}
                    onChange={(e) => setNpl(e.target.value)}
                    title="Current NPL"
                    className="w-full px-2 py-1.5 font-mono rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  Actual / Forecast DPD
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="number"
                    value={actualDpd}
                    onChange={(e) => setActualDpd(e.target.value)}
                    title="ACTUAL_DPD"
                    className="w-full px-2 py-1.5 font-mono rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="number"
                    value={monthEndForecastDpd}
                    onChange={(e) => setMonthEndForecastDpd(e.target.value)}
                    title="MONTH_END_FORECAST_DPD"
                    className="w-full px-2 py-1.5 font-mono rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Vehicle No
                </label>
                <input
                  type="text"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                  placeholder="BAV-2298"
                  className="w-full px-3 py-2 text-xs font-mono uppercase rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Visit With
                </label>
                <select
                  value={visitWith}
                  onChange={(e) =>
                    setVisitWith(e.target.value as VisitWithOption)
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  {VISIT_WITH_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Current Situation
                </label>
                <select
                  value={currentSituation}
                  onChange={(e) =>
                    setCurrentSituation(e.target.value as ContractSituation)
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  {SITUATION_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Visit Date
                </label>
                <input
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  P/P Date (Promise to Pay)
                </label>
                <input
                  type="date"
                  value={ppDate}
                  onChange={(e) => setPpDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Hand Over Date
                </label>
                <input
                  type="date"
                  value={handOverDate}
                  onChange={(e) => setHandOverDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  RO (Recovery Officer)
                </label>
                <input
                  type="text"
                  value={ro}
                  onChange={(e) => setRo(e.target.value)}
                  placeholder="N. Bandara"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Remark By
                </label>
                <input
                  type="text"
                  value={remarkBy}
                  onChange={(e) => setRemarkBy(e.target.value)}
                  placeholder="Officer name"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Location Pin / Map URL
                </label>
                <input
                  type="url"
                  value={locationUrl}
                  onChange={(e) => setLocationUrl(e.target.value)}
                  placeholder="https://maps.google.com/..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="sm:col-span-3">
                <label
                  htmlFor="mrp-action-code-select"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  MRP Official Action Code
                </label>
                <select
                  id="mrp-action-code-select"
                  value={mrpActionCode}
                  onChange={(e) => setMrpActionCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">-- Select MRP Action Code (Optional) --</option>
                  {MRP_ACTION_CODE_GROUPS.map((group) => (
                    <optgroup key={group.category} label={group.category}>
                      {group.options.map((opt) => (
                        <option key={opt.code} value={opt.code}>
                          {opt.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Field Visit Remark (saved to Visit History Log)
              </label>
              <textarea
                rows={3}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Enter field visit observations, client commitment, or collection follow-up notes..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={showNonNplWarning && !allowPerformingOverride}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {mode === 'log_visit'
                  ? 'Append Visit & Save'
                  : mode === 'edit'
                    ? 'Save Changes'
                    : 'Add to Watchlist'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
