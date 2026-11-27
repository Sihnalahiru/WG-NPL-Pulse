import { useState } from 'react';
import { CheckCircle2, CloudUpload, KeyRound, Lock, ShieldCheck, Trash2, X } from 'lucide-react';
import { SecurityVaultIllustration } from './FinanceIllustrations';
import { getSavedGithubToken, saveGithubToken } from '../utils/githubSync';

interface AdminLoginModalProps {
  isOpen: boolean;
  isAdminAuthenticated: boolean;
  onClose: () => void;
  onLoginSuccess: (token: string) => void;
  onLogoutAdmin: () => void;
  onConfirmReset: () => Promise<void>;
  onForcePublishNow?: () => Promise<void>;
}

// Change this passcode anytime if needed
const ADMIN_PASSCODE = 'wgadmin2026';

export function AdminLoginModal({
  isOpen,
  isAdminAuthenticated,
  onClose,
  onLoginSuccess,
  onLogoutAdmin,
  onConfirmReset,
  onForcePublishNow,
}: AdminLoginModalProps) {
  const [password, setPassword] = useState('');
  const [ghToken, setGhToken] = useState(() => getSavedGithubToken());
  const [ghSavedFeedback, setGhSavedFeedback] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmResetChecked, setConfirmResetChecked] = useState(false);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || loading) return;

    setLoading(true);
    setErrorMsg(null);
    try {
      const entered = password.trim();
      // Try backend API first if running locally, otherwise verify client-side for GitHub Pages
      let verifiedToken: string | null = null;
      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: entered }),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            authenticated?: boolean;
            token?: string;
          };
          if (data.authenticated && data.token) {
            verifiedToken = data.token;
          }
        }
      } catch {
        // Static GitHub Pages environment (no /api server)
      }

      if (!verifiedToken) {
        if (entered === ADMIN_PASSCODE) {
          verifiedToken = `gh_pages_admin_${Date.now()}`;
        } else {
          throw new Error('Invalid Admin Password. Please try again.');
        }
      }

      setPassword('');
      onLoginSuccess(verifiedToken);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to verify admin password.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGhToken = () => {
    saveGithubToken(ghToken);
    setGhSavedFeedback(true);
    setTimeout(() => setGhSavedFeedback(false), 3000);
  };

  const handlePublishClick = async () => {
    if (!onForcePublishNow || loading) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      saveGithubToken(ghToken);
      await onForcePublishNow();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Live GitHub publish failed.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteReset = async () => {
    if (!confirmResetChecked || loading) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      await onConfirmReset();
      setConfirmResetChecked(false);
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Total app reset failed.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-modal-title"
    >
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <SecurityVaultIllustration className="w-10 h-10 shrink-0" />
            <div>
              <h2
                id="admin-modal-title"
                className="text-sm font-semibold text-slate-900 dark:text-slate-100"
              >
                {isAdminAuthenticated
                  ? 'WG Pulse Admin Control & Live Sync'
                  : 'Admin Log In Required'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Only Admin can upload AERS reports &amp; publish live data
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close admin modal"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          {!isAdminAuthenticated ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="wg-admin-passcode"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Admin Password
                </label>
                <input
                  id="wg-admin-passcode"
                  type="password"
                  autoFocus
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="w-full px-3.5 py-2.5 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Unlock Admin mode to upload daily AERS reports, edit watchlist contracts, and publish live updates to all users.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !password.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <Lock className="w-3.5 h-3.5" />
                  {loading ? 'Verifying...' : 'Unlock Admin'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 flex items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-300">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  Admin Mode Active (Upload &amp; Edit Unlocked)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onLogoutAdmin();
                    setConfirmResetChecked(false);
                  }}
                  className="text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:underline"
                >
                  Lock Session
                </button>
              </div>

              {/* GitHub Live Cloud Sync Configuration */}
              <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-900 dark:text-blue-200">
                  <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                  GitHub Live Cloud Sync (Everyone View)
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Paste your GitHub Personal Access Token (with <code>repo</code> scope) once. Whenever you upload an AERS Excel file, it automatically publishes live to all users.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={ghToken}
                    onChange={(e) => setGhToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="flex-1 px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={handleSaveGhToken}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 text-white hover:bg-slate-700 whitespace-nowrap"
                  >
                    Save Token
                  </button>
                </div>
                {ghSavedFeedback && (
                  <p className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3 h-3" />
                    Token saved on this Admin browser.
                  </p>
                )}
                {onForcePublishNow && ghToken.trim() && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handlePublishClick}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <CloudUpload className="w-3.5 h-3.5" />
                    {loading ? 'Publishing...' : 'Publish Current Data Live Now'}
                  </button>
                )}
              </div>

              {/* Total App Reset */}
              <div className="p-4 rounded-xl bg-red-50/70 dark:bg-red-950/30 border border-red-200 dark:border-red-900 space-y-3">
                <div className="text-xs font-semibold text-red-800 dark:text-red-300">
                  Total App Reset (Clear All Data)
                </div>
                <p className="text-xs text-red-700/90 dark:text-red-300/90 leading-relaxed">
                  This clears all Active Watchlist contracts, Visit History Logs, AERS Master Lookup data, Opening Baseline, and Monthly Snapshots from WG Pulse.
                </p>
                <label className="flex items-start gap-2 text-xs text-slate-800 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmResetChecked}
                    onChange={(e) => setConfirmResetChecked(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-red-600 focus:ring-red-500"
                  />
                  <span>
                    I confirm I want to permanently reset all WG Pulse data.
                  </span>
                </label>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    disabled={!confirmResetChecked || loading}
                    onClick={handleExecuteReset}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {loading ? 'Resetting...' : 'Reset Total App'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
