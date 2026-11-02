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

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'រកមិនឃើញឈ្មោះអ្នកលេងទេ! សូមពិនិត្យ ID ឡើងវិញ'
      };
    }

    return {
      success: true,
      data
    };
  } catch (err) {
    return {
      success: false,
      error: 'មិនអាចភ្ជាប់ទៅកាន់ប្រព័ន្ធផ្ទៀងផ្ទាត់បានទេ: ' + err.message
    };
  }
}

