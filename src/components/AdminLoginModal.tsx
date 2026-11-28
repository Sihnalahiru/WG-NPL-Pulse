import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  CloudUpload,
  Infinity as InfinityIcon,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { SecurityVaultIllustration } from './FinanceIllustrations';
import {
  getMaskedGithubTokenPreview,
  hasConfiguredGithubToken,
  hydratePermanentGithubToken,
  saveGithubToken,
  subscribeGithubTokenChange,
} from '../utils/githubSync';

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
  const [hasPermanentToken, setHasPermanentToken] = useState(() =>
    hasConfiguredGithubToken(),
  );
  const [maskedToken, setMaskedToken] = useState(() =>
    getMaskedGithubTokenPreview(),
  );
  const [ghTokenInput, setGhTokenInput] = useState('');
  const [isReplacingToken, setIsReplacingToken] = useState(false);
  const [ghSavedFeedback, setGhSavedFeedback] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmResetChecked, setConfirmResetChecked] = useState(false);

  useEffect(() => {
    const syncTokenState = () => {
      setHasPermanentToken(hasConfiguredGithubToken());
      setMaskedToken(getMaskedGithubTokenPreview());
    };
    hydratePermanentGithubToken().then(syncTokenState).catch(() => {});
    return subscribeGithubTokenChange(syncTokenState);
  }, [isOpen]);

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
    const clean = ghTokenInput.trim();
    if (!clean) {
      setErrorMsg('Please paste a valid GitHub Personal Access Token.');
      return;
    }
    setErrorMsg(null);
    saveGithubToken(clean);
    setGhTokenInput('');
    setIsReplacingToken(false);
    setHasPermanentToken(true);
    setMaskedToken(getMaskedGithubTokenPreview());
    setGhSavedFeedback(true);
    setTimeout(() => setGhSavedFeedback(false), 4000);
  };

  const handlePublishClick = async () => {
    if (!onForcePublishNow || loading) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      if (ghTokenInput.trim()) {
        saveGithubToken(ghTokenInput);
        setGhTokenInput('');
        setIsReplacingToken(false);
      }
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

  const showTokenSetupForm = !hasPermanentToken || isReplacingToken;

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
                  Unlock Admin mode to upload daily AERS reports, manage Assign User rosters, and publish live updates to all users.
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

              {/* GitHub Live Cloud Sync — Permanent One-Time Setup Rule */}
              <div
                className={`p-4 rounded-xl border space-y-3 ${
                  hasPermanentToken && !isReplacingToken
                    ? 'bg-emerald-50/60 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-900/70'
                    : 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div
                    className={`flex items-center gap-1.5 text-xs font-semibold ${
                      hasPermanentToken && !isReplacingToken
                        ? 'text-emerald-900 dark:text-emerald-200'
                        : 'text-blue-900 dark:text-blue-200'
                    }`}
                  >
                    {hasPermanentToken && !isReplacingToken ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                    )}
                    {hasPermanentToken && !isReplacingToken
                      ? 'Permanent Live Sync Connected'
                      : 'One-Time GitHub Live Sync Setup'}
                  </div>

                  {hasPermanentToken && !isReplacingToken && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                      <InfinityIcon className="w-3 h-3" />
                      Never Expires
                    </span>
                  )}
                </div>

                {!showTokenSetupForm ? (
                  <div className="space-y-2.5">
                    <p className="text-[11px] text-emerald-900/85 dark:text-emerald-200/85 leading-relaxed">
                      Your GitHub token is permanently saved in the dual browser vault (<code>localStorage + IndexedDB</code>). It will <strong>never expire</strong> and will <strong>never ask again</strong> — every file upload auto-publishes live to all URL &amp; Windows PC App users.
                    </p>
                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/80 dark:bg-slate-950/80 border border-emerald-200/80 dark:border-emerald-900/60 text-[11px]">
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        Saved Key: <strong>{maskedToken}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsReplacingToken(true)}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Replace
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      Add your GitHub Personal Access Token (<code>repo</code> scope, set to <strong>No expiration</strong> on GitHub) <strong>once</strong>. After saving, WG Pulse locks it permanently and never asks for it again.
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        value={ghTokenInput}
                        onChange={(e) => setGhTokenInput(e.target.value)}
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                        className="flex-1 px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={handleSaveGhToken}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 text-white hover:bg-slate-700 whitespace-nowrap"
                      >
                        Save Permanently
                      </button>
                    </div>
                    {isReplacingToken && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsReplacingToken(false);
                          setGhTokenInput('');
                        }}
                        className="text-[11px] text-slate-500 hover:underline"
                      >
                        Cancel (keep existing permanent token)
                      </button>
                    )}
                  </div>
                )}

                {ghSavedFeedback && (
                  <p className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Token locked permanently — will never expire or ask again.
                  </p>
                )}

                {onForcePublishNow && (hasPermanentToken || ghTokenInput.trim()) && (
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
                  This clears all AERS Master Lookup data, Assign User Follow-Up rosters, Opening Baseline, and Daily/Monthly Snapshots from WG Pulse. Your permanent GitHub Live Sync token remains safely preserved.
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
