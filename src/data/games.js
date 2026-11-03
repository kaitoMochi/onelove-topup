export function formatFullPackageName(gameId, code, soraName = '') {
  const codeStr = String(code || '').trim();
  const codeLower = codeStr.toLowerCase();

  if (gameId === 'free-fire' || gameId === 'ff') {
    // 1. Regular Diamonds
    if (/^\d+$/.test(codeStr)) {
      return `${Number(codeStr).toLocaleString()} Diamonds`;
    }
    // 2. Weekly Lite
    if (codeLower === 'weeklylite') return 'Weekly Lite Membership';
    const liteMatch = codeLower.match(/^(\d+)weeklylite$/);
    if (liteMatch) return `${liteMatch[1]}x Weekly Lite Membership`;

    // 3. Weekly Membership (W.Card)
    if (codeLower === 'weekly') return 'Weekly Membership';
    const weeklyMatch = codeLower.match(/^(\d+)weekly$/);
    if (weeklyMatch) return `${weeklyMatch[1]}x Weekly Membership`;

    // 4. Monthly Membership (M.Card)
    if (codeLower === 'monthly') return 'Monthly Membership';
    const monthlyMatch = codeLower.match(/^(\d+)monthly$/);
    if (monthlyMatch) return `${monthlyMatch[1]}x Monthly Membership`;

    // 5. Level Up Pass
    if (codeLower === 'lup') return 'Level Up Pass (All Levels)';
    const lvlMatch = codeLower.match(/^l(\d+)$/);
    if (lvlMatch) return `Level Up Pass (Level ${lvlMatch[1]})`;

    // 6. MWL Combos
    if (codeLower === 'mwl') return 'Combo (Monthly + Weekly + Level Up)';
    const mwlMatch = codeLower.match(/^(\d+)mwl$/);
    if (mwlMatch) return `${mwlMatch[1]}x Combo (Monthly + Weekly + Level Up)`;

    return soraName || codeStr;
  }

  if (gameId === 'mobile-legends' || gameId === 'ml') {
    if (/^\d+$/.test(codeStr)) {
      return `${Number(codeStr).toLocaleString()} Diamonds`;
    }
    if (codeLower === 'weekly') return 'Weekly Diamond Pass';
    const wMatch = codeStr.match(/^(\d+)Weekly$/i);
    if (wMatch) return `${wMatch[1]}x Weekly Diamond Pass`;
    if (codeLower === 'weeklyelite') return 'Weekly Elite Pass';
    if (codeLower === 'monthlyepic') return 'Monthly Epic Pass';
    if (codeLower === 'twilight') return 'Twilight Pass';
    return soraName || codeStr;
  }

  if (gameId === 'roblox') {
    const robuxMap = {
      '100_robux': '100 Robux Code',
      '275_robux': '275 Robux Code',
      '360_robux': '360 Robux Code',
      '555_robux': '555 Robux Code',
      '1000_robux': '1,000 Robux Code',
      '2500_robux': '2,500 Robux Code',
      '5250_robux': '5,250 Robux Code',
      '11000_robux': '11,000 Robux Code'
    };
    return robuxMap[codeStr] || soraName || `${codeStr} Robux`;
  }

  return soraName || codeStr;
}

export const ALLOWED_ROBUX_CODES = [
  '100_robux',
  '275_robux',
  '360_robux',
  '555_robux',
  '1000_robux',
  '2500_robux',
  '5250_robux',
  '11000_robux'
];

