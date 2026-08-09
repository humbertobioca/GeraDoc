import React, { useEffect, useRef, useState } from 'react';
import {
  IconMenu,
  IconNew,
  IconOpen,
  IconPdf,
  IconSave,
  IconSaveAs,
  IconUpdate,
  IconWord,
} from './Icons.jsx';

/**
 * Menu principal. Guarda os comandos com nome por extenso e atalho, deixando
 * o cabeçalho só com os ícones do que se usa o tempo todo.
 */
export default function AppMenu({ actions, filePath, exporting }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = (fn) => () => {
    setOpen(false);
    fn?.();
  };

  const Item = ({ icon, children, shortcut, onSelect, disabled, note }) => (
    <button className="menu-item" onClick={run(onSelect)} disabled={disabled}>
      <span className="mi-icon">{icon}</span>
      <span className="mi-label">
        {children}
        {note ? <em>{note}</em> : null}
      </span>
      {shortcut ? <kbd>{shortcut}</kbd> : null}
    </button>
  );

  return (
    <div className="menu-wrap" ref={ref}>
      <button
        className={`iconbtn menu-btn ${open ? 'on' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu"
      >
        <IconMenu size={19} />
      </button>

      {open ? (
        <div className="menu" role="menu">
          <div className="menu-group">Documento</div>
          <Item icon={<IconNew />} shortcut="Ctrl+N" onSelect={actions.novo}>
            Novo
          </Item>
          <Item icon={<IconOpen />} shortcut="Ctrl+O" onSelect={actions.abrir}>
            Abrir…
          </Item>

          <div className="menu-sep" />
          <div className="menu-group">Salvar</div>
          <Item
            icon={<IconSave />}
            shortcut="Ctrl+S"
            onSelect={actions.salvar}
            note={filePath ? filePath.split(/[\\/]/).pop() : 'ainda sem arquivo'}
          >
            Salvar
          </Item>
          <Item icon={<IconSaveAs />} shortcut="Ctrl+Shift+S" onSelect={actions.salvarComo}>
            Salvar como…
          </Item>

          <div className="menu-sep" />
          <div className="menu-group">Exportar</div>
          <Item
            icon={<IconWord />}
            onSelect={actions.exportarWord}
            disabled={!!exporting}
            note="documento editável"
          >
            {exporting === 'docx' ? 'Gerando Word…' : 'Word (.docx)'}
          </Item>
          <Item
            icon={<IconPdf />}
            onSelect={actions.exportarPdf}
            disabled={!!exporting}
            note="igual ao preview"
          >
            {exporting === 'pdf' ? 'Gerando PDF…' : 'PDF (.pdf)'}
          </Item>

          <div className="menu-sep" />
          <Item icon={<IconUpdate />} onSelect={actions.procurarAtualizacao}>
            Procurar atualizações
          </Item>
        </div>
      ) : null}
    </div>
  );
}
