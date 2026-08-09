import React from 'react';
import { STATUS } from '../defaults.js';

export const statusLabel = (k) => STATUS.find((s) => s.key === k)?.label ?? k;

export function formatDate(v) {
  if (!v) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

export function coverValue(template, key) {
  const f = template.coverFields.find((x) => x.key === key);
  if (!f) return '';
  return f.type === 'date' ? formatDate(f.value) : f.value ?? '';
}

/** Substitui {chave}, {p} (página) e {n} (total) em cabeçalho/rodapé. */
export function resolveTokens(text, template, page, total) {
  return String(text ?? '').replace(/\{(\w+)\}/g, (_, key) => {
    if (key === 'p') return String(page);
    if (key === 'n') return String(total);
    return coverValue(template, key);
  });
}

const Field = ({ label, value, stripe }) => (
  <tr className={stripe ? 'stripe' : undefined}>
    <td className="k">{label}</td>
    <td>{value || '—'}</td>
  </tr>
);

/** Linhas visíveis de uma tabela rótulo/valor, já sem os campos vazios se assim configurado. */
export function visibleRows(fields, getValue, hideEmpty) {
  return fields
    .filter((f) => f.show && f.display === 'table')
    .map((f) => ({ f, value: f.type === 'date' ? formatDate(getValue(f)) : getValue(f) }))
    .filter(({ value }) => !hideEmpty || String(value ?? '').trim() !== '');
}

function fieldsTable(fields, getValue, hideEmpty) {
  const rows = visibleRows(fields, getValue, hideEmpty);
  if (!rows.length) return null;
  return (
    <table className="doc-table">
      <tbody>
        {rows.map(({ f, value }, i) => (
          <Field key={f.id} label={f.label} value={value} stripe={i % 2 === 1} />
        ))}
      </tbody>
    </table>
  );
}

function Figure({ template, image, caption, figNumber }) {
  if (!image) return null;
  const f = template.figure;
  return (
    <>
      <div className="fig-wrap">
        <img src={image} alt={caption || 'Evidência'} />
      </div>
      {f.caption && (caption || f.captionPrefix) ? (
        <div className="st-caption">
          {f.captionPrefix ? `${f.captionPrefix} ${figNumber} — ` : ''}
          {caption || 'Evidência do passo'}
        </div>
      ) : null}
    </>
  );
}

function StepBlock({ template, step, index, figNumber }) {
  const st = template.step;
  const color = template.statusColors[step.status] || '#6b7684';
  const title = st.numbered ? `${st.stepLabel} ${index}` : st.stepLabel;

  const textRow = (label, value) =>
    value ? (
      <div key={label} className="step-block">
        <div className="lbl">{label}</div>
        <div className="st-body">{value}</div>
      </div>
    ) : null;

  if (st.layout === 'table') {
    const hide = template.hideEmptyFields;
    const rows = [
      st.showDescription && (!hide || step.description) && [st.labels.description, step.description || '—'],
      st.showExpected && (!hide || step.expected) && [st.labels.expected, step.expected || '—'],
      st.showObtained && (!hide || step.obtained) && [st.labels.obtained, step.obtained || '—'],
    ].filter(Boolean);

    return (
      <div className="blk step-block">
        <div className="st-h3">{title}</div>
        {rows.length || st.showStatus ? (
          <table className="doc-table">
            <tbody>
              {rows.map(([k, v], i) => (
                <tr key={k} className={i % 2 === 1 ? 'stripe' : undefined}>
                  <td className="k">{k}</td>
                  <td>{v}</td>
                </tr>
              ))}
              {st.showStatus && (
                <tr className={rows.length % 2 === 1 ? 'stripe' : undefined}>
                  <td className="k">{st.labels.status}</td>
                  <td>
                    <span className="badge" style={{ background: color }}>
                      {statusLabel(step.status)}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : null}
        <Figure template={template} image={step.image} caption={step.caption} figNumber={figNumber} />
      </div>
    );
  }

  return (
    <div className="blk step-block">
      <div className="st-h3">
        {title}
        {st.showStatus ? (
          <span className="badge" style={{ background: color, marginLeft: '8pt' }}>
            {statusLabel(step.status)}
          </span>
        ) : null}
      </div>
      {st.showDescription ? textRow(st.labels.description, step.description) : null}
      <Figure template={template} image={step.image} caption={step.caption} figNumber={figNumber} />
      {st.showExpected ? textRow(st.labels.expected, step.expected) : null}
      {st.showObtained ? textRow(st.labels.obtained, step.obtained) : null}
    </div>
  );
}

function SummaryBlock({ project }) {
  const t = project.template;
  const total = project.cases.length || 1;
  const counts = { passou: 0, falhou: 0, bloqueado: 0, nao_executado: 0 };
  for (const c of project.cases) counts[c.status] = (counts[c.status] || 0) + 1;
  const pct = (n) => Math.round((n / total) * 100);

  return (
    <div className="blk">
      <div className="st-h1">{t.sections.summary.title}</div>
      <table className="doc-table">
        <thead>
          <tr>
            <th style={{ width: '55%' }}>Resultado</th>
            <th style={{ width: '22%' }}>Casos</th>
            <th style={{ width: '23%' }}>%</th>
          </tr>
        </thead>
        <tbody>
          {STATUS.map((s, i) => (
            <tr key={s.key} className={i % 2 === 1 ? 'stripe' : undefined}>
              <td>
                <span className="badge" style={{ background: t.statusColors[s.key] }}>
                  {s.label}
                </span>
              </td>
              <td>{counts[s.key] || 0}</td>
              <td>{pct(counts[s.key] || 0)}%</td>
            </tr>
          ))}
          <tr>
            <td style={{ fontWeight: 700 }}>Total</td>
            <td style={{ fontWeight: 700 }}>{project.cases.length}</td>
            <td style={{ fontWeight: 700 }}>100%</td>
          </tr>
        </tbody>
      </table>

      {t.sections.summary.showChartBar
        ? STATUS.map((s) => (
            <div className="chart-row" key={s.key}>
              <div className="chart-lbl">{s.label}</div>
              <div className="chart-track">
                <div
                  className="chart-fill"
                  style={{ width: `${pct(counts[s.key] || 0)}%`, background: t.statusColors[s.key] }}
                />
              </div>
              <div className="chart-val">{counts[s.key] || 0}</div>
            </div>
          ))
        : null}
    </div>
  );
}

function CaseIndexBlock({ project }) {
  const t = project.template;
  const withStatus = t.sections.showCaseStatus;
  return (
    <div className="blk">
      <div className="st-h1">{t.sections.caseIndex.title}</div>
      <table className="doc-table">
        <thead>
          <tr>
            <th style={{ width: '18%' }}>ID</th>
            <th style={{ width: withStatus ? '57%' : '82%' }}>Título</th>
            {withStatus ? <th style={{ width: '25%' }}>Status</th> : null}
          </tr>
        </thead>
        <tbody>
          {project.cases.map((c, i) => (
            <tr key={c.id} className={i % 2 === 1 ? 'stripe' : undefined}>
              <td>{c.values.codigo || `CT-${String(i + 1).padStart(3, '0')}`}</td>
              <td>{c.values.titulo || '—'}</td>
              {withStatus ? (
                <td>
                  <span className="badge" style={{ background: t.statusColors[c.status] }}>
                    {statusLabel(c.status)}
                  </span>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Monta a lista de blocos do documento (a capa vem separada). */
export function buildBlocks(project) {
  const t = project.template;
  const blocks = [];
  const push = (node, opts = {}) => blocks.push({ id: `b${blocks.length}`, node, ...opts });

  if (t.sections.intro.enabled && (t.sections.intro.text || '').trim()) {
    push(
      <div className="blk">
        <div className="st-h1">{t.sections.intro.title}</div>
        <div className="st-body">{t.sections.intro.text}</div>
      </div>,
    );
  }

  if (t.sections.caseIndex.enabled) push(<CaseIndexBlock project={project} />);

  if (t.sections.summary.enabled && t.sections.summary.position === 'start')
    push(<SummaryBlock project={project} />);

  let figNumber = 0;

  project.cases.forEach((c, ci) => {
    const titleFields = t.caseFields.filter((f) => f.show && f.display === 'title');
    const heading = titleFields.map((f) => c.values[f.key]).filter(Boolean).join(' — ') ||
      `Caso de teste ${ci + 1}`;

    push(
      <div className="blk">
        <div className="st-h1">
          {heading}
          {t.sections.showCaseStatus ? (
            <span className="badge" style={{ background: t.statusColors[c.status], marginLeft: '8pt' }}>
              {statusLabel(c.status)}
            </span>
          ) : null}
        </div>
        {fieldsTable(t.caseFields, (f) => c.values[f.key], t.hideEmptyFields)}
      </div>,
      { pageBreakBefore: ci > 0 && t.sections.caseOnNewPage },
    );

    c.steps.forEach((s, si) => {
      if (s.image) figNumber += 1;
      push(<StepBlock template={t} step={s} index={si + 1} figNumber={figNumber} />);
    });
  });

  if (t.sections.summary.enabled && t.sections.summary.position === 'end')
    push(<SummaryBlock project={project} />);

  if (t.sections.signatures.enabled) {
    push(
      <div className="blk">
        <div className="st-h1">{t.sections.signatures.title}</div>
        <div className="sig-grid">
          {t.sections.signatures.lines.map((l) => (
            <div className="sig" key={l.id}>
              <div className="line" />
              <div className="st-body" style={{ textAlign: 'center', margin: 0 }}>
                {l.name || ' '}
              </div>
              <div className="st-caption" style={{ margin: 0 }}>
                {l.role}
              </div>
            </div>
          ))}
        </div>
      </div>,
    );
  }

  return blocks;
}

/** Conteúdo da capa (renderizado em página própria). */
export function CoverContent({ template }) {
  const cv = template.cover;
  const titleField = template.coverFields.find((f) => f.show && f.display === 'title');
  const subField = template.coverFields.find((f) => f.show && f.display === 'subtitle');
  const hasRows = visibleRows(template.coverFields, (f) => f.value, template.hideEmptyFields).length > 0;

  return (
    <>
      {cv.logo ? <img className="cover-logo" src={cv.logo} alt="Logo" /> : null}
      <div className="st-docTitle">{titleField?.value || 'Documento de Testes Manuais'}</div>
      {cv.showRule ? <hr className="rule" /> : null}
      {subField?.value ? <div className="st-subtitle">{subField.value}</div> : null}
      {hasRows ? (
        <div className="cover-box">
          {fieldsTable(template.coverFields, (f) => f.value, template.hideEmptyFields)}
        </div>
      ) : null}
    </>
  );
}
