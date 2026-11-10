import React, { useState, useEffect } from 'react';
import { createSecureOrder, generateBakongQR } from '../services/paylink';
import { createSoraOrder, getSoraPackages, getSoraRobux, getSoraProfile } from '../services/sora';
import { verifyPlayer } from '../services/playerCheck';
import { getGameAsset, getCustomPrice, getPackageCustomIcon, isGameStockClosed } from '../services/adminSettings';
import { formatFullPackageName } from '../data/games';
import BakongQRModal from '../components/BakongQRModal';

export default function GameDetailPage({ game, currency, onBack }) {
  const [userId, setUserId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [packagesList, setPackagesList] = useState(game?.packages || []);
  const [selectedPackage, setSelectedPackage] = useState(game?.packages?.[0] || null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [verifiedName, setVerifiedName] = useState('');
  const [playerData, setPlayerData] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showIdGuide, setShowIdGuide] = useState(false);
  const [settingsTick, setSettingsTick] = useState(0);

  // Real-time Reseller Stock & Balance States
  const [resellerBalance, setResellerBalance] = useState(null);
  const [isCheckingStock, setIsCheckingStock] = useState(true);

  // Payment & Sora Dispatch states
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [orderResult, setOrderResult] = useState(null);

  // Listen to Admin settings updates live
  useEffect(() => {
    const handleUpdate = () => {
      setSettingsTick(t => t + 1);
    };
    window.addEventListener('onelove_settings_updated', handleUpdate);
    return () => window.removeEventListener('onelove_settings_updated', handleUpdate);
  }, []);

  // Live stock check function
  const checkResellerStock = async () => {
    setIsCheckingStock(true);
    try {
      const profile = await getSoraProfile();
      if (profile && profile.ok) {
        setResellerBalance(Number(profile.balance ?? 0));
      } else {
        setResellerBalance(0);
      }
    } catch (e) {
      setResellerBalance(0);
    } finally {
      setIsCheckingStock(false);
    }
  };

  // Out of stock when the admin has closed this game's stock (re-evaluated on
  // every settings update via settingsTick).
  const isOutOfStock = isGameStockClosed(game.id) || settingsTick < 0;

  // Sync with live Sora Topup API packages & categorize them
  useEffect(() => {
    let isMounted = true;

    async function syncSoraPackages() {
      try {
        if (game.id === 'roblox') {
          const robuxData = await getSoraRobux();
          const ALLOWED_ROBUX_CODES = [
            '100_robux',
            '275_robux',
            '360_robux',
            '555_robux',
            '1000_robux',
            '2500_robux',
            '5250_robux',
            '11000_robux'
          ];
          const rawItems = (robuxData && robuxData.ok && robuxData.items?.length > 0) ? robuxData.items : (game.packages || []);
          const items = rawItems.filter(item => ALLOWED_ROBUX_CODES.includes(item.cardId || item.code || item.id));
          if (isMounted) {
            const mapped = items.map(item => {
              const code = item.cardId || item.code || item.id;
              const price = getCustomPrice('roblox', code, item.priceUsd || item.price);
              return {
                id: code,
                code: code,
                name: formatFullPackageName('roblox', code, item.name),
                section: 'diamonds',
                sectionTitle: 'Digital Robux Codes',
                category: 'diamonds',
                price: price,
                bonus: 'Digital Robux Code',
                points: `+${Math.round(price)} ពិន្ទុ`,
                img: getGameAsset('roblox', 'diamond', '/assets/diamonds/robux-gold.svg')
              };
            });
            setPackagesList(mapped);
            setSelectedPackage(mapped[0]);
          }
        } else if (game.id === 'mobile-legends') {
          const soraData = await getSoraPackages('ml');
          if (isMounted && soraData && soraData.ok && soraData.packages?.length > 0) {
            const mapped = [];

            // 1. Regular Diamonds (55 to 9288)
            soraData.packages.forEach(pkg => {
              const code = String(pkg.code);
              const isWeekly = ['Weekly', '2Weekly', '3Weekly', '4Weekly', '5Weekly', '10Weekly'].includes(code);
              const isSub = ['WeeklyElite', 'MonthlyEpic', 'Twilight'].includes(code);

              if (!isWeekly && !isSub) {
                const price = getCustomPrice('mobile-legends', code, pkg.price);
                mapped.push({
                  id: code,
                  code: code,
                  name: `${code} Diamonds`,
                  section: 'diamonds',
                  sectionTitle: 'Diamonds',
                  category: 'diamonds',
                  price: price,
                  bonus: `+Bonus 💎`,
                  points: `+${Math.max(1, Math.round(price))} ពិន្ទុ`,
                  img: getPackageCustomIcon('mobile-legends', code, '/assets/diamonds/mlbb-diamond.png')
                });
              }
            });

            // 2. Weekly Pass (Direct Live Connection to Sora Topup API)
            const weeklyCodes = ['Weekly', '2Weekly', '3Weekly', '4Weekly', '5Weekly', '10Weekly'];
            weeklyCodes.forEach(code => {
              const found = soraData.packages.find(p => String(p.code) === code);
              if (found) {
                const price = getCustomPrice('mobile-legends', code, found.price);
                mapped.push({
                  id: code,
                  code: code,
                  name: formatFullPackageName('mobile-legends', code, found.name),
                  section: 'weekly',
                  sectionTitle: 'Weekly Pass',
                  category: 'weekly',
                  price: price,
                  topTag: code === '3Weekly' ? 'Full Ticket' : null,
                  bonus: 'Weekly Pass',
                  points: `+${Math.max(1, Math.round(price))} ពិន្ទុ`,
                  img: getPackageCustomIcon('mobile-legends', code, '/assets/diamonds/mlbb-weekly-pass.svg')
                });
              }
            });

            // 3. Subscriptions & Special Passes (Direct Live Connection to Sora Topup API)
            const subCodes = [
              { code: 'WeeklyElite', name: 'Weekly Elite Pass', icon: '/assets/diamonds/elite-pass.svg', bonus: 'Elite Rewards' },
              { code: 'MonthlyEpic', name: 'Monthly Epic Pass', icon: '/assets/diamonds/epic-pass.svg', bonus: 'Epic Rewards' },
              { code: 'Twilight', name: 'Twilight Pass', icon: '/assets/diamonds/twilight-pass.svg', bonus: 'Exclusive Skin' }
            ];
            subCodes.forEach(sub => {
              const found = soraData.packages.find(p => String(p.code) === sub.code);
              if (found) {
                const price = getCustomPrice('mobile-legends', sub.code, found.price);
                mapped.push({
                  id: sub.code,
                  code: sub.code,
                  name: formatFullPackageName('mobile-legends', sub.code, sub.name),
                  section: 'subscriptions',
                  sectionTitle: 'Subscriptions & Special Passes',
                  category: 'subscriptions',
                  price: price,
                  bonus: sub.bonus,
                  points: `+${Math.max(1, Math.round(price))} ពិន្ទុ`,
                  img: getPackageCustomIcon('mobile-legends', sub.code, sub.icon)
                });
              }
            });

            setPackagesList(mapped);
            setSelectedPackage(mapped[0]);
          }
        } else {
          // Free Fire (All Live Packages from Sora: Diamonds, Weekly, Lite, Monthly, Level Up, Combos)
          const soraData = await getSoraPackages('ff');
          if (isMounted && soraData && soraData.ok && soraData.packages?.length > 0) {
            const mapped = soraData.packages.map(pkg => {
              const code = String(pkg.code);
              const codeLower = code.toLowerCase();
              const nameLower = String(pkg.name).toLowerCase();
              const price = getCustomPrice('free-fire', code, pkg.price);

              let section = 'diamonds';
              let sectionTitle = 'Diamonds';
              let category = 'diamonds';
              let img = getPackageCustomIcon('free-fire', code, price >= 3 ? '/assets/diamonds/ff-diamond-pack.png' : '/assets/diamonds/ff-diamond.png');
              let bonus = '+Bonus 💎';

              if (codeLower.includes('weeklylite')) {
                section = 'weekly';
                sectionTitle = 'Weekly Card & Lite';
                category = 'weekly';
                img = getPackageCustomIcon('free-fire', code, '/assets/diamonds/ff-weekly-lite.svg');
                bonus = 'Lite Diamonds';
              } else if (codeLower.includes('weekly') || nameLower.includes('w.card')) {
                section = 'weekly';
                sectionTitle = 'Weekly Card & Lite';
                category = 'weekly';
                img = getPackageCustomIcon('free-fire', code, '/assets/diamonds/ff-weekly-card.svg');
                bonus = 'VIP Member';
              } else if (codeLower.includes('monthly') || nameLower.includes('m.card')) {
                section = 'monthly';
                sectionTitle = 'Monthly Card';
                category = 'monthly';
                img = getPackageCustomIcon('free-fire', code, '/assets/diamonds/ff-monthly-card.svg');
                bonus = 'Super VIP';
              } else if (codeLower.startsWith('l') || nameLower.includes('lvup')) {
                section = 'special';
                sectionTitle = 'Level Up & Combos';
                category = 'special';
                img = getPackageCustomIcon('free-fire', code, '/assets/diamonds/ff-levelup.svg');
                bonus = 'Level Up Pass';
              } else if (codeLower.includes('mwl') || nameLower.includes('m+w+l')) {
                section = 'special';
                sectionTitle = 'Level Up & Combos';
                category = 'special';
                img = getPackageCustomIcon('free-fire', code, '/assets/diamonds/ff-combo.svg');
                bonus = 'M+W+L Combo';
              }

              return {
                id: code,
                code: code,
                name: formatFullPackageName('free-fire', code, pkg.name),
                section,
                sectionTitle,
                category,
                price,
                bonus,
                points: `+${Math.max(1, Math.round(price))} ពិន្ទុ`,
                img
              };
            });

            setPackagesList(mapped);
            setSelectedPackage(mapped[0]);
          }
        }
      } catch (err) {
        console.warn('Using preloaded game packages:', err);
      }
    }

    syncSoraPackages();
    checkResellerStock();
    return () => { isMounted = false; };
  }, [game.id, settingsTick]);

  // Auto-check live balance every 8 seconds while balance is 0 so it unlocks instantly when Sora approves deposit
  useEffect(() => {
    let interval;
    if (resellerBalance !== null && resellerBalance <= 0) {
      interval = setInterval(() => {
        checkResellerStock();
      }, 8000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resellerBalance]);

  // Handle Real Verify Game Account (MLBB User & Zone ID, Free Fire UID, Roblox Username)
  const handleVerify = async () => {
    if (!userId.trim()) {
      setErrorMessage(game.id === 'roblox' ? 'សូមបញ្ចូល Roblox Username របស់អ្នកជាមុនសិន' : 'សូមបញ្ចូល User ID របស់អ្នកជាមុនសិន');
      return;
    }
    if (game.needsZone && !zoneId.trim()) {
      setErrorMessage('សូមបញ្ចូល Server/Zone ID របស់អ្នក');
      return;
    }

    setIsVerifying(true);
    setErrorMessage('');

    try {
      const res = await verifyPlayer(game.id, userId, zoneId);
      if (res.success && res.data) {
        const p = res.data;
        const ign = p.username || p.displayName || p.name || '';
        setPlayerData(p);
        setVerifiedName(ign);
        setErrorMessage('');
      } else {
        setPlayerData(null);
        setVerifiedName('');
        setErrorMessage(res.error || 'រកមិនឃើញឈ្មោះអ្នកលេងទេ! សូមពិនិត្យ ID និង Zone ID ឡើងវិញ');
      }
    } catch (err) {
      setPlayerData(null);
      setVerifiedName('');
      setErrorMessage('មានបញ្ហាក្នុងការផ្ទៀងផ្ទាត់: ' + err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle Checkout / Pay Now
  const handleCheckout = async () => {
    if (!userId.trim()) {
      setErrorMessage(game.id === 'roblox' ? 'សូមបញ្ចូល Roblox Username របស់អ្នកជាមុនសិន!' : 'សូមបញ្ចូល User ID របស់អ្នកជាមុនសិន!');
      window.scrollTo({ top: 120, behavior: 'smooth' });
      return;
    }
    if (game.needsZone && !zoneId.trim()) {
      setErrorMessage('សូមបញ្ចូល Server/Zone ID របស់អ្នក!');
      window.scrollTo({ top: 120, behavior: 'smooth' });
      return;
    }
    if (!selectedPackage) {
      setErrorMessage('សូមជ្រើសរើសកញ្ចប់ពេជ្រដែលអ្នកចង់បញ្ចូល');
      return;
    }

    // Guard: Prevent payment when reseller diamond stock is empty / 0 balance
    if (isOutOfStock) {
      setErrorMessage('ពេជ្រដាច់ស្តុកបណ្តោះអាសន្ន (Diamond Out of Stock) - អ្នកមិនអាចបង់ប្រាក់បានទេនៅពេលនេះ (Cannot Pay Now)!');
      window.scrollTo({ top: 120, behavior: 'smooth' });
      return;
    }

    setErrorMessage('');
    setIsGeneratingQR(true);

    // Auto verify before checkout if not yet verified
    if (!verifiedName) {
      try {
        const verifyRes = await verifyPlayer(game.id, userId, zoneId);
        if (!verifyRes.success || !verifyRes.data) {
          setIsGeneratingQR(false);
          setErrorMessage(verifyRes.error || 'រកមិនឃើញឈ្មោះអ្នកលេងទេ! សូមពិនិត្យ ID ឡើងវិញមុនពេលបង់ប្រាក់');
          window.scrollTo({ top: 120, behavior: 'smooth' });
          return;
        }
        const p = verifyRes.data;
        const ign = p.username || p.displayName || p.name || '';
        setPlayerData(p);
        setVerifiedName(ign);
      } catch (e) {
        setIsGeneratingQR(false);
        setErrorMessage('មិនអាចផ្ទៀងផ្ទាត់គណនីបានទេ សូមព្យាយាមម្តងទៀត');
        return;
      }
    }

    try {
      // Secure Order Creation: Server verifies official price & stock, generates Bakong QR
      const result = await createSecureOrder({
        game: game.id,
        packageCode: selectedPackage.code || selectedPackage.id,
        playerId: userId.trim(),
        serverId: zoneId.trim(),
        playerName: verifiedName || playerData?.displayName || playerData?.username || '',
        currency
      });
      setPaymentData(result);
    } catch (err) {
      // Fallback to direct Bakong QR if needed
      try {
        const fallbackRes = await generateBakongQR(selectedPackage.price, currency);
        setPaymentData(fallbackRes);
      } catch (e2) {
        setErrorMessage(err.message || 'Error creating payment link. Please try again.');
      }
    } finally {
      setIsGeneratingQR(false);
    }
  };

  // Dispatch live order to Sora Topup upon successful Bakong payment
  const handlePaymentSuccess = async (paymentRes) => {
    if (paymentRes?.orderResult) {
      setOrderResult(paymentRes.orderResult);
      return;
    }

    try {
      let soraOrderPayload = {};
      if (game.id === 'roblox') {
        soraOrderPayload = {
          game: 'roblox',
          cardId: selectedPackage.code || selectedPackage.id
        };
      } else {
        soraOrderPayload = {
          game: game.id === 'mobile-legends' ? 'ml' : 'ff',
          code: selectedPackage.code || selectedPackage.id,
          playerId: userId.trim(),
          ...(zoneId.trim() ? { serverId: zoneId.trim() } : {})
        };
      }

      const soraRes = await createSoraOrder(soraOrderPayload);
      setOrderResult(soraRes);
    } catch (e) {
      console.warn('Sora dispatch error:', e);
    }
  };

  const formatPrice = (price) => {
    if (currency === 'KHR') {
      return `${(price * 4100).toLocaleString()} ៛`;
    }
    return `$${Number(price).toFixed(2)}`;
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 py-4 pb-28 text-gray-100">
      {/* Back button & Breadcrumb */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#160a2b] shadow-md border border-purple-500/30 text-gray-200 hover:text-[#00f0ff] hover:border-cyan-400 font-bold text-xs transition-all active:scale-95"
        >
          <span>←</span>
          <span>ត្រឡប់ក្រោយ (Back to Games)</span>
        </button>

        <span className="text-xs font-semibold text-gray-400">
          Home / <span className="text-[#00f0ff]">{game.name}</span>
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column: Game Cover & Details */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-[#150a26] rounded-2xl p-3 border border-purple-500/25 shadow-lg overflow-hidden">
            <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 relative border border-purple-500/20">
              <img
                src={getGameAsset(game.id, 'cover', game.banner || game.image)}
                alt={game.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b0318] via-transparent to-transparent"></div>
              <div className="absolute bottom-3 left-3 right-3 text-white">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-gradient-to-r from-purple-600 to-cyan-500 tracking-wider shadow">
                  {game.tag || 'OFFICIAL'}
                </span>
                <h1 className="text-xl font-extrabold mt-1 font-['Poppins']">
                  {game.name}
                </h1>
                <p className="text-xs text-cyan-300 font-khmer">
                  {game.khmerName || 'បញ្ចូលពេជ្រផ្ទាល់ 1-3 វិនាទី'}
                </p>
              </div>
            </div>

            {/* Safety & Service Features */}
            <div className="mt-4 pt-3 border-t border-purple-500/20 space-y-2 text-xs text-gray-300">
              <div className="flex items-center gap-2">
                <span className="text-[#00f0ff] font-bold">⚡</span>
                <span>ដំណើរការដោយស្វ័យប្រវត្តិ 24/7 (Sora API Live Dispatch)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">🛡️</span>
                <span>សុវត្ថិភាព 100% គ្មានបញ្ហា Ban ឬ Minus</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sky-400 font-bold">🏦</span>
                <span>ទូទាត់រហ័សជាមួយ Bakong KHQR និងគ្រប់ធនាគារ</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Step 1, Step 2, Step 3 */}
        <div className="lg:col-span-8 flex flex-col gap-5">

          {/* Error Alert */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-950/70 border border-red-500 text-red-200 text-xs font-semibold flex items-center justify-between animate-shake">
              <div className="flex items-center gap-2">
                <span>⚠️</span>
                <span>{errorMessage}</span>
              </div>
              <button onClick={() => setErrorMessage('')} className="text-red-400 hover:text-white">✕</button>
            </div>
          )}

          {/* Verified Username Top Floating Banner (Lisa Topup Style) */}
          {playerData && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-950 via-[#102b28] to-purple-950 border-2 border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.35)] flex items-center justify-between animate-fadeIn">
              <div className="flex items-center gap-3">
                {playerData.avatar ? (
                  <img
                    src={playerData.avatar}
                    alt={playerData.displayName || playerData.username || 'Avatar'}
                    className="w-11 h-11 rounded-full border-2 border-emerald-400 object-cover shadow"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-300 font-black text-xl shadow">
                    ✓
                  </div>
                )}
                <div>
                  <div className="text-[11px] text-emerald-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <span>🎮 ឈ្មោះគណនីហ្គេម (Game Account Name)</span>
                  </div>
                  <div className="text-base sm:text-xl font-black text-[#00f0ff] drop-shadow-[0_0_10px_rgba(0,240,255,0.6)]">
                    {playerData.displayName || playerData.username || verifiedName}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow">
                  ✓ រកឃើញឈ្មោះហើយ
                </span>
              </div>
            </div>
          )}

          {/* Step 1: Enter User ID */}
          <div className="topup-card overflow-hidden">
            <div className="step-header">
              <i className="fas fa-id-card text-lg"></i>
              <span>ជំហានទី ១ : បញ្ចូល អាយឌី (Account Info)</span>
            </div>

            <div className="p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    {game.idPlaceholder || 'User ID'}
                  </label>
                  <input
                    type="text"
                    value={userId}
                    onChange={(e) => {
                      setUserId(e.target.value);
                      setVerifiedName('');
                      setPlayerData(null);
                    }}
                    placeholder={game.idPlaceholder || 'e.g. 12345678'}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#1d0e37] border border-purple-500/40 focus:border-[#00f0ff] focus:ring-2 focus:ring-cyan-500/30 text-white placeholder-gray-500 outline-none text-sm font-mono transition-all"
                  />
                </div>

                {game.needsZone && (
                  <div className="w-full sm:w-44">
                    <label className="block text-xs font-bold text-gray-300 mb-1">
                      {game.zonePlaceholder || 'Zone ID'}
                    </label>
                    <input
                      type="text"
                      value={zoneId}
                      onChange={(e) => {
                        setZoneId(e.target.value);
                        setVerifiedName('');
                        setPlayerData(null);
                      }}
                      placeholder="e.g. 1234"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#1d0e37] border border-purple-500/40 focus:border-[#00f0ff] focus:ring-2 focus:ring-cyan-500/30 text-white placeholder-gray-500 outline-none text-sm font-mono transition-all"
                    />
                  </div>
                )}

                <div className="sm:self-end">
                  <button
                    type="button"
                    onClick={handleVerify}
                    disabled={isVerifying}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:brightness-110 text-white font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-60 flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(0,240,255,0.3)] active:scale-95"
                  >
                    {isVerifying ? (
                      <>
                        <span className="animate-spin text-sm">⏳</span>
                        <span>កំពុងពិនិត្យ...</span>
                      </>
                    ) : (
                      <>
                        <span>🔍</span>
                        <span>ពិនិត្យ ឈ្មោះ</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Rich Verified Player Profile Banner */}
              {playerData && (
                <div className="mt-4 p-4 rounded-2xl bg-[#140b2a] border-2 border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.25)] animate-fadeIn">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      {/* Avatar */}
                      {playerData.avatar ? (
                        <div className="relative">
                          <img
                            src={playerData.avatar}
                            alt={playerData.displayName || playerData.username || 'Avatar'}
                            className="w-14 h-14 rounded-full border-2 border-emerald-400 bg-slate-900 object-cover shadow"
                          />
                          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#140b2a] rounded-full"></span>
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white text-2xl font-black shadow-[0_0_12px_rgba(16,185,129,0.4)]">
                          🎮
                        </div>
                      )}

                      <div className="text-left">
                        <div className="text-[11px] text-emerald-400 font-extrabold uppercase tracking-wide">
                          ឈ្មោះក្នុងហ្គេម (Game Account Name) :
                        </div>
                        <div className="text-lg sm:text-xl font-black text-[#00f0ff] tracking-wide flex items-center gap-2 drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]">
                          <span>{playerData.displayName || playerData.username || verifiedName}</span>
                          <span className="text-emerald-400 text-sm">✓</span>
                        </div>
                        <div className="text-xs text-gray-300 mt-1 flex flex-wrap items-center gap-2">
                          {game.id === 'roblox' && (
                            <span className="font-mono text-cyan-300">Roblox User: @{playerData.username || userId} (ID: {playerData.userId || playerData.id})</span>
                          )}
                          {game.id === 'mobile-legends' && (
                            <span>Game ID: <strong className="text-cyan-300 font-mono">{userId}</strong> (Zone: <strong className="text-cyan-300 font-mono">{zoneId}</strong>) • តំបន់: <strong className="text-white">{playerData.country || 'Cambodia'}</strong></span>
                          )}
                          {game.id === 'free-fire' && (
                            <span>Player UID: <strong className="text-cyan-300 font-mono">{userId}</strong>{(playerData.region || playerData.country) ? <> • Server: <strong className="text-white">{playerData.region || playerData.country}</strong></> : null}{playerData.level ? <> • <strong className="text-emerald-400 font-mono">Lv.{playerData.level}</strong></> : null}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="self-start sm:self-center">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/90 text-emerald-300 border border-emerald-500 text-xs font-bold shadow">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span>ត្រឹមត្រូវ ១០០%</span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ID Guide Modal Trigger */}
              {game.guideImage && (
                <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                  <span className="text-[11px]">សូមប្រាកដថា User ID ត្រឹមត្រូវដើម្បីទទួលបានពេជ្រភ្លាមៗ</span>
                  <button
                    type="button"
                    onClick={() => setShowIdGuide(!showIdGuide)}
                    className="text-[#00f0ff] font-bold hover:underline"
                  >
                    {showIdGuide ? 'លាក់រូបជំនួយ' : 'របៀបរក ID?'}
                  </button>
                </div>
              )}

              {/* Helper Image */}
              {showIdGuide && game.guideImage && (
                <div className="mt-3 p-2 bg-[#120722] rounded-xl border border-purple-500/30">
                  <img src={game.guideImage} alt="ID Guide" className="w-full rounded-lg max-h-48 object-contain" />
                </div>
              )}
            </div>
          </div>

          {/* Real-time Game Stock Status */}
          <div className="mt-4">
            {isOutOfStock ? (
              <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-red-950/90 via-[#2a0d0d] to-purple-950/80 border-2 border-red-500/70 text-red-200 text-xs sm:text-sm shadow-[0_0_20px_rgba(239,68,68,0.25)] flex items-center justify-between gap-3 animate-fadeIn">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-red-500/20 border-2 border-red-400 flex items-center justify-center text-red-300 text-lg font-black shrink-0 shadow">
                    ✕
                  </div>
                  <div>
                    <div className="font-extrabold text-red-300 text-sm sm:text-base flex flex-wrap items-center gap-2">
                      <span>ដាច់ស្តុកបណ្តោះអាសន្ន (Out of Stock)</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-500/20 text-red-300 border border-red-500/40">
                        បិទស្តុក
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-300 mt-0.5">
                      សូមអភ័យទោស ហ្គេមនេះបិទការបញ្ចូលបណ្តោះអាសន្ន។ សូមត្រឡប់មកវិញពេលក្រោយ។
                    </div>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-red-400"></span>
                  <span>Closed</span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-950/90 via-[#0d2a23] to-purple-950/80 border-2 border-emerald-500/70 text-emerald-200 text-xs sm:text-sm shadow-[0_0_20px_rgba(16,185,129,0.25)] flex items-center justify-between gap-3 animate-fadeIn">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-300 text-lg font-black shrink-0 shadow">
                    ✓
                  </div>
                  <div>
                    <div className="font-extrabold text-emerald-300 text-sm sm:text-base flex flex-wrap items-center gap-2">
                      <span>មានស្តុកពេញលេញ (In Stock 24/7) — អាចទិញបានភ្លាមៗ</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        READY TO BUY ✓
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-300 mt-0.5">
                      ប្រព័ន្ធស្វ័យប្រវត្ត 24/7 • បញ្ចូលរហ័សទាន់ចិត្តតាមរយៈ Bakong KHQR (0% Fee)
                    </div>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Active 24/7</span>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Select Diamond Package */}
          <div className="topup-card overflow-hidden">
            <div className="step-header">
              <i className="fas fa-gem text-lg"></i>
              <span>ជំហានទី ២ : ជ្រើសរើសកញ្ចប់ ពេជ្រ (Select Package)</span>
            </div>

            <div className="p-3 sm:p-5">
              {/* Category Filter Chips */}
              {game.categories && game.categories.length > 1 && (
                <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
                  {game.categories.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategory(cat.id)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${activeCategory === cat.id
                          ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-[0_0_12px_rgba(0,240,255,0.4)] border border-cyan-300/40'
                          : 'bg-[#120726] text-gray-300 hover:text-white hover:bg-white/5 border border-purple-500/20'
                        }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Package Sections with Badges matching Nema Store layout */}
              {(() => {
                const visible = packagesList.filter(pkg => {
                  if (activeCategory === 'all') return true;
                  return pkg.section === activeCategory || pkg.category === activeCategory;
                });

                // Group by section maintaining order: diamonds -> weekly -> monthly -> subscriptions -> special
                const secOrder = ['diamonds', 'weekly', 'monthly', 'subscriptions', 'special'];
                const groups = {};
                visible.forEach(pkg => {
                  const s = pkg.section || 'diamonds';
                  if (!groups[s]) {
                    groups[s] = {
                      key: s,
                      title: pkg.sectionTitle || (s === 'weekly' ? 'Weekly Pass' : 'Diamonds'),
                      items: []
                    };
                  }
                  groups[s].items.push(pkg);
                });

                const orderedGroups = Object.keys(groups)
                  .sort((a, b) => {
                    const ia = secOrder.indexOf(a);
                    const ib = secOrder.indexOf(b);
                    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
                  })
                  .map(k => groups[k]);

                return (
                  <div className="space-y-6">
                    {orderedGroups.map(sec => (
                      <div key={sec.key} className="space-y-3">
                        {/* Section Header with Badge count */}
                        <div className="flex items-center gap-2 pt-1 border-b border-purple-500/20 pb-2">
                          <span className="font-extrabold text-sm sm:text-base text-gray-200 tracking-wide font-['Poppins']">
                            {sec.title}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-purple-900/60 text-purple-300 border border-purple-400/30 text-xs font-mono font-bold">
                            {sec.items.length}
                          </span>
                        </div>

                        {/* 3-column Grid of Horizontal Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                          {sec.items.map(pkg => {
                            const isSelected = selectedPackage?.id === pkg.id;

                            const pkgName = String(pkg?.name || '').toLowerCase();
                            const pkgCode = String(pkg?.code || '').toLowerCase();
                            const pkgId = String(pkg?.id || '').toLowerCase();

                            const isWeeklyPass = pkg.section === 'weekly' ||
                              pkg.category === 'weekly' ||
                              pkgName.includes('pass') ||
                              pkgName.includes('card') ||
                              pkgName.includes('membership') ||
                              pkgName.includes('weekly') ||
                              pkgCode.includes('weekly') ||
                              pkgId.includes('weekly');

                            // Connect directly with admin custom icon for this exact event pass or diamond
                            const packageIcon = getPackageCustomIcon(game?.id, pkg.code || pkg.id, pkg.img);

                            return (
                              <div
                                key={pkg.id}
                                onClick={() => setSelectedPackage(pkg)}
                                className={`package-item-card relative flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-transform duration-150 ${isSelected
                                    ? 'bg-[#1d0e37] border-2 border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.35)] scale-[1.01]'
                                    : 'bg-[#150a28] hover:bg-[#1a0d33] border border-purple-500/25 hover:border-purple-400/40 shadow-sm'
                                  }`}
                              >
                                {/* Left: Diamond / Pass Icon */}
                                <div className="w-10 h-10 sm:w-11 sm:h-11 flex-shrink-0 flex items-center justify-center p-0.5 bg-black/30 rounded-xl border border-purple-500/20">
                                  <img
                                    src={packageIcon}
                                    alt={pkg.name}
                                    className="w-full h-full object-contain"
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.src = pkg.img || (game?.id === 'free-fire' ? '/assets/diamonds/ff-diamond.png' : game?.id === 'roblox' ? '/assets/diamonds/robux-gold.svg' : '/assets/diamonds/mlbb-diamond.png');
                                    }}
                                  />
                                </div>

                                {/* Right: Title & Price */}
                                <div className="flex-1 min-w-0 pr-6">
                                  <div className="text-xs sm:text-sm font-bold text-gray-200 truncate" title={pkg.name}>
                                    {pkg.name}
                                  </div>
                                  <div className="text-sm sm:text-base font-extrabold text-[#00f0ff] font-['Poppins'] drop-shadow-[0_0_6px_rgba(0,240,255,0.35)] mt-0.5">
                                    {formatPrice(pkg.price)}
                                  </div>
                                </div>

                                {/* Optional Top Tag (like "100 💎" or "Full Ticket") */}
                                {pkg.topTag && (
                                  <div className="absolute top-2 right-2 text-[10px] font-bold text-pink-300 bg-pink-950/80 px-2 py-0.5 rounded-full border border-pink-500/40 shadow-sm">
                                    {pkg.topTag}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Step 3: Payment Method */}
          <div className="topup-card overflow-hidden">
            <div className="step-header">
              <i className="fas fa-building-columns text-lg"></i>
              <span>ជំហានទី ៣ : ទូទាត់ប្រាក់បានគ្រប់ធនាគារ (Payment Method)</span>
            </div>

            <div className="p-4 sm:p-5">
              <div className="p-3.5 rounded-2xl border-2 border-cyan-400 bg-cyan-950/30 flex items-center justify-between shadow-[0_0_15px_rgba(0,240,255,0.15)]">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white p-1.5 shadow-sm flex items-center justify-center border border-cyan-300">
                    <img
                      src="/assets/khqr.svg"
                      alt="KHQR Bakong"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-white flex items-center gap-1.5">
                      <span>Bakong KHQR (National Rail)</span>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-900/80 text-emerald-300 border border-emerald-500/40">
                        0% FEE
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">
                      Scan to pay with ABA, ACLEDA, Sathapana, Wing or any banking app
                    </div>
                  </div>
                </div>

                <div className="w-5 h-5 rounded-full border-2 border-[#00f0ff] flex items-center justify-center bg-[#00f0ff]">
                  <div className="w-2 h-2 rounded-full bg-[#0b0318]"></div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                <input type="checkbox" defaultChecked id="agree" className="rounded text-[#00f0ff] focus:ring-[#00f0ff] bg-purple-950 border-purple-500" />
                <label htmlFor="agree">
                  ខ្ញុំយល់ព្រមតាមលក្ខខណ្ឌប្រើប្រាស់ (Agree to Terms and Conditions)
                </label>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Sticky Bottom Checkout Bar (Desktop & Mobile) - Dark Neon */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#120626]/95 backdrop-blur-md border-t border-purple-500/30 shadow-[0_-4px_30px_rgba(0,0,0,0.8)] py-2.5 sm:py-3 px-3 sm:px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">

          <div className="flex flex-col min-w-0 pr-1 sm:pr-2">
            {verifiedName && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 mb-0.5 animate-fadeIn truncate">
                <span className="text-gray-300">🎮</span>
                <span className="text-[#00f0ff] font-extrabold truncate">{verifiedName}</span>
                <span className="text-emerald-400 font-bold text-[10px] bg-emerald-500/20 px-1 py-0.2 rounded border border-emerald-500/30 flex-shrink-0">✓</span>
              </div>
            )}
            <span className="text-[11px] sm:text-xs text-gray-400 font-medium truncate max-w-[150px] sm:max-w-none">
              កញ្ចប់: <strong className="text-white">{selectedPackage?.name || 'សូមជ្រើសរើស'}</strong>
            </span>
            <div className="text-sm sm:text-lg font-black text-[#00f0ff] drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]">
              សរុប : <span className="font-['Poppins']">{formatPrice(selectedPackage?.price || 0)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCheckout}
            disabled={isGeneratingQR || isOutOfStock}
            className="flex-shrink-0 px-5 sm:px-10 py-2.5 sm:py-3 rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-cyan-500 hover:brightness-110 active:scale-95 text-white font-extrabold text-xs sm:text-base shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all flex items-center gap-1.5 sm:gap-2 disabled:opacity-60 disabled:cursor-not-allowed border border-cyan-300/40 cursor-pointer"
          >
            {isOutOfStock ? (
              <>
                <span>🔒</span>
                <span>ដាច់ស្តុក (Out of Stock)</span>
              </>
            ) : isGeneratingQR ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>កំពុងដំណើរការ...</span>
              </>
            ) : (
              <>
                <span>បង់ ឥឡូវ (Buy Now)</span>
                <span>→</span>
              </>
            )}
          </button>

        </div>
      </div>

      {/* Bakong KHQR Modal with Live Sora Dispatch on Payment */}
      {paymentData && (
        <BakongQRModal
          paymentData={paymentData}
          playerInfo={{
            username: verifiedName || playerData?.username,
            userId,
            zoneId,
            gameName: game.name
          }}
          orderResult={orderResult}
          currency={currency}
          packageName={selectedPackage?.name}
          onClose={() => {
            setPaymentData(null);
            setOrderResult(null);
          }}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
