import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SETTINGS_FILE = path.resolve(__dirname, 'admin-settings.json');

let pool = null;
let isConnected = false;
let connectionInfo = {
  status: 'disconnected',
  host: null,
  database: null,
  lastError: null,
  tableStats: {}
};

// Memory fallback cache in case MySQL is still connecting or offline
const memoryOrders = new Map();
const memorySessions = new Map();
const memoryOtps = new Map();
let cachedSettings = null;

// Read default settings from file or built-in defaults
function getFallbackSettings() {
  if (cachedSettings) return cachedSettings;
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      cachedSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      return cachedSettings;
    }
  } catch (e) {}

  cachedSettings = {
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
    },
    customPrices: {}
  };
  return cachedSettings;
}

// Build MySQL configuration from Railway or standard environment variables
function getPoolConfig() {
  const url = process.env.MYSQL_URL || 
              process.env.MYSQL_PRIVATE_URL || 
              process.env.DATABASE_URL || 
              process.env.DATABASE_PUBLIC_URL || 
              process.env.MYSQL_PUBLIC_URL;

  if (url && url.startsWith('mysql')) {
    const config = {
      uri: url,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000
    };
    if (process.env.MYSQL_SSL === 'true' || url.includes('ssl=true') || url.includes('sslmode=require')) {
      config.ssl = { rejectUnauthorized: false };
    }
    return config;
  }

  const host = process.env.MYSQLHOST || process.env.DB_HOST;
  if (host) {
    const config = {
      host: host,
      user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
      password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
      database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'railway',
      port: Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000
    };
    if (process.env.MYSQL_SSL === 'true') {
      config.ssl = { rejectUnauthorized: false };
    }
    return config;
  }

  return null;
}

export async function initDb() {
  const config = getPoolConfig();
  if (!config) {
    console.log('ℹ️ [MySQL] No MYSQL_URL or MYSQLHOST configured. Operating with local fallback.');
    connectionInfo = {
      status: 'fallback_memory_json',
      host: 'none',
      database: 'local_file',
      lastError: 'No database credentials provided in environment variables'
    };
    return false;
  }

  try {
    pool = mysql.createPool(config);
    // Test connection
    const [rows] = await pool.query('SELECT 1 as test');
    isConnected = true;

    const hostLabel = config.host || (config.uri ? config.uri.split('@')[1]?.split('/')[0] : 'railway-mysql');
    const dbLabel = config.database || (config.uri ? config.uri.split('/').pop()?.split('?')[0] : 'railway');

    connectionInfo = {
      status: 'connected',
      host: hostLabel,
      database: dbLabel,
      lastError: null
    };
    console.log(`✅ [MySQL] Successfully connected to MySQL database: ${dbLabel} at ${hostLabel}`);

    await setupTables();
    await seedSettingsIfEmpty();
    return true;
  } catch (err) {
    isConnected = false;
    connectionInfo = {
      status: 'error_fallback',
      host: config.host || 'unknown',
      database: config.database || 'unknown',
      lastError: err.message
    };
    console.warn(`⚠️ [MySQL] Could not connect to MySQL (${err.message}). Safe in-memory/JSON fallback active.`);
    return false;
  }
}

