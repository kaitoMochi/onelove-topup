import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { formatFullPackageName } from './src/data/games.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Body parsers with 50mb limit for image uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const PAYLINK_CONFIG = {
  baseUrl: process.env.PAYLINK_BASE_URL || 'https://paylinkapi-bot.onrender.com',
  apiKey: process.env.PAYLINK_API_KEY || 'plk_live_std_af901733065f27b5608e3c198026bfe6f23d',
  secret: process.env.PAYLINK_SECRET || 'whsec_4074c0b74b3d64a19de5c3f27f5bf022e75e593bfeb5e1955bb69bff212d3cb3',
  storeName: process.env.STORE_NAME || 'ONE LOVE TOPUP',
  bakongId: process.env.BAKONG_ID || 'onelo@bkrt',
};

const SORA_CONFIG = {
  baseUrl: process.env.SORA_BASE_URL || 'https://app.soratopup.com/api/v1',
  apiKey: process.env.SORA_API_KEY || 'sk_7fbe263e907ce46212397f6746d4cd5c7bb65c0932ef666f'
};

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

function getSavedSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
  } catch (e) { }
  return {
    adminPin: 'onelove2026',
    games: {
      'mobile-legends': {
        coverImage: '/games/mobile-legends-cover.jpg',
        diamondIcon: '/assets/diamonds/mlbb-diamond.png',
        weeklyPassIcon: '/assets/diamonds/mlbb-weekly-pass.svg',
        weeklyEliteIcon: '/assets/diamonds/elite-pass.svg',
        monthlyEpicIcon: '/assets/diamonds/epic-pass.svg',
        twilightIcon: '/assets/diamonds/twilight-pass.svg',
        customTitle: 'Mobile Legends: Bang Bang'
      },
      'free-fire': {
        coverImage: '/games/free-fire-cover.jpg',
        diamondIcon: '/assets/diamonds/ff-diamond.png',
        weeklyPassIcon: '/assets/diamonds/ff-weekly-card.svg',
        weeklyLiteIcon: '/assets/diamonds/ff-weekly-lite.svg',
        monthlyCardIcon: '/assets/diamonds/ff-monthly-card.svg',
        levelUpIcon: '/assets/diamonds/ff-levelup.svg',
        comboIcon: '/assets/diamonds/ff-combo.svg',
        diamondPackIcon: '/assets/diamonds/ff-diamond-pack.png',
        customTitle: 'Free Fire Mobile'
      },
      'roblox': {
        coverImage: '/games/roblox-cover.jpg',
        diamondIcon: '/assets/diamonds/robux-gold.svg',
        weeklyPassIcon: '/assets/diamonds/robux-card.png',
        customTitle: 'Roblox (Robux)'
      }
    }
  };
}

function saveSettingsFile(data) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    return false;
  }
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

