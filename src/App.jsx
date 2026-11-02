import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import HeroSlider from './components/HeroSlider';
import CustomBanner from './components/CustomBanner';
import ProductCard from './components/ProductCard';
import FloatingChat from './components/FloatingChat';
import Footer from './components/Footer';
import GameDetailPage from './pages/GameDetailPage';
import AdminPage from './pages/AdminPage';
import ErrorBoundary from './components/ErrorBoundary';
import { GAMES } from './data/games';
import { syncAdminSettingsWithServer } from './services/adminSettings';

export default function App() {
  const [selectedGame, setSelectedGame] = useState(null);
  const [currency, setCurrency] = useState('USD');
  const [isAdminView, setIsAdminView] = useState(
    typeof window !== 'undefined' && 
    (window.location.pathname === '/admin' || window.location.hash === '#admin')
  );
  const [, setTick] = useState(0);

  // Sync route changes & admin settings updates
  useEffect(() => {
    // Initial sync with server
    syncAdminSettingsWithServer();

    // Periodic sync so price/image changes appear across all user devices
    const interval = setInterval(() => {
      syncAdminSettingsWithServer();
    }, 10000);

    const handlePopState = () => {
      setIsAdminView(window.location.pathname === '/admin' || window.location.hash === '#admin');
    };

    const handleSettingsUpdated = () => {
      setTick(t => t + 1);
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('onelove_settings_updated', handleSettingsUpdated);

    return () => {
      clearInterval(interval);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('onelove_settings_updated', handleSettingsUpdated);
    };
  }, []);

  const handleSelectGame = (game) => {
    setSelectedGame(game);
    setIsAdminView(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToHome = () => {
    setSelectedGame(null);
    setIsAdminView(false);
    if (window.location.pathname === '/admin') {
      window.history.pushState({}, '', '/');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenAdmin = () => {
    setSelectedGame(null);
    setIsAdminView(true);
    window.history.pushState({}, '', '/admin');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isAdminView) {
    return <AdminPage onBack={handleBackToHome} />;
  }

  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Top Navigation Bar with live Sora Reseller status & Admin button */}
      <Navbar 
        currency={currency} 
        setCurrency={setCurrency} 
        onOpenAdmin={handleOpenAdmin} 
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full">
        {selectedGame ? (
          <ErrorBoundary onReset={handleBackToHome}>
            <GameDetailPage
              game={selectedGame}
              currency={currency}
              onBack={handleBackToHome}
            />
          </ErrorBoundary>
        ) : (
          <div className="w-full">
            {/* Level 1: Slider Container with User's Main Banner */}
            <HeroSlider />

            {/* Level 2: Popular Games Banner Header with sparkling diamond polygons */}
            <CustomBanner />

            {/* Level 3: Categories Product Grid (5 desktop / 3 mobile) */}
            <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 pb-12">
              <div className="product-grid">
                {GAMES.map((game) => (
                  <ProductCard
                    key={game.id}
                    game={game}
                    onSelect={handleSelectGame}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Telegram Floating Support Button */}
      <FloatingChat />

      {/* Lisa Topup Style Footer */}
      <Footer onOpenAdmin={handleOpenAdmin} />
    </div>
  );
}
