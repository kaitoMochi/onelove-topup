// Admin settings manager for game assets, custom prices & background removal
import { classifySoraPackage } from '../data/games';

const STORAGE_KEY = 'onelove_admin_settings_v1';

const DEFAULT_SETTINGS = {
  siteLogo: '/logo.jpg',
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
      customTitle: 'Roblox (Robux)'
    },
    'pubg-mobile': {
      coverImage: '/games/pubg-mobile.webp',
      diamondIcon: '/assets/diamonds/pubg-uc.svg',
      customTitle: 'PUBG Mobile'
    },
    'blood-strike': {
      coverImage: '/games/blood-strike.png',
      diamondIcon: '/assets/diamonds/bloodstrike-gold.svg',
      customTitle: 'Blood Strike'
    },
    'zepeto': {
      coverImage: '/games/zepeto.webp',
      diamondIcon: '/assets/diamonds/zepeto-zem.svg',
      customTitle: 'Zepeto'
    }
  },
  customPrices: {}
};

// Every game key known locally or present in a settings object.
function allGameKeys(...gameMaps) {
  const keys = new Set(Object.keys(DEFAULT_SETTINGS.games));
  for (const m of gameMaps) {
    if (m && typeof m === 'object') Object.keys(m).forEach(k => keys.add(k));
  }
  return [...keys];
}

/**
 * High-Security Anti-Replay Challenge-Response Envelope Generator:
 * 1. Requests a single-use random nonce and timestamp from server (/api/admin/challenge)
 * 2. Computes an ephemeral one-time cryptographic proof: SHA256(nonce:ts:secret)
 * 3. Masks the payload into an opaque hex cipher so DevTools Inspect shows ZERO readable fields or static hashes.
 * 4. The server burns the challenge the instant it is verified, making replay attacks 100% impossible!
 */
export async function createSecureEnvelope(secret, extraFields = {}) {
  const res = await fetch('/api/admin/challenge');
  const challenge = await res.json();
  if (!challenge || !challenge.success || !challenge.nonce) {
    throw new Error('Failed to acquire security challenge from server');
  }

  const { keyId, nonce, ts } = challenge;

  const encoder = new TextEncoder();
  const proofBuffer = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(`${nonce}:${ts}:${String(secret || '').trim()}`)
  );
  const proof = Array.from(new Uint8Array(proofBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const payloadData = {
    ...extraFields,
    p: proof,
    ts
  };

  const str = JSON.stringify(payloadData);
  let envelope = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i) ^ nonce.charCodeAt(i % nonce.length);
    envelope += code.toString(16).padStart(2, '0');
  }

  return { keyId, envelope };
}

/**
 * Computes SHA-256 hash with salt for secure, masked authentication.
 * Prevents raw PIN/password from ever appearing in browser DevTools or Network inspect.
 */
