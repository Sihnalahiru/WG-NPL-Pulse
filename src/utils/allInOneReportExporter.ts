import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import type {
  AersMetadata,
  AersRecord,
  BelowThreeCollectionSnapshot,
  BmAgeBucketDatum,
  BmOfficerPerformanceRow,
  MonthlySnapshot,
  MrpEnrichment,
  OfficeTypeSummary,
} from '../types/recovery';
import {
  analyzeNextMonthBorderline,
  computeBmAgeBuckets,
  computeBmOfficerPerformance,
  computeOfficeTypeBreakdown,
  formatCompactRs,
  formatCurrencyRs,
  getBranchPortfolioTotals,
  getNormalizedOfficerRole,
  getOfficerByOfficeType,
  getTodayISO,
  isWorstCategory,
  normalizeEvaluableFromAers,
  reconcileBelowThreeFromBmSnapshot,
} from './recoveryEngine';

export interface AllInOneReportInput {
  aersRecords: AersRecord[];
  aersMeta: AersMetadata | null;
  mrpMap?: Map<string, MrpEnrichment>;
  monthlySnapshots?: MonthlySnapshot[];
}

export interface AllInOneReportDataset {
  generatedAtLabel: string;
  snapshotLabel: string;
  dateStamp: string;
  branchTotals: ReturnType<typeof getBranchPortfolioTotals>;
  roPerf: BmOfficerPerformanceRow[];
  moPerf: BmOfficerPerformanceRow[];
  ageBuckets: BmAgeBucketDatum[];
  belowThree: BelowThreeCollectionSnapshot;
  officeBreakdown: OfficeTypeSummary[];
  borderline: ReturnType<typeof analyzeNextMonthBorderline>;
  worstRecords: AersRecord[];
  monthlySnapshots: MonthlySnapshot[];
}

