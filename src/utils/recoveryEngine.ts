import * as XLSX from 'xlsx';
import type {
  AersMetadata,
  AersRecord,
  AgeBucketDatum,
  BmAgeBucketDatum,
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
    (rec.opAge || 0) < 2.0 &&
    (rec.currentAge || 0) < 2.0 &&
    (rec.npl || 0) === 0 &&
    (rec.opNpl || 0) === 0 &&
    (rec.monthEndForecastDpd || 0) < 80 &&
    (rec.actualDpd || 0) < 61 &&
    !mrp?.borderNpl
  ) {
    return false;
  }

  return (
    (rec.npl || 0) > 0 ||
    (rec.actualDpd || 0) >= 61 ||
    (rec.opAge || 0) >= 3.0 ||
    (rec.opNpl || 0) > 0 ||
    (rec.opAge || 0) >= 2.01 ||
    (rec.currentAge || 0) >= 2.01 ||
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

  let printedDateTime = '';
  for (let r = 0; r < Math.min(4, rows.length); r++) {
    const joined = (rows[r] || []).map((c) => String(c ?? '')).join(' ');
    const match = joined.match(
      /Printed\s+Date\s+and\s+Time\s*:?\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/i,
    );
    if (match) {
      printedDateTime = match[1].trim();
      break;
    }
  }
  if (!printedDateTime) {
    const now = new Date();
    printedDateTime = `${getTodayISO()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
  }

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
      uploadedAt: new Date().toISOString(),
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

function applyStrictNplUniverseFilter(
  baseResult: ParsedAersResult,
  mrpMap?: Map<string, MrpEnrichment>,
  watchlistImports?: Sheet2WatchlistRow[],
): ParsedAersResult {
  const allRecords = baseResult.records;
  const bmBranchSnapshot = {
    ageBuckets: computeBmAgeBuckets(allRecords, []),
    roPerformance: computeBmOfficerPerformance(allRecords, [], 'RO'),
    moPerformance: computeBmOfficerPerformance(allRecords, [], 'MO'),
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
    isMultiSheetWorkbook: Boolean(mrpMap || watchlistImports),
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

  return applyStrictNplUniverseFilter(baseResult, mrpMap, watchlistImports);
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
    byOfficer[key].openingDebtor += r.opBalDebtor || r.closingDebtor || 0;
    byOfficer[key].openingNpl += r.opNpl || r.npl || 0;
    if (r.opNpl > 0 || r.actualDpd >= 91 || r.npl > 0) {
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
    if (item.opNpl > 0 || item.opAge >= 3.0) {
      row.openingNplCount += 1;
    }

    row.closingCount += 1;
    row.closingDebtor += item.closingDebtor;
    row.closingNpl += item.npl;
    if (item.npl > 0 || item.actualDpd >= 91) {
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
      if (row && base.openingDebtor > 0 && items.length >= base.openingCount) {
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
        closingNpl: 0,
        netNplVariance: 0,
        closingDebtor: 0,
        belowOneCount: 0,
        opBelowOneCount: 0,
        belowOneRetentionPct: 0,
      };
      map.set(item.officer, row);
    }

    row.totalCount += 1;
    row.dueBudget += item.dueBudget;
    row.totalCollection += item.totalCollection;
    row.opNpl += item.opNpl;
    row.closingNpl += item.closingNpl;
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

    return {
      ...r,
      collectionEfficiencyPct,
      netNplVariance,
      belowOneRetentionPct,
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
