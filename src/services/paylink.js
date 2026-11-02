export async function createSecureOrder({ game, packageCode, playerId, serverId, playerName, currency = 'USD' }) {
  try {
    const res = await fetch('/api/orders/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        game,
        packageCode,
        playerId,
        serverId,
        playerName,
        currency
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to create secure top-up order');
    }

    return data;
  } catch (err) {
    console.error('createSecureOrder error:', err);
    throw err;
  }
}

export async function verifyAndDispatchOrder({ orderId, tranId }) {
  try {
    const res = await fetch('/api/orders/verify-and-dispatch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orderId, tranId })
    });

    const data = await res.json();
    return data;
  } catch (err) {
    console.warn('verifyAndDispatchOrder error:', err);
    return { success: false, paid: false, status: 'PENDING', error: err.message };
  }
}

export async function generateBakongQR(amount, currency = 'USD') {
  const numericAmount = Math.max(0.1, Number(Number(amount).toFixed(2)));

  try {
    const res = await fetch('/api/bakong/generate-qr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: numericAmount,
        currency: currency === 'KHR' ? 'KHR' : 'USD'
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || data.message || 'Failed to generate live Bakong KHQR');
    }

    return {
      success: true,
      tranId: data.tranId || data.transactionId,
      billNumber: data.billNumber,
      qrString: data.qrString,
      deepLink: data.deepLink || data.deeplink,
      amount: data.amount,
      amountFormatted: data.amountFormatted,
      currency: data.currency,
      merchantName: data.merchantName || 'ONE LOVE TOPUP',
      merchantId: data.merchantId || 'onelo@bkrt',
      bank: data.bank || 'BAKONG'
    };
  } catch (err) {
    console.error('generateBakongQR error:', err);
    throw err;
  }
}

export async function checkPaymentStatus(tranId) {
  try {
    const res = await fetch('/api/payment/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tranId })
    });

    const data = await res.json();
    return {
      success: !!data.success,
      paid: data.paid === true || data.status === 'PAID' || data.status === 'SUCCESS',
      status: data.status || 'PENDING',
      bank: data.bank || 'BAKONG',
      tranId: data.tranId || tranId
    };
  } catch (err) {
    console.warn('checkPaymentStatus poll error:', err);
    return { success: false, paid: false, status: 'PENDING' };
  }
}
