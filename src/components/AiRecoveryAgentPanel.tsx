import { useMemo, useState } from 'react';
import {
  Bot,
  ExternalLink,
  Loader2,
  MapPin,
  Send,
  Trash2,
} from 'lucide-react';
import type {
  AersMetadata,
  AersRecord,
  MapsGroundingChunk,
  OpeningOfficerBaseline,
  TrackedContract,
} from '../types/recovery';
import {
  analyzeNextMonthBorderline,
  analyzeWorstCategory,
  computeDpdAgeBuckets,
  computeOfficeTypeBreakdown,
  computeOfficerOpeningClosing,
  normalizeContractNo,
  normalizeEvaluableFromAers,
  normalizeEvaluableFromTracked,
} from '../utils/recoveryEngine';

interface AiRecoveryAgentPanelProps {
  trackedContracts: TrackedContract[];
  aersRecords: AersRecord[];
  aersMeta: AersMetadata | null;
  openingBaseline: OpeningOfficerBaseline | null;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  mode: 'portfolio' | 'maps';
  mapsChunks?: MapsGroundingChunk[];
}

const PORTFOLIO_PROMPTS = [
  'Break down our NPL & Borderline contracts by Main Category Office Type and nested RO Name.',
  'Analyze WORST (W) contracts and 91 DPD borderline accounts with 0 Assign Officer Efforts.',
  'Summarize Per-Officer Opening vs Closing NPL performance and identify who needs support.',
  'Give a brief recovery briefing in Sinhala + English (Singlish) for today field visits.',
];

const MAPS_PROMPTS = [
  'Find nearest Police Stations & Magistrate Courts around Colombo 10 for vehicle recovery coordination.',
  'Locate major towns & landmarks along the Kandy - Kurunegala main road for field recovery routing.',
  'Find Sri Lanka Finance / Leasing hubs & Police Stations near Negombo.',
  'Identify key landmarks and nearby police stations around Galle Fort & Matara for recovery visit planning.',
];

