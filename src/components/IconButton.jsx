import React, { useRef, useState } from 'react';

/**
 * Botão só com ícone. O rótulo aparece num balão ao passar o mouse — o
 * `title` do navegador demora quase um segundo e não acompanha o visual
 * do app.
 */
export default function IconButton({
  icon,
  label,
  hint,
  onClick,
  disabled,
  active,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef(null);

  const show = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), 320);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setOpen(false);
  };

  return (
    <span className="tip-wrap" onMouseEnter={show} onMouseLeave={hide}>
      <button
        className={`iconbtn ${active ? 'on' : ''} ${className}`}
        onClick={(e) => {
          hide();
          onClick?.(e);
        }}
        onFocus={show}
        onBlur={hide}
        disabled={disabled}
        aria-label={label}
      >
        {icon}
      </button>

      {open && !disabled ? (
        <span className="tooltip" role="tooltip">
          {label}
          {hint ? <em>{hint}</em> : null}
        </span>
      ) : null}
    </span>
  );
}