export const GAMES = [
  {
    id: 'mobile-legends',
    name: 'Mobile Legends',
    khmerName: 'ម៉ូបាល លេជែន',
    slug: 'mobile-legends',
    image: '/games/mobile-legends-cover.jpg',
    banner: '/games/mobile-legends-cover.jpg',
    tag: 'POPULAR',
    needsZone: true,
    zonePlaceholder: 'Zone ID (4-5 digits)',
    idPlaceholder: 'User ID (8-10 digits)',
    guideImage: '/assets/mlbb-id-guide.svg',
    categories: [
      { id: 'all', name: '✨ ទាំងអស់ (All)' },
      { id: 'diamonds', name: '💎 Diamonds' },
      { id: 'weekly', name: '🎟️ Weekly Pass' },
      { id: 'subscriptions', name: '👑 សមាជិកភាព (Subscriptions)' }
    ],
    packages: [
      // 1. Regular Diamonds (28 Packages - Direct Sora Live API)
      { id: '55', code: '55', name: '55 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 0.77, bonus: '+5 💎', points: '+1 ពិន្ទុ', popular: true, img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '86', code: '86', name: '86 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 1.19, bonus: '+8 💎', points: '+1 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '165', code: '165', name: '165 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 2.26, bonus: '+15 💎', points: '+2 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '172', code: '172', name: '172 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 2.35, bonus: '+16 💎', points: '+2 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '257', code: '257', name: '257 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 3.43, bonus: '+24 💎', points: '+3 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '275', code: '275', name: '275 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 3.62, bonus: '+25 💎', points: '+4 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '343', code: '343', name: '343 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 4.61, bonus: '+32 💎', points: '+5 ពិន្ទុ', popular: true, img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '429', code: '429', name: '429 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 5.78, bonus: '+40 💎', points: '+6 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '514', code: '514', name: '514 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 6.85, bonus: '+48 💎', points: '+7 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '516', code: '516', name: '516 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 7.06, bonus: '+48 💎', points: '+7 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '565', code: '565', name: '565 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 7.43, bonus: '+52 💎', points: '+7 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '600', code: '600', name: '600 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 8.04, bonus: '+55 💎', points: '+8 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '706', code: '706', name: '706 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 9.26, bonus: '+65 💎', points: '+9 ពិន្ទុ', popular: true, img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '792', code: '792', name: '792 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 10.45, bonus: '+72 💎', points: '+10 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '878', code: '878', name: '878 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 11.62, bonus: '+82 💎', points: '+12 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '963', code: '963', name: '963 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 12.69, bonus: '+90 💎', points: '+13 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '1049', code: '1049', name: '1049 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 13.88, bonus: '+95 💎', points: '+14 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '1135', code: '1135', name: '1135 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 15.04, bonus: '+110 💎', points: '+15 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '1220', code: '1220', name: '1220 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 16.12, bonus: '+120 💎', points: '+16 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '1412', code: '1412', name: '1412 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 18.53, bonus: '+140 💎', points: '+18 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '1584', code: '1584', name: '1584 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 20.88, bonus: '+150 💎', points: '+21 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '1755', code: '1755', name: '1755 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 23.14, bonus: '+175 💎', points: '+23 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '2195', code: '2195', name: '2195 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 28.04, bonus: '+220 💎', points: '+28 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '2901', code: '2901', name: '2901 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 37.44, bonus: '+290 💎', points: '+37 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '3688', code: '3688', name: '3688 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 46.78, bonus: '+370 💎', points: '+46 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '4390', code: '4390', name: '4390 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 56.09, bonus: '+440 💎', points: '+56 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '5532', code: '5532', name: '5532 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 70.64, bonus: '+560 💎', points: '+70 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '9288', code: '9288', name: '9288 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 117.32, bonus: '+920 💎', points: '+117 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },

      // 2. Weekly Pass (Direct Sora Live API)
      { id: 'Weekly', code: 'Weekly', name: 'Weekly Diamond Pass', section: 'weekly', sectionTitle: 'Weekly Pass', category: 'weekly', price: 1.47, bonus: 'សរុប 220💎', points: '+2 ពិន្ទុ', popular: true, img: '/assets/diamonds/mlbb-weekly-pass.svg' },
      { id: '2Weekly', code: '2Weekly', name: '2x Weekly Diamond Pass', section: 'weekly', sectionTitle: 'Weekly Pass', category: 'weekly', price: 2.94, bonus: 'សរុប 440💎', points: '+3 ពិន្ទុ', img: '/assets/diamonds/mlbb-weekly-pass.svg' },
      { id: '3Weekly', code: '3Weekly', name: '3x Weekly Diamond Pass', section: 'weekly', sectionTitle: 'Weekly Pass', category: 'weekly', price: 4.41, bonus: 'Full Ticket', topTag: 'Full Ticket', points: '+5 ពិន្ទុ', popular: true, img: '/assets/diamonds/mlbb-weekly-pass.svg' },
      { id: '4Weekly', code: '4Weekly', name: '4x Weekly Diamond Pass', section: 'weekly', sectionTitle: 'Weekly Pass', category: 'weekly', price: 5.88, bonus: 'សរុប 880💎', points: '+6 ពិន្ទុ', img: '/assets/diamonds/mlbb-weekly-pass.svg' },
      { id: '5Weekly', code: '5Weekly', name: '5x Weekly Diamond Pass', section: 'weekly', sectionTitle: 'Weekly Pass', category: 'weekly', price: 7.35, bonus: 'សរុប 1,100💎', points: '+7 ពិន្ទុ', img: '/assets/diamonds/mlbb-weekly-pass.svg' },
      { id: '10Weekly', code: '10Weekly', name: '10x Weekly Diamond Pass', section: 'weekly', sectionTitle: 'Weekly Pass', category: 'weekly', price: 14.70, bonus: 'សរុប 2,200💎', points: '+15 ពិន្ទុ', img: '/assets/diamonds/mlbb-weekly-pass.svg' },

      // 3. Subscriptions & Special Passes (Direct Sora Live API)
      { id: 'WeeklyElite', code: 'WeeklyElite', name: 'Weekly Elite Pass', section: 'subscriptions', sectionTitle: 'Subscriptions & Special Passes', category: 'subscriptions', price: 0.77, bonus: 'Elite Rewards', points: '+1 ពិន្ទុ', img: '/assets/diamonds/elite-pass.svg' },
      { id: 'MonthlyEpic', code: 'MonthlyEpic', name: 'Monthly Epic Pass', section: 'subscriptions', sectionTitle: 'Subscriptions & Special Passes', category: 'subscriptions', price: 3.79, bonus: 'Epic Rewards', points: '+4 ពិន្ទុ', popular: true, img: '/assets/diamonds/epic-pass.svg' },
      { id: 'Twilight', code: 'Twilight', name: 'Twilight Pass', section: 'subscriptions', sectionTitle: 'Subscriptions & Special Passes', category: 'subscriptions', price: 7.77, bonus: 'Exclusive Skin', points: '+8 ពិន្ទុ', popular: true, img: '/assets/diamonds/twilight-pass.svg' }
    ]
  },
  {
    id: 'free-fire',
    name: 'Free Fire Mobile',
    khmerName: 'ហ្គារីណា ហ្វ្រី ហ្វាយ',
    slug: 'free-fire',
    image: '/games/free-fire-cover.jpg',
    banner: '/games/free-fire-cover.jpg',
    tag: 'HOT',
    needsZone: false,
    idPlaceholder: 'Player ID (UID)',
    guideImage: '/assets/ff-id-guide.svg',
    categories: [
      { id: 'all', name: '✨ ទាំងអស់ (All)' },
      { id: 'diamonds', name: '💎 Diamonds' },
      { id: 'weekly', name: '🎟️ Weekly Card & Lite' },
      { id: 'monthly', name: '👑 Monthly Card' },
      { id: 'special', name: '⚡ Level Up & Combos' }
    ],
    packages: [
      // 1. Regular Diamonds (8 Packages)
      { id: '25', code: '25', name: '25 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 0.25, bonus: '+3 💎', points: '+1 ពិន្ទុ', img: '/assets/diamonds/ff-diamond.png' },
      { id: '100', code: '100', name: '100 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 0.89, bonus: '+15 💎', points: '+1 ពិន្ទុ', popular: true, img: '/assets/diamonds/ff-diamond.png' },
      { id: '310', code: '310', name: '310 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 2.70, bonus: '+35 💎', points: '+3 ពិន្ទុ', img: '/assets/diamonds/ff-diamond-pack.png' },
      { id: '520', code: '520', name: '520 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 4.55, bonus: '+70 💎', points: '+5 ពិន្ទុ', popular: true, img: '/assets/diamonds/ff-diamond-pack.png' },
      { id: '1060', code: '1060', name: '1,060 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 8.88, bonus: '+140 💎', points: '+9 ពិន្ទុ', popular: true, img: '/assets/diamonds/ff-diamond-pack.png' },
      { id: '2180', code: '2180', name: '2,180 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 18.00, bonus: '+290 💎', points: '+18 ពិន្ទុ', img: '/assets/diamonds/ff-diamond-pack.png' },
      { id: '5600', code: '5600', name: '5,600 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 45.00, bonus: '+750 💎', points: '+45 ពិន្ទុ', img: '/assets/diamonds/ff-diamond-pack.png' },
      { id: '11500', code: '11500', name: '11,500 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', category: 'diamonds', price: 92.00, bonus: '+1,500 💎', points: '+92 ពិន្ទុ', img: '/assets/diamonds/ff-diamond-pack.png' },

      // 2. Weekly Card (Weekly Membership - W.Card)
      { id: 'weekly', code: 'weekly', name: 'Weekly Membership (W.Card)', section: 'weekly', sectionTitle: 'Weekly Card & Lite', category: 'weekly', price: 1.54, bonus: '450💎 សរុប + VIP', points: '+2 ពិន្ទុ', popular: true, img: '/assets/diamonds/ff-weekly-card.svg' },
      { id: '2weekly', code: '2weekly', name: '2x W.Card', section: 'weekly', sectionTitle: 'Weekly Card & Lite', category: 'weekly', price: 3.08, bonus: '2 សប្តាហ៍ VIP', points: '+3 ពិន្ទុ', img: '/assets/diamonds/ff-weekly-card.svg' },
      { id: '3weekly', code: '3weekly', name: '3x W.Card', section: 'weekly', sectionTitle: 'Weekly Card & Lite', category: 'weekly', price: 4.62, bonus: '3 សប្តាហ៍ VIP', points: '+5 ពិន្ទុ', img: '/assets/diamonds/ff-weekly-card.svg' },
      { id: '4weekly', code: '4weekly', name: '4x W.Card', section: 'weekly', sectionTitle: 'Weekly Card & Lite', category: 'weekly', price: 6.16, bonus: '4 សប្តាហ៍ VIP', points: '+6 ពិន្ទុ', img: '/assets/diamonds/ff-weekly-card.svg' },
      { id: '5weekly', code: '5weekly', name: '5x W.Card', section: 'weekly', sectionTitle: 'Weekly Card & Lite', category: 'weekly', price: 7.70, bonus: '5 សប្តាហ៍ VIP', points: '+8 ពិន្ទុ', img: '/assets/diamonds/ff-weekly-card.svg' },
      { id: '6weekly', code: '6weekly', name: '6x W.Card', section: 'weekly', sectionTitle: 'Weekly Card & Lite', category: 'weekly', price: 9.24, bonus: '6 សប្តាហ៍ VIP', points: '+9 ពិន្ទុ', img: '/assets/diamonds/ff-weekly-card.svg' },
      { id: '7weekly', code: '7weekly', name: '7x W.Card', section: 'weekly', sectionTitle: 'Weekly Card & Lite', category: 'weekly', price: 10.78, bonus: '7 សប្តាហ៍ VIP', points: '+11 ពិន្ទុ', img: '/assets/diamonds/ff-weekly-card.svg' },
      { id: '8weekly', code: '8weekly', name: '8x W.Card', section: 'weekly', sectionTitle: 'Weekly Card & Lite', category: 'weekly', price: 12.32, bonus: '8 សប្តាហ៍ VIP', points: '+12 ពិន្ទុ', img: '/assets/diamonds/ff-weekly-card.svg' },
      { id: '9weekly', code: '9weekly', name: '9x W.Card', section: 'weekly', sectionTitle: 'Weekly Card & Lite', category: 'weekly', price: 13.86, bonus: '9 សប្តាហ៍ VIP', points: '+14 ពិន្ទុ', img: '/assets/diamonds/ff-weekly-card.svg' },
      { id: '10weekly', code: '10weekly', name: '10x W.Card', section: 'weekly', sectionTitle: 'Weekly Card & Lite', category: 'weekly', price: 15.40, bonus: '10 សប្តាហ៍ VIP', points: '+15 ពិន្ទុ', popular: true, img: '/assets/diamonds/ff-weekly-card.svg' },
      { id: '15weekly', code: '15weekly', name: '15x W.Card', section: 'weekly', sectionTitle: 'Weekly Card & Lite', category: 'weekly', price: 23.10, bonus: '15 សប្តាហ៍ VIP', points: '+23 ពិន្ទុ', img: '/assets/diamonds/ff-weekly-card.svg' },
      { id: '20weekly', code: '20weekly', name: '20x W.Card', section: 'weekly', sectionTitle: 'Weekly Card & Lite', category: 'weekly', price: 30.80, bonus: '20 សប្តាហ៍ VIP', points: '+31 ពិន្ទុ', img: '/assets/diamonds/ff-weekly-card.svg' },

      // 3. Weekly Lite (W.Lite)
      { id: 'weeklylite', code: 'weeklylite', name: 'Weekly Lite (W.Lite)', section: 'weekly', sectionTitle: 'Weekly Card & Lite', category: 'weekly', price: 0.29, bonus: 'Lite Diamonds', points: '+1 ពិន្ទុ', popular: true, img: '/assets/diamonds/ff-weekly-lite.svg' },
      { id: '2weeklylite', code: '2weeklylite', name: '2x W.Lite', section: 'weekly', sectionTitle: 'Weekly Card & Lite', category: 'weekly', price: 0.58, bonus: 'Lite x2', points: '+1 ពិន្ទុ', img: '/assets/diamonds/ff-weekly-lite.svg' },
      { id: '3weeklylite', code: '3weeklylite', name: '3x W.Lite', section: 'weekly', sectionTitle: 'Weekly Card & Lite', category: 'weekly', price: 0.87, bonus: 'Lite x3', points: '+1 ពិន្ទុ', img: '/assets/diamonds/ff-weekly-lite.svg' },
      { id: '5weeklylite', code: '5weeklylite', name: '5x W.Lite', section: 'weekly', sectionTitle: 'Weekly Card & Lite', category: 'weekly', price: 1.45, bonus: 'Lite x5', points: '+1 ពិន្ទុ', img: '/assets/diamonds/ff-weekly-lite.svg' },
      { id: '10weeklylite', code: '10weeklylite', name: '10x W.Lite', section: 'weekly', sectionTitle: 'Weekly Card & Lite', category: 'weekly', price: 2.90, bonus: 'Lite x10', points: '+3 ពិន្ទុ', img: '/assets/diamonds/ff-weekly-lite.svg' },
      { id: '20weeklylite', code: '20weeklylite', name: '20x W.Lite', section: 'weekly', sectionTitle: 'Weekly Card & Lite', category: 'weekly', price: 5.80, bonus: 'Lite x20', points: '+6 ពិន្ទុ', img: '/assets/diamonds/ff-weekly-lite.svg' },

      // 4. Monthly Card (Monthly Membership - M.Card)
      { id: 'monthly', code: 'monthly', name: 'Monthly Membership (M.Card)', section: 'monthly', sectionTitle: 'Monthly Card', category: 'monthly', price: 7.41, bonus: '2,600💎 សរុប + VIP Super', points: '+7 ពិន្ទុ', popular: true, img: '/assets/diamonds/ff-monthly-card.svg' },
      { id: '2monthly', code: '2monthly', name: '2x M.Card', section: 'monthly', sectionTitle: 'Monthly Card', category: 'monthly', price: 14.82, bonus: '2 ខែ Super VIP', points: '+15 ពិន្ទុ', img: '/assets/diamonds/ff-monthly-card.svg' },
      { id: '3monthly', code: '3monthly', name: '3x M.Card', section: 'monthly', sectionTitle: 'Monthly Card', category: 'monthly', price: 22.23, bonus: '3 ខែ Super VIP', points: '+22 ពិន្ទុ', img: '/assets/diamonds/ff-monthly-card.svg' },
      { id: '4monthly', code: '4monthly', name: '4x M.Card', section: 'monthly', sectionTitle: 'Monthly Card', category: 'monthly', price: 29.64, bonus: '4 ខែ Super VIP', points: '+30 ពិន្ទុ', img: '/assets/diamonds/ff-monthly-card.svg' },
      { id: '5monthly', code: '5monthly', name: '5x M.Card', section: 'monthly', sectionTitle: 'Monthly Card', category: 'monthly', price: 37.05, bonus: '5 ខែ Super VIP', points: '+37 ពិន្ទុ', img: '/assets/diamonds/ff-monthly-card.svg' },
      { id: '10monthly', code: '10monthly', name: '10x M.Card', section: 'monthly', sectionTitle: 'Monthly Card', category: 'monthly', price: 74.10, bonus: '10 ខែ Super VIP', points: '+74 ពិន្ទុ', img: '/assets/diamonds/ff-monthly-card.svg' },
      { id: '20monthly', code: '20monthly', name: '20x M.Card', section: 'monthly', sectionTitle: 'Monthly Card', category: 'monthly', price: 148.20, bonus: '20 ខែ Super VIP', points: '+148 ពិន្ទុ', img: '/assets/diamonds/ff-monthly-card.svg' },

      // 5. Level Up Pass & Combos
      { id: 'lup', code: 'lup', name: 'Level Up Pass (All Levels)', section: 'special', sectionTitle: 'Level Up & Combos', category: 'special', price: 3.71, bonus: 'ទទួលបានពេជ្រតាម Level', points: '+4 ពិន្ទុ', popular: true, img: '/assets/diamonds/ff-levelup.svg' },
      { id: 'l6', code: 'l6', name: 'Level Up Pass (L6)', section: 'special', sectionTitle: 'Level Up & Combos', category: 'special', price: 0.31, bonus: 'Lv 6 Rewards', points: '+1 ពិន្ទុ', img: '/assets/diamonds/ff-levelup.svg' },
      { id: 'l10', code: 'l10', name: 'Level Up Pass (L10)', section: 'special', sectionTitle: 'Level Up & Combos', category: 'special', price: 0.62, bonus: 'Lv 10 Rewards', points: '+1 ពិន្ទុ', img: '/assets/diamonds/ff-levelup.svg' },
      { id: 'l15', code: 'l15', name: 'Level Up Pass (L15)', section: 'special', sectionTitle: 'Level Up & Combos', category: 'special', price: 0.62, bonus: 'Lv 15 Rewards', points: '+1 ពិន្ទុ', img: '/assets/diamonds/ff-levelup.svg' },
      { id: 'l20', code: 'l20', name: 'Level Up Pass (L20)', section: 'special', sectionTitle: 'Level Up & Combos', category: 'special', price: 0.62, bonus: 'Lv 20 Rewards', points: '+1 ពិន្ទុ', img: '/assets/diamonds/ff-levelup.svg' },
      { id: 'l25', code: 'l25', name: 'Level Up Pass (L25)', section: 'special', sectionTitle: 'Level Up & Combos', category: 'special', price: 0.62, bonus: 'Lv 25 Rewards', points: '+1 ពិន្ទុ', img: '/assets/diamonds/ff-levelup.svg' },
      { id: 'l30', code: 'l30', name: 'Level Up Pass (L30)', section: 'special', sectionTitle: 'Level Up & Combos', category: 'special', price: 0.92, bonus: 'Lv 30 Rewards', points: '+1 ពិន្ទុ', img: '/assets/diamonds/ff-levelup.svg' },
      { id: 'mwl', code: 'mwl', name: 'Combo (M+W+L)', section: 'special', sectionTitle: 'Level Up & Combos', category: 'special', price: 9.24, bonus: 'Monthly+Weekly+LvlUp', points: '+9 ពិន្ទុ', popular: true, img: '/assets/diamonds/ff-combo.svg' },
      { id: '2mwl', code: '2mwl', name: '2x Combo (M+W+L)', section: 'special', sectionTitle: 'Level Up & Combos', category: 'special', price: 18.48, bonus: '2x M+W+L Bundle', points: '+18 ពិន្ទុ', img: '/assets/diamonds/ff-combo.svg' },
      { id: '3mwl', code: '3mwl', name: '3x Combo (M+W+L)', section: 'special', sectionTitle: 'Level Up & Combos', category: 'special', price: 27.72, bonus: '3x M+W+L Bundle', points: '+28 ពិន្ទុ', img: '/assets/diamonds/ff-combo.svg' },
      { id: '5mwl', code: '5mwl', name: '5x Combo (M+W+L)', section: 'special', sectionTitle: 'Level Up & Combos', category: 'special', price: 46.20, bonus: '5x M+W+L Bundle', points: '+46 ពិន្ទុ', img: '/assets/diamonds/ff-combo.svg' }
    ]
  },
  {
    id: 'roblox',
    name: 'Roblox (Robux)',
    khmerName: 'រ៉ូប្លក់ រ៉ូប៊ុក',
    slug: 'roblox',
    image: '/games/roblox-cover.jpg',
    banner: '/games/roblox-cover.jpg',
    tag: 'INSTANT CODE',
    needsZone: false,
    idPlaceholder: 'Roblox Username',
    guideImage: null,
    categories: [
      { id: 'all', name: '🧱 Digital Robux Codes' }
    ],
    packages: [
      { id: '100_robux', code: '100_robux', name: '100 Robux Code', section: 'diamonds', sectionTitle: 'Digital Robux Codes', category: 'diamonds', price: 1.78, bonus: 'កូដឌីជីថលភ្លាមៗ', points: '+2 ពិន្ទុ', popular: true, img: '/assets/diamonds/robux-gold.svg' },
      { id: '275_robux', code: '275_robux', name: '275 Robux Code', section: 'diamonds', sectionTitle: 'Digital Robux Codes', category: 'diamonds', price: 2.75, bonus: 'កូដឌីជីថលភ្លាមៗ', points: '+3 ពិន្ទុ', popular: true, img: '/assets/diamonds/robux-gold.svg' },
      { id: '360_robux', code: '360_robux', name: '360 Robux Code', section: 'diamonds', sectionTitle: 'Digital Robux Codes', category: 'diamonds', price: 3.60, bonus: 'កូដឌីជីថលភ្លាមៗ', points: '+4 ពិន្ទុ', img: '/assets/diamonds/robux-gold.svg' },
      { id: '555_robux', code: '555_robux', name: '555 Robux Code', section: 'diamonds', sectionTitle: 'Digital Robux Codes', category: 'diamonds', price: 5.48, bonus: 'កូដឌីជីថលភ្លាមៗ', points: '+5 ពិន្ទុ', popular: true, img: '/assets/diamonds/robux-gold.svg' },
      { id: '1000_robux', code: '1000_robux', name: '1,000 Robux Code', section: 'diamonds', sectionTitle: 'Digital Robux Codes', category: 'diamonds', price: 9.40, bonus: 'កូដឌីជីថលភ្លាមៗ', points: '+9 ពិន្ទុ', popular: true, img: '/assets/diamonds/robux-gold.svg' },
      { id: '2500_robux', code: '2500_robux', name: '2,500 Robux Code', section: 'diamonds', sectionTitle: 'Digital Robux Codes', category: 'diamonds', price: 23.86, bonus: 'កូដឌីជីថល VIP', points: '+24 ពិន្ទុ', img: '/assets/diamonds/robux-card.png' },
      { id: '5250_robux', code: '5250_robux', name: '5,250 Robux Code', section: 'diamonds', sectionTitle: 'Digital Robux Codes', category: 'diamonds', price: 48.11, bonus: 'កូដឌីជីថល VIP', points: '+48 ពិន្ទុ', img: '/assets/diamonds/robux-card.png' },
      { id: '11000_robux', code: '11000_robux', name: '11,000 Robux Code', section: 'diamonds', sectionTitle: 'Digital Robux Codes', category: 'diamonds', price: 95.90, bonus: 'កូដឌីជីថល VIP', points: '+96 ពិន្ទុ', img: '/assets/diamonds/robux-card.png' }
    ]
  }
];
