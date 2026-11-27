import type {
  AersMetadata,
  AersRecord,
  MonthlySnapshot,
  MrpEnrichment,
  OpeningOfficerBaseline,
  TrackedContract,
} from '../types/recovery';

const GITHUB_OWNER = 'Sihnalahiru';
const GITHUB_REPO = 'WG-NPL-Pulse';
const LIVE_DATA_PATH = 'public/data/live-pulse-data.json';
const GH_TOKEN_STORAGE_KEY = 'wg_v2_admin_gh_pat';

export interface LiveCloudPayload {
  updatedAt: string;
  updatedBy: string;
  aersRecords: AersRecord[];
  aersMeta: AersMetadata | null;
  mrpMap: Record<string, MrpEnrichment>;
  openingBaseline: OpeningOfficerBaseline | null;
  trackedContracts: TrackedContract[];
  monthlySnapshots: MonthlySnapshot[];
}

export function getSavedGithubToken(): string {
  try {
    return localStorage.getItem(GH_TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveGithubToken(token: string): void {
  try {
    const clean = token.trim();
    if (clean) {
      localStorage.setItem(GH_TOKEN_STORAGE_KEY, clean);
    } else {
      localStorage.removeItem(GH_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore
  }
}

// Fetch latest shared data for ALL users (Officers, BMs, Guests) instantly
export async function fetchLiveCloudData(): Promise<LiveCloudPayload | null> {
  const ts = Date.now();
  // 1. Try GitHub API raw endpoint first (instant updates with 0 CDN delay)
  try {
    const apiRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${LIVE_DATA_PATH}?t=${ts}`,
      {
        headers: {
          Accept: 'application/vnd.github.v3.raw',
        },
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
    // Fallback to static hosted path
  }

  // 2. Fallback to static path on GitHub Pages
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

// Push updated data to GitHub repo (Admin only)
export async function publishLiveCloudData(
  payload: LiveCloudPayload,
  githubToken: string,
): Promise<void> {
  const token = githubToken.trim();
  if (!token) {
    throw new Error('GitHub Personal Access Token is required to publish live updates.');
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
      message: `Live AERS & Watchlist sync (${payload.updatedAt})`,
      content: contentBase64,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!putRes.ok) {
    const errBody = await putRes.text();
    throw new Error(`GitHub Sync failed (${putRes.status}): ${errBody.slice(0, 140)}`);
  }
}