async function setupTables() {
  if (!pool) return;

  // 1. admin_settings table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_settings (
      id INT PRIMARY KEY DEFAULT 1,
      admin_pin VARCHAR(255) NOT NULL,
      games_config LONGTEXT NOT NULL,
      custom_prices LONGTEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 2. orders table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      order_id VARCHAR(100) PRIMARY KEY,
      tran_id VARCHAR(100) NOT NULL UNIQUE,
      bill_number VARCHAR(100),
      game VARCHAR(50) NOT NULL,
      package_code VARCHAR(100) NOT NULL,
      package_name VARCHAR(255) NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      currency VARCHAR(10) DEFAULT 'USD',
      player_id VARCHAR(100) NOT NULL,
      server_id VARCHAR(100) DEFAULT '',
      player_name VARCHAR(255) DEFAULT '',
      qr_string MEDIUMTEXT,
      deep_link MEDIUMTEXT,
      status VARCHAR(50) DEFAULT 'PENDING',
      verified_paid TINYINT(1) DEFAULT 0,
      dispatched TINYINT(1) DEFAULT 0,
      sora_result MEDIUMTEXT,
      created_at BIGINT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_tran_id (tran_id),
      INDEX idx_bill_number (bill_number),
      INDEX idx_game (game),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 3. admin_sessions table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token VARCHAR(255) PRIMARY KEY,
      expires_at BIGINT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 4. admin_otps table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_otps (
      otp VARCHAR(20) PRIMARY KEY,
      expires_at BIGINT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 5. media_uploads table (keeps all uploaded logos/covers permanently persistent across redeployments!)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS media_uploads (
      filename VARCHAR(255) PRIMARY KEY,
      mime_type VARCHAR(100) NOT NULL,
      data_base64 LONGTEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log('✅ [MySQL] All database tables verified and ready.');
}

async function seedSettingsIfEmpty() {
  if (!pool) return;
  try {
    const [rows] = await pool.query('SELECT id FROM admin_settings WHERE id = 1 LIMIT 1');
    if (rows.length === 0) {
      const initial = getFallbackSettings();
      await pool.query(
        'INSERT INTO admin_settings (id, admin_pin, games_config, custom_prices) VALUES (1, ?, ?, ?)',
        [
          initial.adminPin || 'onelove2026',
          JSON.stringify(initial.games || {}),
          JSON.stringify(initial.customPrices || {})
        ]
      );
      console.log('🌱 [MySQL] Successfully seeded initial admin settings into database.');
    }

    // Auto-migrate any local media uploads into MySQL
    if (memoryMedia.size > 0) {
      for (const [filename, item] of memoryMedia.entries()) {
        try {
          await pool.query(
            'INSERT IGNORE INTO media_uploads (filename, mime_type, data_base64) VALUES (?, ?, ?)',
            [filename, item.mimeType || 'image/png', item.base64]
          );
        } catch (_) { }
      }
      console.log(`📦 [MySQL] Migrated ${memoryMedia.size} local uploaded assets into MySQL media_uploads.`);
    }
  } catch (err) {
    console.warn('⚠️ [MySQL] Seed check warning:', err.message);
  }
}

// --- SETTINGS OPERATIONS ---
export async function getSettings() {
  if (pool && isConnected) {
    try {
      const [rows] = await pool.query('SELECT * FROM admin_settings WHERE id = 1 LIMIT 1');
      if (rows.length > 0) {
        const row = rows[0];
        const games = typeof row.games_config === 'string' ? JSON.parse(row.games_config || '{}') : (row.games_config || {});
        const customPrices = typeof row.custom_prices === 'string' ? JSON.parse(row.custom_prices || '{}') : (row.custom_prices || {});
        const res = {
          adminPin: row.admin_pin || 'onelove2026',
          games,
          customPrices
        };
        cachedSettings = res;
        return res;
      }
    } catch (e) {
      console.warn('⚠️ [MySQL] getSettings error, falling back to cache:', e.message);
    }
  }
  return getFallbackSettings();
}

export async function saveSettings(data) {
  cachedSettings = data;

  // Also write to local file for backup
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}

  if (pool && isConnected) {
    try {
      await pool.query(
        `INSERT INTO admin_settings (id, admin_pin, games_config, custom_prices) 
         VALUES (1, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE 
           admin_pin = VALUES(admin_pin), 
           games_config = VALUES(games_config), 
           custom_prices = VALUES(custom_prices)`,
        [
          data.adminPin || 'onelove2026',
          JSON.stringify(data.games || {}),
          JSON.stringify(data.customPrices || {})
        ]
      );
      return true;
    } catch (e) {
      console.warn('⚠️ [MySQL] saveSettings error:', e.message);
    }
  }
  return true;
}

// --- ORDERS OPERATIONS ---
export async function createOrder(orderRecord) {
  // Save in memory for instant lookups
  memoryOrders.set(orderRecord.orderId, orderRecord);
  memoryOrders.set(orderRecord.tranId, orderRecord);
  if (orderRecord.billNumber && orderRecord.billNumber !== orderRecord.tranId) {
    memoryOrders.set(orderRecord.billNumber, orderRecord);
  }

  if (pool && isConnected) {
    try {
      await pool.query(
        `INSERT INTO orders 
          (order_id, tran_id, bill_number, game, package_code, package_name, amount, currency, player_id, server_id, player_name, qr_string, deep_link, status, verified_paid, dispatched, sora_result, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           amount = VALUES(amount),
           qr_string = VALUES(qr_string),
           deep_link = VALUES(deep_link),
           status = VALUES(status)`,
        [
          orderRecord.orderId,
          orderRecord.tranId,
          orderRecord.billNumber || orderRecord.tranId,
          orderRecord.game,
          orderRecord.packageCode,
          orderRecord.packageName,
          orderRecord.amount,
          orderRecord.currency || 'USD',
          orderRecord.playerId,
          orderRecord.serverId || '',
          orderRecord.playerName || '',
          orderRecord.qrString || '',
          orderRecord.deepLink || '',
          orderRecord.status || 'PENDING',
          orderRecord.verifiedPaid ? 1 : 0,
          orderRecord.dispatched ? 1 : 0,
          orderRecord.soraResult ? JSON.stringify(orderRecord.soraResult) : null,
          orderRecord.createdAt || Date.now()
        ]
      );
      return true;
    } catch (e) {
      console.warn('⚠️ [MySQL] createOrder error:', e.message);
    }
  }
  return true;
}

export async function getOrder(idOrTran) {
  if (!idOrTran) return null;
  const key = String(idOrTran).trim();

  // Check memory map first
  if (memoryOrders.has(key)) {
    return memoryOrders.get(key);
  }

  if (pool && isConnected) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM orders WHERE order_id = ? OR tran_id = ? OR bill_number = ? LIMIT 1',
        [key, key, key]
      );
      if (rows.length > 0) {
        const r = rows[0];
        let soraResult = null;
        try {
          soraResult = typeof r.sora_result === 'string' ? JSON.parse(r.sora_result) : r.sora_result;
        } catch (_) {}

        const parsedOrder = {
          orderId: r.order_id,
          tranId: r.tran_id,
          billNumber: r.bill_number,
          game: r.game,
          packageCode: r.package_code,
          packageName: r.package_name,
          amount: Number(r.amount),
          currency: r.currency,
          playerId: r.player_id,
          serverId: r.server_id,
          playerName: r.player_name,
          qrString: r.qr_string,
          deepLink: r.deep_link,
          status: r.status,
          verifiedPaid: Boolean(r.verified_paid),
          dispatched: Boolean(r.dispatched),
          soraResult,
          createdAt: Number(r.created_at)
        };

        // Cache into memory map
        memoryOrders.set(parsedOrder.orderId, parsedOrder);
        memoryOrders.set(parsedOrder.tranId, parsedOrder);
        return parsedOrder;
      }
    } catch (e) {
      console.warn('⚠️ [MySQL] getOrder error:', e.message);
    }
  }

  // Iterate over memory map values if not found by direct key
  for (const o of memoryOrders.values()) {
    if (o.orderId === key || o.tranId === key || o.billNumber === key) {
      return o;
    }
  }
  return null;
}

