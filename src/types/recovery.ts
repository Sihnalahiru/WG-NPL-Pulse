export type VisitWithOption = 'My Self' | 'Mr. Damith' | 'BM' | 'Marketing';

export type ContractSituation =
  | 'Active Follow-Up'
  | 'P/P Promised'
  | 'NPL SAVED'
  | 'BROKEN P/P'
  | 'Hand Over Pending'
  | 'Legal / Seize'
  | 'Settled';

export type FilterPreset =
  | 'all'
  | 'borderline_crossing'
  | 'current_npl'
  | 'npl_saved'
  | 'today_pp'
  | 'broken_pp';

export type NavSection =
  | 'overview'
  | 'assign_user'
  | 'below_one'
  | 'below_three'
  | 'borderline'
  | 'worst'
  | 'alerts'
  | 'rewards'
  | 'fb_incentive'
  | 'tools'
  | 'settings';

export interface AersRecord {
  no: string;
  contractNo: string;
  cusName: string;
  contractDate: string;
  opAge: number;
  currentAge: number;
  opBalDebtor: number;
  closingDebtor: number;
  dueBudgetMonth: number;
  currentMonthDue: number;
  totalCollection: number;
  cashColl: number;
  capitalOutstanding: number;
  capitalArrears?: number;
  interestInSuspense: number;
  actualDpd: number;
  monthEndForecastDpd: number;
  minAmountToReverseNpl: number;
  opNpl: number;
  npl: number;
  nextDueDate: string;
  lastPayDate: string;
  lastPaidAmount: number;
  contractStatus: string;
  recoveryStatus: string;
  marketingOfficer: string;
  recoveryOfficer: string;
  financeAmount: number;
  currentStock: string;
  department: string;
  address: string;
  mobileNo: string;
  opCapitalOutstanding: number;
  nplReason: string;
  worstCaseProduct: string;
  officeType: string;
  currentRc: string;
  totalEfforts: number;
  assignOfficerEfforts: number;
}

export interface AgeGroupEffortRow {
  key: 'below_1' | 'age_1_2' | 'age_2_3' | 'age_3_6' | 'age_6_plus';
  label: string;
  shortLabel: string;
  count: number;
  assignOfficerEfforts: number;
  totalEfforts: number;
  zeroEffortCount: number;
  avgAssignEfforts: number;
  closingDebtor: number;
  nplAmount: number;
}

export interface BelowOneQuickWinItem {
  contractNo: string;
  cusName: string;
  officer: string;
  officeType: string;
  opAge: number;
  currentAge: number;
  excessAge: number;
  actualDpd: number;
  closingDebtor: number;
  currentMonthDue: number;
  totalCollection: number;
  assignOfficerEfforts: number;
  totalEfforts: number;
  lastPayDate: string;
  lastPaidAmount: number;
}

export interface BelowThreeSubBucket {
  key: 'zero_below' | 'age_0_1' | 'age_1_2' | 'age_2_3';
  label: string;
  shortLabel: string;
  totalCount: number;
  paidCount: number;
  notPaidCount: number;
  paidPct: number;
  dueAmount: number;
  collectedAmount: number;
  varianceAmount: number;
  collectionPct: number;
}

export interface BelowThreeOfficerRow {
  officer: string;
  role: string;
  totalCount: number;
  paidCount: number;
  notPaidCount: number;
  paidRatioPct: number;
  partialPaidCount: number;
  unpaidWithDueCount: number;
  contractsNeededAgainstDue: number;
  dueAmount: number;
  collectedAmount: number;
  varianceAmount: number;
  collectionPct: number;
  avgDuePerUnpaid: number;
  subBuckets: {
    below1: { total: number; paid: number; notPaid: number };
    age1to2: { total: number; paid: number; notPaid: number };
    age2to3: { total: number; paid: number; notPaid: number };
  };
}

export interface BelowThreeContractItem {
  contractNo: string;
  cusName: string;
  officer: string;
  officeType: string;
  opAge: number;
  currentAge: number;
  actualDpd: number;
  currentMonthDue: number;
  totalCollection: number;
  varianceAmount: number;
  isPaid: boolean;
  isFullPaid: boolean;
  lastPayDate: string;
  lastPaidAmount: number;
  closingDebtor: number;
  assignOfficerEfforts: number;
  totalEfforts: number;
  nextDueDate: string;
}