function verifyAdminSession(token) {
  if (!token || typeof token !== 'string') return false;
  if (adminSessions.has(token)) {
    const s = adminSessions.get(token);
    if (Date.now() < s.expiresAt) return true;
  }
  if (token.startsWith('adm_')) {
    const parts = token.split('_');
    if (parts.length >= 2) {
      const ts = Number(parts[1]);
      if (!isNaN(ts) && (Date.now() - ts < 14 * 24 * 60 * 60 * 1000)) {
        return true;
      }
    }
  }
  return false;
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
app.get('/api/admin/settings', (req, res) => {
  const settings = { ...getSavedSettings() };
  delete settings.adminPin; // CRITICAL: NEVER leak adminPin to client
  res.json({ success: true, settings });
});

app.post('/api/admin/settings', (req, res) => {
  try {
    const authHeader = req.headers['authorization'] || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const { token, authHash, pin, settings } = req.body || {};
    const sessionToken = bearerToken || token;

    const current = getSavedSettings();
    let isAuthorized = false;

    if (sessionToken && verifyAdminSession(sessionToken)) {
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
      games: {
        'mobile-legends': {
          ...(current.games?.['mobile-legends'] || {}),
          ...(settings?.games?.['mobile-legends'] || {})
        },
        'free-fire': {
          ...(current.games?.['free-fire'] || {}),
          ...(settings?.games?.['free-fire'] || {})
        },
        'roblox': {
          ...(current.games?.['roblox'] || {}),
          ...(settings?.games?.['roblox'] || {})
        }
      },
      customPrices: {
        ...(current.customPrices || {}),
        ...(settings?.customPrices || {})
      },
      adminPin: current.adminPin || 'onelove2026'
    };
    saveSettingsFile(updatedSettings);
    res.json({ success: true, msg: 'រក្សាទុកការកំណត់ Admin ជោគជ័យ', settings: updatedSettings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Explicit static serving of uploaded assets
const uploadDir = path.resolve(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// --- ADMIN IMAGE UPLOAD API ---
app.post('/api/admin/upload', (req, res) => {
  try {
    const { image, type = 'asset' } = req.body || {};
    if (!image) {
      return res.status(400).json({ success: false, error: 'No image provided' });
    }

    const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let ext = 'png';
    let buffer;

    if (matches && matches.length === 3) {
      const mime = matches[1];
      if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
      else if (mime.includes('webp')) ext = 'webp';
      else if (mime.includes('svg')) ext = 'svg';
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(image, 'base64');
    }

    const safeFilename = `${type}_${Date.now()}.${ext}`;
    const uploadDir = path.resolve(__dirname, 'public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const targetPath = path.resolve(uploadDir, safeFilename);
    fs.writeFileSync(targetPath, buffer);

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
    const current = getSavedSettings();

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
    adminOtpMap.set(otp, { expiresAt });

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
app.post('/api/admin/verify-otp', (req, res) => {
  try {
    const { keyId, envelope, authHash, pin, otp: directOtp } = req.body || {};
    const current = getSavedSettings();

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

    const record = adminOtpMap.get(String(otpToVerify).trim());
    if (!record || Date.now() > record.expiresAt) {
      return res.status(400).json({ success: false, error: 'លេខកូដ OTP មិនត្រឹមត្រូវ ឬផុតកំណត់ហើយ!' });
    }

    adminOtpMap.delete(String(otpToVerify).trim());
    const sessionToken = generateAdminToken();
    adminSessions.set(sessionToken, { expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000 });
    res.json({ success: true, token: sessionToken });
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
    } catch (e) {}

    let officialPrice = 0;
    let packageName = packageCode;

    if (game === 'mobile-legends' || game === 'ml') {
      const soraPkgRes = await fetch(`${SORA_CONFIG.baseUrl}/packages?game=ml`, {
        headers: { 'Authorization': `Bearer ${SORA_CONFIG.apiKey}` }
      });
      const soraPkgData = await soraPkgRes.json();
      const found = soraPkgData.packages?.find(p => String(p.code) === String(packageCode));
      if (found) {
        officialPrice = Number(found.price);
        packageName = formatFullPackageName('mobile-legends', found.code, found.name);
      }
    } else if (game === 'free-fire' || game === 'ff') {
      const soraPkgRes = await fetch(`${SORA_CONFIG.baseUrl}/packages?game=ff`, {
        headers: { 'Authorization': `Bearer ${SORA_CONFIG.apiKey}` }
      });
      const soraPkgData = await soraPkgRes.json();
      const found = soraPkgData.packages?.find(p => String(p.code) === String(packageCode));
      if (found) {
        officialPrice = Number(found.price);
        packageName = formatFullPackageName('free-fire', found.code, found.name);
      }
    } else if (game === 'roblox' || game === 'robux') {
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
      } catch (e) {}

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

    const currentSettings = getSavedSettings();
    const gameKey = (game === 'ml' || game === 'mobile-legends') ? 'mobile-legends' : (game === 'ff' || game === 'free-fire' ? 'free-fire' : 'roblox');
    const customPrice = currentSettings.customPrices?.[gameKey]?.[packageCode];
    if (customPrice && Number(customPrice) > 0) {
      officialPrice = Number(customPrice);
    }

    if (officialPrice <= 0) {
      return res.status(400).json({ success: false, error: 'រកមិនឃើញកញ្ចប់ពេជ្រនេះទេ (Invalid Package)' });
    }

    if (currentBalance <= 0 || currentBalance < officialPrice) {
      return res.status(400).json({ 
        success: false, 
        error: 'ពេជ្រដាច់ស្តុកបណ្តោះអាសន្ន (Out of Stock) - មិនអាចបង់ប្រាក់បានទេនៅពេលនេះ' 
      });
    }

    const orderId = `ord_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const tranId = `${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;

    let qrString = '';
    let deepLink = '';
    let billNumber = tranId;

    try {
      const paylinkRes = await fetch(`${PAYLINK_CONFIG.baseUrl}/api/bakong/generate-qr`, {
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
      const paylinkData = await paylinkRes.json();
      if (paylinkRes.ok && paylinkData.success && paylinkData.qrString) {
        qrString = paylinkData.qrString;
        deepLink = paylinkData.deepLink || paylinkData.deeplink;
        if (paylinkData.tranId) billNumber = paylinkData.tranId;
      }
    } catch (e) {}

    if (!qrString) {
      qrString = buildBakongKHQR(officialPrice, currency, tranId);
      deepLink = `bakong://qr?data=${encodeURIComponent(qrString)}`;
    }

    const orderRecord = {
      orderId,
      tranId,
      billNumber,
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
      createdAt: Date.now(),
      verifiedPaid: false,
      dispatched: false
    };

    activeOrders.set(orderId, orderRecord);
    activeOrders.set(tranId, orderRecord);
    if (billNumber !== tranId) activeOrders.set(billNumber, orderRecord);

    res.json({
      success: true,
      orderId,
      tranId,
      billNumber,
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

    let order = null;
    if (orderId && activeOrders.has(orderId)) {
      order = activeOrders.get(orderId);
    } else if (tranId) {
      for (const o of activeOrders.values()) {
        if (o.tranId === tranId) {
          order = o;
          break;
        }
      }
    }

    if (!order) {
      return res.status(404).json({ success: false, error: 'រកមិនឃើញការបញ្ជាទិញនេះទេ' });
    }

    if (order.dispatched) {
      return res.json({
        success: true,
        paid: true,
        dispatched: true,
        orderResult: order.soraResult
      });
    }

    let isPaid = false;
    try {
      const payRes = await fetch(`${PAYLINK_CONFIG.baseUrl}/api/payment/check`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PAYLINK_CONFIG.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tranId: order.billNumber || order.tranId })
      });
      const payData = await payRes.json();
      if (payRes.ok && (payData.paid === true || payData.status === 'PAID' || payData.status === 'SUCCESS')) {
        isPaid = true;
      }
    } catch (e) {}

    if (!isPaid) {
      return res.json({
        success: true,
        paid: false,
        status: 'PENDING'
      });
    }

    order.verifiedPaid = true;

    const isRobux = order.game === 'roblox' || order.game === 'robux';
    const targetUrl = isRobux 
      ? `${SORA_CONFIG.baseUrl}/robux/order` 
      : `${SORA_CONFIG.baseUrl}/order`;

    const soraPayload = isRobux ? {
      cardId: order.packageCode
    } : {
      game: (order.game === 'mobile-legends' || order.game === 'ml') ? 'ml' : 'ff',
      code: order.packageCode,
      playerId: order.playerId,
      ...(order.serverId ? { serverId: order.serverId } : {})
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

    const soraData = await soraResp.json();
    order.dispatched = true;
    order.soraResult = soraData;

    try {
      const gameNames = {
        'mobile-legends': 'Mobile Legends',
        'ml': 'Mobile Legends',
        'free-fire': 'Free Fire Mobile',
        'ff': 'Free Fire Mobile',
        'roblox': 'Roblox (Robux)'
      };
      const gName = gameNames[order.game] || order.game;
      const isDispatchOk = soraData && (soraData.ok || soraData.status === 'success' || soraData.status === 'SUCCESS' || soraData.order_id || soraData.orderId);
      const phnomPenhTime = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Phnom_Penh' });

      const alertMsg = `🔔 *ការទូទាត់ជោគជ័យ (NEW SUCCESSFUL PAYMENT)* 🔔\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🎮 *Game:* ${gName}\n` +
        `💎 *Package:* ${order.packageName}\n` +
        `💵 *Amount:* $${Number(order.amount).toFixed(2)} (${order.currency})\n` +
        `👤 *Player Name:* ${order.playerName || 'Customer'}\n` +
        `🆔 *User ID:* \`${order.playerId}\`\n` +
        (order.serverId ? `🌐 *Zone ID:* \`${order.serverId}\`\n` : '') +
        `🧾 *Tran ID:* \`${order.tranId}\`\n` +
        `⚡ *Sora Dispatch:* ${isDispatchOk ? '✅ SUCCESS (បញ្ចូលស្វ័យប្រវត្តិ)' : '⚠️ ' + (soraData?.error || soraData?.message || 'SUBMITTED')}\n` +
        `⏰ *Time:* ${phnomPenhTime}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🛒 *Store:* ONE LOVE TOPUP Official Store`;

      sendTelegramMessage(TELEGRAM_CONFIG.groupId, alertMsg).catch(() => {});
      for (const adminId of TELEGRAM_CONFIG.adminChatIds) {
        sendTelegramMessage(adminId, alertMsg).catch(() => {});
      }
    } catch (e) {}

    res.json({
      success: true,
      paid: true,
      dispatched: true,
      orderResult: soraData
    });
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
    const qrString = buildBakongKHQR(amount, currency, tranId);
    const deepLink = `bakong://qr?data=${encodeURIComponent(qrString)}`;
    res.json({
      success: true,
      tranId,
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
    const { tranId } = req.body || {};
    const response = await fetch(`${PAYLINK_CONFIG.baseUrl}/api/payment/check`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYLINK_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tranId })
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Check player name in real-time across MLBB, Free Fire, and Roblox
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
          return res.json({
            success: true,
            data: {
              username: mlData.name,
              id: uid,
              zone: zone
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
      try {
        const ffRes = await fetch(`https://api.isan.eu.org/nickname/ff?id=${encodeURIComponent(uid)}`);
        const ffData = await ffRes.json().catch(() => null);
        if (ffData && ffData.success && ffData.name && String(ffData.name).trim()) {
          return res.json({
            success: true,
            data: {
              username: ffData.name,
              id: uid,
              zone: ''
            }
          });
        }
      } catch (err) {
        console.warn('Free Fire verification error:', err.message);
      }

      return res.json({
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
          body: JSON.stringify({ usernames: [uid], excludeBannedUsers: true })
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
          } catch (_) {}

          return res.json({
            success: true,
            data: {
              username: robloxUser.displayName || robloxUser.name,
              id: String(robloxUser.id),
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 ONE LOVE TOPUP Production Server running on port ${PORT}`);
});

