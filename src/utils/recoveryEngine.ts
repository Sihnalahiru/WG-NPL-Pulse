import * as XLSX from 'xlsx';
import type {
  AersMetadata,
  AersRecord,
  AgeBucketDatum,
  AgeGroupEffortRow,
  BelowOneQuickWinItem,
  BelowThreeCollectionSnapshot,
  BelowThreeContractItem,
  BelowThreeOfficerRow,
  BelowThreeSubBucket,
  BmAgeBucketDatum,
  BmDashboardBelowThreeExtracted,
  BmOfficerPerformanceRow,
  BorderlineAccountItem,
  BorderlineSaveAnalysis,
  ContractSituation,
  MonthlySnapshot,
  MrpActionCategory,
  MrpEnrichment,
  MrpPaymentMonth,
  OfficeTypeOfficerRow,
  OfficeTypeSummary,
  OfficerEffortSummaryRow,
  OfficerEvaluationRow,
  OpeningOfficerBaseline,
  Sheet2WatchlistRow,
  StaffAssignedContract,
  StaffDailySnapshotEntry,
  TrackedContract,
  WhatsAppLocationMatch,
  WorstCaseAccountItem,
  WorstCaseAnalysis,
} from '../types/recovery';

export interface MrpActionCodeOption {
  code: string;
  label: string;
  category: MrpActionCategory;
}

export const MRP_ACTION_CODE_GROUPS: {
  category: MrpActionCategory;
  options: MrpActionCodeOption[];
}[] = [
  {
    category: 'PLANNING',
    options: [
      { code: 'PLC', label: 'PLC - Call Borrower', category: 'PLANNING' },
      { code: 'PLV', label: 'PLV - Visit Borrower', category: 'PLANNING' },
      { code: 'REP', label: 'REP - Repossession', category: 'PLANNING' },
      { code: 'TRS', label: 'TRS - Reschedule', category: 'PLANNING' },
      { code: 'RFN', label: 'RFN - Refinance', category: 'PLANNING' },
    ],
  },
  {
    category: 'ACTIONS',
    options: [
      { code: 'CBR', label: 'CBR - Called Borrower', category: 'ACTIONS' },
      { code: 'CBP', label: 'CBP - Called & Obtained PTP', category: 'ACTIONS' },
      { code: 'VBR', label: 'VBR - Visited Borrower', category: 'ACTIONS' },
      { code: 'VGR', label: 'VGR - Visited Guarantor', category: 'ACTIONS' },
      { code: 'LET', label: 'LET - Demand Letter Sent', category: 'ACTIONS' },
      { code: 'ATH', label: 'ATH - Ready for Handover', category: 'ACTIONS' },
      { code: 'RPO', label: 'RPO - Vehicle Repossessed', category: 'ACTIONS' },
    ],
  },
  {
    category: 'FOLLOW-UP / CHALLENGES',
    options: [
      { code: 'PTP', label: 'PTP - Promise to Pay', category: 'FOLLOW-UP / CHALLENGES' },
      { code: 'BPT', label: 'BPT - Broken PTP', category: 'FOLLOW-UP / CHALLENGES' },
      { code: 'RPL', label: 'RPL - Repayment Plan Agreed', category: 'FOLLOW-UP / CHALLENGES' },
      { code: 'PAI', label: 'PAI - Fully Settled', category: 'FOLLOW-UP / CHALLENGES' },
      { code: 'NCH', label: 'NCH - House Locked', category: 'FOLLOW-UP / CHALLENGES' },
      { code: 'NCB', label: 'NCB - Not Available', category: 'FOLLOW-UP / CHALLENGES' },
      { code: 'REF', label: 'REF - Refused to Pay', category: 'FOLLOW-UP / CHALLENGES' },
      { code: 'WNP', label: 'WNP - No Capacity', category: 'FOLLOW-UP / CHALLENGES' },
      { code: 'SKP', label: 'SKP - Skipped', category: 'FOLLOW-UP / CHALLENGES' },
    ],
  },
];

export const CAMPAIGN_MONTHS: { monthKey: string; label: string }[] = [
  { monthKey: '2026-11', label: 'Nov 2026' },
  { monthKey: '2026-12', label: 'Dec 2026' },
  { monthKey: '2027-01', label: 'Jan 2027' },
  { monthKey: '2027-02', label: 'Feb 2027' },
  { monthKey: '2027-03', label: 'Mar 2027' },
];

export function stripOfficerPrefix(name?: string): string {
  return (name || '').replace(/^(ro|mo)\s*:\s*/i, '').trim();
}

export function isMarketingOfficeType(officeType?: string): boolean {
  const ot = (officeType || '').trim().toUpperCase();
  return (
    ot === 'MO' ||
    ot.startsWith('MO-') ||
    ot.startsWith('MO ') ||
    ot.includes('MARKETING')
  );
}

export function getOfficerByOfficeType(rec: {
  officeType?: string;
  marketingOfficer?: string;
  recoveryOfficer?: string;
  ro?: string;
}): string {
  const mo = stripOfficerPrefix(rec.marketingOfficer);
  const ro = stripOfficerPrefix(rec.recoveryOfficer || rec.ro);
  if (isMarketingOfficeType(rec.officeType)) {
    return mo || ro || 'Unassigned';
  }
  return ro || mo || 'Unassigned';
}

export function isWorstCategory(
  nplReason?: string,
  worstCaseProduct?: string,
): boolean {
  const r = (nplReason || '').trim().toUpperCase();
  if (r === 'W' || /^W[\s/:-]|^WORST\b/i.test(r)) return true;
  const p = (worstCaseProduct || '').trim().toUpperCase();
  if (p === 'W' || /^WORST\b/i.test(p)) return true;
  return false;
}

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface SystemActiveDateTime {
  isoTimestamp: string;
  systemDate: string;
  systemTime: string;
  systemTime12h: string;
  systemDateTime: string;
  displayLabel: string;
  timeZone: string;
}

export function captureSystemActiveDateTime(
  now: Date = new Date(),
): SystemActiveDateTime {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh24 = now.getHours();
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  const systemDate = `${y}-${m}-${d}`;
  const systemTime = `${String(hh24).padStart(2, '0')}:${mm}:${ss}`;
  const ampm = hh24 >= 12 ? 'PM' : 'AM';
  const hh12 = hh24 % 12 === 0 ? 12 : hh24 % 12;
  const systemTime12h = `${String(hh12).padStart(2, '0')}:${mm}:${ss} ${ampm}`;
  const systemDateTime = `${systemDate} ${systemTime}`;
  const displayLabel = `${systemDate} · ${systemTime12h}`;

  let timeZone = 'Local';
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
  } catch {
    timeZone = 'Local';
  }

  return {
    isoTimestamp: now.toISOString(),
    systemDate,
    systemTime,
    systemTime12h,
    systemDateTime,
    displayLabel,
    timeZone,
  };
}

export function formatCurrencyRs(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `Rs. ${safe.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Always show exact comma-separated amount (e.g. Rs. 310,000) across the entire app instead of K/M abbreviations
export function formatCompactRs(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const hasDecimals = Math.abs(safe % 1) >= 0.005;
  return `Rs. ${safe.toLocaleString('en-LK', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  })}`;
}

export function getDaysRemainingTo30th(referenceDate = new Date()): number {
  const day = referenceDate.getDate();
  if (day <= 30) {
    return 30 - day;
  }
  return 0;
}

export function getMonth30thLabel(referenceDate = new Date()): string {
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${monthNames[referenceDate.getMonth()]} 30`;
}

export function isCrossing91DpdCritical(contract: TrackedContract): boolean {
  return contract.actualDpd < 91 && contract.monthEndForecastDpd >= 91;
}

export function isCurrentNplAccount(rec: {
  npl: number;
  actualDpd: number;
}): boolean {
  return (rec.npl || 0) > 0 || (rec.actualDpd || 0) >= 91;
}

export function getCapitalNplExposure(rec: {
  npl?: number;
  opNpl?: number;
  capitalOutstanding?: number;
  opCapitalOutstanding?: number;
  capitalArrears?: number;
  closingDebtor?: number;
}): number {
  if ((rec.npl || 0) > 0) return rec.npl || 0;
  const cap =
    (rec.capitalOutstanding || rec.opCapitalOutstanding || 0) +
    (rec.capitalArrears || 0);
  if (cap > 0) return cap;
  if ((rec.opNpl || 0) > 0) return rec.opNpl || 0;
  return rec.closingDebtor || 0;
}

export function getSavedNplCapitalValue(rec: {
  nplSavedAmount?: number;
  opNpl?: number;
  capitalOutstanding?: number;
  opCapitalOutstanding?: number;
  capitalArrears?: number;
  closingDebtor?: number;
}): number {
  if ((rec.nplSavedAmount || 0) > 0) return rec.nplSavedAmount || 0;
  if ((rec.opNpl || 0) > 0) return rec.opNpl || 0;
  const cap =
    (rec.opCapitalOutstanding || rec.capitalOutstanding || 0) +
    (rec.capitalArrears || 0);
  if (cap > 0) return cap;
  return rec.closingDebtor || 0;
}

export function isNplSavedAccount(rec: {
  currentSituation?: ContractSituation;
  opNpl?: number;
  opAge?: number;
  npl?: number;
  actualDpd: number;
  monthEndForecastDpd?: number;
  totalCollection?: number;
  lastPaidAmount?: number;
}): boolean {
  if (
    (rec.npl || 0) > 0 ||
    (rec.actualDpd || 0) >= 91 ||
    (rec.monthEndForecastDpd || 0) >= 91
  ) {
    return false;
  }
  if (rec.currentSituation === 'NPL SAVED') return true;

  if ((rec.opNpl || 0) > 0) {
    return true;
  }

  const forecast = rec.monthEndForecastDpd ?? 0;
  const hasPaymentOrSafeForecast =
    (rec.totalCollection || 0) > 0 ||
    (rec.lastPaidAmount || 0) > 0 ||
    forecast < 80;
  return (
    (rec.opAge || 0) >= 2.01 &&
    (rec.opAge || 0) < 3.0 &&
    forecast < 91 &&
    hasPaymentOrSafeForecast
  );
}

export function isFallenNplAccount(rec: {
  opNpl: number;
  opAge?: number;
  npl: number;
  actualDpd: number;
}): boolean {
  return (
    (rec.opNpl || 0) === 0 &&
    (rec.opAge || 0) < 3.0 &&
    ((rec.npl || 0) > 0 || (rec.actualDpd || 0) >= 91)
  );
}

export function isForecastedBorderAccount(rec: {
  opNpl?: number;
  opAge?: number;
}): boolean {
  return (
    (rec.opNpl || 0) === 0 &&
    (rec.opAge || 0) >= 2.01 &&
    (rec.opAge || 0) < 3.0
  );
}

export function isMovedToNplAccount(rec: {
  opNpl?: number;
  opAge?: number;
  npl?: number;
  actualDpd?: number;
}): boolean {
  return (
    (rec.opNpl || 0) === 0 &&
    (rec.opAge || 0) >= 2.01 &&
    (rec.opAge || 0) < 3.0 &&
    ((rec.npl || 0) > 0 || (rec.actualDpd || 0) >= 91)
  );
}

export function isBorderlineNplAccount(
  rec: {
    currentSituation?: ContractSituation;
    actualDpd: number;
    opAge: number;
    currentAge?: number;
    monthEndForecastDpd: number;
    opNpl?: number;
    npl?: number;
    totalCollection?: number;
    lastPaidAmount?: number;
    mrp?: MrpEnrichment;
  },
  mrpOverride?: MrpEnrichment,
): boolean {
  if ((rec.actualDpd || 0) >= 91 || (rec.npl || 0) > 0) return false;
  if (rec.currentSituation === 'NPL SAVED') return false;
  if (
    isNplSavedAccount(rec) &&
    (rec.actualDpd || 0) < 61 &&
    (rec.currentAge || 0) < 2.01
  ) {
    return false;
  }
  const mrp = mrpOverride ?? rec.mrp;
  return (
    (rec.monthEndForecastDpd || 0) >= 80 ||
    (rec.actualDpd || 0) >= 61 ||
    ((rec.currentAge || 0) >= 2.01 && (rec.currentAge || 0) < 3.0) ||
    Boolean(mrp?.borderNpl) ||
    ((rec.opAge || 0) >= 2.01 && (rec.monthEndForecastDpd || 0) >= 80)
  );
}

export function isEligibleNplOrBorderline(
  rec: {
    npl: number;
    opNpl: number;
    actualDpd: number;
    opAge: number;
    currentAge?: number;
    monthEndForecastDpd: number;
    mrp?: MrpEnrichment;
  },
  mrpOverride?: MrpEnrichment,
): boolean {
  const mrp = mrpOverride ?? rec.mrp;
  if (
    (rec.opAge || 0) <= 1.0 &&
    (rec.currentAge || 0) <= 1.0 &&
    (rec.npl || 0) === 0 &&
    (rec.opNpl || 0) === 0 &&
    (rec.monthEndForecastDpd || 0) < 80 &&
    (rec.actualDpd || 0) < 31 &&
    !mrp?.borderNpl
  ) {
    return false;
  }

  return (
    (rec.npl || 0) > 0 ||
    (rec.opNpl || 0) > 0 ||
    (rec.currentAge || 0) > 1.0 ||
    (rec.opAge || 0) >= 2.01 ||
    (rec.actualDpd || 0) >= 61 ||
    (rec.monthEndForecastDpd || 0) >= 80 ||
    Boolean(mrp?.borderNpl)
  );
}

export function isWithin4DaysOf91Dpd(
  contract: TrackedContract,
  referenceDate = new Date(),
): boolean {
  if (contract.actualDpd >= 91) return false;
  const daysTo91 = 91 - contract.actualDpd;
  const daysTo30th = getDaysRemainingTo30th(referenceDate);
  const crossesBeforeMonthEnd =
    contract.monthEndForecastDpd >= 91 && daysTo30th <= 4;
  return daysTo91 <= 4 || crossesBeforeMonthEnd;
}

export function isBrokenPromiseToPay(
  contract: TrackedContract,
  todayISO = getTodayISO(),
): boolean {
  if (contract.currentSituation === 'NPL SAVED' || contract.currentSituation === 'Settled') {
    return false;
  }
  if (!contract.ppDate) return false;
  if (contract.ppDate >= todayISO) return false;
  if (!contract.lastPayDate) return true;
  if (!contract.visitDate) return contract.lastPayDate < contract.ppDate;
  return contract.lastPayDate < contract.visitDate;
}

export function isTodayPromiseToPay(
  contract: TrackedContract,
  todayISO = getTodayISO(),
): boolean {
  return Boolean(contract.ppDate && contract.ppDate === todayISO);
}

export function isPendingHandOver(
  contract: TrackedContract,
  todayISO = getTodayISO(),
): boolean {
  if (contract.currentSituation === 'Settled') return false;
  return Boolean(contract.handOverDate && contract.handOverDate <= todayISO);
}

export function normalizeContractNo(value: string): string {
  return value.trim().toUpperCase();
}

export function normalizeVehicleNo(value: string): string {
  const cleaned = value
    .toUpperCase()
    .replace(/^(WP|CP|SP|NP|EP|NW|NC|SG|UVA)\s+/i, '')
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9-]/g, '');
  const match = cleaned.match(/^([A-Z]{1,3}|[0-9]{2,3})-?([0-9]{4})$/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }
  return cleaned;
}

function parseNumeric(val: unknown): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (typeof val === 'string') {
    const cleaned = val.replace(/,/g, '').replace(/Rs\.?/gi, '').trim();
    if (!cleaned || cleaned === '-') return 0;
    if (/^\(.*\)$/.test(cleaned)) {
      const neg = Number(cleaned.slice(1, -1));
      return Number.isFinite(neg) ? -neg : 0;
    }
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function parseExcelDate(val: unknown): string {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'number') {
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
  }
  const str = String(val).trim();
  if (!str || str === '-' || str.toLowerCase() === 'null') return '';
  const isoMatch = str.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }
  const dmyMatch = str.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }
  return str;
}

export interface ParsedAersResult {
  records: AersRecord[];
  metadata: AersMetadata;
  mrpMap?: Map<string, MrpEnrichment>;
  watchlistImports?: Sheet2WatchlistRow[];
  isMultiSheetWorkbook?: boolean;
  excludedRegularContractNos?: string[];
  excelOfficerOpeningBaseline?: OpeningOfficerBaseline;
}

const STANDARD_AERS_HEADERS = [
  'no',
  'contract_no',
  'cus_name',
  'contract_date',
  'op_age',
  'current_age',
  'op_bal_debtor',
  'closing_debtor',
  'due_budget_month',
  'current_month_due',
  'total_collection',
  'cash_coll',
  'capital_outstanding',
  'interest in suspense',
  'actual_dpd',
  'month_end_forecast_dpd',
  'min_amount_to_reverse_npl',
  'op npl',
  'npl',
  'next_due_date',
  'last_pay_date',
  'last_paid_amount',
  'contract_status',
  'recovery_status',
  'marketing_officer',
  'recovery_officer',
  'finance_amount',
  'current_stock',
  'department',
  'address',
  'mobile_no',
  'op capital outstanding',
  'npl reason',
  'worst case related product',
  'office type',
  'current rc',
  'total efforts',
  'assign officer efforts',
];

