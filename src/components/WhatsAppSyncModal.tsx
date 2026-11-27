import { useMemo, useState } from 'react';
import { CheckCircle2, MapPin, MessageSquare, X } from 'lucide-react';
import type {
  TrackedContract,
  WhatsAppLocationMatch,
} from '../types/recovery';
import { parseWhatsAppLocations } from '../utils/recoveryEngine';

interface WhatsAppSyncModalProps {
  isOpen: boolean;
  trackedContracts: TrackedContract[];
  onClose: () => void;
  onApplyMatches: (matches: WhatsAppLocationMatch[]) => void;
}

const SAMPLE_WHATSAPP_CHAT = `[25/11/2026, 09:14 AM] Damith Field: WP BAV-2298 parked near Homagama Timber Yard https://maps.google.com/?q=6.8432,80.0031
[25/11/2026, 10:02 AM] Bandara RO: Vehicle AAX 7742 spotted at Peradeniya Junction 7.2699, 80.5938
[25/11/2026, 11:25 AM] Rathnayake: BBE-6104 client residence pin https://www.google.com/maps?q=6.7132,79.9074
[25/11/2026, 12:18 PM] Dilshan: CAD-7890 warehouse yard Kaduwela https://maps.app.goo.gl/kaduwelaDemo91`;

export function WhatsAppSyncModal({
  isOpen,
  trackedContracts,
  onClose,
  onApplyMatches,
}: WhatsAppSyncModalProps) {
  const [rawChat, setRawChat] = useState('');

  const parsedMatches = useMemo(() => {
    if (!rawChat.trim()) return [];
    return parseWhatsAppLocations(rawChat, trackedContracts);
  }, [rawChat, trackedContracts]);

  const matchedOnly = parsedMatches.filter((m) => Boolean(m.matchedContractNo));

  if (!isOpen) return null;

  const handleApply = () => {
    if (matchedOnly.length === 0) return;
    onApplyMatches(matchedOnly);
    setRawChat('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wa-sync-title"
    >
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h2
              id="wa-sync-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Sync WhatsApp Group Locations (Vehicle No to Contract Bridge)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Paste copied WhatsApp group messages containing Sri Lankan vehicle numbers and Google Maps links or coordinates.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close WhatsApp sync modal"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Raw WhatsApp Group Chat Text
            </label>
            <button
              type="button"
              onClick={() => setRawChat(SAMPLE_WHATSAPP_CHAT)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Load Sample WhatsApp Chat
            </button>
          </div>

          <textarea
            rows={6}
            value={rawChat}
            onChange={(e) => setRawChat(e.target.value)}
            placeholder="Paste WhatsApp group chat lines here (e.g. WP BAV-2298 parked at Homagama https://maps.google.com/?q=6.8432,80.0031)..."
            className="w-full p-3 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />

          {parsedMatches.length > 0 ? (
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                Detected {parsedMatches.length} vehicle location pins ·{' '}
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  {matchedOnly.length} matched to active Watchlist
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      <th className="py-2 px-3">Detected Vehicle</th>
                      <th className="py-2 px-3">Matched Contract</th>
                      <th className="py-2 px-3">Timestamp</th>
                      <th className="py-2 px-3">Map Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {parsedMatches.map((m) => (
                      <tr key={`${m.normalizedVehicleNo}-${m.locationUrl}`}>
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {m.normalizedVehicleNo}
                          <span className="block text-[11px] font-normal text-slate-500">
                            Raw: {m.rawVehicleNo}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {m.matchedContractNo ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span className="font-mono">{m.matchedContractNo}</span>
                              <span className="text-slate-600 dark:text-slate-300">
                                ({m.matchedClientName})
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-400">
                              Not in active Watchlist
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                          {m.timestampText}
                        </td>
                        <td className="py-2.5 px-3">
                          <a
                            href={m.locationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              e.preventDefault();
                              window.open(m.locationUrl, '_blank', 'noopener,noreferrer');
                            }}
                            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            Preview Map
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : rawChat.trim() ? (
            <div className="p-4 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-800 dark:text-amber-300">
              No Sri Lankan vehicle number + Google Maps link/coordinates pair detected. Ensure each message includes both a vehicle plate (e.g. BAV-2298 or AAX 7742) and a Maps URL or lat,lng coordinates.
            </div>
          ) : null}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={matchedOnly.length === 0}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Sync {matchedOnly.length} Matched Location{matchedOnly.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
}
