import React from 'react';
import { useStore, selectActiveCase } from '../store.js';
import { STATUS } from '../defaults.js';
import { Area, Row, Section, Select, Text } from './ui.jsx';

function DynField({ field, value, onChange }) {
  if (field.type === 'textarea') return <Area value={value} onChange={onChange} rows={2} />;
  if (field.type === 'date') return <input className="inp" type="date" value={value || ''} onChange={(e) => onChange(e.target.value)} />;
  if (field.type === 'select')
    return <Select value={value} onChange={onChange} options={['', ...(field.options || [])]} />;
  return <Text value={value} onChange={onChange} />;
}

function StatusPicker({ value, onChange, template }) {
  return (
    <div className="status-picker">
      {STATUS.map((s) => (
        <button
          key={s.key}
          className={`st-btn ${value === s.key ? 'on' : ''}`}
          style={
            value === s.key
              ? { background: template.statusColors[s.key], borderColor: template.statusColors[s.key] }
              : { borderColor: template.statusColors[s.key], color: template.statusColors[s.key] }
          }
          onClick={() => onChange(s.key)}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

function StepCard({ caseId, step, index, total, onCapture, onEditImage }) {
  const template = useStore((s) => s.project.template);
  const updateStep = useStore((s) => s.updateStep);
  const removeStep = useStore((s) => s.removeStep);
  const moveStep = useStore((s) => s.moveStep);
  const duplicateStep = useStore((s) => s.duplicateStep);
  const st = template.step;

  const setImageFromFiles = async (files) => {
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      const url = await new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.readAsDataURL(f);
      });
      updateStep(caseId, step.id, { image: url }, true);
      return;
    }
  };

  return (
    <div className="step-card">
      <div className="step-head">
        <span className="step-num" style={st.showStatus ? { background: template.statusColors[step.status] } : undefined}>
          {index}
        </span>
        <strong>{st.numbered ? `${st.stepLabel} ${index}` : st.stepLabel}</strong>
        <span className="spacer" />
        <button className="ico" title="Mover para cima" disabled={index === 1} onClick={() => moveStep(caseId, step.id, -1)}>↑</button>
        <button className="ico" title="Mover para baixo" disabled={index === total} onClick={() => moveStep(caseId, step.id, 1)}>↓</button>
        <button className="ico" title="Duplicar passo" onClick={() => duplicateStep(caseId, step.id)}>⧉</button>
        <button className="ico danger" title="Excluir passo" onClick={() => removeStep(caseId, step.id)}>✕</button>
      </div>

      {st.showDescription && (
        <Row label={st.labels.description} wide>
          <Area
            value={step.description}
            rows={2}
            placeholder="Descreva a ação executada neste passo…"
            onChange={(v) => updateStep(caseId, step.id, { description: v })}
          />
        </Row>
      )}

      <div
        className={`drop-zone ${step.image ? 'has' : ''}`}
        tabIndex={0}
        onPaste={(e) => {
          const it = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
          if (!it) return;
          e.preventDefault();
          e.stopPropagation();
          setImageFromFiles([it.getAsFile()]);
        }}
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('over'); }}
        onDragLeave={(e) => e.currentTarget.classList.remove('over')}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.classList.remove('over');
          setImageFromFiles([...e.dataTransfer.files]);
        }}
      >
        {step.image ? (
          <>
            <img
              src={step.image}
              alt=""
              title="Clique para editar as marcações"
              onClick={() => onEditImage({ caseId, stepId: step.id }, step.image)}
            />
            <div className="dz-actions">
              <button className="btn tiny" onClick={() => onEditImage({ caseId, stepId: step.id }, step.image)}>
                ✎ Marcações
              </button>
              <button className="btn tiny" onClick={() => onCapture({ caseId, stepId: step.id })}>
                ⛶ Recapturar
              </button>
              <button className="btn tiny ghost" onClick={() => updateStep(caseId, step.id, { image: null }, true)}>
                Remover
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="dz-icon">⛶</span>
            <p>
              Cole com <b>Ctrl+V</b>, arraste um arquivo aqui, ou
            </p>
            <button className="btn tiny primary" onClick={() => onCapture({ caseId, stepId: step.id })}>
              Capturar tela
            </button>
          </>
        )}
      </div>

      {step.image && (
        <Row label="Legenda da figura" wide>
          <Text
            value={step.caption}
            placeholder="Ex.: tela de login preenchida"
            onChange={(v) => updateStep(caseId, step.id, { caption: v })}
          />
        </Row>
      )}

      {(st.showExpected || st.showObtained) && (
        <div className="step-results">
          {st.showExpected && (
            <Row label={st.labels.expected} wide>
              <Area value={step.expected} rows={2} onChange={(v) => updateStep(caseId, step.id, { expected: v })} />
            </Row>
          )}
          {st.showObtained && (
            <Row label={st.labels.obtained} wide>
              <Area value={step.obtained} rows={2} onChange={(v) => updateStep(caseId, step.id, { obtained: v })} />
            </Row>
          )}
        </div>
      )}

      {st.showStatus && (
        <Row label={st.labels.status} wide>
          <StatusPicker
            value={step.status}
            template={template}
            onChange={(v) => updateStep(caseId, step.id, { status: v }, true)}
          />
        </Row>
      )}
    </div>
  );
}

