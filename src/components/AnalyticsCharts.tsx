import { useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  BarChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  CheckCircle2,
  Edit3,
  Flag,
  Layers,
  PieChart,
  Plus,
  ShieldAlert,
  Target,
  Trash2,
} from 'lucide-react';
import type {
  AersMetadata,
  AersRecord,
  MonthlySnapshot,
} from '../types/recovery';
import {
  formatCompactRs,
  formatCurrencyRs,
  getCapitalNplExposure,
  getSavedNplCapitalValue,
  getTodayISO,
  isBorderlineNplAccount,
  isCurrentNplAccount,
  isFallenNplAccount,
  isNplSavedAccount,
} from '../utils/recoveryEngine';

interface AnalyticsChartsProps {
  aersRecords: AersRecord[];
  aersMeta?: AersMetadata | null;
  snapshots: MonthlySnapshot[];
  isDark: boolean;
  showSnapshotLedger?: boolean;
  animKey?: number;
  onAddSnapshot: (snapshot: MonthlySnapshot) => void;
  onUpdateSnapshot: (snapshot: MonthlySnapshot) => void;
  onDeleteSnapshot: (id: string) => void;
}

// Helper functions for SVG polar coordinate mathematics
function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function describeDonutSegment(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number,
) {
  const p1 = polarToCartesian(cx, cy, rOuter, startAngle);
  const p2 = polarToCartesian(cx, cy, rOuter, endAngle);
  const p3 = polarToCartesian(cx, cy, rInner, endAngle);
  const p4 = polarToCartesian(cx, cy, rInner, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArcFlag} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rInner} ${rInner} 0 ${largeArcFlag} 0 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ');
}

