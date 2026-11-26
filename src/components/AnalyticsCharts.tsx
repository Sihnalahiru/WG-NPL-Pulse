import { useState } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
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
  Gauge,
  Layers,
  PieChart,
  Plus,
  ShieldAlert,
  Target,
  Trash2,
} from 'lucide-react';
import type {
  AersRecord,
  MonthlySnapshot,
  TrackedContract,
  VisitWithOption,
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
  contracts: TrackedContract[];
  aersRecords?: AersRecord[];
  snapshots: MonthlySnapshot[];
  isDark: boolean;
  showSnapshotLedger?: boolean;
  animKey?: number;
  onAddSnapshot: (snapshot: MonthlySnapshot) => void;
  onUpdateSnapshot: (snapshot: MonthlySnapshot) => void;
  onDeleteSnapshot: (id: string) => void;
}

const VISIT_OPTIONS: VisitWithOption[] = [
  'My Self',
  'Mr. Damith',
  'BM',
  'Marketing',
];

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
  contracts,
  aersRecords = [],
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

  const [savedScope, setSavedScope] = useState<'aers' | 'tracked'>(
    aersRecords.length > 0 ? 'aers' : 'tracked',
  );
  const effectiveSavedScope: 'aers' | 'tracked' =
    savedScope === 'aers' && aersRecords.length > 0 ? 'aers' : 'tracked';

  // State for Series Filter and Chart Type in Multi-KPI chart (Opening & Closing)
  const [seriesFilter, setSeriesFilter] = useState<'all' | 'debtor' | 'npl' | 'saved'>('all');
  const [trendChartType, setTrendChartType] = useState<'paired' | 'area'>('paired');

  // State for Target Gauge
  const [targetAmount, setTargetAmount] = useState<number>(15_000_000); // Default branch recovery target Rs. 15.0M

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

  // Live Watchlist NPL Saved vs Fallen NPL calculation
  const liveWatchlistSaved = contracts.filter((c) => isNplSavedAccount(c));
  const liveWatchlistSavedAmt = liveWatchlistSaved.reduce(
    (s, c) => s + getSavedNplCapitalValue(c),
    0,
  );
  const liveWatchlistFallen = contracts.filter((c) => isFallenNplAccount(c));
  const liveWatchlistFallenAmt = liveWatchlistFallen.reduce(
    (s, c) => s + getCapitalNplExposure(c),
    0,
  );

  // Live AERS NPL Saved vs Fallen NPL calculation (when AERS master is loaded)
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

  // Live Opening vs Closing portfolio metrics
  const liveOpDebtorAmt =
    effectiveSavedScope === 'aers'
      ? aersRecords.reduce((s, r) => s + (r.opBalDebtor || 0), 0)
      : contracts.reduce((s, c) => s + (c.opBalDebtor || 0), 0);

  const liveClosingDebtorAmt =
    effectiveSavedScope === 'aers'
      ? aersRecords.reduce((s, r) => s + (r.closingDebtor || 0), 0)
      : contracts.reduce((s, c) => s + (c.closingDebtor || 0), 0);

  const liveOpNplAmt =
    effectiveSavedScope === 'aers'
      ? aersRecords.reduce((s, r) => s + (r.opNpl || 0), 0)
      : contracts.reduce((s, c) => s + (c.opNpl || 0), 0);

  const liveClosingNplAmt =
    effectiveSavedScope === 'aers'
      ? aersRecords.reduce((s, r) => s + (r.npl || 0), 0)
      : contracts.reduce((s, c) => s + (c.npl || 0), 0);

  const debtorMovement = liveClosingDebtorAmt - liveOpDebtorAmt;
  const nplMovement = liveClosingNplAmt - liveOpNplAmt;

  const activeSavedCount =
    effectiveSavedScope === 'aers'
      ? liveAersSaved.length
      : liveWatchlistSaved.length;
  const activeSavedAmt =
    effectiveSavedScope === 'aers' ? liveAersSavedAmt : liveWatchlistSavedAmt;
  const activeFallenCount =
    effectiveSavedScope === 'aers'
      ? liveAersFallen.length
      : liveWatchlistFallen.length;
  const activeFallenAmt =
    effectiveSavedScope === 'aers'
      ? liveAersFallenAmt
      : liveWatchlistFallenAmt;

  // Multiple KPI Series Trend Data with BOTH Opening and Closing values
  const trendChartData =
    snapshots.length > 0
      ? snapshots.map((s, idx) => {
          const isLast = idx === snapshots.length - 1;
          const hasLive =
            effectiveSavedScope === 'aers'
              ? aersRecords.length > 0
              : contracts.length > 0;
          return {
            ...s,
            opDebtor: s.trackedDebtor * 1.03,
            closingDebtor: isLast && hasLive ? liveClosingDebtorAmt : s.trackedDebtor,
            opNpl: s.trackedNpl * 1.15,
            closingNpl: isLast && hasLive ? liveClosingNplAmt : s.trackedNpl,
            savedAmt: isLast && hasLive ? activeSavedAmt : s.nplSavedAmount,
            fallenAmt: isLast && hasLive ? activeFallenAmt : s.newNplAmount,
            collectionPct: s.collectionPct,
          };
        })
      : contracts.length > 0 || aersRecords.length > 0
        ? [
            {
              label: 'Opening 1st',
              opDebtor: liveOpDebtorAmt || liveClosingDebtorAmt * 1.04,
              closingDebtor: liveOpDebtorAmt || liveClosingDebtorAmt * 1.04,
              opNpl: liveOpNplAmt || (liveClosingNplAmt ? liveClosingNplAmt * 1.2 : 7_500_000),
              closingNpl: liveOpNplAmt || (liveClosingNplAmt ? liveClosingNplAmt * 1.2 : 7_500_000),
              savedAmt: Math.max(800_000, activeSavedAmt * 0.25),
              fallenAmt: Math.max(1_200_000, activeFallenAmt * 0.4),
              collectionPct: 62,
            },
            {
              label: 'Mid-Month 15th',
              opDebtor: liveOpDebtorAmt || liveClosingDebtorAmt * 1.04,
              closingDebtor: liveClosingDebtorAmt * 1.02,
              opNpl: liveOpNplAmt || (liveClosingNplAmt ? liveClosingNplAmt * 1.2 : 7_500_000),
              closingNpl: (liveOpNplAmt ? liveOpNplAmt * 1.05 : 6_200_000),
              savedAmt: Math.max(2_200_000, activeSavedAmt * 0.65),
              fallenAmt: Math.max(1_800_000, activeFallenAmt * 0.75),
              collectionPct: 75,
            },
            {
              label: 'Live (Today)',
              opDebtor: liveOpDebtorAmt || liveClosingDebtorAmt * 1.04,
              closingDebtor: liveClosingDebtorAmt,
              opNpl: liveOpNplAmt || (liveClosingNplAmt ? liveClosingNplAmt * 1.2 : 7_500_000),
              closingNpl: liveClosingNplAmt,
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

  // Compute Visit Effectiveness Breakdown across tracked contracts & visit histories
  const visitStats = VISIT_OPTIONS.map((option) => {
    const matchingContracts = contracts.filter(
      (c) =>
        c.visitWith === option ||
        c.visitHistory.some((h) => h.visitWith === option),
    );
    const totalVisits = contracts.reduce((sum, c) => {
      const logsCount = c.visitHistory.filter(
        (h) => h.visitWith === option,
      ).length;
      if (logsCount > 0) return sum + logsCount;
      return c.visitWith === option ? sum + 1 : sum;
    }, 0);

    const savedOrPositive = matchingContracts.filter(
      (c) =>
        isNplSavedAccount(c) ||
        c.currentSituation === 'Settled' ||
        (c.lastPaidAmount > 0 && c.actualDpd < 91),
    ).length;

    const successRate =
      matchingContracts.length > 0
        ? Math.round((savedOrPositive / matchingContracts.length) * 100)
        : 0;

    return {
      option,
      contractsCount: matchingContracts.length,
      totalVisits,
      savedOrPositive,
      successRate,
    };
  });

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
    setFormDebtor(String(liveClosingDebtorAmt));
    setFormNpl(String(liveClosingNplAmt));
    setFormSaved(String(liveWatchlistSavedAmt));
    setFormNewNpl(String(liveWatchlistFallenAmt));
    setFormCollPct('82');
  };

  const handleSaveSnapshotForm = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: MonthlySnapshot = {
      id: editingSnapshot ? editingSnapshot.id : `snap_${Date.now()}`,
      label: formLabel.trim() || formDate.slice(5),
      snapshotDate: formDate || getTodayISO(),
      trackedCount: editingSnapshot?.trackedCount ?? contracts.length,
      trackedDebtor: Number(formDebtor) || 0,
      trackedNpl: Number(formNpl) || 0,
      nplSavedAmount: Number(formSaved) || 0,
      nplSavedCount: editingSnapshot?.nplSavedCount ?? liveWatchlistSaved.length,
      newNplAmount: Number(formNewNpl) || 0,
      fallenNplCount:
        editingSnapshot?.fallenNplCount ?? liveWatchlistFallen.length,
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
  const saveRatePct = Math.round(
    (activeSavedCount / Math.max(1, activeSavedCount + activeFallenCount)) * 100,
  );

  // Borderline vs. Classified NPL Calculations
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

  const trackedClassified = contracts.filter((c) => isCurrentNplAccount(c));
  const trackedClassifiedAmt = trackedClassified.reduce(
    (s, c) => s + getCapitalNplExposure(c),
    0,
  );
  const trackedBorderline = contracts.filter((c) =>
    isBorderlineNplAccount(c, c.mrp),
  );
  const trackedBorderlineAmt = trackedBorderline.reduce(
    (s, c) => s + getCapitalNplExposure(c),
    0,
  );

  const activeClassified =
    effectiveSavedScope === 'aers' ? aersClassified : trackedClassified;
  const activeClassifiedCount = activeClassified.length;
  const activeClassifiedAmt =
    effectiveSavedScope === 'aers' ? aersClassifiedAmt : trackedClassifiedAmt;

  const activeBorderline =
    effectiveSavedScope === 'aers' ? aersBorderline : trackedBorderline;
  const activeBorderlineCount = activeBorderline.length;
  const activeBorderlineAmt =
    effectiveSavedScope === 'aers' ? aersBorderlineAmt : trackedBorderlineAmt;

  const totalRiskExposure = activeClassifiedAmt + activeBorderlineAmt;
  const totalRiskCount = activeClassifiedCount + activeBorderlineCount;

  // Metric selection for doughnut distribution (Exposure Rs. vs Account Count)
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

  // 360° Circular Doughnut Geometry with 6° gaps
  const doughnutCx = 140;
  const doughnutCy = 112;
  const doughnutROuter = 78;
  const doughnutRInner = 52;

  const totalDoughnutArc = 348; // 360° minus 2 * 6° gap
  const minDoughnutSpan = 18;
  const maxDoughnutSpan = totalDoughnutArc - minDoughnutSpan;
  const rawBorderlineSpan = Math.round(borderlineRatio * totalDoughnutArc);
  const borderlineSpan = Math.max(minDoughnutSpan, Math.min(maxDoughnutSpan, rawBorderlineSpan));
  const classifiedSpan = totalDoughnutArc - borderlineSpan;

  // Borderline segment: starts at top (-87°)
  const borderlineStartAngle = -87;
  const borderlineEndAngle = borderlineStartAngle + borderlineSpan;

  // Classified NPL segment: starts after 6° gap
  const classifiedStartAngle = borderlineEndAngle + 6;
  const classifiedEndAngle = classifiedStartAngle + classifiedSpan;

  // Data preparations for Card 3: 91-DPD Risk Bar Chart
  const sourceRecords = effectiveSavedScope === 'aers' ? aersRecords : contracts;

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

  // Target Gauge Calculations (220° circular arc gauge with Target indicator)
  const targetMaxScale = Math.max(targetAmount * 1.35, activeSavedAmt * 1.15, 20_000_000);
  const targetPctOfScale = Math.min(1, targetAmount / targetMaxScale);
  const savedPctOfScale = Math.min(1, activeSavedAmt / targetMaxScale);
  const targetAchievedPct = Math.round((activeSavedAmt / Math.max(1, targetAmount)) * 100);

  // Target Gauge Arc Geometry: spans 220 degrees from 160° to 380°
  const gaugeArcAngleStart = 160;
  const gaugeArcTotal = 220;
  const gaugeTargetAngle = gaugeArcAngleStart + targetPctOfScale * gaugeArcTotal;
  const gaugeTargetPoint = polarToCartesian(140, 130, 88, gaugeTargetAngle);
  const gaugeTargetInner = polarToCartesian(140, 130, 68, gaugeTargetAngle);

  // Custom SVG milestone dot component with continuous pulsing halo for Multiple KPI series
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
        <circle cx={cx} cy={cy} r={12} fill="#10b981" opacity={0.2} className="animate-ping" />
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CHART 1: Monthly NPL vs. Debtor Trend & Live Radar - Multiple KPI Series */}
        <div
          style={{ animationDelay: '50ms' }}
          className="animate-fade-slide-up bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-lg shadow-slate-900/5 flex flex-col justify-between"
        >
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                  Monthly NPL vs. Debtor Trend (Multi-KPI)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {trendChartType === 'paired'
                    ? 'Paired Opening vs. Closing Bars'
                    : 'Curved Gradient Trend Area'}{' '}
                  · Dual-Scaled Debtor (Left) &amp; NPL (Right)
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Chart Type Toggle: Paired Bars vs Trend Area */}
                <div className="inline-flex items-center gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-950 rounded-lg text-[10px]">
                  <button
                    type="button"
                    onClick={() => setTrendChartType('paired')}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 font-medium rounded whitespace-nowrap transition-colors ${
                      trendChartType === 'paired'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <BarChart3 className="w-3 h-3 text-blue-500" />
                    Paired Bars
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrendChartType('area')}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 font-medium rounded whitespace-nowrap transition-colors ${
                      trendChartType === 'area'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Layers className="w-3 h-3 text-indigo-500" />
                    Area
                  </button>
                </div>

                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                  Dual Y-Axis
                </span>
              </div>
            </div>

            {/* Series Filter Selector */}
            <div className="mb-3 flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg text-[10px]">
              {(
                [
                  { id: 'all', label: 'All (Op & Cls)' },
                  { id: 'debtor', label: 'Debtor (Op vs Cls)', color: 'text-blue-600' },
                  { id: 'npl', label: 'NPL (Op vs Cls)', color: 'text-rose-600' },
                  { id: 'saved', label: 'NPL Saved', color: 'text-emerald-600' },
                ] as const
              ).map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setSeriesFilter(btn.id)}
                  className={`px-2 py-0.5 font-medium rounded transition-colors whitespace-nowrap ${
                    seriesFilter === btn.id
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            <div className="h-56 w-full">
              {trendChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl px-4">
                  No portfolio data yet. Upload an AERS Excel file or add tracked contracts.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={trendChartData}
                    margin={{ top: 16, right: 10, left: -10, bottom: 0 }}
                  >
                    <defs>
                      {/* Bar Fill Gradients */}
                      <linearGradient id="multiOpDebtorBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.75} />
                      </linearGradient>
                      <linearGradient id="multiClosingDebtorBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.85} />
                      </linearGradient>

                      <linearGradient id="multiOpNplBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fb7185" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.75} />
                      </linearGradient>
                      <linearGradient id="multiClosingNplBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#e11d48" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#be123c" stopOpacity={0.85} />
                      </linearGradient>

                      <linearGradient id="multiSavedBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#047857" stopOpacity={0.8} />
                      </linearGradient>

                      {/* Area Fill Gradients */}
                      <linearGradient id="multiOpDebtorAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="multiClosingDebtorAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="multiClosingNplAreaGrad" x1="0" y1="0" x2="0" y2="1">
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

                    {/* Left Axis: Debtor Scale (Millions Rs.) */}
                    <YAxis
                      yAxisId="debtor"
                      orientation="left"
                      tick={{ fill: axisColor, fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      domain={[0, Math.ceil((maxDebtorVal * 1.15) / 5_000_000) * 5_000_000 || 50_000_000]}
                      tickFormatter={(v) => `${(Number(v) / 1_000_000).toFixed(0)}M`}
                    />

                    {/* Right Axis: NPL & Saved Scale (Millions Rs.) */}
                    <YAxis
                      yAxisId="npl"
                      orientation="right"
                      tick={{ fill: axisColor, fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      domain={[0, Math.ceil((maxNplVal * 1.3) / 1_000_000) * 1_000_000 || 10_000_000]}
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
                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '6px' }} />

                    {/* Paired Bar Chart Mode */}
                    {trendChartType === 'paired' ? (
                      <>
                        {(seriesFilter === 'all' || seriesFilter === 'debtor') && (
                          <Bar
                            yAxisId="debtor"
                            dataKey="opDebtor"
                            name="Op Debtor"
                            fill="url(#multiOpDebtorBarGrad)"
                            stroke="#3b82f6"
                            strokeWidth={1}
                            radius={[4, 4, 0, 0]}
                            maxBarSize={22}
                          />
                        )}

                        {(seriesFilter === 'all' || seriesFilter === 'debtor') && (
                          <Bar
                            yAxisId="debtor"
                            dataKey="closingDebtor"
                            name="Closing Debtor"
                            fill="url(#multiClosingDebtorBarGrad)"
                            stroke="#1d4ed8"
                            strokeWidth={1}
                            radius={[4, 4, 0, 0]}
                            maxBarSize={22}
                          />
                        )}

                        {(seriesFilter === 'all' || seriesFilter === 'npl') && (
                          <Bar
                            yAxisId="npl"
                            dataKey="opNpl"
                            name="Op NPL"
                            fill="url(#multiOpNplBarGrad)"
                            stroke="#f43f5e"
                            strokeWidth={1}
                            radius={[4, 4, 0, 0]}
                            maxBarSize={22}
                          />
                        )}

                        {(seriesFilter === 'all' || seriesFilter === 'npl') && (
                          <Bar
                            yAxisId="npl"
                            dataKey="closingNpl"
                            name="Closing NPL"
                            fill="url(#multiClosingNplBarGrad)"
                            stroke="#be123c"
                            strokeWidth={1}
                            radius={[4, 4, 0, 0]}
                            maxBarSize={22}
                          />
                        )}

                        {(seriesFilter === 'all' || seriesFilter === 'saved') && (
                          <Bar
                            yAxisId="npl"
                            dataKey="savedAmt"
                            name="NPL Saved"
                            fill="url(#multiSavedBarGrad)"
                            stroke="#10b981"
                            strokeWidth={1}
                            radius={[4, 4, 0, 0]}
                            maxBarSize={22}
                          />
                        )}
                      </>
                    ) : (
                      /* Area / Line Trend Mode */
                      <>
                        {(seriesFilter === 'all' || seriesFilter === 'debtor') && (
                          <Area
                            yAxisId="debtor"
                            type="monotone"
                            dataKey="opDebtor"
                            name="Op Debtor"
                            stroke="#60a5fa"
                            strokeWidth={1.5}
                            strokeDasharray="3 3"
                            fillOpacity={1}
                            fill="url(#multiOpDebtorAreaGrad)"
                          />
                        )}

                        {(seriesFilter === 'all' || seriesFilter === 'debtor') && (
                          <Area
                            yAxisId="debtor"
                            type="monotone"
                            dataKey="closingDebtor"
                            name="Closing Debtor"
                            stroke="#2563eb"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#multiClosingDebtorAreaGrad)"
                          />
                        )}

                        {(seriesFilter === 'all' || seriesFilter === 'npl') && (
                          <Area
                            yAxisId="npl"
                            type="monotone"
                            dataKey="closingNpl"
                            name="Closing NPL"
                            stroke="#e11d48"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#multiClosingNplAreaGrad)"
                          />
                        )}

                        {(seriesFilter === 'all' || seriesFilter === 'saved') && (
                          <Line
                            yAxisId="npl"
                            type="monotone"
                            dataKey="savedAmt"
                            name="NPL Saved"
                            stroke="#10b981"
                            strokeWidth={2.5}
                            dot={<CustomizedMilestoneDot />}
                            activeDot={{ r: 7, fill: '#10b981' }}
                          />
                        )}
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Bottom Comparative Strip: Opening vs Closing Telemetry */}
            <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] tabular-nums">
              <div className="bg-blue-50/50 dark:bg-blue-950/20 p-2 rounded-lg border border-blue-100 dark:border-blue-900/40">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px]">
                  Opening Debtor
                </span>
                <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                  {formatCompactRs(liveOpDebtorAmt)}
                </span>
              </div>
              <div className="bg-blue-50/50 dark:bg-blue-950/20 p-2 rounded-lg border border-blue-100 dark:border-blue-900/40">
                <span className="text-slate-500 dark:text-slate-400 flex items-center justify-between text-[10px]">
                  <span>Closing Debtor</span>
                  <span className={`text-[9px] font-bold ${debtorMovement >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>
                    {debtorMovement >= 0 ? '+' : ''}{formatCompactRs(debtorMovement)}
                  </span>
                </span>
                <span className="font-mono font-semibold text-blue-700 dark:text-blue-300">
                  {formatCompactRs(liveClosingDebtorAmt)}
                </span>
              </div>
              <div className="bg-rose-50/50 dark:bg-rose-950/20 p-2 rounded-lg border border-rose-100 dark:border-rose-900/40">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px]">
                  Opening NPL
                </span>
                <span className="font-mono font-semibold text-rose-500 dark:text-rose-400">
                  {formatCompactRs(liveOpNplAmt)}
                </span>
              </div>
              <div className="bg-rose-50/50 dark:bg-rose-950/20 p-2 rounded-lg border border-rose-100 dark:border-rose-900/40">
                <span className="text-slate-500 dark:text-slate-400 flex items-center justify-between text-[10px]">
                  <span>Closing NPL</span>
                  <span className={`text-[9px] font-bold ${nplMovement <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {nplMovement <= 0 ? '' : '+'}{formatCompactRs(nplMovement)}
                  </span>
                </span>
                <span className="font-mono font-semibold text-rose-700 dark:text-rose-300">
                  {formatCompactRs(liveClosingNplAmt)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CHART 2: NPL Saved vs. Fallen NPL - Gauge with a Target */}
        <div
          style={{ animationDelay: '100ms' }}
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
                  Executive Recovery Gauge against Monthly Branch Target
                </p>
              </div>
              {aersRecords.length > 0 && (
                <div className="inline-flex items-center gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-950 rounded-md shrink-0">
                  <button
                    type="button"
                    onClick={() => setSavedScope('aers')}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded whitespace-nowrap ${
                      effectiveSavedScope === 'aers'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    AERS
                  </button>
                  <button
                    type="button"
                    onClick={() => setSavedScope('tracked')}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded whitespace-nowrap ${
                      effectiveSavedScope === 'tracked'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    Watchlist
                  </button>
                </div>
              )}
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

                  {/* Background Track Arc (220 degrees from 160° to 380°) */}
                  <path
                    d={describeDonutSegment(140, 130, 88, 70, 160, 380)}
                    className="fill-slate-200 dark:fill-slate-800"
                  />

                  {/* Filled Progress Arc for Saved Amount */}
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

                  {/* Target Indicator Line Marker */}
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

                  {/* Target Flag Pin */}
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

                {/* Center Numeric Readout */}
                <div className="absolute top-16 inset-x-0 flex flex-col items-center justify-center text-center tabular-nums">
                  <span className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
                    {formatCompactRs(activeSavedAmt)}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {targetAchievedPct}% Achieved
                  </span>
                </div>
              </div>

              {/* Status Pill */}
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

          {/* Bottom Summary comparing Saved vs Fallen */}
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
          style={{ animationDelay: '150ms' }}
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
                {/* View Mode Toggle: Bar Chart vs Doughnut */}
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

                {/* Exposure vs Count Metric Mode Toggle */}
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

            {/* Sub-Filters / Focus Controls */}
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

            {/* VIEW A: BAR CHART VIEW FOR BORDERLINE VS CLASSIFIED NPL */}
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

                {/* Status Classification Pill */}
                <div className="mt-1 flex items-center justify-center">
                  {classifiedPct >= 60 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                      CRITICAL 91+ DOMINANT ({classifiedPct}%)
                    </span>
                  ) : borderlinePct >= 50 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                      ELEVATED BORDERLINE EXPOSURE ({borderlinePct}%)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-800 dark:bg-slate-800/80 dark:text-slate-300">
                      BALANCED RISK POSTURE
                    </span>
                  )}
                </div>
              </div>
            ) : (
              /* VIEW B: ANIMATED SVG DOUGHNUT GAUGE VIEW */
              <div className="py-1 flex flex-col items-center justify-center relative">
                <div className="relative w-64 h-52 flex items-center justify-center">
                  {/* Background radar sweep glow circle */}
                  <div className="absolute inset-5 rounded-full border border-dashed border-amber-500/20 dark:border-amber-400/15 animate-radar-spin pointer-events-none" />

                  <svg className="w-full h-full" viewBox="0 0 280 230">
                    <defs>
                      {/* Borderline Amber Shimmer Gradient with Continuous Moving Light-Sweep */}
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

                      {/* Classified NPL Rose Shimmer Gradient with Continuous Moving Light-Sweep */}
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

                    {/* Outer Background Calibration Ring */}
                    <circle
                      cx={doughnutCx}
                      cy={doughnutCy}
                      r={doughnutROuter + 8}
                      fill="none"
                      stroke={isDark ? '#1e293b' : '#e2e8f0'}
                      strokeWidth="1"
                      strokeDasharray="3 5"
                    />

                    {/* Inner Track Ring */}
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

                    {/* Doughnut Track Background */}
                    <path
                      d={describeDonutSegment(doughnutCx, doughnutCy, doughnutROuter, doughnutRInner, 0, 359.99)}
                      className="fill-slate-100 dark:fill-slate-800/60"
                    />

                    {/* Segment 1: Borderline Arc */}
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

                    {/* Segment 2: Classified NPL Arc */}
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

                    {/* Real-time Orbiting Light-Sweep Radar Particle */}
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
                      <circle
                        cx={doughnutCx}
                        cy={doughnutCy - doughnutROuter - 8}
                        r="7"
                        fill="#f43f5e"
                        opacity="0.3"
                        className="animate-ping"
                      />
                    </g>
                  </svg>

                  {/* Central Interactive Telemetry Display */}
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

                {/* Severity Pill */}
                <div className="mt-0.5 flex items-center justify-center">
                  {classifiedPct >= 60 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                      CRITICAL 91+ DOMINANT ({classifiedPct}%)
                    </span>
                  ) : borderlinePct >= 50 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                      ELEVATED BORDERLINE EXPOSURE ({borderlinePct}%)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-800 dark:bg-slate-800/80 dark:text-slate-300">
                      BALANCED RISK POSTURE
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sub-breakdown: Borderline vs Classified NPL */}
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
                  <span className="font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Borderline (2.01–2.99)
                  </span>
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
                  <span className="font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                    Classified NPL (3.00+)
                  </span>
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

            {/* Continuous Shimmering Split Bar */}
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

      {/* Visit Effectiveness Breakdown with Shimmering Progress Bars */}
      <div
        style={{ animationDelay: '200ms' }}
        className="animate-fade-slide-up bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-lg shadow-slate-900/5"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Visit Effectiveness &amp; Success Rates by Channel
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Continuously shimmering success rate bars for field recovery officers &amp; channel attribution
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            {contracts.length} tracked contracts
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {visitStats.map((stat) => (
            <div
              key={stat.option}
              className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {stat.option}
                </span>
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {stat.successRate}% Success
                </span>
              </div>

              {/* Continuously Shimmering Animated Progress Bar */}
              <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded-full animate-stripe-flow transition-all duration-1000 ease-out"
                  style={{ width: `${stat.successRate}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                <span>{stat.totalVisits} visits logged</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  {stat.savedOrPositive} positive
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showSnapshotLedger && (
        <div
          style={{ animationDelay: '250ms' }}
          className="animate-fade-slide-up bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-lg shadow-slate-900/5 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Monthly Snapshots Ledger (Nov 2026 – Mar 2027)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Automatically saved on AERS Excel upload or manually recorded for monthly progress tracking
              </p>
            </div>

            <button
              type="button"
              onClick={openNewSnapshot}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Monthly Snapshot
            </button>
          </div>

          {(isAddingSnapshot || editingSnapshot) && (
            <form
              onSubmit={handleSaveSnapshotForm}
              className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-4 text-xs"
            >
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                {editingSnapshot ? 'Edit Snapshot' : 'New Monthly Snapshot Entry'}
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
                    Date
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
                    Tracked Debtor (Rs.)
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
                    Tracked NPL (Rs.)
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
                    Collection %
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
              No saved snapshots yet. Upload an AERS workbook or click Add Monthly Snapshot above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 font-semibold text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-4">Snapshot Label</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3 text-right">Tracked Debtor</th>
                    <th className="py-2.5 px-3 text-right">Tracked NPL</th>
                    <th className="py-2.5 px-3 text-right">NPL Saved</th>
                    <th className="py-2.5 px-3 text-right">Collection %</th>
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
                        {snap.snapshotDate}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-900 dark:text-slate-100">
                        {formatCurrencyRs(snap.trackedDebtor)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-600 dark:text-rose-400">
                        {formatCurrencyRs(snap.trackedNpl)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                        {formatCurrencyRs(snap.nplSavedAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {snap.collectionPct}%
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