export default function ContentPanel({ onCapture, onEditImage }) {
  const project = useStore((s) => s.project);
  const active = useStore(selectActiveCase);
  const setActiveCase = useStore((s) => s.setActiveCase);
  const addCase = useStore((s) => s.addCase);
  const removeCase = useStore((s) => s.removeCase);
  const moveCase = useStore((s) => s.moveCase);
  const duplicateCase = useStore((s) => s.duplicateCase);
  const setCaseValue = useStore((s) => s.setCaseValue);
  const setCaseStatus = useStore((s) => s.setCaseStatus);
  const setCoverValue = useStore((s) => s.setCoverValue);
  const addStep = useStore((s) => s.addStep);

  const t = project.template;
  const coverFields = t.coverFields.filter((f) => f.show);

  return (
    <div className="panel">
      <Section title="Casos de teste" badge={project.cases.length} defaultOpen>
        {project.cases.length === 0 ? (
          <p className="empty-note">Nenhum caso de teste ainda. Crie o primeiro abaixo.</p>
        ) : (
          <div className="case-list">
            {project.cases.map((c, i) => (
              <div
                key={c.id}
                className={`case-item ${active?.id === c.id ? 'on' : ''}`}
                onClick={() => setActiveCase(c.id)}
              >
                {t.sections.showCaseStatus ? (
                  <span className="dot" style={{ background: t.statusColors[c.status] }} />
                ) : null}
                <span className="case-name">
                  <b>{c.values.codigo || `CT-${String(i + 1).padStart(3, '0')}`}</b>
                  <em>{c.values.titulo || 'sem título'}</em>
                </span>
                <span className="case-steps" title={`${c.steps.length} passo(s)`}>{c.steps.length}</span>
                <span className="case-tools">
                  <button className="ico" title="Mover para cima" onClick={(e) => { e.stopPropagation(); moveCase(c.id, -1); }}>↑</button>
                  <button className="ico" title="Mover para baixo" onClick={(e) => { e.stopPropagation(); moveCase(c.id, 1); }}>↓</button>
                  <button className="ico" title="Duplicar" onClick={(e) => { e.stopPropagation(); duplicateCase(c.id); }}>⧉</button>
                  <button
                    className="ico danger"
                    title="Excluir"
                    onClick={(e) => { e.stopPropagation(); if (confirm('Excluir este caso de teste?')) removeCase(c.id); }}
                  >✕</button>
                </span>
              </div>
            ))}
          </div>
        )}
        <button className="btn primary block" onClick={addCase}>+ Novo caso de teste</button>
      </Section>

      {active && (
        <>
          <Section title="Detalhes do caso" defaultOpen>
            {t.caseFields.filter((f) => f.show).map((f) => (
              <Row key={f.id} label={f.label} wide={f.type === 'textarea'}>
                <DynField field={f} value={active.values[f.key]} onChange={(v) => setCaseValue(active.id, f.key, v)} />
              </Row>
            ))}
            {t.sections.showCaseStatus && (
              <Row label="Status do caso" wide>
                <StatusPicker value={active.status} template={t} onChange={(v) => setCaseStatus(active.id, v)} />
              </Row>
            )}
          </Section>

          <Section title="Passos e evidências" badge={active.steps.length} defaultOpen>
            <p className="tip">
              Aperte <b>PrintScreen</b> a qualquer momento — o print entra automaticamente neste caso.
            </p>
            {active.steps.map((s, i) => (
              <StepCard
                key={s.id}
                caseId={active.id}
                step={s}
                index={i + 1}
                total={active.steps.length}
                onCapture={onCapture}
                onEditImage={onEditImage}
              />
            ))}
            <div className="btn-row">
              <button className="btn block" onClick={() => addStep(active.id)}>+ Passo vazio</button>
              <button className="btn primary block" onClick={() => onCapture({ caseId: active.id, stepId: null })}>
                ⛶ Capturar e criar passo
              </button>
            </div>
          </Section>
        </>
      )}

      <Section title="Dados da capa" badge={coverFields.length}>
        {coverFields.map((f) => (
          <Row key={f.id} label={f.label} wide={f.type === 'textarea'}>
            <DynField field={f} value={f.value} onChange={(v) => setCoverValue(f.key, v)} />
          </Row>
        ))}
        <p className="tip">
          Para adicionar, renomear ou remover campos, vá em <b>Template → Campos</b>.
        </p>
      </Section>
    </div>
  );
}