function parseAersRows(
  rows: unknown[][],
  fileName: string,
): ParsedAersResult {
  if (rows.length === 0) {
    throw new Error('No rows found in the provided AERS data.');
  }

  let excelPrintedDateTime = '';
  for (let r = 0; r < Math.min(4, rows.length); r++) {
    const joined = (rows[r] || []).map((c) => String(c ?? '')).join(' ');
    const match = joined.match(
      /Printed\s+Date\s+and\s+Time\s*:?\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/i,
    );
    if (match) {
      excelPrintedDateTime = match[1].trim();
      break;
    }
  }
  const activeSys = captureSystemActiveDateTime();
  const printedDateTime = activeSys.systemDateTime;

  let headerRowIdx = -1;
  for (let r = 0; r < Math.min(8, rows.length); r++) {
    const cells = (rows[r] || []).map((c) =>
      String(c ?? '').trim().toUpperCase(),
    );
    if (cells.includes('CONTRACT_NO') || cells.includes('CONTRACT NO')) {
      headerRowIdx = r;
      break;
    }
  }

  let dataStartIdx = headerRowIdx + 1;
  let rawHeaders: string[];

  if (headerRowIdx >= 0) {
    rawHeaders = (rows[headerRowIdx] || []).map((h) =>
      String(h ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' '),
    );
  } else {
    const firstRow = rows[0] || [];
    const col0 = String(firstRow[0] ?? '').trim();
    const looksLikeContractInCol0 = /^[A-Z]{2,}[0-9]{4,}$/i.test(col0);
    rawHeaders = looksLikeContractInCol0
      ? STANDARD_AERS_HEADERS.slice(1)
      : STANDARD_AERS_HEADERS;
    dataStartIdx = 0;
  }

  const colIndex = new Map<string, number>();
  rawHeaders.forEach((h, idx) => {
    if (h) colIndex.set(h, idx);
  });

  const getCell = (row: unknown[], ...keys: string[]): unknown => {
    for (const k of keys) {
      const idx = colIndex.get(k.toLowerCase());
      if (idx !== undefined && idx < row.length) {
        return row[idx];
      }
    }
    return '';
  };

  const records: AersRecord[] = [];
  for (let r = dataStartIdx; r < rows.length; r++) {
    const row = rows[r] || [];
    const contractNoRaw = String(
      getCell(row, 'contract_no', 'contract no') ?? '',
    ).trim();
    if (!contractNoRaw || contractNoRaw.toUpperCase() === 'TOTAL') continue;

    const record: AersRecord = {
      no: String(getCell(row, 'no') ?? '').trim(),
      contractNo: normalizeContractNo(contractNoRaw),
      cusName: String(getCell(row, 'cus_name', 'customer name') ?? '').trim(),
      contractDate: parseExcelDate(getCell(row, 'contract_date')),
      opAge: parseNumeric(getCell(row, 'op_age')),
      currentAge: parseNumeric(getCell(row, 'current_age')),
      opBalDebtor: parseNumeric(getCell(row, 'op_bal_debtor')),
      closingDebtor: parseNumeric(getCell(row, 'closing_debtor')),
      dueBudgetMonth: parseNumeric(getCell(row, 'due_budget_month')),
      currentMonthDue: parseNumeric(getCell(row, 'current_month_due')),
      totalCollection: parseNumeric(getCell(row, 'total_collection')),
      cashColl: parseNumeric(getCell(row, 'cash_coll')),
      capitalOutstanding: parseNumeric(getCell(row, 'capital_outstanding')),
      capitalArrears: parseNumeric(
        getCell(row, 'capital_arrears', 'capital arrears', 'cap_arrears'),
      ),
      interestInSuspense: parseNumeric(getCell(row, 'interest in suspense')),
      actualDpd: parseNumeric(getCell(row, 'actual_dpd')),
      monthEndForecastDpd: parseNumeric(getCell(row, 'month_end_forecast_dpd')),
      minAmountToReverseNpl: parseNumeric(
        getCell(row, 'min_amount_to_reverse_npl'),
      ),
      opNpl: parseNumeric(getCell(row, 'op npl', 'op_npl')),
      npl: parseNumeric(getCell(row, 'npl')),
      nextDueDate: parseExcelDate(getCell(row, 'next_due_date')),
      lastPayDate: parseExcelDate(getCell(row, 'last_pay_date')),
      lastPaidAmount: parseNumeric(getCell(row, 'last_paid_amount')),
      contractStatus: String(getCell(row, 'contract_status') ?? '').trim(),
      recoveryStatus: String(getCell(row, 'recovery_status') ?? '').trim(),
      marketingOfficer: stripOfficerPrefix(
        String(getCell(row, 'marketing_officer') ?? ''),
      ),
      recoveryOfficer: stripOfficerPrefix(
        String(getCell(row, 'recovery_officer') ?? ''),
      ),
      financeAmount: parseNumeric(getCell(row, 'finance_amount')),
      currentStock: String(getCell(row, 'current_stock') ?? '').trim(),
      department: String(getCell(row, 'department') ?? '').trim(),
      address: String(getCell(row, 'address') ?? '').trim(),
      mobileNo: String(getCell(row, 'mobile_no') ?? '').trim(),
      opCapitalOutstanding: parseNumeric(
        getCell(row, 'op capital outstanding', 'op_capital_outstanding'),
      ),
      nplReason: String(getCell(row, 'npl reason', 'npl_reason') ?? '').trim(),
      worstCaseProduct: String(
        getCell(row, 'worst case related product') ?? '',
      ).trim(),
      officeType: String(getCell(row, 'office type') ?? '').trim(),
      currentRc: String(getCell(row, 'current rc') ?? '').trim(),
      totalEfforts: parseNumeric(getCell(row, 'total efforts')),
      assignOfficerEfforts: parseNumeric(getCell(row, 'assign officer efforts')),
    };

    records.push(record);
  }

  if (records.length === 0) {
    throw new Error(
      'No valid contract rows found. Ensure CONTRACT_NO column or standard AERS columns are included.',
    );
  }

  return {
    records,
    metadata: {
      fileName,
      printedDateTime,
      excelPrintedDateTime: excelPrintedDateTime || undefined,
      uploadedAt: activeSys.isoTimestamp,
      systemDate: activeSys.systemDate,
      systemTime: activeSys.systemTime,
      systemTimeZone: activeSys.timeZone,
      totalContractsCount: records.length,
      isSampleData: false,
    },
  };
}

const PAYMENT_MONTH_SLOTS: {
  month: MrpPaymentMonth['month'];
  dateKey: string;
  monthIndex: number;
}[] = [
  { month: 'Jan', dateKey: '2026-01-01', monthIndex: 1 },
  { month: 'Feb', dateKey: '2026-02-01', monthIndex: 2 },
  { month: 'Mar', dateKey: '2026-03-01', monthIndex: 3 },
  { month: 'Apr', dateKey: '2026-04-01', monthIndex: 4 },
  { month: 'May', dateKey: '2026-05-01', monthIndex: 5 },
  { month: 'Jun', dateKey: '2026-06-01', monthIndex: 6 },
  { month: 'Jul', dateKey: '2026-07-01', monthIndex: 7 },
  { month: 'Aug', dateKey: '2026-08-01', monthIndex: 8 },
  { month: 'Sep', dateKey: '2026-09-01', monthIndex: 9 },
  { month: 'Oct', dateKey: '2026-10-01', monthIndex: 10 },
];

function matchPaymentMonthSlot(
  headerCell: unknown,
): (typeof PAYMENT_MONTH_SLOTS)[number] | null {
  if (headerCell instanceof Date && !Number.isNaN(headerCell.getTime())) {
    const m = headerCell.getMonth() + 1;
    if (m >= 1 && m <= 10 && headerCell.getFullYear() >= 2026) {
      return PAYMENT_MONTH_SLOTS[m - 1] ?? null;
    }
  }
  if (typeof headerCell === 'number' && headerCell > 40000 && headerCell < 60000) {
    const parsed = XLSX.SSF.parse_date_code(headerCell);
    if (parsed && parsed.m >= 1 && parsed.m <= 10 && parsed.y >= 2026) {
      return PAYMENT_MONTH_SLOTS[parsed.m - 1] ?? null;
    }
  }
  const str = String(headerCell ?? '').trim();
  if (!str) return null;

  const isoMatch = str.match(/202[67][-/](0?[1-9]|1[0-2])(?:[-/]\d{1,2})?/);
  if (isoMatch) {
    const m = Number(isoMatch[1]);
    if (m >= 1 && m <= 10) return PAYMENT_MONTH_SLOTS[m - 1] ?? null;
  }

  const lower = str.toLowerCase();
  for (const slot of PAYMENT_MONTH_SLOTS) {
    if (
      lower === slot.month.toLowerCase() ||
      lower.startsWith(`${slot.month.toLowerCase()}-`) ||
      lower.startsWith(`${slot.month.toLowerCase()} `) ||
      lower.includes(`-${slot.month.toLowerCase()}`)
    ) {
      return slot;
    }
  }
  return null;
}

function parseMrpSheet(rows: unknown[][]): Map<string, MrpEnrichment> {
  const mrpMap = new Map<string, MrpEnrichment>();
  if (rows.length === 0) return mrpMap;

  let headerRowIdx = -1;
  for (let r = 0; r < Math.min(6, rows.length); r++) {
    const cells = (rows[r] || []).map((c) =>
      String(c ?? '').trim().toUpperCase().replace(/\s+/g, ' '),
    );
    if (cells.includes('CONTRACT NO') || cells.includes('CONTRACT_NO')) {
      headerRowIdx = r;
      break;
    }
  }
  if (headerRowIdx < 0) return mrpMap;

  const rawHeaderCells = rows[headerRowIdx] || [];
  const headerIndex = new Map<string, number>();
  const paymentColMap = new Map<number, (typeof PAYMENT_MONTH_SLOTS)[number]>();

  rawHeaderCells.forEach((cell, idx) => {
    const norm = String(cell ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    if (norm) headerIndex.set(norm, idx);
    const slot = matchPaymentMonthSlot(cell);
    if (slot) paymentColMap.set(idx, slot);
  });

  const getVal = (row: unknown[], ...keys: string[]): string => {
    for (const k of keys) {
      const idx = headerIndex.get(k.toLowerCase());
      if (idx !== undefined && idx < row.length) {
        const v = String(row[idx] ?? '').trim();
        if (v) return v;
      }
    }
    return '';
  };

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const contractRaw = getVal(row, 'contract no', 'contract_no');
    if (!contractRaw || contractRaw.toUpperCase() === 'TOTAL') continue;
    const contractNo = normalizeContractNo(contractRaw);

    const paymentByMonth = new Map<number, MrpPaymentMonth>();
    paymentColMap.forEach((slot, colIdx) => {
      const cell = colIdx < row.length ? row[colIdx] : '';
      const rawStr = String(cell ?? '').trim();
      const upper = rawStr.toUpperCase();
      let status: MrpPaymentMonth['status'] = 'EMPTY';
      let amount = 0;

      if (upper === 'NP' || upper === 'NOT PAID') {
        status = 'NP';
      } else if (rawStr !== '' && rawStr !== '-') {
        const num = parseNumeric(cell);
        if (num > 0) {
          status = 'PAID';
          amount = num;
        }
      }

      paymentByMonth.set(slot.monthIndex, {
        month: slot.month,
        dateKey: slot.dateKey,
        raw: rawStr,
        status,
        amount,
      });
    });

    const paymentPattern: MrpPaymentMonth[] = PAYMENT_MONTH_SLOTS.map(
      (slot) =>
        paymentByMonth.get(slot.monthIndex) ?? {
          month: slot.month,
          dateKey: slot.dateKey,
          raw: '',
          status: 'EMPTY',
          amount: 0,
        },
    );

    const nplCategory = getVal(row, 'npl category', 'npl_category');
    const borderRaw = getVal(
      row,
      'border npl',
      'border_npl',
      'borderline npl',
      'border npl flag',
    );
    const borderNorm = borderRaw.trim().toLowerCase();
    const borderFlagFromCol =
      Boolean(borderNorm) &&
      !['no', '0', 'false', '-', 'n', 'regular', 'performing'].includes(borderNorm);
    const borderFlagFromCategory = nplCategory.toLowerCase().includes('border');

    mrpMap.set(contractNo, {
      nplCategory,
      bucketMovement: getVal(row, 'bucket movement', 'bucket_movement'),
      impairmentStage: getVal(row, 'impairment stage', 'impairment_stage'),
      recoveryAttention: getVal(row, 'recovery attention', 'recovery_attention'),
      notPaidSummary: getVal(
        row,
        'not paid summ. fixed',
        'not paid summ fixed',
        'not paid summary',
      ),
      borderNpl: borderFlagFromCol || borderFlagFromCategory,
      borderNplLabel: borderRaw || (borderFlagFromCategory ? nplCategory : ''),
      paymentPattern,
    });
  }

  return mrpMap;
}

function parseSheet2Watchlist(rows: unknown[][]): Sheet2WatchlistRow[] {
  const results: Sheet2WatchlistRow[] = [];
  if (rows.length === 0) return results;

  let headerRowIdx = -1;
  for (let r = 0; r < Math.min(6, rows.length); r++) {
    const cells = (rows[r] || []).map((c) =>
      String(c ?? '').trim().toUpperCase().replace(/\s+/g, ' '),
    );
    if (cells.includes('CONTRACT NO') || cells.includes('CONTRACT_NO')) {
      headerRowIdx = r;
      break;
    }
  }
  if (headerRowIdx < 0) return results;

  const headers = (rows[headerRowIdx] || []).map((c) =>
    String(c ?? '').trim().toLowerCase().replace(/\s+/g, ' '),
  );
  const idxMap = new Map<string, number>();
  headers.forEach((h, i) => {
    if (h) idxMap.set(h, i);
  });

  const getCell = (row: unknown[], ...keys: string[]): string => {
    for (const k of keys) {
      const idx = idxMap.get(k);
      if (idx !== undefined && idx < row.length) {
        return String(row[idx] ?? '').trim();
      }
    }
    return '';
  };

  const seen = new Set<string>();
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const contractRaw = getCell(row, 'contract no', 'contract_no');
    if (!contractRaw || contractRaw.toUpperCase() === 'TOTAL') continue;
    const contractNo = normalizeContractNo(contractRaw);
    if (seen.has(contractNo)) continue;
    seen.add(contractNo);

    results.push({
      no: getCell(row, 'no'),
      contractNo,
      name: getCell(row, 'name', 'cus_name', 'customer name'),
      ro: stripOfficerPrefix(
        getCell(row, 'ro', 'recovery_officer', 'recovery officer'),
      ),
    });
  }

  return results;
}

function parsePctValue(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null;
    if (Math.abs(raw) <= 2.5) return Math.round(raw * 1000) / 10;
    return Math.round(raw * 10) / 10;
  }
  const str = String(raw).trim();
  if (!str || str === '-') return null;
  const hasPct = str.includes('%');
  const num = parseNumeric(str.replace(/%/g, ''));
  if (!Number.isFinite(num)) return null;
  if (!hasPct && Math.abs(num) > 0 && Math.abs(num) <= 2.5) {
    return Math.round(num * 1000) / 10;
  }
  return Math.round(num * 10) / 10;
}

function parseAmountWithMillionHint(raw: unknown, headerHint = ''): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null;
    const headerIsMillions = /\b(mn|million|rs\.?\s*m|\(m\)|\(mn\))\b/i.test(headerHint);
    if (headerIsMillions && Math.abs(raw) < 10_000) {
      return Math.round(raw * 1_000_000);
    }
    return Math.round(raw);
  }
  const str = String(raw).trim();
  if (!str || str === '-' || str === '—') return null;
  // Support accounting parentheses e.g. "(8,450,000.00)" => negative
  const isAccountingNeg = /^\(.*\)$/.test(str);
  const unwrapped = isAccountingNeg ? str.slice(1, -1).trim() : str;
  const hasMillionSuffix =
    /\b(mn|m|million)\b/i.test(unwrapped) || /[0-9]\s*m$/i.test(unwrapped);
  const headerIsMillions = /\b(mn|million|rs\.?\s*m|\(m\)|\(mn\))\b/i.test(headerHint);
  const cleaned = unwrapped
    .replace(/\b(rs\.?|lkr|mn|million)\b/gi, '')
    .replace(/m$/i, '')
    .trim();
  if (!/\d/.test(cleaned)) return null;
  const parsed = parseNumeric(cleaned);
  if (!Number.isFinite(parsed)) return null;
  const signed = isAccountingNeg ? -Math.abs(parsed) : parsed;
  if (hasMillionSuffix || headerIsMillions) {
    return Math.abs(signed) < 10_000 ? Math.round(signed * 1_000_000) : Math.round(signed);
  }
  return Math.round(signed);
}

