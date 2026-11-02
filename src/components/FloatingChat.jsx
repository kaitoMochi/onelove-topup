import React from 'react';

export default function FloatingChat() {
  return (
    <a
      href="https://t.me/onelovetopup"
      target="_blank"
      rel="noopener noreferrer"
      className="chat-button group"
      aria-label="Contact Customer Support on Telegram"
    >
      <span className="tracking-wide">ត្រូវការជំនួយ ?</span>
      <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
        <i className="fab fa-telegram-plane text-base"></i>
      </div>
    </a>
  );
}

