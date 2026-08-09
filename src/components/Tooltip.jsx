import React, { useRef, useState } from 'react';

/**
 * Balão de ajuda com o visual do app. O `title` do navegador demora quase um
 * segundo para aparecer e não acompanha o tema.
 */
export default function Tooltip({ label, hint, children, delay = 320, disabled }) {
  const [open, setOpen] = useState(false);
  const timer = useRef(null);

  const show = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setOpen(false);
  };

  return (
    <span
      className="tip-wrap"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={hide}
    >
      {children}
      {open && !disabled ? (
        <span className="tooltip" role="tooltip">
          {label}
          {hint ? <em>{hint}</em> : null}
        </span>
      ) : null}
    </span>
  );
}