function parseBmDashboardBelowThree(
  rows: unknown[][],
  sheetName: string,
  knownOfficers: Map<string, { officer: string; role: string }>,
): BmDashboardBelowThreeExtracted | undefined {
  if (!rows || rows.length === 0) return undefined;

  const BELOW3_REGEX =
    /(below\s*[-–_]?\s*3|b\s*[-–_/]?\s*3\s*(coll|target|due|age|bucket|summary|report)?|<\s*3(\.00?)?|\b0\s*[-–~]\s*2\.99\b|age\s*<\s*3|below\s+three)/i;

  const matchOfficer = (
    raw: string,
  ): { officer: string; role?: string; matchedKnown: boolean } | null => {
    const cleaned = stripOfficerPrefix(raw)
      .replace(/\s*\((ro|mo)\)\s*$/i, '')
      .replace(/^(ro|mo)\s*[-–:]\s*/i, '')
      .replace(/\s*[-–:]\s*(ro|mo)$/i, '')
      .trim();
    if (!cleaned || cleaned.length < 2) return null;
    const lower = cleaned.toLowerCase();
    const direct = knownOfficers.get(lower);
    if (direct) return { ...direct, matchedKnown: true };
    // Partial / token match against known AERS officers (e.g. "Madusanka L" -> "madusankal")
    const compact = lower.replace(/[^a-z0-9]/g, '');
    for (const [k, val] of knownOfficers.entries()) {
      const kc = k.replace(/[^a-z0-9]/g, '');
      if (
        kc === compact ||
        (compact.length >= 4 && (kc.includes(compact) || compact.includes(kc)))
      ) {
        return { ...val, matchedKnown: true };
      }
    }
    return null;
  };

  interface ColMap {
    officerCol?: number;
    targetCol?: number;
    targetHint?: string;
    collectedCol?: number;
    collectedHint?: string;
    varianceCol?: number;
    varianceHint?: string;
    pctCol?: number;
    totalCountCol?: number;
    paidCountCol?: number;
    notPaidCountCol?: number;
    neededCountCol?: number;
    headerSpanRows: number;
  }

  const classifyHeaders = (
    headers: string[],
    headerSpanRows: number,
  ): ColMap | null => {
    const map: ColMap = { headerSpanRows };
    let hits = 0;

    for (let c = 0; c < headers.length; c++) {
      const h = headers[c];
      if (!h) continue;
      const hl = h.toLowerCase();

      if (
        map.officerCol === undefined &&
        /^(officer|ro|mo|ro\s*\/\s*mo|ro\s*&\s*mo|officer\s*name|name|staff|user|exec|executive|code|recovery\s*officer|marketing\s*officer|assigned\s*officer|ro\s*name|mo\s*name|category|description|particulars|branch)$/i.test(
          hl,
        )
      ) {
        map.officerCol = c;
      } else if (
        map.pctCol === undefined &&
        /(%|pct|ach\s*%|coll\s*%|eff\s*%|ratio|rate|achievement\s*%|%\s*ach|%\s*coll)/i.test(
          hl,
        ) &&
        !/not\s*paid|unpaid/i.test(hl)
      ) {
        map.pctCol = c;
        hits += 1;
      } else if (
        map.notPaidCountCol === undefined &&
        /(not\s*paid|unpaid|non\s*paid|pending\s*(acct|cont|no|cnt)|np\s*(acct|cont|cnt)?|^np$|not\s*paid\s*cont)/i.test(
          hl,
        ) &&
        !/amt|amount|rs|val|due|coll/i.test(hl)
      ) {
        map.notPaidCountCol = c;
        hits += 1;
      } else if (
        map.paidCountCol === undefined &&
        /(paid\s*(acct|cont|no|cnt)|^paid$|^paid\s*count$|paid\s*cont)/i.test(hl) &&
        !/not\s*paid|unpaid|amt|amount|rs|val/i.test(hl)
      ) {
        map.paidCountCol = c;
        hits += 1;
      } else if (
        map.neededCountCol === undefined &&
        /(need|req|bal\s*(acct|cont)|to\s*pay\s*(acct|cont)|rem\s*(acct|cont))/i.test(
          hl,
        ) &&
        !/amt|amount|rs|val/i.test(hl)
      ) {
        map.neededCountCol = c;
        hits += 1;
      } else if (
        map.totalCountCol === undefined &&
        /(total\s*(acct|cont|no|cnt)|no\.?\s*of\s*(cont|acct)|^accts?$|^contracts?$|^count$|^nos?\.?$)/i.test(
          hl,
        )
      ) {
        map.totalCountCol = c;
        hits += 1;
      } else if (
        map.varianceCol === undefined &&
        /(var|variance|bal\s*(to\s*coll|amt|due)?|^balance$|short|shortfall|gap|rem|remaining|diff|pending\s*amt|need\s*amt|to\s*be\s*coll)/i.test(
          hl,
        ) &&
        !/%|acct|cont|count/i.test(hl)
      ) {
        map.varianceCol = c;
        map.varianceHint = h;
        hits += 1;
      } else if (
        map.targetCol === undefined &&
        /(target|budget|collectible|due\s*budget|monthly\s*due|total\s*due|curr(ent)?\s*month\s*due|due\s*amt|due\s*amount|due\s*val|b\s*\/?\s*3\s*(target|due)|below\s*3\s*(target|due|budget)|<\s*3\s*(target|due)|^due(\s*\(.*\))?$|^plan$)/i.test(
          hl,
        ) &&
        !/%|acct|cont|count|variance|shortfall|balance|gap|not\s*paid|unpaid/i.test(hl) &&
        !(/\b(collection|collected|actual|received|recovered)\b/i.test(hl) && !/collectible/i.test(hl))
      ) {
        map.targetCol = c;
        map.targetHint = h;
        hits += 1;
      } else if (
        map.collectedCol === undefined &&
        /(collection|collected|actual|achiev|received|recovered|cash\s*coll|total\s*coll|b\s*\/?\s*3\s*coll|below\s*3\s*coll|<\s*3\s*coll|paid\s*amt|paid\s*amount|^coll(\s*\(.*\))?$)/i.test(
          hl,
        ) &&
        !/collectible|%|rate|ratio|eff|target|budget|variance|shortfall|balance|acct|cont|count|not\s*paid|unpaid/i.test(
          hl,
        )
      ) {
        map.collectedCol = c;
        map.collectedHint = h;
        hits += 1;
      }
    }

    if (map.targetCol !== undefined && map.collectedCol !== undefined && hits >= 2) {
      return map;
    }
    return null;
  };

  const detectHeaderCols = (
    row: unknown[],
    nextRow?: unknown[],
  ): ColMap | null => {
    const singleHeaders = row.map((cell) =>
      String(cell ?? '').trim().replace(/\s+/g, ' '),
    );
    const singleMatch = classifyHeaders(singleHeaders, 1);
    if (singleMatch) return singleMatch;

    if (nextRow && nextRow.length > 0) {
      const maxLen = Math.max(row.length, nextRow.length);
      const mergedHeaders: string[] = [];
      let lastTop = '';
      for (let c = 0; c < maxLen; c++) {
        const top = String(row[c] ?? '').trim().replace(/\s+/g, ' ');
        const sub = String(nextRow[c] ?? '').trim().replace(/\s+/g, ' ');
        if (top) lastTop = top;
        const effectiveTop = top || (sub && lastTop && !BELOW3_REGEX.test(lastTop) ? lastTop : '');
        const combined =
          effectiveTop && sub && effectiveTop.toLowerCase() !== sub.toLowerCase()
            ? `${effectiveTop} ${sub}`
            : sub || top;
        mergedHeaders.push(combined);
      }
      const mergedMatch = classifyHeaders(mergedHeaders, 2);
      if (mergedMatch) return mergedMatch;
    }

    return null;
  };

  // Extract best text label to the left of targetCol (handles leading serial # column e.g. Col A = 1, Col B = Officer)
  const extractRowLabel = (
    drow: unknown[],
    cols: ColMap,
    fallbackCol: number,
  ): string => {
    if (cols.officerCol !== undefined) {
      const direct = String(drow[cols.officerCol] ?? '').trim();
      if (direct && !/^\d+$/.test(direct)) return direct;
    }
    const maxScan = Math.min(
      drow.length - 1,
      Math.min(cols.targetCol ?? drow.length, cols.collectedCol ?? drow.length) - 1,
    );
    for (let c = 0; c <= Math.max(0, maxScan); c++) {
      const val = String(drow[c] ?? '').trim();
      if (val && !/^\d+(\.\d+)?$/.test(val)) return val;
    }
    return String(drow[fallbackCol] ?? '').trim();
  };

  let bestScore = -1;
  let bestTarget = 0;
  let bestCollected = 0;
  let bestVariance: number | null = null;
  let bestPct: number | null = null;
  let bestTotalCount: number | undefined;
  let bestPaidCount: number | undefined;
  let bestNotPaidCount: number | undefined;
  let bestNeededCount: number | undefined;
  let bestOfficers: BmDashboardBelowThreeExtracted['byOfficer'] = [];

  // Locate every cell mentioning "Below 3" across the entire BM Dashboard sheet
  const anchorCells: { r: number; c: number; text: string; isBelow3Coll: boolean }[] = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const txt = String(row[c] ?? '').trim();
      if (txt && txt.length <= 140 && BELOW3_REGEX.test(txt)) {
        const isBelow3Coll = /coll|target|due|summary|report|performance|variance/i.test(txt);
        anchorCells.push({ r, c, text: txt, isBelow3Coll });
      }
    }
  }

  for (const anchor of anchorCells) {
    // Bottom-of-sheet "Below 3 Collection" report gets priority over incidental top-of-sheet mentions
    const bottomBonus = anchor.r >= Math.floor(rows.length * 0.45) ? 20 : 0;
    const titleBonus = anchor.isBelow3Coll ? 30 : 0;

    let tableFound = false;
    for (let hr = anchor.r; hr <= Math.min(rows.length - 1, anchor.r + 6); hr++) {
      const cols = detectHeaderCols(rows[hr] || [], rows[hr + 1]);
      if (!cols || cols.targetCol === undefined || cols.collectedCol === undefined) continue;

      tableFound = true;
      const localOfficers = new Map<
        string,
        BmDashboardBelowThreeExtracted['byOfficer'][number]
      >();
      let grandTotalRow: {
        target: number;
        collected: number;
        variance: number | null;
        pct: number | null;
        totCnt?: number;
        paidCnt?: number;
        npCnt?: number;
        needCnt?: number;
      } | null = null;
      let subTotalSumTarget = 0;
      let subTotalSumCollected = 0;
      let subTotalCount = 0;

      let blankStreak = 0;
      const startDataRow = hr + cols.headerSpanRows;

      for (let dr = startDataRow; dr <= Math.min(rows.length - 1, startDataRow + 50); dr++) {
        const drow = rows[dr] || [];
        const rawLabel = extractRowLabel(drow, cols, anchor.c);
        const tVal = parseAmountWithMillionHint(drow[cols.targetCol], cols.targetHint);
        const cVal = parseAmountWithMillionHint(drow[cols.collectedCol], cols.collectedHint);

        if (!rawLabel && tVal === null && cVal === null) {
          blankStreak += 1;
          if (blankStreak >= 3) break;
          continue;
        }
        blankStreak = 0;

        // Stop if we hit an unrelated new section header after already reading rows
        if (
          (localOfficers.size > 0 || grandTotalRow !== null) &&
          tVal === null &&
          cVal === null &&
          /^(npl|worst|age\s*bucket|summary|ratio|90\s*ratio|incentive|remarks)/i.test(rawLabel)
        ) {
          break;
        }

        const isGrandTotalRow =
          /^(grand\s*total|branch\s*total|total\s*below\s*3|below\s*3\s*total|overall\s*total|all\s*branch|total)$/i.test(
            rawLabel.replace(/[:\-]+$/g, '').trim(),
          ) || /^(grand|branch)\s+total\b/i.test(rawLabel);

        const isSubTotalRow =
          !isGrandTotalRow &&
          /^(ro\s*total|mo\s*total|sub\s*total|subtotal|recovery\s*total|marketing\s*total|total\s*ro|total\s*mo)/i.test(
            rawLabel,
          );

        const vVal =
          cols.varianceCol !== undefined
            ? parseAmountWithMillionHint(drow[cols.varianceCol], cols.varianceHint)
            : null;
        const pVal = cols.pctCol !== undefined ? parsePctValue(drow[cols.pctCol]) : null;
        const totCnt =
          cols.totalCountCol !== undefined && /\d/.test(String(drow[cols.totalCountCol] ?? ''))
            ? Math.round(parseNumeric(drow[cols.totalCountCol]))
            : undefined;
        const paidCnt =
          cols.paidCountCol !== undefined && /\d/.test(String(drow[cols.paidCountCol] ?? ''))
            ? Math.round(parseNumeric(drow[cols.paidCountCol]))
            : undefined;
        const npCnt =
          cols.notPaidCountCol !== undefined && /\d/.test(String(drow[cols.notPaidCountCol] ?? ''))
            ? Math.round(parseNumeric(drow[cols.notPaidCountCol]))
            : undefined;
        const needCnt =
          cols.neededCountCol !== undefined && /\d/.test(String(drow[cols.neededCountCol] ?? ''))
            ? Math.round(parseNumeric(drow[cols.neededCountCol]))
            : undefined;

        if (isGrandTotalRow && tVal && tVal > 0 && cVal !== null && cVal >= 0) {
          // Keep the largest grand total if both subtotal and grand total share label "Total"
          if (!grandTotalRow || tVal >= grandTotalRow.target) {
            grandTotalRow = {
              target: tVal,
              collected: cVal,
              variance: vVal,
              pct: pVal,
              totCnt: totCnt && totCnt > 0 ? totCnt : undefined,
              paidCnt: paidCnt !== undefined && paidCnt >= 0 ? paidCnt : undefined,
              npCnt: npCnt !== undefined && npCnt >= 0 ? npCnt : undefined,
              needCnt: needCnt !== undefined && needCnt >= 0 ? needCnt : undefined,
            };
          }
          // Do NOT break immediately if label was simply "Total" and RO/MO tables are stacked;
          // break only on explicit "Grand Total" / "Branch Total"
          if (/grand|branch|overall|below\s*3/i.test(rawLabel)) {
            break;
          }
          continue;
        }

        if (isSubTotalRow && tVal && tVal > 0 && cVal !== null && cVal >= 0) {
          subTotalSumTarget += tVal;
          subTotalSumCollected += cVal;
          subTotalCount += 1;
          continue;
        }

        // Skip secondary header rows (e.g., stacked MO section header) or age-bucket labels
        const isSectionDivider =
          /^(ro|mo|officer|recovery\s*officers?|marketing\s*officers?|name|age|bucket|\[[a-i]\])/i.test(
            rawLabel,
          );
        if (isSectionDivider) continue;

        if (tVal !== null && tVal > 0 && cVal !== null && cVal >= 0 && rawLabel) {
          const matchedOff = matchOfficer(rawLabel);
          const cleanName = matchedOff
            ? matchedOff.officer
            : stripOfficerPrefix(rawLabel)
                .replace(/\s*\((ro|mo)\)\s*$/i, '')
                .trim();

          // Accept known officers, or valid officer-like names (excluding numeric/age-range labels)
          const looksLikeOfficerName =
            matchedOff !== null ||
            (cleanName.length >= 3 &&
              cleanName.length <= 36 &&
              /[a-zA-Z]{3,}/.test(cleanName) &&
              !/\b(total|below|above|zero|npl|age|dpd|target|budget|collection|variance|summary)\b/i.test(
                cleanName,
              ));

          if (looksLikeOfficerName) {
            const variance = Math.round(cVal - tVal);
            const pct =
              pVal !== null && pVal >= 0
                ? pVal
                : tVal > 0
                  ? Math.round((cVal / tVal) * 1000) / 10
                  : 0;
            localOfficers.set(cleanName.toLowerCase(), {
              officer: cleanName,
              role: matchedOff?.role,
              targetAmount: tVal,
              collectedAmount: cVal,
              varianceAmount: variance,
              collectionPct: pct,
              totalCount: totCnt && totCnt > 0 ? totCnt : undefined,
              paidCount: paidCnt !== undefined && paidCnt >= 0 ? paidCnt : undefined,
              notPaidCount: npCnt !== undefined && npCnt >= 0 ? npCnt : undefined,
              contractsNeeded: needCnt !== undefined && needCnt >= 0 ? needCnt : undefined,
            });
          }
        }
      }

      const officersList = Array.from(localOfficers.values());
      const officerSumTarget = officersList.reduce((s, o) => s + o.targetAmount, 0);
      const officerSumCollected = officersList.reduce((s, o) => s + o.collectedAmount, 0);

      // Determine authoritative total for this table
      let candidateTarget = grandTotalRow?.target ?? 0;
      let candidateCollected = grandTotalRow?.collected ?? 0;
      let candidateVariance = grandTotalRow?.variance ?? null;
      let candidatePct = grandTotalRow?.pct ?? null;

      if (officersList.length >= 2 && officerSumTarget > candidateTarget * 1.15) {
        // E.g. only an RO "Total" row was matched while both RO & MO officer rows were captured
        candidateTarget = officerSumTarget;
        candidateCollected = officerSumCollected;
        candidateVariance = null;
        candidatePct = null;
      } else if (candidateTarget === 0 && subTotalCount >= 1) {
        candidateTarget = subTotalSumTarget;
        candidateCollected = subTotalSumCollected;
      } else if (candidateTarget === 0 && officersList.length >= 1) {
        candidateTarget = officerSumTarget;
        candidateCollected = officerSumCollected;
      }

      if (candidateTarget > 0) {
        const candidateScore =
          titleBonus +
          bottomBonus +
          officersList.length * 10 +
          (grandTotalRow ? 25 : 0);

        if (
          candidateScore > bestScore ||
          (candidateScore === bestScore && candidateTarget > bestTarget)
        ) {
          bestScore = candidateScore;
          bestTarget = candidateTarget;
          bestCollected = candidateCollected;
          bestVariance = candidateVariance;
          bestPct = candidatePct;
          bestTotalCount = grandTotalRow?.totCnt;
          bestPaidCount = grandTotalRow?.paidCnt;
          bestNotPaidCount = grandTotalRow?.npCnt;
          bestNeededCount = grandTotalRow?.needCnt;
          bestOfficers = officersList;
        }
      }

      if (tableFound) break;
    }

    // Strategy 2: Summary row itself is "Below 3 Collection" with headers 1..8 rows ABOVE
    if (!tableFound) {
      for (let hr = anchor.r - 1; hr >= Math.max(0, anchor.r - 8); hr--) {
        const cols = detectHeaderCols(rows[hr] || [], rows[hr + 1]);
        if (!cols || cols.targetCol === undefined || cols.collectedCol === undefined) continue;

        const drow = rows[anchor.r] || [];
        const tVal = parseAmountWithMillionHint(drow[cols.targetCol], cols.targetHint);
        const cVal = parseAmountWithMillionHint(drow[cols.collectedCol], cols.collectedHint);
        if (tVal && tVal > 0 && cVal !== null && cVal >= 0) {
          const candidateScore = titleBonus + bottomBonus + 15;
          if (
            candidateScore > bestScore ||
            (candidateScore === bestScore && tVal > bestTarget)
          ) {
            bestScore = candidateScore;
            bestTarget = tVal;
            bestCollected = cVal;
            bestVariance =
              cols.varianceCol !== undefined
                ? parseAmountWithMillionHint(drow[cols.varianceCol], cols.varianceHint)
                : null;
            bestPct = cols.pctCol !== undefined ? parsePctValue(drow[cols.pctCol]) : null;
            const totCnt =
              cols.totalCountCol !== undefined
                ? Math.round(parseNumeric(drow[cols.totalCountCol]))
                : 0;
            const paidCnt =
              cols.paidCountCol !== undefined
                ? Math.round(parseNumeric(drow[cols.paidCountCol]))
                : 0;
            const npCnt =
              cols.notPaidCountCol !== undefined
                ? Math.round(parseNumeric(drow[cols.notPaidCountCol]))
                : 0;
            if (totCnt > 0) bestTotalCount = totCnt;
            if (paidCnt > 0) bestPaidCount = paidCnt;
            if (npCnt > 0) bestNotPaidCount = npCnt;
          }
        }
        break;
      }
    }

    // Strategy 3: Key-value KPI block around anchor cell (Target / Collection / Variance / %)
    let kvTarget = 0;
    let kvCollected = 0;
    let kvPct: number | null = null;
    for (let r = anchor.r; r <= Math.min(rows.length - 1, anchor.r + 10); r++) {
      const row = rows[r] || [];
      for (
        let c = Math.max(0, anchor.c - 2);
        c <= Math.min(row.length - 1, anchor.c + 12);
        c++
      ) {
        const lbl = String(row[c] ?? '').trim();
        if (!lbl || lbl.length > 60) continue;
        const ll = lbl.toLowerCase();

        const readAdjacentNum = (isPct = false): number | null => {
          const candidates = [row[c + 1], row[c + 2], rows[r + 1]?.[c]];
          for (const cand of candidates) {
            if (cand === undefined || cand === null || cand === '') continue;
            if (
              typeof cand === 'string' &&
              /[a-z]{3,}/i.test(cand) &&
              !/\b(rs|lkr|mn|million)\b/i.test(cand)
            ) {
              continue;
            }
            const parsed = isPct
              ? parsePctValue(cand)
              : parseAmountWithMillionHint(cand, lbl);
            if (parsed !== null && parsed !== 0) return parsed;
          }
          return null;
        };

        if (
          kvTarget === 0 &&
          /(target|budget|collectible|monthly\s*due|total\s*due|due\s*amt|below\s*3\s*(target|due)|^due$)/i.test(
            ll,
          ) &&
          !/%|actual|ach|count|acct|variance|shortfall/i.test(ll) &&
          !(/\b(collection|collected)\b/i.test(ll) && !/collectible/i.test(ll))
        ) {
          const v = readAdjacentNum(false);
          if (v && v > 0) kvTarget = v;
        } else if (
          kvCollected === 0 &&
          /(collection|collected|actual|achieved|total\s*coll|cash\s*coll|below\s*3\s*coll)/i.test(
            ll,
          ) &&
          !/collectible|%|target|budget|count|acct|variance|shortfall/i.test(ll)
        ) {
          const v = readAdjacentNum(false);
          if (v && v > 0) kvCollected = v;
        } else if (
          kvPct === null &&
          /(%|ach\s*%|coll\s*%|achievement|ratio)/i.test(ll)
        ) {
          const v = readAdjacentNum(true);
          if (v !== null && v > 0) kvPct = v;
        }
      }
    }
    if (kvTarget > 0 && kvCollected > 0) {
      const candidateScore = titleBonus + bottomBonus + 10;
      if (
        candidateScore > bestScore ||
        (candidateScore === bestScore && kvTarget > bestTarget)
      ) {
        bestScore = candidateScore;
        bestTarget = kvTarget;
        bestCollected = kvCollected;
        bestPct = kvPct;
      }
    }
  }

  const byOfficer = bestOfficers;
  if (bestTarget === 0 && byOfficer.length >= 2) {
    bestTarget = byOfficer.reduce((s, o) => s + o.targetAmount, 0);
    bestCollected = byOfficer.reduce((s, o) => s + o.collectedAmount, 0);
  }

  // Auto-scale if values were stored in Millions without explicit "M" suffix (e.g., 32.45 and 23.80)
  if (bestTarget > 1 && bestTarget < 500 && bestCollected >= 0 && bestCollected < 500) {
    bestTarget = Math.round(bestTarget * 1_000_000);
    bestCollected = Math.round(bestCollected * 1_000_000);
    if (bestVariance !== null && Math.abs(bestVariance) < 500) {
      bestVariance = Math.round(bestVariance * 1_000_000);
    }
    for (const o of byOfficer) {
      if (o.targetAmount > 0 && o.targetAmount < 500) {
        o.targetAmount = Math.round(o.targetAmount * 1_000_000);
        o.collectedAmount = Math.round(o.collectedAmount * 1_000_000);
        o.varianceAmount = o.collectedAmount - o.targetAmount;
      }
    }
  }

  if (bestTarget < 100_000) {
    return undefined;
  }

  const normalizedVariance = Math.round(bestCollected - bestTarget);
  const normalizedPct =
    bestPct !== null && bestPct > 0 && bestPct <= 200
      ? bestPct
      : bestTarget > 0
        ? Math.round((bestCollected / bestTarget) * 1000) / 10
        : 0;

  return {
    sheetName,
    targetAmount: Math.round(bestTarget),
    collectedAmount: Math.round(bestCollected),
    varianceAmount: normalizedVariance,
    collectionPct: normalizedPct,
    totalCount: bestTotalCount,
    paidCount: bestPaidCount,
    notPaidCount: bestNotPaidCount,
    contractsNeeded: bestNeededCount,
    byOfficer,
  };
}

