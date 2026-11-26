import { useState } from 'react';
import { Lock, ShieldCheck, Trash2, X } from 'lucide-react';
import { SecurityVaultIllustration } from './FinanceIllustrations';

interface AdminLoginModalProps {
  isOpen: boolean;
  isAdminAuthenticated: boolean;
  onClose: () => void;
  onLoginSuccess: (token: string) => void;
  onLogoutAdmin: () => void;
  onConfirmReset: () => Promise<void>;
}

export function AdminLoginModal({
  isOpen,
  isAdminAuthenticated,
  onClose,
  onLoginSuccess,
  onLogoutAdmin,
  onConfirmReset,
}: AdminLoginModalProps) {
  const [password, setPassword] = useState('');
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
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() }),
      });
      const data = (await res.json()) as {
        authenticated?: boolean;
        token?: string;
        error?: string;
      };
      if (!res.ok || !data.authenticated || !data.token) {
        throw new Error(data.error || 'Admin verification failed.');
      }
      setPassword('');
      onLoginSuccess(data.token);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to verify admin password.',
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
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <SecurityVaultIllustration className="w-10 h-10 shrink-0" />
            <div>
              <h2
                id="admin-modal-title"
                className="text-sm font-semibold text-slate-900 dark:text-slate-100"
              >
                {isAdminAuthenticated
                  ? 'WG Pulse Admin Control'
                  : 'Admin Log In Required'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Protected gateway for Total App Reset &amp; system wipe
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
                  Verified server-side before unlocking Total App Reset controls.
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
                  Admin Session Active (In-Memory)
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
