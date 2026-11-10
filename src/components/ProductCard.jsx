import React, { useState, useEffect } from 'react';
import { getGameAsset, isGameStockClosed } from '../services/adminSettings';

export default function ProductCard({ game, onSelect }) {
  const [displayCover, setDisplayCover] = useState(() => getGameAsset(game.id, 'cover', game.image));
  const [closed, setClosed] = useState(() => isGameStockClosed(game.id));

  useEffect(() => {
    const handleUpdate = () => {
      setDisplayCover(getGameAsset(game.id, 'cover', game.image));
      setClosed(isGameStockClosed(game.id));
    };
    window.addEventListener('onelove_settings_updated', handleUpdate);
    return () => window.removeEventListener('onelove_settings_updated', handleUpdate);
  }, [game.id, game.image]);

  return (
    <div 
      className="product-card"
      onClick={() => onSelect(game)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelect(game); }}
    >
      <div className="card-link flex flex-col h-full w-full">
        {/* 1:1 Aspect ratio square image */}
        <div className="card-image-section relative">
          <img 
            key={displayCover}
            src={displayCover} 
            alt={game.name} 
            loading="lazy" 
            className="card-image"
            style={closed ? { filter: 'grayscale(1) brightness(0.5)' } : undefined}
            onError={(e) => { e.target.src = game.image; }}
          />
          <div className="card-image-shine"></div>

          {game.tag && !closed && (
            <span className="absolute top-1.5 left-1.5 z-10 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-purple-600 via-fuchsia-600 to-cyan-500 text-white shadow-md border border-cyan-300/30">
              {game.tag}
            </span>
          )}

          {closed && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 bg-black/55">
              <span className="px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-black uppercase tracking-wider bg-red-600 text-white shadow-lg border border-red-300/40 -rotate-6">
                Out of Stock
              </span>
              <span className="text-[9px] sm:text-[10px] text-red-200 font-bold">ដាច់ស្តុក</span>
            </div>
          )}
        </div>

        {/* Purple-to-Cyan Glowing Nameplate Pill */}
        <div className="card-content-section">
          <div className="game-title" title={game.name}>
            {game.name}
          </div>
        </div>
      </div>
    </div>
  );
}
