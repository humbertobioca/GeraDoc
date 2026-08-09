import React, { useCallback, useEffect, useRef, useState } from 'react';

const TOOLS = [
  { key: 'rect', label: 'Retângulo', icon: '▭' },
  { key: 'ellipse', label: 'Elipse', icon: '◯' },
  { key: 'arrow', label: 'Seta', icon: '↗' },
  { key: 'line', label: 'Linha', icon: '／' },
  { key: 'pen', label: 'Caneta livre', icon: '✎' },
  { key: 'text', label: 'Texto', icon: 'T' },
  { key: 'highlight', label: 'Marca-texto', icon: '▬' },
  { key: 'pixelate', label: 'Borrar (dados sensíveis)', icon: '▩' },
  { key: 'crop', label: 'Recortar', icon: '⧉' },
];

const COLORS = ['#e02424', '#f59e0b', '#16a34a', '#2563eb', '#9333ea', '#111827', '#ffffff'];
const WIDTHS = [2, 3, 5, 8];

function drawArrow(ctx, x1, y1, x2, y2, w) {
  const head = Math.max(10, w * 4);
  const ang = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(ang - Math.PI / 7), y2 - head * Math.sin(ang - Math.PI / 7));
  ctx.lineTo(x2 - head * Math.cos(ang + Math.PI / 7), y2 - head * Math.sin(ang + Math.PI / 7));
  ctx.closePath();
  ctx.fill();
}

function pixelate(ctx, img, x, y, w, h) {
  if (w < 2 || h < 2) return;
  const block = Math.max(4, Math.round(Math.min(w, h) / 9));
  const sw = Math.max(1, Math.round(w / block));
  const sh = Math.max(1, Math.round(h / block));
  const off = document.createElement('canvas');
  off.width = sw;
  off.height = sh;
  const octx = off.getContext('2d');
  octx.imageSmoothingEnabled = true;
  octx.drawImage(img, x, y, w, h, 0, 0, sw, sh);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, 0, 0, sw, sh, x, y, w, h);
  ctx.restore();
}

const norm = (s) => ({
  x: Math.min(s.x1, s.x2),
  y: Math.min(s.y1, s.y2),
  w: Math.abs(s.x2 - s.x1),
  h: Math.abs(s.y2 - s.y1),
});