export async function updateOrder(orderId, updates = {}) {
  const existing = await getOrder(orderId);
  const updated = {
    ...(existing || {}),
    ...updates
  };

  // Update memory map
  memoryOrders.set(orderId, updated);
  if (updated.tranId) memoryOrders.set(updated.tranId, updated);
  if (updated.billNumber) memoryOrders.set(updated.billNumber, updated);

  if (pool && isConnected) {
    try {
      await pool.query(
        `UPDATE orders SET 
          status = COALESCE(?, status),
          verified_paid = COALESCE(?, verified_paid),
          dispatched = COALESCE(?, dispatched),
          sora_result = COALESCE(?, sora_result)
         WHERE order_id = ? OR tran_id = ?`,
        [
          updates.status || (updates.dispatched ? 'SUCCESS' : (updates.verifiedPaid ? 'PAID' : null)),
          updates.verifiedPaid !== undefined ? (updates.verifiedPaid ? 1 : 0) : null,
          updates.dispatched !== undefined ? (updates.dispatched ? 1 : 0) : null,
          updates.soraResult ? JSON.stringify(updates.soraResult) : null,
          orderId,
          orderId
        ]
      );
      return true;
    } catch (e) {
      console.warn('⚠️ [MySQL] updateOrder error:', e.message);
    }
  }
  return true;
}

export async function getRecentOrders(limit = 50) {
  if (pool && isConnected) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM orders ORDER BY created_at DESC LIMIT ?',
        [Number(limit) || 50]
      );
      return rows.map(r => {
        let soraResult = null;
        try {
          soraResult = typeof r.sora_result === 'string' ? JSON.parse(r.sora_result) : r.sora_result;
        } catch (_) {}
        return {
          orderId: r.order_id,
          tranId: r.tran_id,
          billNumber: r.bill_number,
          game: r.game,
          packageCode: r.package_code,
          packageName: r.package_name,
          amount: Number(r.amount),
          currency: r.currency,
          playerId: r.player_id,
          serverId: r.server_id,
          playerName: r.player_name,
          status: r.status,
          verifiedPaid: Boolean(r.verified_paid),
          dispatched: Boolean(r.dispatched),
          soraResult,
          createdAt: Number(r.created_at)
        };
      });
    } catch (e) {
      console.warn('⚠️ [MySQL] getRecentOrders error:', e.message);
    }
  }

  // Memory fallback
  const unique = [];
  const seen = new Set();
  for (const o of memoryOrders.values()) {
    if (!seen.has(o.orderId)) {
      seen.add(o.orderId);
      unique.push(o);
    }
  }
  return unique.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}

// --- ADMIN SESSIONS OPERATIONS ---
export async function saveSession(token, expiresAt) {
  memorySessions.set(token, { expiresAt });
  if (pool && isConnected) {
    try {
      await pool.query(
        'INSERT INTO admin_sessions (token, expires_at) VALUES (?, ?) ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at)',
        [token, expiresAt]
      );
    } catch (e) {}
  }
}

