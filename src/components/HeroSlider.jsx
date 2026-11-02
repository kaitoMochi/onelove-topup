import React from 'react';

export default function HeroSlider() {
  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 mt-3 mb-4">
      <div className="relative w-full overflow-hidden rounded-2xl sm:rounded-3xl shadow-[0_10px_35px_rgba(0,0,0,0.8),0_0_20px_rgba(124,58,237,0.25)] border border-purple-500/30 hover:border-cyan-400/50 transition-all duration-500 group bg-[#0d031c]">
        <img 
          src="/banner.jpg" 
          alt="ONE LOVE TOPUP Special Banner" 
          className="w-full h-auto object-cover max-h-[380px] sm:max-h-[440px] transition-transform duration-700 group-hover:scale-[1.01]"
        />
        {/* Subtle decorative glow */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0318]/50 via-transparent to-transparent pointer-events-none"></div>
      </div>
    </div>
  );
}