/** Pinta a imagem base + a lista de formas em qualquer contexto 2D. */
function paint(ctx, img, list) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(img, 0, 0);

  for (const s of list) {
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (s.type === 'rect') {
      const r = norm(s);
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    } else if (s.type === 'ellipse') {
      const r = norm(s);
      ctx.beginPath();
      ctx.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (s.type === 'arrow') {
      drawArrow(ctx, s.x1, s.y1, s.x2, s.y2, s.width);
    } else if (s.type === 'line') {
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    } else if (s.type === 'pen') {
      ctx.beginPath();
      s.points.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.stroke();
    } else if (s.type === 'highlight') {
      const r = norm(s);
      ctx.globalAlpha = 0.32;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    } else if (s.type === 'pixelate') {
      const r = norm(s);
      pixelate(ctx, img, r.x, r.y, r.w, r.h);
    } else if (s.type === 'crop') {
      const r = norm(s);
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, ctx.canvas.width, r.y);
      ctx.fillRect(0, r.y + r.h, ctx.canvas.width, ctx.canvas.height - r.y - r.h);
      ctx.fillRect(0, r.y, r.x, r.h);
      ctx.fillRect(r.x + r.w, r.y, ctx.canvas.width - r.x - r.w, r.h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#4da3ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    } else if (s.type === 'text') {
      ctx.font = `700 ${s.fontSize}px "Segoe UI", Arial, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.lineWidth = Math.max(3, s.fontSize / 7);
      ctx.strokeStyle = 'rgba(255,255,255,.85)';
      s.text.split('\n').forEach((line, i) => {
        const y = s.y1 + i * s.fontSize * 1.25;
        ctx.strokeText(line, s.x1, y);
        ctx.fillText(line, s.x1, y);
      });
    }
    ctx.restore();
  }
}

/** Achata base + formas num canvas novo (sem overlays de edição). */
function flatten(img, list, crop) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  paint(c.getContext('2d'), img, list);
  if (!crop) return c;

  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(crop.w));
  out.height = Math.max(1, Math.round(crop.h));
  out
    .getContext('2d')
    .drawImage(c, Math.round(crop.x), Math.round(crop.y), out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

export default function Annotator({ image, onCancel, onConfirm, title = 'Editar captura' }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const baseRef = useRef(null); // HTMLImageElement (fonte atual, já com crops aplicados)

  const [ready, setReady] = useState(false);
  const [tool, setTool] = useState('rect');
  const [color, setColor] = useState('#e02424');
  const [width, setWidth] = useState(3);
  const [fontSize, setFontSize] = useState(22);
  const [shapes, setShapes] = useState([]);
  const [draft, setDraft] = useState(null);
  const [textInput, setTextInput] = useState(null); // {x, y, value}
  const [scale, setScale] = useState(1);
  const [caption, setCaption] = useState('');

  // ---- carrega a imagem base
  const loadBase = useCallback((src) => {
    const img = new Image();
    img.onload = () => {
      baseRef.current = img;
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
      }
      fit();
      setReady(true);
    };
    img.src = src;
  }, []);

  const fit = useCallback(() => {
    const img = baseRef.current;
    const wrap = wrapRef.current;
    if (!img || !wrap) return;
    const maxW = wrap.clientWidth - 24;
    const maxH = wrap.clientHeight - 24;
    setScale(Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight));
  }, []);

  useEffect(() => {
    loadBase(image);
  }, [image, loadBase]);

  useEffect(() => {
    const onResize = () => fit();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [fit]);

  // ---- redesenha tudo
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = baseRef.current;
    if (!canvas || !img) return;
    paint(canvas.getContext('2d'), img, draft ? [...shapes, draft] : shapes);
  }, [shapes, draft]);

  useEffect(() => {
    if (ready) redraw();
  }, [ready, redraw]);

  // ---- interação
  const toImg = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / scale,
      y: (e.clientY - r.top) / scale,
    };
  };

  const onDown = (e) => {
    if (e.button !== 0 || textInput) return;
    const p = toImg(e);

    if (tool === 'text') {
      setTextInput({ x: p.x, y: p.y, value: '' });
      return;
    }
    const base = { type: tool, color, width, fontSize, x1: p.x, y1: p.y, x2: p.x, y2: p.y };
    setDraft(tool === 'pen' ? { ...base, points: [[p.x, p.y]] } : base);
  };

  const onMove = (e) => {
    if (!draft) return;
    const p = toImg(e);
    setDraft((d) =>
      d.type === 'pen'
        ? { ...d, points: [...d.points, [p.x, p.y]] }
        : { ...d, x2: p.x, y2: p.y },
    );
  };

  const onUp = () => {
    if (!draft) return;
    const d = draft;
    setDraft(null);

    if (d.type === 'crop') {
      const r = norm(d);
      if (r.w < 8 || r.h < 8) return;
      applyCrop(r);
      return;
    }
    const tiny =
      d.type !== 'pen' && Math.abs(d.x2 - d.x1) < 4 && Math.abs(d.y2 - d.y1) < 4;
    if (tiny) return;
    setShapes((s) => [...s, d]);
  };

  /** Achata o que já foi desenhado, recorta, e a área vira a nova imagem base. */
  function applyCrop(r) {
    const out = flatten(baseRef.current, shapes, r);
    setShapes([]);
    setReady(false);
    loadBase(out.toDataURL('image/png'));
  }

  const commitText = () => {
    if (textInput && textInput.value.trim()) {
      setShapes((s) => [
        ...s,
        {
          type: 'text',
          color,
          width,
          fontSize,
          x1: textInput.x,
          y1: textInput.y,
          text: textInput.value,
        },
      ]);
    }
    setTextInput(null);
  };

  const undo = () => setShapes((s) => s.slice(0, -1));

  const confirm = () => {
    if (!baseRef.current) return;
    // exporta do canvas achatado — nunca do preview (que pode ter overlay de recorte)
    const out = flatten(baseRef.current, shapes);
    onConfirm(out.toDataURL('image/png'), caption.trim());
  };

  useEffect(() => {
    const onKey = (e) => {
      if (textInput) return;
      if (e.key === 'Escape') onCancel();
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) confirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const cursor = tool === 'text' ? 'text' : 'crosshair';

  return (
    <div className="modal-backdrop">
      <div className="annot">
        <div className="annot-head">
          <strong>{title}</strong>
          <span className="hint-sm">
            Ctrl+Z desfaz · Ctrl+Enter confirma · Esc cancela
          </span>
        </div>

        <div className="annot-tools">
          {TOOLS.map((t) => (
            <button
              key={t.key}
              className={`tool ${tool === t.key ? 'on' : ''}`}
              title={t.label}
              onClick={() => setTool(t.key)}
            >
              <span className="tool-ic">{t.icon}</span>
            </button>
          ))}
          <span className="sep" />
          {COLORS.map((c) => (
            <button
              key={c}
              className={`swatch ${color === c ? 'on' : ''}`}
              style={{ background: c }}
              title={c}
              onClick={() => setColor(c)}
            />
          ))}
          <span className="sep" />
          {WIDTHS.map((w) => (
            <button key={w} className={`tool ${width === w ? 'on' : ''}`} onClick={() => setWidth(w)}>
              <span style={{ display: 'inline-block', width: 16, height: w, background: 'currentColor', borderRadius: 4 }} />
            </button>
          ))}
          {tool === 'text' && (
            <>
              <span className="sep" />
              <input
                type="range" min="12" max="72" value={fontSize}
                onChange={(e) => setFontSize(+e.target.value)}
                title={`Tamanho do texto: ${fontSize}px`}
              />
            </>
          )}
          <span className="sep" />
          <button className="tool" onClick={undo} title="Desfazer (Ctrl+Z)">↶</button>
          <button className="tool" onClick={() => setShapes([])} title="Limpar marcações">✕</button>
        </div>

        <div className="annot-canvas-wrap" ref={wrapRef}>
          <div className="annot-canvas-inner" style={{ position: 'relative' }}>
            <canvas
              ref={canvasRef}
              style={{
                width: baseRef.current ? baseRef.current.naturalWidth * scale : 'auto',
                height: baseRef.current ? baseRef.current.naturalHeight * scale : 'auto',
                cursor,
              }}
              onMouseDown={onDown}
              onMouseMove={onMove}
              onMouseUp={onUp}
              onMouseLeave={onUp}
            />
            {textInput && (
              <textarea
                autoFocus
                className="annot-text-input"
                style={{
                  left: textInput.x * scale,
                  top: textInput.y * scale,
                  fontSize: fontSize * scale,
                  color,
                }}
                value={textInput.value}
                onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
                onBlur={commitText}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText(); }
                  if (e.key === 'Escape') { e.preventDefault(); setTextInput(null); }
                }}
              />
            )}
          </div>
        </div>

        <div className="annot-foot">
          <input
            className="inp"
            placeholder="Legenda da imagem (opcional) — aparece embaixo da figura no documento"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <button className="btn ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn primary" onClick={confirm}>Inserir no documento</button>
        </div>
      </div>
    </div>
  );
}
