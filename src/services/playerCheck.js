/**
 * Real Player & In-Game Name (IGN) verification service
 * Handles real lookup for:
 * 1. Mobile Legends (User ID + Zone ID)
 * 2. Free Fire Mobile (Player UID)
 * 3. Roblox (Username + Avatar)
 */

export async function verifyPlayer(gameId, userId, zoneId = '') {
  try {
    const res = await fetch('/api/check-player', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        game: gameId,
        userId: userId.trim(),
        zoneId: zoneId.trim()
      })
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data || !data.success) {
      return {
        success: false,
        error: (data && data.error) ? data.error : 'រកមិនឃើញឈ្មោះអ្នកលេងទេ! សូមពិនិត្យ ID ឡើងវិញ'
      };
    }

    // Unpack direct player object from server response
    const inner = data.data || data;
    const username = inner.username || inner.displayName || inner.name || data.username || data.name || '';
    const displayName = inner.displayName || inner.username || username;
    const avatar = inner.avatar || data.avatar || '';
    const id = inner.id || inner.userId || data.id || data.userId || userId.trim();
    const country = inner.country || data.country || 'Cambodia';
    const region = inner.region || data.region || '';
    const level = inner.level || data.level || '';

    const normalizedData = {
      ...data,
      ...inner,
      username,
      displayName,
      avatar,
      id,
      userId: id,
      country,
      region,
      level
    };

    return {
      success: true,
      data: normalizedData
    };
  } catch (err) {
    return {
      success: false,
      error: 'មិនអាចភ្ជាប់ទៅកាន់ប្រព័ន្ធផ្ទៀងផ្ទាត់បានទេ: ' + err.message
    };
  }
}