function applyStrictNplUniverseFilter(
  baseResult: ParsedAersResult,
  mrpMap?: Map<string, MrpEnrichment>,
  watchlistImports?: Sheet2WatchlistRow[],
  bmDashboardBelowThree?: BmDashboardBelowThreeExtracted,
): ParsedAersResult {
  const allRecords = baseResult.records;
  const ageBuckets = computeBmAgeBuckets(allRecords, []);
  const totalContracts = allRecords.length;
  const belowOneCount = allRecords.filter((r) => (r.currentAge || 0) <= 1.0).length;
  const ratio90Pct =
    totalContracts > 0 ? Math.round((belowOneCount / totalContracts) * 1000) / 10 : 0;
  const openingNplCount = allRecords.filter((r) => (r.opNpl || 0) > 0).length;
  const closingNplCount = allRecords.filter((r) => (r.npl || 0) > 0).length;
  const totalOpNpl = allRecords.reduce((s, r) => s + (r.opNpl || 0), 0);
  const totalClosingNpl = allRecords.reduce((s, r) => s + (r.npl || 0), 0);

  const bmBranchSnapshot = {
    ageBuckets,
    roPerformance: computeBmOfficerPerformance(allRecords, [], 'RO'),
    moPerformance: computeBmOfficerPerformance(allRecords, [], 'MO'),
    ageGroupEfforts: computeAgeGroupEfforts(allRecords),
    belowOneQuickWins: extractBelowOneQuickWins(allRecords),
    belowThreeSummary: computeBelowThreeCollectionSnapshot(
      allRecords,
      650,
      bmDashboardBelowThree,
    ),
    totalContracts,
    belowOneCount,
    ratio90Pct,
    openingNplCount,
    closingNplCount,
    totalOpNpl,
    totalClosingNpl,
  };

  const eligibleRecords: AersRecord[] = [];
  const excludedRegularContractNos: string[] = [];

  for (const r of allRecords) {
    const mrpHit = mrpMap?.get(normalizeContractNo(r.contractNo));
    if (isEligibleNplOrBorderline(r, mrpHit)) {
      eligibleRecords.push(r);
    } else {
      excludedRegularContractNos.push(normalizeContractNo(r.contractNo));
    }
  }

  return {
    records: eligibleRecords,
    metadata: {
      ...baseResult.metadata,
      totalContractsCount: eligibleRecords.length,
      excludedRegularCount: excludedRegularContractNos.length,
      bmBranchSnapshot,
    },
    mrpMap,
    watchlistImports,
    isMultiSheetWorkbook: Boolean(mrpMap || watchlistImports || bmDashboardBelowThree),
    excludedRegularContractNos,
  };
}

export function parseAersWorkbook(
  buffer: ArrayBuffer,
  fileName: string,
): ParsedAersResult {
  const workbook = XLSX.read(buffer, { type: 'array', raw: true });
  if (!workbook.SheetNames.length) {
    throw new Error('Uploaded file contains no worksheets.');
  }

  const sheetLookup = new Map<string, string>();
  workbook.SheetNames.forEach((name) => {
    sheetLookup.set(name.trim().toLowerCase(), name);
  });

  const aersSheetName =
    sheetLookup.get('aers') ??
    sheetLookup.get('sheet1') ??
    workbook.SheetNames[0];
  const aersWorksheet = workbook.Sheets[aersSheetName];
  const aersRows = XLSX.utils.sheet_to_json<unknown[]>(aersWorksheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  const baseResult = parseAersRows(aersRows, fileName);

  const mrpSheetName =
    sheetLookup.get('mrp') ??
    workbook.SheetNames.find((n) => n.trim().toLowerCase().includes('mrp'));
  let mrpMap: Map<string, MrpEnrichment> | undefined;
  if (mrpSheetName && mrpSheetName !== aersSheetName) {
    const mrpRows = XLSX.utils.sheet_to_json<unknown[]>(
      workbook.Sheets[mrpSheetName],
      { header: 1, defval: '', blankrows: false },
    );
    const parsedMrp = parseMrpSheet(mrpRows);
    if (parsedMrp.size > 0) {
      mrpMap = parsedMrp;
    }
  }

  const sheet2Name =
    sheetLookup.get('sheet2') ??
    sheetLookup.get('ro watchlist') ??
    sheetLookup.get('watchlist');
  let watchlistImports: Sheet2WatchlistRow[] | undefined;
  if (sheet2Name && sheet2Name !== aersSheetName) {
    const s2Rows = XLSX.utils.sheet_to_json<unknown[]>(
      workbook.Sheets[sheet2Name],
      { header: 1, defval: '', blankrows: false },
    );
    const parsedS2 = parseSheet2Watchlist(s2Rows);
    if (parsedS2.length > 0) {
      watchlistImports = parsedS2;
    }
  }

  // Parse BM Dashboard sheet for exact Below 3 Collection Target / Collection / Variance
  const bmDashSheetName =
    sheetLookup.get('bm dashboard') ??
    sheetLookup.get('bm_dashboard') ??
    sheetLookup.get('bmdashboard') ??
    workbook.SheetNames.find((n) => /bm.*dash|dashboard.*bm/i.test(n)) ??
    workbook.SheetNames.find(
      (n) =>
        /dashboard|summary/i.test(n) &&
        n !== aersSheetName &&
        n !== mrpSheetName &&
        n !== sheet2Name,
    );

  let bmDashboardBelowThree: BmDashboardBelowThreeExtracted | undefined;
  if (bmDashSheetName && bmDashSheetName !== aersSheetName) {
    const knownOfficers = new Map<string, { officer: string; role: string }>();
    for (const rec of baseResult.records) {
      const off = getOfficerByOfficeType(rec);
      if (!off || off === 'Unassigned') continue;
      const role = isMarketingOfficeType(rec.officeType) ? 'MO' : 'RO';
      knownOfficers.set(off.toLowerCase(), { officer: off, role });
    }
    const bmRows = XLSX.utils.sheet_to_json<unknown[]>(
      workbook.Sheets[bmDashSheetName],
      { header: 1, defval: '', blankrows: false },
    );
    bmDashboardBelowThree = parseBmDashboardBelowThree(
      bmRows,
      bmDashSheetName,
      knownOfficers,
    );
  }

  return applyStrictNplUniverseFilter(
    baseResult,
    mrpMap,
    watchlistImports,
    bmDashboardBelowThree,
  );
}

export function parseAersPastedText(
  rawText: string,
  sourceName = 'Daily Pasted AERS Evaluation',
): ParsedAersResult {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error('Paste Age Evaluation rows from Excel or CSV first.');
  }

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const usesTabs = lines.some((l) => l.includes('\t'));

  if (usesTabs) {
    const rows = lines.map((line) => line.split('\t').map((c) => c.trim()));
    return applyStrictNplUniverseFilter(parseAersRows(rows, sourceName));
  }

  const workbook = XLSX.read(trimmed, { type: 'string', raw: true });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });
  return applyStrictNplUniverseFilter(parseAersRows(rows, sourceName));
}

export interface SyncResult {
  updatedContracts: TrackedContract[];
  syncedCount: number;
  importedFromSheet2Count: number;
  skippedRegularSheet2Count: number;
  mrpEnrichedCount: number;
  newlySavedCount: number;
  newlySavedAmount: number;
  brokenPpCount: number;
  snapshot: MonthlySnapshot;
}

export function syncTrackedContractsWithAers(
  tracked: TrackedContract[],
  aersMap: Map<string, AersRecord>,
  aersMeta: AersMetadata,
  options?: {
    mrpMap?: Map<string, MrpEnrichment>;
    watchlistImports?: Sheet2WatchlistRow[];
  },
): SyncResult {
  const todayISO = getTodayISO();
  const mrpMap = options?.mrpMap;
  const watchlistImports = options?.watchlistImports ?? [];

  const existingKeys = new Set(
    tracked.map((c) => normalizeContractNo(c.contractNo)),
  );
  let importedFromSheet2Count = 0;
  let skippedRegularSheet2Count = 0;

  const seededFromSheet2: TrackedContract[] = [];
  for (const row of watchlistImports) {
    const key = normalizeContractNo(row.contractNo);
    if (!key || existingKeys.has(key)) continue;

    const match = aersMap.get(key);
    const mrpHit = mrpMap?.get(key);
    if (!match && !mrpHit?.borderNpl) {
      skippedRegularSheet2Count += 1;
      continue;
    }

    existingKeys.add(key);
    importedFromSheet2Count += 1;

    const assignedOfficer = match
      ? getOfficerByOfficeType(match)
      : stripOfficerPrefix(row.ro);

    seededFromSheet2.push({
      contractNo: key,
      cusName: match?.cusName || row.name || 'Unnamed Client',
      mobileNo: match?.mobileNo || '',
      address: match?.address || '',
      officeType: match?.officeType,
      opAge: match?.opAge ?? 0,
      currentAge: match?.currentAge ?? 0,
      opBalDebtor: match?.opBalDebtor,
      closingDebtor: match?.closingDebtor ?? 0,
      capitalOutstanding: match?.capitalOutstanding ?? 0,
      opCapitalOutstanding: match?.opCapitalOutstanding ?? 0,
      capitalArrears: match?.capitalArrears ?? 0,
      currentMonthDue: match?.currentMonthDue,
      totalCollection: match?.totalCollection,
      opNpl: match?.opNpl ?? 0,
      npl: match?.npl ?? 0,
      actualDpd: match?.actualDpd ?? 0,
      monthEndForecastDpd: match?.monthEndForecastDpd ?? 0,
      minAmountToReverseNpl: match?.minAmountToReverseNpl ?? 0,
      recoveryOfficer: stripOfficerPrefix(match?.recoveryOfficer || row.ro),
      marketingOfficer: stripOfficerPrefix(match?.marketingOfficer),
      lastPayDate: match?.lastPayDate || '',
      lastPaidAmount: match?.lastPaidAmount ?? 0,
      nplReason: match?.nplReason,
      worstCaseProduct: match?.worstCaseProduct,
      assignOfficerEfforts: match?.assignOfficerEfforts,
      totalEfforts: match?.totalEfforts,
      vehicleNo: match?.currentStock
        ? normalizeVehicleNo(match.currentStock)
        : '',
      visitWith: 'My Self',
      visitDate: todayISO,
      ppDate: '',
      handOverDate: '',
      remark: 'Imported from Sheet2 Watchlist.',
      remarkBy: assignedOfficer || 'Officer',
      ro: assignedOfficer,
      currentSituation: 'Active Follow-Up',
      mrp: mrpHit,
      locationUrl: '',
      nplSavedAmount: 0,
      addedAt: todayISO,
      lastSyncedAt: aersMeta.printedDateTime,
      visitHistory: [],
    });
  }

  const combinedTracked =
    seededFromSheet2.length > 0 ? [...seededFromSheet2, ...tracked] : tracked;

  let syncedCount = 0;
  let mrpEnrichedCount = 0;
  let newlySavedCount = 0;
  let newlySavedAmount = 0;
  let brokenPpCount = 0;
  let fallenNplCount = 0;
  let newNplAmount = 0;
  let totalCollection = 0;
  let totalDueBudget = 0;

  const updatedContracts = combinedTracked.map((item) => {
    const key = normalizeContractNo(item.contractNo);
    const match = aersMap.get(key);
    const mrpHit = mrpMap?.get(key);
    const nextMrp = mrpHit ?? item.mrp;
    if (mrpHit) mrpEnrichedCount += 1;

    if (!match) {
      if (isBrokenPromiseToPay(item, todayISO)) {
        brokenPpCount += 1;
        return {
          ...item,
          mrp: nextMrp,
          currentSituation: 'BROKEN P/P' as ContractSituation,
        };
      }
      return nextMrp !== item.mrp ? { ...item, mrp: nextMrp } : item;
    }

    syncedCount += 1;
    totalCollection += match.totalCollection;
    totalDueBudget += match.dueBudgetMonth || match.currentMonthDue;

    const startedAtRiskOn1st =
      item.opNpl > 0 ||
      match.opNpl > 0 ||
      item.npl > 0 ||
      item.opAge >= 2.01 ||
      match.opAge >= 2.01 ||
      item.monthEndForecastDpd >= 91;
    const hasPaymentOrSafeForecast =
      match.opNpl > 0 ||
      item.opNpl > 0 ||
      item.npl > 0 ||
      match.totalCollection > 0 ||
      match.lastPaidAmount > 0 ||
      (match.monthEndForecastDpd > 0 && match.monthEndForecastDpd < 80);
    const nowCleanOn30th =
      match.npl === 0 &&
      match.actualDpd < 91 &&
      match.monthEndForecastDpd < 91 &&
      hasPaymentOrSafeForecast;

    let nextSituation: ContractSituation = item.currentSituation;
    let nextNplSavedAmount = item.nplSavedAmount || 0;

    const capWithArrears =
      (match.capitalOutstanding ||
        item.capitalOutstanding ||
        match.opCapitalOutstanding ||
        item.opCapitalOutstanding ||
        0) + (match.capitalArrears || item.capitalArrears || 0);

    const opCapWithArrears =
      (match.opCapitalOutstanding ||
        item.opCapitalOutstanding ||
        match.capitalOutstanding ||
        item.capitalOutstanding ||
        0) + (match.capitalArrears || item.capitalArrears || 0);

    if (startedAtRiskOn1st && nowCleanOn30th) {
      nextSituation = 'NPL SAVED';
      const savedValue =
        match.opNpl > 0
          ? match.opNpl
          : item.opNpl > 0
            ? item.opNpl
            : item.npl > 0
              ? item.npl
              : opCapWithArrears > 0
                ? opCapWithArrears
                : match.closingDebtor || item.closingDebtor;
      nextNplSavedAmount = savedValue;
      if (item.currentSituation !== 'NPL SAVED') {
        newlySavedCount += 1;
        newlySavedAmount += savedValue;
      }
    } else {
      const transitionedToNpl =
        item.npl === 0 &&
        item.actualDpd < 91 &&
        (match.npl > 0 || match.actualDpd >= 91);
      const monthToDateFallen = isFallenNplAccount(match);
      if (transitionedToNpl || monthToDateFallen) {
        fallenNplCount += 1;
        newNplAmount += match.npl > 0 ? match.npl : capWithArrears;
      }
      const candidate: TrackedContract = {
        ...item,
        lastPayDate: match.lastPayDate,
      };
      if (isBrokenPromiseToPay(candidate, todayISO)) {
        nextSituation = 'BROKEN P/P';
        brokenPpCount += 1;
      } else if (item.currentSituation === 'NPL SAVED') {
        nextSituation = 'Active Follow-Up';
        nextNplSavedAmount = 0;
      }
    }

    const nextOfficeType = match.officeType || item.officeType;
    const nextRo = stripOfficerPrefix(match.recoveryOfficer || item.recoveryOfficer);
    const nextMo = stripOfficerPrefix(match.marketingOfficer || item.marketingOfficer);
    const dynamicOfficer = getOfficerByOfficeType({
      officeType: nextOfficeType,
      marketingOfficer: nextMo,
      recoveryOfficer: nextRo,
    });

    return {
      ...item,
      cusName: match.cusName || item.cusName,
      mobileNo: match.mobileNo || item.mobileNo,
      address: match.address || item.address,
      opAge: match.opAge,
      currentAge: match.currentAge,
      opBalDebtor: match.opBalDebtor,
      closingDebtor: match.closingDebtor,
      capitalOutstanding: match.capitalOutstanding,
      opCapitalOutstanding: match.opCapitalOutstanding,
      capitalArrears: match.capitalArrears ?? item.capitalArrears,
      currentMonthDue: match.currentMonthDue,
      totalCollection: match.totalCollection,
      opNpl: match.opNpl,
      npl: match.npl,
      actualDpd: match.actualDpd,
      monthEndForecastDpd: match.monthEndForecastDpd,
      minAmountToReverseNpl: match.minAmountToReverseNpl,
      recoveryOfficer: nextRo,
      marketingOfficer: nextMo,
      ro: dynamicOfficer !== 'Unassigned' ? dynamicOfficer : stripOfficerPrefix(item.ro),
      lastPayDate: match.lastPayDate,
      lastPaidAmount: match.lastPaidAmount,
      nplReason: match.nplReason,
      worstCaseProduct: match.worstCaseProduct,
      officeType: nextOfficeType,
      assignOfficerEfforts: match.assignOfficerEfforts,
      totalEfforts: match.totalEfforts,
      mrp: nextMrp,
      currentSituation: nextSituation,
      nplSavedAmount: nextNplSavedAmount,
      lastSyncedAt: aersMeta.printedDateTime,
    };
  });

  const trackedDebtor = updatedContracts.reduce(
    (sum, c) => sum + (c.closingDebtor || 0),
    0,
  );
  const trackedNpl = updatedContracts.reduce((sum, c) => sum + (c.npl || 0), 0);
  const savedTotalAmount = updatedContracts
    .filter((c) => isNplSavedAccount(c))
    .reduce((sum, c) => sum + getSavedNplCapitalValue(c), 0);
  const savedTotalCount = updatedContracts.filter((c) =>
    isNplSavedAccount(c),
  ).length;

  let branchDebtor = 0;
  let branchNpl = 0;
  let branchDue = 0;
  let branchColl = 0;
  for (const r of aersMap.values()) {
    branchDebtor += r.closingDebtor || 0;
    branchNpl += r.npl || 0;
    branchDue += r.dueBudgetMonth || r.currentMonthDue || 0;
    branchColl += r.totalCollection || 0;
  }
  const branchCollectionPct =
    branchDue > 0
      ? Math.min(200, Math.round((branchColl / branchDue) * 1000) / 10)
      : 0;

  const snapDate = aersMeta.printedDateTime.slice(0, 10) || todayISO;
  const monthKey = snapDate.slice(0, 7);
  const dateObj = new Date(`${snapDate}T00:00:00`);
  const label = Number.isNaN(dateObj.getTime())
    ? snapDate
    : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const collectionPct =
    totalDueBudget > 0
      ? Math.min(200, Math.round((totalCollection / totalDueBudget) * 1000) / 10)
      : branchCollectionPct;

  const snapshot: MonthlySnapshot = {
    id: `snap_${Date.now()}`,
    label,
    monthKey,
    snapshotDate: snapDate,
    trackedCount: updatedContracts.length,
    trackedDebtor,
    trackedNpl,
    nplSavedAmount: savedTotalAmount,
    nplSavedCount: savedTotalCount,
    newNplAmount,
    fallenNplCount,
    collectionPct,
    branchCount: aersMap.size,
    branchDebtor,
    branchNpl,
    branchCollectionPct,
    sourceFile: aersMeta.fileName,
  };

  return {
    updatedContracts,
    syncedCount,
    importedFromSheet2Count,
    skippedRegularSheet2Count,
    mrpEnrichedCount,
    newlySavedCount,
    newlySavedAmount,
    brokenPpCount,
    snapshot,
  };
}

