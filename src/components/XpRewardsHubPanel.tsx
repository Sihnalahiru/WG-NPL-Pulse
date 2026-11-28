import { useMemo, useState } from 'react';
import {
  Award,
  Crown,
  Flame,
  Medal,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import {
  STAFF_FOLLOWUP_NAMES,
  type AersMetadata,
  type AersRecord,
  type StaffAssignedContract,
} from '../types/recovery';
import {
  formatCompactRs,
  getOfficerByOfficeType,
  isBorderlineNplAccount,
  isNplSavedAccount,
  normalizeContractNo,
} from '../utils/recoveryEngine';
import { useLanguage } from '../contexts/LanguageContext';
import { UserAvatar } from './UserAvatar';

interface XpRewardsHubPanelProps {
  aersRecords: AersRecord[];
  aersMeta: AersMetadata | null;
  staffAssignments: StaffAssignedContract[];
}

interface RankTier {
  name: string;
  minXp: number;
  nextXp: number;
  badgeClass: string;
  barClass: string;
}

const RANK_TIERS: RankTier[] = [
  {
    name: 'Bronze Associate',
    minXp: 0,
    nextXp: 1000,
    badgeClass:
      'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    barClass: 'bg-amber-600',
  },
  {
    name: 'Silver Collector',
    minXp: 1000,
    nextXp: 2500,
    badgeClass:
      'bg-zinc-200 text-zinc-800 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700',
    barClass: 'bg-zinc-500',
  },
  {
    name: 'Gold Recovery Specialist',
    minXp: 2500,
    nextXp: 4500,
    badgeClass:
      'bg-yellow-100 text-yellow-900 border-yellow-300 dark:bg-yellow-950/60 dark:text-yellow-300 dark:border-yellow-800',
    barClass: 'bg-yellow-500',
  },
  {
    name: 'Platinum Portfolio Guardian',
    minXp: 4500,
    nextXp: 7000,
    badgeClass:
      'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
    barClass: 'bg-sky-500',
  },
  {
    name: 'Diamond Executive Champion',
    minXp: 7000,
    nextXp: 10000,
    badgeClass:
      'bg-red-100 text-red-900 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800',
    barClass: 'bg-red-600',
  },
];

function getTier(xp: number): RankTier {
  for (let i = RANK_TIERS.length - 1; i >= 0; i -= 1) {
    if (xp >= RANK_TIERS[i].minXp) return RANK_TIERS[i];
  }
  return RANK_TIERS[0];
}

interface PerformerXpRow {
  id: string;
  name: string;
  category: 'RO / MO Officer' | 'Assign User';
  roleLabel: string;
  totalXp: number;
  level: number;
  tier: RankTier;
  progressToNextPct: number;
  collectionPct: number;
  ratio90Pct: number;
  totalCollection: number;
  nplSavedCount: number;
  reducingCount: number;
  effortsCount: number;
  portfolioCount: number;
  xpBreakdown: {
    collectionXp: number;
    ratio90Xp: number;
    nplSavedXp: number;
    effortXp: number;
  };
  badges: string[];
}

export function XpRewardsHubPanel({
  aersRecords,
  aersMeta,
  staffAssignments,
}: XpRewardsHubPanelProps) {
  const { t } = useLanguage();
  const [scopeFilter, setScopeFilter] = useState<'all' | 'officers' | 'assign_users'>('all');

  const performers = useMemo<PerformerXpRow[]>(() => {
    const rows: PerformerXpRow[] = [];
    const bm = aersMeta?.bmBranchSnapshot;

    // 1. RO / MO Officers from live AERS + BM Snapshot
    const aersByOfficer = new Map<
      string,
      {
        role: string;
        count: number;
        due: number;
        coll: number;
        below1: number;
        nplSavedCount: number;
        nplReducedAmt: number;
        efforts: number;
        zeroEffBorderline: number;
        reducing: number;
      }
    >();

    for (const r of aersRecords) {
      const off = getOfficerByOfficeType(r);
      const curr = aersByOfficer.get(off) ?? {
        role: (r.officeType || 'RO').trim() || 'RO',
        count: 0,
        due: 0,
        coll: 0,
        below1: 0,
        nplSavedCount: 0,
        nplReducedAmt: 0,
        efforts: 0,
        zeroEffBorderline: 0,
        reducing: 0,
      };
      curr.count += 1;
      curr.due += Number(r.currentMonthDue || r.dueBudgetMonth) || 0;
      curr.coll += Number(r.totalCollection) || 0;
      if ((r.currentAge || 0) <= 1.0) curr.below1 += 1;
      if (
        isNplSavedAccount({
          opNpl: r.opNpl,
          opAge: r.opAge,
          npl: r.npl,
          actualDpd: r.actualDpd,
          monthEndForecastDpd: r.monthEndForecastDpd,
          totalCollection: r.totalCollection,
          lastPaidAmount: r.lastPaidAmount,
        })
      ) {
        curr.nplSavedCount += 1;
      }
      if ((r.opNpl || 0) > (r.npl || 0)) {
        curr.nplReducedAmt += (r.opNpl || 0) - (r.npl || 0);
      }
      if ((r.currentAge || 0) <= (r.opAge || 0) - 0.05) {
        curr.reducing += 1;
      }
      curr.efforts += Number(r.assignOfficerEfforts) || 0;
      const isBorder = isBorderlineNplAccount({
        actualDpd: r.actualDpd,
        opAge: r.opAge,
        currentAge: r.currentAge,
        monthEndForecastDpd: r.monthEndForecastDpd,
        opNpl: r.opNpl,
        npl: r.npl,
        totalCollection: r.totalCollection,
        lastPaidAmount: r.lastPaidAmount,
      });
      if (isBorder && (r.assignOfficerEfforts || 0) === 0) {
        curr.zeroEffBorderline += 1;
      }
      aersByOfficer.set(off, curr);
    }

    // Merge BM Snapshot RO/MO totals when available for accurate 90 Ratio & Collection %
    const bmMap = new Map<
      string,
      { role: string; count: number; collPct: number; ratio90: number; totalColl: number; netVar: number }
    >();
    if (bm) {
      [...bm.roPerformance, ...bm.moPerformance].forEach((row) => {
        const r90 =
          row.totalCount > 0 ? Math.round((row.belowOneCount / row.totalCount) * 1000) / 10 : 0;
        bmMap.set(row.officer, {
          role: row.role,
          count: row.totalCount,
          collPct: row.collectionEfficiencyPct || 0,
          ratio90: r90,
          totalColl: row.totalCollection || 0,
          netVar: row.netNplVariance || 0,
        });
      });
    }

    const allOfficerNames = new Set<string>([
      ...aersByOfficer.keys(),
      ...bmMap.keys(),
    ]);

    allOfficerNames.forEach((officer) => {
      const live = aersByOfficer.get(officer);
      const bmRow = bmMap.get(officer);
      const count = bmRow?.count || live?.count || 0;
      if (count === 0) return;

      const collPct =
        bmRow && bmRow.collPct > 0
          ? bmRow.collPct
          : live && live.due > 0
            ? Math.min(200, Math.round((live.coll / live.due) * 1000) / 10)
            : 0;
      const ratio90 =
        bmRow && bmRow.count > 0
          ? bmRow.ratio90
          : live && live.count > 0
            ? Math.round((live.below1 / live.count) * 1000) / 10
            : 0;
      const totalColl = bmRow?.totalColl || live?.coll || 0;
      const nplSavedCount = live?.nplSavedCount || 0;
      const nplReducedAmt = Math.max(
        live?.nplReducedAmt || 0,
        bmRow && bmRow.netVar < 0 ? Math.abs(bmRow.netVar) : 0,
      );
      const effortsCount = live?.efforts || 0;
      const reducingCount = live?.reducing || 0;

      const collectionXp = Math.round(Math.min(150, collPct) * 18);
      const ratio90Xp = Math.round(ratio90 * 14) + (ratio90 >= 90 ? 600 : 0);
      const nplSavedXp =
        nplSavedCount * 150 +
        Math.round((nplReducedAmt / 100000) * 18) +
        reducingCount * 20;
      const effortXp =
        Math.min(1400, effortsCount * 12) +
        (live && live.zeroEffBorderline === 0 && live.count > 0 ? 250 : 0);

      const totalXp = collectionXp + ratio90Xp + nplSavedXp + effortXp;
      const tier = getTier(totalXp);
      const level = Math.max(1, Math.floor(totalXp / 350) + 1);
      const progressToNextPct =
        tier.nextXp > tier.minXp
          ? Math.min(100, Math.round(((totalXp - tier.minXp) / (tier.nextXp - tier.minXp)) * 100))
          : 100;

      const badges: string[] = [];
      if (ratio90 >= 90) badges.push('90% Ratio Club');
      if (collPct >= 85) badges.push('Elite Collector');
      if (nplSavedCount >= 3 || nplReducedAmt >= 500000) badges.push('NPL Shield');
      if (effortsCount >= 25) badges.push('High Effort Pro');
      if (live && live.zeroEffBorderline === 0 && live.count > 0) badges.push('Zero-Miss Borderline');

      rows.push({
        id: `officer_${officer}`,
        name: officer,
        category: 'RO / MO Officer',
        roleLabel: bmRow?.role || live?.role || 'RO',
        totalXp,
        level,
        tier,
        progressToNextPct,
        collectionPct: collPct,
        ratio90Pct: ratio90,
        totalCollection: totalColl,
        nplSavedCount,
        reducingCount,
        effortsCount,
        portfolioCount: count,
        xpBreakdown: { collectionXp, ratio90Xp, nplSavedXp, effortXp },
        badges,
      });
    });

    // 2. Assign Users (all 10 named follow-up officers)
    const aersByNo = new Map<string, AersRecord>();
    aersRecords.forEach((r) => {
      if (r?.contractNo) aersByNo.set(normalizeContractNo(r.contractNo), r);
    });

    STAFF_FOLLOWUP_NAMES.forEach((staffName) => {
      const assigned = staffAssignments.filter((a) => a.staffName === staffName);
      let due = 0;
      let coll = 0;
      let paid = 0;
      let reducing = 0;
      let below1 = 0;
      let efforts = 0;

      assigned.forEach((a) => {
        const rec = aersByNo.get(normalizeContractNo(a.contractNo));
        const d = Number(rec?.currentMonthDue || rec?.dueBudgetMonth || a.assignedDue) || 0;
        const c = Number(rec?.totalCollection ?? 0) || 0;
        const opAge = Number(rec?.opAge ?? a.assignedOpAge) || 0;
        const closeAge = Number(rec?.currentAge ?? a.assignedOpAge) || 0;
        due += d;
        coll += c;
        if (c > 0) paid += 1;
        if (closeAge <= 1.0) below1 += 1;
        if (closeAge <= opAge - 0.05) reducing += 1;
        efforts += Number(rec?.assignOfficerEfforts ?? 0) || 0;
      });

      const collPct = due > 0 ? Math.min(200, Math.round((coll / due) * 1000) / 10) : 0;
      const ratio90 =
        assigned.length > 0 ? Math.round((below1 / assigned.length) * 1000) / 10 : 0;
      const paidHitPct =
        assigned.length > 0 ? Math.round((paid / assigned.length) * 1000) / 10 : 0;

      const collectionXp = Math.round(Math.min(150, collPct) * 16 + paid * 25);
      const ratio90Xp = Math.round(ratio90 * 12) + (ratio90 >= 90 ? 500 : 0);
      const nplSavedXp = reducing * 85;
      const effortXp = Math.min(1400, efforts * 14);
      const totalXp = collectionXp + ratio90Xp + nplSavedXp + effortXp;
      const tier = getTier(totalXp);
      const level = Math.max(1, Math.floor(totalXp / 350) + 1);
      const progressToNextPct =
        tier.nextXp > tier.minXp
          ? Math.min(100, Math.round(((totalXp - tier.minXp) / (tier.nextXp - tier.minXp)) * 100))
          : 100;

      const badges: string[] = [];
      if (paidHitPct >= 60 && assigned.length > 0) badges.push('Payment Finisher');
      if (reducing >= 3) badges.push('Age Reducer');
      if (ratio90 >= 90 && assigned.length > 0) badges.push('90% Ratio Club');
      if (efforts >= 15) badges.push('Active Caller');

      rows.push({
        id: `assign_${staffName}`,
        name: staffName,
        category: 'Assign User',
        roleLabel: 'Follow-Up Staff',
        totalXp,
        level,
        tier,
        progressToNextPct,
        collectionPct: collPct,
        ratio90Pct: ratio90,
        totalCollection: coll,
        nplSavedCount: paid,
        reducingCount: reducing,
        effortsCount: efforts,
        portfolioCount: assigned.length,
        xpBreakdown: { collectionXp, ratio90Xp, nplSavedXp, effortXp },
        badges,
      });
    });

    return rows.sort((a, b) => b.totalXp - a.totalXp);
  }, [aersRecords, aersMeta, staffAssignments]);

  const visiblePerformers = useMemo(() => {
    if (scopeFilter === 'officers') {
      return performers.filter((p) => p.category === 'RO / MO Officer');
    }
    if (scopeFilter === 'assign_users') {
      return performers.filter((p) => p.category === 'Assign User');
    }
    return performers;
  }, [performers, scopeFilter]);

  const topThree = visiblePerformers.slice(0, 3);
  const totalBranchXp = visiblePerformers.reduce((s, p) => s + p.totalXp, 0);
  const diamondCount = visiblePerformers.filter((p) => p.totalXp >= 7000).length;
  const goldPlusCount = visiblePerformers.filter((p) => p.totalXp >= 2500).length;

  return (
    <div className="space-y-6">
      {/* Executive Rewards Banner */}
      <section
        aria-label="XP and Performance Rewards Overview"
        className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-red-950 text-white border border-red-900/40 rounded-2xl p-6 shadow-lg relative overflow-hidden"
      >
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-red-600 via-amber-400 to-red-700" />
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-300">
              <Trophy className="w-3.5 h-3.5" />
              Commercial Credit · Performance Gamification &amp; Rewards
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight">
              {t('xpTitle')}
            </h2>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {t('xpSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 tabular-nums shrink-0">
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="text-[10px] text-zinc-400 uppercase font-semibold">
                Team Total XP
              </div>
              <div className="mt-1 text-lg font-mono font-bold text-amber-300">
                {totalBranchXp.toLocaleString()}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="text-[10px] text-zinc-400 uppercase font-semibold">
                Gold+ Achievers
              </div>
              <div className="mt-1 text-lg font-mono font-bold text-emerald-300">
                {goldPlusCount}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="text-[10px] text-zinc-400 uppercase font-semibold">
                Diamond Tier
              </div>
              <div className="mt-1 text-lg font-mono font-bold text-red-300">
                {diamondCount}
              </div>
            </div>
          </div>
        </div>

        {/* Scope Filter Pills */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/10">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-black/30 border border-white/10">
            {(
              [
                { id: 'all', label: `All Staff (${performers.length})` },
                {
                  id: 'officers',
                  label: `RO / MO Officers (${performers.filter((p) => p.category === 'RO / MO Officer').length})`,
                },
                {
                  id: 'assign_users',
                  label: `Assign Users (${STAFF_FOLLOWUP_NAMES.length})`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setScopeFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  scopeFilter === tab.id
                    ? 'bg-red-700 text-white shadow-xs'
                    : 'text-zinc-300 hover:text-white hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-300 font-mono">
            <span>XP Rules:</span>
            <span className="px-2 py-0.5 rounded bg-white/10">Coll % × 18</span>
            <span className="px-2 py-0.5 rounded bg-white/10">90R % × 14 (+600 ≥90%)</span>
            <span className="px-2 py-0.5 rounded bg-white/10">NPL Saved +150</span>
            <span className="px-2 py-0.5 rounded bg-white/10">Efforts +12</span>
          </div>
        </div>
      </section>

      {/* Top 3 Podium Cards */}
      {topThree.length > 0 && (
        <section aria-label="Top 3 XP Champions" className="grid grid-cols-1 md:grid-cols-3 gap-4 tabular-nums">
          {topThree.map((p, idx) => {
            const rankNum = idx + 1;
            const ringStyle =
              rankNum === 1
                ? 'border-amber-400/80 dark:border-amber-500/60 bg-gradient-to-b from-amber-50/70 to-white dark:from-amber-950/25 dark:to-zinc-900'
                : rankNum === 2
                  ? 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900'
                  : 'border-orange-300/80 dark:border-orange-900/60 bg-white dark:bg-zinc-900';
            return (
              <div
                key={p.id}
                className={`rounded-2xl border p-5 shadow-xs space-y-3 relative ${ringStyle}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar name={p.name} sizeClass="w-12 h-12 text-sm" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-display font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                          {p.name}
                        </span>
                        <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                          LV {p.level}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {p.category} · {p.roleLabel}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                        rankNum === 1
                          ? 'bg-amber-500 text-white'
                          : rankNum === 2
                            ? 'bg-zinc-700 text-white'
                            : 'bg-orange-700 text-white'
                      }`}
                    >
                      {rankNum === 1 ? (
                        <Crown className="w-3.5 h-3.5" />
                      ) : (
                        <Medal className="w-3.5 h-3.5" />
                      )}
                      #{rankNum}
                    </span>
                  </div>
                </div>

                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-2xl font-mono font-extrabold text-zinc-900 dark:text-zinc-100">
                    {p.totalXp.toLocaleString()}{' '}
                    <span className="text-xs font-semibold text-red-700 dark:text-red-400">
                      XP
                    </span>
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${p.tier.badgeClass}`}
                  >
                    {p.tier.name}
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] font-mono text-zinc-500 dark:text-zinc-400 mb-1">
                    <span>Tier Progress</span>
                    <span>
                      {p.totalXp.toLocaleString()} / {p.tier.nextXp.toLocaleString()} XP
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${p.tier.barClass}`}
                      style={{ width: `${p.progressToNextPct}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] font-mono">
                  <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200/80 dark:border-zinc-800">
                    <div className="text-[9px] text-zinc-500 uppercase">Coll %</div>
                    <div className="font-bold text-emerald-700 dark:text-emerald-400">
                      {p.collectionPct.toFixed(1)}%
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200/80 dark:border-zinc-800">
                    <div className="text-[9px] text-zinc-500 uppercase">90 Ratio</div>
                    <div className="font-bold text-zinc-900 dark:text-zinc-100">
                      {p.ratio90Pct.toFixed(1)}%
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200/80 dark:border-zinc-800">
                    <div className="text-[9px] text-zinc-500 uppercase">Efforts</div>
                    <div className="font-bold text-zinc-900 dark:text-zinc-100">
                      {p.effortsCount}
                    </div>
                  </div>
                </div>

                {p.badges.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {p.badges.map((b) => (
                      <span
                        key={b}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-300 border border-red-200/80 dark:border-red-900"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        {b}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Full XP Leaderboard & Breakdown Table */}
      <section
        aria-label="Full Performance XP Leaderboard"
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs"
      >
        <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-red-700 dark:text-red-400" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Complete XP &amp; Reward Standings ({visiblePerformers.length})
            </h3>
          </div>
          <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
            Updated live from AERS &amp; Assign User Portfolios
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                <th className="py-2.5 px-4">Rank &amp; Officer</th>
                <th className="py-2.5 px-3">Reward Tier</th>
                <th className="py-2.5 px-3 text-right">Total XP</th>
                <th className="py-2.5 px-3 text-right">Collection XP</th>
                <th className="py-2.5 px-3 text-right">90 Ratio XP</th>
                <th className="py-2.5 px-3 text-right">NPL / Age XP</th>
                <th className="py-2.5 px-3 text-right">Effort XP</th>
                <th className="py-2.5 px-4">Earned Badges</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 tabular-nums">
              {visiblePerformers.map((p, idx) => (
                <tr
                  key={p.id}
                  className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40"
                >
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 text-center font-mono font-bold text-zinc-500">
                        #{idx + 1}
                      </span>
                      <UserAvatar name={p.name} sizeClass="w-8 h-8 text-[10px]" />
                      <div>
                        <div className="font-bold text-zinc-900 dark:text-zinc-100">
                          {p.name}{' '}
                          <span className="text-[10px] font-mono text-zinc-500">
                            LV {p.level}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          {p.category} · {p.portfolioCount} accts · Coll{' '}
                          {formatCompactRs(p.totalCollection)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded border ${p.tier.badgeClass}`}
                    >
                      {p.tier.name}
                    </span>
                    <div className="mt-1 h-1.5 w-28 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${p.tier.barClass}`}
                        style={{ width: `${p.progressToNextPct}%` }}
                      />
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-extrabold text-sm text-red-700 dark:text-red-400">
                    {p.totalXp.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-700 dark:text-emerald-400">
                    +{p.xpBreakdown.collectionXp}
                    <div className="text-[10px] text-zinc-500">
                      {p.collectionPct.toFixed(1)}%
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-zinc-900 dark:text-zinc-100">
                    +{p.xpBreakdown.ratio90Xp}
                    <div className="text-[10px] text-zinc-500">
                      {p.ratio90Pct.toFixed(1)}%
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-sky-700 dark:text-sky-400">
                    +{p.xpBreakdown.nplSavedXp}
                    <div className="text-[10px] text-zinc-500">
                      {p.reducingCount} reducing
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-zinc-700 dark:text-zinc-300">
                    +{p.xpBreakdown.effortXp}
                    <div className="text-[10px] text-zinc-500">
                      <PhoneCall className="w-2.5 h-2.5 inline mr-0.5" />
                      {p.effortsCount}
                    </div>
                  </td>
                  <td className="py-2.5 px-4">
                    {p.badges.length === 0 ? (
                      <span className="text-[10px] text-zinc-400">In progress</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {p.badges.map((b) => (
                          <span
                            key={b}
                            className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Reward Tier Legend */}
      <section
        aria-label="Banking Reward Tiers"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs"
      >
        {RANK_TIERS.map((tier, idx) => (
          <div
            key={tier.name}
            className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold text-zinc-400">
                TIER {idx + 1}
              </span>
              {idx === 4 ? (
                <Crown className="w-4 h-4 text-red-600" />
              ) : idx === 3 ? (
                <ShieldCheck className="w-4 h-4 text-sky-600" />
              ) : idx === 2 ? (
                <Target className="w-4 h-4 text-amber-500" />
              ) : idx === 1 ? (
                <TrendingUp className="w-4 h-4 text-zinc-500" />
              ) : (
                <Users className="w-4 h-4 text-amber-700" />
              )}
            </div>
            <div className="font-bold text-zinc-900 dark:text-zinc-100">{tier.name}</div>
            <div className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
              {tier.minXp.toLocaleString()}+ XP
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
