import React, { useEffect, useState } from 'react';

/**
 * Botões de minimizar / maximizar / fechar.
 *
 * A janela é frameless, então estes botões são a única forma de controlá-la —
 * por isso o componente também é usado na tela de erro, onde o resto da
 * interface não existe mais.
 */
export default function WindowControls() {
  const [max, setMax] = useState(false);

  useEffect(() => {
    window.api.winIsMaximized().then(setMax);
    return window.api.onWinMaximized(setMax);
  }, []);

  return (
    <div className="win-ctl">
      <button className="wc" title="Minimizar" onClick={() => window.api.winMinimize()}>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <rect x="0" y="4.5" width="10" height="1" fill="currentColor" />
        </svg>
      </button>

      <button
        className="wc"
        title={max ? 'Restaurar' : 'Maximizar'}
        onClick={() => window.api.winToggleMaximize()}
      >
        {max ? (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <rect x="0.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" />
            <path d="M2.5 2.5V0.5H9.5V7.5H7.5" fill="none" stroke="currentColor" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" />
          </svg>
        )}
      </button>

      <button className="wc close" title="Fechar" onClick={() => window.api.winClose()}>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M0.5 0.5L9.5 9.5M9.5 0.5L0.5 9.5" stroke="currentColor" fill="none" />
        </svg>
      </button>
    </div>
  );
}
