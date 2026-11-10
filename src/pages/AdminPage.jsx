import React, { useState, useEffect } from 'react';
import { getSoraProfile, getSoraPackages, getSoraOrders, getSoraRobux } from '../services/sora';
import { getAdminSettings, saveAdminSettings, removeImageBackground, uploadAdminAsset, getCustomPrice, syncAdminSettingsWithServer, hashAdminSecret, createSecureEnvelope, getPackageCustomIcon } from '../services/adminSettings';
import { GAMES, formatFullPackageName } from '../data/games';

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

  // Upload loading state by field key
  const [uploadingField, setUploadingField] = useState('');

  // Check existing session token on mount & sync remote settings
  useEffect(() => {
    syncAdminSettingsWithServer().then((s) => {
      if (s) {
        setSettings(s);
        const cfg = s.games?.[selectedGame] || {};
        setCoverUrl(cfg.coverImage || '');
        setDiamondUrl(cfg.diamondIcon || '');
        setWeeklyUrl(cfg.weeklyPassIcon || '');
        setWeeklyEliteUrl(cfg.weeklyEliteIcon || '');
        setMonthlyEpicUrl(cfg.monthlyEpicIcon || '');
        setTwilightUrl(cfg.twilightIcon || '');
        setFfWeeklyLiteUrl(cfg.weeklyLiteIcon || '');
        setFfMonthlyUrl(cfg.monthlyCardIcon || '');
        setFfLevelUpUrl(cfg.levelUpIcon || '');
        setFfComboUrl(cfg.comboIcon || '');
      }
    });

    const savedToken = typeof window !== 'undefined'
      ? (sessionStorage.getItem('onelove_admin_token') || localStorage.getItem('onelove_admin_token'))
      : null;
    if (savedToken) {
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

  // Live MySQL Database & Store Orders Data
  const [dbStatus, setDbStatus] = useState(null);
  const [mysqlOrders, setMysqlOrders] = useState([]);
  const [activeOrdersTab, setActiveOrdersTab] = useState('mysql'); // 'mysql' | 'sora'

  // Auto cut background toggle
  const [autoCutBg, setAutoCutBg] = useState(true);

  // Form inputs for current selected game
  const currentGameConfig = settings.games?.[selectedGame] || {};

  const [coverUrl, setCoverUrl] = useState(currentGameConfig.coverImage || '');
  const [diamondUrl, setDiamondUrl] = useState(currentGameConfig.diamondIcon || '');

  // MLBB specific event pass icons
  const [weeklyUrl, setWeeklyUrl] = useState(currentGameConfig.weeklyPassIcon || '');
  const [weeklyEliteUrl, setWeeklyEliteUrl] = useState(currentGameConfig.weeklyEliteIcon || '');
  const [monthlyEpicUrl, setMonthlyEpicUrl] = useState(currentGameConfig.monthlyEpicIcon || '');
  const [twilightUrl, setTwilightUrl] = useState(currentGameConfig.twilightIcon || '');

  // Free Fire specific event pass icons
  const [ffWeeklyLiteUrl, setFfWeeklyLiteUrl] = useState(currentGameConfig.weeklyLiteIcon || '');
  const [ffMonthlyUrl, setFfMonthlyUrl] = useState(currentGameConfig.monthlyCardIcon || '');
  const [ffLevelUpUrl, setFfLevelUpUrl] = useState(currentGameConfig.levelUpIcon || '');
  const [ffComboUrl, setFfComboUrl] = useState(currentGameConfig.comboIcon || '');

  // Package prices state: { [packageCode]: price }
  const [customPrices, setCustomPrices] = useState(settings.customPrices?.[selectedGame] || {});

  // Keep inputs in sync when changing selected game
  useEffect(() => {
    const cfg = settings.games?.[selectedGame] || {};
    setCoverUrl(cfg.coverImage || '');
    setDiamondUrl(cfg.diamondIcon || '');
    setWeeklyUrl(cfg.weeklyPassIcon || '');
    setWeeklyEliteUrl(cfg.weeklyEliteIcon || '');
    setMonthlyEpicUrl(cfg.monthlyEpicIcon || '');
    setTwilightUrl(cfg.twilightIcon || '');
    setFfWeeklyLiteUrl(cfg.weeklyLiteIcon || '');
    setFfMonthlyUrl(cfg.monthlyCardIcon || '');
    setFfLevelUpUrl(cfg.levelUpIcon || '');
    setFfComboUrl(cfg.comboIcon || '');
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
        if (rbx.ok && rbx.items) {
          const mappedRbx = rbx.items
            .filter(item => ALLOWED_ROBUX_CODES.includes(item.cardId || item.code || item.id))
            .map(item => ({
              id: item.cardId,
              code: item.cardId,
              name: formatFullPackageName('roblox', item.cardId, item.name),
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

      // Fetch Live MySQL DB status and Store Orders
      try {
        const dbRes = await fetch('/api/admin/db-status');
        const dbData = await dbRes.json();
        if (dbData.success) setDbStatus(dbData.db);

        const token = typeof window !== 'undefined' ? (sessionStorage.getItem('onelove_admin_token') || '') : '';
        if (token) {
          const ordRes = await fetch('/api/admin/orders?limit=30', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const ordData = await ordRes.json();
          if (ordData.success) setMysqlOrders(ordData.orders || []);
        }
      } catch (_) {}
    } catch (e) {
      console.warn('Admin sora load err:', e);
    } finally {
      setIsLoadingSora(false);
    }
  };

  // Step 1: Request 2FA OTP via Telegram Bot (using Anti-Replay Single-Use Nonce & Masked Cipher)
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
      const envelope = await createSecureEnvelope(pinInput.trim());
      const res = await fetch('/api/admin/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envelope)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAuthStep('otp');
        setOtpSentNotice(data.message || 'លេខកូដ OTP បានផ្ញើទៅ Telegram រួចរាល់ហើយ!');
      } else {
        setAuthError(data.error || 'Admin PIN មិនត្រឹមត្រូវទេ!');
      }
    } catch (err) {
      setAuthError('Failed to request OTP: ' + err.message);
    } finally {
      setIsRequestingOtp(false);
    }
  };

  // Step 2: Verify 2FA OTP (uses single-use ephemeral proof + 6-digit OTP, zero plaintext)
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    if (!otpInput.trim()) {
      setAuthError('សូមបញ្ចូលលេខកូដ OTP 6 ខ្ទង់ (Please enter 6-digit OTP)');
      return;
    }

    setIsVerifyingOtp(true);
    setAuthError('');

    try {
      const envelope = await createSecureEnvelope(pinInput.trim(), { otp: otpInput.trim() });
      const res = await fetch('/api/admin/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envelope)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (typeof window !== 'undefined' && data.token) {
          sessionStorage.setItem('onelove_admin_token', data.token);
          localStorage.setItem('onelove_admin_token', data.token);
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

  // Upload handler with automatic background removal & server storage for ANY specific event pass
  const handleFileUpload = async (e, targetSetter, fieldKey, cutBackground = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingField(fieldKey);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          let result = event.target.result;
          if (cutBackground && autoCutBg) {
            result = await removeImageBackground(result);
          }
          // Direct server upload to get static URL
          const uploadedUrl = await uploadAdminAsset(result, fieldKey);
          targetSetter(uploadedUrl);

          const fieldPropMap = {
            cover: 'coverImage',
            diamond: 'diamondIcon',
            weekly: 'weeklyPassIcon',
            weeklyElite: 'weeklyEliteIcon',
            monthlyEpic: 'monthlyEpicIcon',
            twilight: 'twilightIcon',
            weeklyLite: 'weeklyLiteIcon',
            monthlyCard: 'monthlyCardIcon',
            levelUp: 'levelUpIcon',
            combo: 'comboIcon'
          };
          const propName = fieldPropMap[fieldKey] || fieldKey;

          // Auto-save immediately so the image is active across entire store
          const current = getAdminSettings();
          const updated = {
            ...current,
            games: {
              ...current.games,
              [selectedGame]: {
                ...current.games[selectedGame],
                [propName]: uploadedUrl
              }
            }
          };
          setSettings(updated);
          saveAdminSettings(updated);

          try {
            const token = typeof window !== 'undefined' ? (sessionStorage.getItem('onelove_admin_token') || '') : '';
            const authHash = pinInput.trim() ? await hashAdminSecret(pinInput.trim()) : '';
            const syncRes = await fetch('/api/admin/settings', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
              },
              body: JSON.stringify({ token, authHash, settings: updated })
            });
            const syncData = await syncRes.json().catch(() => null);
            if (syncRes.ok && syncData?.success) {
              setSaveSuccessMsg('✓ បាន Upload និងផ្លាស់ប្តូររូបភាពទៅកាន់ Store ជោគជ័យ 100%!');
            } else if (syncRes.status === 401) {
              setSaveSuccessMsg('⚠️ Session ផុតកំណត់ សូម Login ឡើងវិញដើម្បីរក្សាទុក');
              setIsAuthenticated(false);
            }
          } catch (e) {
            console.warn('Sync upload error:', e);
          }
        } catch (err) {
          console.error('File process error:', err);
        } finally {
          setUploadingField('');
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setUploadingField('');
    }
  };

  const handlePriceChange = (packageCode, newPrice) => {
    setCustomPrices(prev => ({
      ...prev,
      [packageCode]: newPrice
    }));
  };

  const handleSaveAll = async () => {
    const existingGame = settings.games?.[selectedGame] || {};
    const updated = {
      ...settings,
      games: {
        ...settings.games,
        [selectedGame]: {
          ...existingGame,
          coverImage: coverUrl.trim() || existingGame.coverImage || '',
          diamondIcon: diamondUrl.trim() || existingGame.diamondIcon || '',
          weeklyPassIcon: weeklyUrl.trim() || existingGame.weeklyPassIcon || '',
          ...(selectedGame === 'mobile-legends' ? {
            weeklyEliteIcon: weeklyEliteUrl.trim() || existingGame.weeklyEliteIcon || '',
            monthlyEpicIcon: monthlyEpicUrl.trim() || existingGame.monthlyEpicIcon || '',
            twilightIcon: twilightUrl.trim() || existingGame.twilightIcon || ''
          } : {}),
          ...(selectedGame === 'free-fire' ? {
            weeklyLiteIcon: ffWeeklyLiteUrl.trim() || existingGame.weeklyLiteIcon || '',
            monthlyCardIcon: ffMonthlyUrl.trim() || existingGame.monthlyCardIcon || '',
            levelUpIcon: ffLevelUpUrl.trim() || existingGame.levelUpIcon || '',
            comboIcon: ffComboUrl.trim() || existingGame.comboIcon || ''
          } : {})
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

    // Save to server backend using session token (no plaintext PIN)
    try {
      const token = typeof window !== 'undefined' ? (sessionStorage.getItem('onelove_admin_token') || '') : '';
      const authHash = pinInput.trim() ? await hashAdminSecret(pinInput.trim()) : '';
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ token, authHash, settings: updated })
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setSaveSuccessMsg('✓ បានរក្សាទុកការកំណត់ និងរូបភាពថ្មីទៅកាន់ User Interface ជោគជ័យ 100%!');
      } else if (res.status === 401) {
        setSaveSuccessMsg('⚠️ Session ផុតកំណត់ សូមបញ្ចូល PIN ឡើងវិញ (Session Expired)');
        setIsAuthenticated(false);
      } else {
        setSaveSuccessMsg('⚠️ ' + (data?.error || 'បរាជ័យក្នុងការរក្សាទុកទៅ Server'));
      }
    } catch (e) {
      setSaveSuccessMsg('✓ រក្សាទុកជោគជ័យ!');
    }

    setTimeout(() => setSaveSuccessMsg(''), 4500);
  };

  const stockClosed = !!(settings.games?.[selectedGame]?.stockClosed);

  const handleToggleStock = async () => {
    const newClosed = !stockClosed;
    const existingGame = settings.games?.[selectedGame] || {};
    const updated = {
      ...settings,
      games: {
        ...settings.games,
        [selectedGame]: { ...existingGame, stockClosed: newClosed }
      }
    };
    setSettings(updated);
    saveAdminSettings(updated);

    try {
      const token = typeof window !== 'undefined' ? (sessionStorage.getItem('onelove_admin_token') || '') : '';
      const authHash = pinInput.trim() ? await hashAdminSecret(pinInput.trim()) : '';
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ token, authHash, settings: updated })
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setSaveSuccessMsg(newClosed
          ? '🔒 បានបិទស្តុក — អតិថិជនឃើញ "Out of Stock" ហើយមិនអាចបង់ប្រាក់បានទេ'
          : '✅ បានបើកស្តុក — អតិថិជនអាចទិញបានធម្មតាវិញ');
      } else if (res.status === 401) {
        setSaveSuccessMsg('⚠️ Session ផុតកំណត់ សូមបញ្ចូល PIN ឡើងវិញ (Session Expired)');
        setIsAuthenticated(false);
      } else {
        setSaveSuccessMsg('⚠️ ' + (data?.error || 'បរាជ័យក្នុងការរក្សាទុក'));
      }
    } catch (e) {
      setSaveSuccessMsg('✓ រក្សាទុក!');
    }

    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  const handleResetDefaults = () => {
    if (!window.confirm('តើអ្នកពិតជាចង់កំណត់រូបភាព និងតម្លៃដើមឡើងវិញមែនទេ?')) return;
    
    if (selectedGame === 'mobile-legends') {
      setCoverUrl('/games/mobile-legends-cover.jpg');
      setDiamondUrl('/assets/diamonds/mlbb-diamond.png');
      setWeeklyUrl('/assets/diamonds/mlbb-weekly-pass.svg');
      setWeeklyEliteUrl('/assets/diamonds/elite-pass.svg');
      setMonthlyEpicUrl('/assets/diamonds/epic-pass.svg');
      setTwilightUrl('/assets/diamonds/twilight-pass.svg');
    } else if (selectedGame === 'free-fire') {
      setCoverUrl('/games/free-fire-cover.jpg');
      setDiamondUrl('/assets/diamonds/ff-diamond.png');
      setWeeklyUrl('/assets/diamonds/ff-weekly-card.svg');
      setFfWeeklyLiteUrl('/assets/diamonds/ff-weekly-lite.svg');
      setFfMonthlyUrl('/assets/diamonds/ff-monthly-card.svg');
      setFfLevelUpUrl('/assets/diamonds/ff-levelup.svg');
      setFfComboUrl('/assets/diamonds/ff-combo.svg');
    } else if (selectedGame === 'roblox') {
      setCoverUrl('/games/roblox-cover.jpg');
      setDiamondUrl('/assets/diamonds/robux-gold.svg');
    }
    setCustomPrices({});
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('onelove_admin_token');
      localStorage.removeItem('onelove_admin_token');
    }
    setIsAuthenticated(false);
    setAuthStep('pin');
    setPinInput('');
    setOtpInput('');
  };

  // Get current game's static and live packages for price editor
  const currentGameObj = GAMES.find(g => g.id === selectedGame) || GAMES[0];
  const allGamePackages = (soraPackages && soraPackages.length > 0)
    ? soraPackages.map(sp => {
        const staticMatch = currentGameObj.packages?.find(p => String(p.code) === String(sp.code || sp.id));
        return {
          id: sp.code || sp.id,
          code: sp.code || sp.id,
          name: formatFullPackageName(selectedGame, sp.code || sp.id, staticMatch?.name || sp.name),
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
            <button
              onClick={handleLogout}
              className="px-3.5 py-1.5 rounded-xl bg-red-950/50 hover:bg-red-900/70 border border-red-500/40 text-xs font-semibold text-red-300 hover:text-white transition-colors flex items-center gap-1.5"
              title="Sign out of Admin Session"
            >
              🚪 ចាកចេញ (Logout)
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-cyan-300">
                ONE LOVE ADMIN CONTROL
              </h1>
              <p className="text-[11px] text-gray-400">គ្រប់គ្រងរូបភាព Logo, តម្លៃពេជ្រ និងស្តុក API</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Live MySQL Database Indicator */}
            {dbStatus && (
              <div className={`px-3 py-2 rounded-xl border text-right transition-all ${
                dbStatus.isConnected 
                  ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
                  : 'bg-amber-950/70 border-amber-500/50 text-amber-300'
              }`}>
                <div className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 justify-end">
                  <span className={`w-2 h-2 rounded-full ${dbStatus.isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                  <span>{dbStatus.isConnected ? 'MySQL Database' : 'DB Local Fallback'}</span>
                </div>
                <div className="text-xs font-black font-mono mt-0.5">
                  {dbStatus.isConnected ? `Connected • ${dbStatus.ordersCount || 0} Orders` : 'Ready for Railway'}
                </div>
              </div>
            )}

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

        {/* Stock Open / Close Control */}
        <div className={`p-3.5 rounded-xl border flex items-center justify-between ${stockClosed ? 'bg-red-950/40 border-red-500/40' : 'bg-[#0c2a1f] border-emerald-500/30'}`}>
          <div className="flex items-center gap-2.5">
            <span className="text-lg">{stockClosed ? '🔒' : '🟢'}</span>
            <div>
              <div className={`text-xs font-bold ${stockClosed ? 'text-red-300' : 'text-emerald-300'}`}>
                ស្តុកសម្រាប់ {selectedGame.toUpperCase()} (Stock Control)
              </div>
              <div className="text-[11px] text-gray-400">
                {stockClosed
                  ? 'បិទស្តុក — ទំព័រ Home បង្ហាញ "Out of Stock" ហើយអតិថិជនមិនអាចបង់ប្រាក់បានទេ'
                  : 'បើកស្តុក — អតិថិជនអាចទិញបានធម្មតា។ ចុចដើម្បីបិទស្តុក'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleStock}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              stockClosed
                ? 'bg-red-600 text-white shadow-[0_0_10px_rgba(239,68,68,0.4)]'
                : 'bg-emerald-600 text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]'
            }`}
          >
            {stockClosed ? '🔒 បិទស្តុក (CLOSED)' : '✓ បើកស្តុក (OPEN)'}
          </button>
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
                        {selectedGame === 'roblox' ? 'រូបតំណាង ROBUX LOGO' : 'រូបតំណាងពេជ្រធម្មតា (DIAMONDS)'}
                      </span>
                    </label>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {selectedGame === 'roblox' ? 'បង្ហាញលើគ្រប់កញ្ចប់ Robux Codes' : 'បង្ហាញលើកញ្ចប់ពេជ្រធម្មតាទាំងអស់ (Normal Diamonds)'}
                    </p>
                  </div>
                  {/* Live Preview */}
                  <div className="w-14 h-14 rounded-xl bg-black/60 border border-cyan-400/50 flex items-center justify-center p-1.5 shadow-[0_0_12px_rgba(0,240,255,0.3)]">
                    <img 
                      src={diamondUrl || (selectedGame === 'roblox' ? '/assets/diamonds/robux-gold.svg' : (selectedGame === 'free-fire' ? '/assets/diamonds/ff-diamond.png' : '/assets/diamonds/mlbb-diamond.png'))} 
                      alt="Diamond Preview" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>

                <label className={`w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-700 via-fuchsia-600 to-cyan-600 hover:brightness-110 active:scale-[0.99] text-white text-xs font-bold cursor-pointer flex items-center justify-center gap-2 shadow-md transition-all ${uploadingField === 'diamond' ? 'opacity-70 pointer-events-none' : ''}`}>
                  <span>{uploadingField === 'diamond' ? '⏳' : '📷'}</span>
                  <span>{uploadingField === 'diamond' ? 'កំពុងដំណើរការ Upload...' : (selectedGame === 'roblox' ? 'Upload រូប Robux Logo' : 'Upload រូបពេជ្រធម្មតា (Normal Diamonds)')}</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onClick={(e) => { e.target.value = null; }}
                    onChange={(e) => handleFileUpload(e, setDiamondUrl, 'diamond', true)}
                  />
                </label>
              </div>

              {/* 2. MOBILE LEGENDS SPECIFIC PASS CARDS */}
              {selectedGame === 'mobile-legends' && (
                <>
                  {/* Weekly Diamond Pass */}
                  <div className="p-4 rounded-xl bg-[#0e041d] border border-cyan-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                          <span>🎟️</span>
                          <span>WEEKLY DIAMOND PASS</span>
                        </label>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          កញ្ចប់: Weekly, 2Weekly, 3Weekly, 4Weekly, 5Weekly, 10Weekly
                        </p>
                      </div>
                      <div className="w-14 h-14 rounded-xl bg-black/60 border border-cyan-400/50 flex items-center justify-center p-1.5 shadow-[0_0_12px_rgba(0,240,255,0.3)]">
                        <img 
                          key={weeklyUrl}
                          src={weeklyUrl || '/assets/diamonds/mlbb-weekly-pass.svg'} 
                          alt="Weekly Pass Preview" 
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                    <label className={`w-full py-2.5 px-4 rounded-xl bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-400/50 text-cyan-200 text-xs font-bold cursor-pointer flex items-center justify-center gap-2 shadow-md transition-all ${uploadingField === 'weekly' ? 'opacity-70 pointer-events-none' : ''}`}>
                      <span>{uploadingField === 'weekly' ? '⏳' : '📷'}</span>
                      <span>{uploadingField === 'weekly' ? 'កំពុង Upload...' : 'Upload រូប Weekly Diamond Pass'}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onClick={(e) => { e.target.value = null; }}
                        onChange={(e) => handleFileUpload(e, setWeeklyUrl, 'weekly', true)}
                      />
                    </label>
                  </div>

                  {/* Weekly Elite Pass */}
                  <div className="p-4 rounded-xl bg-[#0e041d] border border-blue-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-black text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                          <span>🛡️</span>
                          <span>WEEKLY ELITE PASS</span>
                        </label>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          កញ្ចប់: Weekly Elite Pass (Code: WeeklyElite)
                        </p>
                      </div>
                      <div className="w-14 h-14 rounded-xl bg-black/60 border border-blue-400/50 flex items-center justify-center p-1.5 shadow-[0_0_12px_rgba(59,130,246,0.3)]">
                        <img 
                          key={weeklyEliteUrl}
                          src={weeklyEliteUrl || '/assets/diamonds/elite-pass.svg'} 
                          alt="Weekly Elite Preview" 
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                    <label className={`w-full py-2.5 px-4 rounded-xl bg-blue-950/70 hover:bg-blue-900/80 border border-blue-400/50 text-blue-200 text-xs font-bold cursor-pointer flex items-center justify-center gap-2 shadow-md transition-all ${uploadingField === 'weeklyElite' ? 'opacity-70 pointer-events-none' : ''}`}>
                      <span>{uploadingField === 'weeklyElite' ? '⏳' : '📷'}</span>
                      <span>{uploadingField === 'weeklyElite' ? 'កំពុង Upload...' : 'Upload រូប Weekly Elite Pass'}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onClick={(e) => { e.target.value = null; }}
                        onChange={(e) => handleFileUpload(e, setWeeklyEliteUrl, 'weeklyElite', true)}
                      />
                    </label>
                  </div>

                  {/* Monthly Epic Pass */}
                  <div className="p-4 rounded-xl bg-[#0e041d] border border-amber-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                          <span>👑</span>
                          <span>MONTHLY EPIC PASS</span>
                        </label>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          កញ្ចប់: Monthly Epic Pass (Code: MonthlyEpic)
                        </p>
                      </div>
                      <div className="w-14 h-14 rounded-xl bg-black/60 border border-amber-400/50 flex items-center justify-center p-1.5 shadow-[0_0_12px_rgba(245,158,11,0.3)]">
                        <img 
                          key={monthlyEpicUrl}
                          src={monthlyEpicUrl || '/assets/diamonds/epic-pass.svg'} 
                          alt="Monthly Epic Preview" 
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                    <label className={`w-full py-2.5 px-4 rounded-xl bg-amber-950/70 hover:bg-amber-900/80 border border-amber-400/50 text-amber-200 text-xs font-bold cursor-pointer flex items-center justify-center gap-2 shadow-md transition-all ${uploadingField === 'monthlyEpic' ? 'opacity-70 pointer-events-none' : ''}`}>
                      <span>{uploadingField === 'monthlyEpic' ? '⏳' : '📷'}</span>
                      <span>{uploadingField === 'monthlyEpic' ? 'កំពុង Upload...' : 'Upload រូប Monthly Epic Pass'}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onClick={(e) => { e.target.value = null; }}
                        onChange={(e) => handleFileUpload(e, setMonthlyEpicUrl, 'monthlyEpic', true)}
                      />
                    </label>
                  </div>

                  {/* Twilight Pass */}
                  <div className="p-4 rounded-xl bg-[#0e041d] border border-fuchsia-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-black text-fuchsia-300 uppercase tracking-wider flex items-center gap-1.5">
                          <span>🌌</span>
                          <span>TWILIGHT PASS</span>
                        </label>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          កញ្ចប់: Twilight Pass (Code: Twilight)
                        </p>
                      </div>
                      <div className="w-14 h-14 rounded-xl bg-black/60 border border-fuchsia-400/50 flex items-center justify-center p-1.5 shadow-[0_0_12px_rgba(217,70,239,0.3)]">
                        <img 
                          key={twilightUrl}
                          src={twilightUrl || '/assets/diamonds/twilight-pass.svg'} 
                          alt="Twilight Pass Preview" 
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                    <label className={`w-full py-2.5 px-4 rounded-xl bg-fuchsia-950/70 hover:bg-fuchsia-900/80 border border-fuchsia-400/50 text-fuchsia-200 text-xs font-bold cursor-pointer flex items-center justify-center gap-2 shadow-md transition-all ${uploadingField === 'twilight' ? 'opacity-70 pointer-events-none' : ''}`}>
                      <span>{uploadingField === 'twilight' ? '⏳' : '📷'}</span>
                      <span>{uploadingField === 'twilight' ? 'កំពុង Upload...' : 'Upload រូប Twilight Pass'}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onClick={(e) => { e.target.value = null; }}
                        onChange={(e) => handleFileUpload(e, setTwilightUrl, 'twilight', true)}
                      />
                    </label>
                  </div>
                </>
              )}

              {/* 3. FREE FIRE SPECIFIC PASS CARDS */}
              {selectedGame === 'free-fire' && (
                <>
                  {/* Weekly Membership (W.Card) */}
                  <div className="p-4 rounded-xl bg-[#0e041d] border border-cyan-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                          <span>🎟️</span>
                          <span>WEEKLY MEMBERSHIP (W.CARD)</span>
                        </label>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          កញ្ចប់: 1x ដល់ 20x Weekly Membership (weekly, 2weekly...)
                        </p>
                      </div>
                      <div className="w-14 h-14 rounded-xl bg-black/60 border border-cyan-400/50 flex items-center justify-center p-1.5 shadow-[0_0_12px_rgba(0,240,255,0.3)]">
                        <img 
                          key={weeklyUrl}
                          src={weeklyUrl || '/assets/diamonds/ff-weekly-card.svg'} 
                          alt="Weekly Card Preview" 
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                    <label className={`w-full py-2.5 px-4 rounded-xl bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-400/50 text-cyan-200 text-xs font-bold cursor-pointer flex items-center justify-center gap-2 shadow-md transition-all ${uploadingField === 'weekly' ? 'opacity-70 pointer-events-none' : ''}`}>
                      <span>{uploadingField === 'weekly' ? '⏳' : '📷'}</span>
                      <span>{uploadingField === 'weekly' ? 'កំពុង Upload...' : 'Upload រូប Weekly Membership (W.Card)'}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onClick={(e) => { e.target.value = null; }}
                        onChange={(e) => handleFileUpload(e, setWeeklyUrl, 'weekly', true)}
                      />
                    </label>
                  </div>

                  {/* Weekly Lite (W.Lite) */}
                  <div className="p-4 rounded-xl bg-[#0e041d] border border-sky-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-black text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
                          <span>⚡</span>
                          <span>WEEKLY LITE (W.LITE)</span>
                        </label>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          កញ្ចប់: 1x ដល់ 20x Weekly Lite (weeklylite, 2weeklylite...)
                        </p>
                      </div>
                      <div className="w-14 h-14 rounded-xl bg-black/60 border border-sky-400/50 flex items-center justify-center p-1.5 shadow-[0_0_12px_rgba(56,189,248,0.3)]">
                        <img 
                          key={ffWeeklyLiteUrl}
                          src={ffWeeklyLiteUrl || '/assets/diamonds/ff-weekly-lite.svg'} 
                          alt="Weekly Lite Preview" 
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                    <label className={`w-full py-2.5 px-4 rounded-xl bg-sky-950/70 hover:bg-sky-900/80 border border-sky-400/50 text-sky-200 text-xs font-bold cursor-pointer flex items-center justify-center gap-2 shadow-md transition-all ${uploadingField === 'weeklyLite' ? 'opacity-70 pointer-events-none' : ''}`}>
                      <span>{uploadingField === 'weeklyLite' ? '⏳' : '📷'}</span>
                      <span>{uploadingField === 'weeklyLite' ? 'កំពុង Upload...' : 'Upload រូប Weekly Lite (W.Lite)'}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onClick={(e) => { e.target.value = null; }}
                        onChange={(e) => handleFileUpload(e, setFfWeeklyLiteUrl, 'weeklyLite', true)}
                      />
                    </label>
                  </div>

                  {/* Monthly Membership (M.Card) */}
                  <div className="p-4 rounded-xl bg-[#0e041d] border border-amber-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                          <span>👑</span>
                          <span>MONTHLY MEMBERSHIP (M.CARD)</span>
                        </label>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          កញ្ចប់: 1x ដល់ 20x Monthly Membership (monthly, 2monthly...)
                        </p>
                      </div>
                      <div className="w-14 h-14 rounded-xl bg-black/60 border border-amber-400/50 flex items-center justify-center p-1.5 shadow-[0_0_12px_rgba(245,158,11,0.3)]">
                        <img 
                          key={ffMonthlyUrl}
                          src={ffMonthlyUrl || '/assets/diamonds/ff-monthly-card.svg'} 
                          alt="Monthly Card Preview" 
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                    <label className={`w-full py-2.5 px-4 rounded-xl bg-amber-950/70 hover:bg-amber-900/80 border border-amber-400/50 text-amber-200 text-xs font-bold cursor-pointer flex items-center justify-center gap-2 shadow-md transition-all ${uploadingField === 'monthlyCard' ? 'opacity-70 pointer-events-none' : ''}`}>
                      <span>{uploadingField === 'monthlyCard' ? '⏳' : '📷'}</span>
                      <span>{uploadingField === 'monthlyCard' ? 'កំពុង Upload...' : 'Upload រូប Monthly Membership (M.Card)'}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onClick={(e) => { e.target.value = null; }}
                        onChange={(e) => handleFileUpload(e, setFfMonthlyUrl, 'monthlyCard', true)}
                      />
                    </label>
                  </div>

                  {/* Level Up Pass */}
                  <div className="p-4 rounded-xl bg-[#0e041d] border border-purple-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-black text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                          <span>🏆</span>
                          <span>LEVEL UP PASS</span>
                        </label>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          កញ្ចប់: Level Up Pass All Levels, Level 6 ដល់ Level 30
                        </p>
                      </div>
                      <div className="w-14 h-14 rounded-xl bg-black/60 border border-purple-400/50 flex items-center justify-center p-1.5 shadow-[0_0_12px_rgba(168,85,247,0.3)]">
                        <img 
                          key={ffLevelUpUrl}
                          src={ffLevelUpUrl || '/assets/diamonds/ff-levelup.svg'} 
                          alt="Level Up Pass Preview" 
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                    <label className={`w-full py-2.5 px-4 rounded-xl bg-purple-950/70 hover:bg-purple-900/80 border border-purple-400/50 text-purple-200 text-xs font-bold cursor-pointer flex items-center justify-center gap-2 shadow-md transition-all ${uploadingField === 'levelUp' ? 'opacity-70 pointer-events-none' : ''}`}>
                      <span>{uploadingField === 'levelUp' ? '⏳' : '📷'}</span>
                      <span>{uploadingField === 'levelUp' ? 'កំពុង Upload...' : 'Upload រូប Level Up Pass'}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onClick={(e) => { e.target.value = null; }}
                        onChange={(e) => handleFileUpload(e, setFfLevelUpUrl, 'levelUp', true)}
                      />
                    </label>
                  </div>

                  {/* Combo (M+W+L) */}
                  <div className="p-4 rounded-xl bg-[#0e041d] border border-rose-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-black text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                          <span>💥</span>
                          <span>COMBO PASS (M+W+L)</span>
                        </label>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          កញ្ចប់: 1x ដល់ 5x Combo Bundle (Monthly + Weekly + Level Up)
                        </p>
                      </div>
                      <div className="w-14 h-14 rounded-xl bg-black/60 border border-rose-400/50 flex items-center justify-center p-1.5 shadow-[0_0_12px_rgba(244,63,94,0.3)]">
                        <img 
                          key={ffComboUrl}
                          src={ffComboUrl || '/assets/diamonds/ff-combo.svg'} 
                          alt="Combo Preview" 
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                    <label className={`w-full py-2.5 px-4 rounded-xl bg-rose-950/70 hover:bg-rose-900/80 border border-rose-400/50 text-rose-200 text-xs font-bold cursor-pointer flex items-center justify-center gap-2 shadow-md transition-all ${uploadingField === 'combo' ? 'opacity-70 pointer-events-none' : ''}`}>
                      <span>{uploadingField === 'combo' ? '⏳' : '📷'}</span>
                      <span>{uploadingField === 'combo' ? 'កំពុង Upload...' : 'Upload រូប Combo Pass (M+W+L)'}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onClick={(e) => { e.target.value = null; }}
                        onChange={(e) => handleFileUpload(e, setFfComboUrl, 'combo', true)}
                      />
                    </label>
                  </div>
                </>
              )}

              {/* 4. GAME COVER BANNER UPLOAD */}
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

                <label className={`w-full py-3 px-4 rounded-xl bg-amber-950/60 hover:bg-amber-900/60 border border-amber-400/40 text-amber-200 text-xs font-bold cursor-pointer flex items-center justify-center gap-2 shadow-md transition-all ${uploadingField === 'cover' ? 'opacity-70 pointer-events-none' : ''}`}>
                  <span>{uploadingField === 'cover' ? '⏳' : '📷'}</span>
                  <span>{uploadingField === 'cover' ? 'កំពុងដំណើរការ Upload Cover...' : 'Upload រូប Cover ពីទូរស័ព្ទ / PC'}</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onClick={(e) => { e.target.value = null; }}
                    onChange={(e) => handleFileUpload(e, setCoverUrl, 'cover', false)}
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

                  const displayPackageIcon = getPackageCustomIcon(selectedGame, pkg.code || pkg.id, pkg.img);

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
                              e.target.src = pkg.img || (selectedGame === 'free-fire' ? '/assets/diamonds/ff-diamond.png' : selectedGame === 'roblox' ? '/assets/diamonds/robux-gold.svg' : '/assets/diamonds/mlbb-diamond.png');
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

        {/* Orders History & Feed (MySQL Database + Sora Provider) */}
        <div className="p-5 rounded-2xl bg-[#160a2b] border border-purple-500/30 shadow-lg space-y-3">
          <div className="flex flex-wrap items-center justify-between border-b border-purple-500/20 pb-2.5 gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveOrdersTab('mysql')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeOrdersTab === 'mysql'
                    ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow'
                    : 'bg-[#100722] text-gray-400 hover:text-white'
                }`}
              >
                🗄️ MySQL Store Orders ({mysqlOrders.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveOrdersTab('sora')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeOrdersTab === 'sora'
                    ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow'
                    : 'bg-[#100722] text-gray-400 hover:text-white'
                }`}
              >
                ⚡ Sora Reseller Feed ({soraOrders.length})
              </button>
            </div>
            <span className="text-[10px] text-gray-400 font-mono">
              {activeOrdersTab === 'mysql' ? 'MySQL Persistent Table' : 'Sora API'}
            </span>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {activeOrdersTab === 'mysql' ? (
              mysqlOrders.length > 0 ? (
                mysqlOrders.map(ord => (
                  <div key={ord.orderId || ord.tranId} className="p-3 rounded-xl bg-[#0e041d] border border-purple-500/20 text-xs flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-gray-200 flex items-center gap-2">
                        <span className="text-cyan-300 capitalize">{ord.game}</span>
                        <span>•</span>
                        <span>{ord.packageName}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-black ${
                          ord.dispatched || ord.status === 'SUCCESS' 
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' 
                            : (ord.verifiedPaid ? 'bg-cyan-950 text-cyan-400 border border-cyan-500/40' : 'bg-amber-950 text-amber-400 border border-amber-500/40')
                        }`}>
                          {ord.dispatched ? 'DISPATCHED' : (ord.verifiedPaid ? 'PAID' : (ord.status || 'PENDING'))}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 font-mono mt-1 flex flex-wrap items-center gap-2">
                        <span>Player: <strong className="text-white">{ord.playerName || ord.playerId}</strong></span>
                        <span>(ID: {ord.playerId}{ord.serverId ? ` / Zone: ${ord.serverId}` : ''})</span>
                        <span>• Tran: {ord.tranId}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold text-emerald-400 font-mono text-sm">${Number(ord.amount).toFixed(2)} {ord.currency || 'USD'}</div>
                      <div className="text-[9px] text-gray-500 font-mono">
                        {ord.createdAt ? new Date(Number(ord.createdAt)).toLocaleTimeString('en-GB') : ''}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-gray-400 space-y-1">
                  <div>មិនទាន់មានការបញ្ជាទិញក្នុង MySQL Database នៅឡើយទេ</div>
                  <div className="text-[10px] text-gray-500 font-mono">រាល់ពេលភ្ញៀវទិញពេជ្រជោគជ័យ វានឹងកត់ត្រាស្វ័យប្រវត្តិចូល MySQL!</div>
                </div>
              )
            ) : (
              soraOrders.length > 0 ? (
                soraOrders.slice(0, 10).map(ord => (
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
                  មិនទាន់មាន Order ថ្មីពី Sora ទេ
                </div>
              )
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