export function parseWhatsAppLocations(
  rawText: string,
  trackedContracts: TrackedContract[],
): WhatsAppLocationMatch[] {
  const vehicleToContract = new Map<string, TrackedContract>();
  trackedContracts.forEach((c) => {
    if (c.vehicleNo) {
      vehicleToContract.set(normalizeVehicleNo(c.vehicleNo), c);
    }
  });

  const lines = rawText.split(/\r?\n/);
  const blocks: string[] = [];
  const waTimestampStart = /^(\[?\d{1,2}[/-]\d{1,2}[/-]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?\]?)/i;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (waTimestampStart.test(trimmed) || blocks.length === 0) {
      blocks.push(trimmed);
    } else {
      blocks[blocks.length - 1] = `${blocks[blocks.length - 1]}\n${trimmed}`;
    }
  }

  const vehicleRegex =
    /\b(?:(?:WP|CP|SP|NP|EP|NW|NC|SG|UVA)\s+)?(?:[A-Z]{2,3}[-\s]?\d{4}|\d{2,3}[-\s]?\d{4})\b/gi;
  const mapUrlRegex =
    /https?:\/\/(?:maps\.google\.com|www\.google\.com\/maps|goo\.gl\/maps|maps\.app\.goo\.gl)[^\s<>"]+/i;
  const coordsRegex = /(-?\d{1,2}\.\d{4,})\s*,\s*(-?\d{1,3}\.\d{4,})/;

  const matches: WhatsAppLocationMatch[] = [];
  const seenVehicles = new Set<string>();

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const nextBlock = i + 1 < blocks.length ? blocks[i + 1] : '';
    const combined = `${block}\n${nextBlock}`;

    const vehicleHits = block.match(vehicleRegex);
    if (!vehicleHits) continue;

    const urlMatch = block.match(mapUrlRegex) || combined.match(mapUrlRegex);
    const coordMatch = block.match(coordsRegex) || combined.match(coordsRegex);

    let locationUrl = '';
    if (urlMatch) {
      locationUrl = urlMatch[0];
    } else if (coordMatch) {
      locationUrl = `https://www.google.com/maps?q=${coordMatch[1]},${coordMatch[2]}`;
    }

    if (!locationUrl) continue;

    const tsMatch = block.match(waTimestampStart);
    const timestampText = tsMatch ? tsMatch[1].replace(/[[\]]/g, '').trim() : getTodayISO();

    for (const rawHit of vehicleHits) {
      const normalized = normalizeVehicleNo(rawHit);
      if (normalized.length < 6) continue;
      if (seenVehicles.has(normalized)) continue;
      seenVehicles.add(normalized);

      const contract = vehicleToContract.get(normalized);
      const locationText = block
        .replace(waTimestampStart, '')
        .replace(mapUrlRegex, '')
        .replace(/^[^:]{1,35}:\s*/, '')
        .trim()
        .slice(0, 120);

      matches.push({
        rawVehicleNo: rawHit.trim(),
        normalizedVehicleNo: normalized,
        locationUrl,
        locationText,
        timestampText,
        matchedContractNo: contract?.contractNo,
        matchedClientName: contract?.cusName,
      });
    }
  }

  return matches;
}

export function playAlertChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = [880, 1174.66];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);
      gain.gain.setValueAtTime(0.001, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.12, now + idx * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.26);
    });
  } catch {
    // Ignore audio context restrictions
  }
}

export interface RecoveryAlertDigest {
  todayPp: TrackedContract[];
  brokenPp: TrackedContract[];
  dpd91Danger: TrackedContract[];
  pendingHandOver: TrackedContract[];
}

export function buildRecoveryAlertDigest(
  contracts: TrackedContract[],
): RecoveryAlertDigest {
  const todayISO = getTodayISO();
  return {
    todayPp: contracts.filter((c) => isTodayPromiseToPay(c, todayISO)),
    brokenPp: contracts.filter((c) => isBrokenPromiseToPay(c, todayISO)),
    dpd91Danger: contracts.filter((c) => isWithin4DaysOf91Dpd(c)),
    pendingHandOver: contracts.filter((c) => isPendingHandOver(c, todayISO)),
  };
}

export function triggerDesktopNotifications(
  digest: RecoveryAlertDigest,
  soundEnabled: boolean,
  isTest = false,
): { sentCount: number; permission: NotificationPermission | 'unsupported' } {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { sentCount: 0, permission: 'unsupported' };
  }
  if (Notification.permission !== 'granted') {
    return { sentCount: 0, permission: Notification.permission };
  }

  let sentCount = 0;
  const dispatch = (title: string, body: string, tag: string) => {
    try {
      new Notification(title, { body, tag });
      sentCount += 1;
    } catch {
      // Ignore
    }
  };

  if (digest.todayPp.length > 0) {
    const sample = digest.todayPp
      .slice(0, 3)
      .map(
        (c) =>
          `${c.cusName} (${c.vehicleNo || c.contractNo}) — ${formatCurrencyRs(c.closingDebtor)}`,
      )
      .join('\n');
    dispatch(
      `Today's P/P Due (${digest.todayPp.length})`,
      sample,
      'wg-today-pp',
    );
  }

  if (digest.brokenPp.length > 0) {
    const sample = digest.brokenPp
      .slice(0, 3)
      .map(
        (c) =>
          `${c.cusName} (${c.vehicleNo || c.contractNo}) · P/P ${c.ppDate}`,
      )
      .join('\n');
    dispatch(
      `Broken P/P Alert (${digest.brokenPp.length})`,
      sample,
      'wg-broken-pp',
    );
  }

  if (digest.dpd91Danger.length > 0) {
    const daysLeft = getDaysRemainingTo30th();
    const sample = digest.dpd91Danger
      .slice(0, 3)
      .map(
        (c) =>
          `${c.contractNo} (${c.vehicleNo || 'No Veh'}) · ${c.actualDpd} DPD -> Forecast ${c.monthEndForecastDpd}`,
      )
      .join('\n');
    dispatch(
      `91 DPD Danger Alert (${digest.dpd91Danger.length} · ${daysLeft}d to 30th)`,
      sample,
      'wg-dpd91-danger',
    );
  }

  if (digest.pendingHandOver.length > 0) {
    const sample = digest.pendingHandOver
      .slice(0, 3)
      .map(
        (c) =>
          `${c.cusName} (${c.vehicleNo || c.contractNo}) · H/O ${c.handOverDate}`,
      )
      .join('\n');
    dispatch(
      `Pending Hand Over (${digest.pendingHandOver.length})`,
      sample,
      'wg-handover',
    );
  }

  if (sentCount === 0 && isTest) {
    dispatch(
      'WG Visit & NPL Control System',
      'Desktop pop-up alerts are active. No urgent alerts pending right now.',
      'wg-test-alert',
    );
  }

  if (sentCount > 0 && soundEnabled) {
    playAlertChime();
  }

  return { sentCount, permission: Notification.permission };
}

