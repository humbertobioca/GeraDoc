import React from 'react';

/**
 * Ícones de traço, desenhados na mesma grade de 24px para ficarem com peso
 * visual igual. `currentColor` deixa a cor a cargo do CSS.
 */
const Svg = ({ children, size = 17 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const IconMenu = (p) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);

export const IconNew = (p) => (
  <Svg {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
    <path d="M14 3v6h5" />
    <path d="M12 12v5M9.5 14.5h5" />
  </Svg>
);

export const IconOpen = (p) => (
  <Svg {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h6a2 2 0 0 1 2 2V10" />
    <path d="M3 9h17.2a1 1 0 0 1 .96 1.27l-2 7A1 1 0 0 1 18.2 18H5a2 2 0 0 1-2-2z" />
  </Svg>
);

export const IconSave = (p) => (
  <Svg {...p}>
    <path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    <path d="M7 3v6h8V3" />
    <path d="M7 14h10v7H7z" />
  </Svg>
);

export const IconSaveAs = (p) => (
  <Svg {...p}>
    <path d="M5 3h9l2.5 2.5V11" />
    <path d="M3 5a2 2 0 0 1 2-2v0" />
    <path d="M3 5v14a2 2 0 0 0 2 2h6" />
    <path d="M7 3v5h6" />
    <path d="M20.5 13.5a1.8 1.8 0 0 1 0 2.5L16 20.5l-3 .6.6-3 4.4-4.5a1.8 1.8 0 0 1 2.5 0z" />
  </Svg>
);

export const IconCapture = (p) => (
  <Svg {...p}>
    <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const IconWord = (p) => (
  <Svg {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="m8.4 12 1.3 5 1.3-3.4 1.3 3.4 1.3-5" />
  </Svg>
);

export const IconPdf = (p) => (
  <Svg {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M9 17v-5h1.6a1.5 1.5 0 0 1 0 3H9" />
    <path d="M13.5 17v-5H15a2.5 2.5 0 0 1 0 5z" />
  </Svg>
);

export const IconExport = (p) => (
  <Svg {...p}>
    <path d="M12 3v11" />
    <path d="m8 10.5 4 4 4-4" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </Svg>
);

export const IconUpdate = (p) => (
  <Svg {...p}>
    <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" />
    <path d="M20.7 4.5V10h-5.5" />
  </Svg>
);

export const IconUndo = (p) => (
  <Svg {...p}>
    <path d="M4 8h9a5.5 5.5 0 0 1 0 11H8" />
    <path d="M7.5 4.5 4 8l3.5 3.5" />
  </Svg>
);

export const IconRedo = (p) => (
  <Svg {...p}>
    <path d="M20 8h-9a5.5 5.5 0 0 0 0 11h5" />
    <path d="M16.5 4.5 20 8l-3.5 3.5" />
  </Svg>
);

export const IconCheck = (p) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Svg>
);