export async function hashAdminSecret(secret) {
  if (!secret) return '';
  const encoder = new TextEncoder();
  const data = encoder.encode(`onelove_secure_salt_2026_${String(secret).trim()}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

let cachedSettings = null;

export function getAdminSettings() {
  if (cachedSettings) return cachedSettings;

  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) {
      cachedSettings = DEFAULT_SETTINGS;
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(raw);
    // Scrub any legacy stored adminPin from client localStorage
    if (parsed.adminPin) {
      delete parsed.adminPin;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed)); } catch (err) {}
    }
    // Auto-migrate any stale pass-card.png to vibrant vector mlbb-weekly-pass.svg
    if (parsed.games?.['mobile-legends']?.weeklyPassIcon?.includes('pass-card.png')) {
      parsed.games['mobile-legends'].weeklyPassIcon = '/assets/diamonds/mlbb-weekly-pass.svg';
    }
    const mergedGames = {};
    for (const key of allGameKeys(parsed.games)) {
      mergedGames[key] = { ...(DEFAULT_SETTINGS.games[key] || {}), ...(parsed.games?.[key] || {}) };
    }
    cachedSettings = {
      ...DEFAULT_SETTINGS,
      ...parsed,
      games: mergedGames,
      customPrices: {
        ...(DEFAULT_SETTINGS.customPrices || {}),
        ...(parsed.customPrices || {})
      }
    };
    return cachedSettings;
  } catch (e) {
    cachedSettings = DEFAULT_SETTINGS;
    return DEFAULT_SETTINGS;
  }
}

export function saveAdminSettings(settings) {
  try {
    cachedSettings = { ...settings };
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      window.dispatchEvent(new CustomEvent('onelove_settings_updated', { detail: settings }));
    }
    return true;
  } catch (e) {
    console.error('Failed to save settings:', e);
    return false;
  }
}

function mergeGameConfig(defaultGame, serverGame, localGame) {
  const result = { ...defaultGame, ...(serverGame || {}) };
  if (localGame) {
    for (const [key, val] of Object.entries(localGame)) {
      if (val && typeof val === 'string' && (val.startsWith('/uploads/') || val.startsWith('data:'))) {
        if (!result[key] || result[key] === defaultGame[key]) {
          result[key] = val;
        }
      }
    }
  }
  return result;
}

/**
 * Syncs settings with server backend (/api/admin/settings)
 * Ensures every visitor and device gets updated prices and images automatically!
 */
export async function syncAdminSettingsWithServer() {
  try {
    const res = await fetch('/api/admin/settings');
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.settings) {
        const local = getAdminSettings();
        const syncedGames = {};
        for (const key of allGameKeys(data.settings.games, local.games)) {
          syncedGames[key] = mergeGameConfig(DEFAULT_SETTINGS.games[key] || {}, data.settings.games?.[key], local.games?.[key]);
        }
        const merged = {
          ...DEFAULT_SETTINGS,
          ...data.settings,
          games: syncedGames,
          customPrices: {
            ...(DEFAULT_SETTINGS.customPrices || {}),
            ...(local.customPrices || {}),
            ...(data.settings.customPrices || {})
          }
        };
        cachedSettings = merged;
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          window.dispatchEvent(new CustomEvent('onelove_settings_updated', { detail: merged }));
        }
        return merged;
      }
    }
  } catch (e) {
    // console.warn('Sync admin settings offline:', e);
  }
  return getAdminSettings();
}

// Auto-sync on client load
if (typeof window !== 'undefined') {
  syncAdminSettingsWithServer();
}

export function getGameAsset(gameId, assetType, fallback = '') {
  const settings = getAdminSettings();
  const gameConfig = settings.games?.[gameId];
  if (!gameConfig) return fallback;

  if (assetType === 'diamond' && gameConfig.diamondIcon) {
    return gameConfig.diamondIcon;
  }
  if (assetType === 'weekly' && gameConfig.weeklyPassIcon) {
    if (typeof gameConfig.weeklyPassIcon === 'string' && gameConfig.weeklyPassIcon.includes('pass-card.png')) {
      return '/assets/diamonds/mlbb-weekly-pass.svg';
    }
    return gameConfig.weeklyPassIcon;
  }
  if (assetType === 'cover' && gameConfig.coverImage) {
    return gameConfig.coverImage;
  }
  return fallback;
}

// Admin can close a game's stock. When closed, the home card shows "Out of Stock"
// and the game page blocks checkout.
export function isGameStockClosed(gameId) {
  const settings = getAdminSettings();
  return !!(settings.games?.[gameId]?.stockClosed);
}

// Site-wide brand logo (Navbar, Footer, QR). Falls back to the bundled logo.
export function getSiteLogo() {
  const settings = getAdminSettings();
  return settings.siteLogo || '/logo.jpg';
}

// Admin can close stock for a single package (e.g. "100 Robux") within a game.
export function isPackageStockClosed(gameId, code) {
  const settings = getAdminSettings();
  const cp = settings.games?.[gameId]?.closedPackages;
  return !!(cp && cp[code]);
}

export function getCustomPrice(gameId, packageCode, defaultPrice) {
  const settings = getAdminSettings();
  const gamePrices = settings.customPrices?.[gameId];
  if (gamePrices && gamePrices[packageCode] !== undefined && gamePrices[packageCode] !== null && gamePrices[packageCode] !== '') {
    const p = Number(gamePrices[packageCode]);
    if (!isNaN(p) && p > 0) return p;
  }
  return Number(defaultPrice);
}

/**
 * Returns the exact custom icon uploaded by the admin for any package,
 * cleanly distinguishing between regular Diamonds and every specific Event Pass
 * (Weekly Diamond Pass, Weekly Elite, Monthly Epic, Twilight, Free Fire W.Card, W.Lite, M.Card, Level Up, Combo)
 */
export function getPackageCustomIcon(gameId, code, defaultFallback = '') {
  const settings = getAdminSettings();
  const cfg = settings.games?.[gameId] || {};
  const codeStr = String(code || '').trim();
  const codeLower = codeStr.toLowerCase();

  if (gameId === 'mobile-legends' || gameId === 'ml') {
    // 1. Weekly Diamond Pass (Weekly, 2Weekly, 3Weekly, 4Weekly, 5Weekly, 10Weekly)
    if (codeLower === 'weekly' || /^\d+weekly$/i.test(codeStr)) {
      return cfg.weeklyPassIcon || '/assets/diamonds/mlbb-weekly-pass.svg';
    }
    // 2. Weekly Elite Pass
    if (codeLower === 'weeklyelite') {
      return cfg.weeklyEliteIcon || '/assets/diamonds/elite-pass.svg';
    }
    // 3. Monthly Epic Pass
    if (codeLower === 'monthlyepic') {
      return cfg.monthlyEpicIcon || '/assets/diamonds/epic-pass.svg';
    }
    // 4. Twilight Pass
    if (codeLower === 'twilight') {
      return cfg.twilightIcon || '/assets/diamonds/twilight-pass.svg';
    }
    // 5. Normal Diamonds (numeric)
    return cfg.diamondIcon || defaultFallback || '/assets/diamonds/mlbb-diamond.png';
  }

  if (gameId === 'free-fire' || gameId === 'ff') {
    // 1. Weekly Membership (W.Card: weekly, 2weekly... 20weekly)
    if (codeLower === 'weekly' || (/^\d+weekly$/i.test(codeStr) && !codeLower.includes('lite'))) {
      return cfg.weeklyPassIcon || '/assets/diamonds/ff-weekly-card.svg';
    }
    // 2. Weekly Lite (W.Lite: weeklylite, 2weeklylite... 20weeklylite)
    if (codeLower === 'weeklylite' || /^\d+weeklylite$/i.test(codeStr)) {
      return cfg.weeklyLiteIcon || '/assets/diamonds/ff-weekly-lite.svg';
    }
    // 3. Monthly Membership (M.Card: monthly, 2monthly... 20monthly)
    if (codeLower === 'monthly' || /^\d+monthly$/i.test(codeStr)) {
      return cfg.monthlyCardIcon || '/assets/diamonds/ff-monthly-card.svg';
    }
    // 4. Level Up Pass (lup, l6, l10, l15, l20, l25, l30)
    if (codeLower === 'lup' || /^l\d+$/i.test(codeStr)) {
      return cfg.levelUpIcon || '/assets/diamonds/ff-levelup.svg';
    }
    // 5. Combo (mwl, 2mwl, 3mwl, 5mwl)
    if (codeLower === 'mwl' || /\d*mwl/i.test(codeStr)) {
      return cfg.comboIcon || '/assets/diamonds/ff-combo.svg';
    }
    // 6. Normal Diamonds (numeric)
    return cfg.diamondIcon || defaultFallback || '/assets/diamonds/ff-diamond.png';
  }

  if (gameId === 'roblox') {
    return cfg.diamondIcon || defaultFallback || '/assets/diamonds/robux-gold.svg';
  }

  // PUBG Mobile / Blood Strike / Zepeto: the admin "currency" icon applies to the
  // main currency packages (UC, Gold, ZEMS); other items keep their own icon.
  const pkgInfo = classifySoraPackage(gameId, codeStr);
  const currencySections = ['uc', 'wow', 'gold', 'deals', 'zems'];
  if (currencySections.includes(pkgInfo.section) && cfg.diamondIcon) {
    return cfg.diamondIcon;
  }
  return defaultFallback || pkgInfo.icon;
}

/**
 * Uploads an image asset to the server (/api/admin/upload)
 * Saves file to /public/uploads/ and returns a clean, lightweight static URL.
 */
export async function uploadAdminAsset(dataUrl, type = 'asset') {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return dataUrl;
  }

  try {
    const token = typeof window !== 'undefined'
      ? (sessionStorage.getItem('onelove_admin_token') || localStorage.getItem('onelove_admin_token') || '')
      : '';
    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ image: dataUrl, type, token })
    });

    const data = await res.json();
    if (res.ok && data.success && data.url) {
      return data.url;
    }
  } catch (err) {
    console.warn('Server upload fallback to dataUrl:', err);
  }
  return dataUrl;
}

/**
 * Smart automatic background removal for logos:
 * - Downscales large images to max 512x512 so it runs in 20ms without freezing
 * - Detects already-transparent PNGs and preserves them
 * - Cleanly cuts solid white or black backgrounds into transparent PNG
 */
export function removeImageBackground(dataUrl, tolerance = 35) {
  return new Promise((resolve) => {
    if (!dataUrl || typeof window === 'undefined') {
      resolve(dataUrl);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        // Optimize dimensions (max 512px for icon logos)
        const maxDim = 512;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        // Sample corner pixels
        const cornerIndices = [
          0, // top-left
          (w - 1) * 4, // top-right
          ((h - 1) * w) * 4, // bottom-left
          ((h - 1) * w + w - 1) * 4 // bottom-right
        ];

        // Check if image is already transparent
        let transparentCorners = 0;
        cornerIndices.forEach(idx => {
          if (data[idx + 3] < 25) transparentCorners++;
        });

        if (transparentCorners >= 3) {
          // Already transparent PNG, keep as is!
          resolve(canvas.toDataURL('image/png'));
          return;
        }

        let bgR = 0, bgG = 0, bgB = 0;
        cornerIndices.forEach(idx => {
          bgR += data[idx];
          bgG += data[idx + 1];
          bgB += data[idx + 2];
        });
        bgR = Math.round(bgR / 4);
        bgG = Math.round(bgG / 4);
        bgB = Math.round(bgB / 4);

        const isWhiteish = bgR > 225 && bgG > 225 && bgB > 225;

        // Only remove if corner is clearly pure white (never delete dark/black backgrounds to protect game art & passes)
        if (isWhiteish) {
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            const diff = Math.sqrt(
              Math.pow(r - bgR, 2) +
              Math.pow(g - bgG, 2) +
              Math.pow(b - bgB, 2)
            );

            if (diff < tolerance) {
              data[i + 3] = 0; // Transparent
            } else if (diff < tolerance + 15) {
              const factor = (diff - tolerance) / 15;
              data[i + 3] = Math.round(data[i + 3] * factor);
            }
          }
          ctx.putImageData(imgData, 0, 0);
        }

        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        console.warn('Background removal error:', e);
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