export function AnalyticsCharts({
  aersRecords = [],
  aersMeta = null,
  snapshots,
  isDark,
  showSnapshotLedger = false,
  animKey = 0,
  onAddSnapshot,
  onUpdateSnapshot,
  onDeleteSnapshot,
}: AnalyticsChartsProps) {
  const [editingSnapshot, setEditingSnapshot] =
    useState<MonthlySnapshot | null>(null);
  const [isAddingSnapshot, setIsAddingSnapshot] = useState(false);

  // Chart Type toggles for split Debtor & NPL cards
  const [debtorChartType, setDebtorChartType] = useState<'paired' | 'area'>('paired');
  const [nplChartType, setNplChartType] = useState<'paired' | 'area'>('paired');

  // State for Target Gauge
  const [targetAmount, setTargetAmount] = useState<number>(15_000_000);

  // State for Borderline vs. Classified NPL Risk (Doughnut Gauge vs Bar Chart)
  const [riskViewType, setRiskViewType] = useState<'doughnut' | 'bar'>('doughnut');
  const [riskBarGranularity, setRiskBarGranularity] = useState<'summary' | 'tiers'>('summary');
  const [riskMetricMode, setRiskMetricMode] = useState<'exposure' | 'count'>('exposure');
  const [hoveredRiskSegment, setHoveredRiskSegment] = useState<'all' | 'borderline' | 'classified'>('all');

  const [formLabel, setFormLabel] = useState('');
  const [formDate, setFormDate] = useState(getTodayISO());
  const [formDebtor, setFormDebtor] = useState('0');
  const [formNpl, setFormNpl] = useState('0');
  const [formSaved, setFormSaved] = useState('0');
  const [formNewNpl, setFormNewNpl] = useState('0');
  const [formCollPct, setFormCollPct] = useState('80');

  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#1e293b' : '#e2e8f0';
  const tooltipBg = isDark ? '#0f172a' : '#ffffff';
  const tooltipBorder = isDark ? '#334155' : '#e2e8f0';

  // Live AERS NPL Saved vs Fallen NPL calculation
  const liveAersSaved = aersRecords.filter((r) =>
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
  const liveAersSavedAmt = liveAersSaved.reduce(
    (s, r) => s + getSavedNplCapitalValue(r),
    0,
  );
  const liveAersFallen = aersRecords.filter((r) => isFallenNplAccount(r));
  const liveAersFallenAmt = liveAersFallen.reduce(
    (s, r) => s + getCapitalNplExposure(r),
    0,
  );

  // Live Opening vs Closing portfolio metrics (reconciled with BM Dashboard)
  const liveOpDebtorAmt = aersRecords.reduce((s, r) => s + (r.opBalDebtor || 0), 0);
  const liveClosingDebtorAmt = aersRecords.reduce((s, r) => s + (r.closingDebtor || 0), 0);
  const liveOpNplAmt = aersRecords.reduce((s, r) => s + (r.opNpl || 0), 0);
  const liveClosingNplAmt = aersRecords.reduce((s, r) => s + (r.npl || 0), 0);

  const debtorMovement = liveClosingDebtorAmt - liveOpDebtorAmt;
  const nplMovement = liveClosingNplAmt - liveOpNplAmt;

  const activeSavedCount = liveAersSaved.length;
  const activeSavedAmt = liveAersSavedAmt;
  const activeFallenCount = liveAersFallen.length;
  const activeFallenAmt = liveAersFallenAmt;

  // Trend Data with BOTH Opening and Closing values
  const trendChartData =
    snapshots.length > 0
      ? snapshots.map((s, idx) => {
          const isLast = idx === snapshots.length - 1;
          const hasLive = aersRecords.length > 0;
          const opDebtor = isLast && hasLive && liveOpDebtorAmt > 0 ? liveOpDebtorAmt : s.trackedDebtor * 1.03;
          const closingDebtor = isLast && hasLive ? liveClosingDebtorAmt : s.trackedDebtor;
          const opNpl =
            s.openingNpl && s.openingNpl > 0
              ? s.openingNpl
              : isLast && hasLive && liveOpNplAmt > 0
                ? liveOpNplAmt
                : s.trackedNpl * 1.15;
          const closingNpl = isLast && hasLive ? liveClosingNplAmt : s.trackedNpl;
          const savedAmt = isLast && hasLive ? activeSavedAmt : s.nplSavedAmount;
          const fallenAmt = isLast && hasLive ? activeFallenAmt : s.newNplAmount;
          return {
            ...s,
            opDebtor,
            closingDebtor,
            debtorDiff: closingDebtor - opDebtor,
            opNpl,
            closingNpl,
            nplDiff: closingNpl - opNpl,
            savedAmt,
            fallenAmt,
            collectionPct: s.collectionPct,
          };
        })
      : aersRecords.length > 0
        ? [
            {
              label: 'Opening 1st',
              opDebtor: liveOpDebtorAmt || liveClosingDebtorAmt * 1.04,
              closingDebtor: liveOpDebtorAmt || liveClosingDebtorAmt * 1.04,
              debtorDiff: 0,
              opNpl: liveOpNplAmt || (liveClosingNplAmt ? liveClosingNplAmt * 1.2 : 7_500_000),
              closingNpl: liveOpNplAmt || (liveClosingNplAmt ? liveClosingNplAmt * 1.2 : 7_500_000),
              nplDiff: 0,
              savedAmt: Math.max(800_000, activeSavedAmt * 0.25),
              fallenAmt: Math.max(1_200_000, activeFallenAmt * 0.4),
              collectionPct: 62,
            },
            {
              label: 'Mid-Month 15th',
              opDebtor: liveOpDebtorAmt || liveClosingDebtorAmt * 1.04,
              closingDebtor: liveClosingDebtorAmt * 1.02,
              debtorDiff: liveClosingDebtorAmt * 1.02 - (liveOpDebtorAmt || liveClosingDebtorAmt * 1.04),
              opNpl: liveOpNplAmt || (liveClosingNplAmt ? liveClosingNplAmt * 1.2 : 7_500_000),
              closingNpl: liveOpNplAmt ? liveOpNplAmt * 1.05 : 6_200_000,
              nplDiff: (liveOpNplAmt ? liveOpNplAmt * 1.05 : 6_200_000) - (liveOpNplAmt || 7_500_000),
              savedAmt: Math.max(2_200_000, activeSavedAmt * 0.65),
              fallenAmt: Math.max(1_800_000, activeFallenAmt * 0.75),
              collectionPct: 75,
            },
            {
              label: 'Live (Today)',
              opDebtor: liveOpDebtorAmt || liveClosingDebtorAmt * 1.04,
              closingDebtor: liveClosingDebtorAmt,
              debtorDiff: liveClosingDebtorAmt - (liveOpDebtorAmt || liveClosingDebtorAmt * 1.04),
              opNpl: liveOpNplAmt || (liveClosingNplAmt ? liveClosingNplAmt * 1.2 : 7_500_000),
              closingNpl: liveClosingNplAmt,
              nplDiff: liveClosingNplAmt - (liveOpNplAmt || (liveClosingNplAmt ? liveClosingNplAmt * 1.2 : 7_500_000)),
              savedAmt: activeSavedAmt,
              fallenAmt: activeFallenAmt,
              collectionPct: 82,
            },
          ]
        : [];

  const maxDebtorVal = trendChartData.reduce(
    (m, d) => Math.max(m, d.opDebtor || 0, d.closingDebtor || 0),
    0,
  );
  const maxNplVal = trendChartData.reduce(
    (m, d) => Math.max(m, d.opNpl || 0, d.closingNpl || 0, d.savedAmt || 0),
    0,
  );

  const formatAxisRs = (val: number, maxRef: number) => {
    if (maxRef >= 1_000_000) {
      return `${(val / 1_000_000).toFixed(1)}M`;
    }
    if (maxRef >= 1_000) {
      return `${Math.round(val / 1_000)}K`;
    }
    return `${val}`;
  };

  const openEditSnapshot = (snap: MonthlySnapshot) => {
    setIsAddingSnapshot(false);
    setEditingSnapshot(snap);
    setFormLabel(snap.label);
    setFormDate(snap.snapshotDate);
    setFormDebtor(String(snap.trackedDebtor));
    setFormNpl(String(snap.trackedNpl));
    setFormSaved(String(snap.nplSavedAmount));
    setFormNewNpl(String(snap.newNplAmount));
    setFormCollPct(String(snap.collectionPct));
  };

  const openNewSnapshot = () => {
    setEditingSnapshot(null);
    setIsAddingSnapshot(true);
    const now = new Date();
    setFormLabel(
      now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    );
    setFormDate(getTodayISO());
    setFormDebtor(String(Math.round(liveClosingDebtorAmt)));
    setFormNpl(String(Math.round(liveClosingNplAmt)));
    setFormSaved(String(Math.round(liveAersSavedAmt)));
    setFormNewNpl(String(Math.round(liveAersFallenAmt)));
    const bmRatio = aersMeta?.bmBranchSnapshot?.ratio90Pct;
    setFormCollPct(String(bmRatio !== undefined ? Math.round(bmRatio) : 80));
  };

  const handleSaveSnapshotForm = (e: React.FormEvent) => {
    e.preventDefault();
    const bm = aersMeta?.bmBranchSnapshot;
    const payload: MonthlySnapshot = {
      id: editingSnapshot ? editingSnapshot.id : `snap_${Date.now()}`,
      label: formLabel.trim() || formDate.slice(5),
      snapshotDate: formDate || getTodayISO(),
      uploadedAt: new Date().toISOString(),
      trackedCount: editingSnapshot?.trackedCount ?? aersRecords.length,
      trackedDebtor: Number(formDebtor) || 0,
      openingNpl: editingSnapshot?.openingNpl ?? liveOpNplAmt,
      openingNplCount:
        editingSnapshot?.openingNplCount ??
        aersRecords.filter((r) => (r.opNpl || 0) > 0).length,
      trackedNpl: Number(formNpl) || 0,
      closingNplCount:
        editingSnapshot?.closingNplCount ??
        aersRecords.filter((r) => (r.npl || 0) > 0).length,
      nplSavedAmount: Number(formSaved) || 0,
      nplSavedCount: editingSnapshot?.nplSavedCount ?? liveAersSaved.length,
      newNplAmount: Number(formNewNpl) || 0,
      fallenNplCount: editingSnapshot?.fallenNplCount ?? liveAersFallen.length,
      belowOneCount: editingSnapshot?.belowOneCount ?? bm?.belowOneCount,
      totalPortfolioCount: editingSnapshot?.totalPortfolioCount ?? bm?.totalContracts,
      ratio90Pct: editingSnapshot?.ratio90Pct ?? bm?.ratio90Pct,
      collectionPct: Number(formCollPct) || 0,
      sourceFile: editingSnapshot?.sourceFile ?? 'Manual Entry',
    };

    if (editingSnapshot) {
      onUpdateSnapshot(payload);
    } else {
      onAddSnapshot(payload);
    }
    setEditingSnapshot(null);
    setIsAddingSnapshot(false);
  };

  const netSavedVsFallen = activeSavedAmt - activeFallenAmt;

  // Borderline vs. Classified NPL Calculations (Direct AERS)
  const aersClassified = aersRecords.filter((r) =>
    isCurrentNplAccount({ npl: r.npl, actualDpd: r.actualDpd }),
  );
  const aersClassifiedAmt = aersClassified.reduce(
    (s, r) => s + getCapitalNplExposure(r),
    0,
  );
  const aersBorderline = aersRecords.filter((r) =>
    isBorderlineNplAccount({
      actualDpd: r.actualDpd,
      opAge: r.opAge,
      currentAge: r.currentAge,
      monthEndForecastDpd: r.monthEndForecastDpd,
      opNpl: r.opNpl,
      npl: r.npl,
      totalCollection: r.totalCollection,
      lastPaidAmount: r.lastPaidAmount,
    }),
  );
  const aersBorderlineAmt = aersBorderline.reduce(
    (s, r) => s + getCapitalNplExposure(r),
    0,
  );

  const activeClassifiedCount = aersClassified.length;
  const activeClassifiedAmt = aersClassifiedAmt;
  const activeBorderlineCount = aersBorderline.length;
  const activeBorderlineAmt = aersBorderlineAmt;

  const totalRiskExposure = activeClassifiedAmt + activeBorderlineAmt;
  const totalRiskCount = activeClassifiedCount + activeBorderlineCount;

  const isCountMode = riskMetricMode === 'count';
  const classifiedMetricVal = isCountMode ? activeClassifiedCount : activeClassifiedAmt;
  const borderlineMetricVal = isCountMode ? activeBorderlineCount : activeBorderlineAmt;
  const totalMetricVal = isCountMode ? totalRiskCount : totalRiskExposure;

  const classifiedRatio =
    totalMetricVal > 0 ? classifiedMetricVal / totalMetricVal : 0.58;
  const borderlineRatio =
    totalMetricVal > 0 ? borderlineMetricVal / totalMetricVal : 0.42;

  const classifiedPct = Math.round(classifiedRatio * 100);
  const borderlinePct = 100 - classifiedPct;

  const doughnutCx = 140;
  const doughnutCy = 112;
  const doughnutROuter = 78;
  const doughnutRInner = 52;

  const totalDoughnutArc = 348;
  const minDoughnutSpan = 18;
  const maxDoughnutSpan = totalDoughnutArc - minDoughnutSpan;
  const rawBorderlineSpan = Math.round(borderlineRatio * totalDoughnutArc);
  const borderlineSpan = Math.max(minDoughnutSpan, Math.min(maxDoughnutSpan, rawBorderlineSpan));
  const classifiedSpan = totalDoughnutArc - borderlineSpan;

  const borderlineStartAngle = -87;
  const borderlineEndAngle = borderlineStartAngle + borderlineSpan;
  const classifiedStartAngle = borderlineEndAngle + 6;
  const classifiedEndAngle = classifiedStartAngle + classifiedSpan;

  const sourceRecords = aersRecords;

  const tier60_75 = sourceRecords.filter((r) => {
    const dpd = r.actualDpd || 0;
    const npl = r.npl || 0;
    return dpd >= 60 && dpd <= 75 && npl === 0;
  });
  const tier60_75Amt = tier60_75.reduce((s, r) => s + getCapitalNplExposure(r), 0);

  const tier76_90 = sourceRecords.filter((r) => {
    const dpd = r.actualDpd || 0;
    const npl = r.npl || 0;
    return dpd > 75 && dpd <= 90 && npl === 0;
  });
  const tier76_90Amt = tier76_90.reduce((s, r) => s + getCapitalNplExposure(r), 0);

  const tier91_120 = sourceRecords.filter((r) => {
    const dpd = r.actualDpd || 0;
    const npl = r.npl || 0;
    return (dpd >= 91 && dpd <= 120) || (npl > 0 && dpd <= 120);
  });
  const tier91_120Amt = tier91_120.reduce((s, r) => s + getCapitalNplExposure(r), 0);

  const tier120Plus = sourceRecords.filter((r) => {
    const dpd = r.actualDpd || 0;
    const npl = r.npl || 0;
    return dpd > 120 || (npl > 0 && dpd > 120);
  });
  const tier120PlusAmt = tier120Plus.reduce((s, r) => s + getCapitalNplExposure(r), 0);

  const riskBarSummaryData = [
    {
      name: 'Borderline',
      shortLabel: 'Borderline',
      fullName: 'Borderline NPL (60–90 DPD)',
      value: isCountMode ? activeBorderlineCount : activeBorderlineAmt,
      amount: activeBorderlineAmt,
      count: activeBorderlineCount,
      pct: borderlinePct,
      type: 'borderline',
      fill: 'url(#riskBarBorderlineGrad)',
      stroke: '#f59e0b',
    },
    {
      name: 'Classified NPL',
      shortLabel: 'Classified',
      fullName: 'Classified NPL (91+ DPD)',
      value: isCountMode ? activeClassifiedCount : activeClassifiedAmt,
      amount: activeClassifiedAmt,
      count: activeClassifiedCount,
      pct: classifiedPct,
      type: 'classified',
      fill: 'url(#riskBarClassifiedGrad)',
      stroke: '#f43f5e',
    },
  ];

  const riskBarTiersData = [
    {
      name: '60–75 DPD',
      shortLabel: '60–75',
      fullName: 'Early Borderline (60–75 DPD)',
      value: isCountMode ? tier60_75.length : tier60_75Amt,
      amount: tier60_75Amt,
      count: tier60_75.length,
      pct: totalMetricVal > 0 ? Math.round(((isCountMode ? tier60_75.length : tier60_75Amt) / totalMetricVal) * 100) : 25,
      type: 'borderline',
      fill: '#fbbf24',
      stroke: '#f59e0b',
    },
    {
      name: '76–90 DPD',
      shortLabel: '76–90',
      fullName: 'Critical Borderline (76–90 DPD)',
      value: isCountMode ? tier76_90.length : tier76_90Amt,
      amount: tier76_90Amt,
      count: tier76_90.length,
      pct: totalMetricVal > 0 ? Math.round(((isCountMode ? tier76_90.length : tier76_90Amt) / totalMetricVal) * 100) : 25,
      type: 'borderline',
      fill: '#f59e0b',
      stroke: '#d97706',
    },
    {
      name: '91–120 DPD',
      shortLabel: '91–120',
      fullName: 'Classified Stage 3 (91–120 DPD)',
      value: isCountMode ? tier91_120.length : tier91_120Amt,
      amount: tier91_120Amt,
      count: tier91_120.length,
      pct: totalMetricVal > 0 ? Math.round(((isCountMode ? tier91_120.length : tier91_120Amt) / totalMetricVal) * 100) : 25,
      type: 'classified',
      fill: '#fb7185',
      stroke: '#f43f5e',
    },
    {
      name: '120+ DPD',
      shortLabel: '120+',
      fullName: 'Hardcore NPL (120+ DPD)',
      value: isCountMode ? tier120Plus.length : tier120PlusAmt,
      amount: tier120PlusAmt,
      count: tier120Plus.length,
      pct: totalMetricVal > 0 ? Math.round(((isCountMode ? tier120Plus.length : tier120PlusAmt) / totalMetricVal) * 100) : 25,
      type: 'classified',
      fill: '#e11d48',
      stroke: '#be123c',
    },
  ];

  const activeRiskBarData =
    riskBarGranularity === 'tiers' ? riskBarTiersData : riskBarSummaryData;

  const maxRiskBarVal = activeRiskBarData.reduce(
    (m, d) => Math.max(m, d.value || 0),
    0,
  );

  // Target Gauge Calculations
  const targetMaxScale = Math.max(targetAmount * 1.35, activeSavedAmt * 1.15, 20_000_000);
  const targetPctOfScale = Math.min(1, targetAmount / targetMaxScale);
  const savedPctOfScale = Math.min(1, activeSavedAmt / targetMaxScale);
  const targetAchievedPct = Math.round((activeSavedAmt / Math.max(1, targetAmount)) * 100);

  const gaugeArcAngleStart = 160;
  const gaugeArcTotal = 220;
  const gaugeTargetAngle = gaugeArcAngleStart + targetPctOfScale * gaugeArcTotal;
  const gaugeTargetPoint = polarToCartesian(140, 130, 88, gaugeTargetAngle);
  const gaugeTargetInner = polarToCartesian(140, 130, 68, gaugeTargetAngle);

  const CustomizedMilestoneDot = (props: any) => {
    const { cx, cy, index } = props;
    if (!cx || !cy) return null;
    const milestoneTexts = [
      'Nov 1 Launch',
      'Mid-Review',
      'Today Telemetry',
      'Target Zone',
    ];
    const text = milestoneTexts[index % milestoneTexts.length];
    return (
      <g key={`milestone_${index}`}>
        <circle cx={cx} cy={cy} r={5} fill="#10b981" stroke="#ffffff" strokeWidth={2} />
        <text
          x={cx}
          y={cy - 12}
          textAnchor="middle"
          fill={isDark ? '#34d399' : '#047857'}
          fontSize={10}
          fontWeight="bold"
        >
          {text}
        </text>
      </g>
    );
  };

  return (
    <div key={animKey} className="space-y-6">
      {/* SECTION 1: Split Debtor Trend & NPL Trend (2 Dedicated Cards with Charts + Tables) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* CARD 1A: Monthly Debtor Trend (Opening vs. Closing) + Debtor Table */}
        <div
          style={{ animationDelay: '50ms' }}
          className="animate-fade-slide-up bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-lg shadow-slate-900/5 flex flex-col justify-between space-y-4"
        >
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  Monthly Debtor Trend (Opening vs. Closing)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Opening Balance Debtor vs. Closing Debtor Portfolio Progression
                </p>
              </div>

              <div className="inline-flex items-center gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-950 rounded-lg text-[10px]">
                <button
                  type="button"
                  onClick={() => setDebtorChartType('paired')}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 font-medium rounded whitespace-nowrap transition-colors ${
                    debtorChartType === 'paired'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <BarChart3 className="w-3 h-3 text-blue-500" />
                  Bars
                </button>
                <button
                  type="button"
                  onClick={() => setDebtorChartType('area')}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 font-medium rounded whitespace-nowrap transition-colors ${
                    debtorChartType === 'area'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3 h-3 text-indigo-500" />
                  Area
                </button>
              </div>
            </div>

            <div className="h-52 w-full">
              {trendChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl px-4">
                  No debtor data yet. Upload an AERS Excel file to populate portfolio trends.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={trendChartData}
                    margin={{ top: 12, right: 12, left: -10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="splitOpDebtorBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.75} />
                      </linearGradient>
                      <linearGradient id="splitClosingDebtorBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.85} />
                      </linearGradient>
                      <linearGradient id="splitOpDebtorAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="splitClosingDebtorAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: axisColor, fontSize: 10, fontWeight: 500 }}
                      axisLine={{ stroke: gridColor }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: axisColor, fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      domain={[0, Math.ceil((maxDebtorVal * 1.15) / 5_000_000) * 5_000_000 || 50_000_000]}
                      tickFormatter={(v) => `${(Number(v) / 1_000_000).toFixed(0)}M`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: tooltipBg,
                        borderColor: tooltipBorder,
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12)',
                        fontSize: '11px',
                      }}
                      formatter={(value: unknown, name: unknown) => [
                        formatCurrencyRs(Number(value) || 0),
                        String(name),
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} />

                    {debtorChartType === 'paired' ? (
                      <>
                        <Bar
                          dataKey="opDebtor"
                          name="Opening Debtor"
                          fill="url(#splitOpDebtorBarGrad)"
                          stroke="#3b82f6"
                          strokeWidth={1}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={28}
                        />
                        <Bar
                          dataKey="closingDebtor"
                          name="Closing Debtor"
                          fill="url(#splitClosingDebtorBarGrad)"
                          stroke="#1d4ed8"
                          strokeWidth={1}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={28}
                        />
                      </>
                    ) : (
                      <>
                        <Area
                          type="monotone"
                          dataKey="opDebtor"
                          name="Opening Debtor"
                          stroke="#60a5fa"
                          strokeWidth={1.5}
                          strokeDasharray="3 3"
                          fillOpacity={1}
                          fill="url(#splitOpDebtorAreaGrad)"
                        />
                        <Area
                          type="monotone"
                          dataKey="closingDebtor"
                          name="Closing Debtor"
                          stroke="#2563eb"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#splitClosingDebtorAreaGrad)"
                        />
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Debtor Summary Strip + Dedicated Debtor Table */}
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-3 gap-2 text-[11px] tabular-nums">
              <div className="bg-blue-50/60 dark:bg-blue-950/20 p-2 rounded-lg border border-blue-100 dark:border-blue-900/40">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px]">
                  Opening Debtor
                </span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                  {formatCompactRs(liveOpDebtorAmt)}
                </span>
              </div>
              <div className="bg-blue-50/60 dark:bg-blue-950/20 p-2 rounded-lg border border-blue-100 dark:border-blue-900/40">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px]">
                  Closing Debtor
                </span>
                <span className="font-mono font-bold text-blue-700 dark:text-blue-300">
                  {formatCompactRs(liveClosingDebtorAmt)}
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200/80 dark:border-slate-800 text-right">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px]">
                  Debtor Variance
                </span>
                <span
                  className={`font-mono font-bold ${
                    debtorMovement <= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-blue-600 dark:text-blue-400'
                  }`}
                >
                  {debtorMovement >= 0 ? '+' : ''}
                  {formatCompactRs(debtorMovement)}
                </span>
              </div>
            </div>

            {trendChartData.length > 0 && (
              <div className="overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                      <th className="py-2 px-3">Period</th>
                      <th className="py-2 px-3 text-right">Opening Debtor</th>
                      <th className="py-2 px-3 text-right">Closing Debtor</th>
                      <th className="py-2 px-3 text-right">Net Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 tabular-nums font-mono">
                    {trendChartData.map((row, i) => (
                      <tr key={`debtor_tbl_${i}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                        <td className="py-1.5 px-3 font-sans font-medium text-slate-800 dark:text-slate-200">
                          {row.label}
                        </td>
                        <td className="py-1.5 px-3 text-right text-slate-600 dark:text-slate-300">
                          {formatCurrencyRs(row.opDebtor)}
                        </td>
                        <td className="py-1.5 px-3 text-right font-semibold text-blue-700 dark:text-blue-400">
                          {formatCurrencyRs(row.closingDebtor)}
                        </td>
                        <td
                          className={`py-1.5 px-3 text-right font-semibold ${
                            row.debtorDiff <= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          {row.debtorDiff >= 0 ? '+' : ''}
                          {formatCompactRs(row.debtorDiff)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* CARD 1B: Monthly NPL Trend (Opening vs. Closing & Saved) + NPL Table */}
        <div
          style={{ animationDelay: '90ms' }}
          className="animate-fade-slide-up bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-lg shadow-slate-900/5 flex flex-col justify-between space-y-4"
        >
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-rose-600" />
                  Monthly NPL Trend (Opening vs. Closing &amp; Saved)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Opening NPL vs. Closing NPL &amp; Recovered NPL Saved Progression
                </p>
              </div>

              <div className="inline-flex items-center gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-950 rounded-lg text-[10px]">
                <button
                  type="button"
                  onClick={() => setNplChartType('paired')}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 font-medium rounded whitespace-nowrap transition-colors ${
                    nplChartType === 'paired'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <BarChart3 className="w-3 h-3 text-rose-500" />
                  Bars
                </button>
                <button
                  type="button"
                  onClick={() => setNplChartType('area')}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 font-medium rounded whitespace-nowrap transition-colors ${
                    nplChartType === 'area'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3 h-3 text-emerald-500" />
                  Area
                </button>
              </div>
            </div>

            <div className="h-52 w-full">
              {trendChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl px-4">
                  No NPL data yet. Upload an AERS Excel file to populate NPL progression.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={trendChartData}
                    margin={{ top: 12, right: 12, left: -10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="splitOpNplBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fb7185" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.75} />
                      </linearGradient>
                      <linearGradient id="splitClosingNplBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#e11d48" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#be123c" stopOpacity={0.85} />
                      </linearGradient>
                      <linearGradient id="splitSavedBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#047857" stopOpacity={0.8} />
                      </linearGradient>
                      <linearGradient id="splitClosingNplAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: axisColor, fontSize: 10, fontWeight: 500 }}
                      axisLine={{ stroke: gridColor }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: axisColor, fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      domain={[0, Math.ceil((maxNplVal * 1.25) / 1_000_000) * 1_000_000 || 10_000_000]}
                      tickFormatter={(v) => `${(Number(v) / 1_000_000).toFixed(1)}M`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: tooltipBg,
                        borderColor: tooltipBorder,
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12)',
                        fontSize: '11px',
                      }}
                      formatter={(value: unknown, name: unknown) => [
                        formatCurrencyRs(Number(value) || 0),
                        String(name),
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} />

                    {nplChartType === 'paired' ? (
                      <>
                        <Bar
                          dataKey="opNpl"
                          name="Opening NPL"
                          fill="url(#splitOpNplBarGrad)"
                          stroke="#f43f5e"
                          strokeWidth={1}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={24}
                        />
                        <Bar
                          dataKey="closingNpl"
                          name="Closing NPL"
                          fill="url(#splitClosingNplBarGrad)"
                          stroke="#be123c"
                          strokeWidth={1}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={24}
                        />
                        <Bar
                          dataKey="savedAmt"
                          name="NPL Saved"
                          fill="url(#splitSavedBarGrad)"
                          stroke="#10b981"
                          strokeWidth={1}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={24}
                        />
                      </>
                    ) : (
                      <>
                        <Area
                          type="monotone"
                          dataKey="closingNpl"
                          name="Closing NPL"
                          stroke="#e11d48"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#splitClosingNplAreaGrad)"
                        />
                        <Line
                          type="monotone"
                          dataKey="savedAmt"
                          name="NPL Saved"
                          stroke="#10b981"
                          strokeWidth={2.5}
                          dot={<CustomizedMilestoneDot />}
                          activeDot={{ r: 7, fill: '#10b981' }}
                        />
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* NPL Summary Strip + Dedicated NPL Table */}
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-3 gap-2 text-[11px] tabular-nums">
              <div className="bg-rose-50/60 dark:bg-rose-950/20 p-2 rounded-lg border border-rose-100 dark:border-rose-900/40">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px]">
                  Opening NPL
                </span>
                <span className="font-mono font-bold text-rose-500 dark:text-rose-400">
                  {formatCompactRs(liveOpNplAmt)}
                </span>
              </div>
              <div className="bg-rose-50/60 dark:bg-rose-950/20 p-2 rounded-lg border border-rose-100 dark:border-rose-900/40">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px]">
                  Closing NPL
                </span>
                <span className="font-mono font-bold text-rose-700 dark:text-rose-300">
                  {formatCompactRs(liveClosingNplAmt)}
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200/80 dark:border-slate-800 text-right">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px]">
                  NPL Net Movement
                </span>
                <span
                  className={`font-mono font-bold ${
                    nplMovement <= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {nplMovement > 0 ? '+' : ''}
                  {formatCompactRs(nplMovement)}
                </span>
              </div>
            </div>

            {trendChartData.length > 0 && (
              <div className="overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                      <th className="py-2 px-3">Period</th>
                      <th className="py-2 px-3 text-right">Opening NPL</th>
                      <th className="py-2 px-3 text-right">Closing NPL</th>
                      <th className="py-2 px-3 text-right">NPL Saved</th>
                      <th className="py-2 px-3 text-right">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 tabular-nums font-mono">
                    {trendChartData.map((row, i) => (
                      <tr key={`npl_tbl_${i}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                        <td className="py-1.5 px-3 font-sans font-medium text-slate-800 dark:text-slate-200">
                          {row.label}
                        </td>
                        <td className="py-1.5 px-3 text-right text-slate-600 dark:text-slate-300">
                          {formatCurrencyRs(row.opNpl)}
                        </td>
                        <td className="py-1.5 px-3 text-right font-semibold text-rose-600 dark:text-rose-400">
                          {formatCurrencyRs(row.closingNpl)}
                        </td>
                        <td className="py-1.5 px-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatCompactRs(row.savedAmt)}
                        </td>
                        <td
                          className={`py-1.5 px-3 text-right font-semibold ${
                            row.nplDiff <= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {row.nplDiff > 0 ? '+' : ''}
                          {formatCompactRs(row.nplDiff)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 2: Target Gauge & 91-DPD Risk Gauge (2 Side-by-Side Cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 2: NPL Saved vs. Fallen NPL - Gauge with a Target */}
        <div
          style={{ animationDelay: '130ms' }}
          className="animate-fade-slide-up bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-lg shadow-slate-900/5 flex flex-col justify-between"
        >
          <div>
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-emerald-500" />
                  NPL Saved vs. Fallen (Target Gauge)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Executive Recovery Gauge against Monthly Branch Target · Direct AERS Master
                </p>
              </div>
            </div>

            {/* Target Amount Quick Selector */}
            <div className="flex items-center justify-between text-[11px] mb-2 px-1">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Branch Target:</span>
              <div className="inline-flex items-center gap-1">
                {[10_000_000, 12_000_000, 15_000_000, 20_000_000].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTargetAmount(t)}
                    className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                      targetAmount === t
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {t / 1_000_000}M
                  </button>
                ))}
              </div>
            </div>

            {/* SVG Gauge with Target Arc & Marker */}
            <div className="py-2 flex flex-col items-center justify-center relative">
              <div className="relative w-64 h-36 flex items-center justify-center">
                <svg className="w-full h-full" viewBox="0 0 280 160">
                  <defs>
                    <linearGradient id="gaugeTargetGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="70%" stopColor="#059669" />
                      <stop offset="100%" stopColor="#34d399" />
                    </linearGradient>
                  </defs>

                  <path
                    d={describeDonutSegment(140, 130, 88, 70, 160, 380)}
                    className="fill-slate-200 dark:fill-slate-800"
                  />

                  {savedPctOfScale > 0 && (
                    <path
                      d={describeDonutSegment(
                        140,
                        130,
                        88,
                        70,
                        160,
                        160 + savedPctOfScale * 220,
                      )}
                      fill="url(#gaugeTargetGrad)"
                      className="transition-all duration-1000 ease-out"
                    />
                  )}

                  <line
                    x1={gaugeTargetInner.x}
                    y1={gaugeTargetInner.y}
                    x2={gaugeTargetPoint.x}
                    y2={gaugeTargetPoint.y}
                    stroke="#ffffff"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    className="filter drop-shadow"
                  />

                  <circle
                    cx={gaugeTargetPoint.x}
                    cy={gaugeTargetPoint.y}
                    r="4"
                    fill="#f59e0b"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                  <text
                    x={gaugeTargetPoint.x}
                    y={gaugeTargetPoint.y - 8}
                    textAnchor="middle"
                    className="fill-amber-500 dark:fill-amber-400 font-bold font-mono text-[9px]"
                  >
                    TARGET {formatCompactRs(targetAmount)}
                  </text>
                </svg>

                <div className="absolute top-16 inset-x-0 flex flex-col items-center justify-center text-center tabular-nums">
                  <span className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
                    {formatCompactRs(activeSavedAmt)}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {targetAchievedPct}% Achieved
                  </span>
                </div>
              </div>

              <div className="mt-1 flex items-center justify-center">
                {activeSavedAmt >= targetAmount ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    Target Exceeded (+{formatCompactRs(activeSavedAmt - targetAmount)})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-medium rounded-full bg-amber-50 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    <Flag className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    Gap: {formatCompactRs(targetAmount - activeSavedAmt)} to Target
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-2 pt-2.5 border-t border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-2 text-[11px] tabular-nums">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">
                Saved ({activeSavedCount})
              </span>
              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                {formatCompactRs(activeSavedAmt)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">
                Fallen ({activeFallenCount})
              </span>
              <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                {formatCompactRs(activeFallenAmt)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 dark:text-slate-400 block">
                Net Impact
              </span>
              <span
                className={`font-mono font-semibold ${
                  netSavedVsFallen >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {netSavedVsFallen >= 0 ? '+' : ''}
                {formatCompactRs(netSavedVsFallen)}
              </span>
            </div>
          </div>
        </div>

        {/* CHART 3: 91-DPD Risk Gauge - Animated SVG Doughnut Gauge (Borderline vs. Classified NPL) */}
        <div
          style={{ animationDelay: '170ms' }}
          className="animate-fade-slide-up bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-lg shadow-slate-900/5 flex flex-col justify-between"
        >
          <div>
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  91-DPD Risk: Borderline vs. Classified NPL
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {riskViewType === 'bar' ? 'Executive Risk Distribution Bar Chart' : 'Animated SVG Doughnut Gauge'} · Severity Telemetry
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <div className="inline-flex items-center gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-950 rounded-lg text-[10px]">
                  <button
                    type="button"
                    onClick={() => setRiskViewType('bar')}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 font-medium rounded whitespace-nowrap transition-colors ${
                      riskViewType === 'bar'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <BarChart3 className="w-3 h-3 text-amber-500" />
                    Bar Chart
                  </button>
                  <button
                    type="button"
                    onClick={() => setRiskViewType('doughnut')}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 font-medium rounded whitespace-nowrap transition-colors ${
                      riskViewType === 'doughnut'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <PieChart className="w-3 h-3 text-rose-500" />
                    Doughnut
                  </button>
                </div>

                <div className="inline-flex items-center gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-950 rounded-md shrink-0 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setRiskMetricMode('exposure')}
                    className={`px-2 py-0.5 font-medium rounded whitespace-nowrap transition-colors ${
                      riskMetricMode === 'exposure'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    Exposure
                  </button>
                  <button
                    type="button"
                    onClick={() => setRiskMetricMode('count')}
                    className={`px-2 py-0.5 font-medium rounded whitespace-nowrap transition-colors ${
                      riskMetricMode === 'count'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    Accounts
                  </button>
                </div>
              </div>
            </div>

            {riskViewType === 'bar' ? (
              <div className="flex items-center justify-between text-[11px] mb-1 px-1">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Bar Breakdown:</span>
                <div className="inline-flex items-center gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setRiskBarGranularity('summary')}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      riskBarGranularity === 'summary'
                        ? 'bg-slate-200 dark:bg-slate-700 font-semibold text-slate-900 dark:text-slate-100'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Summary (2 Bars)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRiskBarGranularity('tiers')}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      riskBarGranularity === 'tiers'
                        ? 'bg-slate-200 dark:bg-slate-700 font-semibold text-slate-900 dark:text-slate-100'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    DPD Tiers (4 Bands)
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between text-[11px] mb-1 px-1">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Risk Focus:</span>
                <div className="inline-flex items-center gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setHoveredRiskSegment('all')}
                    className={`px-1.5 py-0.5 rounded transition-colors ${
                      hoveredRiskSegment === 'all'
                        ? 'bg-slate-200 dark:bg-slate-700 font-semibold text-slate-900 dark:text-slate-100'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Combined
                  </button>
                  <button
                    type="button"
                    onClick={() => setHoveredRiskSegment('borderline')}
                    className={`px-1.5 py-0.5 rounded transition-colors ${
                      hoveredRiskSegment === 'borderline'
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold'
                        : 'text-slate-500 dark:text-slate-400 hover:text-amber-600'
                    }`}
                  >
                    Borderline
                  </button>
                  <button
                    type="button"
                    onClick={() => setHoveredRiskSegment('classified')}
                    className={`px-1.5 py-0.5 rounded transition-colors ${
                      hoveredRiskSegment === 'classified'
                        ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 font-bold'
                        : 'text-slate-500 dark:text-slate-400 hover:text-rose-600'
                    }`}
                  >
                    Classified
                  </button>
                </div>
              </div>
            )}

            {riskViewType === 'bar' ? (
              <div className="py-1">
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={activeRiskBarData}
                      margin={{ top: 22, right: 12, left: -14, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="riskBarBorderlineGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.95} />
                          <stop offset="100%" stopColor="#d97706" stopOpacity={0.8} />
                        </linearGradient>
                        <linearGradient id="riskBarClassifiedGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.95} />
                          <stop offset="100%" stopColor="#be123c" stopOpacity={0.8} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                      <XAxis
                        dataKey="shortLabel"
                        tick={{ fill: axisColor, fontSize: 11, fontWeight: 600 }}
                        axisLine={{ stroke: gridColor }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: axisColor, fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => (isCountMode ? `${v}` : formatAxisRs(Number(v), maxRiskBarVal))}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: tooltipBg,
                          borderColor: tooltipBorder,
                          borderRadius: '12px',
                          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                          fontSize: '11px',
                        }}
                        formatter={(val: unknown, _name: unknown, item: any) => [
                          `${isCountMode ? `${val} Contracts` : formatCurrencyRs(Number(val) || 0)} (${item.payload.pct}%)`,
                          item.payload.fullName || 'Risk Exposure',
                        ]}
                      />
                      <Bar
                        dataKey="value"
                        name={isCountMode ? 'Contracts' : 'Exposure'}
                        radius={[8, 8, 0, 0]}
                        maxBarSize={riskBarGranularity === 'summary' ? 56 : 38}
                      >
                        {activeRiskBarData.map((entry, index) => (
                          <Cell
                            key={`risk_cell_${index}`}
                            fill={entry.fill}
                            stroke={entry.stroke}
                            strokeWidth={1.5}
                            className="transition-all duration-300 hover:opacity-85"
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-1 flex items-center justify-center">
                  {classifiedPct >= 60 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                      CRITICAL 91+ DOMINANT ({classifiedPct}%)
                    </span>
                  ) : borderlinePct >= 50 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                      ELEVATED BORDERLINE EXPOSURE ({borderlinePct}%)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 text-slate-800 dark:bg-slate-800/80 dark:text-slate-300">
                      BALANCED RISK POSTURE
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-1 flex flex-col items-center justify-center relative">
                <div className="relative w-64 h-52 flex items-center justify-center">
                  <div className="absolute inset-5 rounded-full border border-dashed border-amber-500/20 dark:border-amber-400/15 animate-radar-spin pointer-events-none" />

                  <svg className="w-full h-full" viewBox="0 0 280 230">
                    <defs>
                      <linearGradient id="shimmerBorderlineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#d97706" stopOpacity="0.95" />
                        <stop offset="25%" stopColor="#f59e0b" stopOpacity="1" />
                        <stop offset="50%" stopColor="#fef08a" stopOpacity="1">
                          <animate
                            attributeName="offset"
                            values="0.05; 0.95; 0.05"
                            dur="2.6s"
                            repeatCount="indefinite"
                          />
                        </stop>
                        <stop offset="75%" stopColor="#f59e0b" stopOpacity="1" />
                        <stop offset="100%" stopColor="#b45309" stopOpacity="0.95" />
                      </linearGradient>

                      <linearGradient id="shimmerClassifiedGrad" x1="100%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#be123c" stopOpacity="0.95" />
                        <stop offset="25%" stopColor="#e11d48" stopOpacity="1" />
                        <stop offset="50%" stopColor="#ffe4e6" stopOpacity="1">
                          <animate
                            attributeName="offset"
                            values="0.95; 0.05; 0.95"
                            dur="2.1s"
                            repeatCount="indefinite"
                          />
                        </stop>
                        <stop offset="75%" stopColor="#f43f5e" stopOpacity="1" />
                        <stop offset="100%" stopColor="#881337" stopOpacity="0.95" />
                      </linearGradient>
                    </defs>

                    <circle
                      cx={doughnutCx}
                      cy={doughnutCy}
                      r={doughnutROuter + 8}
                      fill="none"
                      stroke={isDark ? '#1e293b' : '#e2e8f0'}
                      strokeWidth="1"
                      strokeDasharray="3 5"
                    />

                    <circle
                      cx={doughnutCx}
                      cy={doughnutCy}
                      r={doughnutRInner - 6}
                      fill="none"
                      stroke={isDark ? '#334155' : '#cbd5e1'}
                      strokeWidth="1"
                      strokeDasharray="2 4"
                      opacity="0.5"
                    />

                    <path
                      d={describeDonutSegment(doughnutCx, doughnutCy, doughnutROuter, doughnutRInner, 0, 359.99)}
                      className="fill-slate-100 dark:fill-slate-800/60"
                    />

                    <path
                      d={describeDonutSegment(
                        doughnutCx,
                        doughnutCy,
                        doughnutROuter,
                        doughnutRInner,
                        borderlineStartAngle,
                        borderlineEndAngle,
                      )}
                      fill="url(#shimmerBorderlineGrad)"
                      stroke={hoveredRiskSegment === 'borderline' ? '#fef08a' : '#d97706'}
                      strokeWidth={hoveredRiskSegment === 'borderline' ? 2 : 0.5}
                      opacity={hoveredRiskSegment === 'classified' ? 0.35 : 1}
                      className="cursor-pointer transition-all duration-500 ease-out hover:opacity-100"
                      onMouseEnter={() => setHoveredRiskSegment('borderline')}
                      onMouseLeave={() => setHoveredRiskSegment('all')}
                    />

                    <path
                      d={describeDonutSegment(
                        doughnutCx,
                        doughnutCy,
                        doughnutROuter,
                        doughnutRInner,
                        classifiedStartAngle,
                        classifiedEndAngle,
                      )}
                      fill="url(#shimmerClassifiedGrad)"
                      stroke={hoveredRiskSegment === 'classified' ? '#ffe4e6' : '#be123c'}
                      strokeWidth={hoveredRiskSegment === 'classified' ? 2 : 0.5}
                      opacity={hoveredRiskSegment === 'borderline' ? 0.35 : 1}
                      className="cursor-pointer transition-all duration-500 ease-out hover:opacity-100"
                      onMouseEnter={() => setHoveredRiskSegment('classified')}
                      onMouseLeave={() => setHoveredRiskSegment('all')}
                    />

                    <g>
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from={`0 ${doughnutCx} ${doughnutCy}`}
                        to={`360 ${doughnutCx} ${doughnutCy}`}
                        dur="3.8s"
                        repeatCount="indefinite"
                      />
                      <circle
                        cx={doughnutCx}
                        cy={doughnutCy - doughnutROuter - 8}
                        r="3.5"
                        fill="#ffffff"
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                        className="filter drop-shadow"
                      />
                    </g>
                  </svg>

                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center tabular-nums pointer-events-none px-4">
                    {hoveredRiskSegment === 'borderline' ? (
                      <>
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 tracking-wider uppercase">
                          Borderline Risk
                        </span>
                        <span className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 leading-tight">
                          {isCountMode ? `${activeBorderlineCount}` : formatCompactRs(activeBorderlineAmt)}
                        </span>
                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                          {borderlinePct}% · {isCountMode ? formatCompactRs(activeBorderlineAmt) : `${activeBorderlineCount} Accts`}
                        </span>
                        <span className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Pre-91 DPD · Salvageable
                        </span>
                      </>
                    ) : hoveredRiskSegment === 'classified' ? (
                      <>
                        <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 tracking-wider uppercase">
                          Classified NPL
                        </span>
                        <span className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 leading-tight">
                          {isCountMode ? `${activeClassifiedCount}` : formatCompactRs(activeClassifiedAmt)}
                        </span>
                        <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                          {classifiedPct}% · {isCountMode ? formatCompactRs(activeClassifiedAmt) : `${activeClassifiedCount} Accts`}
                        </span>
                        <span className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Stage 3 · Hardcore 91+
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
                          High Risk Total
                        </span>
                        <span className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 leading-tight">
                          {isCountMode ? `${totalRiskCount} Accts` : formatCompactRs(totalRiskExposure)}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold mt-0.5">
                          <span className="text-amber-600 dark:text-amber-400">{borderlinePct}% Bdr</span>
                          <span className="text-slate-300 dark:text-slate-700">·</span>
                          <span className="text-rose-600 dark:text-rose-400">{classifiedPct}% NPL</span>
                        </div>
                        <span className="text-[9px] text-slate-500 dark:text-slate-400">
                          {isCountMode ? formatCompactRs(totalRiskExposure) : `${totalRiskCount} At-Risk Contracts`}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-0.5 flex items-center justify-center">
                  {classifiedPct >= 60 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                      CRITICAL 91+ DOMINANT ({classifiedPct}%)
                    </span>
                  ) : borderlinePct >= 50 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                      ELEVATED BORDERLINE EXPOSURE ({borderlinePct}%)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 text-slate-800 dark:bg-slate-800/80 dark:text-slate-300">
                      BALANCED RISK POSTURE
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-2 pt-2.5 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs tabular-nums">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div
                onClick={() => setHoveredRiskSegment((prev) => (prev === 'borderline' ? 'all' : 'borderline'))}
                className={`p-2 rounded-xl cursor-pointer transition-all ${
                  hoveredRiskSegment === 'borderline'
                    ? 'ring-2 ring-amber-500 bg-amber-100/90 dark:bg-amber-950/60'
                    : 'bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 hover:bg-amber-100/50'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] text-amber-800 dark:text-amber-300 mb-0.5">
                  <span className="font-semibold">Borderline (2.01–2.99)</span>
                  <span className="font-mono font-bold">{borderlinePct}%</span>
                </div>
                <div className="font-mono font-bold text-amber-900 dark:text-amber-200 text-sm">
                  {formatCompactRs(activeBorderlineAmt)}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {activeBorderlineCount} Accounts · Pre-91 DPD
                </div>
              </div>

              <div
                onClick={() => setHoveredRiskSegment((prev) => (prev === 'classified' ? 'all' : 'classified'))}
                className={`p-2 rounded-xl cursor-pointer transition-all ${
                  hoveredRiskSegment === 'classified'
                    ? 'ring-2 ring-rose-500 bg-rose-100/90 dark:bg-rose-950/60'
                    : 'bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/60 hover:bg-rose-100/50'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] text-rose-800 dark:text-rose-300 mb-0.5">
                  <span className="font-semibold">Classified NPL (3.00+)</span>
                  <span className="font-mono font-bold">{classifiedPct}%</span>
                </div>
                <div className="font-mono font-bold text-rose-900 dark:text-rose-200 text-sm">
                  {formatCompactRs(activeClassifiedAmt)}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {activeClassifiedCount} Accounts · 91+ DPD
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-amber-500 animate-stripe-flow transition-all duration-700 ease-out"
                  style={{ width: `${borderlinePct}%` }}
                  title={`Borderline: ${borderlinePct}% (${formatCompactRs(activeBorderlineAmt)})`}
                />
                <div
                  className="h-full bg-rose-500 animate-stripe-flow transition-all duration-700 ease-out"
                  style={{ width: `${classifiedPct}%` }}
                  title={`Classified NPL: ${classifiedPct}% (${formatCompactRs(activeClassifiedAmt)})`}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                <span>Salvageable Pre-NPL: {borderlinePct}%</span>
                <span>Hardcore NPL: {classifiedPct}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: Monthly Snapshots Ledger */}
      {showSnapshotLedger && (
        <div
          style={{ animationDelay: '220ms' }}
          className="animate-fade-slide-up bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-lg shadow-slate-900/5 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Daily &amp; Monthly Snapshots Ledger (Last Upload Locked Per Day)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Same-day AERS uploads update today&apos;s snapshot with the latest file; uploading on a new day locks the previous day&apos;s final upload and starts a new daily record.
              </p>
            </div>

            <button
              type="button"
              onClick={openNewSnapshot}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Daily Snapshot
            </button>
          </div>

          {(isAddingSnapshot || editingSnapshot) && (
            <form
              onSubmit={handleSaveSnapshotForm}
              className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-4 text-xs"
            >
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                {editingSnapshot ? 'Edit Daily Snapshot' : 'New Daily Snapshot Entry'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                    Label
                  </label>
                  <input
                    type="text"
                    value={formLabel}
                    onChange={(e) => setFormLabel(e.target.value)}
                    placeholder="e.g. Nov 30"
                    required
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                    Snapshot Date
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                    Closing Debtor (Rs.)
                  </label>
                  <input
                    type="number"
                    value={formDebtor}
                    onChange={(e) => setFormDebtor(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                    Closing NPL (Rs.)
                  </label>
                  <input
                    type="number"
                    value={formNpl}
                    onChange={(e) => setFormNpl(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                    NPL Saved (Rs.)
                  </label>
                  <input
                    type="number"
                    value={formSaved}
                    onChange={(e) => setFormSaved(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                    Collection / 90 Ratio %
                  </label>
                  <input
                    type="number"
                    value={formCollPct}
                    onChange={(e) => setFormCollPct(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingSnapshot(null);
                    setIsAddingSnapshot(false);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Save Snapshot
                </button>
              </div>
            </form>
          )}

          {snapshots.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              No saved snapshots yet. Upload an AERS workbook or click Add Daily Snapshot above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 font-semibold text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-4">Snapshot &amp; Last File</th>
                    <th className="py-2.5 px-3">Date &amp; Time</th>
                    <th className="py-2.5 px-3 text-right">Opening NPL</th>
                    <th className="py-2.5 px-3 text-right">Closing NPL</th>
                    <th className="py-2.5 px-3 text-right">NPL Saved</th>
                    <th className="py-2.5 px-3 text-right">90 Ratio / Coll</th>
                    <th className="py-2.5 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                  {snapshots.map((snap) => (
                    <tr
                      key={snap.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                        {snap.label}
                        <span className="block text-[10px] font-normal text-slate-500 dark:text-slate-400">
                          {snap.sourceFile || 'Manual Entry'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                        <div>{snap.snapshotDate}</div>
                        {snap.uploadedAt && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">
                            {new Date(snap.uploadedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                        <div>{snap.openingNpl !== undefined ? formatCompactRs(snap.openingNpl) : '—'}</div>
                        {snap.openingNplCount !== undefined && (
                          <div className="text-[10px] text-slate-500">{snap.openingNplCount} accts</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-600 dark:text-rose-400 font-semibold">
                        <div>{formatCompactRs(snap.trackedNpl)}</div>
                        {snap.closingNplCount !== undefined && (
                          <div className="text-[10px] text-rose-500/80">{snap.closingNplCount} accts</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        {formatCompactRs(snap.nplSavedAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {snap.ratio90Pct !== undefined ? (
                          <div>
                            <div>{snap.ratio90Pct.toFixed(1)}% (90R)</div>
                            <div className="text-[10px] text-slate-500 font-normal">
                              Coll {snap.collectionPct}%
                            </div>
                          </div>
                        ) : (
                          `${snap.collectionPct}%`
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditSnapshot(snap)}
                            aria-label="Edit snapshot"
                            className="p-1 rounded text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteSnapshot(snap.id)}
                            aria-label="Delete snapshot"
                            className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
