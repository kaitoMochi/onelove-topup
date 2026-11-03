import React, { useState, useEffect } from 'react';
import { getGameAsset } from '../services/adminSettings';

export default function ProductCard({ game, onSelect }) {
  const [displayCover, setDisplayCover] = useState(() => getGameAsset(game.id, 'cover', game.image));

  useEffect(() => {
    const handleUpdate = () => {
      setDisplayCover(getGameAsset(game.id, 'cover', game.image));
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
            onError={(e) => { e.target.src = game.image; }}
          />
          <div className="card-image-shine"></div>

          {game.tag && (
            <span className="absolute top-1.5 left-1.5 z-10 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-purple-600 via-fuchsia-600 to-cyan-500 text-white shadow-md border border-cyan-300/30">
              {game.tag}
            </span>
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
