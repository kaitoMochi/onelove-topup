import React, { useState, useEffect } from 'react';
import { getSoraProfile, getSoraPackages, getSoraOrders } from '../services/sora';
import { getAdminSettings, saveAdminSettings, removeImageBackground, uploadAdminAsset, getCustomPrice, syncAdminSettingsWithServer } from '../services/adminSettings';
import { GAMES } from '../data/games';

export default function AdminPage({ onBack }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authStep, setAuthStep] = useState('pin'); // 'pin' or 'otp'
  const [pinInput, setPinInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpSentNotice, setOtpSentNotice] = useState('');
  const [authError, setAuthError] = useState('');
  
  // Settings & Active Game
  const [settings, setSettings] = useState(getAdminSettings());
  const [selectedGame, setSelectedGame] = useState('mobile-legends');

  // Upload loading states
  const [isUploadingDiamond, setIsUploadingDiamond] = useState(false);
  const [isUploadingWeekly, setIsUploadingWeekly] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  // Check existing session token on mount & sync remote settings
  useEffect(() => {
    syncAdminSettingsWithServer().then((s) => {
      if (s) {
        setSettings(s);
        const cfg = s.games?.[selectedGame] || {};
        if (cfg.coverImage) setCoverUrl(cfg.coverImage);
        if (cfg.diamondIcon) setDiamondUrl(cfg.diamondIcon);
        if (cfg.weeklyPassIcon) setWeeklyUrl(cfg.weeklyPassIcon);
      }
    });

    if (typeof window !== 'undefined' && sessionStorage.getItem('onelove_admin_token')) {
      setIsAuthenticated(true);
      loadSoraData(selectedGame);
    }
  }, []);
  
  // Live Sora Data
  const [profile, setProfile] = useState(null);
  const [soraPackages, setSoraPackages] = useState([]);
  const [soraOrders, setSoraOrders] = useState([]);
  const [isLoadingSora, setIsLoadingSora] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Auto cut background toggle
  const [autoCutBg, setAutoCutBg] = useState(true);

  // Form inputs for current selected game
  const currentGameConfig = settings.games?.[selectedGame] || {
    coverImage: '',
    diamondIcon: '',
    weeklyPassIcon: ''
  };

  const [coverUrl, setCoverUrl] = useState(currentGameConfig.coverImage || '');
  const [diamondUrl, setDiamondUrl] = useState(currentGameConfig.diamondIcon || '');
  const [weeklyUrl, setWeeklyUrl] = useState(currentGameConfig.weeklyPassIcon || '');

  // Package prices state: { [packageCode]: price }
  const [customPrices, setCustomPrices] = useState(settings.customPrices?.[selectedGame] || {});

  // Keep inputs in sync when changing selected game
  useEffect(() => {
    const cfg = settings.games?.[selectedGame] || {};
    setCoverUrl(cfg.coverImage || '');
    setDiamondUrl(cfg.diamondIcon || '');
    setWeeklyUrl(cfg.weeklyPassIcon || '');
    setCustomPrices(settings.customPrices?.[selectedGame] || {});
    loadSoraData(selectedGame);
  }, [selectedGame]);

  const loadSoraData = async (gameId) => {
    setIsLoadingSora(true);
    try {
      const prof = await getSoraProfile();
      if (prof.ok) setProfile(prof);

      if (gameId === 'mobile-legends') {
        const pkgs = await getSoraPackages('ml');
        if (pkgs.ok) setSoraPackages(pkgs.packages || []);
      } else if (gameId === 'free-fire') {
        const pkgs = await getSoraPackages('ff');
        if (pkgs.ok) setSoraPackages(pkgs.packages || []);
      } else if (gameId === 'roblox') {
        const rbx = await getSoraRobux();
        if (rbx.ok && rbx.items) {
          const mappedRbx = rbx.items.map(item => ({
            id: item.cardId,
            code: item.cardId,
            name: item.name,
            price: Number(item.priceUsd),
            section: 'diamonds',
            sectionTitle: 'Digital Robux Codes',
            category: 'diamonds',
            img: '/assets/diamonds/robux-gold.svg'
          }));
          setSoraPackages(mappedRbx);
        } else {
          setSoraPackages([]);
        }
      } else {
        setSoraPackages([]);
      }

      const ords = await getSoraOrders();
      if (ords.ok) setSoraOrders(ords.orders || []);
    } catch (e) {
      console.warn('Admin sora load err:', e);
    } finally {
      setIsLoadingSora(false);
    }
  };

  // Step 1: Request 2FA OTP via Telegram Bot
  const handleRequestOtp = async (e) => {
    if (e) e.preventDefault();
    if (!pinInput.trim()) {
      setAuthError('សូមបញ្ចូល Admin PIN (Please enter PIN)');
      return;
    }

    setIsRequestingOtp(true);
    setAuthError('');
    setOtpSentNotice('');

    try {
      const res = await fetch('/api/admin/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAuthStep('otp');
        setOtpSentNotice(data.message || 'លេខកូដ OTP បានផ្ញើទៅ Telegram រួចរាល់ហើយ!');
      } else {
        setAuthError(data.error || 'Admin PIN មិនត្រឹមត្រូវទេ! (Default: onelove2026)');
      }
    } catch (err) {
      setAuthError('Failed to request OTP: ' + err.message);
    } finally {
      setIsRequestingOtp(false);
    }
  };

  // Step 2: Verify 2FA OTP
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    if (!otpInput.trim()) {
      setAuthError('សូមបញ្ចូលលេខកូដ OTP 6 ខ្ទង់ (Please enter 6-digit OTP)');
      return;
    }

    setIsVerifyingOtp(true);
    setAuthError('');

    try {
      const res = await fetch('/api/admin/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput.trim(), otp: otpInput.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (typeof window !== 'undefined' && data.token) {
          sessionStorage.setItem('onelove_admin_token', data.token);
        }
        setIsAuthenticated(true);
        loadSoraData(selectedGame);
      } else {
        setAuthError(data.error || 'លេខកូដ OTP មិនត្រឹមត្រូវ ឬផុតកំណត់ហើយ!');
      }
    } catch (err) {
      setAuthError('Failed to verify OTP: ' + err.message);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Upload handler with automatic background removal & server storage
  const handleFileUpload = async (e, targetSetter, type, cutBackground = false, setLoadingState = null) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (setLoadingState) setLoadingState(true);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          let result = event.target.result;
          if (cutBackground && autoCutBg) {
            result = await removeImageBackground(result);
          }
          // Direct server upload to get static URL
          const uploadedUrl = await uploadAdminAsset(result, type);
          targetSetter(uploadedUrl);

          // Auto-save immediately so the image is active across entire store
          const current = getAdminSettings();
          const updated = {
            ...current,
            games: {
              ...current.games,
              [selectedGame]: {
                ...current.games[selectedGame],
                [type === 'weekly' ? 'weeklyPassIcon' : (type === 'diamond' ? 'diamondIcon' : 'coverImage')]: uploadedUrl
              }
            }
          };
          setSettings(updated);
          saveAdminSettings(updated);

          try {
            await fetch('/api/admin/settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pin: current.adminPin || 'onelove2026', settings: updated })
            });
          } catch (e) {
            console.warn('Sync upload error:', e);
          }

          setSaveSuccessMsg('✓ បាន Upload និងផ្លាស់ប្តូររូបភាពទៅកាន់ Store ជោគជ័យ 100%!');
          setTimeout(() => setSaveSuccessMsg(''), 4000);
        } catch (err) {
          console.error('File process error:', err);
        } finally {
          if (setLoadingState) setLoadingState(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      if (setLoadingState) setLoadingState(false);
    }
  };

  const handlePriceChange = (packageCode, newPrice) => {
    setCustomPrices(prev => ({
      ...prev,
      [packageCode]: newPrice
    }));
  };

  const handleSaveAll = async () => {
    const updated = {
      ...settings,
      games: {
        ...settings.games,
        [selectedGame]: {
          ...settings.games[selectedGame],
          coverImage: coverUrl.trim(),
          diamondIcon: diamondUrl.trim(),
          ...(selectedGame !== 'roblox' ? { weeklyPassIcon: weeklyUrl.trim() } : {})
        }
      },
      customPrices: {
        ...settings.customPrices,
        [selectedGame]: {
          ...(settings.customPrices?.[selectedGame] || {}),
          ...customPrices
        }
      }
    };

    setSettings(updated);
    saveAdminSettings(updated);

    // Save to server backend
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: settings.adminPin || pinInput || 'onelove2026', settings: updated })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSaveSuccessMsg('✓ បានរក្សាទុកការកំណត់ និងរូបភាពថ្មីទៅកាន់ User Interface ជោគជ័យ 100%!');
      } else {
        setSaveSuccessMsg('⚠️ ' + (data.error || 'បរាជ័យក្នុងការរក្សាទុកទៅ Server'));
      }
    } catch (e) {
      setSaveSuccessMsg('✓ រក្សាទុកជោគជ័យ!');
    }

    setTimeout(() => setSaveSuccessMsg(''), 4500);
  };

  const handleResetDefaults = () => {
    if (!window.confirm('តើអ្នកពិតជាចង់កំណត់រូបភាព និងតម្លៃដើមឡើងវិញមែនទេ?')) return;
    
    let defaultCover = '/games/mobile-legends-cover.jpg';
    let defaultDiamond = '/assets/diamonds/mlbb-diamond.png';
    let defaultWeekly = '/assets/diamonds/mlbb-weekly-pass.svg';

    if (selectedGame === 'free-fire') {
      defaultCover = '/games/free-fire-cover.jpg';
      defaultDiamond = '/assets/diamonds/ff-diamond.png';
      defaultWeekly = '/assets/diamonds/ff-weekly-card.svg';
    } else if (selectedGame === 'roblox') {
      defaultCover = '/games/roblox-cover.jpg';
      defaultDiamond = '/assets/diamonds/robux-gold.svg';
      defaultWeekly = '';
    }

    setCoverUrl(defaultCover);
    setDiamondUrl(defaultDiamond);
    setWeeklyUrl(defaultWeekly);
    setCustomPrices({});
  };

  // Get current game's static and live packages for price editor
  const currentGameObj = GAMES.find(g => g.id === selectedGame) || GAMES[0];
  const allGamePackages = (soraPackages && soraPackages.length > 0)
    ? soraPackages.map(sp => {
        const staticMatch = currentGameObj.packages?.find(p => String(p.code) === String(sp.code || sp.id));
        return {
          id: sp.code || sp.id,
          code: sp.code || sp.id,
          name: staticMatch?.name || sp.name,
          section: staticMatch?.section || (String(sp.code).toLowerCase().includes('weekly') ? 'weekly' : 'diamonds'),
          sectionTitle: staticMatch?.sectionTitle || (String(sp.code).toLowerCase().includes('weekly') ? 'Weekly Pass' : 'Diamonds'),
          price: sp.price !== undefined ? sp.price : (staticMatch?.price || 0),
          img: staticMatch?.img || (selectedGame === 'roblox' ? '/assets/diamonds/robux-gold.svg' : (selectedGame === 'free-fire' ? '/assets/diamonds/ff-diamond.png' : '/assets/diamonds/mlbb-diamond.png'))
        };
      })
    : (currentGameObj.packages || []);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#0b0318] text-white">
        <div className="w-full max-w-md bg-[#160a2b] p-7 sm:p-8 rounded-3xl border border-purple-500/40 shadow-[0_0_50px_rgba(124,58,237,0.3)]">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-purple-600 to-cyan-400 p-0.5 mb-3 shadow-[0_0_20px_rgba(0,240,255,0.4)]">
              <div className="w-full h-full bg-[#110521] rounded-2xl flex items-center justify-center text-2xl text-cyan-300">
                {authStep === 'pin' ? '🔐' : '📱'}
              </div>
            </div>
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-cyan-200 to-white">
              ONE LOVE ADMIN
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              {authStep === 'pin' ? 'ផ្ទាំងគ្រប់គ្រងរដ្ឋបាល & ស្តុក API' : 'ផ្ទៀងផ្ទាត់ 2FA OTP តាម Telegram'}
            </p>
          </div>

          {authStep === 'pin' ? (
            /* STEP 1: ENTER PIN TO TRIGGER TELEGRAM OTP */
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-wider">
                  ជំហានទី ១ : បញ្ចូល Admin PIN
                </label>
                <input 
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Enter Admin PIN..."
                  autoFocus
                  className="w-full px-4 py-3 bg-[#0b0318] border border-purple-500/50 rounded-xl text-center text-lg tracking-widest font-mono text-cyan-300 focus:outline-none focus:border-cyan-400"
                />
              </div>

              {authError && (
                <div className="p-2.5 rounded-lg bg-red-950/80 border border-red-500/50 text-red-300 text-xs text-center font-medium">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={isRequestingOtp}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-cyan-500 font-bold text-white shadow-[0_0_20px_rgba(0,240,255,0.4)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isRequestingOtp ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>កំពុងផ្ញើកូដ OTP ទៅ Telegram...</span>
                  </>
                ) : (
                  <>
                    <span>ផ្ញើកូដ OTP តាម Telegram (2FA)</span>
                    <span>→</span>
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={onBack}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  ← ត្រឡប់ទៅហាងទំនិញវិញ (Back to Store)
                </button>
              </div>
            </form>
          ) : (
            /* STEP 2: ENTER 6-DIGIT TELEGRAM OTP */
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {/* Telegram Notice Banner */}
              <div className="p-3.5 rounded-2xl bg-cyan-950/70 border border-cyan-400/40 text-cyan-200 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-cyan-300">
                  <i className="fab fa-telegram text-base text-[#0088cc]"></i>
                  <span>លេខកូដ OTP ត្រូវបានផ្ញើរួចរាល់!</span>
                </div>
                <p className="text-[11px] text-gray-300 leading-relaxed">
                  បានផ្ញើទៅ Admin 1 (6389405398), Admin 2 (7283817695) និង Alert Group (-5416787286) ។<br />
                  <strong className="text-white">👉 ចុចលើលេខកូដក្នុង Telegram ដើម្បី Copy ដោយ 1-tap រួច Paste ចូលខាងក្រោម!</strong>
                </p>
                <div className="pt-1">
                  <a
                    href="https://t.me/onelovetopup_bot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-400/40 text-[11px] font-bold"
                  >
                    <span>💬 បើក @onelovetopup_bot លើ Telegram</span>
                  </a>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-wider text-center">
                  ជំហានទី ២ : បញ្ចូលលេខកូដ OTP (6 ខ្ទង់)
                </label>
                <input 
                  type="text"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="------"
                  autoFocus
                  className="w-full px-4 py-3 bg-[#0b0318] border-2 border-cyan-400/60 rounded-xl text-center text-3xl tracking-[0.5em] font-mono text-cyan-300 focus:outline-none focus:border-[#00f0ff] shadow-[0_0_20px_rgba(0,240,255,0.2)]"
                />
              </div>

              {authError && (
                <div className="p-2.5 rounded-lg bg-red-950/80 border border-red-500/50 text-red-300 text-xs text-center font-medium">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={isVerifyingOtp}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-500 font-bold text-white shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isVerifyingOtp ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>កំពុងផ្ទៀងផ្ទាត់កូដ OTP...</span>
                  </>
                ) : (
                  <>
                    <span>ផ្ទៀងផ្ទាត់ & ចូលគ្រប់គ្រង (Verify & Login)</span>
                    <span>✓</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-xs pt-1 px-1">
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={isRequestingOtp}
                  className="text-cyan-400 hover:text-cyan-300 transition-colors underline"
                >
                  {isRequestingOtp ? 'កំពុងផ្ញើ...' : '🔄 ផ្ញើកូដ OTP ម្តងទៀត'}
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthStep('pin'); setAuthError(''); setOtpInput(''); }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ← ប្តូរ PIN ផ្សេង
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0318] text-white p-3 sm:p-6 pb-20">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#160a2b] border border-purple-500/30 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="px-3.5 py-1.5 rounded-xl bg-black/40 hover:bg-black/70 border border-purple-500/30 text-xs font-semibold text-gray-300 hover:text-white transition-colors flex items-center gap-1.5"
            >
              ← ទៅកាន់ហាង (View Store)
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-cyan-300">
                ONE LOVE ADMIN CONTROL
              </h1>
              <p className="text-[11px] text-gray-400">គ្រប់គ្រងរូបភាព Logo, តម្លៃពេជ្រ និងស្តុក API</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Sora Balance Card */}
            <div className="px-3.5 py-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-right">
              <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                Sora Reseller Balance
              </div>
              <div className="text-lg font-black text-emerald-300 font-mono">
                ${Number(profile?.balance ?? 0).toFixed(2)} USD
              </div>
            </div>

            <button
              onClick={() => loadSoraData(selectedGame)}
              disabled={isLoadingSora}
              className="px-3 py-2 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 text-xs font-bold transition-all"
              title="Refresh Live Sora Data"
            >
              {isLoadingSora ? '...' : '🔄 Refresh'}
            </button>
          </div>
        </div>

        {/* Success Toast */}
        {saveSuccessMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-900/90 border border-emerald-400 text-emerald-200 text-sm font-bold text-center shadow-[0_0_20px_rgba(16,185,129,0.4)] animate-bounce">
            {saveSuccessMsg}
          </div>
        )}

        {/* 3-ROW RESPONSIVE GAME SELECTOR (FIXES LOST ROBLOX ON MOBILE!) */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
            ជ្រើសរើសហ្គេមដែលត្រូវគ្រប់គ្រង (Select Game) :
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 p-2 rounded-2xl bg-[#130724] border border-purple-500/30">
            {[
              { id: 'mobile-legends', name: 'Mobile Legends (MLBB)', icon: '⚔️' },
              { id: 'free-fire', name: 'Free Fire Mobile', icon: '🔥' },
              { id: 'roblox', name: 'Roblox (Robux)', icon: '🧱' }
            ].map(g => (
              <button
                key={g.id}
                onClick={() => setSelectedGame(g.id)}
                className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
                  selectedGame === g.id
                    ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-[0_0_20px_rgba(0,240,255,0.4)] border border-cyan-300/40'
                    : 'bg-[#180a2f] text-gray-300 hover:text-white hover:bg-white/5 border border-purple-500/20'
                }`}
              >
                <span className="text-lg">{g.icon}</span>
                <span>{g.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Auto Background Removal Toggle */}
        <div className="p-3.5 rounded-xl bg-[#140828] border border-cyan-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">✂️</span>
            <div>
              <div className="text-xs font-bold text-cyan-300">
                កាត់ Background ស្វ័យប្រវត្តិ (Auto-Cut Background for Logo)
              </div>
              <div className="text-[11px] text-gray-400">
                ពេល Upload រូបពីទូរស័ព្ទ ឬកុំព្យូទ័រ ប្រព័ន្ធនឹងកាត់ Background ពណ៌ស ឬខ្មៅចេញឱ្យ Transparent ដោយស្វ័យប្រវត្តិ
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAutoCutBg(!autoCutBg)}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              autoCutBg
                ? 'bg-emerald-600 text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                : 'bg-gray-800 text-gray-400'
            }`}
          >
            {autoCutBg ? '✓ ON (បើក)' : '✕ OFF (បិទ)'}
          </button>
        </div>

        {/* Main Grid: Left = Logo Customizer, Right = Price Updater */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT: Custom Logo & Asset Manager (6 Cols) */}
          <div className="lg:col-span-6 space-y-5">
            <div className="p-5 rounded-2xl bg-[#160a2b] border border-purple-500/30 shadow-lg space-y-5">
              <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
                <div className="font-extrabold text-base text-cyan-300 flex items-center gap-2">
                  <span>🎨</span>
                  <span>រូបតំណាងហ្គេម ({selectedGame.toUpperCase()})</span>
                </div>
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="text-xs text-rose-400 hover:text-rose-300 underline font-semibold"
                >
                  Reset Defaults
                </button>
              </div>

              {/* 1. SINGLE DIAMOND / ROBUX LOGO UPLOAD CARD */}
              <div className="p-4 rounded-xl bg-[#0e041d] border border-cyan-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                      <span>{selectedGame === 'roblox' ? '🧱' : '💎'}</span>
                      <span>
                        {selectedGame === 'roblox' ? 'រូបតំណាង ROBUX LOGO' : 'រូបតំណាងពេជ្រ (DIAMOND ICON)'}
                      </span>
                    </label>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Upload រូប 1 សន្លឹក វានឹងបង្ហាញលើ **គ្រប់កញ្ចប់ទាំងអស់** នៃ {currentGameObj.name}!
                    </p>
                  </div>
                  {/* Live Preview */}
                  <div className="w-14 h-14 rounded-xl bg-black/60 border border-cyan-400/50 flex items-center justify-center p-1.5 shadow-[0_0_12px_rgba(0,240,255,0.3)]">
                    <img 
                      src={diamondUrl || (selectedGame === 'roblox' ? '/assets/diamonds/robux-gold.svg' : '/assets/diamonds/mlbb-diamond.png')} 
                      alt="Diamond Preview" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>

                {/* Big direct upload button for Phone / PC without typing URL */}
                <label className={`w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-700 via-fuchsia-600 to-cyan-600 hover:brightness-110 active:scale-[0.99] text-white text-xs font-bold cursor-pointer flex items-center justify-center gap-2 shadow-md transition-all ${isUploadingDiamond ? 'opacity-70 pointer-events-none' : ''}`}>
                  <span>{isUploadingDiamond ? '⏳' : '📷'}</span>
                  <span>{isUploadingDiamond ? 'កំពុងដំណើរការ Upload ពេជ្រ...' : 'ជ្រើសរើសរូបពីទូរស័ព្ទ / កុំព្យូទ័រ (Upload Photo)'}</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onClick={(e) => { e.target.value = null; }}
                    onChange={(e) => handleFileUpload(e, setDiamondUrl, 'diamond', true, setIsUploadingDiamond)}
                  />
                </label>
              </div>

              {/* 2. WEEKLY PASS & MEMBERSHIP LOGO (FOR MOBILE LEGENDS & FREE FIRE) */}
              {selectedGame !== 'roblox' && (
                <div className="p-4 rounded-xl bg-[#0e041d] border border-purple-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-black text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                        <span>🎟️</span>
                        <span>
                          {selectedGame === 'free-fire' 
                            ? 'រូបតំណាង WEEKLY & MEMBERSHIP CARD' 
                            : 'រូបតំណាង WEEKLY PASS & សមាជិកភាព'}
                        </span>
                      </label>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {selectedGame === 'free-fire'
                          ? 'បង្ហាញលើកញ្ចប់ Weekly Card, Monthly Card, Weekly Lite'
                          : 'បង្ហាញលើកញ្ចប់ Weekly Diamond Pass, Elite, Twilight Pass'}
                      </p>
                    </div>
                    {/* Live Preview */}
                    <div className="w-14 h-14 rounded-xl bg-black/60 border border-purple-400/50 flex items-center justify-center p-1.5 shadow-[0_0_12px_rgba(168,85,247,0.3)]">
                      <img 
                        key={weeklyUrl}
                        src={weeklyUrl && !weeklyUrl.includes('pass-card.png') 
                          ? weeklyUrl 
                          : (selectedGame === 'free-fire' ? '/assets/diamonds/ff-weekly-card.svg' : '/assets/diamonds/mlbb-weekly-pass.svg')} 
                        alt="Pass Preview" 
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = selectedGame === 'free-fire' ? '/assets/diamonds/ff-weekly-card.svg' : '/assets/diamonds/mlbb-weekly-pass.svg';
                        }}
                      />
                    </div>
                  </div>

                  <label className={`w-full py-3 px-4 rounded-xl bg-purple-900/60 hover:bg-purple-800/80 border border-purple-400/40 text-purple-200 text-xs font-bold cursor-pointer flex items-center justify-center gap-2 shadow-md transition-all ${isUploadingWeekly ? 'opacity-70 pointer-events-none' : ''}`}>
                    <span>{isUploadingWeekly ? '⏳' : '📷'}</span>
                    <span>{isUploadingWeekly ? 'កំពុងដំណើរការ Upload...' : (selectedGame === 'free-fire' ? 'Upload រូប Membership Card ពីទូរស័ព្ទ / PC' : 'Upload រូប Weekly Pass ពីទូរស័ព្ទ / PC')}</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onClick={(e) => { e.target.value = null; }}
                      onChange={(e) => handleFileUpload(e, setWeeklyUrl, 'weekly', false, setIsUploadingWeekly)}
                    />
                  </label>
                </div>
              )}

              {/* 3. GAME COVER BANNER UPLOAD */}
              <div className="p-4 rounded-xl bg-[#0e041d] border border-purple-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <span>🖼️</span>
                      <span>ផ្ទាំង GAME COVER BANNER</span>
                    </label>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      ផ្ទាំងរូបភាពធំលើ Homepage និង Game Page
                    </p>
                  </div>
                  <div className="w-16 h-10 rounded-lg overflow-hidden bg-black/60 border border-amber-400/50 flex items-center justify-center">
                    <img 
                      key={coverUrl}
                      src={coverUrl || currentGameObj.image} 
                      alt="Cover Preview" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                <label className={`w-full py-3 px-4 rounded-xl bg-amber-950/60 hover:bg-amber-900/60 border border-amber-400/40 text-amber-200 text-xs font-bold cursor-pointer flex items-center justify-center gap-2 shadow-md transition-all ${isUploadingCover ? 'opacity-70 pointer-events-none' : ''}`}>
                  <span>{isUploadingCover ? '⏳' : '📷'}</span>
                  <span>{isUploadingCover ? 'កំពុងដំណើរការ Upload Cover...' : 'Upload រូប Cover ពីទូរស័ព្ទ / PC'}</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onClick={(e) => { e.target.value = null; }}
                    onChange={(e) => handleFileUpload(e, setCoverUrl, 'cover', false, setIsUploadingCover)}
                  />
                </label>
              </div>

            </div>
          </div>

          {/* RIGHT: Price & Package Editor (6 Cols) */}
          <div className="lg:col-span-6 space-y-5">
            <div className="p-5 rounded-2xl bg-[#160a2b] border border-purple-500/30 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
                <div className="font-extrabold text-sm text-cyan-300 flex items-center gap-2">
                  <span>💰</span>
                  <span>កែប្រែតម្លៃលក់ ({selectedGame.toUpperCase()})</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-bold">
                  {allGamePackages.length} Packages
                </span>
              </div>

              <p className="text-xs text-gray-300">
                លោកអ្នកអាចវាយបញ្ចូលតម្លៃលក់ថ្មីជាប្រាក់ដុល្លារ ($) តាមចិត្ត។ តម្លៃនេះនឹងបង្ហាញលើ User Interface និងគិតប្រាក់ Bakong KHQR ដោយស្វ័យប្រវត្តិ!
              </p>

              {/* Package list table */}
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {allGamePackages.map(pkg => {
                  const currentPrice = customPrices[pkg.code || pkg.id] !== undefined 
                    ? customPrices[pkg.code || pkg.id] 
                    : getCustomPrice(selectedGame, pkg.code || pkg.id, pkg.price);

                  const isPkgWeekly = pkg.section === 'weekly' ||
                    pkg.section === 'subscriptions' ||
                    pkg.category === 'weekly' ||
                    pkg.category === 'subscriptions' ||
                    pkg.name.toLowerCase().includes('pass') ||
                    pkg.name.toLowerCase().includes('weekly') ||
                    String(pkg.code).toLowerCase().includes('weekly');

                  const displayPackageIcon = isPkgWeekly
                    ? (weeklyUrl && !weeklyUrl.includes('pass-card.png') 
                        ? weeklyUrl 
                        : (pkg.img || (selectedGame === 'free-fire' ? '/assets/diamonds/ff-weekly-card.svg' : '/assets/diamonds/mlbb-weekly-pass.svg')))
                    : (diamondUrl || pkg.img || (selectedGame === 'roblox' ? '/assets/diamonds/robux-gold.svg' : (selectedGame === 'free-fire' ? '/assets/diamonds/ff-diamond.png' : '/assets/diamonds/mlbb-diamond.png')));

                  return (
                    <div 
                      key={pkg.id} 
                      className="p-3 rounded-xl bg-[#0e041d] border border-purple-500/20 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-black/40 p-1 flex-shrink-0 flex items-center justify-center border border-purple-500/20">
                          <img 
                            key={displayPackageIcon}
                            src={displayPackageIcon} 
                            alt={pkg.name} 
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = isPkgWeekly ? '/assets/diamonds/mlbb-weekly-pass.svg' : '/assets/diamonds/mlbb-diamond.png';
                            }}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-gray-200 truncate">{pkg.name}</div>
                          <div className="text-[10px] text-gray-400 font-mono">Code: {pkg.code || pkg.id}</div>
                        </div>
                      </div>

                      {/* Price Input Box */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-xs font-bold text-cyan-300 font-mono">$</span>
                        <input 
                          type="number"
                          step="0.01"
                          min="0.10"
                          value={currentPrice}
                          onChange={(e) => handlePriceChange(pkg.code || pkg.id, e.target.value)}
                          className="w-24 px-2.5 py-1.5 bg-[#170930] border border-cyan-400/40 rounded-lg text-sm text-cyan-300 font-mono font-extrabold text-right focus:outline-none focus:border-cyan-300"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* SAVE ALL BUTTON */}
              <button
                type="button"
                onClick={handleSaveAll}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-cyan-500 font-extrabold text-white text-sm shadow-[0_0_25px_rgba(0,240,255,0.4)] hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
              >
                <span>💾</span>
                <span>រក្សាទុកតម្លៃ & រូបភាពថ្មីទាំងអស់ (Save All Changes)</span>
              </button>
            </div>
          </div>

        </div>

        {/* Live Orders Feed from Sora */}
        <div className="p-5 rounded-2xl bg-[#160a2b] border border-purple-500/30 shadow-lg space-y-3">
          <div className="font-extrabold text-sm text-cyan-300 flex items-center justify-between border-b border-purple-500/20 pb-2">
            <span>📋 ការបញ្ជាទិញជាក់ស្តែងចុងក្រោយ (Live Dispatched Orders Feed)</span>
            <span className="text-[10px] text-gray-400 font-mono">Sora Reseller API</span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {soraOrders.length > 0 ? (
              soraOrders.slice(0, 8).map(ord => (
                <div key={ord.refid} className="p-2.5 rounded-xl bg-[#0e041d] border border-purple-500/20 text-xs flex items-center justify-between">
                  <div>
                    <div className="font-bold text-gray-200 flex items-center gap-1.5">
                      <span>{ord.item}</span>
                      <span className="text-[10px] text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded font-bold">
                        {ord.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                      {ord.player} • {ord.nickname || 'Player'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-cyan-300 font-mono">${Number(ord.amount).toFixed(2)}</div>
                    <div className="text-[9px] text-gray-500 font-mono">{ord.refid}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-xs text-gray-500">
                មិនទាន់មាន Order ថ្មីទេ
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
