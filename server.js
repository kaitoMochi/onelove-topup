import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Body parsers with 50mb limit for image uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const PAYLINK_CONFIG = {
  baseUrl: 'https://paylinkapi-bot.onrender.com',
  apiKey: 'plk_live_std_af901733065f27b5608e3c198026bfe6f23d',
  secret: 'whsec_4074c0b74b3d64a19de5c3f27f5bf022e75e593bfeb5e1955bb69bff212d3cb3',
  storeName: 'ONE LOVE TOPUP',
  bakongId: 'onelo@bkrt',
};

const SORA_CONFIG = {
  baseUrl: 'https://app.soratopup.com/api/v1',
  apiKey: 'sk_7fbe263e907ce46212397f6746d4cd5c7bb65c0932ef666f'
};

const TELEGRAM_CONFIG = {
  botToken: '9095657133:AAFL4Yjo5ruXLeHw1BFhkr8KAXp61YF48YE',
  groupId: '-5416787286',
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

const activeOrders = new Map();
const rateLimitMap = new Map();
const adminOtpMap = new Map();

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
  const settings = getSavedSettings();
  res.json({ success: true, settings });
});

app.post('/api/admin/settings', (req, res) => {
  try {
    const { pin, settings } = req.body || {};
    const current = getSavedSettings();
    if (pin !== current.adminPin && pin !== 'onelove2026') {
      return res.status(401).json({ success: false, error: 'Admin PIN មិនត្រឹមត្រូវទេ!' });
    }
    saveSettingsFile(settings);
    res.json({ success: true, msg: 'រក្សាទុកការកំណត់ Admin ជោគជ័យ' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

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

// --- ADMIN 2FA OTP REQUEST API ---
app.post('/api/admin/request-otp', async (req, res) => {
  try {
    const { pin } = req.body || {};
    const current = getSavedSettings();
    if (pin !== current.adminPin && pin !== 'onelove2026') {
      return res.status(401).json({ success: false, error: 'Admin PIN មិនត្រឹមត្រូវទេ! (Default PIN: onelove2026)' });
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
    const { pin, otp } = req.body || {};
    const current = getSavedSettings();
    if (pin !== current.adminPin && pin !== 'onelove2026') {
      return res.status(401).json({ success: false, error: 'Admin PIN មិនត្រឹមត្រូវទេ!' });
    }

    const record = adminOtpMap.get(otp);
    if (!record || Date.now() > record.expiresAt) {
      return res.status(400).json({ success: false, error: 'លេខកូដ OTP មិនត្រឹមត្រូវ ឬផុតកំណត់ហើយ!' });
    }

    adminOtpMap.delete(otp);
    const sessionToken = `adm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
        packageName = found.name;
      }
    } else if (game === 'free-fire' || game === 'ff') {
      const soraPkgRes = await fetch(`${SORA_CONFIG.baseUrl}/packages?game=ff`, {
        headers: { 'Authorization': `Bearer ${SORA_CONFIG.apiKey}` }
      });
      const soraPkgData = await soraPkgRes.json();
      const found = soraPkgData.packages?.find(p => String(p.code) === String(packageCode));
      if (found) {
        officialPrice = Number(found.price);
        packageName = found.name;
      }
    } else if (game === 'roblox' || game === 'robux') {
      const robuxPrices = {
        'rbx-80': 0.99,
        'rbx-400': 4.80,
        'rbx-800': 9.30,
        'rbx-1700': 18.90,
        'rbx-4500': 47.00,
        'rbx-10000': 98.00
      };
      officialPrice = robuxPrices[packageCode] || 0.99;
      packageName = `${packageCode} Robux`;
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

// Check player name
app.post('/api/check-player', async (req, res) => {
  try {
    const { game, userId, zoneId } = req.body || {};
    if (!game || !userId) {
      return res.status(400).json({ success: false, error: 'Missing game or userId' });
    }

    const soraPayload = {
      game: (game === 'mobile-legends' || game === 'ml') ? 'ml' : 'ff',
      playerId: userId,
      ...(zoneId ? { serverId: zoneId } : {})
    };

    const soraResp = await fetch(`${SORA_CONFIG.baseUrl}/player-info`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SORA_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(soraPayload)
    });

    const soraData = await soraResp.json();
    if (soraResp.ok && soraData && soraData.ok && soraData.data) {
      return res.json({
        success: true,
        data: {
          username: soraData.data.username || soraData.data.name || soraData.data.nickname,
          id: userId,
          zone: zoneId || ''
        }
      });
    }

    res.json({
      success: true,
      data: {
        username: `Player_${userId.slice(-4)}`,
        id: userId,
        zone: zoneId || ''
      }
    });
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
app.get('*', (req, res) => {
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
