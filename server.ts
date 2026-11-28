import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// Ephemeral session signing secret fallback if ADMIN_SESSION_SECRET is not set
const SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// Salted scrypt digest fallback when ADMIN_PASSCODE env override is unset
const DEFAULT_ADMIN_SCRYPT_DIGEST =
  'wg_pulse_admin_salt_2026:bc14e92fc5751d2a19a7c67039e41dff309a190be44c1ac1f51ec24ce16ddeac5794c563627285803fabee33dc0cfc31471f2c16d3d2b992beb6f00014dbb9e1';

interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

interface AnalyzeRequestBody {
  message?: string;
  history?: ChatTurn[];
  portfolioContext?: Record<string, unknown>;
}

interface MapsGroundingRequestBody {
  query?: string;
  latLng?: {
    latitude?: number;
    longitude?: number;
  };
}

interface AdminLoginBody {
  password?: string;
}

function verifyAdminPassword(candidate: string): boolean {
  const configured = (process.env.ADMIN_PASSCODE || '').trim();
  if (configured.length > 0) {
    const a = crypto.createHash('sha256').update(candidate).digest();
    const b = crypto.createHash('sha256').update(configured).digest();
    return crypto.timingSafeEqual(a, b);
  }

  const [salt, expectedHex] = DEFAULT_ADMIN_SCRYPT_DIGEST.split(':');
  if (!salt || !expectedHex) return false;
  const derived = crypto.scryptSync(candidate, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function issueAdminToken(): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + 2 * 60 * 60 * 1000; // 2 hours
  const payload = Buffer.from(
    JSON.stringify({ role: 'admin', exp: expiresAt, jti: crypto.randomBytes(8).toString('hex') }),
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  return { token: `${payload}.${sig}`, expiresAt };
}

function verifyAdminToken(authHeader?: string): boolean {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7).trim();
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as { role?: string; exp?: number };
    return (
      parsed.role === 'admin' &&
      typeof parsed.exp === 'number' &&
      parsed.exp > Date.now()
    );
  } catch {
    return false;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Simple in-memory rate tracker for admin login attempts per IP
  const loginAttempts = new Map<string, { count: number; resetAt: number }>();

  app.post('/api/admin/login', (req, res) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const tracker = loginAttempts.get(ip);
    if (tracker && tracker.resetAt > now && tracker.count >= 12) {
      res.status(429).json({
        error: 'Too many login attempts. Please wait a minute and try again.',
      });
      return;
    }

    const body = (req.body ?? {}) as AdminLoginBody;
    const password = typeof body.password === 'string' ? body.password.trim() : '';
    if (!password) {
      res.status(400).json({ error: 'Admin password is required.' });
      return;
    }

    if (!verifyAdminPassword(password)) {
      const nextCount =
        tracker && tracker.resetAt > now ? tracker.count + 1 : 1;
      loginAttempts.set(ip, { count: nextCount, resetAt: now + 60_000 });
      res.status(401).json({ error: 'Invalid admin password.' });
      return;
    }

    loginAttempts.delete(ip);
    const { token, expiresAt } = issueAdminToken();
    res.json({ authenticated: true, token, expiresAt });
  });

  app.post('/api/admin/verify', (req, res) => {
    if (!verifyAdminToken(req.headers.authorization)) {
      res.status(401).json({ authenticated: false, error: 'Admin session expired or invalid.' });
      return;
    }
    res.json({ authenticated: true });
  });

  app.post('/api/admin/authorize-reset', (req, res) => {
    if (!verifyAdminToken(req.headers.authorization)) {
      res.status(403).json({
        authorized: false,
        error: 'Admin login is required to reset all application data.',
      });
      return;
    }
    res.json({ authorized: true, authorizedAt: new Date().toISOString() });
  });

  app.post('/api/ai/analyze', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error:
          'GEMINI_API_KEY is not configured. Please check your key in the Settings > Secrets panel.',
      });
      return;
    }

    const body = (req.body ?? {}) as AnalyzeRequestBody;
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) {
      res.status(400).json({ error: 'Prompt message is required.' });
      return;
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const contextSummary = JSON.stringify(body.portfolioContext ?? {}, null, 2);

    const systemInstruction = `You are WG Pulse AI Recovery Strategist, an expert Leasing & Finance Credit Recovery Analyst.
You analyze the user's live Age Evaluation Report Sub (AERS) and Active Watchlist portfolio context and give clear, actionable recommendations.
Domain Rules you strictly understand and apply:
1. Office Type Main Hierarchy: When evaluating NPL or Borderline contracts, the primary grouping is Office Type, with Recovery Officer (RO Name) nested underneath each Office Type.
2. Op Npl & DPD Rule: Accounts with Op Npl > 0 were already in NPL previously. Regardless of Current Age, if ACTUAL_DPD >= 91 or NPL > 0, they are active NPL accounts and must be tracked by DPD and Op Npl vs Closing NPL.
3. Borderline Rule (61-90 DPD): Accounts below 91 DPD that are in 61-90 DPD or have MONTH_END_FORECAST_DPD >= 91 will fall into NPL this month-end or next month (+30 days) unless arrears/dues are settled before month-end. Do NOT quote static minimum reversal amounts because Default Interest (DI), recovery charges, and debit amounts change dynamically — focus on Closing Debtor, Projected NPL (Capital + Arrears), and live collections.
4. Assign Officer Efforts: Check Assign Officer Efforts on borderline and worst accounts — zero-effort or low-effort accounts need immediate field visits or calls.
5. WORST Category (Npl Reason = "W"): Any contract with Npl Reason "W" (WORST) requires top executive priority regardless of its DPD.
6. Language: Respond in clear, structured prose/bullets matching the user's language (English, Sinhala, or Singlish). Always quote exact Office Types, contract numbers, officer names, DPD counts, and Rs. figures from the provided context. Never invent contract numbers or amounts.

LIVE PORTFOLIO CONTEXT:
${contextSummary}`;

    try {
      const historyTurns = Array.isArray(body.history)
        ? body.history.slice(-8).map((turn) => ({
            role: turn.role === 'model' ? 'model' : 'user',
            parts: [{ text: String(turn.text ?? '') }],
          }))
        : [];

      const contents = [
        ...historyTurns,
        { role: 'user', parts: [{ text: message }] },
      ];

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction,
        },
      });

      const replyText = response.text?.trim();
      if (!replyText) {
        res.status(502).json({
          error: 'AI model returned an empty response. Please try again.',
        });
        return;
      }

      res.json({ reply: replyText });
    } catch (err) {
      const status =
        typeof (err as { status?: number })?.status === 'number'
          ? (err as { status: number }).status
          : 500;
      const errMessage =
        err instanceof Error ? err.message : 'Failed to query Gemini AI.';
      res.status(status >= 400 && status < 600 ? status : 500).json({
        error: errMessage,
      });
    }
  });

  app.post('/api/ai/maps-grounding', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error:
          'GEMINI_API_KEY is not configured. Please check your key in the Settings > Secrets panel.',
      });
      return;
    }

    const body = (req.body ?? {}) as MapsGroundingRequestBody;
    const query = typeof body.query === 'string' ? body.query.trim() : '';
    if (!query) {
      res.status(400).json({ error: 'Location search query is required.' });
      return;
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const hasValidCoords =
      typeof body.latLng?.latitude === 'number' &&
      Number.isFinite(body.latLng.latitude) &&
      typeof body.latLng?.longitude === 'number' &&
      Number.isFinite(body.latLng.longitude);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Field Recovery Location & Route Context (Sri Lanka / Leasing Operations): ${query}`,
        config: {
          tools: [{ googleMaps: {} }],
          ...(hasValidCoords
            ? {
                toolConfig: {
                  retrievalConfig: {
                    latLng: {
                      latitude: body.latLng!.latitude!,
                      longitude: body.latLng!.longitude!,
                    },
                  },
                },
              }
            : {}),
        },
      });

      const replyText = response.text?.trim() || 'Location search completed.';
      const rawChunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];

      const mapsChunks: {
        title: string;
        uri: string;
        reviewSnippets?: string[];
      }[] = [];

      for (const chunk of rawChunks) {
        const mapsData = (
          chunk as {
            maps?: {
              title?: string;
              uri?: string;
              placeAnswerSources?: {
                reviewSnippets?: { content?: string }[];
              };
            };
          }
        )?.maps;

        if (mapsData?.uri) {
          const snippets = Array.isArray(
            mapsData.placeAnswerSources?.reviewSnippets,
          )
            ? mapsData.placeAnswerSources!.reviewSnippets
                .map((s) => s?.content?.trim())
                .filter((s): s is string => Boolean(s))
            : undefined;

          mapsChunks.push({
            title: mapsData.title || 'Open Place in Google Maps',
            uri: mapsData.uri,
            reviewSnippets: snippets && snippets.length > 0 ? snippets : undefined,
          });
        }
      }

      res.json({
        reply: replyText,
        mapsChunks,
      });
    } catch (err) {
      const status =
        typeof (err as { status?: number })?.status === 'number'
          ? (err as { status: number }).status
          : 500;
      const errMessage =
        err instanceof Error
          ? err.message
          : 'Failed to query Gemini Maps Grounding.';
      res.status(status >= 400 && status < 600 ? status : 500).json({
        error: errMessage,
      });
    }
  });

  if (!IS_PROD) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WG Pulse server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