export async function verifySession(token) {
  if (!token || typeof token !== 'string') return false;

  // Check memory first
  if (memorySessions.has(token)) {
    const s = memorySessions.get(token);
    if (Date.now() < s.expiresAt) return true;
  }

  if (pool && isConnected) {
    try {
      const [rows] = await pool.query(
        'SELECT expires_at FROM admin_sessions WHERE token = ? LIMIT 1',
        [token]
      );
      if (rows.length > 0 && Date.now() < Number(rows[0].expires_at)) {
        memorySessions.set(token, { expiresAt: Number(rows[0].expires_at) });
        return true;
      }
    } catch (e) {}
  }

  // Fallback signature check for adm_ timestamp
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

// --- ADMIN OTP OPERATIONS ---
export async function saveOtp(otp, expiresAt) {
  memoryOtps.set(String(otp).trim(), { expiresAt });
  if (pool && isConnected) {
    try {
      await pool.query(
        'INSERT INTO admin_otps (otp, expires_at) VALUES (?, ?) ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at)',
        [String(otp).trim(), expiresAt]
      );
    } catch (e) {}
  }
}

export async function verifyAndConsumeOtp(otp) {
  const code = String(otp).trim();
  const mem = memoryOtps.get(code);
  let valid = false;

  if (mem && Date.now() <= mem.expiresAt) {
    valid = true;
    memoryOtps.delete(code);
  }

  if (pool && isConnected) {
    try {
      const [rows] = await pool.query('SELECT expires_at FROM admin_otps WHERE otp = ? LIMIT 1', [code]);
      if (rows.length > 0 && Date.now() <= Number(rows[0].expires_at)) {
        valid = true;
      }
      await pool.query('DELETE FROM admin_otps WHERE otp = ?', [code]);
    } catch (e) {}
  }

  return valid;
}

// --- MEDIA UPLOADS (Permanent storage of uploaded logos & covers in MySQL + Local JSON Fallback) ---
const MEDIA_FILE = path.resolve(__dirname, 'media-uploads.json');
const memoryMedia = new Map();

// Load any existing media from local file on boot
try {
  if (fs.existsSync(MEDIA_FILE)) {
    const rawMedia = JSON.parse(fs.readFileSync(MEDIA_FILE, 'utf8'));
    for (const [k, v] of Object.entries(rawMedia || {})) {
      memoryMedia.set(k, v);
    }
  }
} catch (e) { }

function persistMediaFile() {
  try {
    const obj = {};
    for (const [k, v] of memoryMedia.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(MEDIA_FILE, JSON.stringify(obj), 'utf8');
  } catch (e) { }
}

export async function saveMedia(filename, mimeType, base64Data) {
  memoryMedia.set(filename, { mimeType, base64: base64Data });
  persistMediaFile();

  if (pool && isConnected) {
    try {
      await pool.query(
        'INSERT INTO media_uploads (filename, mime_type, data_base64) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), data_base64 = VALUES(data_base64)',
        [filename, mimeType, base64Data]
      );
      return true;
    } catch (e) {
      console.warn('⚠️ [MySQL] saveMedia error:', e.message);
    }
  }
  return true;
}

export async function getMedia(filename) {
  // 1. Check in-memory first
  if (memoryMedia.has(filename)) {
    return memoryMedia.get(filename);
  }

  // 2. Check MySQL if connected
  if (pool && isConnected) {
    try {
      const [rows] = await pool.query(
        'SELECT mime_type, data_base64 FROM media_uploads WHERE filename = ? LIMIT 1',
        [filename]
      );
      if (rows.length > 0) {
        const item = {
          mimeType: rows[0].mime_type,
          base64: rows[0].data_base64
        };
        memoryMedia.set(filename, item);
        return item;
      }
    } catch (e) {
      console.warn('⚠️ [MySQL] getMedia error:', e.message);
    }
  }

  // 3. Check local file fallback
  try {
    if (fs.existsSync(MEDIA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(MEDIA_FILE, 'utf8'));
      if (raw && raw[filename]) {
        memoryMedia.set(filename, raw[filename]);
        return raw[filename];
      }
    }
  } catch (e) { }

  return null;
}

// --- STATS & HEALTH ---
export async function getDbStatus() {
  let ordersCount = memoryOrders.size;
  if (pool && isConnected) {
    try {
      const [cnt] = await pool.query('SELECT COUNT(*) as total FROM orders');
      ordersCount = cnt[0]?.total || 0;
    } catch (_) {}
  }

  return {
    ...connectionInfo,
    isConnected,
    ordersCount
  };
}