export function buildAllInOneReportDataset(
  input: AllInOneReportInput,
): AllInOneReportDataset {
  const { aersRecords, aersMeta, mrpMap, monthlySnapshots = [] } = input;
  const bm = aersMeta?.bmBranchSnapshot;
  const branchTotals = getBranchPortfolioTotals(aersMeta, aersRecords, 'ALL');

  const roPerf: BmOfficerPerformanceRow[] =
    bm?.roPerformance && bm.roPerformance.length > 0
      ? bm.roPerformance
      : computeBmOfficerPerformance(aersRecords, [], 'RO');

  const moPerf: BmOfficerPerformanceRow[] =
    bm?.moPerformance && bm.moPerformance.length > 0
      ? bm.moPerformance
      : computeBmOfficerPerformance(aersRecords, [], 'MO');

  const ageBuckets: BmAgeBucketDatum[] =
    bm?.ageBuckets && bm.ageBuckets.length > 0
      ? bm.ageBuckets
      : computeBmAgeBuckets(aersRecords, []);

  const belowThree: BelowThreeCollectionSnapshot =
    bm?.belowThreeSummary && bm.belowThreeSummary.byOfficer.length > 0
      ? bm.belowThreeSummary
      : reconcileBelowThreeFromBmSnapshot(aersRecords, bm);

  const evaluable = normalizeEvaluableFromAers(aersRecords, new Set<string>(), mrpMap);
  const borderline = analyzeNextMonthBorderline(evaluable);
  const officeBreakdown = computeOfficeTypeBreakdown(evaluable);
  const worstRecords = aersRecords
    .filter((r) => isWorstCategory(r.nplReason, r.worstCaseProduct))
    .sort((a, b) => (b.npl || 0) - (a.npl || 0));

  const now = new Date();
  const generatedAtLabel = now.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return {
    generatedAtLabel,
    snapshotLabel: aersMeta?.printedDateTime || getTodayISO(),
    dateStamp: getTodayISO(),
    branchTotals,
    roPerf,
    moPerf,
    ageBuckets,
    belowThree,
    officeBreakdown,
    borderline,
    worstRecords,
    monthlySnapshots,
  };
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function copyTextSafe(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function openExternalLinkSafe(href: string): void {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

function setColWidths(ws: XLSX.WorkSheet, widths: number[]): void {
  ws['!cols'] = widths.map((wch) => ({ wch }));
}

export function buildAllInOneExcelArtifact(input: AllInOneReportInput): {
  blob: Blob;
  fileName: string;
  dataset: AllInOneReportDataset;
} {
  const ds = buildAllInOneReportDataset(input);
  const {
    branchTotals,
    roPerf,
    moPerf,
    ageBuckets,
    belowThree,
    officeBreakdown,
    borderline,
    worstRecords,
  } = ds;

  const wb = XLSX.utils.book_new();
  const netNplMovement = branchTotals.totalClosingNpl - branchTotals.totalOpNpl;
  const totalPortfolioDebtor = ageBuckets.reduce((s, b) => s + (b.closingDebtor || 0), 0);

  // ── Sheet 1: Executive Summary ───────────────────────────────────────────
  const s1Rows: (string | number)[][] = [
    ['WG PULSE — ALL-IN-ONE BRANCH RECOVERY EXECUTIVE REPORT'],
    ['Generated At', ds.generatedAtLabel, 'AERS Snapshot', ds.snapshotLabel],
    ['Source File', input.aersMeta?.fileName || 'Live Portfolio Snapshot', 'Data Scope', branchTotals.isFromBmSnapshot ? 'Full Branch Portfolio (BM Dashboard + AERS)' : 'Loaded AERS Records'],
    [],
    ['METRIC CATEGORY', 'METRIC', 'VALUE', 'NOTES'],
    ['Branch Portfolio', 'Total Branch Contracts', branchTotals.totalContracts, `RO: ${branchTotals.roContractsCount.toLocaleString()} (${branchTotals.roOfficerCount} ROs) · MO: ${branchTotals.moContractsCount.toLocaleString()} (${branchTotals.moOfficerCount} MOs)`],
    ['Branch Portfolio', 'RO (Recovery Officer) Contracts', branchTotals.roContractsCount, `${branchTotals.roOfficerCount} Recovery Officers (Office Type = RO)`],
    ['Branch Portfolio', 'MO (Marketing Officer) Contracts', branchTotals.moContractsCount, `${branchTotals.moOfficerCount} Marketing Officers (Office Type = MO)`],
    ['Branch Portfolio', 'NPL & Borderline Monitored Accounts', branchTotals.nplBorderlineCount, 'Active high-risk accounts tracked in AERS'],
    ['Branch Portfolio', 'Total Portfolio Closing Debtor (Rs.)', round2(totalPortfolioDebtor), formatCompactRs(totalPortfolioDebtor)],
    [],
    ['NPL Movement', 'Opening NPL Amount (Rs.)', round2(branchTotals.totalOpNpl), `${branchTotals.openingNplCount.toLocaleString()} accounts (${formatCompactRs(branchTotals.totalOpNpl)})`],
    ['NPL Movement', 'Closing NPL Amount (Rs.)', round2(branchTotals.totalClosingNpl), `${branchTotals.closingNplCount.toLocaleString()} accounts (${formatCompactRs(branchTotals.totalClosingNpl)})`],
    ['NPL Movement', 'Net NPL Variance (Close - Open) (Rs.)', round2(netNplMovement), netNplMovement <= 0 ? `Reduced by ${formatCompactRs(Math.abs(netNplMovement))}` : `Increased by ${formatCompactRs(netNplMovement)}`],
    [],
    ['Below 1 (90 Ratio)', 'Below 1 Contracts (Age <= 1.00)', branchTotals.belowOneCount, `Out of ${branchTotals.totalContracts.toLocaleString()} total branch contracts`],
    ['Below 1 (90 Ratio)', 'Current 90 Ratio (%)', round2(branchTotals.ratio90Pct), branchTotals.ratio90Pct >= 90 ? 'TARGET ACHIEVED (>= 90%)' : `${branchTotals.neededFor90.toLocaleString()} contracts needed to hit 90.0%`],
    ['Below 1 (90 Ratio)', 'Contracts Needed for 90% Target', branchTotals.neededFor90, 'Target threshold: 90.0% Below 1'],
    [],
    ['Below 3 Collection', 'Below 3 Total Contracts', belowThree.totalCount, `Paid: ${belowThree.paidCount.toLocaleString()} · Not Paid: ${belowThree.notPaidCount.toLocaleString()}`],
    ['Below 3 Collection', 'Below 3 Target / Monthly Due (Rs.)', round2(belowThree.dueAmount), formatCompactRs(belowThree.dueAmount)],
    ['Below 3 Collection', 'Below 3 Actual Collected (Rs.)', round2(belowThree.collectedAmount), formatCompactRs(belowThree.collectedAmount)],
    ['Below 3 Collection', 'Below 3 Variance (Target - Collected) (Rs.)', round2(belowThree.varianceAmount), formatCompactRs(belowThree.varianceAmount)],
    ['Below 3 Collection', 'Below 3 Collection Efficiency (%)', round2(belowThree.collectionPct), belowThree.bmSheetName ? `Reconciled from sheet: ${belowThree.bmSheetName}` : 'Reconciled from BM Portfolio'],
    ['Below 3 Collection', 'Contracts Needed Against Variance', belowThree.contractsNeededAgainstDue, 'Unpaid accounts required to bridge variance'],
    [],
    ['Risk & Priority', 'Next-Month Borderline (61-90 DPD) Count', borderline.totalCount, `Min to Save: ${formatCompactRs(borderline.totalMinToSave)} · 0-Effort: ${borderline.zeroEffortCount}`],
    ['Risk & Priority', 'Worst Case (W) Accounts Count', worstRecords.length, `Closing NPL: ${formatCompactRs(worstRecords.reduce((s, r) => s + (r.npl || 0), 0))}`],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(s1Rows);
  setColWidths(ws1, [22, 40, 22, 52]);
  XLSX.utils.book_append_sheet(wb, ws1, '1_Executive_Summary');

  // ── Sheet 2: RO & MO Performance ─────────────────────────────────────────
  const s2Rows: (string | number)[][] = [
    [
      'Office Type',
      'Officer Role',
      'Officer Name',
      'Assigned Contracts',
      'Below 1 Count',
      '90 Ratio (%)',
      'Monthly Due / Budget (Rs.)',
      'Total Collection (Rs.)',
      'Collection Eff (%)',
      'Opening NPL (Rs.)',
      'Closing NPL (Rs.)',
      'Net NPL Variance (Rs.)',
      'Closing Debtor (Rs.)',
    ],
  ];

  const pushOfficerRows = (rows: BmOfficerPerformanceRow[], roleLabel: string, subtotalLabel: string) => {
    for (const o of rows) {
      const ratio90 =
        typeof o.ratio90Pct === 'number'
          ? o.ratio90Pct
          : o.totalCount > 0
            ? (o.belowOneCount / o.totalCount) * 100
            : 0;
      s2Rows.push([
        o.role,
        roleLabel,
        o.officer,
        o.totalCount,
        o.belowOneCount,
        round2(ratio90),
        round2(o.dueBudget),
        round2(o.totalCollection),
        round2(o.collectionEfficiencyPct),
        round2(o.opNpl),
        round2(o.closingNpl),
        round2(o.netNplVariance),
        round2(o.closingDebtor),
      ]);
    }
    const subCount = rows.reduce((s, r) => s + (r.totalCount || 0), 0);
    const subB1 = rows.reduce((s, r) => s + (r.belowOneCount || 0), 0);
    const subDue = rows.reduce((s, r) => s + (r.dueBudget || 0), 0);
    const subColl = rows.reduce((s, r) => s + (r.totalCollection || 0), 0);
    const subOp = rows.reduce((s, r) => s + (r.opNpl || 0), 0);
    const subCl = rows.reduce((s, r) => s + (r.closingNpl || 0), 0);
    const subDeb = rows.reduce((s, r) => s + (r.closingDebtor || 0), 0);
    s2Rows.push([
      subtotalLabel,
      `${rows.length} Officers`,
      `${subtotalLabel} SUBTOTAL`,
      subCount,
      subB1,
      subCount > 0 ? round2((subB1 / subCount) * 100) : 0,
      round2(subDue),
      round2(subColl),
      subDue > 0 ? round2((subColl / subDue) * 100) : 0,
      round2(subOp),
      round2(subCl),
      round2(subCl - subOp),
      round2(subDeb),
    ]);
  };

  pushOfficerRows(roPerf, 'Recovery Officer (RO)', 'RO');
  pushOfficerRows(moPerf, 'Marketing Officer (MO)', 'MO');

  const allBm = [...roPerf, ...moPerf];
  const gCount = allBm.reduce((s, r) => s + (r.totalCount || 0), 0) || branchTotals.totalContracts;
  const gB1 = allBm.reduce((s, r) => s + (r.belowOneCount || 0), 0) || branchTotals.belowOneCount;
  const gDue = allBm.reduce((s, r) => s + (r.dueBudget || 0), 0);
  const gColl = allBm.reduce((s, r) => s + (r.totalCollection || 0), 0);
  const gOp = allBm.reduce((s, r) => s + (r.opNpl || 0), 0) || branchTotals.totalOpNpl;
  const gCl = allBm.reduce((s, r) => s + (r.closingNpl || 0), 0) || branchTotals.totalClosingNpl;
  const gDeb = allBm.reduce((s, r) => s + (r.closingDebtor || 0), 0) || totalPortfolioDebtor;
  s2Rows.push([
    'TOTAL',
    `${allBm.length} Officers`,
    'BRANCH GRAND TOTAL',
    gCount,
    gB1,
    gCount > 0 ? round2((gB1 / gCount) * 100) : 0,
    round2(gDue),
    round2(gColl),
    gDue > 0 ? round2((gColl / gDue) * 100) : 0,
    round2(gOp),
    round2(gCl),
    round2(gCl - gOp),
    round2(gDeb),
  ]);

  const ws2 = XLSX.utils.aoa_to_sheet(s2Rows);
  setColWidths(ws2, [12, 24, 24, 18, 14, 13, 22, 20, 16, 18, 18, 20, 20]);
  XLSX.utils.book_append_sheet(wb, ws2, '2_RO_MO_Performance');

  // ── Sheet 3: Below 3 Collection & Variance ───────────────────────────────
  const s3Rows: (string | number)[][] = [
    [
      'Office Type',
      'Officer Name',
      'Below 3 Contracts',
      'Paid Count',
      'Not Paid Count',
      'Paid Ratio (%)',
      'Target / Due (Rs.)',
      'Actual Collected (Rs.)',
      'Variance (Target - Coll) (Rs.)',
      'Collection (%)',
      'Contracts Needed',
      'Source',
    ],
  ];

  for (const row of belowThree.byOfficer) {
    s3Rows.push([
      row.role,
      row.officer,
      row.totalCount,
      row.paidCount,
      row.notPaidCount,
      round2(row.paidRatioPct),
      round2(row.dueAmount),
      round2(row.collectedAmount),
      round2(row.varianceAmount),
      round2(row.collectionPct),
      row.contractsNeededAgainstDue,
      row.fromBmSheet ? 'BM Dashboard Sheet' : 'Reconciled Portfolio',
    ]);
  }

  s3Rows.push([
    'TOTAL',
    'BRANCH BELOW 3 TOTAL',
    belowThree.totalCount,
    belowThree.paidCount,
    belowThree.notPaidCount,
    round2(belowThree.paidRatioPct),
    round2(belowThree.dueAmount),
    round2(belowThree.collectedAmount),
    round2(belowThree.varianceAmount),
    round2(belowThree.collectionPct),
    belowThree.contractsNeededAgainstDue,
    belowThree.bmSheetName || belowThree.source || 'Reconciled',
  ]);

  const ws3 = XLSX.utils.aoa_to_sheet(s3Rows);
  setColWidths(ws3, [12, 24, 17, 13, 15, 14, 20, 20, 24, 14, 17, 22]);
  XLSX.utils.book_append_sheet(wb, ws3, '3_Below_3_Collection');

  // ── Sheet 4: Age Buckets ─────────────────────────────────────────────────
  const totalBucketCount = ageBuckets.reduce((s, b) => s + (b.count || 0), 0);
  const totalBucketDebtor = ageBuckets.reduce((s, b) => s + (b.closingDebtor || 0), 0);
  const totalBucketNpl = ageBuckets.reduce((s, b) => s + (b.nplAmount || 0), 0);
  const s4Rows: (string | number)[][] = [
    ['Bucket Code', 'Age Range', 'Contracts Count', 'Portfolio Share (%)', 'Closing Debtor (Rs.)', 'NPL Exposure (Rs.)', 'NPL (Rs. M)'],
    ...ageBuckets.map((b) => [
      b.code,
      b.label,
      b.count,
      totalBucketCount > 0 ? round2((b.count / totalBucketCount) * 100) : 0,
      round2(b.closingDebtor),
      round2(b.nplAmount),
      round2(b.nplMillions),
    ]),
    [
      'TOTAL',
      'All Age Buckets',
      totalBucketCount,
      100,
      round2(totalBucketDebtor),
      round2(totalBucketNpl),
      round2(totalBucketNpl / 1_000_000),
    ],
  ];
  const ws4 = XLSX.utils.aoa_to_sheet(s4Rows);
  setColWidths(ws4, [14, 18, 16, 18, 22, 22, 14]);
  XLSX.utils.book_append_sheet(wb, ws4, '4_Age_Buckets');

  // ── Sheet 5: Office Type -> Officer Strategy ─────────────────────────────
  const assignedLookup = new Map<string, number>();
  for (const o of allBm) {
    assignedLookup.set(`${o.role}::${o.officer.trim().toLowerCase()}`, o.totalCount);
  }
  const s5Rows: (string | number)[][] = [
    [
      'Office Type',
      'Role Description',
      'Officer Name',
      'Assigned Total Contracts',
      'Monitored Risk Accts',
      'Active NPL Count',
      'Opening NPL (Rs.)',
      'Closing NPL (Rs.)',
      'Closing Debtor (Rs.)',
      'Borderline Count',
      'Borderline Min To Save (Rs.)',
      'Borderline Efforts',
      '0-Effort Borderline',
      'Worst (W) Count',
      'Worst NPL (Rs.)',
    ],
  ];

  for (const group of officeBreakdown) {
    const normRole = getNormalizedOfficerRole(group.officeType);
    const roleDesc =
      normRole === 'RO'
        ? 'Recovery Officer (RO)'
        : normRole === 'MO'
          ? 'Marketing Officer (MO)'
          : group.officeType;

    for (const o of group.officers) {
      const assignedTotal =
        assignedLookup.get(`${normRole}::${o.officer.trim().toLowerCase()}`) ?? o.totalCount;
      s5Rows.push([
        normRole === 'OTHER' ? group.officeType : normRole,
        roleDesc,
        o.officer,
        assignedTotal,
        o.totalCount,
        o.activeNplCount,
        round2(o.opNpl),
        round2(o.closingNpl),
        round2(o.closingDebtor),
        o.borderlineCount,
        round2(o.borderlineMinToSave),
        o.borderlineEfforts,
        o.zeroEffortBorderlineCount,
        o.worstCount,
        round2(o.worstNpl),
      ]);
    }
  }
  const ws5 = XLSX.utils.aoa_to_sheet(s5Rows);
  setColWidths(ws5, [12, 24, 24, 22, 19, 16, 18, 18, 18, 16, 24, 17, 18, 15, 18]);
  XLSX.utils.book_append_sheet(wb, ws5, '5_Office_Type_Strategy');

  // ── Sheet 6: Borderline & Worst Priority Contracts ───────────────────────
  const s6Rows: (string | number)[][] = [
    [
      'Category',
      'Contract No',
      'Customer Name',
      'Office Type',
      'Assigned Officer',
      'Actual DPD',
      'Current Age',
      'Op NPL (Rs.)',
      'Closing NPL (Rs.)',
      'Closing Debtor (Rs.)',
      'Min To Save / Reverse (Rs.)',
      'Assign Efforts',
      'Risk / NPL Reason',
    ],
  ];

  for (const acc of borderline.accounts) {
    const normRole = getNormalizedOfficerRole(acc.officeType);
    s6Rows.push([
      acc.riskTier,
      acc.contractNo,
      acc.cusName,
      normRole === 'OTHER' ? acc.officeType || '—' : normRole,
      acc.officer,
      acc.actualDpd,
      round2(acc.currentAge ?? acc.opAge),
      round2(acc.opNpl),
      round2(acc.npl),
      round2(acc.closingDebtor),
      round2(acc.minToSave),
      acc.assignOfficerEfforts,
      acc.nplReason || 'Borderline Watch',
    ]);
  }

  for (const w of worstRecords) {
    const normRole = getNormalizedOfficerRole(w.officeType);
    s6Rows.push([
      'WORST CASE (W)',
      w.contractNo,
      w.cusName,
      normRole === 'OTHER' ? w.officeType || '—' : normRole,
      getOfficerByOfficeType(w),
      w.actualDpd,
      round2(w.currentAge),
      round2(w.opNpl),
      round2(w.npl),
      round2(w.closingDebtor),
      round2(w.minAmountToReverseNpl || w.currentMonthDue || 0),
      w.assignOfficerEfforts,
      w.nplReason || w.worstCaseProduct || 'Worst Category (W)',
    ]);
  }

  const ws6 = XLSX.utils.aoa_to_sheet(s6Rows);
  setColWidths(ws6, [28, 18, 28, 12, 22, 12, 12, 16, 16, 18, 24, 14, 28]);
  XLSX.utils.book_append_sheet(wb, ws6, '6_Borderline_Worst_List');

  const wbArray = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const blob = new Blob([wbArray], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const fileName = `WG_Pulse_AllInOne_Report_${ds.dateStamp}.xlsx`;
  return { blob, fileName, dataset: ds };
}

export function downloadAllInOneExcelReport(input: AllInOneReportInput): {
  fileName: string;
  sheetCount: number;
} {
  const { blob, fileName } = buildAllInOneExcelArtifact(input);
  triggerBlobDownload(blob, fileName);
  return { fileName, sheetCount: 6 };
}

export function buildAllInOnePdfArtifact(input: AllInOneReportInput): {
  blob: Blob;
  fileName: string;
  dataset: AllInOneReportDataset;
} {
  const ds = buildAllInOneReportDataset(input);
  const {
    branchTotals,
    roPerf,
    moPerf,
    ageBuckets,
    belowThree,
    borderline,
    worstRecords,
  } = ds;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth(); // 297mm
  const pageH = doc.internal.pageSize.getHeight(); // 210mm
  const marginX = 12;
  const contentW = pageW - marginX * 2;
  let y = 12;

  const drawPageHeader = (subtitle: string) => {
    doc.setFillColor(185, 28, 28);
    doc.rect(0, 0, pageW, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('WG PULSE — ALL-IN-ONE BRANCH RECOVERY REPORT', marginX, 8.2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.text(subtitle, marginX, 13.8);
    doc.text(
      `Snapshot: ${ds.snapshotLabel}  |  Generated: ${ds.generatedAtLabel}`,
      pageW - marginX,
      13.8,
      { align: 'right' },
    );
    y = 24;
  };

  const ensureSpace = (neededMm: number, continuedTitle: string) => {
    if (y + neededMm > pageH - 14) {
      doc.addPage();
      drawPageHeader(continuedTitle);
    }
  };

  const drawSectionHeading = (title: string, subtitle?: string) => {
    ensureSpace(14, title);
    doc.setFillColor(244, 244, 245);
    doc.roundedRect(marginX, y, contentW, 8.5, 1.5, 1.5, 'F');
    doc.setFillColor(185, 28, 28);
    doc.rect(marginX, y, 2.5, 8.5, 'F');
    doc.setTextColor(24, 24, 27);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(title, marginX + 5, y + 5.6);
    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(113, 113, 122);
      doc.text(subtitle, pageW - marginX - 3, y + 5.6, { align: 'right' });
    }
    y += 11;
  };

  interface PdfCol {
    label: string;
    width: number;
    align?: 'left' | 'right' | 'center';
  }

  const drawTable = (
    columns: PdfCol[],
    rows: { cells: string[]; highlight?: 'subtotal' | 'total' | 'alert' }[],
    sectionTitle: string,
  ) => {
    const drawHeaderRow = () => {
      doc.setFillColor(39, 39, 42);
      doc.rect(marginX, y, contentW, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.4);
      let x = marginX;
      for (const col of columns) {
        const tx =
          col.align === 'right'
            ? x + col.width - 1.8
            : col.align === 'center'
              ? x + col.width / 2
              : x + 1.8;
        doc.text(col.label, tx, y + 4.7, { align: col.align || 'left' });
        x += col.width;
      }
      y += 7;
    };

    ensureSpace(16, `${sectionTitle} (Continued)`);
    drawHeaderRow();

    rows.forEach((row, idx) => {
      if (y + 6.4 > pageH - 13) {
        doc.addPage();
        drawPageHeader(`${sectionTitle} (Continued)`);
        drawHeaderRow();
      }

      if (row.highlight === 'total') {
        doc.setFillColor(254, 226, 226);
        doc.rect(marginX, y, contentW, 6.4, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(127, 29, 29);
      } else if (row.highlight === 'subtotal') {
        doc.setFillColor(244, 244, 245);
        doc.rect(marginX, y, contentW, 6.4, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(24, 24, 27);
      } else {
        if (idx % 2 === 1) {
          doc.setFillColor(250, 250, 250);
          doc.rect(marginX, y, contentW, 6.2, 'F');
        }
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(39, 39, 42);
      }

      doc.setFontSize(7.4);
      let x = marginX;
      columns.forEach((col, cIdx) => {
        const raw = row.cells[cIdx] ?? '—';
        const maxChars = Math.max(6, Math.floor(col.width / 1.7));
        const clipped = raw.length > maxChars ? `${raw.slice(0, maxChars - 1)}…` : raw;
        const tx =
          col.align === 'right'
            ? x + col.width - 1.8
            : col.align === 'center'
              ? x + col.width / 2
              : x + 1.8;
        doc.text(clipped, tx, y + 4.3, { align: col.align || 'left' });
        x += col.width;
      });

      doc.setDrawColor(228, 228, 231);
      doc.setLineWidth(0.15);
      doc.line(marginX, y + 6.2, marginX + contentW, y + 6.2);
      y += 6.2;
    });

    y += 5;
  };

  // Page 1: Executive Overview Banner + KPI Cards + RO/MO Performance
  drawPageHeader(
    `Branch Portfolio Summary · RO (${branchTotals.roOfficerCount}) & MO (${branchTotals.moOfficerCount}) · Below 1 · Below 3 · Age Buckets · Priority Risk`,
  );

  const netMovement = branchTotals.totalClosingNpl - branchTotals.totalOpNpl;
  const kpiCards = [
    {
      label: 'BRANCH PORTFOLIO',
      value: `${branchTotals.totalContracts.toLocaleString()} Accts`,
      sub: `RO: ${branchTotals.roContractsCount.toLocaleString()} · MO: ${branchTotals.moContractsCount.toLocaleString()}`,
      accent: [185, 28, 28] as [number, number, number],
    },
    {
      label: 'CLOSING NPL',
      value: formatCompactRs(branchTotals.totalClosingNpl),
      sub: `Op: ${formatCompactRs(branchTotals.totalOpNpl)} · ${branchTotals.closingNplCount} Accts`,
      accent: [153, 27, 27] as [number, number, number],
    },
    {
      label: 'NET NPL MOVEMENT',
      value: `${netMovement <= 0 ? '-' : '+'}${formatCompactRs(Math.abs(netMovement))}`,
      sub: netMovement <= 0 ? 'Net NPL Reduction' : 'Net NPL Increase',
      accent: (netMovement <= 0 ? [5, 150, 105] : [220, 38, 38]) as [number, number, number],
    },
    {
      label: 'BELOW 1 (90 RATIO)',
      value: `${branchTotals.ratio90Pct.toFixed(1)}%`,
      sub: `${branchTotals.belowOneCount.toLocaleString()} / ${branchTotals.totalContracts.toLocaleString()} · Need ${branchTotals.neededFor90}`,
      accent: (branchTotals.ratio90Pct >= 90 ? [5, 150, 105] : [217, 119, 6]) as [number, number, number],
    },
    {
      label: 'BELOW 3 COLLECTION',
      value: `${belowThree.collectionPct.toFixed(1)}%`,
      sub: `Coll ${formatCompactRs(belowThree.collectedAmount)} / ${formatCompactRs(belowThree.dueAmount)}`,
      accent: (belowThree.collectionPct >= 80 ? [5, 150, 105] : [180, 83, 9]) as [number, number, number],
    },
    {
      label: 'BORDERLINE & WORST',
      value: `${borderline.totalCount} Bdr / ${worstRecords.length} W`,
      sub: `Save Min: ${formatCompactRs(borderline.totalMinToSave)}`,
      accent: [124, 58, 237] as [number, number, number],
    },
  ];

  const cardGap = 3.2;
  const cardW = (contentW - cardGap * 5) / 6;
  kpiCards.forEach((card, i) => {
    const cx = marginX + i * (cardW + cardGap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(228, 228, 231);
    doc.setLineWidth(0.25);
    doc.roundedRect(cx, y, cardW, 21, 2, 2, 'FD');
    doc.setFillColor(card.accent[0], card.accent[1], card.accent[2]);
    doc.rect(cx, y, cardW, 2, 'F');
    doc.setTextColor(113, 113, 122);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.4);
    doc.text(card.label, cx + 2.5, y + 6.5);
    doc.setTextColor(24, 24, 27);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(card.value, cx + 2.5, y + 13.2);
    doc.setTextColor(82, 82, 91);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.4);
    doc.text(card.sub, cx + 2.5, y + 18.2);
  });
  y += 26;

  // Section 1: RO & MO Performance
  drawSectionHeading(
    '1. Officer Performance Breakdown — Recovery Officers (RO) & Marketing Officers (MO)',
    `Strict Office Type Rule: RO -> Recovery Officer · MO -> Marketing Officer`,
  );

  const perfCols: PdfCol[] = [
    { label: 'Type', width: 13, align: 'center' },
    { label: 'Officer Name', width: 42 },
    { label: 'Assigned', width: 20, align: 'right' },
    { label: 'Below 1', width: 20, align: 'right' },
    { label: '90 Ratio', width: 19, align: 'right' },
    { label: 'Due Budget', width: 31, align: 'right' },
    { label: 'Collected', width: 31, align: 'right' },
    { label: 'Eff %', width: 17, align: 'right' },
    { label: 'Op NPL', width: 27, align: 'right' },
    { label: 'Closing NPL', width: 27, align: 'right' },
    { label: 'Net Var', width: 26, align: 'right' },
  ];

  const perfTableRows: { cells: string[]; highlight?: 'subtotal' | 'total' }[] = [];
  const appendRoleBlock = (list: BmOfficerPerformanceRow[], code: 'RO' | 'MO', title: string) => {
    for (const o of list) {
      const r90 =
        typeof o.ratio90Pct === 'number'
          ? o.ratio90Pct
          : o.totalCount > 0
            ? (o.belowOneCount / o.totalCount) * 100
            : 0;
      perfTableRows.push({
        cells: [
          code,
          o.officer,
          o.totalCount.toLocaleString(),
          o.belowOneCount.toLocaleString(),
          `${r90.toFixed(1)}%`,
          formatCompactRs(o.dueBudget),
          formatCompactRs(o.totalCollection),
          `${o.collectionEfficiencyPct.toFixed(1)}%`,
          formatCompactRs(o.opNpl),
          formatCompactRs(o.closingNpl),
          `${o.netNplVariance <= 0 ? '-' : '+'}${formatCompactRs(Math.abs(o.netNplVariance))}`,
        ],
      });
    }
    const c = list.reduce((s, r) => s + r.totalCount, 0);
    const b1 = list.reduce((s, r) => s + r.belowOneCount, 0);
    const due = list.reduce((s, r) => s + r.dueBudget, 0);
    const col = list.reduce((s, r) => s + r.totalCollection, 0);
    const op = list.reduce((s, r) => s + r.opNpl, 0);
    const cl = list.reduce((s, r) => s + r.closingNpl, 0);
    const nv = cl - op;
    perfTableRows.push({
      highlight: 'subtotal',
      cells: [
        code,
        `${title} Subtotal (${list.length})`,
        c.toLocaleString(),
        b1.toLocaleString(),
        c > 0 ? `${((b1 / c) * 100).toFixed(1)}%` : '0.0%',
        formatCompactRs(due),
        formatCompactRs(col),
        due > 0 ? `${((col / due) * 100).toFixed(1)}%` : '0.0%',
        formatCompactRs(op),
        formatCompactRs(cl),
        `${nv <= 0 ? '-' : '+'}${formatCompactRs(Math.abs(nv))}`,
      ],
    });
  };

  appendRoleBlock(roPerf, 'RO', 'Recovery Officers');
  appendRoleBlock(moPerf, 'MO', 'Marketing Officers');

  const allBm = [...roPerf, ...moPerf];
  const totC = allBm.reduce((s, r) => s + r.totalCount, 0) || branchTotals.totalContracts;
  const totB1 = allBm.reduce((s, r) => s + r.belowOneCount, 0) || branchTotals.belowOneCount;
  const totDue = allBm.reduce((s, r) => s + r.dueBudget, 0);
  const totCol = allBm.reduce((s, r) => s + r.totalCollection, 0);
  const totOp = allBm.reduce((s, r) => s + r.opNpl, 0) || branchTotals.totalOpNpl;
  const totCl = allBm.reduce((s, r) => s + r.closingNpl, 0) || branchTotals.totalClosingNpl;
  const totNv = totCl - totOp;
  perfTableRows.push({
    highlight: 'total',
    cells: [
      'ALL',
      `BRANCH GRAND TOTAL (${allBm.length})`,
      totC.toLocaleString(),
      totB1.toLocaleString(),
      totC > 0 ? `${((totB1 / totC) * 100).toFixed(1)}%` : '0.0%',
      formatCompactRs(totDue),
      formatCompactRs(totCol),
      totDue > 0 ? `${((totCol / totDue) * 100).toFixed(1)}%` : '0.0%',
      formatCompactRs(totOp),
      formatCompactRs(totCl),
      `${totNv <= 0 ? '-' : '+'}${formatCompactRs(Math.abs(totNv))}`,
    ],
  });

  drawTable(perfCols, perfTableRows, '1. Officer Performance Breakdown');

  // Section 2: Below 3 Collection & Variance
  drawSectionHeading(
    '2. Below 3 Collection & Monthly Variance Tracker (RO & MO)',
    `Target: ${formatCompactRs(belowThree.dueAmount)} · Collected: ${formatCompactRs(belowThree.collectedAmount)} · Variance: ${formatCompactRs(belowThree.varianceAmount)}`,
  );

  const b3Cols: PdfCol[] = [
    { label: 'Type', width: 15, align: 'center' },
    { label: 'Officer Name', width: 46 },
    { label: 'B3 Accts', width: 22, align: 'right' },
    { label: 'Paid', width: 20, align: 'right' },
    { label: 'Not Paid', width: 22, align: 'right' },
    { label: 'Paid %', width: 20, align: 'right' },
    { label: 'Target / Due', width: 34, align: 'right' },
    { label: 'Collected', width: 34, align: 'right' },
    { label: 'Variance', width: 32, align: 'right' },
    { label: 'Coll %', width: 16, align: 'right' },
    { label: 'Need', width: 12, align: 'right' },
  ];

  const b3Rows: { cells: string[]; highlight?: 'subtotal' | 'total' }[] = belowThree.byOfficer.map(
    (o) => ({
      cells: [
        o.role,
        o.officer,
        o.totalCount.toLocaleString(),
        o.paidCount.toLocaleString(),
        o.notPaidCount.toLocaleString(),
        `${o.paidRatioPct.toFixed(1)}%`,
        formatCompactRs(o.dueAmount),
        formatCompactRs(o.collectedAmount),
        formatCompactRs(o.varianceAmount),
        `${o.collectionPct.toFixed(1)}%`,
        o.contractsNeededAgainstDue.toLocaleString(),
      ],
    }),
  );

  b3Rows.push({
    highlight: 'total',
    cells: [
      'ALL',
      'BRANCH BELOW 3 TOTAL',
      belowThree.totalCount.toLocaleString(),
      belowThree.paidCount.toLocaleString(),
      belowThree.notPaidCount.toLocaleString(),
      `${belowThree.paidRatioPct.toFixed(1)}%`,
      formatCompactRs(belowThree.dueAmount),
      formatCompactRs(belowThree.collectedAmount),
      formatCompactRs(belowThree.varianceAmount),
      `${belowThree.collectionPct.toFixed(1)}%`,
      belowThree.contractsNeededAgainstDue.toLocaleString(),
    ],
  });

  drawTable(b3Cols, b3Rows, '2. Below 3 Collection & Variance');

  // Section 3: Age Bucket Distribution
  drawSectionHeading(
    '3. Branch Portfolio Age Bucket Distribution ([A] – [I])',
    `Full Branch Exposure Breakdown`,
  );

  const abTotalCount = ageBuckets.reduce((s, b) => s + b.count, 0);
  const abTotalDeb = ageBuckets.reduce((s, b) => s + b.closingDebtor, 0);
  const abTotalNpl = ageBuckets.reduce((s, b) => s + b.nplAmount, 0);
  const abCols: PdfCol[] = [
    { label: 'Code', width: 22, align: 'center' },
    { label: 'Age Bucket', width: 52 },
    { label: 'Contracts', width: 32, align: 'right' },
    { label: 'Share %', width: 28, align: 'right' },
    { label: 'Closing Debtor', width: 52, align: 'right' },
    { label: 'NPL Exposure', width: 52, align: 'right' },
    { label: 'NPL (Rs. M)', width: 35, align: 'right' },
  ];

  const abRows: { cells: string[]; highlight?: 'total' }[] = ageBuckets.map((b) => ({
    cells: [
      b.code,
      b.label,
      b.count.toLocaleString(),
      abTotalCount > 0 ? `${((b.count / abTotalCount) * 100).toFixed(1)}%` : '0.0%',
      formatCurrencyRs(b.closingDebtor),
      formatCurrencyRs(b.nplAmount),
      `${b.nplMillions.toFixed(2)}M`,
    ],
  }));
  abRows.push({
    highlight: 'total',
    cells: [
      'TOTAL',
      'All Portfolio Buckets',
      abTotalCount.toLocaleString(),
      '100.0%',
      formatCurrencyRs(abTotalDeb),
      formatCurrencyRs(abTotalNpl),
      `${(abTotalNpl / 1_000_000).toFixed(2)}M`,
    ],
  });

  drawTable(abCols, abRows, '3. Branch Age Buckets');

  // Section 4: Top Priority Borderline & Worst Case Accounts
  const topPriority = [
    ...borderline.accounts.slice(0, 20).map((a) => ({
      cat: a.riskTier.includes('91+') ? '91+ Danger' : 'Borderline',
      contractNo: a.contractNo,
      cusName: a.cusName,
      role: getNormalizedOfficerRole(a.officeType),
      officer: a.officer,
      dpd: `${a.actualDpd}d`,
      closingNpl: a.npl,
      debtor: a.closingDebtor,
      minSave: a.minToSave,
      efforts: a.assignOfficerEfforts,
    })),
    ...worstRecords.slice(0, 15).map((w) => ({
      cat: 'WORST (W)',
      contractNo: w.contractNo,
      cusName: w.cusName,
      role: getNormalizedOfficerRole(w.officeType),
      officer: getOfficerByOfficeType(w),
      dpd: `${w.actualDpd}d`,
      closingNpl: w.npl,
      debtor: w.closingDebtor,
      minSave: w.minAmountToReverseNpl || w.currentMonthDue || 0,
      efforts: w.assignOfficerEfforts,
    })),
  ];

  if (topPriority.length > 0) {
    drawSectionHeading(
      '4. Priority Action Watchlist — Top Borderline & Worst Case (W) Contracts',
      `Showing top ${topPriority.length} priority accounts (full list included in All-in-One Excel)`,
    );
    const prCols: PdfCol[] = [
      { label: 'Category', width: 25 },
      { label: 'Contract No', width: 32 },
      { label: 'Customer Name', width: 52 },
      { label: 'Type', width: 14, align: 'center' },
      { label: 'Assigned Officer', width: 34 },
      { label: 'DPD', width: 16, align: 'right' },
      { label: 'Closing NPL', width: 30, align: 'right' },
      { label: 'Debtor', width: 30, align: 'right' },
      { label: 'Min Save', width: 26, align: 'right' },
      { label: 'Efforts', width: 14, align: 'right' },
    ];
    const prRows = topPriority.map((p) => ({
      cells: [
        p.cat,
        p.contractNo,
        p.cusName,
        p.role === 'OTHER' ? '—' : p.role,
        p.officer,
        p.dpd,
        formatCompactRs(p.closingNpl),
        formatCompactRs(p.debtor),
        formatCompactRs(p.minSave),
        String(p.efforts),
      ],
    }));
    drawTable(prCols, prRows, '4. Priority Action Watchlist');
  }

  // Add consistent page footer numbers across every page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(228, 228, 231);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageH - 10, pageW - marginX, pageH - 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(113, 113, 122);
    doc.text(
      `WG Pulse · Commercial Credit Branch Recovery Intelligence · Reconciled Full Portfolio`,
      marginX,
      pageH - 5.5,
    );
    doc.text(`Page ${p} of ${totalPages}`, pageW - marginX, pageH - 5.5, {
      align: 'right',
    });
  }

  const blob = doc.output('blob');
  const fileName = `WG_Pulse_AllInOne_Report_${ds.dateStamp}.pdf`;
  return { blob, fileName, dataset: ds };
}

export function downloadAllInOnePdfReport(input: AllInOneReportInput): {
  fileName: string;
} {
  const { blob, fileName } = buildAllInOnePdfArtifact(input);
  triggerBlobDownload(blob, fileName);
  return { fileName };
}

export function buildAllInOneExecutiveText(input: AllInOneReportInput): string {
  const ds = buildAllInOneReportDataset(input);
  const { branchTotals, roPerf, moPerf, belowThree, borderline, worstRecords } = ds;
  const netMovement = branchTotals.totalClosingNpl - branchTotals.totalOpNpl;

  const lines: string[] = [
    `*WG PULSE — ALL-IN-ONE BRANCH RECOVERY REPORT*`,
    `Snapshot: ${ds.snapshotLabel}`,
    ``,
    `*1. BRANCH PORTFOLIO (RO + MO)*`,
    `• Total Branch Contracts: *${branchTotals.totalContracts.toLocaleString()}*`,
    `• Recovery Officers (RO): *${branchTotals.roContractsCount.toLocaleString()}* accts (${branchTotals.roOfficerCount} ROs)`,
    `• Marketing Officers (MO): *${branchTotals.moContractsCount.toLocaleString()}* accts (${branchTotals.moOfficerCount} MOs)`,
    `• Below 1 (90 Ratio): *${branchTotals.ratio90Pct.toFixed(1)}%* (${branchTotals.belowOneCount.toLocaleString()} / ${branchTotals.totalContracts.toLocaleString()} · Need ${branchTotals.neededFor90})`,
    ``,
    `*2. NPL POSITION*`,
    `• Opening NPL: ${formatCompactRs(branchTotals.totalOpNpl)} (${branchTotals.openingNplCount} accts)`,
    `• Closing NPL: *${formatCompactRs(branchTotals.totalClosingNpl)}* (${branchTotals.closingNplCount} accts)`,
    `• Net Movement: *${netMovement <= 0 ? '-' : '+'}${formatCompactRs(Math.abs(netMovement))}* (${netMovement <= 0 ? 'Reduced' : 'Increased'})`,
    ``,
    `*3. BELOW 3 COLLECTION & VARIANCE*`,
    `• Target / Due: ${formatCompactRs(belowThree.dueAmount)}`,
    `• Actual Collected: *${formatCompactRs(belowThree.collectedAmount)}* (${belowThree.collectionPct.toFixed(1)}%)`,
    `• Variance to Collect: *${formatCompactRs(belowThree.varianceAmount)}*`,
    `• Below 3 Accounts: ${belowThree.totalCount.toLocaleString()} (Paid ${belowThree.paidCount.toLocaleString()} · Not Paid ${belowThree.notPaidCount.toLocaleString()})`,
    ``,
    `*4. PRIORITY RISK RADAR*`,
    `• Borderline (61-90 DPD): *${borderline.totalCount}* accts (Min Save: ${formatCompactRs(borderline.totalMinToSave)} · 0-Eff: ${borderline.zeroEffortCount})`,
    `• Worst Case (W): *${worstRecords.length}* accts (NPL: ${formatCompactRs(worstRecords.reduce((s, r) => s + (r.npl || 0), 0))})`,
  ];

  if (roPerf.length > 0) {
    lines.push(``, `*RO — RECOVERY OFFICERS*`);
    for (const o of roPerf) {
      const r90 =
        typeof o.ratio90Pct === 'number'
          ? o.ratio90Pct
          : o.totalCount > 0
            ? (o.belowOneCount / o.totalCount) * 100
            : 0;
      lines.push(
        `• ${o.officer}: ${o.totalCount.toLocaleString()} accts | 90R ${r90.toFixed(1)}% | NPL ${formatCompactRs(o.closingNpl)}`,
      );
    }
  }

  if (moPerf.length > 0) {
    lines.push(``, `*MO — MARKETING OFFICERS*`);
    for (const o of moPerf) {
      const r90 =
        typeof o.ratio90Pct === 'number'
          ? o.ratio90Pct
          : o.totalCount > 0
            ? (o.belowOneCount / o.totalCount) * 100
            : 0;
      lines.push(
        `• ${o.officer}: ${o.totalCount.toLocaleString()} accts | 90R ${r90.toFixed(1)}% | NPL ${formatCompactRs(o.closingNpl)}`,
      );
    }
  }

  return lines.join('\n');
}

export async function shareAllInOneReport(
  input: AllInOneReportInput,
  mode: 'whatsapp' | 'native_excel' | 'native_pdf' | 'copy',
): Promise<{ title: string; detail: string; tone: 'success' | 'info' | 'error' }> {
  const summaryText = buildAllInOneExecutiveText(input);

  if (mode === 'copy') {
    const ok = await copyTextSafe(summaryText);
    return ok
      ? {
          title: 'Executive Summary Copied',
          detail: 'All-in-One Branch Report summary copied to clipboard — ready to paste in WhatsApp or email.',
          tone: 'success',
        }
      : {
          title: 'Clipboard Unavailable',
          detail: 'Could not copy automatically. Try downloading the Excel or PDF pack instead.',
          tone: 'error',
        };
  }

  if (mode === 'whatsapp') {
    const url = `https://wa.me/?text=${encodeURIComponent(summaryText)}`;
    openExternalLinkSafe(url);
    return {
      title: 'Opening WhatsApp Share',
      detail: 'All-in-One Branch Recovery Report formatted for WhatsApp.',
      tone: 'success',
    };
  }

  // Native Web Share API with file attachment (mobile/PWA/modern browsers) + clean fallback
  const artifact =
    mode === 'native_pdf'
      ? buildAllInOnePdfArtifact(input)
      : buildAllInOneExcelArtifact(input);

  const file = new File([artifact.blob], artifact.fileName, {
    type: artifact.blob.type,
  });

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        title: `WG Pulse All-in-One Report (${artifact.dataset.snapshotLabel})`,
        text: summaryText,
        files: [file],
      });
      return {
        title: 'All-in-One Report Shared',
        detail: `Shared ${artifact.fileName} via native share sheet.`,
        tone: 'success',
      };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return {
          title: 'Share Cancelled',
          detail: 'Native share was cancelled.',
          tone: 'info',
        };
      }
      // Fall through to download + clipboard copy
    }
  }

  triggerBlobDownload(artifact.blob, artifact.fileName);
  await copyTextSafe(summaryText);
  return {
    title: 'Report Downloaded & Summary Copied',
    detail: `Saved ${artifact.fileName} and copied the WhatsApp summary so you can attach & send immediately.`,
    tone: 'success',
  };
}
