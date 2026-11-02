import React from 'react';

export default function Navbar({ currency, setCurrency, onOpenAdmin }) {
  return (
    <header className="sticky top-0 z-50">
      <nav
        className="w-full py-2.5 px-3 sm:px-6 flex items-center justify-between border-b border-cyan-500/20 backdrop-blur-md"
        style={{
          background: 'linear-gradient(135deg, rgba(17, 6, 36, 0.95) 0%, rgba(29, 10, 58, 0.95) 50%, rgba(13, 4, 28, 0.95) 100%)',
          boxShadow: '0 4px 25px rgba(0, 0, 0, 0.7), 0 0 15px rgba(0, 240, 255, 0.1)'
        }}
      >
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          {/* Logo & Brand Name */}
          <a href="/" className="flex items-center gap-2.5 sm:gap-3 group">
            <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full p-0.5 bg-gradient-to-tr from-purple-600 via-cyan-400 to-fuchsia-500 shadow-md overflow-hidden flex items-center justify-center group-hover:shadow-[0_0_15px_rgba(0,240,255,0.6)] transition-all">
              <img
                src="/logo.jpg"
                alt="ONE LOVE TOPUP"
                className="w-full h-full object-cover rounded-full group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-white font-extrabold text-base sm:text-lg tracking-wide font-['Poppins'] leading-tight drop-shadow">
                ONE LOVE <span className="text-[#00f0ff] drop-shadow-[0_0_8px_rgba(0,240,255,0.6)]">TOPUP</span>
              </span>
              <span className="text-cyan-200/80 text-[10px] sm:text-xs font-medium tracking-tight -mt-0.5">
                Official Fast Gaming Store
              </span>
            </div>
          </a>

          {/* Right Section: Currency + Telegram Button + Admin Button */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Currency selector pill */}
            <div className="flex items-center bg-[#1a0c33] rounded-full p-0.5 border border-purple-500/30 text-xs shadow-inner">
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`px-2.5 py-1 rounded-full font-bold transition-all text-[11px] sm:text-xs ${
                  currency === 'USD'
                    ? 'bg-[#00f0ff] text-[#0a0316] shadow-[0_0_10px_rgba(0,240,255,0.5)]'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                USD ($)
              </button>
              <button
                type="button"
                onClick={() => setCurrency('KHR')}
                className={`px-2.5 py-1 rounded-full font-bold transition-all text-[11px] sm:text-xs ${
                  currency === 'KHR'
                    ? 'bg-[#00f0ff] text-[#0a0316] shadow-[0_0_10px_rgba(0,240,255,0.5)]'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                KHR (៛)
              </button>
            </div>

            {/* Telegram Channel / Community */}
            <a
              href="https://t.me/+ZObn61iNEVM3ZGU1"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-sky-500 to-[#0088cc] hover:from-sky-400 hover:to-cyan-500 text-white font-semibold text-xs transition-all shadow-[0_0_12px_rgba(0,136,204,0.4)] active:scale-95 border border-cyan-400/30"
            >
              <i className="fab fa-telegram text-sm"></i>
              <span>Telegram</span>
            </a>
          </div>
        </div>
      </nav>
    </header>
  );
}
