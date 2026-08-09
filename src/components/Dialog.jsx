import React, { useEffect, useRef } from 'react';
import { useStore } from '../store.js';

const ICONS = {
  question: '?',
  warning: '!',
  error: '✕',
  info: 'i',
  success: '✓',
};

/**
 * Caixa de diálogo do app, no lugar da nativa do sistema.
 *
 * Fica montada o tempo todo e só aparece quando há um pedido no store — tanto
 * de dentro do renderer quanto do processo principal, que envia o pedido por
 * IPC e espera a resposta.
 */
export default function DialogHost() {
  const dialog = useStore((s) => s.dialog);
  const answer = useStore((s) => s.answerDialog);
  const toggle = useStore((s) => s.toggleDialogCheckbox);
  const defaultRef = useRef(null);

  const buttons = dialog?.buttons ?? ['OK'];
  const defaultId = dialog?.defaultId ?? 0;
  const cancelId = dialog?.cancelId ?? (buttons.length > 1 ? buttons.length - 1 : -1);

  // o botão padrão recebe o foco, então Enter e Espaço já funcionam
  useEffect(() => {
    if (dialog) defaultRef.current?.focus();
  }, [dialog]);

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && cancelId >= 0) {
        e.preventDefault();
        answer(cancelId);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [dialog, cancelId, answer]);

  if (!dialog) return null;

  const type = dialog.type || 'question';

  return (
    <div
      className="dlg-backdrop"
      onMouseDown={(e) => {
        // clicar fora equivale a cancelar, quando existe um cancelamento
        if (e.target === e.currentTarget && cancelId >= 0) answer(cancelId);
      }}
    >
      <div className="dlg" role="dialog" aria-modal="true" aria-label={dialog.message}>
        <div className="dlg-body">
          <span className={`dlg-icon ${type}`}>{ICONS[type] ?? ICONS.question}</span>
          <div className="dlg-copy">
            {dialog.title ? <h2>{dialog.title}</h2> : null}
            <p className="dlg-msg">{dialog.message}</p>
            {dialog.detail ? <p className="dlg-detail">{dialog.detail}</p> : null}

            {dialog.checkboxLabel ? (
              <label className="dlg-check">
                <input type="checkbox" checked={!!dialog.checkboxChecked} onChange={toggle} />
                <span>{dialog.checkboxLabel}</span>
              </label>
            ) : null}
          </div>
        </div>

        <div className="dlg-actions">
          {buttons.map((label, i) => (
            <button
              key={label + i}
              ref={i === defaultId ? defaultRef : null}
              className={`btn ${
                i === defaultId ? (dialog.danger ? 'danger' : 'primary') : i === cancelId ? 'ghost' : ''
              }`}
              onClick={() => answer(i)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
