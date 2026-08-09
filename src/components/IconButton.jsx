import React from 'react';
import Tooltip from './Tooltip.jsx';

/** Botão só com ícone; o rótulo aparece num balão ao passar o mouse. */
export default function IconButton({ icon, label, hint, onClick, disabled, active, className = '' }) {
  return (
    <Tooltip label={label} hint={hint} disabled={disabled}>
      <button
        className={`iconbtn ${active ? 'on' : ''} ${className}`}
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
      >
        {icon}
      </button>
    </Tooltip>
  );
}
