import type { FC } from 'react';

// Logo ATLS: empat blok kota (champagne) membentuk persimpangan,
// dengan lampu hijau yang menyala di titik temu jalan.
export const Logo: FC<{ size?: number }> = ({ size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 44 44" role="img" aria-label="Adaptive Traffic Light">
    <defs>
      <radialGradient id="logo-bg" cx="32%" cy="26%" r="80%">
        <stop offset="0" stopColor="#2c2a26" />
        <stop offset="1" stopColor="#11100f" />
      </radialGradient>
      <linearGradient id="logo-gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f3e7cf" />
        <stop offset="0.55" stopColor="#d9c39c" />
        <stop offset="1" stopColor="#a88c5f" />
      </linearGradient>
      <radialGradient id="logo-lamp" cx="40%" cy="35%" r="65%">
        <stop offset="0" stopColor="#e6fff1" />
        <stop offset="0.45" stopColor="#6fe0a8" />
        <stop offset="1" stopColor="#2b9a63" />
      </radialGradient>
    </defs>
    <circle cx="22" cy="22" r="21.5" fill="url(#logo-bg)" />
    <circle cx="22" cy="22" r="21" fill="none" stroke="#dcc7a1" strokeOpacity="0.28" />
    <g fill="url(#logo-gold)">
      <path d="M11 11h6.5a1.5 1.5 0 0 1 1.5 1.5V17a2 2 0 0 1-2 2h-4.5a1.5 1.5 0 0 1-1.5-1.5Z" />
      <path d="M33 11h-6.5a1.5 1.5 0 0 0-1.5 1.5V17a2 2 0 0 0 2 2h4.5a1.5 1.5 0 0 0 1.5-1.5Z" />
      <path d="M11 33h6.5a1.5 1.5 0 0 0 1.5-1.5V27a2 2 0 0 0-2-2h-4.5a1.5 1.5 0 0 0-1.5 1.5Z" />
      <path d="M33 33h-6.5a1.5 1.5 0 0 1-1.5-1.5V27a2 2 0 0 1 2-2h4.5a1.5 1.5 0 0 1 1.5 1.5Z" />
    </g>
    <circle cx="22" cy="22" r="5" fill="#6fe0a8" opacity="0.18" />
    <circle cx="22" cy="22" r="2.6" fill="url(#logo-lamp)" />
  </svg>
);
