import type {
  AersMetadata,
  AersRecord,
  FileUploadHistoryEntry,
  MonthlySnapshot,
  MrpEnrichment,
  OpeningOfficerBaseline,
  StaffAssignedContract,
  TrackedContract,
} from '../types/recovery';

export const GITHUB_OWNER = 'Sihnalahiru';
export const GITHUB_REPO = 'WG-NPL-Pulse';
export const LIVE_SYNC_REPO_LABEL = `${GITHUB_OWNER}/${GITHUB_REPO}`;
const LIVE_DATA_PATH = 'public/data/live-pulse-data.json';
const GH_TOKEN_STORAGE_KEY = 'wg_v2_admin_gh_pat';
const GH_TOKEN_BACKUP_KEY = 'wg_permanent_gh_pat_vault';
const IDB_DB_NAME = 'wg_pulse_permanent_vault';
const IDB_STORE_NAME = 'permanent_config';
const IDB_TOKEN_KEY = 'github_live_pat';
const LIVE_SYNC_CHANNEL_NAME = 'wg_pulse_live_sync_v2';

// In-memory permanent mirror so token is immediately available and never expires in-app
let inMemoryPermanentToken = '';
let hydrationPromise: Promise<string> | null = null;
const tokenListeners = new Set<() => void>();

function notifyTokenListeners(): void {
  tokenListeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // Ignore listener errors
    }
  });
}

export function subscribeGithubTokenChange(listener: () => void): () => void {
  tokenListeners.add(listener);
  return () => {
    tokenListeners.delete(listener);
  };
}

function openPermanentVaultDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
          db.createObjectStore(IDB_STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readTokenFromIndexedDB(): Promise<string> {
  const db = await openPermanentVaultDB();
  if (!db) return '';
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.get(IDB_TOKEN_KEY);
      req.onsuccess = () => {
        const val = req.result;
        if (typeof val === 'string') {
          resolve(val.trim());
        } else if (val && typeof val === 'object' && typeof val.token === 'string') {
          resolve(val.token.trim());
        } else {
          resolve('');
        }
      };
      req.onerror = () => resolve('');
      tx.oncomplete = () => {
        try {
          db.close();
        } catch {
          // Ignore
        }
      };
    } catch {
      resolve('');
    }
  });
}

async function writeTokenToIndexedDB(token: string): Promise<void> {
  const db = await openPermanentVaultDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      store.put(
        {
          token,
          permanent: true,
          neverExpires: true,
          savedAt: new Date().toISOString(),
        },
        IDB_TOKEN_KEY,
      );
      tx.oncomplete = () => {
        try {
          db.close();
        } catch {
          // Ignore
        }
        resolve();
      };
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function readTokenFromLocalStorage(): string {
  try {
    const primary = (localStorage.getItem(GH_TOKEN_STORAGE_KEY) || '').trim();
    if (primary) return primary;
    const backup = (localStorage.getItem(GH_TOKEN_BACKUP_KEY) || '').trim();
    if (backup) {
      localStorage.setItem(GH_TOKEN_STORAGE_KEY, backup);
      return backup;
    }
  } catch {
    // Ignore storage restriction
  }
  return '';
}

function writeTokenToLocalStorage(token: string): void {
  try {
    localStorage.setItem(GH_TOKEN_STORAGE_KEY, token);
    localStorage.setItem(GH_TOKEN_BACKUP_KEY, token);
  } catch {
    // Ignore storage restriction
  }
}

export interface LiveCloudPayload {
  updatedAt: string;
  updatedBy: string;
  aersRecords: AersRecord[];
  aersMeta: AersMetadata | null;
  mrpMap: Record<string, MrpEnrichment>;
  openingBaseline: OpeningOfficerBaseline | null;
  trackedContracts: TrackedContract[];
  monthlySnapshots: MonthlySnapshot[];
  staffAssignments?: StaffAssignedContract[];
  uploadHistory?: FileUploadHistoryEntry[];
}

export function getSavedGithubToken(): string {
  if (inMemoryPermanentToken) return inMemoryPermanentToken;
  const stored = readTokenFromLocalStorage();
  if (stored) {
    inMemoryPermanentToken = stored;
    // Mirror into IndexedDB vault silently so it survives localStorage clears
    writeTokenToIndexedDB(stored).catch(() => {});
    return stored;
  }
  return '';
}

/**
 * Hydrates the permanent, non-expiring GitHub token from localStorage or IndexedDB vault.
 * Once saved, the token never expires and is automatically restored across reloads & PWA launches.
 */
export async function hydratePermanentGithubToken(): Promise<string> {
  const existing = getSavedGithubToken();
  if (existing) {
    await writeTokenToIndexedDB(existing);
    return existing;
  }
  if (!hydrationPromise) {
    hydrationPromise = readTokenFromIndexedDB()
      .then((vaultToken) => {
        if (vaultToken) {
          inMemoryPermanentToken = vaultToken;
          writeTokenToLocalStorage(vaultToken);
          notifyTokenListeners();
        }
        return vaultToken;
      })
      .finally(() => {
        hydrationPromise = null;
      });
  }
  return hydrationPromise;
}

export function hasConfiguredGithubToken(): boolean {
  return getSavedGithubToken().trim().length > 0;
}

export function getMaskedGithubTokenPreview(): string {
  const token = getSavedGithubToken();
  if (!token) return '';
  if (token.length <= 10) return '••••••••';
  return `${token.slice(0, 6)}••••••••${token.slice(-4)}`;
}

/**
 * Saves the GitHub token permanently with NO expiration.
 * Rule: Never overwrites or erases an already-saved token with an empty string.
 */
export function saveGithubToken(token: string): boolean {
  const clean = token.trim();
  if (!clean) {
    // Strict permanence rule: never wipe an existing saved token via blank save
    return false;
  }
  inMemoryPermanentToken = clean;
  writeTokenToLocalStorage(clean);
  writeTokenToIndexedDB(clean).catch(() => {});
  notifyTokenListeners();
  return true;
}

export function notifyLocalTabsOfUpdate(updatedAt: string): void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return;
  }
  try {
    const channel = new BroadcastChannel(LIVE_SYNC_CHANNEL_NAME);
    channel.postMessage({ type: 'LIVE_DATA_UPDATED', updatedAt });
    channel.close();
  } catch {
    // Ignore if BroadcastChannel is restricted
  }
}

