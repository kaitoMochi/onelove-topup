/**
 * Sora Topup API Client
 * Base URL: https://app.soratopup.com/api/v1
 * Mode: Reseller API
 */

export async function getSoraProfile() {
  try {
    const res = await fetch('/api/sora/me');
    if (!res.ok) throw new Error('Failed to fetch Sora profile');
    return await res.json();
  } catch (err) {
    console.warn('getSoraProfile error:', err);
    return { ok: false, error: err.message };
  }
}

export async function getSoraPackages(game = 'ml') {
  try {
    const res = await fetch(`/api/sora/packages?game=${encodeURIComponent(game)}`);
    if (!res.ok) throw new Error(`Failed to fetch packages for ${game}`);
    return await res.json();
  } catch (err) {
    console.warn('getSoraPackages error:', err);
    return { ok: false, error: err.message, packages: [] };
  }
}

export async function getSoraOrders() {
  try {
    const res = await fetch('/api/sora/orders');
    if (!res.ok) throw new Error('Failed to fetch Sora orders');
    return await res.json();
  } catch (err) {
    console.warn('getSoraOrders error:', err);
    return { ok: false, error: err.message, orders: [] };
  }
}

export async function getSoraRobux() {
  try {
    const res = await fetch('/api/sora/robux');
    if (!res.ok) throw new Error('Failed to fetch Robux catalogue');
    return await res.json();
  } catch (err) {
    console.warn('getSoraRobux error:', err);
    return { ok: false, error: err.message, items: [] };
  }
}

export async function createSoraOrder(orderData) {
  try {
    const res = await fetch('/api/sora/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    });
    return await res.json();
  } catch (err) {
    console.error('createSoraOrder error:', err);
    return { ok: false, error: err.message };
  }
}