export interface BelowThreeCollectionSnapshot {
  totalCount: number;
  paidCount: number;
  notPaidCount: number;
  paidRatioPct: number;
  partialPaidCount: number;
  unpaidWithDueCount: number;
  contractsNeededAgainstDue: number;
  dueAmount: number;
  collectedAmount: number;
  varianceAmount: number;
  collectionPct: number;
  subBuckets: BelowThreeSubBucket[];
  byOfficer: BelowThreeOfficerRow[];
  contracts: BelowThreeContractItem[];
}

export interface AersMetadata {
  fileName: string;
  printedDateTime: string;
  uploadedAt: string;
  totalContractsCount: number;
  excludedRegularCount?: number;
  isSampleData: boolean;
  bmBranchSnapshot?: {
    ageBuckets: BmAgeBucketDatum[];
    roPerformance: BmOfficerPerformanceRow[];
    moPerformance: BmOfficerPerformanceRow[];
    ageGroupEfforts?: AgeGroupEffortRow[];
    belowOneQuickWins?: BelowOneQuickWinItem[];
    belowThreeSummary?: BelowThreeCollectionSnapshot;
    totalContracts?: number;
    belowOneCount?: number;
    ratio90Pct?: number;
    openingNplCount?: number;
    closingNplCount?: number;
    totalOpNpl?: number;
    totalClosingNpl?: number;
  };
}

export type MrpActionCategory = 'PLANNING' | 'ACTIONS' | 'FOLLOW-UP / CHALLENGES';

export interface MrpPaymentMonth {
  month: 'Jan' | 'Feb' | 'Mar' | 'Apr' | 'May' | 'Jun' | 'Jul' | 'Aug' | 'Sep' | 'Oct';
  dateKey: string;
  raw: string;
  status: 'NP' | 'PAID' | 'EMPTY';
  amount: number;
}

export interface MrpEnrichment {
  nplCategory: string;
  bucketMovement: string;
  impairmentStage: string;
  recoveryAttention: string;
  notPaidSummary: string;
  borderNpl?: boolean;
  borderNplLabel?: string;
  paymentPattern: MrpPaymentMonth[];
}

export interface Sheet2WatchlistRow {
  no: string;
  contractNo: string;
  name: string;
  ro: string;
}

export interface VisitLogEntry {
  id: string;
  visitDate: string;
  visitWith: VisitWithOption;
  mrpActionCode?: string;
  ppDate: string;
  handOverDate: string;
  remark: string;
  remarkBy: string;
  situation: ContractSituation;
  locationUrl?: string;
  loggedAt: string;
}

export interface TrackedContract {
  contractNo: string;
  cusName: string;
  mobileNo: string;
  address: string;
  opAge: number;
  currentAge: number;
  opBalDebtor?: number;
  closingDebtor: number;
  capitalOutstanding: number;
  opCapitalOutstanding?: number;
  capitalArrears?: number;
  currentMonthDue?: number;
  totalCollection?: number;
  opNpl: number;
  npl: number;
  actualDpd: number;
  monthEndForecastDpd: number;
  minAmountToReverseNpl: number;
  recoveryOfficer: string;
  marketingOfficer: string;
  lastPayDate: string;
  lastPaidAmount: number;
  nplReason?: string;
  worstCaseProduct?: string;
  officeType?: string;
  assignOfficerEfforts?: number;
  totalEfforts?: number;
  vehicleNo: string;
  visitWith: VisitWithOption;
  visitDate: string;
  ppDate: string;
  handOverDate: string;
  remark: string;
  remarkBy: string;
  ro: string;
  currentSituation: ContractSituation;
  mrpActionCode?: string;
  mrp?: MrpEnrichment;
  locationUrl: string;
  locationUpdatedAt?: string;
  locationText?: string;
  nplSavedAmount: number;
  addedAt: string;
  lastSyncedAt?: string;
  visitHistory: VisitLogEntry[];
}