export function exportTrackedToExcel(
  contracts: TrackedContract[],
  format: 'xlsx' | 'csv' = 'xlsx',
): void {
  const rows = contracts.map((c) => ({
    CONTRACT_NO: c.contractNo,
    CUS_NAME: c.cusName,
    MOBILE_NO: c.mobileNo,
    VEHICLE_NO: c.vehicleNo,
    OFFICE_TYPE: c.officeType || '',
    ASSIGNED_OFFICER: getOfficerByOfficeType(c),
    RECOVERY_OFFICER: c.recoveryOfficer,
    MARKETING_OFFICER: c.marketingOfficer,
    OP_AGE: c.opAge,
    CURRENT_AGE: c.currentAge,
    ACTUAL_DPD: c.actualDpd,
    MONTH_END_FORECAST_DPD: c.monthEndForecastDpd,
    CLOSING_DEBTOR: c.closingDebtor,
    OP_NPL: c.opNpl,
    CURRENT_NPL: c.npl,
    MIN_TO_REVERSE_NPL: c.minAmountToReverseNpl,
    LAST_PAY_DATE: c.lastPayDate,
    LAST_PAID_AMOUNT: c.lastPaidAmount,
    VISIT_WITH: c.visitWith,
    VISIT_DATE: c.visitDate,
    PP_DATE: c.ppDate,
    HAND_OVER_DATE: c.handOverDate,
    CURRENT_SITUATION: c.currentSituation,
    NPL_SAVED_AMOUNT: c.nplSavedAmount,
    REMARK: c.remark,
    REMARK_BY: c.remarkBy,
    LOCATION_URL: c.locationUrl,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tracked Watchlist');
  const fileName = `WG_NPL_Watchlist_${getTodayISO()}.${format}`;
  XLSX.writeFile(wb, fileName, { bookType: format });
}

export function downloadSampleAersExcel(aersRecords: AersRecord[]): void {
  const today = getTodayISO();
  const headers = [
    'NO',
    'CONTRACT_NO',
    'CUS_NAME',
    'CONTRACT_DATE',
    'OP_AGE',
    'CURRENT_AGE',
    'OP_BAL_DEBTOR',
    'CLOSING_DEBTOR',
    'DUE_BUDGET_MONTH',
    'CURRENT_MONTH_DUE',
    'TOTAL_COLLECTION',
    'CASH_COLL',
    'CAPITAL_OUTSTANDING',
    'Interest In Suspense',
    'ACTUAL_DPD',
    'MONTH_END_FORECAST_DPD',
    'MIN_AMOUNT_TO_REVERSE_NPL',
    'Op Npl',
    'NPL',
    'NEXT_DUE_DATE',
    'LAST_PAY_DATE',
    'LAST_PAID_AMOUNT',
    'CONTRACT_STATUS',
    'RECOVERY_STATUS',
    'MARKETING_OFFICER',
    'RECOVERY_OFFICER',
    'FINANCE_AMOUNT',
    'CURRENT_STOCK',
    'Department',
    'ADDRESS',
    'MOBILE_NO',
    'Op Capital Outstanding',
    'Npl Reason',
    'Worst Case related Product',
    'Office Type',
    'Current Rc',
    'Total Efforts',
    'Assign Officer Efforts',
  ];

  const aoa: unknown[][] = [
    ['Age Evaluation Report Sub (AERS)'],
    [`Printed Date and Time: ${today} 09:30:15`],
    headers,
    ...aersRecords.map((r) => [
      r.no,
      r.contractNo,
      r.cusName,
      r.contractDate,
      r.opAge,
      r.currentAge,
      r.opBalDebtor,
      r.closingDebtor,
      r.dueBudgetMonth,
      r.currentMonthDue,
      r.totalCollection,
      r.cashColl,
      r.capitalOutstanding,
      r.interestInSuspense,
      r.actualDpd,
      r.monthEndForecastDpd,
      r.minAmountToReverseNpl,
      r.opNpl,
      r.npl,
      r.nextDueDate,
      r.lastPayDate,
      r.lastPaidAmount,
      r.contractStatus,
      r.recoveryStatus,
      r.marketingOfficer,
      r.recoveryOfficer,
      r.financeAmount,
      r.currentStock,
      r.department,
      r.address,
      r.mobileNo,
      r.opCapitalOutstanding,
      r.nplReason,
      r.worstCaseProduct,
      r.officeType,
      r.currentRc,
      r.totalEfforts,
      r.assignOfficerEfforts,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'AERS Report');
  XLSX.writeFile(wb, `AERS_Report_${today}.xlsx`);
}

export interface EvaluableAccount {
  contractNo: string;
  cusName: string;
  vehicleNo: string;
  officeType: string;
  officer: string;
  opAge: number;
  currentAge: number;
  actualDpd: number;
  monthEndForecastDpd: number;
  opBalDebtor: number;
  closingDebtor: number;
  capitalOutstanding: number;
  opCapitalOutstanding?: number;
  capitalArrears?: number;
  minAmountToReverseNpl: number;
  currentMonthDue: number;
  totalCollection?: number;
  lastPaidAmount?: number;
  opNpl: number;
  npl: number;
  nplReason: string;
  worstCaseProduct: string;
  assignOfficerEfforts: number;
  totalEfforts: number;
  isWorst: boolean;
  isTracked: boolean;
  borderNpl?: boolean;
}

export function normalizeEvaluableFromTracked(
  tracked: TrackedContract[],
): EvaluableAccount[] {
  return tracked.map((c) => {
    const nplReason = c.nplReason || '';
    const worstCaseProduct = c.worstCaseProduct || '';
    return {
      contractNo: c.contractNo,
      cusName: c.cusName,
      vehicleNo: c.vehicleNo,
      officeType: (c.officeType || 'Unassigned Office').trim() || 'Unassigned Office',
      officer: getOfficerByOfficeType(c),
      opAge: c.opAge || 0,
      currentAge: c.currentAge || 0,
      actualDpd: c.actualDpd || 0,
      monthEndForecastDpd: c.monthEndForecastDpd || 0,
      opBalDebtor: c.opBalDebtor ?? c.closingDebtor ?? 0,
      closingDebtor: c.closingDebtor || 0,
      capitalOutstanding: c.capitalOutstanding || 0,
      opCapitalOutstanding: c.opCapitalOutstanding || 0,
      capitalArrears: c.capitalArrears || 0,
      minAmountToReverseNpl: c.minAmountToReverseNpl || 0,
      currentMonthDue: c.currentMonthDue ?? 0,
      totalCollection: c.totalCollection ?? 0,
      lastPaidAmount: c.lastPaidAmount ?? 0,
      opNpl: c.opNpl || 0,
      npl: c.npl || 0,
      nplReason,
      worstCaseProduct,
      assignOfficerEfforts: c.assignOfficerEfforts ?? 0,
      totalEfforts: c.totalEfforts ?? 0,
      isWorst: isWorstCategory(nplReason, worstCaseProduct),
      isTracked: true,
      borderNpl: Boolean(c.mrp?.borderNpl),
    };
  });
}

export function normalizeEvaluableFromAers(
  records: AersRecord[],
  trackedNos: Set<string>,
  mrpMap?: Map<string, MrpEnrichment>,
): EvaluableAccount[] {
  return records.map((r) => ({
    contractNo: r.contractNo,
    cusName: r.cusName,
    vehicleNo: r.currentStock ? normalizeVehicleNo(r.currentStock) : '',
    officeType: (r.officeType || 'Unassigned Office').trim() || 'Unassigned Office',
    officer: getOfficerByOfficeType(r),
    opAge: r.opAge || 0,
    currentAge: r.currentAge || 0,
    actualDpd: r.actualDpd || 0,
    monthEndForecastDpd: r.monthEndForecastDpd || 0,
    opBalDebtor: r.opBalDebtor || 0,
    closingDebtor: r.closingDebtor || 0,
    capitalOutstanding: r.capitalOutstanding || 0,
    opCapitalOutstanding: r.opCapitalOutstanding || 0,
    capitalArrears: r.capitalArrears || 0,
    minAmountToReverseNpl: r.minAmountToReverseNpl || 0,
    currentMonthDue: r.currentMonthDue || r.dueBudgetMonth || 0,
    totalCollection: r.totalCollection || 0,
    lastPaidAmount: r.lastPaidAmount || 0,
    opNpl: r.opNpl || 0,
    npl: r.npl || 0,
    nplReason: r.nplReason || '',
    worstCaseProduct: r.worstCaseProduct || '',
    assignOfficerEfforts: r.assignOfficerEfforts || 0,
    totalEfforts: r.totalEfforts || 0,
    isWorst: isWorstCategory(r.nplReason, r.worstCaseProduct),
    isTracked: trackedNos.has(normalizeContractNo(r.contractNo)),
    borderNpl: Boolean(mrpMap?.get(normalizeContractNo(r.contractNo))?.borderNpl),
  }));
}

export function buildOpeningOfficerBaseline(
  records: AersRecord[],
  printedDateTime: string,
): OpeningOfficerBaseline {
  const byOfficer: OpeningOfficerBaseline['byOfficer'] = {};
  for (const r of records) {
    const key = getOfficerByOfficeType(r);
    if (!byOfficer[key]) {
      byOfficer[key] = {
        openingCount: 0,
        openingDebtor: 0,
        openingNpl: 0,
        openingNplCount: 0,
      };
    }
    byOfficer[key].openingCount += 1;
    byOfficer[key].openingDebtor += r.opBalDebtor || 0;
    byOfficer[key].openingNpl += r.opNpl || 0;
    if ((r.opNpl || 0) > 0) {
      byOfficer[key].openingNplCount += 1;
    }
  }
  return {
    printedDateTime,
    byOfficer,
  };
}

export function computeDpdAgeBuckets(
  items: EvaluableAccount[],
): AgeBucketDatum[] {
  const buckets: AgeBucketDatum[] = [
    {
      bucket: '0 (Cur)',
      rangeKey: '0',
      count: 0,
      closingDebtor: 0,
      nplAmount: 0,
      minToSave: 0,
    },
    {
      bucket: '1-30 DPD',
      rangeKey: '1-30',
      count: 0,
      closingDebtor: 0,
      nplAmount: 0,
      minToSave: 0,
    },
    {
      bucket: '31-60 DPD',
      rangeKey: '31-60',
      count: 0,
      closingDebtor: 0,
      nplAmount: 0,
      minToSave: 0,
    },
    {
      bucket: '61-90 DPD',
      rangeKey: '61-90',
      count: 0,
      closingDebtor: 0,
      nplAmount: 0,
      minToSave: 0,
    },
    {
      bucket: '91+ DPD',
      rangeKey: '91+',
      count: 0,
      closingDebtor: 0,
      nplAmount: 0,
      minToSave: 0,
    },
  ];

  for (const item of items) {
    const dpd = item.actualDpd;
    let idx = 0;
    if (dpd <= 0) idx = 0;
    else if (dpd <= 30) idx = 1;
    else if (dpd <= 60) idx = 2;
    else if (dpd <= 90) idx = 3;
    else idx = 4;

    buckets[idx].count += 1;
    buckets[idx].closingDebtor += item.closingDebtor;
    buckets[idx].nplAmount += item.npl;
    buckets[idx].minToSave +=
      item.minAmountToReverseNpl > 0
        ? item.minAmountToReverseNpl
        : item.currentMonthDue;
  }

  return buckets;
}

export function isEvaluableBorderlineAccount(item: EvaluableAccount): boolean {
  if (item.actualDpd >= 91 || item.npl > 0) return false;
  const nextMonthProjectedDpd = item.actualDpd + 30;
  return (
    item.monthEndForecastDpd >= 91 ||
    item.monthEndForecastDpd >= 80 ||
    item.actualDpd >= 61 ||
    nextMonthProjectedDpd >= 91 ||
    (item.currentAge >= 2.01 && item.currentAge < 3.0) ||
    Boolean(item.borderNpl)
  );
}

export function analyzeNextMonthBorderline(
  items: EvaluableAccount[],
): BorderlineSaveAnalysis {
  const accounts: BorderlineAccountItem[] = [];
  let thisMonthEndCount = 0;
  let nextMonthOnlyCount = 0;
  let totalDebtorAtRisk = 0;
  let totalCapitalAtRisk = 0;
  let totalMinToSave = 0;
  let totalBorderlineEfforts = 0;
  let zeroEffortCount = 0;
  let savedCount = 0;
  let savedAmount = 0;
  let borderSavedCount = 0;
  let borderSavedAmount = 0;
  let above3SavedCount = 0;
  let above3SavedAmount = 0;
  let movedToNplCount = 0;
  let movedToNplAmount = 0;
  let forecastedBorderCount = 0;
  let forecastedBorderAmount = 0;

  for (const item of items) {
    const capArrears = item.capitalArrears || 0;
    const opCapWithArrears =
      (item.opCapitalOutstanding || item.capitalOutstanding || 0) + capArrears;
    const curCapWithArrears =
      (item.capitalOutstanding || item.opCapitalOutstanding || 0) + capArrears;

    if (isForecastedBorderAccount(item)) {
      forecastedBorderCount += 1;
      forecastedBorderAmount += opCapWithArrears;

      if (item.npl > 0 || item.actualDpd >= 91) {
        movedToNplCount += 1;
        movedToNplAmount += item.npl > 0 ? item.npl : curCapWithArrears;
      }
    }

    if (
      isNplSavedAccount({
        opNpl: item.opNpl,
        opAge: item.opAge,
        npl: item.npl,
        actualDpd: item.actualDpd,
        monthEndForecastDpd: item.monthEndForecastDpd,
        totalCollection: item.totalCollection,
        lastPaidAmount: item.lastPaidAmount,
      })
    ) {
      savedCount += 1;
      if (item.opNpl > 0) {
        above3SavedCount += 1;
        above3SavedAmount += item.opNpl;
        savedAmount += item.opNpl;
      } else {
        borderSavedCount += 1;
        borderSavedAmount += opCapWithArrears;
        savedAmount += opCapWithArrears;
      }
    }

    if (!isEvaluableBorderlineAccount(item)) continue;

    const crossesThisMonthEnd = item.monthEndForecastDpd >= 91;
    const nextMonthProjectedDpd = item.actualDpd + 30;
    const minToSave =
      item.minAmountToReverseNpl > 0
        ? item.minAmountToReverseNpl
        : item.currentMonthDue;

    const riskTier: BorderlineAccountItem['riskTier'] = crossesThisMonthEnd
      ? 'This Month-End (91+)'
      : 'Next Month Borderline (61-90)';

    if (crossesThisMonthEnd) thisMonthEndCount += 1;
    else nextMonthOnlyCount += 1;

    const projectedNpl = curCapWithArrears;

    totalDebtorAtRisk += item.closingDebtor;
    totalCapitalAtRisk += projectedNpl;
    totalMinToSave += minToSave;
    totalBorderlineEfforts += item.assignOfficerEfforts;
    if (item.assignOfficerEfforts <= 0) {
      zeroEffortCount += 1;
    }

    accounts.push({
      contractNo: item.contractNo,
      cusName: item.cusName,
      vehicleNo: item.vehicleNo,
      officeType: item.officeType,
      officer: item.officer,
      actualDpd: item.actualDpd,
      currentAge: item.currentAge,
      monthEndForecastDpd: item.monthEndForecastDpd,
      nextMonthProjectedDpd,
      opAge: item.opAge,
      closingDebtor: item.closingDebtor,
      capitalOutstanding: item.capitalOutstanding,
      capitalArrears: capArrears,
      projectedNpl,
      opNpl: item.opNpl,
      npl: item.npl,
      minToSave,
      assignOfficerEfforts: item.assignOfficerEfforts,
      totalEfforts: item.totalEfforts,
      nplReason: item.nplReason,
      isWorst: item.isWorst,
      riskTier,
      isTracked: item.isTracked,
    });
  }

  accounts.sort((a, b) => b.actualDpd - a.actualDpd || b.projectedNpl - a.projectedNpl);

  const avgEffortsPerBorderline =
    accounts.length > 0
      ? Math.round((totalBorderlineEfforts / accounts.length) * 10) / 10
      : 0;

  return {
    accounts,
    totalCount: accounts.length,
    thisMonthEndCount,
    nextMonthOnlyCount,
    totalDebtorAtRisk,
    totalCapitalAtRisk,
    totalMinToSave,
    totalBorderlineEfforts,
    zeroEffortCount,
    avgEffortsPerBorderline,
    savedCount,
    savedAmount,
    borderSavedCount,
    borderSavedAmount,
    above3SavedCount,
    above3SavedAmount,
    movedToNplCount,
    movedToNplAmount,
    forecastedBorderCount,
    forecastedBorderAmount,
  };
}

export function analyzeWorstCategory(
  items: EvaluableAccount[],
): WorstCaseAnalysis {
  const accounts: WorstCaseAccountItem[] = [];
  let totalOpNpl = 0;
  let totalClosingNpl = 0;
  let totalClosingDebtor = 0;
  let totalAssignEfforts = 0;
  let zeroEffortCount = 0;
  let lowDpdAttentionCount = 0;

  for (const item of items) {
    if (!item.isWorst) continue;

    totalOpNpl += item.opNpl;
    totalClosingNpl += item.npl;
    totalClosingDebtor += item.closingDebtor;
    totalAssignEfforts += item.assignOfficerEfforts;
    if (item.assignOfficerEfforts <= 0) zeroEffortCount += 1;
    if (item.actualDpd < 91) lowDpdAttentionCount += 1;

    accounts.push({
      contractNo: item.contractNo,
      cusName: item.cusName,
      vehicleNo: item.vehicleNo,
      officeType: item.officeType,
      officer: item.officer,
      actualDpd: item.actualDpd,
      currentAge: item.currentAge,
      opAge: item.opAge,
      opNpl: item.opNpl,
      closingNpl: item.npl,
      closingDebtor: item.closingDebtor,
      minToReverseNpl:
        item.minAmountToReverseNpl > 0
          ? item.minAmountToReverseNpl
          : item.currentMonthDue,
      nplReason: item.nplReason || 'W',
      worstCaseProduct: item.worstCaseProduct,
      assignOfficerEfforts: item.assignOfficerEfforts,
      totalEfforts: item.totalEfforts,
      isTracked: item.isTracked,
    });
  }

  accounts.sort((a, b) => b.closingNpl - a.closingNpl || b.actualDpd - a.actualDpd);

  return {
    accounts,
    totalCount: accounts.length,
    totalOpNpl,
    totalClosingNpl,
    totalClosingDebtor,
    totalAssignEfforts,
    zeroEffortCount,
    lowDpdAttentionCount,
  };
}

export function computeOfficerOpeningClosing(
  items: EvaluableAccount[],
  openingBaseline?: OpeningOfficerBaseline | null,
): OfficerEvaluationRow[] {
  const byOfficer = new Map<string, OfficerEvaluationRow>();

  const getOrInit = (officer: string): OfficerEvaluationRow => {
    const key = officer.trim() || 'Unassigned';
    let row = byOfficer.get(key);
    if (!row) {
      row = {
        officer: key,
        openingCount: 0,
        openingDebtor: 0,
        openingNpl: 0,
        openingNplCount: 0,
        closingCount: 0,
        closingDebtor: 0,
        closingNpl: 0,
        closingNplCount: 0,
        forecastedBorderCount: 0,
        forecastedBorderAmount: 0,
        movedToNplCount: 0,
        movedToNplAmount: 0,
        borderSavedCount: 0,
        borderSavedAmount: 0,
        borderlineCount: 0,
        borderlineMinToSave: 0,
        borderlineEfforts: 0,
        zeroEffortBorderlineCount: 0,
        worstCount: 0,
        worstNpl: 0,
        nplReduction: 0,
        debtorReduction: 0,
        nplSaveRatePct: 0,
        savedFromOpNplCount: 0,
        savedFromOpNplAmount: 0,
      };
      byOfficer.set(key, row);
    }
    return row;
  };

  for (const item of items) {
    const row = getOrInit(item.officer);
    const capArrears = item.capitalArrears || 0;
    const opCapWithArrears =
      (item.opCapitalOutstanding || item.capitalOutstanding || 0) + capArrears;
    const curCapWithArrears =
      (item.capitalOutstanding || item.opCapitalOutstanding || 0) + capArrears;

    row.openingCount += 1;
    row.openingDebtor += item.opBalDebtor;
    row.openingNpl += item.opNpl;
    if (item.opNpl > 0) {
      row.openingNplCount += 1;
    }

    row.closingCount += 1;
    row.closingDebtor += item.closingDebtor;
    row.closingNpl += item.npl;
    if (item.npl > 0) {
      row.closingNplCount += 1;
    }

    if (isForecastedBorderAccount(item)) {
      row.forecastedBorderCount += 1;
      row.forecastedBorderAmount += opCapWithArrears;
      if (item.npl > 0 || item.actualDpd >= 91) {
        row.movedToNplCount += 1;
        row.movedToNplAmount += item.npl > 0 ? item.npl : curCapWithArrears;
      } else if (
        isNplSavedAccount({
          opNpl: item.opNpl,
          opAge: item.opAge,
          npl: item.npl,
          actualDpd: item.actualDpd,
          monthEndForecastDpd: item.monthEndForecastDpd,
          totalCollection: item.totalCollection,
          lastPaidAmount: item.lastPaidAmount,
        })
      ) {
        row.borderSavedCount += 1;
        row.borderSavedAmount += opCapWithArrears;
      }
    }

    if (isEvaluableBorderlineAccount(item)) {
      row.borderlineCount += 1;
      row.borderlineMinToSave +=
        item.minAmountToReverseNpl > 0
          ? item.minAmountToReverseNpl
          : item.currentMonthDue;
      row.borderlineEfforts += item.assignOfficerEfforts;
      if (item.assignOfficerEfforts <= 0) {
        row.zeroEffortBorderlineCount += 1;
      }
    }

    if (item.isWorst) {
      row.worstCount += 1;
      row.worstNpl += item.npl;
    }

    if (item.opNpl > 0 && item.npl === 0 && item.actualDpd < 91 && item.monthEndForecastDpd < 91) {
      row.savedFromOpNplCount += 1;
      row.savedFromOpNplAmount += item.opNpl;
    }
  }

  if (openingBaseline && items.length > 0) {
    for (const [officerKey, base] of Object.entries(openingBaseline.byOfficer)) {
      const row = byOfficer.get(officerKey);
      // Only fall back to stored baseline when the AERS report rows lack OP_NPL values
      if (
        row &&
        row.openingNpl === 0 &&
        row.openingNplCount === 0 &&
        base.openingNpl > 0 &&
        items.length >= base.openingCount
      ) {
        row.openingCount = base.openingCount;
        row.openingDebtor = base.openingDebtor;
        row.openingNpl = base.openingNpl;
        row.openingNplCount = base.openingNplCount;
      }
    }
  }

  const rows = Array.from(byOfficer.values()).map((r) => {
    const nplReduction = r.openingNpl - r.closingNpl;
    const debtorReduction = r.openingDebtor - r.closingDebtor;
    const nplSaveRatePct =
      r.openingNpl > 0
        ? Math.round((nplReduction / r.openingNpl) * 1000) / 10
        : 0;
    return {
      ...r,
      nplReduction,
      debtorReduction,
      nplSaveRatePct,
    };
  });

  rows.sort((a, b) => b.closingDebtor - a.closingDebtor);
  return rows;
}

export function computeOfficeTypeBreakdown(
  items: EvaluableAccount[],
): OfficeTypeSummary[] {
  const officeMap = new Map<
    string,
    {
      summary: Omit<OfficeTypeSummary, 'officers'>;
      officerMap: Map<string, OfficeTypeOfficerRow>;
    }
  >();

  for (const item of items) {
    const officeKey = (item.officeType || 'Unassigned Office').trim() || 'Unassigned Office';
    const officerKey = (item.officer || 'Unassigned').trim() || 'Unassigned';

    let officeEntry = officeMap.get(officeKey);
    if (!officeEntry) {
      officeEntry = {
        summary: {
          officeType: officeKey,
          totalCount: 0,
          activeNplCount: 0,
          opNpl: 0,
          closingNpl: 0,
          closingDebtor: 0,
          borderlineCount: 0,
          borderlineMinToSave: 0,
          borderlineEfforts: 0,
          zeroEffortBorderlineCount: 0,
          worstCount: 0,
          worstNpl: 0,
        },
        officerMap: new Map<string, OfficeTypeOfficerRow>(),
      };
      officeMap.set(officeKey, officeEntry);
    }

    let roRow = officeEntry.officerMap.get(officerKey);
    if (!roRow) {
      roRow = {
        officer: officerKey,
        totalCount: 0,
        activeNplCount: 0,
        opNpl: 0,
        closingNpl: 0,
        closingDebtor: 0,
        borderlineCount: 0,
        borderlineMinToSave: 0,
        borderlineEfforts: 0,
        zeroEffortBorderlineCount: 0,
        worstCount: 0,
        worstNpl: 0,
      };
      officeEntry.officerMap.set(officerKey, roRow);
    }

    const isActiveNpl = item.actualDpd >= 91 || item.npl > 0;
    const isBorderline = isEvaluableBorderlineAccount(item);
    const minToSave =
      item.minAmountToReverseNpl > 0
        ? item.minAmountToReverseNpl
        : item.currentMonthDue;

    officeEntry.summary.totalCount += 1;
    if (isActiveNpl) officeEntry.summary.activeNplCount += 1;
    officeEntry.summary.opNpl += item.opNpl;
    officeEntry.summary.closingNpl += item.npl;
    officeEntry.summary.closingDebtor += item.closingDebtor;

    roRow.totalCount += 1;
    if (isActiveNpl) roRow.activeNplCount += 1;
    roRow.opNpl += item.opNpl;
    roRow.closingNpl += item.npl;
    roRow.closingDebtor += item.closingDebtor;

    if (isBorderline) {
      officeEntry.summary.borderlineCount += 1;
      officeEntry.summary.borderlineMinToSave += minToSave;
      officeEntry.summary.borderlineEfforts += item.assignOfficerEfforts;
      roRow.borderlineCount += 1;
      roRow.borderlineMinToSave += minToSave;
      roRow.borderlineEfforts += item.assignOfficerEfforts;

      if (item.assignOfficerEfforts <= 0) {
        officeEntry.summary.zeroEffortBorderlineCount += 1;
        roRow.zeroEffortBorderlineCount += 1;
      }
    }

    if (item.isWorst) {
      officeEntry.summary.worstCount += 1;
      officeEntry.summary.worstNpl += item.npl;
      roRow.worstCount += 1;
      roRow.worstNpl += item.npl;
    }
  }

  const summaries: OfficeTypeSummary[] = Array.from(officeMap.values()).map(
    ({ summary, officerMap }) => {
      const officers = Array.from(officerMap.values()).sort(
        (a, b) =>
          b.closingNpl - a.closingNpl ||
          b.borderlineCount - a.borderlineCount ||
          b.closingDebtor - a.closingDebtor,
      );
      return {
        ...summary,
        officers,
      };
    },
  );

  summaries.sort(
    (a, b) =>
      b.closingNpl - a.closingNpl ||
      b.borderlineCount - a.borderlineCount ||
      b.closingDebtor - a.closingDebtor,
  );
  return summaries;
}

export function computeBmAgeBuckets(
  aersRecords: AersRecord[],
  trackedContracts: TrackedContract[],
): BmAgeBucketDatum[] {
  const buckets: BmAgeBucketDatum[] = [
    { code: '[A]', label: 'Zero & Below', shortLabel: '[A] ≤0', count: 0, closingDebtor: 0, nplAmount: 0, nplMillions: 0 },
    { code: '[B]', label: '0.01~1.00', shortLabel: '[B] 0.01-1', count: 0, closingDebtor: 0, nplAmount: 0, nplMillions: 0 },
    { code: '[C]', label: '1.01~1.99', shortLabel: '[C] 1.01-1.99', count: 0, closingDebtor: 0, nplAmount: 0, nplMillions: 0 },
    { code: '[D]', label: '2.00~2.99', shortLabel: '[D] 2.00-2.99', count: 0, closingDebtor: 0, nplAmount: 0, nplMillions: 0 },
    { code: '[E]', label: '3.00~3.99', shortLabel: '[E] 3.00-3.99', count: 0, closingDebtor: 0, nplAmount: 0, nplMillions: 0 },
    { code: '[F]', label: '4.00~4.99', shortLabel: '[F] 4.00-4.99', count: 0, closingDebtor: 0, nplAmount: 0, nplMillions: 0 },
    { code: '[G]', label: '5.00~5.99', shortLabel: '[G] 5.00-5.99', count: 0, closingDebtor: 0, nplAmount: 0, nplMillions: 0 },
    { code: '[H]', label: '6.00~11.99', shortLabel: '[H] 6.00-11.99', count: 0, closingDebtor: 0, nplAmount: 0, nplMillions: 0 },
    { code: '[I]', label: '12 & Above', shortLabel: '[I] 12+', count: 0, closingDebtor: 0, nplAmount: 0, nplMillions: 0 },
  ];

  const source =
    aersRecords.length > 0
      ? aersRecords.map((r) => ({
          age: r.currentAge || 0,
          debtor: r.closingDebtor || 0,
          npl: r.npl || 0,
        }))
      : trackedContracts.map((c) => ({
          age: c.currentAge || 0,
          debtor: c.closingDebtor || 0,
          npl: c.npl || 0,
        }));

  for (const row of source) {
    const a = row.age;
    let idx = 0;
    if (a <= 0) idx = 0;
    else if (a <= 1.0) idx = 1;
    else if (a < 2.0) idx = 2;
    else if (a <= 2.999) idx = 3;
    else if (a <= 3.999) idx = 4;
    else if (a <= 4.999) idx = 5;
    else if (a <= 5.999) idx = 6;
    else if (a <= 11.999) idx = 7;
    else idx = 8;

    buckets[idx].count += 1;
    buckets[idx].closingDebtor += row.debtor;
    buckets[idx].nplAmount += row.npl;
  }

  for (const b of buckets) {
    b.nplMillions = Number((b.nplAmount / 1_000_000).toFixed(2));
  }

  return buckets;
}

export function computeBmOfficerPerformance(
  aersRecords: AersRecord[],
  trackedContracts: TrackedContract[],
  role: 'RO' | 'MO',
): BmOfficerPerformanceRow[] {
  const source =
    aersRecords.length > 0
      ? aersRecords
          .filter((r) =>
            role === 'MO'
              ? isMarketingOfficeType(r.officeType)
              : !isMarketingOfficeType(r.officeType),
          )
          .map((r) => ({
            officer: getOfficerByOfficeType(r),
            dueBudget: r.dueBudgetMonth || r.currentMonthDue || 0,
            totalCollection: r.totalCollection || 0,
            opNpl: r.opNpl || 0,
            closingNpl: r.npl || 0,
            closingDebtor: r.closingDebtor || 0,
            opAge: r.opAge || 0,
            currentAge: r.currentAge || 0,
          }))
      : trackedContracts
          .filter((c) =>
            role === 'MO'
              ? isMarketingOfficeType(c.officeType)
              : !isMarketingOfficeType(c.officeType),
          )
          .map((c) => ({
            officer: getOfficerByOfficeType(c),
            dueBudget: c.currentMonthDue || 0,
            totalCollection: c.totalCollection || 0,
            opNpl: c.opNpl || 0,
            closingNpl: c.npl || 0,
            closingDebtor: c.closingDebtor || 0,
            opAge: c.opAge || 0,
            currentAge: c.currentAge || 0,
          }));

  const map = new Map<string, BmOfficerPerformanceRow>();

  for (const item of source) {
    let row = map.get(item.officer);
    if (!row) {
      row = {
        officer: item.officer,
        role,
        totalCount: 0,
        dueBudget: 0,
        totalCollection: 0,
        collectionEfficiencyPct: 0,
        opNpl: 0,
        openingNplCount: 0,
        closingNpl: 0,
        closingNplCount: 0,
        netNplVariance: 0,
        closingDebtor: 0,
        belowOneCount: 0,
        opBelowOneCount: 0,
        belowOneRetentionPct: 0,
        ratio90Pct: 0,
      };
      map.set(item.officer, row);
    }

    row.totalCount += 1;
    row.dueBudget += item.dueBudget;
    row.totalCollection += item.totalCollection;
    row.opNpl += item.opNpl;
    if (item.opNpl > 0) row.openingNplCount = (row.openingNplCount || 0) + 1;
    row.closingNpl += item.closingNpl;
    if (item.closingNpl > 0) row.closingNplCount = (row.closingNplCount || 0) + 1;
    row.closingDebtor += item.closingDebtor;
    if (item.currentAge <= 1.0) row.belowOneCount += 1;
    if (item.opAge <= 1.0) row.opBelowOneCount += 1;
  }

  const rows = Array.from(map.values()).map((r) => {
    const collectionEfficiencyPct =
      r.dueBudget > 0
        ? Math.round((r.totalCollection / r.dueBudget) * 1000) / 10
        : 0;
    const netNplVariance = r.closingNpl - r.opNpl;
    const denom = r.opBelowOneCount > 0 ? r.opBelowOneCount : r.totalCount;
    const belowOneRetentionPct =
      denom > 0 ? Math.round((r.belowOneCount / denom) * 1000) / 10 : 0;
    const ratio90Pct =
      r.totalCount > 0
        ? Math.round((r.belowOneCount / r.totalCount) * 1000) / 10
        : 0;

    return {
      ...r,
      collectionEfficiencyPct,
      netNplVariance,
      belowOneRetentionPct,
      ratio90Pct,
    };
  });

  rows.sort((a, b) => b.closingDebtor - a.closingDebtor);
  return rows;
}

export function computeOfficerEffortSummary(
  aersRecords: AersRecord[],
  trackedContracts: TrackedContract[],
  options?: {
    scope?: 'aers' | 'tracked';
    riskFilter?: 'all' | 'borderline' | 'npl';
    mrpMap?: Map<string, MrpEnrichment>;
  },
): OfficerEffortSummaryRow[] {
  const scope =
    options?.scope ?? (aersRecords.length > 0 ? 'aers' : 'tracked');
  const riskFilter = options?.riskFilter ?? 'all';
  const mrpMap = options?.mrpMap;

  const source =
    scope === 'aers' && aersRecords.length > 0
      ? aersRecords.map((r) => {
          const mrp = mrpMap?.get(normalizeContractNo(r.contractNo));
          return {
            ro: getOfficerByOfficeType(r),
            officeType:
              (r.officeType || 'Unassigned Office').trim() ||
              'Unassigned Office',
            actualDpd: r.actualDpd || 0,
            opAge: r.opAge || 0,
            monthEndForecastDpd: r.monthEndForecastDpd || 0,
            npl: r.npl || 0,
            opNpl: r.opNpl || 0,
            capitalOutstanding: r.capitalOutstanding || 0,
            opCapitalOutstanding: r.opCapitalOutstanding || 0,
            capitalArrears: r.capitalArrears || 0,
            closingDebtor: r.closingDebtor || 0,
            assignOfficerEfforts: r.assignOfficerEfforts || 0,
            totalEfforts: r.totalEfforts || 0,
            mrp,
            currentSituation: undefined as ContractSituation | undefined,
          };
        })
      : trackedContracts.map((c) => ({
          ro: getOfficerByOfficeType(c),
          officeType:
            (c.officeType || 'Unassigned Office').trim() ||
            'Unassigned Office',
          actualDpd: c.actualDpd || 0,
          opAge: c.opAge || 0,
          monthEndForecastDpd: c.monthEndForecastDpd || 0,
          npl: c.npl || 0,
          opNpl: c.opNpl || 0,
          capitalOutstanding: c.capitalOutstanding || 0,
          opCapitalOutstanding: c.opCapitalOutstanding || 0,
          capitalArrears: c.capitalArrears || 0,
          closingDebtor: c.closingDebtor || 0,
          assignOfficerEfforts: c.assignOfficerEfforts || 0,
          totalEfforts: c.totalEfforts || 0,
          mrp: c.mrp ?? mrpMap?.get(normalizeContractNo(c.contractNo)),
          currentSituation: c.currentSituation,
        }));

  const grouped = new Map<string, OfficerEffortSummaryRow>();

  for (const item of source) {
    const isNpl = isCurrentNplAccount(item);
    const isBorderline = isBorderlineNplAccount(item, item.mrp);

    if (!isNpl && !isBorderline) continue;
    if (riskFilter === 'npl' && !isNpl) continue;
    if (riskFilter === 'borderline' && !isBorderline) continue;

    const groupKey = `${item.ro}__${item.officeType}`;
    let row = grouped.get(groupKey);
    if (!row) {
      row = {
        ro: item.ro,
        officeType: item.officeType,
        highRiskCount: 0,
        borderlineCount: 0,
        nplCount: 0,
        assignOfficerEfforts: 0,
        borderlineAssignEfforts: 0,
        nplAssignEfforts: 0,
        totalEfforts: 0,
        avgAssignEfforts: 0,
        zeroEffortCount: 0,
        highRiskExposure: 0,
      };
      grouped.set(groupKey, row);
    }

    row.highRiskCount += 1;
    if (isBorderline) {
      row.borderlineCount += 1;
      row.borderlineAssignEfforts += item.assignOfficerEfforts;
    }
    if (isNpl) {
      row.nplCount += 1;
      row.nplAssignEfforts += item.assignOfficerEfforts;
    }

    row.assignOfficerEfforts += item.assignOfficerEfforts;
    row.totalEfforts += item.totalEfforts;
    if (item.assignOfficerEfforts <= 0) {
      row.zeroEffortCount += 1;
    }
    row.highRiskExposure += getCapitalNplExposure(item);
  }

  const rows = Array.from(grouped.values()).map((r) => ({
    ...r,
    avgAssignEfforts:
      r.highRiskCount > 0
        ? Math.round((r.assignOfficerEfforts / r.highRiskCount) * 10) / 10
        : 0,
  }));

  rows.sort(
    (a, b) =>
      b.assignOfficerEfforts - a.assignOfficerEfforts ||
      b.totalEfforts - a.totalEfforts ||
      b.highRiskCount - a.highRiskCount,
  );

  return rows;
}

export function computeAgeGroupEfforts(
  records: AersRecord[],
): AgeGroupEffortRow[] {
  const groups: AgeGroupEffortRow[] = [
    {
      key: 'below_1',
      label: 'Age ≤ 1.00 (Below 1 / Performing)',
      shortLabel: '≤ 1.00',
      count: 0,
      assignOfficerEfforts: 0,
      totalEfforts: 0,
      zeroEffortCount: 0,
      avgAssignEfforts: 0,
      closingDebtor: 0,
      nplAmount: 0,
    },
    {
      key: 'age_1_2',
      label: 'Age 1.01 – 1.99 (90-Ratio Quick Win)',
      shortLabel: '1.01 – 1.99',
      count: 0,
      assignOfficerEfforts: 0,
      totalEfforts: 0,
      zeroEffortCount: 0,
      avgAssignEfforts: 0,
      closingDebtor: 0,
      nplAmount: 0,
    },
    {
      key: 'age_2_3',
      label: 'Age 2.00 – 2.99 (Borderline 61–90 DPD)',
      shortLabel: '2.00 – 2.99',
      count: 0,
      assignOfficerEfforts: 0,
      totalEfforts: 0,
      zeroEffortCount: 0,
      avgAssignEfforts: 0,
      closingDebtor: 0,
      nplAmount: 0,
    },
    {
      key: 'age_3_6',
      label: 'Age 3.00 – 5.99 (Active NPL 91–180 DPD)',
      shortLabel: '3.00 – 5.99',
      count: 0,
      assignOfficerEfforts: 0,
      totalEfforts: 0,
      zeroEffortCount: 0,
      avgAssignEfforts: 0,
      closingDebtor: 0,
      nplAmount: 0,
    },
    {
      key: 'age_6_plus',
      label: 'Age 6.00+ (Hard NPL 180+ DPD)',
      shortLabel: '6.00+',
      count: 0,
      assignOfficerEfforts: 0,
      totalEfforts: 0,
      zeroEffortCount: 0,
      avgAssignEfforts: 0,
      closingDebtor: 0,
      nplAmount: 0,
    },
  ];

  for (const r of records) {
    const age = Number(r.currentAge) || 0;
    let idx = 0;
    if (age <= 1.0) idx = 0;
    else if (age < 2.0) idx = 1;
    else if (age < 3.0) idx = 2;
    else if (age < 6.0) idx = 3;
    else idx = 4;

    const g = groups[idx];
    const assignEff = Number(r.assignOfficerEfforts) || 0;
    const totalEff = Number(r.totalEfforts) || 0;
    g.count += 1;
    g.assignOfficerEfforts += assignEff;
    g.totalEfforts += totalEff;
    if (assignEff <= 0) g.zeroEffortCount += 1;
    g.closingDebtor += Number(r.closingDebtor) || 0;
    g.nplAmount += Number(r.npl) || 0;
  }

  for (const g of groups) {
    g.avgAssignEfforts =
      g.count > 0 ? Math.round((g.assignOfficerEfforts / g.count) * 10) / 10 : 0;
  }

  return groups;
}

export function extractBelowOneQuickWins(
  records: AersRecord[],
): BelowOneQuickWinItem[] {
  return records
    .filter((r) => {
      const age = Number(r.currentAge) || 0;
      return age > 1.0 && age < 2.0;
    })
    .map((r) => {
      const currentAge = Number(r.currentAge) || 0;
      return {
        contractNo: normalizeContractNo(r.contractNo),
        cusName: r.cusName || 'Unnamed Client',
        officer: getOfficerByOfficeType(r),
        officeType: (r.officeType || 'RO').trim() || 'RO',
        opAge: Number(r.opAge) || 0,
        currentAge,
        excessAge: Math.round((currentAge - 1.0) * 100) / 100,
        actualDpd: Number(r.actualDpd) || 0,
        closingDebtor: Number(r.closingDebtor) || 0,
        currentMonthDue: Number(r.currentMonthDue || r.dueBudgetMonth) || 0,
        totalCollection: Number(r.totalCollection) || 0,
        assignOfficerEfforts: Number(r.assignOfficerEfforts) || 0,
        totalEfforts: Number(r.totalEfforts) || 0,
        lastPayDate: r.lastPayDate || '',
        lastPaidAmount: Number(r.lastPaidAmount) || 0,
      };
    })
    .sort(
      (a, b) =>
        a.currentAge - b.currentAge ||
        a.closingDebtor - b.closingDebtor,
    );
}

export function computeBelowThreeCollectionSnapshot(
  records: AersRecord[],
  maxStoredContracts = 1500,
  bmDashboardBelowThree?: BmDashboardBelowThreeExtracted,
): BelowThreeCollectionSnapshot {
  const below3 = records.filter((r) => (Number(r.currentAge) || 0) < 3.0);

  const subBuckets: BelowThreeSubBucket[] = [
    {
      key: 'zero_below',
      label: 'Age ≤ 0.00 (Advance / Zero)',
      shortLabel: '≤ 0.00',
      totalCount: 0,
      paidCount: 0,
      notPaidCount: 0,
      paidPct: 0,
      dueAmount: 0,
      collectedAmount: 0,
      varianceAmount: 0,
      collectionPct: 0,
    },
    {
      key: 'age_0_1',
      label: 'Age 0.01 – 1.00 (Current)',
      shortLabel: '0.01 – 1.00',
      totalCount: 0,
      paidCount: 0,
      notPaidCount: 0,
      paidPct: 0,
      dueAmount: 0,
      collectedAmount: 0,
      varianceAmount: 0,
      collectionPct: 0,
    },
    {
      key: 'age_1_2',
      label: 'Age 1.01 – 1.99 (1–2 Arrears)',
      shortLabel: '1.01 – 1.99',
      totalCount: 0,
      paidCount: 0,
      notPaidCount: 0,
      paidPct: 0,
      dueAmount: 0,
      collectedAmount: 0,
      varianceAmount: 0,
      collectionPct: 0,
    },
    {
      key: 'age_2_3',
      label: 'Age 2.00 – 2.99 (Borderline Pre-NPL)',
      shortLabel: '2.00 – 2.99',
      totalCount: 0,
      paidCount: 0,
      notPaidCount: 0,
      paidPct: 0,
      dueAmount: 0,
      collectedAmount: 0,
      varianceAmount: 0,
      collectionPct: 0,
    },
  ];

  interface OfficerAcc {
    officer: string;
    role: string;
    totalCount: number;
    paidCount: number;
    notPaidCount: number;
    partialPaidCount: number;
    unpaidWithDueCount: number;
    unpaidDueSum: number;
    dueAmount: number;
    collectedAmount: number;
    subBuckets: {
      below1: { total: number; paid: number; notPaid: number };
      age1to2: { total: number; paid: number; notPaid: number };
      age2to3: { total: number; paid: number; notPaid: number };
    };
  }

  const officerMap = new Map<string, OfficerAcc>();
  const allContractItems: BelowThreeContractItem[] = [];

  let totalPaid = 0;
  let totalNotPaid = 0;
  let totalPartialPaid = 0;
  let totalUnpaidWithDue = 0;
  let totalUnpaidDueSum = 0;
  let totalDue = 0;
  let totalCollected = 0;

  for (const r of below3) {
    const currentAge = Number(r.currentAge) || 0;
    const opAge = Number(r.opAge) || 0;
    const due = Math.max(0, Number(r.dueBudgetMonth || r.currentMonthDue) || 0);
    const coll = Math.max(0, Number(r.totalCollection) || 0);
    const isPaid = coll > 0;
    const isFullPaid = due > 0 ? coll >= due : isPaid;
    const isPartial = isPaid && due > 0 && coll < due;
    const variance = coll - due;

    totalDue += due;
    totalCollected += coll;

    if (isPaid) {
      totalPaid += 1;
      if (isPartial) totalPartialPaid += 1;
    } else {
      totalNotPaid += 1;
      if (due > 0) {
        totalUnpaidWithDue += 1;
        totalUnpaidDueSum += due;
      }
    }

    const bucket =
      currentAge <= 0
        ? subBuckets[0]
        : currentAge <= 1.0
          ? subBuckets[1]
          : currentAge < 2.0
            ? subBuckets[2]
            : subBuckets[3];

    bucket.totalCount += 1;
    if (isPaid) bucket.paidCount += 1;
    else bucket.notPaidCount += 1;
    bucket.dueAmount += due;
    bucket.collectedAmount += coll;

    const officer = getOfficerByOfficeType(r);
    const officeType = (r.officeType || '').trim().toUpperCase();
    const role = officeType.includes('MO') ? 'MO' : officeType.includes('RO') ? 'RO' : officeType || 'RO';

    const off =
      officerMap.get(officer) ?? {
        officer,
        role,
        totalCount: 0,
        paidCount: 0,
        notPaidCount: 0,
        partialPaidCount: 0,
        unpaidWithDueCount: 0,
        unpaidDueSum: 0,
        dueAmount: 0,
        collectedAmount: 0,
        subBuckets: {
          below1: { total: 0, paid: 0, notPaid: 0 },
          age1to2: { total: 0, paid: 0, notPaid: 0 },
          age2to3: { total: 0, paid: 0, notPaid: 0 },
        },
      };

    off.totalCount += 1;
    off.dueAmount += due;
    off.collectedAmount += coll;
    if (isPaid) {
      off.paidCount += 1;
      if (isPartial) off.partialPaidCount += 1;
    } else {
      off.notPaidCount += 1;
      if (due > 0) {
        off.unpaidWithDueCount += 1;
        off.unpaidDueSum += due;
      }
    }

    const offSub =
      currentAge <= 1.0
        ? off.subBuckets.below1
        : currentAge < 2.0
          ? off.subBuckets.age1to2
          : off.subBuckets.age2to3;
    offSub.total += 1;
    if (isPaid) offSub.paid += 1;
    else offSub.notPaid += 1;

    officerMap.set(officer, off);

    allContractItems.push({
      contractNo: normalizeContractNo(r.contractNo),
      cusName: r.cusName || 'Unnamed Client',
      officer,
      officeType: role,
      opAge,
      currentAge,
      actualDpd: Number(r.actualDpd) || 0,
      currentMonthDue: due,
      totalCollection: coll,
      varianceAmount: variance,
      isPaid,
      isFullPaid,
      lastPayDate: r.lastPayDate || '',
      lastPaidAmount: Number(r.lastPaidAmount) || 0,
      closingDebtor: Number(r.closingDebtor) || 0,
      assignOfficerEfforts: Number(r.assignOfficerEfforts) || 0,
      totalEfforts: Number(r.totalEfforts) || 0,
      nextDueDate: r.nextDueDate || '',
    });
  }

  for (const b of subBuckets) {
    b.varianceAmount = Math.round(b.collectedAmount - b.dueAmount);
    b.paidPct =
      b.totalCount > 0 ? Math.round((b.paidCount / b.totalCount) * 1000) / 10 : 0;
    b.collectionPct =
      b.dueAmount > 0 ? Math.round((b.collectedAmount / b.dueAmount) * 1000) / 10 : 0;
  }

  const bmOfficerLookup = new Map<
    string,
    BmDashboardBelowThreeExtracted['byOfficer'][number]
  >();
  if (bmDashboardBelowThree?.byOfficer?.length) {
    for (const row of bmDashboardBelowThree.byOfficer) {
      bmOfficerLookup.set(row.officer.toLowerCase(), row);
    }
  }

  let bmOfficerMatchCount = 0;
  const byOfficer: BelowThreeOfficerRow[] = Array.from(officerMap.values())
    .map((o) => {
      const bmOff = bmOfficerLookup.get(o.officer.toLowerCase());
      const effectiveDue = bmOff ? bmOff.targetAmount : o.dueAmount;
      const effectiveColl = bmOff ? bmOff.collectedAmount : o.collectedAmount;
      const effectiveTotalCount = bmOff?.totalCount ?? o.totalCount;
      const effectivePaidCount = bmOff?.paidCount ?? o.paidCount;
      const effectiveNotPaidCount =
        bmOff?.notPaidCount ??
        (bmOff?.paidCount !== undefined
          ? Math.max(0, effectiveTotalCount - bmOff.paidCount)
          : o.notPaidCount);
      if (bmOff) bmOfficerMatchCount += 1;

      const variance = effectiveColl - effectiveDue;
      const shortfall = Math.max(0, -variance);
      const avgDuePerUnpaid =
        o.unpaidWithDueCount > 0
          ? o.unpaidDueSum / o.unpaidWithDueCount
          : effectiveTotalCount > 0
            ? effectiveDue / effectiveTotalCount
            : 0;
      const contractsNeededAgainstDue =
        bmOff?.contractsNeeded !== undefined
          ? bmOff.contractsNeeded
          : shortfall <= 0
            ? 0
            : avgDuePerUnpaid > 0
              ? Math.min(
                  Math.max(effectiveNotPaidCount + o.partialPaidCount, 1),
                  Math.ceil(shortfall / avgDuePerUnpaid),
                )
              : o.unpaidWithDueCount;

      return {
        officer: o.officer,
        role: bmOff?.role || o.role,
        totalCount: effectiveTotalCount,
        paidCount: effectivePaidCount,
        notPaidCount: effectiveNotPaidCount,
        paidRatioPct:
          effectiveTotalCount > 0
            ? Math.round((effectivePaidCount / effectiveTotalCount) * 1000) / 10
            : 0,
        partialPaidCount: o.partialPaidCount,
        unpaidWithDueCount: o.unpaidWithDueCount,
        contractsNeededAgainstDue,
        dueAmount: Math.round(effectiveDue),
        collectedAmount: Math.round(effectiveColl),
        varianceAmount: Math.round(variance),
        collectionPct:
          bmOff && bmOff.collectionPct > 0
            ? bmOff.collectionPct
            : effectiveDue > 0
              ? Math.round((effectiveColl / effectiveDue) * 1000) / 10
              : 0,
        avgDuePerUnpaid: Math.round(avgDuePerUnpaid),
        subBuckets: o.subBuckets,
        fromBmSheet: Boolean(bmOff),
      };
    })
    .sort((a, b) => a.varianceAmount - b.varianceAmount);

  const hasBmSheet = Boolean(
    bmDashboardBelowThree && bmDashboardBelowThree.targetAmount >= 100_000,
  );
  const finalDue = hasBmSheet
    ? bmDashboardBelowThree!.targetAmount
    : Math.round(totalDue);
  const finalCollected = hasBmSheet
    ? bmDashboardBelowThree!.collectedAmount
    : Math.round(totalCollected);
  const finalVariance = Math.round(finalCollected - finalDue);
  const finalCollPct =
    hasBmSheet && bmDashboardBelowThree!.collectionPct > 0
      ? bmDashboardBelowThree!.collectionPct
      : finalDue > 0
        ? Math.round((finalCollected / finalDue) * 1000) / 10
        : 0;

  const finalTotalCount = bmDashboardBelowThree?.totalCount ?? below3.length;
  const finalPaidCount = bmDashboardBelowThree?.paidCount ?? totalPaid;
  const finalNotPaidCount =
    bmDashboardBelowThree?.notPaidCount ??
    (bmDashboardBelowThree?.paidCount !== undefined
      ? Math.max(0, finalTotalCount - bmDashboardBelowThree.paidCount)
      : totalNotPaid);

  const totalShortfall = Math.max(0, -finalVariance);
  const avgBranchDue =
    totalUnpaidWithDue > 0
      ? totalUnpaidDueSum / totalUnpaidWithDue
      : finalTotalCount > 0
        ? finalDue / finalTotalCount
        : 0;
  const totalContractsNeeded =
    bmDashboardBelowThree?.contractsNeeded !== undefined
      ? bmDashboardBelowThree.contractsNeeded
      : totalShortfall <= 0
        ? 0
        : avgBranchDue > 0
          ? Math.min(
              Math.max(finalNotPaidCount + totalPartialPaid, 1),
              Math.ceil(totalShortfall / avgBranchDue),
            )
          : totalUnpaidWithDue;

  // Sort contracts so highest-priority Not Paid (with largest due & closest to 3.0 age) appear first
  allContractItems.sort((a, b) => {
    if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1;
    if (!a.isPaid) {
      return b.currentMonthDue - a.currentMonthDue || b.currentAge - a.currentAge;
    }
    if (a.isFullPaid !== b.isFullPaid) return a.isFullPaid ? 1 : -1;
    return b.currentMonthDue - a.currentMonthDue;
  });

  // Cap stored contracts in snapshot metadata to stay localStorage-safe while retaining unpaid priority
  const storedContracts =
    allContractItems.length > maxStoredContracts
      ? allContractItems.slice(0, maxStoredContracts)
      : allContractItems;

  return {
    source: hasBmSheet ? 'bm_dashboard_sheet' : 'full_aers_workbook',
    bmSheetName: bmDashboardBelowThree?.sheetName,
    bmSheetTargetAmount: bmDashboardBelowThree?.targetAmount,
    bmSheetCollectedAmount: bmDashboardBelowThree?.collectedAmount,
    bmSheetVarianceAmount: bmDashboardBelowThree?.varianceAmount,
    bmSheetCollectionPct: bmDashboardBelowThree?.collectionPct,
    bmSheetOfficerMatchCount: bmOfficerMatchCount,
    aersDueAmount: Math.round(totalDue),
    aersCollectedAmount: Math.round(totalCollected),
    isEstimatedPaidSplit: false,
    totalCount: finalTotalCount,
    paidCount: finalPaidCount,
    notPaidCount: finalNotPaidCount,
    paidRatioPct:
      finalTotalCount > 0
        ? Math.round((finalPaidCount / finalTotalCount) * 1000) / 10
        : 0,
    partialPaidCount: totalPartialPaid,
    unpaidWithDueCount: totalUnpaidWithDue,
    contractsNeededAgainstDue: totalContractsNeeded,
    dueAmount: finalDue,
    collectedAmount: finalCollected,
    varianceAmount: finalVariance,
    collectionPct: finalCollPct,
    subBuckets,
    byOfficer,
    contracts: storedContracts,
  };
}

/**
 * Reconciles accurate full-branch Below-3 (< 3.00) figures even on legacy snapshots
 * that don't yet have `bmBranchSnapshot.belowThreeSummary` stored:
 * Because ALL age >= 3.00 (NPL 3+) accounts exist in `aersRecords`, subtracting each
 * officer's >= 3.00 accounts from `bmBranchSnapshot.roPerformance + moPerformance`
 * yields the exact Full-Branch Below-3 Count, Monthly Due, Collected, and Variance.
 */
export function reconcileBelowThreeFromBmSnapshot(
  aersRecords: AersRecord[],
  bmBranchSnapshot?: AersMetadata['bmBranchSnapshot'],
): BelowThreeCollectionSnapshot {
  const base = computeBelowThreeCollectionSnapshot(aersRecords, 2000);
  if (
    !bmBranchSnapshot ||
    (!bmBranchSnapshot.roPerformance?.length &&
      !bmBranchSnapshot.moPerformance?.length)
  ) {
    return { ...base, source: 'filtered_aers' };
  }

  const allBmOfficers = [
    ...(bmBranchSnapshot.roPerformance || []),
    ...(bmBranchSnapshot.moPerformance || []),
  ];

  // Aggregate exact >= 3.00 accounts per officer from loaded aersRecords
  const age3PlusByOff = new Map<
    string,
    { count: number; due: number; coll: number }
  >();
  const aersB3ByOff = new Map<
    string,
    {
      count: number;
      paid: number;
      notPaid: number;
      partial: number;
      unpaidWithDue: number;
      unpaidDueSum: number;
      due: number;
      coll: number;
      subBuckets: BelowThreeOfficerRow['subBuckets'];
    }
  >();

  for (const r of aersRecords) {
    const off = getOfficerByOfficeType(r);
    const due = Math.max(0, Number(r.dueBudgetMonth || r.currentMonthDue) || 0);
    const coll = Math.max(0, Number(r.totalCollection) || 0);
    const age = Number(r.currentAge) || 0;
    if (age >= 3.0) {
      const cur = age3PlusByOff.get(off) ?? { count: 0, due: 0, coll: 0 };
      cur.count += 1;
      cur.due += due;
      cur.coll += coll;
      age3PlusByOff.set(off, cur);
    } else {
      const cur = aersB3ByOff.get(off) ?? {
        count: 0,
        paid: 0,
        notPaid: 0,
        partial: 0,
        unpaidWithDue: 0,
        unpaidDueSum: 0,
        due: 0,
        coll: 0,
        subBuckets: {
          below1: { total: 0, paid: 0, notPaid: 0 },
          age1to2: { total: 0, paid: 0, notPaid: 0 },
          age2to3: { total: 0, paid: 0, notPaid: 0 },
        },
      };
      const isPaid = coll > 0;
      const isPartial = isPaid && due > 0 && coll < due;
      cur.count += 1;
      cur.due += due;
      cur.coll += coll;
      if (isPaid) {
        cur.paid += 1;
        if (isPartial) cur.partial += 1;
      } else {
        cur.notPaid += 1;
        if (due > 0) {
          cur.unpaidWithDue += 1;
          cur.unpaidDueSum += due;
        }
      }
      const sub =
        age <= 1.0
          ? cur.subBuckets.below1
          : age < 2.0
            ? cur.subBuckets.age1to2
            : cur.subBuckets.age2to3;
      sub.total += 1;
      if (isPaid) sub.paid += 1;
      else sub.notPaid += 1;
      aersB3ByOff.set(off, cur);
    }
  }

  let totalCount = 0;
  let totalPaid = 0;
  let totalNotPaid = 0;
  let totalPartial = 0;
  let totalUnpaidWithDue = 0;
  let totalDue = 0;
  let totalCollected = 0;
  let totalNeeded = 0;

  const byOfficer: BelowThreeOfficerRow[] = allBmOfficers
    .map((bmOff) => {
      const s3 = age3PlusByOff.get(bmOff.officer) ?? { count: 0, due: 0, coll: 0 };
      const sb3 = aersB3ByOff.get(bmOff.officer);
      const b3Total = Math.max(0, bmOff.totalCount - s3.count);
      const b3Due = Math.max(0, Math.round(bmOff.dueBudget - s3.due));
      const b3Coll = Math.max(0, Math.round(bmOff.totalCollection - s3.coll));
      const variance = b3Coll - b3Due;
      const collPct =
        b3Due > 0 ? Math.round((b3Coll / b3Due) * 1000) / 10 : 0;

      // Exact counts for indexed AERS <3 + ratio-reconciled split for excluded regular (<1) accounts
      const indexedCnt = sb3?.count ?? 0;
      const indexedPaid = sb3?.paid ?? 0;
      const indexedNotPaid = sb3?.notPaid ?? 0;
      const indexedDue = sb3?.due ?? 0;
      const indexedColl = sb3?.coll ?? 0;

      const excludedRegCnt = Math.max(0, b3Total - indexedCnt);
      const excludedDue = Math.max(0, b3Due - indexedDue);
      const excludedColl = Math.max(0, b3Coll - indexedColl);
      const estRegPaidRatio =
        excludedDue > 0 ? Math.min(1, Math.max(0, excludedColl / excludedDue)) : 1;
      const estRegPaid = Math.min(
        excludedRegCnt,
        Math.round(excludedRegCnt * estRegPaidRatio),
      );
      const estRegNotPaid = Math.max(0, excludedRegCnt - estRegPaid);

      const paidCount = indexedPaid + estRegPaid;
      const notPaidCount = indexedNotPaid + estRegNotPaid;
      const partialPaidCount = sb3?.partial ?? 0;
      const unpaidWithDueCount = (sb3?.unpaidWithDue ?? 0) + estRegNotPaid;

      const avgDue = b3Total > 0 ? b3Due / b3Total : 0;
      const shortfall = Math.max(0, -variance);
      const contractsNeededAgainstDue =
        shortfall <= 0
          ? 0
          : avgDue > 0
            ? Math.min(b3Total, Math.ceil(shortfall / avgDue))
            : unpaidWithDueCount;

      totalCount += b3Total;
      totalPaid += paidCount;
      totalNotPaid += notPaidCount;
      totalPartial += partialPaidCount;
      totalUnpaidWithDue += unpaidWithDueCount;
      totalDue += b3Due;
      totalCollected += b3Coll;
      totalNeeded += contractsNeededAgainstDue;

      const subBuckets = sb3
        ? {
            below1: {
              total: sb3.subBuckets.below1.total + excludedRegCnt,
              paid: sb3.subBuckets.below1.paid + estRegPaid,
              notPaid: sb3.subBuckets.below1.notPaid + estRegNotPaid,
            },
            age1to2: sb3.subBuckets.age1to2,
            age2to3: sb3.subBuckets.age2to3,
          }
        : {
            below1: { total: excludedRegCnt, paid: estRegPaid, notPaid: estRegNotPaid },
            age1to2: { total: 0, paid: 0, notPaid: 0 },
            age2to3: { total: 0, paid: 0, notPaid: 0 },
          };

      return {
        officer: bmOff.officer,
        role: bmOff.role,
        totalCount: b3Total,
        paidCount,
        notPaidCount,
        paidRatioPct:
          b3Total > 0 ? Math.round((paidCount / b3Total) * 1000) / 10 : 0,
        partialPaidCount,
        unpaidWithDueCount,
        contractsNeededAgainstDue,
        dueAmount: b3Due,
        collectedAmount: b3Coll,
        varianceAmount: variance,
        collectionPct: collPct,
        avgDuePerUnpaid: Math.round(avgDue),
        subBuckets,
      };
    })
    .sort((a, b) => a.varianceAmount - b.varianceAmount);

  // Align sub-buckets [A]..[D] with exact BM ageBuckets counts when available
  const bmBuckets = bmBranchSnapshot.ageBuckets || [];
  const subBuckets: BelowThreeSubBucket[] = base.subBuckets.map((sb, idx) => {
    const bmB = bmBuckets[idx];
    if (!bmB) return sb;
    const extraCount = Math.max(0, bmB.count - sb.totalCount);
    const branchCollRatio = totalDue > 0 ? Math.min(1, totalCollected / totalDue) : 0.78;
    const estExtraPaid = Math.round(extraCount * branchCollRatio);
    const estExtraNotPaid = extraCount - estExtraPaid;
    const nextTotal = bmB.count;
    const nextPaid = sb.paidCount + estExtraPaid;
    const nextNotPaid = Math.max(0, nextTotal - nextPaid);
    return {
      ...sb,
      totalCount: nextTotal,
      paidCount: nextPaid,
      notPaidCount: nextNotPaid,
      paidPct: nextTotal > 0 ? Math.round((nextPaid / nextTotal) * 1000) / 10 : 0,
      collectionPct:
        sb.dueAmount > 0 && extraCount === 0
          ? sb.collectionPct
          : Math.round(branchCollRatio * 1000) / 10,
    };
  });

  const totalVariance = totalCollected - totalDue;
  const totalCollPct =
    totalDue > 0 ? Math.round((totalCollected / totalDue) * 1000) / 10 : 0;

  return {
    source: 'bm_reconciled_snapshot',
    aersDueAmount: totalDue,
    aersCollectedAmount: totalCollected,
    isEstimatedPaidSplit: true,
    totalCount,
    paidCount: totalPaid,
    notPaidCount: totalNotPaid,
    paidRatioPct:
      totalCount > 0 ? Math.round((totalPaid / totalCount) * 1000) / 10 : 0,
    partialPaidCount: totalPartial,
    unpaidWithDueCount: totalUnpaidWithDue,
    contractsNeededAgainstDue: totalNeeded,
    dueAmount: totalDue,
    collectedAmount: totalCollected,
    varianceAmount: totalVariance,
    collectionPct: totalCollPct,
    subBuckets,
    byOfficer,
    contracts: base.contracts,
  };
}

export function computeStaffDailySnapshotMap(
  aersRecords: AersRecord[],
  staffAssignments: StaffAssignedContract[],
  monthKey?: string,
): Record<string, StaffDailySnapshotEntry> {
  const result: Record<string, StaffDailySnapshotEntry> = {};
  if (!Array.isArray(staffAssignments) || staffAssignments.length === 0) {
    return result;
  }

  const targetMonth = monthKey || getTodayISO().slice(0, 7);
  const scoped = staffAssignments.filter((a) => a && a.monthKey === targetMonth);
  const activeList = scoped.length > 0 ? scoped : staffAssignments;

  const aersByNo = new Map<string, AersRecord>();
  for (const r of aersRecords) {
    if (r?.contractNo) {
      aersByNo.set(normalizeContractNo(r.contractNo), r);
    }
  }

  const grouped = new Map<
    string,
    {
      assignedCount: number;
      paidCount: number;
      totalDue: number;
      totalCollection: number;
      opAgeSum: number;
      closingAgeSum: number;
      reducingCount: number;
      worseningCount: number;
      assignEfforts: number;
    }
  >();

  for (const assignment of activeList) {
    const name = assignment.staffName;
    if (!name) continue;
    const rec = aersByNo.get(normalizeContractNo(assignment.contractNo));
    const due = Number(rec?.currentMonthDue || rec?.dueBudgetMonth || assignment.assignedDue) || 0;
    const coll = Number(rec?.totalCollection ?? 0) || 0;
    const opAge = Number(rec?.opAge ?? assignment.assignedOpAge) || 0;
    const closingAge = Number(rec?.currentAge ?? assignment.assignedOpAge) || 0;
    const variance = closingAge - opAge;
    const efforts = Number(rec?.assignOfficerEfforts ?? 0) || 0;

    const bucket = grouped.get(name) ?? {
      assignedCount: 0,
      paidCount: 0,
      totalDue: 0,
      totalCollection: 0,
      opAgeSum: 0,
      closingAgeSum: 0,
      reducingCount: 0,
      worseningCount: 0,
      assignEfforts: 0,
    };

    bucket.assignedCount += 1;
    if (coll > 0) bucket.paidCount += 1;
    bucket.totalDue += due;
    bucket.totalCollection += coll;
    bucket.opAgeSum += opAge;
    bucket.closingAgeSum += closingAge;
    if (variance <= -0.05) bucket.reducingCount += 1;
    else if (variance >= 0.05) bucket.worseningCount += 1;
    bucket.assignEfforts += efforts;

    grouped.set(name, bucket);
  }

  for (const [staffName, s] of grouped.entries()) {
    const collectionPct =
      s.totalDue > 0 ? Math.min(200, Math.round((s.totalCollection / s.totalDue) * 1000) / 10) : 0;
    result[staffName] = {
      staffName,
      assignedCount: s.assignedCount,
      paidCount: s.paidCount,
      pendingCount: Math.max(0, s.assignedCount - s.paidCount),
      totalDue: Math.round(s.totalDue),
      totalCollection: Math.round(s.totalCollection),
      collectionPct,
      avgOpAge: s.assignedCount > 0 ? Math.round((s.opAgeSum / s.assignedCount) * 100) / 100 : 0,
      avgClosingAge:
        s.assignedCount > 0 ? Math.round((s.closingAgeSum / s.assignedCount) * 100) / 100 : 0,
      reducingCount: s.reducingCount,
      worseningCount: s.worseningCount,
      assignEfforts: s.assignEfforts,
    };
  }

  return result;
}

export function buildDailyAersSnapshot(
  aersRecords: AersRecord[],
  aersMeta: AersMetadata,
  staffAssignments?: StaffAssignedContract[],
): MonthlySnapshot {
  const todayISO = getTodayISO();
  const snapDate = todayISO;
  const monthKey = snapDate.slice(0, 7);
  const dateObj = new Date(`${snapDate}T00:00:00`);
  const label = Number.isNaN(dateObj.getTime())
    ? snapDate
    : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const bm = aersMeta.bmBranchSnapshot;
  const openingNpl =
    bm?.totalOpNpl ?? aersRecords.reduce((s, r) => s + (r.opNpl || 0), 0);
  const openingNplCount =
    bm?.openingNplCount ?? aersRecords.filter((r) => (r.opNpl || 0) > 0).length;
  const closingNpl =
    bm?.totalClosingNpl ?? aersRecords.reduce((s, r) => s + (r.npl || 0), 0);
  const closingNplCount =
    bm?.closingNplCount ?? aersRecords.filter((r) => (r.npl || 0) > 0).length;

  const totalPortfolioCount =
    bm?.totalContracts ??
    (bm?.ageBuckets?.reduce((s, b) => s + b.count, 0) || aersRecords.length);
  const belowOneCount =
    bm?.belowOneCount ??
    (bm?.ageBuckets
      ? (bm.ageBuckets[0]?.count || 0) + (bm.ageBuckets[1]?.count || 0)
      : aersRecords.filter((r) => (r.currentAge || 0) <= 1.0).length);
  const ratio90Pct =
    totalPortfolioCount > 0
      ? Math.round((belowOneCount / totalPortfolioCount) * 1000) / 10
      : 0;

  const branchDebtor =
    bm?.ageBuckets && bm.ageBuckets.length > 0
      ? bm.ageBuckets.reduce((s, b) => s + (b.closingDebtor || 0), 0)
      : aersRecords.reduce((s, r) => s + (r.closingDebtor || 0), 0);

  let branchDue = 0;
  let branchColl = 0;
  if (bm && (bm.roPerformance.length > 0 || bm.moPerformance.length > 0)) {
    const allOfficers = [...bm.roPerformance, ...bm.moPerformance];
    branchDue = allOfficers.reduce((s, o) => s + (o.dueBudget || 0), 0);
    branchColl = allOfficers.reduce((s, o) => s + (o.totalCollection || 0), 0);
  } else {
    for (const r of aersRecords) {
      branchDue += r.dueBudgetMonth || r.currentMonthDue || 0;
      branchColl += r.totalCollection || 0;
    }
  }
  const branchCollectionPct =
    branchDue > 0
      ? Math.min(200, Math.round((branchColl / branchDue) * 1000) / 10)
      : 0;

  const savedRecs = aersRecords.filter((r) =>
    isNplSavedAccount({
      opNpl: r.opNpl,
      opAge: r.opAge,
      npl: r.npl,
      actualDpd: r.actualDpd,
      monthEndForecastDpd: r.monthEndForecastDpd,
      totalCollection: r.totalCollection,
      lastPaidAmount: r.lastPaidAmount,
    }),
  );
  const nplSavedAmount = savedRecs.reduce(
    (s, r) => s + getSavedNplCapitalValue(r),
    0,
  );
  const fallenRecs = aersRecords.filter((r) => isFallenNplAccount(r));
  const newNplAmount = fallenRecs.reduce(
    (s, r) => s + getCapitalNplExposure(r),
    0,
  );

  const activeSys = captureSystemActiveDateTime();
  return {
    id: `snap_${snapDate}`,
    label,
    monthKey,
    snapshotDate: snapDate,
    uploadedAt: activeSys.isoTimestamp,
    trackedCount: totalPortfolioCount,
    trackedDebtor: branchDebtor,
    trackedNpl: closingNpl,
    openingNpl,
    openingNplCount,
    closingNplCount,
    belowOneCount,
    totalPortfolioCount,
    ratio90Pct,
    nplSavedAmount,
    nplSavedCount: savedRecs.length,
    newNplAmount,
    fallenNplCount: fallenRecs.length,
    collectionPct: branchCollectionPct,
    branchCount: totalPortfolioCount,
    branchDebtor,
    branchNpl: closingNpl,
    branchCollectionPct,
    sourceFile: aersMeta.fileName,
    staffDailyStats:
      staffAssignments && staffAssignments.length > 0
        ? computeStaffDailySnapshotMap(aersRecords, staffAssignments, monthKey)
        : undefined,
  };
}

