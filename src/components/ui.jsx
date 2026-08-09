import React, { useState } from 'react';
import { FONTS, PROFILES } from '../defaults.js';
import { useStore } from '../store.js';

/**
 * Troca o perfil do documento. É um preset: ajusta o que aparece
 * (status, resultado esperado/obtido, resumo, campos) e deixa
 * tipografia, cores, margens e logo exatamente como estão.
 */
export function ProfileSwitch() {
  const profile = useStore((s) => s.project.template.profile);
  const applyProfile = useStore((s) => s.applyProfile);
  const notify = useStore((s) => s.notify);

  const apply = (key) => {
    applyProfile(key);
    notify(`Perfil "${PROFILES[key].label}" aplicado.`, 'ok');
  };

  return (
    <div className="profile-bar" title={PROFILES[profile]?.hint}>
      <span className="pb-label">Perfil</span>
      <div className="ps-btns">
        {Object.entries(PROFILES).map(([key, p]) => (
          <button
            key={key}
            className={`ps-btn ${profile === key ? 'on' : ''}`}
            onClick={() => apply(key)}
            title={p.hint}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Bloco de configurações com título — sem sanfona, tudo já visível. */
export function Group({ title, hint, children }) {
  return (
    <section className="group">
      <header>
        <span className="group-title">{title}</span>
        {hint ? <em className="group-hint">{hint}</em> : null}
      </header>
      <div className="group-body">{children}</div>
    </section>
  );
}

export function Row({ label, hint, children, wide }) {
  return (
    <label className={`row ${wide ? 'wide' : ''}`}>
      <span className="row-lbl">
        {label}
        {hint ? <em className="row-hint">{hint}</em> : null}
      </span>
      <span className="row-ctl">{children}</span>
    </label>
  );
}

export function Section({ title, children, defaultOpen = false, badge, right }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`sect ${open ? 'open' : ''}`}>
      <header onClick={() => setOpen(!open)}>
        <span className="chev">{open ? '▾' : '▸'}</span>
        <span className="sect-title">{title}</span>
        {badge != null ? <span className="sect-badge">{badge}</span> : null}
        {right ? <span onClick={(e) => e.stopPropagation()}>{right}</span> : null}
      </header>
      {open ? <div className="sect-body">{children}</div> : null}
    </section>
  );
}

export const Text = ({ value, onChange, ...p }) => (
  <input className="inp" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...p} />
);

export const Area = ({ value, onChange, rows = 3, ...p }) => (
  <textarea className="inp area" rows={rows} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...p} />
);

export const Num = ({ value, onChange, step = 1, min, max, suffix, ...p }) => (
  <span className="num-wrap">
    <input
      className="inp num"
      type="number"
      value={value ?? 0}
      step={step}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      {...p}
    />
    {suffix ? <em>{suffix}</em> : null}
  </span>
);

export const Color = ({ value, onChange }) => (
  <span className="color-wrap">
    <input type="color" value={value || '#000000'} onChange={(e) => onChange(e.target.value)} />
    <input className="inp hexi" value={value || ''} onChange={(e) => onChange(e.target.value)} />
  </span>
);

export const Select = ({ value, onChange, options }) => (
  <select className="inp" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
    {options.map((o) => {
      const v = typeof o === 'string' ? o : o.value;
      const l = typeof o === 'string' ? o : o.label;
      return (
        <option key={v} value={v}>
          {l}
        </option>
      );
    })}
  </select>
);

export const Check = ({ value, onChange, label }) => (
  <label className="chk">
    <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
    <span>{label}</span>
  </label>
);

/** Editor completo de um estilo de texto (fonte, tamanho, cor, alinhamento, espaçamento). */
export function StyleEditor({ style, onChange }) {
  const set = (k) => (v) => onChange({ ...style, [k]: v });
  return (
    <div className="style-editor">
      <div className="se-line">
        <select className="inp" value={style.family} onChange={(e) => set('family')(e.target.value)}>
          {FONTS.map((f) => (
            <option key={f} value={f} style={{ fontFamily: f }}>
              {f}
            </option>
          ))}
        </select>
        <Num value={style.size} onChange={set('size')} step={0.5} min={5} max={72} suffix="pt" />
        <input type="color" value={style.color} onChange={(e) => set('color')(e.target.value)} title="Cor" />
      </div>

      <div className="se-line">
        <div className="btn-group">
          <button className={style.bold ? 'on' : ''} onClick={() => set('bold')(!style.bold)} title="Negrito">
            <b>N</b>
          </button>
          <button className={style.italic ? 'on' : ''} onClick={() => set('italic')(!style.italic)} title="Itálico">
            <i>I</i>
          </button>
          <button
            className={style.underline ? 'on' : ''}
            onClick={() => set('underline')(!style.underline)}
            title="Sublinhado"
          >
            <u>S</u>
          </button>
        </div>
        <div className="btn-group">
          {[
            ['left', '⯇'],
            ['center', '≡'],
            ['right', '⯈'],
            ['justify', '☰'],
          ].map(([a, ic]) => (
            <button key={a} className={style.align === a ? 'on' : ''} onClick={() => set('align')(a)} title={a}>
              {ic}
            </button>
          ))}
        </div>
      </div>

      <div className="se-line small">
        <span title="Altura da linha">
          ⇕ <Num value={style.lineHeight} onChange={set('lineHeight')} step={0.05} min={0.8} max={3} />
        </span>
        <span title="Espaço antes (pt)">
          ↑ <Num value={style.spaceBefore} onChange={set('spaceBefore')} step={1} min={0} max={80} />
        </span>
        <span title="Espaço depois (pt)">
          ↓ <Num value={style.spaceAfter} onChange={set('spaceAfter')} step={1} min={0} max={80} />
        </span>
      </div>

      <div className="se-preview" style={{
        fontFamily: style.family,
        fontSize: `${style.size}pt`,
        color: style.color,
        fontWeight: style.bold ? 700 : 400,
        fontStyle: style.italic ? 'italic' : 'normal',
        textDecoration: style.underline ? 'underline' : 'none',
        textAlign: style.align,
        lineHeight: style.lineHeight,
      }}>
        Exemplo de texto — 123
      </div>
    </div>
  );
}

/** Botão que abre o seletor de imagem e devolve dataURL (usado para logos). */
export function ImagePicker({ value, onChange, label = 'Escolher imagem' }) {
  const pick = async () => {
    const imgs = await window.api.pickImages();
    if (imgs[0]) onChange(imgs[0]);
  };
  return (
    <span className="img-picker">
      {value ? <img src={value} alt="" /> : <span className="img-empty">sem imagem</span>}
      <button className="btn tiny" onClick={pick}>
        {label}
      </button>
      {value ? (
        <button className="btn tiny ghost" onClick={() => onChange(null)}>
          remover
        </button>
      ) : null}
    </span>
  );
}
