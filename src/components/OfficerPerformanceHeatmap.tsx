import { useEffect, useMemo, useRef, useState } from 'react';
import { Flame, RotateCcw } from 'lucide-react';
import {
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import {
  STAFF_FOLLOWUP_NAMES,
  type MonthlySnapshot,
} from '../types/recovery';
import {
  formatCompactRs,
  formatCurrencyRs,
  getTodayISO,
} from '../utils/recoveryEngine';

export interface OfficerHeatmapLiveStat {
  staffName: string;
  assignedCount: number;
  paidCount: number;
  pendingCount: number;
  totalDue: number;
  totalCollection: number;
  collectionPct: number;
  avgClosingAge: number;
  assignEfforts: number;
}

interface OfficerPerformanceHeatmapProps {
  monthlySnapshots: MonthlySnapshot[];
  staffLiveStats: OfficerHeatmapLiveStat[];
  selectedStaff: string;
  isDark: boolean;
  onSelectOfficer?: (staffName: string) => void;
}

interface HeatmapCellDatum {
  dayIndex: number;
  officerIndex: number;
  date: string;
  shortDate: string;
  officer: string;
  hasData: boolean;
  source: 'snapshot' | 'live' | 'empty';
  assignedCount: number;
  paidCount: number;
  pendingCount: number;
  totalDue: number;
  totalCollection: number;
  collectionPct: number;
  avgClosingAge: number;
  assignEfforts: number;
  intensity: number; // 0..1 normalized
  fill: string;
}

type HeatmapMetric = 'pct' | 'amount';

function buildLast30CalendarDays(): { date: string; shortDate: string }[] {
  const days: { date: string; shortDate: string }[] = [];
  const todayIso = getTodayISO();
  const [y, m, d] = todayIso.split('-').map(Number);
  const anchor = new Date(y, (m || 1) - 1, d || 1);

  for (let offset = 29; offset >= 0; offset -= 1) {
    const dt = new Date(anchor);
    dt.setDate(anchor.getDate() - offset);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    days.push({
      date: `${yyyy}-${mm}-${dd}`,
      shortDate: `${mm}-${dd}`,
    });
  }
  return days;
}

function getHeatmapFill(
  hasData: boolean,
  metric: HeatmapMetric,
  collectionPct: number,
  amountRatio: number,
  isDark: boolean,
): string {
  if (!hasData) {
    return isDark ? '#1c1c21' : '#f4f4f5';
  }

  if (metric === 'pct') {
    if (collectionPct <= 0) return isDark ? '#3f1518' : '#fee2e2';
    if (collectionPct < 30) return isDark ? '#7f1d1d' : '#fca5a5';
    if (collectionPct < 55) return isDark ? '#b45309' : '#fcd34d';
    if (collectionPct < 80) return isDark ? '#047857' : '#6ee7b7';
    return isDark ? '#10b981' : '#059669';
  }

  // Amount (Rs.) intensity ramp — Commercial Credit crimson to deep emerald
  if (amountRatio <= 0) return isDark ? '#3f1518' : '#fee2e2';
  if (amountRatio < 0.25) return isDark ? '#7f1d1d' : '#fca5a5';
  if (amountRatio < 0.5) return isDark ? '#b91c1c' : '#f87171';
  if (amountRatio < 0.75) return isDark ? '#047857' : '#34d399';
  return isDark ? '#10b981' : '#059669';
}

interface CustomCellShapeProps {
  cx?: number;
  cy?: number;
  payload?: HeatmapCellDatum;
  cellWidth: number;
  cellHeight: number;
  isDark: boolean;
  showValueLabel: boolean;
  metric: HeatmapMetric;
  onCellClick?: (cell: HeatmapCellDatum) => void;
}

function HeatmapCellShape({
  cx,
  cy,
  payload,
  cellWidth,
  cellHeight,
  isDark,
  showValueLabel,
  metric,
  onCellClick,
}: CustomCellShapeProps) {
  if (typeof cx !== 'number' || typeof cy !== 'number' || !payload) {
    return <g />;
  }

  const w = Math.max(8, cellWidth - 3);
  const h = Math.max(14, cellHeight - 4);
  const x = cx - w / 2;
  const y = cy - h / 2;

  const strokeColor = payload.source === 'live'
    ? isDark
      ? '#f87171'
      : '#b91c1c'
    : payload.hasData
      ? isDark
        ? 'rgba(255,255,255,0.12)'
        : 'rgba(24,24,27,0.08)'
      : isDark
        ? 'rgba(255,255,255,0.04)'
        : 'rgba(24,24,27,0.05)';

  const textColor =
    !payload.hasData
      ? 'transparent'
      : isDark
        ? '#fafafa'
        : payload.collectionPct >= 80 || (metric === 'amount' && payload.intensity >= 0.75)
          ? '#ffffff'
          : '#18181b';

  const compactLabel =
    metric === 'pct'
      ? `${payload.collectionPct}`
      : payload.totalCollection >= 1000
        ? `${Math.round(payload.totalCollection / 1000)}k`
        : payload.totalCollection > 0
          ? '<1k'
          : '0';

  return (
    <g
      onClick={() => onCellClick?.(payload)}
      style={{ cursor: payload.hasData && onCellClick ? 'pointer' : 'default' }}
    >
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={4}
        ry={4}
        fill={payload.fill}
        stroke={strokeColor}
        strokeWidth={payload.source === 'live' ? 1.4 : 1}
      />
      {showValueLabel && payload.hasData && w >= 20 && (
        <text
          x={cx}
          y={cy + 3.5}
          textAnchor="middle"
          fontSize={9}
          fontWeight={700}
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fill={textColor}
          pointerEvents="none"
        >
          {compactLabel}
        </text>
      )}
    </g>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: HeatmapCellDatum }>;
}

function HeatmapTooltipCard({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const cell = payload[0]?.payload;
  if (!cell) return null;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-xl p-3 text-xs min-w-[220px] tabular-nums">
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="font-bold text-zinc-900 dark:text-zinc-100">
            {cell.officer}
          </div>
          <div className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            {cell.date}
          </div>
        </div>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
            cell.source === 'live'
              ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
              : cell.source === 'snapshot'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
          }`}
        >
          {cell.source === 'live'
            ? 'Live Today'
            : cell.source === 'snapshot'
              ? 'Snapshot'
              : 'No Data'}
        </span>
      </div>

      {cell.hasData ? (
        <div className="pt-2 space-y-1.5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-500 dark:text-zinc-400">Collection:</span>
            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
              {formatCurrencyRs(cell.totalCollection)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-500 dark:text-zinc-400">Achievement:</span>
            <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
              {cell.collectionPct}% ({formatCompactRs(cell.totalDue)} due)
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-500 dark:text-zinc-400">Contracts:</span>
            <span className="font-mono text-zinc-800 dark:text-zinc-200">
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                {cell.paidCount}P
              </span>{' '}
              /{' '}
              <span className="text-amber-700 dark:text-amber-400 font-semibold">
                {cell.pendingCount}U
              </span>{' '}
              ({cell.assignedCount})
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-500 dark:text-zinc-400">Avg Age / Efforts:</span>
            <span className="font-mono text-zinc-800 dark:text-zinc-200">
              {cell.avgClosingAge.toFixed(2)} · {cell.assignEfforts} calls
            </span>
          </div>
        </div>
      ) : (
        <div className="pt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          No AERS daily snapshot recorded for this officer on {cell.date}.
        </div>
      )}
    </div>
  );
}

export function OfficerPerformanceHeatmap({
  monthlySnapshots,
  staffLiveStats,
  selectedStaff,
  isDark,
  onSelectOfficer,
}: OfficerPerformanceHeatmapProps) {
  const [metric, setMetric] = useState<HeatmapMetric>('pct');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(860);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 0) {
        setContainerWidth(rect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const last30Days = useMemo(() => buildLast30CalendarDays(), []);

  const officers = useMemo<string[]>(() => {
    if (selectedStaff !== 'ALL') return [selectedStaff];
    return [...STAFF_FOLLOWUP_NAMES];
  }, [selectedStaff]);

  const { cells, activeCellCount, peakCell, maxCollection } = useMemo(() => {
    const todayIso = getTodayISO();

    // Index snapshots by YYYY-MM-DD
    const snapByDate = new Map<string, MonthlySnapshot>();
    monthlySnapshots.forEach((s) => {
      if (s.snapshotDate) {
        snapByDate.set(s.snapshotDate, s);
      }
    });

    // Index live stats by officer
    const liveByOfficer = new Map<string, OfficerHeatmapLiveStat>();
    staffLiveStats.forEach((st) => {
      liveByOfficer.set(st.staffName, st);
    });

    // First pass: collect raw values and determine maxCollection for Amount normalization
    interface RawCell {
      dayIndex: number;
      officerIndex: number;
      date: string;
      shortDate: string;
      officer: string;
      hasData: boolean;
      source: 'snapshot' | 'live' | 'empty';
      assignedCount: number;
      paidCount: number;
      pendingCount: number;
      totalDue: number;
      totalCollection: number;
      collectionPct: number;
      avgClosingAge: number;
      assignEfforts: number;
    }

    const rawCells: RawCell[] = [];
    let maxColl = 0;

    officers.forEach((officer, officerIndex) => {
      const liveStat = liveByOfficer.get(officer);

      last30Days.forEach((day, dayIndex) => {
        const snap = snapByDate.get(day.date);
        const snapEntry = snap?.staffDailyStats?.[officer];

        if (snapEntry && snapEntry.assignedCount > 0) {
          if (snapEntry.totalCollection > maxColl) {
            maxColl = snapEntry.totalCollection;
          }
          rawCells.push({
            dayIndex,
            officerIndex,
            date: day.date,
            shortDate: day.shortDate,
            officer,
            hasData: true,
            source: 'snapshot',
            assignedCount: snapEntry.assignedCount,
            paidCount: snapEntry.paidCount,
            pendingCount: snapEntry.pendingCount,
            totalDue: snapEntry.totalDue,
            totalCollection: snapEntry.totalCollection,
            collectionPct: snapEntry.collectionPct,
            avgClosingAge: snapEntry.avgClosingAge,
            assignEfforts: snapEntry.assignEfforts,
          });
        } else if (day.date === todayIso && liveStat && liveStat.assignedCount > 0) {
          if (liveStat.totalCollection > maxColl) {
            maxColl = liveStat.totalCollection;
          }
          rawCells.push({
            dayIndex,
            officerIndex,
            date: day.date,
            shortDate: day.shortDate,
            officer,
            hasData: true,
            source: 'live',
            assignedCount: liveStat.assignedCount,
            paidCount: liveStat.paidCount,
            pendingCount: liveStat.pendingCount,
            totalDue: liveStat.totalDue,
            totalCollection: liveStat.totalCollection,
            collectionPct: liveStat.collectionPct,
            avgClosingAge: Number(liveStat.avgClosingAge.toFixed(2)),
            assignEfforts: liveStat.assignEfforts,
          });
        } else {
          rawCells.push({
            dayIndex,
            officerIndex,
            date: day.date,
            shortDate: day.shortDate,
            officer,
            hasData: false,
            source: 'empty',
            assignedCount: 0,
            paidCount: 0,
            pendingCount: 0,
            totalDue: 0,
            totalCollection: 0,
            collectionPct: 0,
            avgClosingAge: 0,
            assignEfforts: 0,
          });
        }
      });
    });

    let activeCount = 0;
    let best: HeatmapCellDatum | null = null;

    const finalCells: HeatmapCellDatum[] = rawCells.map((rc) => {
      const amountRatio = maxColl > 0 ? rc.totalCollection / maxColl : 0;
      const intensity =
        metric === 'pct'
          ? Math.min(1, rc.collectionPct / 100)
          : Math.min(1, amountRatio);

      const cell: HeatmapCellDatum = {
        ...rc,
        intensity,
        fill: getHeatmapFill(
          rc.hasData,
          metric,
          rc.collectionPct,
          amountRatio,
          isDark,
        ),
      };

      if (cell.hasData) {
        activeCount += 1;
        if (
          !best ||
          (metric === 'pct'
            ? cell.collectionPct > best.collectionPct ||
              (cell.collectionPct === best.collectionPct &&
                cell.totalCollection > best.totalCollection)
            : cell.totalCollection > best.totalCollection)
        ) {
          best = cell;
        }
      }
      return cell;
    });

    return {
      cells: finalCells,
      activeCellCount: activeCount,
      peakCell: best as HeatmapCellDatum | null,
      maxCollection: maxColl,
    };
  }, [monthlySnapshots, staffLiveStats, officers, last30Days, metric, isDark]);

  const rowHeight = officers.length === 1 ? 52 : 30;
  const chartHeight = Math.max(120, officers.length * rowHeight + 54);
  const effectivePlotWidth = Math.max(660, containerWidth) - 122;
  const cellWidth = effectivePlotWidth / 30;
  const axisColor = isDark ? '#a1a1aa' : '#52525b';

  const xTicks = useMemo(
    () => [0, 4, 9, 14, 19, 24, 29],
    [],
  );

  const yTicks = useMemo(
    () => officers.map((_, idx) => idx),
    [officers],
  );

  const legendSwatches =
    metric === 'pct'
      ? [
          { label: 'No Data', color: getHeatmapFill(false, 'pct', 0, 0, isDark) },
          { label: '0%', color: getHeatmapFill(true, 'pct', 0, 0, isDark) },
          { label: '1–29%', color: getHeatmapFill(true, 'pct', 20, 0, isDark) },
          { label: '30–54%', color: getHeatmapFill(true, 'pct', 45, 0, isDark) },
          { label: '55–79%', color: getHeatmapFill(true, 'pct', 70, 0, isDark) },
          { label: '80%+', color: getHeatmapFill(true, 'pct', 90, 0, isDark) },
        ]
      : [
          { label: 'No Data', color: getHeatmapFill(false, 'amount', 0, 0, isDark) },
          { label: 'Rs. 0', color: getHeatmapFill(true, 'amount', 0, 0, isDark) },
          { label: 'Low', color: getHeatmapFill(true, 'amount', 0, 0.15, isDark) },
          { label: 'Mid', color: getHeatmapFill(true, 'amount', 0, 0.4, isDark) },
          { label: 'High', color: getHeatmapFill(true, 'amount', 0, 0.65, isDark) },
          {
            label: maxCollection > 0 ? `Peak (${formatCompactRs(maxCollection)})` : 'Peak',
            color: getHeatmapFill(true, 'amount', 0, 0.9, isDark),
          },
        ];

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
      {/* Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200/80 dark:border-red-900/70 shrink-0 mt-0.5">
            <Flame className="w-4 h-4 text-red-700 dark:text-red-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              30-Day Officer Collection Progress Heatmap
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Daily collection intensity per officer across the last 30 calendar days ({last30Days[0]?.date} → {last30Days[29]?.date}).
              {selectedStaff === 'ALL'
                ? ' Click any active cell to filter that officer.'
                : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {selectedStaff !== 'ALL' && onSelectOfficer && (
            <button
              type="button"
              onClick={() => onSelectOfficer('ALL')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Compare All 10
            </button>
          )}

          <div
            role="group"
            aria-label="Heatmap intensity metric"
            className="inline-flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
          >
            <button
              type="button"
              onClick={() => setMetric('pct')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                metric === 'pct'
                  ? 'bg-red-700 text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              Collection %
            </button>
            <button
              type="button"
              onClick={() => setMetric('amount')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                metric === 'amount'
                  ? 'bg-red-700 text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              Amount (Rs.)
            </button>
          </div>
        </div>
      </div>

      {/* Color Scale Legend & Peak Highlight */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] pt-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-semibold text-zinc-500 dark:text-zinc-400">
            Intensity:
          </span>
          {legendSwatches.map((sw) => (
            <span key={sw.label} className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
              <span
                className="w-3.5 h-3.5 rounded-[3px] border border-black/10 dark:border-white/10 inline-block shrink-0"
                style={{ backgroundColor: sw.color }}
              />
              <span>{sw.label}</span>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3 font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
          <span>{activeCellCount} officer-days logged</span>
          {peakCell && (
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
              Top: {peakCell.officer} · {peakCell.shortDate} (
              {metric === 'pct'
                ? `${peakCell.collectionPct}%`
                : formatCompactRs(peakCell.totalCollection)}
              )
            </span>
          )}
        </div>
      </div>

      {/* Recharts ScatterChart Heatmap */}
      <div className="overflow-x-auto pb-1">
        <div
          ref={containerRef}
          className="min-w-[680px] w-full"
          style={{ height: `${chartHeight}px` }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 16, bottom: 16, left: 6 }}>
              <XAxis
                type="number"
                dataKey="dayIndex"
                domain={[-0.5, 29.5]}
                ticks={xTicks}
                tickFormatter={(val: number) => last30Days[val]?.shortDate ?? ''}
                tick={{ fill: axisColor, fontSize: 11 }}
                axisLine={{ stroke: isDark ? '#27272a' : '#e4e4e7' }}
                tickLine={false}
              />
              <YAxis
                type="number"
                dataKey="officerIndex"
                domain={[-0.5, officers.length - 0.5]}
                ticks={yTicks}
                reversed={true}
                interval={0}
                width={94}
                tickFormatter={(val: number) => officers[val] ?? ''}
                tick={{ fill: axisColor, fontSize: 11, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              <ZAxis type="number" dataKey="collectionPct" range={[100, 100]} />
              <Tooltip
                cursor={false}
                content={<HeatmapTooltipCard />}
                wrapperStyle={{ zIndex: 30, pointerEvents: 'none' }}
              />
              <Scatter
                name="Officer Daily Collection"
                data={cells}
                isAnimationActive={false}
                shape={(props: unknown) => {
                  const p = props as {
                    cx?: number;
                    cy?: number;
                    payload?: HeatmapCellDatum;
                  };
                  return (
                    <HeatmapCellShape
                      cx={p.cx}
                      cy={p.cy}
                      payload={p.payload}
                      cellWidth={cellWidth}
                      cellHeight={rowHeight}
                      isDark={isDark}
                      showValueLabel={officers.length === 1}
                      metric={metric}
                      onCellClick={
                        onSelectOfficer && selectedStaff === 'ALL'
                          ? (cell) => {
                              if (cell.hasData) onSelectOfficer(cell.officer);
                            }
                          : undefined
                      }
                    />
                  );
                }}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {activeCellCount === 0 && (
        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
          Assign contracts to officers and upload daily AERS snapshots (or click <strong>Log Today Snapshot</strong>) to populate daily collection heatmap cells.
        </div>
      )}
    </div>
  );
}