export function AiRecoveryAgentPanel({
  trackedContracts,
  aersRecords,
  aersMeta,
  openingBaseline,
}: AiRecoveryAgentPanelProps) {
  const [agentMode, setAgentMode] = useState<'portfolio' | 'maps'>('portfolio');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const portfolioContext = useMemo(() => {
    const trackedNos = new Set(
      trackedContracts.map((c) => normalizeContractNo(c.contractNo)),
    );
    const trackedEval = normalizeEvaluableFromTracked(trackedContracts);
    const aersEval =
      aersRecords.length > 0
        ? normalizeEvaluableFromAers(aersRecords, trackedNos)
        : [];
    const activeEval = aersEval.length > 0 ? aersEval : trackedEval;

    const borderline = analyzeNextMonthBorderline(activeEval);
    const worst = analyzeWorstCategory(activeEval);
    const officerSummary = computeOfficerOpeningClosing(
      activeEval,
      openingBaseline,
    );
    const officeTypeBreakdown = computeOfficeTypeBreakdown(activeEval);
    const dpdBuckets = computeDpdAgeBuckets(activeEval);

    return {
      aersSnapshot: aersMeta?.printedDateTime || 'No AERS uploaded',
      totalAersContracts: aersRecords.length,
      trackedWatchlistCount: trackedContracts.length,
      trackedTotals: {
        closingDebtor: trackedContracts.reduce(
          (s, c) => s + (c.closingDebtor || 0),
          0,
        ),
        opNpl: trackedContracts.reduce((s, c) => s + (c.opNpl || 0), 0),
        closingNpl: trackedContracts.reduce((s, c) => s + (c.npl || 0), 0),
        nplSavedCount: trackedContracts.filter(
          (c) => c.currentSituation === 'NPL SAVED',
        ).length,
      },
      officeTypeBreakdown: officeTypeBreakdown.slice(0, 12),
      dpdBuckets,
      borderlineSummary: {
        totalCount: borderline.totalCount,
        thisMonthEndCount: borderline.thisMonthEndCount,
        nextMonthOnlyCount: borderline.nextMonthOnlyCount,
        totalDebtorAtRisk: borderline.totalDebtorAtRisk,
        totalMinToSave: borderline.totalMinToSave,
        totalBorderlineEfforts: borderline.totalBorderlineEfforts,
        zeroEffortCount: borderline.zeroEffortCount,
        topBorderlineAccounts: borderline.accounts.slice(0, 15),
      },
      worstCategorySummary: {
        totalCount: worst.totalCount,
        totalOpNpl: worst.totalOpNpl,
        totalClosingNpl: worst.totalClosingNpl,
        totalClosingDebtor: worst.totalClosingDebtor,
        zeroEffortCount: worst.zeroEffortCount,
        lowDpdAttentionCount: worst.lowDpdAttentionCount,
        topWorstAccounts: worst.accounts.slice(0, 15),
      },
      officerOpeningClosing: officerSummary.slice(0, 20),
    };
  }, [trackedContracts, aersRecords, aersMeta, openingBaseline]);

  const readBrowserCoords = (): Promise<{
    latitude: number;
    longitude: number;
  } | null> => {
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        () => resolve(null),
        { timeout: 3000 },
      );
    });
  };

  const sendPrompt = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || loading) return;

    setErrorMsg(null);
    const activeMode = agentMode;
    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      mode: activeMode,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      if (activeMode === 'maps') {
        const latLng = await readBrowserCoords();
        const res = await fetch('/api/ai/maps-grounding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: trimmed,
            latLng: latLng ?? undefined,
          }),
        });
        const data = (await res.json()) as {
          reply?: string;
          mapsChunks?: MapsGroundingChunk[];
          error?: string;
        };
        if (!res.ok || !data.reply) {
          throw new Error(
            data.error || `Maps Grounding failed with status ${res.status}`,
          );
        }

        const modelMsg: ChatMessage = {
          id: `m_${Date.now()}`,
          role: 'model',
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          mode: 'maps',
          mapsChunks: data.mapsChunks ?? [],
        };
        setMessages((prev) => [...prev, modelMsg]);
      } else {
        const res = await fetch('/api/ai/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmed,
            history: messages
              .filter((m) => m.mode === 'portfolio')
              .map((m) => ({ role: m.role, text: m.text })),
            portfolioContext,
          }),
        });

        const data = (await res.json()) as { reply?: string; error?: string };
        if (!res.ok || !data.reply) {
          throw new Error(
            data.error || `Request failed with status ${res.status}`,
          );
        }

        const modelMsg: ChatMessage = {
          id: `m_${Date.now()}`,
          role: 'model',
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          mode: 'portfolio',
        };
        setMessages((prev) => [...prev, modelMsg]);
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to communicate with WG Pulse AI Agent.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts =
    agentMode === 'maps' ? MAPS_PROMPTS : PORTFOLIO_PROMPTS;

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0">
            {agentMode === 'maps' ? (
              <MapPin className="w-5 h-5" />
            ) : (
              <Bot className="w-5 h-5" />
            )}
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              WG Pulse AI Recovery Agent &amp; Google Maps Grounding
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              Switch between Portfolio Strategy (Office Type → RO, Borderline, Efforts, WORST) and live Google Maps Grounding (landmarks, police stations, field visit locations with verified map links).
            </p>
            <p className="mt-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              {aersRecords.length.toLocaleString()} AERS rows ·{' '}
              {portfolioContext.officeTypeBreakdown.length} Office Types ·{' '}
              {portfolioContext.worstCategorySummary.totalCount} WORST (W) ·{' '}
              {portfolioContext.borderlineSummary.totalCount} Borderline
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg">
            <button
              type="button"
              onClick={() => setAgentMode('portfolio')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                agentMode === 'portfolio'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              Portfolio Strategist
            </button>
            <button
              type="button"
              onClick={() => setAgentMode('maps')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                agentMode === 'maps'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              Maps Grounding
            </button>
          </div>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setErrorMsg(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Quick Prompts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {quickPrompts.map((q) => (
          <button
            key={q}
            type="button"
            disabled={loading}
            onClick={() => sendPrompt(q)}
            className="p-3 text-left text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-blue-400 dark:hover:border-blue-700 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Tracked Contract Address Shortcut in Maps Mode */}
      {agentMode === 'maps' && trackedContracts.some((c) => c.address) && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Verify Tracked Client Address:
          </span>
          {trackedContracts
            .filter((c) => c.address)
            .slice(0, 5)
            .map((c) => (
              <button
                key={c.contractNo}
                type="button"
                disabled={loading}
                onClick={() =>
                  sendPrompt(
                    `Locate landmarks, roads, and nearest police station around: ${c.address} (Contract ${c.contractNo} - ${c.cusName})`,
                  )
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <MapPin className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                {c.contractNo}
              </button>
            ))}
        </div>
      )}

      {/* Conversation Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col">
        <div className="p-5 min-h-[300px] max-h-[500px] overflow-y-auto space-y-4">
          {messages.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              {agentMode === 'maps'
                ? 'Ask for field visit landmarks, nearby police stations, town routes, or verify a client address using Google Maps Grounding.'
                : 'Select a strategy prompt above or ask any question below about Office Type → RO performance, Borderline accounts, or WORST (W) contracts.'}
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[88%] rounded-xl px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {msg.text}

                  {msg.mapsChunks && msg.mapsChunks.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Verified Google Maps Locations ({msg.mapsChunks.length})
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {msg.mapsChunks.map((place, idx) => (
                          <a
                            key={`${place.uri}_${idx}`}
                            href={place.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              e.preventDefault();
                              window.open(place.uri, '_blank', 'noopener,noreferrer');
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
                          >
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span>{place.title}</span>
                            <ExternalLink className="w-3 h-3 shrink-0 opacity-75" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <span className="mt-1 text-[10px] font-mono text-slate-400 tabular-nums">
                  {msg.role === 'user'
                    ? 'You'
                    : msg.mode === 'maps'
                      ? 'WG Pulse Maps Grounding'
                      : 'WG Pulse AI'}{' '}
                  · {msg.timestamp}
                </span>
              </div>
            ))
          )}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              {agentMode === 'maps'
                ? 'Querying live Google Maps grounding data...'
                : 'Analyzing Office Type, RO breakdown, & officer efforts...'}
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 text-xs text-red-700 dark:text-red-300">
              {errorMsg}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendPrompt(input);
          }}
          className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              agentMode === 'maps'
                ? 'Search town, landmark, police station, or client address on Google Maps...'
                : "Ask WG Pulse AI (e.g. 'Summarize Office Type NPL & 0-effort borderline accounts')..."
            }
            className="flex-1 px-3.5 py-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            {agentMode === 'maps' ? 'Search Maps' : 'Ask AI'}
          </button>
        </form>
      </div>
    </div>
  );
}
