import React, { useState, useEffect } from 'react';
import { getSiteLogo } from '../services/adminSettings';

export default function Footer({ onOpenAdmin }) {
  const [logo, setLogo] = useState(() => getSiteLogo());

  useEffect(() => {
    const handleUpdate = () => setLogo(getSiteLogo());
    window.addEventListener('onelove_settings_updated', handleUpdate);
    return () => window.removeEventListener('onelove_settings_updated', handleUpdate);
  }, []);

  return (
    <footer className="w-full bg-[#0a0216] border-t border-purple-500/20 py-6 px-4 mt-12">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
        
        {/* Brand Copyright */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full overflow-hidden border border-cyan-400/50 shadow-[0_0_8px_rgba(0,240,255,0.3)]">
            <img src={logo} alt="Logo" className="w-full h-full object-cover" onError={(e) => { e.target.src = '/logo.jpg'; }} />
          </div>
          <span className="text-gray-300">
            © {new Date().getFullYear()} <strong className="text-white">ONE LOVE <span className="text-[#00f0ff]">TOPUP</span></strong>. All Rights Reserved.
          </span>
        </div>

        {/* Accepted Payment Rail Badges & Admin Link */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-[#150a26] px-3 py-1.5 rounded-xl border border-purple-500/30">
            <span className="font-semibold text-gray-400 uppercase tracking-wider text-[10px]">Payment:</span>
            <img 
              src="/assets/aba.svg" 
              alt="ABA Bank" 
              className="h-4 object-contain brightness-110"
            />
            <span className="text-gray-600">|</span>
            <img 
              src="/assets/khqr.svg" 
              alt="Bakong KHQR" 
              className="h-4 object-contain brightness-110"
            />
          </div>
        </div>

      </div>
    </footer>
  );
}