export function subscribeLocalTabUpdates(
  onUpdate: (updatedAt: string) => void,
): () => void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return () => {};
  }
  try {
    const channel = new BroadcastChannel(LIVE_SYNC_CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent) => {
      const msg = event.data as { type?: string; updatedAt?: string } | null;
      if (msg && msg.type === 'LIVE_DATA_UPDATED' && typeof msg.updatedAt === 'string') {
        onUpdate(msg.updatedAt);
      }
    };
    return () => {
      try {
        channel.close();
      } catch {
        // Ignore
      }
    };
  } catch {
    return () => {};
  }
}

async function tryFetchGithubApiRaw(
  ts: number,
  token?: string,
): Promise<LiveCloudPayload | null> {
  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3.raw',
    };
    if (token && token.trim()) {
      headers.Authorization = `Bearer ${token.trim()}`;
    }
    const apiRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${LIVE_DATA_PATH}?t=${ts}`,
      {
        headers,
        cache: 'no-store',
      },
    );
    if (apiRes.ok) {
      const data = (await apiRes.json()) as LiveCloudPayload;
      if (data && Array.isArray(data.aersRecords)) {
        return data;
      }
    }
  } catch {
    // Fall through to next live endpoint
  }
  return null;
}

async function tryFetchRawGithub(ts: number): Promise<LiveCloudPayload | null> {
  try {
    const rawRes = await fetch(
      `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/${LIVE_DATA_PATH}?t=${ts}`,
      {
        cache: 'no-store',
      },
    );
    if (rawRes.ok) {
      const data = (await rawRes.json()) as LiveCloudPayload;
      if (data && Array.isArray(data.aersRecords)) {
        return data;
      }
    }
  } catch {
    // Fall through to static hosted path
  }
  return null;
}

async function tryFetchStaticHosted(ts: number): Promise<LiveCloudPayload | null> {
  try {
    const staticRes = await fetch(`./data/live-pulse-data.json?t=${ts}`, {
      cache: 'no-store',
    });
    if (staticRes.ok) {
      const data = (await staticRes.json()) as LiveCloudPayload;
      if (data && Array.isArray(data.aersRecords)) {
        return data;
      }
    }
  } catch {
    // No remote file yet
  }
  return null;
}

// Fetch latest shared data for ALL users (Browser URL & Installed Windows PC App)
export async function fetchLiveCloudData(options?: {
  background?: boolean;
}): Promise<LiveCloudPayload | null> {
  const ts = Date.now();
  const savedToken = await hydratePermanentGithubToken();

  // If Admin has a permanent GitHub token, authenticated API gives 5,000 req/hr with 0s CDN delay
  if (savedToken) {
    const apiData = await tryFetchGithubApiRaw(ts, savedToken);
    if (apiData) return apiData;
  }

  // On background auto-polling without token, prefer raw.githubusercontent.com first
  // so shared branch-office IPs never hit GitHub's 60 req/hr unauthenticated API limit
  if (options?.background) {
    const rawData = await tryFetchRawGithub(ts);
    if (rawData) return rawData;

    const staticData = await tryFetchStaticHosted(ts);
    if (staticData) return staticData;

    return tryFetchGithubApiRaw(ts);
  }

  // On initial load / manual refresh: try GitHub API raw (0s delay) -> raw.githubusercontent -> static Pages
  const apiData = await tryFetchGithubApiRaw(ts);
  if (apiData) return apiData;

  const rawData = await tryFetchRawGithub(ts);
  if (rawData) return rawData;

  return tryFetchStaticHosted(ts);
}

// Push updated data to GitHub repo (Admin only)
export async function publishLiveCloudData(
  payload: LiveCloudPayload,
  githubToken: string,
): Promise<void> {
  const token = githubToken.trim() || (await hydratePermanentGithubToken());
  if (!token) {
    throw new Error('GitHub Personal Access Token is required once to enable permanent live sync.');
  }

  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${LIVE_DATA_PATH}`;

  // Get existing file SHA if it exists
  let sha: string | undefined;
  const getRes = await fetch(`${apiUrl}?t=${Date.now()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
    cache: 'no-store',
  });

  if (getRes.ok) {
    const existing = (await getRes.json()) as { sha?: string };
    sha = existing.sha;
  }

  // Encode JSON safely as UTF-8 Base64
  const jsonString = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(jsonString);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const contentBase64 = btoa(binary);

  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `Live AERS & Upload Sync (${payload.updatedAt})`,
      content: contentBase64,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!putRes.ok) {
    const errBody = await putRes.text();
    throw new Error(`GitHub Sync failed (${putRes.status}): ${errBody.slice(0, 140)}`);
  }

  // Also broadcast instantly to any other open browser tabs or installed PC PWA windows on this machine
  notifyLocalTabsOfUpdate(payload.updatedAt);
}
