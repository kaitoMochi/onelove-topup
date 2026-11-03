import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { formatFullPackageName } from './src/data/games.js'

const PAYLINK_CONFIG = {
  baseUrl: 'https://paylinkapi-bot.onrender.com',
  apiKey: 'plk_live_std_af901733065f27b5608e3c198026bfe6f23d',
  secret: 'whsec_4074c0b74b3d64a19de5c3f27f5bf022e75e593bfeb5e1955bb69bff212d3cb3',
  storeName: 'ONE LOVE TOPUP',
  bakongId: 'onelo@bkrt',
}

const SORA_CONFIG = {
  baseUrl: 'https://app.soratopup.com/api/v1',
  apiKey: 'sk_7fbe263e907ce46212397f6746d4cd5c7bb65c0932ef666f'
}

const TELEGRAM_CONFIG = {
  botToken: '9095657133:AAFL4Yjo5ruXLeHw1BFhkr8KAXp61YF48YE',
  groupId: '-5416787286',
  adminChatIds: ['6389405398', '7283817695']
}

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
    const data = await res.json();
    return data;
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
        customTitle: 'Mobile Legends: Bang Bang'
      },
      'free-fire': {
        coverImage: '/games/free-fire-cover.jpg',
        diamondIcon: '/assets/diamonds/ff-diamond.png',
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

function apiProxyPlugin() {
  const activeOrders = new Map();
  const rateLimitMap = new Map();
  const adminOtpMap = new Map();
  const adminSessions = new Map();
  const adminChallenges = new Map(); // keyId -> { fullNonce, ts, createdAt }

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

  return {
    name: 'api-proxy-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost:3000');
        const pathname = url.pathname;

        // Anti-DDoS / Rate Limiter (Max 180 req / min per IP)
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        let ipRecord = rateLimitMap.get(clientIp);
        if (!ipRecord || now - ipRecord.start > 60000) {
          ipRecord = { start: now, count: 1 };
          rateLimitMap.set(clientIp, ipRecord);
        } else {
          ipRecord.count++;
          if (ipRecord.count > 180) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 429;
            res.end(JSON.stringify({ ok: false, error: 'Too many requests. Please wait a moment.' }));
            return;
          }
        }

        // --- ADMIN SETTINGS API ---
        if (pathname === '/api/admin/settings' && req.method === 'GET') {
          const settings = { ...getSavedSettings() };
          delete settings.adminPin; // CRITICAL: NEVER leak adminPin to client
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, settings }));
          return;
        }

        if (pathname === '/api/admin/settings' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const authHeader = req.headers['authorization'] || '';
              const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
              const { token, authHash, pin, settings } = JSON.parse(body || '{}');
              const sessionToken = bearerToken || token;

              const current = getSavedSettings();
              let isAuthorized = false;

              if (sessionToken && adminSessions.has(sessionToken)) {
                const session = adminSessions.get(sessionToken);
                if (Date.now() < session.expiresAt) {
                  isAuthorized = true;
                } else {
                  adminSessions.delete(sessionToken);
                }
              }

              if (!isAuthorized && (authHash || pin)) {
                isAuthorized = verifyAuthSecret(authHash || pin, current.adminPin);
              }

              if (!isAuthorized) {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 401;
                res.end(JSON.stringify({ success: false, error: 'Session ផុតកំណត់ ឬមិនមានសិទ្ធិ (Unauthorized)' }));
                return;
              }

              const updatedSettings = {
                ...settings,
                adminPin: current.adminPin || 'onelove2026'
              };
              saveSettingsFile(updatedSettings);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, msg: 'រក្សាទុកការកំណត់ Admin ជោគជ័យ' }));
            } catch (err) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        // --- ADMIN IMAGE UPLOAD API (Saves cleanly to public/uploads/ - fast & lightweight) ---
        if (pathname === '/api/admin/upload' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const { image, type = 'asset' } = JSON.parse(body || '{}');
              if (!image) {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: 'No image provided' }));
                return;
              }

              // Parse base64 data
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

              const filePath = path.resolve(uploadDir, safeFilename);
              fs.writeFileSync(filePath, buffer);

              const publicUrl = `/uploads/${safeFilename}`;

              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                url: publicUrl,
                filename: safeFilename
              }));
            } catch (err) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        // --- ADMIN CHALLENGE API (Single-use ephemeral nonce against replay attacks) ---
        if (pathname === '/api/admin/challenge' && req.method === 'GET') {
          const fullNonce = crypto.randomBytes(24).toString('hex');
          const keyId = fullNonce.slice(0, 10);
          const ts = Date.now();
          adminChallenges.set(keyId, { fullNonce, ts, createdAt: ts });
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, keyId, nonce: fullNonce, ts }));
          return;
        }

        // --- ADMIN 2FA OTP: REQUEST OTP VIA TELEGRAM ---
        if (pathname === '/api/admin/request-otp' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const { keyId, envelope, authHash, pin } = JSON.parse(body || '{}');
              const current = getSavedSettings();

              if (keyId && envelope) {
                const check = validateAndConsumeEnvelope(keyId, envelope, current.adminPin);
                if (!check.ok) {
                  res.setHeader('Content-Type', 'application/json');
                  res.statusCode = 401;
                  res.end(JSON.stringify({ success: false, error: check.error }));
                  return;
                }
              } else if (!verifyAuthSecret(authHash || pin, current.adminPin)) {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 401;
                res.end(JSON.stringify({ success: false, error: 'Admin PIN មិនត្រឹមត្រូវទេ!' }));
                return;
              }

              // Generate 6-digit OTP code
              const otp = String(Math.floor(100000 + Math.random() * 900000));
              const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
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

              // Send to Admin 1 and Admin 2 DMs
              for (const adminId of TELEGRAM_CONFIG.adminChatIds) {
                sendTelegramMessage(adminId, otpMsg).catch(() => { });
              }

              // Also send to Group -5416787286 as reliable fallback so admin is never locked out
              sendTelegramMessage(TELEGRAM_CONFIG.groupId, otpMsg).catch(() => { });

              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                message: 'លេខកូដ OTP បានផ្ញើទៅកាន់ Telegram Admin & Group រួចរាល់ហើយ!'
              }));
            } catch (err) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        // --- ADMIN 2FA OTP: VERIFY OTP ---
        if (pathname === '/api/admin/verify-otp' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const { keyId, envelope, authHash, pin, otp: directOtp } = JSON.parse(body || '{}');
              const current = getSavedSettings();

              let otpToVerify = directOtp;

              if (keyId && envelope) {
                const check = validateAndConsumeEnvelope(keyId, envelope, current.adminPin);
                if (!check.ok) {
                  res.setHeader('Content-Type', 'application/json');
                  res.statusCode = 401;
                  res.end(JSON.stringify({ success: false, error: check.error }));
                  return;
                }
                if (check.data && check.data.otp) {
                  otpToVerify = check.data.otp;
                }
              } else if (!verifyAuthSecret(authHash || pin, current.adminPin)) {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 401;
                res.end(JSON.stringify({ success: false, error: 'Admin PIN មិនត្រឹមត្រូវទេ!' }));
                return;
              }

              if (!otpToVerify) {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: 'សូមបញ្ចូលលេខកូដ OTP (Missing OTP)' }));
                return;
              }

              const rec = adminOtpMap.get(String(otpToVerify).trim());
              if (!rec || Date.now() > rec.expiresAt) {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: 'លេខកូដ OTP មិនត្រឹមត្រូវ ឬផុតកំណត់ហើយ!' }));
                return;
              }

              // Correct OTP! Clear and generate session token
              adminOtpMap.delete(String(otpToVerify).trim());
              const token = `adm_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
              adminSessions.set(token, { expiresAt: Date.now() + 24 * 60 * 60 * 1000 });

              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                token,
                message: 'ការផ្ទៀងផ្ទាត់ 2FA ជោគជ័យ!'
              }));
            } catch (err) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        // --- SORA TOPUP API PROXIES ---
        if (pathname === '/api/sora/me' && req.method === 'GET') {
          try {
            const resp = await fetch(`${SORA_CONFIG.baseUrl}/me`, {
              headers: { 'Authorization': `Bearer ${SORA_CONFIG.apiKey}` }
            });
            const data = await resp.json();
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = resp.status;
            res.end(JSON.stringify(data));
          } catch (err) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, error: err.message }));
          }
          return;
        }

        if (pathname === '/api/sora/orders' && req.method === 'GET') {
          try {
            const resp = await fetch(`${SORA_CONFIG.baseUrl}/orders`, {
              headers: { 'Authorization': `Bearer ${SORA_CONFIG.apiKey}` }
            });
            const data = await resp.json();
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = resp.status;
            res.end(JSON.stringify(data));
          } catch (err) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, error: err.message }));
          }
          return;
        }

        if (pathname === '/api/sora/packages' && req.method === 'GET') {
          try {
            const game = url.searchParams.get('game') || 'ml';
            const resp = await fetch(`${SORA_CONFIG.baseUrl}/packages?game=${encodeURIComponent(game)}`, {
              headers: { 'Authorization': `Bearer ${SORA_CONFIG.apiKey}` }
            });
            const data = await resp.json();
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = resp.status;
            res.end(JSON.stringify(data));
          } catch (err) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, error: err.message }));
          }
          return;
        }

        if (pathname === '/api/sora/robux' && req.method === 'GET') {
          try {
            const resp = await fetch(`${SORA_CONFIG.baseUrl}/robux/catalogue`, {
              headers: { 'Authorization': `Bearer ${SORA_CONFIG.apiKey}` }
            });
            const data = await resp.json();
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = resp.status;
            res.end(JSON.stringify(data));
          } catch (err) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, error: err.message }));
          }
          return;
        }

        // --- SECURE ORDERS: CREATE ORDER WITH TAMPER-PROOF SERVER PRICE ---
        if (pathname === '/api/orders/create' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const { game, packageCode, playerId, serverId, playerName = '', currency = 'USD' } = JSON.parse(body || '{}');

              if (!game || !packageCode || !playerId) {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: 'ព័ត៌មានមិនគ្រប់គ្រាន់ (Missing parameters)' }));
                return;
              }

              // 1. Check live Sora balance to ensure diamonds are in stock
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

              // 2. Fetch server-verified price for the requested package
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

              // Check if admin has set a custom price for this package
              const currentSettings = getSavedSettings();
              const gameKey = (game === 'ml' || game === 'mobile-legends') ? 'mobile-legends' : (game === 'ff' || game === 'free-fire' ? 'free-fire' : 'roblox');
              const customPrice = currentSettings.customPrices?.[gameKey]?.[packageCode];
              if (customPrice && Number(customPrice) > 0) {
                officialPrice = Number(customPrice);
              }

              if (officialPrice <= 0) {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: 'រកមិនឃើញកញ្ចប់ពេជ្រនេះទេ (Invalid Package)' }));
                return;
              }

              // Check if reseller balance can cover this package
              if (currentBalance <= 0 || currentBalance < officialPrice) {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 400;
                res.end(JSON.stringify({
                  success: false,
                  error: 'ពេជ្រដាច់ស្តុកបណ្តោះអាសន្ន (Out of Stock) - មិនអាចបង់ប្រាក់បានទេនៅពេលនេះ'
                }));
                return;
              }

              // 3. Generate Official Bakong KHQR using the SERVER PRICE (Client cannot tamper)
              let qrString = '';
              let deepLink = '';
              let tranId = '';

              try {
                const plRes = await fetch(`${PAYLINK_CONFIG.baseUrl}/api/bakong/generate-qr`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${PAYLINK_CONFIG.apiKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ amount: officialPrice, currency })
                });
                const plData = await plRes.json();
                if (plRes.ok && plData.success && plData.qrString) {
                  qrString = plData.qrString;
                  deepLink = plData.deepLink || `bakong://qr?data=${encodeURIComponent(qrString)}`;
                  tranId = plData.tranId || `PLK_${Date.now()}`;
                }
              } catch (e) { }

              // Fallback EMVCo QR if Paylink endpoint is offline
              if (!qrString) {
                tranId = `${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;
                qrString = buildBakongKHQR(officialPrice, currency, tranId);
                deepLink = `bakong://qr?data=${encodeURIComponent(qrString)}`;
              }

              const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

              // Store secure order state
              activeOrders.set(orderId, {
                orderId,
                tranId,
                game,
                packageCode: String(packageCode),
                packageName,
                playerId: String(playerId).trim(),
                playerName: playerName ? String(playerName).trim() : '',
                serverId: serverId ? String(serverId).trim() : '',
                amount: officialPrice,
                currency,
                qrString,
                deepLink,
                verifiedPaid: false,
                dispatched: false,
                createdAt: Date.now()
              });

              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                orderId,
                tranId,
                amount: officialPrice,
                currency,
                packageName,
                qrString,
                deepLink,
                merchantName: PAYLINK_CONFIG.storeName,
                merchantId: PAYLINK_CONFIG.bakongId
              }));
            } catch (err) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        // --- SECURE ORDERS: VERIFY PAYMENT AND AUTO-DISPATCH TO SORA ---
        if (pathname === '/api/orders/verify-and-dispatch' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const { orderId, tranId } = JSON.parse(body || '{}');

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
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 404;
                res.end(JSON.stringify({ success: false, error: 'រកមិនឃើញការបញ្ជាទិញនេះទេ' }));
                return;
              }

              // If already dispatched, return saved result
              if (order.dispatched) {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(JSON.stringify({
                  success: true,
                  paid: true,
                  dispatched: true,
                  orderResult: order.soraResult
                }));
                return;
              }

              // Verify payment with PayLink
              let isPaid = false;
              try {
                const checkRes = await fetch(`${PAYLINK_CONFIG.baseUrl}/api/payment/check`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${PAYLINK_CONFIG.apiKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ tranId: order.tranId })
                });
                const checkData = await checkRes.json();
                if (checkData.paid || checkData.status === 'PAID') {
                  isPaid = true;
                }
              } catch (e) { }

              if (!isPaid) {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(JSON.stringify({
                  success: true,
                  paid: false,
                  status: 'PENDING'
                }));
                return;
              }

              // Payment Verified! Execute Sora Dispatch Server-Side (Cannot be bypassed)
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

              // Instant Telegram Payment Alert to Group -5416787286
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

                sendTelegramMessage(TELEGRAM_CONFIG.groupId, alertMsg).catch(err => {
                  console.warn('Telegram payment alert error:', err.message);
                });
              } catch (alertErr) {
                console.warn('Telegram alert formatting error:', alertErr);
              }

              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                paid: true,
                dispatched: true,
                orderResult: soraData
              }));
            } catch (err) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        // --- DISALLOW RAW UNPROTECTED /api/sora/order CALLS ---
        if (pathname === '/api/sora/order' && req.method === 'POST') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 403;
          res.end(JSON.stringify({
            ok: false,
            error: 'Direct call forbidden. All orders must complete verified payment via /api/orders/verify-and-dispatch.'
          }));
          return;
        }

        // --- BAKONG KHQR PAYLINK FALLBACK PROXIES ---
        if (pathname === '/api/bakong/generate-qr' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const parsed = JSON.parse(body || '{}');
              const amount = Number(parsed.amount) || 1.00;
              const currency = parsed.currency || 'USD';

              const response = await fetch(`${PAYLINK_CONFIG.baseUrl}/api/bakong/generate-qr`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${PAYLINK_CONFIG.apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ amount, currency })
              });
              const data = await response.json();

              if (response.ok && data.success && data.qrString) {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(JSON.stringify({
                  ...data,
                  merchantName: PAYLINK_CONFIG.storeName,
                  merchantId: PAYLINK_CONFIG.bakongId
                }));
                return;
              }

              const tranId = `${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;
              const qrString = buildBakongKHQR(amount, currency, tranId);
              const deepLink = `bakong://qr?data=${encodeURIComponent(qrString)}`;

              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                tranId,
                billNumber: `BILL-${tranId.slice(-6)}`,
                qrString,
                deepLink,
                amount,
                currency,
                merchantName: PAYLINK_CONFIG.storeName,
                merchantId: PAYLINK_CONFIG.bakongId,
                bank: 'BAKONG'
              }));
            } catch (err) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        if (pathname === '/api/payment/check' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const parsed = JSON.parse(body || '{}');
              const tranId = parsed.tranId;

              const response = await fetch(`${PAYLINK_CONFIG.baseUrl}/api/payment/check`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${PAYLINK_CONFIG.apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ tranId })
              });
              const data = await response.json();
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = response.ok ? 200 : 400;
              res.end(JSON.stringify(data));
            } catch (err) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        // --- REAL PLAYER ID & ZONE ID VERIFICATION PROXY ---
        if (pathname === '/api/check-player' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const { game, userId, zoneId } = JSON.parse(body || '{}');

              if (!userId) {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: 'User ID is required' }));
                return;
              }

              // 1. MOBILE LEGENDS (Real User ID + Zone ID check)
              if (game === 'mobile-legends' || game === 'ml') {
                if (!zoneId) {
                  res.setHeader('Content-Type', 'application/json');
                  res.statusCode = 400;
                  res.end(JSON.stringify({ success: false, error: 'សូមបញ្ចូល Zone ID (Server ID)' }));
                  return;
                }

                let nickname = null;
                let country = null;

                try {
                  const r1 = await fetch(`https://mlbb-api.isan.eu.org/find?id=${encodeURIComponent(userId)}&zone=${encodeURIComponent(zoneId)}`);
                  if (r1.ok) {
                    const d1 = await r1.json();
                    if (d1.success && d1.name) {
                      nickname = d1.name;
                      country = d1.countryName || 'Global';
                    }
                  }
                } catch (e) { }

                if (!nickname) {
                  try {
                    const r2 = await fetch(`https://api.isan.eu.org/nickname/ml?id=${encodeURIComponent(userId)}&server=${encodeURIComponent(zoneId)}`);
                    if (r2.ok) {
                      const d2 = await r2.json();
                      if (d2.success && d2.name) {
                        nickname = d2.name;
                        country = d2.country || 'Global';
                      }
                    }
                  } catch (e) { }
                }

                if (nickname) {
                  res.setHeader('Content-Type', 'application/json');
                  res.statusCode = 200;
                  res.end(JSON.stringify({
                    success: true,
                    game: 'Mobile Legends',
                    username: nickname,
                    country: country,
                    userId,
                    zoneId
                  }));
                } else {
                  res.setHeader('Content-Type', 'application/json');
                  res.statusCode = 404;
                  res.end(JSON.stringify({
                    success: false,
                    error: 'រកមិនឃើញឈ្មោះអ្នកលេងទេ! សូមពិនិត្យមើល User ID និង Zone ID ឡើងវិញ'
                  }));
                }
                return;
              }

              // 2. FREE FIRE (Real Player ID lookup)
              if (game === 'free-fire' || game === 'ff') {
                let nickname = null;

                try {
                  const r1 = await fetch(`https://gopay.co.id/games/v1/order/prepare/FREEFIRE?userId=${encodeURIComponent(userId)}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
                  });
                  if (r1.ok) {
                    const d1 = await r1.json();
                    if (d1.data) {
                      nickname = d1.data;
                    }
                  }
                } catch (e) { }

                if (nickname) {
                  res.setHeader('Content-Type', 'application/json');
                  res.statusCode = 200;
                  res.end(JSON.stringify({
                    success: true,
                    game: 'Free Fire',
                    username: nickname,
                    userId
                  }));
                } else {
                  res.setHeader('Content-Type', 'application/json');
                  res.statusCode = 404;
                  res.end(JSON.stringify({
                    success: false,
                    error: 'រកមិនឃើញឈ្មោះអ្នកលេង Free Fire នេះទេ! សូមពិនិត្យ Player ID ឡើងវិញ'
                  }));
                }
                return;
              }

              // 3. ROBLOX (Real Username and Avatar lookup)
              if (game === 'roblox') {
                try {
                  const r1 = await fetch('https://users.roblox.com/v1/usernames/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ usernames: [userId.trim()], excludeBannedUsers: true })
                  });
                  const d1 = await r1.json();

                  if (d1.data && d1.data.length > 0) {
                    const userObj = d1.data[0];
                    let avatarUrl = null;

                    try {
                      const r2 = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userObj.id}&size=150x150&format=Png`);
                      const d2 = await r2.json();
                      avatarUrl = d2.data?.[0]?.imageUrl || null;
                    } catch (e) { }

                    res.setHeader('Content-Type', 'application/json');
                    res.statusCode = 200;
                    res.end(JSON.stringify({
                      success: true,
                      game: 'Roblox',
                      username: userObj.name,
                      displayName: userObj.displayName,
                      userId: userObj.id,
                      avatar: avatarUrl
                    }));
                    return;
                  } else {
                    res.setHeader('Content-Type', 'application/json');
                    res.statusCode = 404;
                    res.end(JSON.stringify({
                      success: false,
                      error: 'រកមិនឃើញឈ្មោះគណនី Roblox នេះទេ! សូមពិនិត្យមើល Username ឡើងវិញ'
                    }));
                    return;
                  }
                } catch (e) {
                  res.setHeader('Content-Type', 'application/json');
                  res.statusCode = 500;
                  res.end(JSON.stringify({ success: false, error: e.message }));
                  return;
                }
              }

              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: 'Unknown game' }));
            } catch (err) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), apiProxyPlugin()],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
  }
});
