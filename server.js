import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { formatFullPackageName, getSoraGameCode } from './src/data/games.js';
import * as db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Body parsers with 50mb limit for image uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const PAYLINK_CONFIG = {
  baseUrl: process.env.PAYLINK_BASE_URL || 'https://paylinkapibank.com/api/v2',
  apiKey: process.env.PAYLINK_API_KEY || 'plk_live_std_fe2ce372bdada7a311fce1d62bdbf42478ee',
  secret: process.env.PAYLINK_SECRET || 'whsec_084215e3222d3b7350c9d2d2ac38fb556455c0507c2ef2453d31c7ecffe88fc6',
  storeName: process.env.STORE_NAME || 'ONE LOVE TOPUP',
  bakongId: process.env.BAKONG_ID || 'onelo@bkrt',
};

function getPaylinkEndpoint(subpath) {
  const base = (PAYLINK_CONFIG.baseUrl || 'https://paylinkapibank.com/api/v2').replace(/\/+$/, '');
  const clean = subpath.replace(/^\/+/, '');
  if (base.includes('/api/v2')) {
    const withoutApi = clean.replace(/^api\//, '');
    return `${base}/${withoutApi}`;
  }
  return `${base}/${clean}`;
}

function sanitizeBakongKHQR(qrStr) {
  if (!qrStr || typeof qrStr !== 'string') return qrStr;
  // IMPORTANT: Return Paylink's KHQR string EXACTLY as issued.
  // Paylink registers each transaction against the merchant account embedded in
  // this QR and reconciles the incoming payment by that exact value. Rewriting
  // the account here (previously onelo@bkrtONE -> onelo@bkrt + recomputed CRC)
  // made the customer pay a QR that Paylink was NOT tracking, so /payment/check
  // always returned PENDING / TRANSACTION_NOT_FOUND and orders never dispatched.
  return qrStr;
}

const SORA_CONFIG = {
  baseUrl: process.env.SORA_BASE_URL || 'https://app.soratopup.com/api/v1',
  apiKey: process.env.SORA_API_KEY || 'sk_7fbe263e907ce46212397f6746d4cd5c7bb65c0932ef666f'
};

// Tracks orders currently being dispatched so concurrent client polls can't double-order.
const dispatchingOrders = new Set();

// Store game id (and accepted aliases) -> canonical store game id used for settings & prices.
const GAME_KEY_ALIASES = {
  'mobile-legends': 'mobile-legends', 'ml': 'mobile-legends',
  'free-fire': 'free-fire', 'ff': 'free-fire',
  'roblox': 'roblox', 'robux': 'roblox',
  'pubg-mobile': 'pubg-mobile', 'pubgm': 'pubg-mobile',
  'blood-strike': 'blood-strike', 'bloodstrike': 'blood-strike',
  'zepeto': 'zepeto'
};
function normalizeGameKey(game) {
  return GAME_KEY_ALIASES[String(game || '').trim().toLowerCase()] || null;
}
const GAME_LABELS = {
  'mobile-legends': 'Mobile Legends',
  'free-fire': 'Free Fire Mobile',
  'roblox': 'Roblox (Robux)',
  'pubg-mobile': 'PUBG Mobile',
  'blood-strike': 'Blood Strike',
  'zepeto': 'Zepeto'
};

const LOOKUP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

// GoPay Games account lookup (PUBG Mobile: code PUBG_ID, Zepeto: code ZEPETO).
// Returns { found: true, name, country } | { found: false } (ID rejected) | { found: null } (lookup unavailable).
async function lookupGopayAccount(code, userId, zoneId = '') {
  try {
    const r = await fetch('https://gopay.co.id/games/v1/order/user-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': LOOKUP_UA },
      body: JSON.stringify({ code, data: { userId, zoneId } }),
      signal: AbortSignal.timeout(8000)
    });
    const d = await r.json().catch(() => null);
    if (r.ok && d && String(d.message || '').toLowerCase() === 'success' && d.data && d.data.username) {
      // GoPay returns the name form-encoded (spaces as "+").
      let name = String(d.data.username).replace(/\+/g, ' ');
      try { name = decodeURIComponent(name); } catch (_) { }
      return { found: true, name: name.trim(), country: d.data.countryOrigin || '' };
    }
    if (r.status === 404) return { found: false };
    return { found: null };
  } catch (e) {
    console.warn(`[check-player] GoPay ${code} lookup error:`, e.message);
    return { found: null };
  }
}

