import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import { checkPaymentStatus, verifyAndDispatchOrder } from '../services/paylink';

export default function BakongQRModal({ paymentData, playerInfo, orderResult, currency, onClose, onSuccess }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('PENDING'); // PENDING | PAID | EXPIRED
  const [timeLeft, setTimeLeft] = useState(900); // 15 mins
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!paymentData?.qrString) return;

    QRCode.toDataURL(paymentData.qrString, {
      width: 340,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('QR generation error:', err));
  }, [paymentData?.qrString]);

  useEffect(() => {
    if (!paymentData?.tranId || paymentStatus === 'PAID' || paymentStatus === 'EXPIRED') return;

    const interval = setInterval(async () => {
      try {
        let res;
        if (paymentData?.orderId) {
          res = await verifyAndDispatchOrder({ orderId: paymentData.orderId, tranId: paymentData.tranId });
        } else {
          res = await checkPaymentStatus(paymentData.tranId);
        }

        if (res && (res.paid || res.status === 'PAID')) {
          setPaymentStatus('PAID');
          clearInterval(interval);
          
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
          });

          if (onSuccess) {
            onSuccess(res);
          }
        } else if (res && res.status === 'EXPIRED') {
          setPaymentStatus('EXPIRED');
          clearInterval(interval);
        }
      } catch (e) {
        console.warn('Poll error:', e);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [paymentData?.tranId, paymentStatus, onSuccess]);

  useEffect(() => {
    if (paymentStatus !== 'PENDING') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setPaymentStatus('EXPIRED');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [paymentStatus]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleCopyTranId = () => {
    if (paymentData?.tranId) {
      navigator.clipboard.writeText(paymentData.tranId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formattedAmount = currency === 'KHR' 
    ? `${(paymentData?.amount * 4100).toLocaleString()} ៛`
    : `$${Number(paymentData?.amount || 0).toFixed(2)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-sm sm:max-w-md bg-[#160a2b] rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.9),0_0_20px_rgba(124,58,237,0.3)] overflow-hidden border border-purple-500/40 text-white">
        
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors"
        >
          ✕
        </button>

        {/* Official Bakong Header */}
        <div className="bg-[#E11E26] px-5 py-4 text-white text-center relative shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-black text-sm tracking-widest uppercase">
              <span className="bg-white text-[#E11E26] px-1.5 py-0.5 rounded font-black text-xs">KHQR</span>
              <span>BAKONG</span>
            </div>
            <div className="text-xs bg-black/30 px-2.5 py-1 rounded-full font-mono font-bold">
              ⏱ {formatTimer(timeLeft)}
            </div>
          </div>
          <div className="mt-2 text-xl font-black tracking-tight drop-shadow">
            ONE LOVE TOPUP
          </div>
          <div className="text-white/80 text-xs font-medium">
            Scan with any Cambodia Banking App
          </div>
        </div>

        {/* QR Code Container */}
        <div className="p-5 flex flex-col items-center bg-[#150a26] text-center">
          
          {paymentStatus === 'PAID' ? (
            <div className="py-6 flex flex-col items-center animate-fadeIn w-full">
              <div className="w-16 h-16 rounded-full bg-emerald-900/80 border-2 border-emerald-400 text-emerald-300 flex items-center justify-center text-3xl mb-3 shadow-[0_0_25px_rgba(16,185,129,0.5)]">
                ✓
              </div>
              <h3 className="text-xl font-extrabold text-emerald-400">ការទូទាត់ជោគជ័យ! (Paid Successful)</h3>
              
              {playerInfo?.username && (
                <div className="mt-3 p-3 rounded-2xl bg-emerald-950/60 border border-emerald-500/50 w-full text-xs text-left">
                  <div className="text-[11px] text-gray-300 font-semibold uppercase">
                    គណនីទទួល (Recipient Account):
                  </div>
                  <div className="text-base font-extrabold text-[#00f0ff] flex items-center gap-1.5 mt-0.5">
                    <span>{playerInfo.username}</span>
                    <span className="text-emerald-400 text-xs">✓</span>
                  </div>
                  <div className="text-[11px] text-gray-300 font-mono mt-0.5">
                    ID: {playerInfo.userId} {playerInfo.zoneId ? `(${playerInfo.zoneId})` : ''}
                  </div>
                </div>
              )}

              {/* Specific Game Delivery Confirmation */}
              <div className="mt-3 p-3 rounded-xl bg-[#1d0e37] border border-cyan-500/30 w-full text-xs text-center text-cyan-200">
                {playerInfo?.gameName?.toLowerCase().includes('roblox') ? (
                  <div>
                    <div className="font-bold text-emerald-300">⚡ ប្រព័ន្ធកំពុងផ្ញើ Robux ទៅកាន់ @{playerInfo.username}!</div>
                    {orderResult?.code && (
                      <div className="mt-2 p-2 rounded bg-black/60 font-mono text-cyan-300 text-sm border border-cyan-500/50 select-all">
                        Robux Code: <strong>{orderResult.code}</strong>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="font-bold text-emerald-300">⚡ ពេជ្រត្រូវបានបញ្ជូនដោយស្វ័យប្រវត្តទៅក្នុងហ្គេម 1-3 វិនាទី!</div>
                    <div className="text-[11px] text-gray-400 mt-1">Dispatched directly via Sora Topup API (24/7)</div>
                  </div>
                )}
              </div>

              <div className="mt-3 px-4 py-1.5 bg-[#1f0f38] border border-purple-500/30 rounded-xl text-[11px] font-mono text-gray-300">
                Tran ID: <span className="text-[#00f0ff]">{paymentData?.tranId}</span>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="mt-5 px-7 py-2.5 rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-cyan-500 text-white font-extrabold text-sm shadow-[0_0_15px_rgba(0,240,255,0.4)] hover:brightness-110 active:scale-95 transition-all"
              >
                រួចរាល់ (Close & Finish)
              </button>
            </div>
          ) : paymentStatus === 'EXPIRED' ? (
            <div className="py-8 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-red-950/80 border border-red-500 text-red-400 flex items-center justify-center text-3xl mb-3 shadow-[0_0_20px_rgba(239,68,68,0.4)]">
                ✕
              </div>
              <h3 className="text-xl font-extrabold text-red-400">QR Code Expired</h3>
              <p className="text-gray-400 text-sm mt-1">This payment request timed out. Please try again.</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-6 px-6 py-2.5 rounded-full bg-gray-800 text-white font-bold text-sm shadow hover:bg-gray-700 transition-all border border-gray-600"
              >
                Generate New QR
              </button>
            </div>
          ) : (
            <>
              {/* Amount Display */}
              <div className="mb-3">
                <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Total to Pay</span>
                <div className="text-2xl sm:text-3xl font-extrabold text-[#00f0ff] font-['Poppins'] drop-shadow-[0_0_10px_rgba(0,240,255,0.5)]">
                  {formattedAmount}
                </div>
              </div>

              {/* Recipient Account Details */}
              {playerInfo?.username && (
                <div className="w-full mb-3 px-3 py-2 rounded-xl bg-[#1d0e37] border border-purple-500/40 text-xs flex items-center justify-between text-left">
                  <div>
                    <div className="text-[10px] text-gray-400 uppercase font-semibold">គណនីទទួល (Recipient Account)</div>
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span className="text-[#00f0ff]">{playerInfo.username}</span>
                      <span className="text-emerald-400 text-xs">✓</span>
                    </div>
                    <div className="text-[11px] text-gray-300 font-mono">
                      ID: {playerInfo.userId} {playerInfo.zoneId ? `(${playerInfo.zoneId})` : ''}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-[#00f0ff] border border-cyan-500/30 text-[10px] font-bold">
                    {playerInfo.gameName || 'VERIFIED'}
                  </span>
                </div>
              )}

              {/* QR Box with Logo Overlay */}
              <div className="relative p-3 bg-white border-2 border-cyan-400/30 rounded-2xl shadow-inner flex items-center justify-center">
                {qrDataUrl ? (
                  <div className="relative">
                    <img 
                      src={qrDataUrl} 
                      alt="Bakong KHQR" 
                      className="w-56 h-56 sm:w-60 sm:h-60 object-contain"
                    />
                    {/* Centered Brand Mascot Logo - Compact & 100% Scan Safe */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-8 h-8 bg-white rounded-full p-0.5 shadow-md border border-[#E11E26] overflow-hidden">
                        <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover rounded-full" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-56 h-56 flex flex-col items-center justify-center gap-2 text-gray-500">
                    <span className="animate-spin text-2xl">⏳</span>
                    <span className="text-xs">Generating KHQR...</span>
                  </div>
                )}
              </div>

              {/* Status Indicator */}
              <div className="mt-3 flex items-center gap-2 text-xs text-amber-300 font-semibold bg-amber-950/50 px-3 py-1.5 rounded-full border border-amber-500/40">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                <span>Waiting for your transfer...</span>
              </div>

              {/* Mobile Actions: Deep Link & Download QR */}
              <div className="mt-3 w-full flex flex-col sm:flex-row gap-2">
                {paymentData?.deepLink && (
                  <a
                    href={paymentData.deepLink}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-[#E11E26] text-white font-bold text-xs uppercase tracking-wider shadow hover:bg-[#c91820] active:scale-98 transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>📲 Open in Bank</span>
                  </a>
                )}
                {qrDataUrl && (
                  <a
                    href={qrDataUrl}
                    download={`bakong_khqr_${paymentData?.tranId?.slice(-6) || 'pay'}.png`}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-purple-900/80 hover:bg-purple-800/90 border border-purple-400/40 text-purple-200 font-bold text-xs tracking-wider shadow active:scale-98 transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>📥 Save QR</span>
                  </a>
                )}
              </div>

              {/* Transaction details & copy */}
              <div className="mt-3 w-full pt-3 border-t border-purple-500/20 flex items-center justify-between text-[11px] text-gray-400">
                <span>Tran ID: <span className="font-mono text-cyan-300">{paymentData?.tranId?.slice(-8)}</span></span>
                <button
                  type="button"
                  onClick={handleCopyTranId}
                  className="text-[#00f0ff] font-bold hover:underline"
                >
                  {copied ? 'Copied!' : 'Copy Full ID'}
                </button>
              </div>

              <p className="mt-2 text-[10px] text-gray-500">
                Supported: ABA, ACLEDA, Canadia, Wing, Sathapana, TrueMoney & 40+ banks
              </p>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
