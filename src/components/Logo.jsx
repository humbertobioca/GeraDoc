import React from 'react';

/** Mesmo desenho de build/icon.svg, usado na barra de título. */
export default function Logo({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" className="app-logo">
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4c8dff" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#logo-bg)" />
      <rect x="120" y="88" width="272" height="336" rx="28" fill="#ffffff" />
      <rect x="160" y="140" width="192" height="22" rx="11" fill="#b9c9e0" />
      <rect x="160" y="182" width="130" height="22" rx="11" fill="#d5e0ee" />
      <rect x="160" y="234" width="192" height="140" rx="14" fill="#e9f0fa" />
      <rect x="188" y="262" width="136" height="84" rx="10" fill="none" stroke="#e02424" strokeWidth="22" />
    </svg>
  );
}
