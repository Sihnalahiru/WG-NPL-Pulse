import { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  MonitorDown,
  Smartphone,
  WifiOff,
  X,
} from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export function PWAInstallButton({ compact = false }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, isWindows, isInIframe, install } =
    usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Automatically suppress button once already running as an installed Windows / Mobile standalone app
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuide(true);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      // Ignore if clipboard blocked
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title="Install WG Pulse as a standalone Windows PC / Desktop App"
        data-snapshot-ignore="true"
        className={`inline-flex items-center gap-1.5 font-semibold rounded-xl border transition-colors whitespace-nowrap shrink-0 shadow-xs ${
          isInstallable
            ? 'border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-700'
            : 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/90 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
        } ${compact ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-2 text-xs'}`}
      >
        <MonitorDown className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">
          {isInstallable ? 'Install PC App' : 'Install App'}
        </span>
      </button>

      {showGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Install WG Pulse on Windows PC or Mobile"
          data-snapshot-ignore="true"
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-emerald-50/60 dark:bg-emerald-950/30">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-600 text-white">
                  <MonitorDown className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Install WG Pulse as a Windows PC App
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Standalone desktop window · Start Menu &amp; Taskbar shortcut · Offline cache
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close install guide"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700 dark:text-slate-300">
              {isInIframe && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-2">
                  <p className="font-semibold">
                    Open in a normal Chrome / Edge browser tab to trigger Windows 1-click install:
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    Browser security blocks desktop app installation inside embedded preview frames. Copy this app link and open it directly in Microsoft Edge or Google Chrome on Windows:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-2.5 py-1.5 rounded-lg bg-white/80 dark:bg-slate-950 border border-amber-200 dark:border-amber-900 font-mono text-[10px] truncate">
                      {typeof window !== 'undefined' ? window.location.href : ''}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyUrl}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold shrink-0"
                    >
                      {copiedUrl ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy URL
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {!isIOS ? (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                      <Download className="w-4 h-4 text-emerald-600" />
                      Windows PC — Google Chrome / Microsoft Edge
                    </div>
                    <ol className="list-decimal list-inside space-y-1.5 text-[11px] leading-relaxed">
                      <li>
                        Open WG Pulse in <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong> on Windows.
                      </li>
                      <li>
                        Click the <strong>Install WG Pulse</strong> icon{' '}
                        <span className="font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800">
                          ⊕ / App Install
                        </span>{' '}
                        at the right end of the address bar (or click <strong>Install PC App</strong> in the WG Pulse header).
                      </li>
                      <li>
                        Or open the browser menu (<strong>⋮</strong> in Chrome / <strong>⋯</strong> in Edge) → <strong>Apps</strong> → <strong>Install WG Pulse</strong>.
                      </li>
                      <li>
                        Tick <strong>Pin to Taskbar</strong> &amp; <strong>Create Desktop Shortcut</strong> to launch WG Pulse just like a native Windows program.
                      </li>
                    </ol>
                  </div>

                  {isWindows && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      සිංහල: Windows PC එකේ Chrome හෝ Edge browser එකේ address bar එකේ දකුණු කෙළවරේ ඇති <strong>Install</strong> icon එක click කර <strong>Install</strong> ඔබන්න. එවිට Desktop icon එකක් සහ Start Menu app එකක් ලෙස WG Pulse ස්ථාපනය වේ.
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    Install on iPhone / iPad (Safari)
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-[11px] leading-relaxed">
                    <li>
                      Tap the <strong>Share</strong> button in the Safari toolbar.
                    </li>
                    <li>
                      Scroll down and tap <strong>Add to Home Screen</strong>.
                    </li>
                    <li>
                      Tap <strong>Add</strong> to launch WG Pulse as a full-screen app.
                    </li>
                  </ol>
                </div>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      data-snapshot-ignore="true"
      className="fixed bottom-20 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg border border-amber-400/50"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      Offline Mode — Showing cached local data
    </div>
  );
}
