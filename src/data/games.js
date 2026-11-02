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
      { id: 'weekly', name: '🎟️ Weekly Pass' }
    ],
    packages: [
      // 1. Regular Diamonds
      { id: '55', code: '55', name: '55 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 0.77, bonus: '+5 💎', points: '+1 ពិន្ទុ', popular: true, img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '86', code: '86', name: '86 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 1.19, bonus: '+8 💎', points: '+1 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '165', code: '165', name: '165 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 2.26, bonus: '+15 💎', points: '+2 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '172', code: '172', name: '172 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 2.35, bonus: '+16 💎', points: '+2 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '257', code: '257', name: '257 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 3.43, bonus: '+24 💎', points: '+3 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '275', code: '275', name: '275 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 3.62, bonus: '+25 💎', points: '+4 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '343', code: '343', name: '343 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 4.61, bonus: '+32 💎', points: '+5 ពិន្ទុ', popular: true, img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '429', code: '429', name: '429 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 5.78, bonus: '+40 💎', points: '+6 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '514', code: '514', name: '514 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 6.85, bonus: '+48 💎', points: '+7 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '516', code: '516', name: '516 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 7.06, bonus: '+48 💎', points: '+7 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '565', code: '565', name: '565 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 7.43, bonus: '+52 💎', points: '+7 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '600', code: '600', name: '600 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 8.04, bonus: '+55 💎', points: '+8 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '706', code: '706', name: '706 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 9.26, bonus: '+65 💎', points: '+9 ពិន្ទុ', popular: true, img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '792', code: '792', name: '792 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 10.45, bonus: '+72 💎', points: '+10 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '878', code: '878', name: '878 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 11.62, bonus: '+82 💎', points: '+12 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '963', code: '963', name: '963 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 12.69, bonus: '+90 💎', points: '+13 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '1049', code: '1049', name: '1049 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 13.88, bonus: '+95 💎', points: '+14 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '1135', code: '1135', name: '1135 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 15.04, bonus: '+110 💎', points: '+15 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '1220', code: '1220', name: '1220 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 16.12, bonus: '+120 💎', points: '+16 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '1412', code: '1412', name: '1412 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 18.53, bonus: '+140 💎', points: '+18 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '1584', code: '1584', name: '1584 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 20.88, bonus: '+150 💎', points: '+21 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '1755', code: '1755', name: '1755 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 23.14, bonus: '+175 💎', points: '+23 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '2195', code: '2195', name: '2195 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 28.04, bonus: '+220 💎', points: '+28 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '2901', code: '2901', name: '2901 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 37.44, bonus: '+290 💎', points: '+37 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '3688', code: '3688', name: '3688 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 46.78, bonus: '+370 💎', points: '+46 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '4390', code: '4390', name: '4390 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 56.09, bonus: '+440 💎', points: '+56 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '5532', code: '5532', name: '5532 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 70.64, bonus: '+560 💎', points: '+70 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },
      { id: '9288', code: '9288', name: '9288 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 117.32, bonus: '+920 💎', points: '+117 ពិន្ទុ', img: '/assets/diamonds/mlbb-diamond.png' },

      // 2. Weekly Pass (Direct Sora Topup Connection)
      { id: 'Weekly', code: 'Weekly', name: 'Weekly Membership', section: 'weekly', sectionTitle: 'Weekly Pass', price: 1.47, bonus: 'សរុប 220💎', points: '+2 ពិន្ទុ', popular: true, img: '/assets/diamonds/mlbb-weekly-pass.svg' },
      { id: '2Weekly', code: '2Weekly', name: '2x W.Pass', section: 'weekly', sectionTitle: 'Weekly Pass', price: 2.94, bonus: 'សរុប 440💎', points: '+3 ពិន្ទុ', img: '/assets/diamonds/mlbb-weekly-pass.svg' },
      { id: '3Weekly', code: '3Weekly', name: '3x W.Pass', section: 'weekly', sectionTitle: 'Weekly Pass', price: 4.41, bonus: 'Full Ticket', topTag: 'Full Ticket', points: '+5 ពិន្ទុ', popular: true, img: '/assets/diamonds/mlbb-weekly-pass.svg' },
      { id: '4Weekly', code: '4Weekly', name: '4x W.Pass', section: 'weekly', sectionTitle: 'Weekly Pass', price: 5.88, bonus: 'សរុប 880💎', points: '+6 ពិន្ទុ', img: '/assets/diamonds/mlbb-weekly-pass.svg' },
      { id: '5Weekly', code: '5Weekly', name: '5x W.Pass', section: 'weekly', sectionTitle: 'Weekly Pass', price: 7.35, bonus: 'សរុប 1,100💎', points: '+7 ពិន្ទុ', img: '/assets/diamonds/mlbb-weekly-pass.svg' },
      { id: '10Weekly', code: '10Weekly', name: '10x W.Pass', section: 'weekly', sectionTitle: 'Weekly Pass', price: 14.70, bonus: 'សរុប 2,200💎', points: '+15 ពិន្ទុ', img: '/assets/diamonds/mlbb-weekly-pass.svg' }
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
      { id: 'all', name: '💎 Diamonds' }
    ],
    packages: [
      { id: '25', code: '25', name: '25 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 0.25, bonus: '+3 💎', points: '+1 ពិន្ទុ', img: '/assets/diamonds/ff-diamond.png' },
      { id: '100', code: '100', name: '100 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 0.89, bonus: '+15 💎', points: '+1 ពិន្ទុ', popular: true, img: '/assets/diamonds/ff-diamond.png' },
      { id: '310', code: '310', name: '310 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 2.70, bonus: '+35 💎', points: '+3 ពិន្ទុ', img: '/assets/diamonds/ff-diamond-pack.png' },
      { id: '520', code: '520', name: '520 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 4.55, bonus: '+70 💎', points: '+5 ពិន្ទុ', popular: true, img: '/assets/diamonds/ff-diamond-pack.png' },
      { id: '1060', code: '1060', name: '1,060 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 8.88, bonus: '+140 💎', points: '+9 ពិន្ទុ', popular: true, img: '/assets/diamonds/ff-diamond-pack.png' },
      { id: '2180', code: '2180', name: '2,180 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 18.00, bonus: '+290 💎', points: '+18 ពិន្ទុ', img: '/assets/diamonds/ff-diamond-pack.png' },
      { id: '5600', code: '5600', name: '5,600 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 45.00, bonus: '+750 💎', points: '+45 ពិន្ទុ', img: '/assets/diamonds/ff-diamond-pack.png' },
      { id: '11500', code: '11500', name: '11,500 Diamonds', section: 'diamonds', sectionTitle: 'Diamonds', price: 92.00, bonus: '+1,500 💎', points: '+92 ពិន្ទុ', img: '/assets/diamonds/ff-diamond-pack.png' }
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
      { id: 'rbx-80', code: 'rbx-80', name: '80 Robux Code', section: 'diamonds', sectionTitle: 'Digital Robux Codes', price: 0.99, bonus: 'កូដឌីជីថលភ្លាមៗ', points: '+1 ពិន្ទុ', img: '/assets/diamonds/robux-gold.svg' },
      { id: 'rbx-400', code: 'rbx-400', name: '400 Robux Code', section: 'diamonds', sectionTitle: 'Digital Robux Codes', price: 4.80, bonus: 'កូដឌីជីថលភ្លាមៗ', points: '+5 ពិន្ទុ', img: '/assets/diamonds/robux-gold.svg' },
      { id: 'rbx-800', code: 'rbx-800', name: '800 Robux Code', section: 'diamonds', sectionTitle: 'Digital Robux Codes', price: 9.30, bonus: 'កូដឌីជីថលភ្លាមៗ', points: '+9 ពិន្ទុ', popular: true, img: '/assets/diamonds/robux-gold.svg' },
      { id: 'rbx-1700', code: 'rbx-1700', name: '1,700 Robux Code', section: 'diamonds', sectionTitle: 'Digital Robux Codes', price: 18.90, bonus: 'កូដឌីជីថលភ្លាមៗ', points: '+19 ពិន្ទុ', popular: true, img: '/assets/diamonds/robux-gold.svg' },
      { id: 'rbx-4500', code: 'rbx-4500', name: '4,500 Robux Code', section: 'diamonds', sectionTitle: 'Digital Robux Codes', price: 47.00, bonus: 'កូដឌីជីថលភ្លាមៗ', points: '+47 ពិន្ទុ', img: '/assets/diamonds/robux-card.png' },
      { id: 'rbx-10000', code: 'rbx-10000', name: '10,000 Robux Code', section: 'diamonds', sectionTitle: 'Digital Robux Codes', price: 98.00, bonus: 'កូដឌីជីថល VIP', points: '+98 ពិន្ទុ', popular: true, img: '/assets/diamonds/robux-card.png' }
    ]
  }
];