// Blood Strike role lookup on NetEase's official top-up center (single server, host -1).
async function lookupBloodStrikeRole(roleId) {
  try {
    const qs = new URLSearchParams({
      deviceid: crypto.randomBytes(8).toString('hex'),
      traceid: crypto.randomUUID(),
      timestamp: String(Date.now()),
      gc_client_version: '1.10.5',
      roleid: roleId,
      client_type: 'gameclub'
    });
    const r = await fetch(`https://pay.neteasegames.com/gameclub/bloodstrike/-1/login-role?${qs}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': LOOKUP_UA, 'Referer': 'https://pay.neteasegames.com/bloodstrike/topup' },
      signal: AbortSignal.timeout(8000)
    });
    const d = await r.json().catch(() => null);
    if (d && d.code === '0000' && d.data) {
      const name = d.data.rolename || d.data.role_name || d.data.nickname || d.data.name || '';
      return { found: true, name: String(name).trim(), level: d.data.level || d.data.role_level || null };
    }
    // 0206 = "role login failed": NetEase has no role with this ID.
    if (d && d.code === '0206') return { found: false };
    console.warn('[check-player] Blood Strike unexpected NetEase response:', r.status, d && d.code, d && d.msg);
    return { found: null };
  } catch (e) {
    console.warn('[check-player] Blood Strike lookup error:', e.message);
    return { found: null };
  }
}

// Look up a Sora order (and its delivered Robux code) by its reference id.
async function fetchSoraOrderByRef(ref) {
  if (!ref) return null;
  try {
    const r = await fetch(`${SORA_CONFIG.baseUrl}/orders`, {
      headers: { 'Authorization': `Bearer ${SORA_CONFIG.apiKey}` }
    });
    const d = await r.json().catch(() => ({}));
    const list = Array.isArray(d.orders) ? d.orders : [];
    return list.find(o => o.refid === ref || o.ref === ref || o.orderRef === ref) || null;
  } catch (e) {
    console.warn('[sora] fetchSoraOrderByRef error:', e.message);
    return null;
  }
}

// Extract a redeemable Robux code from a Sora order/response (ignores the numeric result code).
function extractRobuxCode(obj) {
  if (!obj) return '';
  const candidates = [obj.code, obj.redeemCode, obj.cardCode, obj.serial, obj.pin];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length >= 4) return c.trim();
  }
  return '';
}

const TELEGRAM_CONFIG = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '9095657133:AAFL4Yjo5ruXLeHw1BFhkr8KAXp61YF48YE',
  groupId: process.env.TELEGRAM_GROUP_ID || '-5416787286',
  adminChatIds: ['6389405398', '7283817695']
};

async function sendTelegramMessage(chatId, text, parseMode = 'Markdown') {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_CONFIG.botToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode
      })
    });
    return await res.json();
  } catch (err) {
    console.warn(`Telegram send to ${chatId} failed:`, err.message);
    return { ok: false, error: err.message };
  }
}

const SETTINGS_FILE = path.resolve(__dirname, 'admin-settings.json');

async function getSavedSettings() {
  return await db.getSettings();
}

async function saveSettingsFile(data) {
  return await db.saveSettings(data);
}

function formatTag(tag, value) {
  const str = String(value);
  return tag + String(str.length).padStart(2, '0') + str;
}

function crc16(str) {
  let crc = 0xFFFF;
  for (let c = 0; c < str.length; c++) {
    crc ^= str.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i++) {
      if ((crc & 0x8000) !== 0) crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      else crc = (crc << 1) & 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function buildBakongKHQR(amount, currency = 'USD', tranId) {
  const numericAmount = Math.max(0.1, Number(amount) || 1.00);
  let qr = '';
  qr += formatTag('00', '01');
  qr += formatTag('01', '12');
  qr += formatTag('29', formatTag('00', PAYLINK_CONFIG.bakongId));
  qr += formatTag('52', '5999');
  qr += formatTag('53', currency === 'KHR' ? '116' : '840');
  qr += formatTag('54', numericAmount.toFixed(2));
  qr += formatTag('58', 'KH');
  qr += formatTag('59', PAYLINK_CONFIG.storeName);
  qr += formatTag('60', 'Phnom Penh');
  const sub62 = formatTag('01', tranId) + formatTag('03', PAYLINK_CONFIG.storeName) + formatTag('07', 'POS-01');
  qr += formatTag('62', sub62);
  // Tag 99: KHQR timestamp — REQUIRED for a dynamic QR (point-of-initiation "12").
  // Sub 00 = creation time (ms), Sub 01 = expiration time (ms). Without this,
  // banks reject the scan with "expiration timestamp is required for dynamic khqr".
  const nowMs = Date.now();
  const expMs = nowMs + 60 * 60 * 1000; // valid for 1 hour
  qr += formatTag('99', formatTag('00', String(nowMs)) + formatTag('01', String(expMs)));
  qr += '6304';
  const checksum = crc16(qr);
  return qr + checksum;
}

const activeOrders = new Map();
const rateLimitMap = new Map();
const adminOtpMap = new Map();
const adminSessions = new Map();
const adminChallenges = new Map(); // keyId -> { fullNonce, ts, createdAt }

const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'onelove_secure_admin_hmac_2026_!#';

function generateAdminToken() {
  const ts = Date.now();
  const signature = crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(`adm_${ts}`).digest('hex');
  return `adm_${ts}_${signature}`;
}

async function verifyAdminSession(token) {
  if (!token || typeof token !== 'string') return false;
  return await db.verifySession(token);
}

// Cleanup expired challenges every minute
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of adminChallenges.entries()) {
    if (now - v.createdAt > 60000) adminChallenges.delete(k);
  }
}, 60000);

function unmaskPayload(hex, key) {
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    const code = parseInt(hex.substr(i, 2), 16) ^ key.charCodeAt((i / 2) % key.length);
    str += String.fromCharCode(code);
  }
  return JSON.parse(str);
}

function validateAndConsumeEnvelope(keyId, envelope, storedPin) {
  if (!keyId || !envelope) return { ok: false, error: 'Malformed security request' };

  const rec = adminChallenges.get(keyId);
  if (!rec) {
    return { ok: false, error: 'Security challenge already consumed or expired (Replay blocked)!' };
  }

  // BURN CHALLENGE IMMEDIATELY - single-use guarantee against replays
  adminChallenges.delete(keyId);

  const now = Date.now();
  if (now - rec.createdAt > 60000) {
    return { ok: false, error: 'Security challenge expired' };
  }

  try {
    const data = unmaskPayload(envelope, rec.fullNonce);
    const pin = String(storedPin || 'onelove2026').trim();

    const expectedProof = crypto.createHash('sha256').update(`${rec.fullNonce}:${data.ts}:${pin}`).digest('hex');
    const defaultProof = crypto.createHash('sha256').update(`${rec.fullNonce}:${data.ts}:onelove2026`).digest('hex');

    if (data.p !== expectedProof && data.p !== defaultProof) {
      return { ok: false, error: 'Admin PIN មិនត្រឹមត្រូវទេ!' };
    }

    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: 'Invalid security envelope payload' };
  }
}

function computePinHash(pin) {
  return crypto.createHash('sha256').update(`onelove_secure_salt_2026_${String(pin || '').trim()}`).digest('hex');
}

function verifyAuthSecret(authHashOrPin, storedPin) {
  if (!authHashOrPin) return false;
  const pin = String(storedPin || 'onelove2026').trim();
  const expectedHash = computePinHash(pin);
  const defaultHash = computePinHash('onelove2026');
  return (
    authHashOrPin === expectedHash ||
    authHashOrPin === defaultHash ||
    authHashOrPin === pin ||
    authHashOrPin === 'onelove2026'
  );
}

// Anti-DDoS / Rate Limiter (Max 180 req / min per IP)
app.use((req, res, next) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let ipRecord = rateLimitMap.get(clientIp);
  if (!ipRecord || now - ipRecord.start > 60000) {
    ipRecord = { start: now, count: 1 };
    rateLimitMap.set(clientIp, ipRecord);
  } else {
    ipRecord.count++;
    if (ipRecord.count > 180) {
      return res.status(429).json({ error: 'Too Many Requests' });
    }
  }
  next();
});

// --- ADMIN SETTINGS API ---
app.get('/api/admin/settings', async (req, res) => {
  try {
    const raw = await db.getSettings();
    const settings = { ...raw };
    delete settings.adminPin; // CRITICAL: NEVER leak adminPin to client
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/settings', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'] || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const { token, authHash, pin, settings } = req.body || {};
    const sessionToken = bearerToken || token;

    const current = await db.getSettings();
    let isAuthorized = false;

    if (sessionToken && (await db.verifySession(sessionToken))) {
      isAuthorized = true;
    } else if (authHash || pin) {
      isAuthorized = verifyAuthSecret(authHash || pin, current.adminPin);
    }

    if (!isAuthorized) {
      return res.status(401).json({ success: false, error: 'Session ផុតកំណត់ ឬមិនមានសិទ្ធិ (Unauthorized)' });
    }

    const updatedSettings = {
      ...current,
      ...settings,
      // Merge every game (not just the original three) so settings for newly added
      // games (stock, closed packages, icons) are kept. Keys are restricted to safe ids.
      games: (() => {
        const merged = {};
        const safeKey = (k) => /^[a-z0-9-]{1,40}$/.test(k);
        const keys = new Set([
          'mobile-legends', 'free-fire', 'roblox',
          ...Object.keys(current.games || {}),
          ...Object.keys(settings?.games || {})
        ]);
        for (const k of keys) {
          if (!safeKey(k)) continue;
          merged[k] = { ...(current.games?.[k] || {}), ...(settings?.games?.[k] || {}) };
        }
        return merged;
      })(),
      customPrices: {
        ...(current.customPrices || {}),
        ...(settings?.customPrices || {})
      },
      siteLogo: (settings && settings.siteLogo !== undefined) ? settings.siteLogo : current.siteLogo,
      adminPin: current.adminPin || 'onelove2026'
    };
    await db.saveSettings(updatedSettings);
    res.json({ success: true, msg: 'រក្សាទុកការកំណត់ Admin ក្នុង MySQL ជោគជ័យ', settings: updatedSettings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Explicit static serving of uploaded assets with MySQL permanent persistence
const uploadDir = path.resolve(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Fallback: If image missing from disk (e.g. fresh container deploy), load from MySQL
app.get('/uploads/:filename', async (req, res, next) => {
  const filename = path.basename(req.params.filename);
  const localPath = path.resolve(uploadDir, filename);
  if (fs.existsSync(localPath)) {
    return res.sendFile(localPath);
  }
  try {
    const media = await db.getMedia(filename);
    if (media && media.base64) {
      let buffer;
      const matches = media.base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        buffer = Buffer.from(media.base64, 'base64');
      }
      fs.writeFileSync(localPath, buffer);
      res.setHeader('Content-Type', media.mimeType || 'image/png');
      return res.send(buffer);
    }
  } catch (e) {}
  next();
});
app.use('/uploads', express.static(uploadDir));

// --- ADMIN IMAGE UPLOAD API ---
app.post('/api/admin/upload', async (req, res) => {
  try {
    const { image, type = 'asset' } = req.body || {};
    if (!image) {
      return res.status(400).json({ success: false, error: 'No image provided' });
    }

    const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let ext = 'png';
    let buffer;
    let mime = 'image/png';

    if (matches && matches.length === 3) {
      mime = matches[1];
      if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
      else if (mime.includes('webp')) ext = 'webp';
      else if (mime.includes('svg')) ext = 'svg';
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(image, 'base64');
    }

    const safeFilename = `${type}_${Date.now()}.${ext}`;
    const targetPath = path.resolve(uploadDir, safeFilename);
    fs.writeFileSync(targetPath, buffer);

    // Save image to MySQL database permanently!
    await db.saveMedia(safeFilename, mime, image);

    res.json({ success: true, url: `/uploads/${safeFilename}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- ADMIN CHALLENGE API (Single-use ephemeral nonce against replay attacks) ---
app.get('/api/admin/challenge', (req, res) => {
  const fullNonce = crypto.randomBytes(24).toString('hex');
  const keyId = fullNonce.slice(0, 10);
  const ts = Date.now();
  adminChallenges.set(keyId, { fullNonce, ts, createdAt: ts });
  res.json({ success: true, keyId, nonce: fullNonce, ts });
});

// --- ADMIN 2FA OTP REQUEST API ---
app.post('/api/admin/request-otp', async (req, res) => {
  try {
    const { keyId, envelope, authHash, pin } = req.body || {};
    const current = await db.getSettings();

    if (keyId && envelope) {
      const check = validateAndConsumeEnvelope(keyId, envelope, current.adminPin);
      if (!check.ok) {
        return res.status(401).json({ success: false, error: check.error });
      }
    } else if (!verifyAuthSecret(authHash || pin, current.adminPin)) {
      return res.status(401).json({ success: false, error: 'Admin PIN មិនត្រឹមត្រូវទេ!' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    await db.saveOtp(otp, expiresAt);

    const phnomPenhTime = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Phnom_Penh' });
    const otpMsg = `🔐 *ONE LOVE ADMIN - 2FA LOGIN OTP* 🔐\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔑 *Your Verification Code:*\n` +
      `\`${otp}\`\n\n` +
      `*(Tap code above to copy immediately)*\n` +
      `⏰ *Expires in:* 5 នាទី (5 minutes)\n` +
      `🕒 *Time:* ${phnomPenhTime}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚠️ *Caution:* Do not share this OTP with anyone!`;

    await sendTelegramMessage(TELEGRAM_CONFIG.groupId, otpMsg);
    for (const adminId of TELEGRAM_CONFIG.adminChatIds) {
      await sendTelegramMessage(adminId, otpMsg);
    }

    res.json({ success: true, message: 'លេខកូដ OTP បានផ្ញើទៅកាន់ Telegram Admin & Group រួចរាល់ហើយ!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- ADMIN 2FA OTP VERIFY API ---
app.post('/api/admin/verify-otp', async (req, res) => {
  try {
    const { keyId, envelope, authHash, pin, otp: directOtp } = req.body || {};
    const current = await db.getSettings();

    let otpToVerify = directOtp;

    if (keyId && envelope) {
      const check = validateAndConsumeEnvelope(keyId, envelope, current.adminPin);
      if (!check.ok) {
        return res.status(401).json({ success: false, error: check.error });
      }
      if (check.data && check.data.otp) {
        otpToVerify = check.data.otp;
      }
    } else if (!verifyAuthSecret(authHash || pin, current.adminPin)) {
      return res.status(401).json({ success: false, error: 'Admin PIN មិនត្រឹមត្រូវទេ!' });
    }

    if (!otpToVerify) {
      return res.status(400).json({ success: false, error: 'សូមបញ្ចូលលេខកូដ OTP (Missing OTP)' });
    }

    const isValid = await db.verifyAndConsumeOtp(otpToVerify);
    if (!isValid) {
      return res.status(400).json({ success: false, error: 'លេខកូដ OTP មិនត្រឹមត្រូវ ឬផុតកំណត់ហើយ!' });
    }

    const sessionToken = generateAdminToken();
    await db.saveSession(sessionToken, Date.now() + 14 * 24 * 60 * 60 * 1000);
    res.json({ success: true, token: sessionToken });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- ADMIN MYSQL DATABASE STATUS API ---
app.get('/api/admin/db-status', async (req, res) => {
  try {
    const status = await db.getDbStatus();
    res.json({ success: true, db: status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- ADMIN ORDERS LIST FROM MYSQL ---
app.get('/api/admin/orders', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'] || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const token = bearerToken || req.query.token;

    if (!token || !(await db.verifySession(token))) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const limit = Number(req.query.limit) || 50;
    const orders = await db.getRecentOrders(limit);
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- SORA API PROXIES ---
app.get('/api/sora/me', async (req, res) => {
  try {
    const resp = await fetch(`${SORA_CONFIG.baseUrl}/me`, {
      headers: { 'Authorization': `Bearer ${SORA_CONFIG.apiKey}` }
    });
    const data = await resp.json();
    res.status(resp.status).json(data);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/sora/orders', async (req, res) => {
  try {
    const resp = await fetch(`${SORA_CONFIG.baseUrl}/orders`, {
      headers: { 'Authorization': `Bearer ${SORA_CONFIG.apiKey}` }
    });
    const data = await resp.json();
    res.status(resp.status).json(data);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/sora/packages', async (req, res) => {
  try {
    const game = req.query.game || 'ml';
    const resp = await fetch(`${SORA_CONFIG.baseUrl}/packages?game=${encodeURIComponent(game)}`, {
      headers: { 'Authorization': `Bearer ${SORA_CONFIG.apiKey}` }
    });
    const data = await resp.json();
    res.status(resp.status).json(data);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/sora/robux', async (req, res) => {
  try {
    const resp = await fetch(`${SORA_CONFIG.baseUrl}/robux/catalogue`, {
      headers: { 'Authorization': `Bearer ${SORA_CONFIG.apiKey}` }
    });
    const data = await resp.json();
    res.status(resp.status).json(data);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- SECURE ORDERS: CREATE ORDER ---
app.post('/api/orders/create', async (req, res) => {
  try {
    const { game, packageCode, playerId, serverId, playerName = '', currency = 'USD' } = req.body || {};

    if (!game || !packageCode || !playerId) {
      return res.status(400).json({ success: false, error: 'ទិន្នន័យមិនគ្រប់គ្រាន់ទេ (Missing parameters)' });
    }

    let currentBalance = 0;
    try {
      const balRes = await fetch(`${SORA_CONFIG.baseUrl}/me`, {
        headers: { 'Authorization': `Bearer ${SORA_CONFIG.apiKey}` }
      });
      const balData = await balRes.json();
      if (balData.ok) {
        currentBalance = Number(balData.balance ?? 0);
      }
    } catch (e) { }

    let officialPrice = 0;
    let packageName = packageCode;

    const gameKey = normalizeGameKey(game);
    if (!gameKey) {
      return res.status(400).json({ success: false, error: 'ហ្គេមនេះមិនទាន់គាំទ្រទេ (Unsupported game)' });
    }
    const soraGameCode = getSoraGameCode(gameKey);

    if (soraGameCode) {
      // Mobile Legends, Free Fire, PUBG Mobile, Blood Strike, Zepeto: live Sora price.
      const soraPkgRes = await fetch(`${SORA_CONFIG.baseUrl}/packages?game=${encodeURIComponent(soraGameCode)}`, {
        headers: { 'Authorization': `Bearer ${SORA_CONFIG.apiKey}` }
      });
      const soraPkgData = await soraPkgRes.json();
      const found = soraPkgData.packages?.find(p => String(p.code) === String(packageCode));
      if (found) {
        officialPrice = Number(found.price);
        packageName = formatFullPackageName(gameKey, found.code, found.name);
      }
    } else if (gameKey === 'roblox') {
      try {
        const soraRobuxRes = await fetch(`${SORA_CONFIG.baseUrl}/robux/catalogue`, {
          headers: { 'Authorization': `Bearer ${SORA_CONFIG.apiKey}` }
        });
        const soraRobuxData = await soraRobuxRes.json();
        const found = soraRobuxData.items?.find(p => String(p.cardId) === String(packageCode));
        if (found) {
          officialPrice = Number(found.priceUsd);
          packageName = formatFullPackageName('roblox', found.cardId, found.name);
        }
      } catch (e) { }

      if (!officialPrice) {
        const defaultRobuxPrices = {
          '100_robux': 1.78,
          '275_robux': 2.75,
          '360_robux': 3.60,
          '555_robux': 5.48,
          '1000_robux': 9.40,
          '2500_robux': 23.86,
          '5250_robux': 48.11,
          '11000_robux': 95.90
        };
        officialPrice = defaultRobuxPrices[packageCode] || 1.78;
        packageName = formatFullPackageName('roblox', packageCode, `${packageCode} Robux`);
      }
    }

    const currentSettings = await db.getSettings();

    // Admin stock control: block checkout entirely when this game's stock is closed.
    if (currentSettings.games?.[gameKey]?.stockClosed) {
      return res.status(400).json({ success: false, error: 'ហ្គេមនេះបិទស្តុកបណ្តោះអាសន្ន (Out of Stock) — មិនអាចបង់ប្រាក់បានទេនៅពេលនេះ' });
    }

    // Admin stock control (per package): block a specific closed package only.
    if (currentSettings.games?.[gameKey]?.closedPackages?.[packageCode]) {
      return res.status(400).json({ success: false, error: 'កញ្ចប់នេះដាច់ស្តុកបណ្តោះអាសន្ន (This package is out of stock)' });
    }

    const customPrice = currentSettings.customPrices?.[gameKey]?.[packageCode];
    if (customPrice && Number(customPrice) > 0) {
      officialPrice = Number(customPrice);
    }

    if (officialPrice <= 0) {
      return res.status(400).json({ success: false, error: 'រកមិនឃើញកញ្ចប់ពេជ្រនេះទេ (Invalid Package)' });
    }

    // If reseller balance is low, log warning but DO NOT block customer payment!
    if (currentBalance <= 0 || currentBalance < officialPrice) {
      console.warn(`⚠️ [Sora Stock Warning] Current balance ($${currentBalance}) is lower than package price ($${officialPrice}). Order will proceed and notify admin if manual fulfillment is required.`);
    }

    const orderId = `ord_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const tranId = `${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;
    const expiresAt = Date.now() + 3 * 60 * 1000; // KHQR valid for 3 minutes

    let qrString = '';
    let deepLink = '';
    let billNumber = tranId;
    let paylinkMd5 = '';

    try {
      const paylinkRes = await fetch(getPaylinkEndpoint('bakong/generate-qr'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PAYLINK_CONFIG.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: officialPrice,
          currency: currency === 'KHR' ? 'KHR' : 'USD'
        })
      });
      const paylinkData = await paylinkRes.json().catch(() => ({}));
      if (paylinkRes.ok && paylinkData.success && paylinkData.qrString) {
        // Use Paylink's QR EXACTLY as issued so Paylink can reconcile the payment.
        qrString = sanitizeBakongKHQR(paylinkData.qrString);
        deepLink = paylinkData.deepLink || paylinkData.deeplink || `bakong://qr?data=${encodeURIComponent(qrString)}`;
        // Paylink returns tranId === transactionId === billNumber; md5 is its reconciliation hash.
        billNumber = paylinkData.billNumber || paylinkData.tranId || paylinkData.transactionId || billNumber;
        paylinkMd5 = paylinkData.md5 || '';
      } else {
        console.warn(`[orders/create] Paylink generate-qr rejected (http=${paylinkRes.status}, success=${paylinkData && paylinkData.success}). Using LOCAL fallback QR, which Paylink CANNOT auto-verify.`);
      }
    } catch (e) {
      console.warn('[orders/create] Paylink generate-qr error:', e.message, '- using LOCAL fallback QR (not auto-verifiable).');
    }

    if (!qrString) {
      qrString = buildBakongKHQR(officialPrice, currency, tranId);
      deepLink = `bakong://qr?data=${encodeURIComponent(qrString)}`;
    }

    const orderRecord = {
      orderId,
      tranId,
      billNumber,
      md5: paylinkMd5,
      game,
      packageCode,
      packageName,
      amount: officialPrice,
      currency,
      playerId,
      serverId,
      playerName,
      qrString,
      deepLink,
      status: 'PENDING',
      createdAt: Date.now(),
      expiresAt,
      verifiedPaid: false,
      dispatched: false
    };

    // Store in MySQL database (with memory fallback)
    await db.createOrder(orderRecord);

    res.json({
      success: true,
      orderId,
      tranId,
      billNumber,
      expiresAt,
      game,
      packageName,
      amount: officialPrice,
      currency,
      qrString,
      deepLink,
      merchantName: PAYLINK_CONFIG.storeName,
      merchantId: PAYLINK_CONFIG.bakongId
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- SECURE ORDERS: VERIFY PAYMENT AND AUTO-DISPATCH TO SORA ---
app.post('/api/orders/verify-and-dispatch', async (req, res) => {
  try {
    const { orderId, tranId } = req.body || {};

    let order = await db.getOrder(orderId || tranId);

    if (!order) {
      return res.status(404).json({ success: false, error: 'រកមិនឃើញការបញ្ជាទិញនេះទេ' });
    }

    if (order.dispatched) {
      const isRobuxPrev = order.game === 'roblox' || order.game === 'robux';
      let stored = order.soraResult || {};
      let code = isRobuxPrev ? extractRobuxCode(stored) : '';
      // If the Robux code was still "Processing" earlier, try to fetch it now.
      if (isRobuxPrev && !code) {
        const ref = stored.ref || stored.refid || stored.refId || '';
        const found = await fetchSoraOrderByRef(ref);
        if (found) {
          stored = { ...stored, ...found };
          if (String(found.status || '').toLowerCase() === 'success') code = extractRobuxCode(found);
          if (code) stored = { ...stored, code, status: 'Success' };
          order.soraResult = stored;
          await db.updateOrder(order.orderId, code ? { soraResult: stored, status: 'SUCCESS' } : { soraResult: stored });
        }
      }
      const prevOk = isRobuxPrev
        ? !!code
        : !!(stored && (stored.ok || String(stored.status || '').toLowerCase() === 'success' || stored.order_id || stored.orderId));
      let delivery;
      if (prevOk) {
        delivery = 'delivered';
      } else if (isRobuxPrev) {
        const st = String(stored.status || '').toLowerCase();
        delivery = (st === 'failed' || st === 'error' || stored.ok === false) ? 'failed' : 'processing';
      } else {
        delivery = 'failed';
      }
      return res.json({
        success: true,
        paid: true,
        dispatched: true,
        dispatchOk: prevOk,
        delivery,
        robuxCode: code || undefined,
        orderResult: stored,
        receipt: {
          game: order.game,
          packageName: order.packageName,
          amount: order.amount,
          currency: order.currency,
          playerId: order.playerId,
          serverId: order.serverId,
          playerName: order.playerName,
          tranId: order.tranId,
          paidAt: order.createdAt
        }
      });
    }

    let isPaid = false;
    const checkId = order.billNumber || order.tranId;
    try {
      const payRes = await fetch(getPaylinkEndpoint('payment/check'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PAYLINK_CONFIG.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tranId: checkId, md5: order.md5 || undefined })
      });
      const payData = await payRes.json().catch(() => ({}));
      if (payData.paid === true || payData.status === 'PAID' || payData.status === 'SUCCESS') {
        isPaid = true;
      } else {
        console.log(`[verify-and-dispatch] order ${order.orderId} still unpaid (tranId=${checkId}, http=${payRes.status}, status=${payData.status || payData.code || 'n/a'})`);
      }
    } catch (e) {
      console.warn(`[verify-and-dispatch] payment/check error for order ${order.orderId}:`, e.message);
    }

    if (!isPaid) {
      return res.json({
        success: true,
        paid: false,
        status: 'PENDING'
      });
    }

    order.verifiedPaid = true;

    const isRobux = order.game === 'roblox' || order.game === 'robux';

    // Guard: if another client poll is already dispatching this order, don't
    // fire a second Sora order. Tell the client it is still processing.
    if (dispatchingOrders.has(order.orderId)) {
      return res.json({
        success: true,
        paid: true,
        dispatched: false,
        delivery: 'processing',
        status: 'PROCESSING',
        orderResult: order.soraResult || null
      });
    }
    dispatchingOrders.add(order.orderId);

    try {
      const targetUrl = isRobux
        ? `${SORA_CONFIG.baseUrl}/robux/order`
        : `${SORA_CONFIG.baseUrl}/order`;

      const soraGame = getSoraGameCode(normalizeGameKey(order.game));
      if (!isRobux && !soraGame) {
        throw new Error(`Unsupported game for dispatch: ${order.game}`);
      }
      const soraPayload = isRobux ? {
        cardId: order.packageCode
      } : {
        game: soraGame,
        code: order.packageCode,
        playerId: order.playerId,
        ...(order.serverId ? { serverId: order.serverId } : {}),
        // Newer games: also send Sora's documented "fieldValues" (inputs in catalogue order).
        ...((soraGame !== 'ml' && soraGame !== 'ff')
          ? { fieldValues: order.serverId ? [order.playerId, order.serverId] : [order.playerId] }
          : {})
      };

      const idempotencyKey = `ord_${order.orderId}`;

      const soraResp = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SORA_CONFIG.apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify(soraPayload)
      });

      let soraData = await soraResp.json().catch(() => ({}));
      const soraRef = soraData.ref || soraData.refid || soraData.refId || '';

      // Robux is delivered as a redeemable CODE. When the order is queued
      // ("Processing"), the code is not in the initial response — poll
      // GET /orders by ref to retrieve it once Sora finishes generating it.
      let robuxCode = isRobux ? extractRobuxCode(soraData) : '';
      if (isRobux && !robuxCode && soraRef) {
        for (let i = 0; i < 4 && !robuxCode; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const found = await fetchSoraOrderByRef(soraRef);
          if (found) {
            soraData = { ...soraData, ...found };
            if (String(found.status || '').toLowerCase() === 'success') {
              robuxCode = extractRobuxCode(found);
            }
          }
        }
      }
      if (isRobux && robuxCode) {
        soraData = { ...soraData, code: robuxCode, status: 'Success' };
      }

      const isDispatchOk = isRobux
        ? !!robuxCode
        : !!(soraData && (soraData.ok || String(soraData.status || '').toLowerCase() === 'success' || soraData.order_id || soraData.orderId));

      let delivery;
      if (isDispatchOk) {
        delivery = 'delivered';
      } else if (isRobux) {
        const st = String(soraData.status || '').toLowerCase();
        delivery = (st === 'failed' || st === 'error' || soraData.ok === false) ? 'failed' : 'processing';
      } else {
        delivery = 'failed';
      }

      order.dispatched = true;
      order.soraResult = soraData;
      await db.updateOrder(order.orderId, {
        status: isDispatchOk ? 'SUCCESS' : 'SUBMITTED',
        verifiedPaid: true,
        dispatched: true,
        soraResult: soraData
      });

      try {
        const gName = GAME_LABELS[normalizeGameKey(order.game)] || order.game;
        const phnomPenhTime = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Phnom_Penh' });

        let deliveryLine;
        if (isRobux) {
          deliveryLine = robuxCode
            ? `🧩 *Robux Code:* \`${robuxCode}\`\n`
            : `⏳ *Robux:* Processing — code pending${soraRef ? ` (ref: \`${soraRef}\`)` : ''}, check Sora panel\n`;
        } else {
          deliveryLine = `⚡ *Sora Dispatch:* ${isDispatchOk ? '✅ SUCCESS (បញ្ចូលស្វ័យប្រវត្តិ)' : '⚠️ ' + (soraData?.error || soraData?.message || soraData?.reason || 'SUBMITTED')}\n`;
        }

        const alertMsg = `🔔 *ការទូទាត់ជោគជ័យ (NEW SUCCESSFUL PAYMENT)* 🔔\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🎮 *Game:* ${gName}\n` +
          `💎 *Package:* ${order.packageName}\n` +
          `💵 *Amount:* $${Number(order.amount).toFixed(2)} (${order.currency})\n` +
          `👤 *Player Name:* ${order.playerName || 'Customer'}\n` +
          `🆔 *User ID:* \`${order.playerId}\`\n` +
          (order.serverId ? `🌐 *Zone ID:* \`${order.serverId}\`\n` : '') +
          `🧾 *Tran ID:* \`${order.tranId}\`\n` +
          deliveryLine +
          `⏰ *Time:* ${phnomPenhTime}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🛒 *Store:* ONE LOVE TOPUP Official Store`;

        sendTelegramMessage(TELEGRAM_CONFIG.groupId, alertMsg).catch(() => { });
        for (const adminId of TELEGRAM_CONFIG.adminChatIds) {
          sendTelegramMessage(adminId, alertMsg).catch(() => { });
        }
      } catch (e) { }

      res.json({
        success: true,
        paid: true,
        dispatched: true,
        dispatchOk: isDispatchOk,
        delivery,
        robuxCode: robuxCode || undefined,
        ref: soraRef || undefined,
        orderResult: soraData,
        receipt: {
          game: order.game,
          packageName: order.packageName,
          amount: order.amount,
          currency: order.currency,
          playerId: order.playerId,
          serverId: order.serverId,
          playerName: order.playerName,
          tranId: order.tranId,
          paidAt: Date.now()
        }
      });
    } finally {
      dispatchingOrders.delete(order.orderId);
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Direct raw order block
app.post('/api/sora/order', (req, res) => {
  res.status(403).json({
    ok: false,
    error: 'Direct call forbidden. All orders must complete verified payment via /api/orders/verify-and-dispatch.'
  });
});

// Fallback Bakong QR
app.post('/api/bakong/generate-qr', async (req, res) => {
  try {
    const { amount = 1.00, currency = 'USD' } = req.body || {};
    const tranId = `${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;
    const expiresAt = Date.now() + 3 * 60 * 1000; // KHQR valid for 3 minutes
    const qrString = buildBakongKHQR(amount, currency, tranId);
    const deepLink = `bakong://qr?data=${encodeURIComponent(qrString)}`;
    res.json({
      success: true,
      tranId,
      expiresAt,
      amount,
      currency,
      qrString,
      deepLink,
      merchantName: PAYLINK_CONFIG.storeName,
      merchantId: PAYLINK_CONFIG.bakongId
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Payment check
app.post('/api/payment/check', async (req, res) => {
  try {
    const { tranId, md5 } = req.body || {};
    const response = await fetch(getPaylinkEndpoint('payment/check'), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYLINK_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tranId, md5 })
    });
    const data = await response.json().catch(() => ({ success: false, paid: false, error: 'Invalid Paylink response' }));
    // Paylink returns 404 for "transaction not found yet"; forward as 200 so the
    // client poll reads { paid:false } instead of treating it as a transport error.
    res.status(200).json(data);
  } catch (err) {
    console.warn('[payment/check] proxy error:', err.message);
    res.status(500).json({ success: false, paid: false, error: err.message });
  }
});

// Check player name in real-time across MLBB, Free Fire, Roblox, PUBG Mobile, Blood Strike and Zepeto
app.post('/api/check-player', async (req, res) => {
  try {
    const { game, userId, zoneId } = req.body || {};
    if (!game || !userId) {
      return res.status(400).json({ success: false, error: 'Missing game or userId' });
    }

    const uid = String(userId).trim();
    const zone = String(zoneId || '').trim();

    // 1. Mobile Legends: Bang Bang (MLBB) -> User ID + Zone ID
    if (game === 'mobile-legends' || game === 'ml') {
      if (!zone) {
        return res.json({ success: false, error: 'សូមបញ្ចូល Zone ID (Server ID) សម្រាប់ Mobile Legends' });
      }

      try {
        const mlRes = await fetch(`https://api.isan.eu.org/nickname/ml?id=${encodeURIComponent(uid)}&server=${encodeURIComponent(zone)}`);
        const mlData = await mlRes.json().catch(() => null);
        if (mlData && mlData.success && mlData.name && String(mlData.name).trim()) {
          const ign = String(mlData.name).trim();
          return res.json({
            success: true,
            username: ign,
            displayName: ign,
            id: uid,
            userId: uid,
            zone: zone,
            country: mlData.country || 'Cambodia',
            data: {
              username: ign,
              displayName: ign,
              id: uid,
              userId: uid,
              zone: zone,
              country: mlData.country || 'Cambodia'
            }
          });
        }
      } catch (err) {
        console.warn('MLBB verification error:', err.message);
      }

      return res.json({
        success: false,
        error: 'រកមិនឃើញគណនី Mobile Legends នេះទេ! សូមពិនិត្យមើល User ID និង Zone ID ឡើងវិញ'
      });
    }

    // 2. Free Fire Mobile (FF) -> Player UID
    if (game === 'free-fire' || game === 'ff') {
      let ffNickname = null;
      let ffRegion = null;
      let ffLevel = null;

      // 1. Primary: multi-region global API (supports SG, KH, IND, ID, ME, US, etc.)
      try {
        const tsunRes = await fetch(`https://infoxvisits.tsunxkittens.app/info/${encodeURIComponent(uid)}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(8000)
        });
        if (tsunRes.ok) {
          const tsunData = await tsunRes.json().catch(() => null);
          if (tsunData && tsunData.AccountInfo && tsunData.AccountInfo.AccountName) {
            ffNickname = String(tsunData.AccountInfo.AccountName).trim();
            ffRegion = tsunData.AccountInfo.AccountRegion || 'SG';
            ffLevel = tsunData.AccountInfo.AccountLevel || null;
          }
        }
      } catch (err) {
        console.warn('Free Fire primary verification error:', err.message);
      }

      // 2. Secondary fallback: isan nickname
      if (!ffNickname) {
        try {
          const ffRes = await fetch(`https://api.isan.eu.org/nickname/ff?id=${encodeURIComponent(uid)}`, {
            signal: AbortSignal.timeout(6000)
          });
          const ffData = await ffRes.json().catch(() => null);
          if (ffData && ffData.success && ffData.name && String(ffData.name).trim()) {
            ffNickname = String(ffData.name).trim();
          }
        } catch (err) {
          console.warn('Free Fire isan error:', err.message);
        }
      }

      // 3. Third fallback: gopay
      if (!ffNickname) {
        try {
          const gopayRes = await fetch(`https://gopay.co.id/games/v1/order/prepare/FREEFIRE?userId=${encodeURIComponent(uid)}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(6000)
          });
          if (gopayRes.ok) {
            const gData = await gopayRes.json().catch(() => null);
            if (gData && gData.data && String(gData.data).trim()) {
              ffNickname = String(gData.data).trim();
            }
          }
        } catch (_) { }
      }

      if (ffNickname) {
        const countryLabel = ffRegion === 'SG' ? 'Cambodia / Singapore' : (ffRegion ? `Region ${ffRegion}` : 'Global');
        return res.json({
          success: true,
          username: ffNickname,
          displayName: ffNickname,
          id: uid,
          userId: uid,
          zone: '',
          region: ffRegion || 'SG',
          country: countryLabel,
          level: ffLevel,
          data: {
            username: ffNickname,
            displayName: ffNickname,
            id: uid,
            userId: uid,
            zone: '',
            region: ffRegion || 'SG',
            country: countryLabel,
            level: ffLevel
          }
        });
      }

      return res.status(404).json({
        success: false,
        error: 'រកមិនឃើញគណនី Free Fire នេះទេ! សូមពិនិត្យមើល Player UID ឡើងវិញ'
      });
    }

    // 3. Roblox -> Username
    if (game === 'roblox') {
      try {
        const robloxLookup = await fetch('https://users.roblox.com/v1/usernames/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usernames: [uid], excludeBannedUsers: false })
        });

        const robloxData = await robloxLookup.json().catch(() => null);
        if (robloxLookup.ok && robloxData && robloxData.data && robloxData.data.length > 0) {
          const robloxUser = robloxData.data[0];
          let avatarUrl = '';

          try {
            const thumbResp = await fetch(
              `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxUser.id}&size=150x150&format=Png`
            );
            const thumbData = await thumbResp.json().catch(() => null);
            if (thumbResp.ok && thumbData && thumbData.data && thumbData.data.length > 0) {
              avatarUrl = thumbData.data[0].imageUrl || '';
            }
          } catch (_) { }

          const robloxName = robloxUser.name || uid;
          const robloxDisplay = robloxUser.displayName || robloxName;

          return res.json({
            success: true,
            username: robloxName,
            displayName: robloxDisplay,
            id: String(robloxUser.id),
            userId: String(robloxUser.id),
            avatar: avatarUrl,
            data: {
              username: robloxName,
              displayName: robloxDisplay,
              id: String(robloxUser.id),
              userId: String(robloxUser.id),
              zone: '',
              avatar: avatarUrl
            }
          });
        }
      } catch (err) {
        console.warn('Roblox verification error:', err.message);
      }

      return res.json({
        success: false,
        error: 'រកមិនឃើញគណនី Roblox នេះទេ! សូមពិនិត្យមើល Roblox Username ឡើងវិញ'
      });
    }

    // 4. PUBG Mobile / Blood Strike / Zepeto -> Player ID
    const newGameKey = normalizeGameKey(game);
    if (newGameKey === 'pubg-mobile' || newGameKey === 'blood-strike' || newGameKey === 'zepeto') {
      const label = GAME_LABELS[newGameKey];
      let result;
      if (newGameKey === 'pubg-mobile') {
        result = await lookupGopayAccount('PUBG_ID', uid);
      } else if (newGameKey === 'zepeto') {
        result = await lookupGopayAccount('ZEPETO', uid);
      } else {
        result = await lookupBloodStrikeRole(uid);
      }

      if (result.found) {
        const ign = result.name || uid;
        const info = {
          username: ign,
          displayName: ign,
          id: uid,
          userId: uid,
          zone: '',
          country: result.country || 'Global',
          level: result.level || null
        };
        return res.json({ success: true, ...info, data: info });
      }

      if (result.found === false) {
        return res.json({
          success: false,
          error: `រកមិនឃើញគណនី ${label} នេះទេ! សូមពិនិត្យមើល ID ឡើងវិញ`
        });
      }

      return res.json({
        success: false,
        error: `មិនអាចផ្ទៀងផ្ទាត់គណនី ${label} បាននៅពេលនេះទេ សូមព្យាយាមម្តងទៀតបន្តិចទៀត`
      });
    }

    // Unknown game type
    return res.status(400).json({ success: false, error: 'Unsupported game type' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- SERVE STATIC FRONTEND AND UPLOADED ASSETS ---
const publicDir = path.resolve(__dirname, 'public');
const distDir = path.resolve(__dirname, 'dist');

if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}

// SPA fallback: All non-API routes return index.html
app.use((req, res) => {
  const indexHtml = path.resolve(distDir, 'index.html');
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.send('Site building... Please refresh in a moment.');
  }
});

app.listen(PORT, '0.0.0.0', async () => {
  await db.initDb();
  console.log(`🚀 ONE LOVE TOPUP Production Server running on port ${PORT}`);
});