export interface StaffDailySnapshotEntry {
  staffName: string;
  assignedCount: number;
  paidCount: number;
  pendingCount: number;
  totalDue: number;
  totalCollection: number;
  collectionPct: number;
  avgOpAge: number;
  avgClosingAge: number;
  reducingCount: number;
  worseningCount: number;
  assignEfforts: number;
}

export interface MonthlySnapshot {
  id: string;
  label: string;
  monthKey?: string;
  snapshotDate: string;
  uploadedAt?: string;
  trackedCount: number;
  trackedDebtor: number;
  trackedNpl: number;
  openingNpl?: number;
  openingNplCount?: number;
  closingNplCount?: number;
  belowOneCount?: number;
  totalPortfolioCount?: number;
  ratio90Pct?: number;
  nplSavedAmount: number;
  nplSavedCount: number;
  newNplAmount: number;
  fallenNplCount: number;
  collectionPct: number;
  branchCount?: number;
  branchDebtor?: number;
  branchNpl?: number;
  branchCollectionPct?: number;
  sourceFile?: string;
  staffDailyStats?: Record<string, StaffDailySnapshotEntry>;
}

export interface NotificationPreferences {
  enabled: boolean;
  soundEnabled: boolean;
  hourlyReminder: boolean;
  lastNotifiedAt?: string;
}

export interface WhatsAppLocationMatch {
  rawVehicleNo: string;
  normalizedVehicleNo: string;
  locationUrl: string;
  locationText: string;
  timestampText: string;
  matchedContractNo?: string;
  matchedClientName?: string;
}

export interface AgeBucketDatum {
  bucket: string;
  rangeKey: '0' | '1-30' | '31-60' | '61-90' | '91+';
  count: number;
  closingDebtor: number;
  nplAmount: number;
  minToSave: number;
}

export interface BorderlineAccountItem {
  contractNo: string;
  cusName: string;
  vehicleNo: string;
  officeType: string;
  officer: string;
  actualDpd: number;
  currentAge?: number;
  monthEndForecastDpd: number;
  nextMonthProjectedDpd: number;
  opAge: number;
  closingDebtor: number;
  capitalOutstanding: number;
  capitalArrears: number;
  projectedNpl: number;
  opNpl: number;
  npl: number;
  minToSave: number;
  assignOfficerEfforts: number;
  totalEfforts: number;
  nplReason: string;
  isWorst: boolean;
  riskTier: 'This Month-End (91+)' | 'Next Month Borderline (61-90)';
  isTracked: boolean;
}

export interface BorderlineSaveAnalysis {
  accounts: BorderlineAccountItem[];
  totalCount: number;
  thisMonthEndCount: number;
  nextMonthOnlyCount: number;
  totalDebtorAtRisk: number;
  totalCapitalAtRisk: number;
  totalMinToSave: number;
  totalBorderlineEfforts: number;
  zeroEffortCount: number;
  avgEffortsPerBorderline: number;
  savedCount: number;
  savedAmount: number;
  borderSavedCount: number;
  borderSavedAmount: number;
  above3SavedCount: number;
  above3SavedAmount: number;
  movedToNplCount: number;
  movedToNplAmount: number;
  forecastedBorderCount: number;
  forecastedBorderAmount: number;
}

export interface WorstCaseAccountItem {
  contractNo: string;
  cusName: string;
  vehicleNo: string;
  officeType: string;
  officer: string;
  actualDpd: number;
  currentAge: number;
  opAge: number;
  opNpl: number;
  closingNpl: number;
  closingDebtor: number;
  minToReverseNpl: number;
  nplReason: string;
  worstCaseProduct: string;
  assignOfficerEfforts: number;
  totalEfforts: number;
  isTracked: boolean;
}

export interface WorstCaseAnalysis {
  accounts: WorstCaseAccountItem[];
  totalCount: number;
  totalOpNpl: number;
  totalClosingNpl: number;
  totalClosingDebtor: number;
  totalAssignEfforts: number;
  zeroEffortCount: number;
  lowDpdAttentionCount: number;
}

export interface OfficerEvaluationRow {
  officer: string;
  officeType?: string;
  openingCount: number;
  openingDebtor: number;
  openingNpl: number;
  openingNplCount: number;
  closingCount: number;
  closingDebtor: number;
  closingNpl: number;
  closingNplCount: number;
  forecastedBorderCount: number;
  forecastedBorderAmount: number;
  movedToNplCount: number;
  movedToNplAmount: number;
  borderSavedCount: number;
  borderSavedAmount: number;
  borderlineCount: number;
  borderlineMinToSave: number;
  borderlineEfforts: number;
  zeroEffortBorderlineCount: number;
  worstCount: number;
  worstNpl: number;
  nplReduction: number;
  debtorReduction: number;
  nplSaveRatePct: number;
  savedFromOpNplCount: number;
  savedFromOpNplAmount: number;
}

export interface OfficeTypeOfficerRow {
  officer: string;
  totalCount: number;
  activeNplCount: number;
  opNpl: number;
  closingNpl: number;
  closingDebtor: number;
  borderlineCount: number;
  borderlineMinToSave: number;
  borderlineEfforts: number;
  zeroEffortBorderlineCount: number;
  worstCount: number;
  worstNpl: number;
}

export interface OfficeTypeSummary {
  officeType: string;
  totalCount: number;
  activeNplCount: number;
  opNpl: number;
  closingNpl: number;
  closingDebtor: number;
  borderlineCount: number;
  borderlineMinToSave: number;
  borderlineEfforts: number;
  zeroEffortBorderlineCount: number;
  worstCount: number;
  worstNpl: number;
  officers: OfficeTypeOfficerRow[];
}

export interface MapsGroundingChunk {
  title: string;
  uri: string;
  reviewSnippets?: string[];
}

export interface OpeningOfficerBaseline {
  printedDateTime: string;
  byOfficer: Record<
    string,
    {
      openingCount: number;
      openingDebtor: number;
      openingNpl: number;
      openingNplCount: number;
    }
  >;
}

export interface BmAgeBucketDatum {
  code: '[A]' | '[B]' | '[C]' | '[D]' | '[E]' | '[F]' | '[G]' | '[H]' | '[I]';
  label: string;
  shortLabel: string;
  count: number;
  closingDebtor: number;
  nplAmount: number;
  nplMillions: number;
}

export interface BmOfficerPerformanceRow {
  officer: string;
  role: 'RO' | 'MO';
  totalCount: number;
  dueBudget: number;
  totalCollection: number;
  collectionEfficiencyPct: number;
  opNpl: number;
  openingNplCount?: number;
  closingNpl: number;
  closingNplCount?: number;
  netNplVariance: number;
  closingDebtor: number;
  belowOneCount: number;
  opBelowOneCount: number;
  belowOneRetentionPct: number;
  ratio90Pct?: number;
}

export interface OfficerEffortSummaryRow {
  ro: string;
  officeType: string;
  highRiskCount: number;
  borderlineCount: number;
  nplCount: number;
  assignOfficerEfforts: number;
  borderlineAssignEfforts: number;
  nplAssignEfforts: number;
  totalEfforts: number;
  avgAssignEfforts: number;
  zeroEffortCount: number;
  highRiskExposure: number;
}

export const STAFF_FOLLOWUP_NAMES = [
  'Manisha',
  'Minula',
  'Gavindi',
  'Mihiranga',
  'Chathuri',
  'Sathsarani',
  'Tharindu',
  'Upeksha',
  'Tharusha',
  'Tashmi',
] as const;

export type StaffFollowUpName = (typeof STAFF_FOLLOWUP_NAMES)[number];

export interface StaffAssignedContract {
  contractNo: string;
  staffName: string;
  monthKey: string;
  assignedAt: string;
  assignedOpAge: number;
  assignedDebtor: number;
  assignedNpl: number;
  assignedDue: number;
  assignedCollection: number;
  note?: string;
}

export interface BackupPayload {
  version: number;
  exportedAt: string;
  trackedContracts: TrackedContract[];
  monthlySnapshots: MonthlySnapshot[];
  aersMeta: AersMetadata | null;
  aersMasterList: AersRecord[];
  openingBaseline?: OpeningOfficerBaseline | null;
  staffAssignments?: StaffAssignedContract[];
  notificationPrefs: NotificationPreferences;
}
