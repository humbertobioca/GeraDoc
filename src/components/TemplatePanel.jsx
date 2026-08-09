import React, { useEffect, useState } from 'react';
import { useStore } from '../store.js';
import { FIELD_TYPES, STATUS, STYLE_KEYS, defaultTemplate, uid } from '../defaults.js';
import { Area, Check, Color, Group, ImagePicker, Num, Row, Select, StyleEditor, Text } from './ui.jsx';

/**
 * As opções são muitas para uma pilha de sanfonas: aqui elas viram categorias,
 * como as abas de opções do Word. Só uma categoria fica aberta por vez, então
 * o que você procura está sempre a um clique e sem rolagem longa.
 */
const CATEGORIES = [
  { key: 'pagina', label: 'Página' },
  { key: 'texto', label: 'Texto' },
  { key: 'cores', label: 'Cores' },
  { key: 'capa', label: 'Capa' },
  { key: 'cabecalho', label: 'Cabeçalho e rodapé' },
  { key: 'imagens', label: 'Imagens' },
  { key: 'passos', label: 'Passos' },
  { key: 'campos', label: 'Campos' },
  { key: 'secoes', label: 'Seções' },
  { key: 'salvos', label: 'Meus templates' },
];

const slugKey = (label) =>
  label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || `campo_${uid()}`;

function FieldsEditor({ collection, allowDisplay }) {
  const fields = useStore((s) => s.project.template[collection]);
  const addField = useStore((s) => s.addField);
  const updateField = useStore((s) => s.updateField);
  const removeField = useStore((s) => s.removeField);
  const moveField = useStore((s) => s.moveField);
  const [newLabel, setNewLabel] = useState('');

  const add = () => {
    if (!newLabel.trim()) return;
    addField(collection, { label: newLabel.trim(), key: slugKey(newLabel), type: 'text', display: 'table' });
    setNewLabel('');
  };

  return (
    <div className="fields-editor">
      {fields.map((f, i) => (
        <div className={`field-row ${f.show ? '' : 'off'}`} key={f.id}>
          <div className="fr-top">
            <span className="fr-index">{i + 1}</span>
            <input
              className="inp"
              value={f.label}
              onChange={(e) => updateField(collection, f.id, { label: e.target.value })}
            />
            <button className="ico" title="Subir" onClick={() => moveField(collection, f.id, -1)}>↑</button>
            <button className="ico" title="Descer" onClick={() => moveField(collection, f.id, 1)}>↓</button>
            <button className="ico danger" title="Remover campo" onClick={() => removeField(collection, f.id)}>✕</button>
          </div>

          <div className="fr-mid">
            <Select
              value={f.type}
              onChange={(v) => updateField(collection, f.id, { type: v })}
              options={FIELD_TYPES.map((t) => ({ value: t.key, label: t.label }))}
            />
            {allowDisplay ? (
              <Select
                value={f.display}
                onChange={(v) => updateField(collection, f.id, { display: v })}
                options={[
                  { value: 'title', label: 'No título' },
                  { value: 'subtitle', label: 'No subtítulo' },
                  { value: 'table', label: 'Na tabela' },
                ]}
              />
            ) : null}
          </div>

          <div className="fr-bottom">
            <Check
              value={f.show}
              label="Exibir no documento"
              onChange={(v) => updateField(collection, f.id, { show: v })}
            />
            <span className="key-tag" title="Use esta chave no cabeçalho e no rodapé">{`{${f.key}}`}</span>
          </div>

          {f.type === 'select' ? (
            <input
              className="inp small"
              placeholder="opções separadas por ponto e vírgula"
              value={(f.options || []).join('; ')}
              onChange={(e) =>
                updateField(collection, f.id, {
                  options: e.target.value.split(';').map((s) => s.trim()).filter(Boolean),
                })
              }
            />
          ) : null}
        </div>
      ))}

      <div className="add-field">
        <input
          className="inp"
          placeholder="Nome do novo campo"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="btn" onClick={add}>+ Adicionar</button>
      </div>
    </div>
  );
}

function TemplateLibrary() {
  const template = useStore((s) => s.project.template);
  const replaceTemplate = useStore((s) => s.replaceTemplate);
  const notify = useStore((s) => s.notify);
  const [list, setList] = useState([]);
  const [name, setName] = useState('');

  const refresh = () => window.api.listTemplates().then(setList);
  useEffect(() => { refresh(); }, []);

  return (
    <>
      <Group title="Salvar o template atual">
        <div className="tpl-lib">
          <input className="inp" placeholder="Nome do template" value={name} onChange={(e) => setName(e.target.value)} />
          <button
            className="btn primary"
            onClick={async () => {
              const n = name.trim() || template.name || 'Meu template';
              await window.api.saveTemplate({ name: n, json: JSON.stringify({ ...template, name: n }, null, 2) });
              setName('');
              refresh();
              notify(`Template "${n}" salvo.`, 'ok');
            }}
          >
            Salvar
          </button>
        </div>
        <p className="tip">
          Guarda todas as configurações desta aba — fontes, cores, margens, logo, campos e seções — para
          reaplicar em qualquer documento futuro.
        </p>
      </Group>

      <Group title="Templates salvos">
        <div className="tpl-list">
          {list.length === 0 ? <p className="empty-note">Nenhum template salvo ainda.</p> : null}
          {list.map((n) => (
            <div className="tpl-item" key={n}>
              <span>{n}</span>
              <button
                className="btn tiny"
                onClick={async () => {
                  const json = await window.api.loadTemplate(n);
                  if (json) {
                    replaceTemplate(JSON.parse(json));
                    notify(`Template "${n}" aplicado.`, 'ok');
                  }
                }}
              >
                aplicar
              </button>
              <button
                className="btn tiny ghost"
                onClick={async () => {
                  if (!confirm(`Excluir o template "${n}"?`)) return;
                  await window.api.deleteTemplate(n);
                  refresh();
                }}
              >
                excluir
              </button>
            </div>
          ))}
        </div>
        <div className="btn-row">
          <button className="btn" onClick={() => window.api.openTemplatesFolder()}>Abrir pasta</button>
          <button
            className="btn ghost"
            onClick={() => {
              if (confirm('Restaurar o template padrão? As personalizações atuais serão perdidas.')) {
                replaceTemplate(defaultTemplate());
              }
            }}
          >
            Restaurar padrão
          </button>
        </div>
      </Group>
    </>
  );
}

export default function TemplatePanel() {
  const t = useStore((s) => s.project.template);
  const set = useStore((s) => s.patchTemplate);
  const [cat, setCat] = useState('pagina');

  return (
    <div className="panel template-panel">
      <nav className="cat-strip">
        {CATEGORIES.map((c) => (
          <button key={c.key} className={cat === c.key ? 'on' : ''} onClick={() => setCat(c.key)}>
            {c.label}
          </button>
        ))}
      </nav>

      <div className="cat-body">
        {cat === 'pagina' && (
          <>
            <Group title="Formato">
              <Row label="Tamanho">
                <Select value={t.page.size} onChange={(v) => set('page.size', v)} options={['A4', 'Letter']} />
              </Row>
              <Row label="Orientação">
                <Select
                  value={t.page.orientation}
                  onChange={(v) => set('page.orientation', v)}
                  options={[{ value: 'portrait', label: 'Retrato' }, { value: 'landscape', label: 'Paisagem' }]}
                />
              </Row>
            </Group>

            <Group title="Margens" hint="em milímetros">
              <div className="margin-grid">
                {[
                  ['top', 'Superior'],
                  ['bottom', 'Inferior'],
                  ['left', 'Esquerda'],
                  ['right', 'Direita'],
                ].map(([k, label]) => (
                  <label className="mg-cell" key={k}>
                    <span>{label}</span>
                    <Num value={t.page.margin[k]} min={0} max={60} onChange={(v) => set(`page.margin.${k}`, v)} />
                  </label>
                ))}
              </div>
            </Group>

            <Group title="Quebra de página">
              <Row label="Cada caso em nova página">
                <Check value={t.sections.caseOnNewPage} onChange={(v) => set('sections.caseOnNewPage', v)} label="" />
              </Row>
            </Group>
          </>
        )}

        {cat === 'texto' && (
          <Group title="Estilos de texto" hint="cada estilo vale para todo o documento">
            {STYLE_KEYS.map((sk) => (
              <div className="style-card" key={sk.key}>
                <div className="style-card-title">{sk.label}</div>
                <StyleEditor style={t.styles[sk.key]} onChange={(v) => set(`styles.${sk.key}`, v)} />
              </div>
            ))}
          </Group>
        )}

        {cat === 'cores' && (
          <>
            <Group title="Documento">
              <Row label="Cor principal"><Color value={t.colors.primary} onChange={(v) => set('colors.primary', v)} /></Row>
              <Row label="Cabeçalho de tabela"><Color value={t.colors.tableHeaderBg} onChange={(v) => set('colors.tableHeaderBg', v)} /></Row>
              <Row label="Linha zebrada"><Color value={t.colors.tableStripe} onChange={(v) => set('colors.tableStripe', v)} /></Row>
              <Row label="Bordas"><Color value={t.colors.border} onChange={(v) => set('colors.border', v)} /></Row>
            </Group>
            <Group title="Status">
              {STATUS.map((s) => (
                <Row key={s.key} label={s.label}>
                  <Color value={t.statusColors[s.key]} onChange={(v) => set(`statusColors.${s.key}`, v)} />
                </Row>
              ))}
            </Group>
          </>
        )}

        {cat === 'capa' && (
          <>
            <Group title="Aparência">
              <Row label="Usar capa"><Check value={t.cover.enabled} onChange={(v) => set('cover.enabled', v)} label="" /></Row>
              <Row label="Em página própria"><Check value={t.cover.ownPage} onChange={(v) => set('cover.ownPage', v)} label="" /></Row>
              <Row label="Centralizar na vertical"><Check value={t.cover.verticalCenter} onChange={(v) => set('cover.verticalCenter', v)} label="" /></Row>
              <Row label="Linha sob o título"><Check value={t.cover.showRule} onChange={(v) => set('cover.showRule', v)} label="" /></Row>
              <Row label="Quadro nos dados"><Check value={t.cover.boxed} onChange={(v) => set('cover.boxed', v)} label="" /></Row>
              <Row label="Espaço título → dados" hint="mm">
                <Num value={t.cover.gapMm} min={0} max={80} onChange={(v) => set('cover.gapMm', v)} />
              </Row>
            </Group>

            <Group title="Logo">
              <Row label="Imagem" wide><ImagePicker value={t.cover.logo} onChange={(v) => set('cover.logo', v)} /></Row>
              <Row label="Largura" hint="mm"><Num value={t.cover.logoWidth} min={10} max={160} onChange={(v) => set('cover.logoWidth', v)} /></Row>
              <Row label="Alinhamento">
                <Select
                  value={t.cover.logoAlign}
                  onChange={(v) => set('cover.logoAlign', v)}
                  options={[{ value: 'left', label: 'Esquerda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Direita' }]}
                />
              </Row>
            </Group>
          </>
        )}

        {cat === 'cabecalho' && (
          <>
            <Group title="Cabeçalho">
              <Row label="Exibir"><Check value={t.header.enabled} onChange={(v) => set('header.enabled', v)} label="" /></Row>
              <Row label="Altura" hint="mm"><Num value={t.header.heightMm} min={6} max={40} onChange={(v) => set('header.heightMm', v)} /></Row>
              <Row label="Esquerda" wide><Text value={t.header.left} onChange={(v) => set('header.left', v)} /></Row>
              <Row label="Centro" wide><Text value={t.header.center} onChange={(v) => set('header.center', v)} /></Row>
              <Row label="Direita" wide><Text value={t.header.right} onChange={(v) => set('header.right', v)} /></Row>
              <Row label="Linha abaixo"><Check value={t.header.showRule} onChange={(v) => set('header.showRule', v)} label="" /></Row>
              <Row label="Logo" wide><ImagePicker value={t.header.logo} onChange={(v) => set('header.logo', v)} /></Row>
              <Row label="Altura do logo" hint="mm"><Num value={t.header.logoHeight} min={3} max={30} onChange={(v) => set('header.logoHeight', v)} /></Row>
              <Row label="Mostrar na capa"><Check value={t.header.showOnCover} onChange={(v) => set('header.showOnCover', v)} label="" /></Row>
            </Group>

            <Group title="Rodapé">
              <Row label="Exibir"><Check value={t.footer.enabled} onChange={(v) => set('footer.enabled', v)} label="" /></Row>
              <Row label="Altura" hint="mm"><Num value={t.footer.heightMm} min={6} max={40} onChange={(v) => set('footer.heightMm', v)} /></Row>
              <Row label="Esquerda" wide><Text value={t.footer.left} onChange={(v) => set('footer.left', v)} /></Row>
              <Row label="Centro" wide><Text value={t.footer.center} onChange={(v) => set('footer.center', v)} /></Row>
              <Row label="Direita" wide><Text value={t.footer.right} onChange={(v) => set('footer.right', v)} /></Row>
              <Row label="Linha acima"><Check value={t.footer.showRule} onChange={(v) => set('footer.showRule', v)} label="" /></Row>
              <Row label="Mostrar na capa"><Check value={t.footer.showOnCover} onChange={(v) => set('footer.showOnCover', v)} label="" /></Row>
            </Group>

            <Group title="Marcadores disponíveis">
              <div className="token-list">
                <span className="key-tag">{'{p}'}</span> página atual
                <span className="key-tag">{'{n}'}</span> total de páginas
                {t.coverFields.map((f) => (
                  <React.Fragment key={f.id}>
                    <span className="key-tag">{`{${f.key}}`}</span> {f.label.toLowerCase()}
                  </React.Fragment>
                ))}
              </div>
              <p className="tip">
                Textos longos não são cortados: ocupam a sobra de espaço e quebram em até duas linhas.
              </p>
            </Group>
          </>
        )}

        {cat === 'imagens' && (
          <>
            <Group title="Tamanho e posição">
              <Row label="Largura" hint="% da área útil">
                <Num value={t.figure.widthPercent} min={20} max={100} onChange={(v) => set('figure.widthPercent', v)} />
              </Row>
              <Row label="Altura máxima" hint="mm">
                <Num value={t.figure.maxHeightMm} min={30} max={250} onChange={(v) => set('figure.maxHeightMm', v)} />
              </Row>
              <Row label="Alinhamento">
                <Select
                  value={t.figure.align}
                  onChange={(v) => set('figure.align', v)}
                  options={[{ value: 'left', label: 'Esquerda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Direita' }]}
                />
              </Row>
            </Group>

            <Group title="Moldura">
              <Row label="Borda"><Check value={t.figure.border} onChange={(v) => set('figure.border', v)} label="" /></Row>
              <Row label="Cor da borda"><Color value={t.figure.borderColor} onChange={(v) => set('figure.borderColor', v)} /></Row>
              <Row label="Cantos arredondados" hint="pt"><Num value={t.figure.borderRadius} min={0} max={20} onChange={(v) => set('figure.borderRadius', v)} /></Row>
              <Row label="Sombra"><Check value={t.figure.shadow} onChange={(v) => set('figure.shadow', v)} label="" /></Row>
            </Group>

            <Group title="Legenda">
              <Row label="Legenda automática"><Check value={t.figure.caption} onChange={(v) => set('figure.caption', v)} label="" /></Row>
              <Row label="Prefixo"><Text value={t.figure.captionPrefix} onChange={(v) => set('figure.captionPrefix', v)} /></Row>
            </Group>
          </>
        )}

        {cat === 'passos' && (
          <>
            <Group title="Formato">
              <Row label="Layout">
                <Select
                  value={t.step.layout}
                  onChange={(v) => set('step.layout', v)}
                  options={[{ value: 'blocks', label: 'Blocos (rótulo + texto)' }, { value: 'table', label: 'Tabela' }]}
                />
              </Row>
              <Row label="Rótulo"><Text value={t.step.stepLabel} onChange={(v) => set('step.stepLabel', v)} /></Row>
              <Row label="Numerar"><Check value={t.step.numbered} onChange={(v) => set('step.numbered', v)} label="" /></Row>
              <Row label="Status do caso de teste">
                <Check value={t.sections.showCaseStatus} onChange={(v) => set('sections.showCaseStatus', v)} label="" />
              </Row>
            </Group>

            <Group title="Campos de cada passo" hint="desmarque o que não quiser preencher">
              {[
                ['description', 'showDescription'],
                ['expected', 'showExpected'],
                ['obtained', 'showObtained'],
                ['status', 'showStatus'],
              ].map(([k, showKey]) => (
                <div className="step-field-row" key={k}>
                  <Check value={t.step[showKey]} label="" onChange={(v) => set(`step.${showKey}`, v)} />
                  <Text value={t.step.labels[k]} onChange={(v) => set(`step.labels.${k}`, v)} />
                </div>
              ))}
            </Group>
          </>
        )}

        {cat === 'campos' && (
          <>
            <Group title="Comportamento">
              <Row label="Ocultar campos vazios" hint="campo em branco não aparece no documento">
                <Check value={t.hideEmptyFields} onChange={(v) => set('hideEmptyFields', v)} label="" />
              </Row>
              <p className="tip">
                Nenhum campo é obrigatório. Com esta opção ligada você preenche só o que interessa e o
                documento sai limpo, sem linhas com “—”.
              </p>
            </Group>

            <Group title="Campos da capa" hint="renomeie, reordene, esconda ou crie">
              <FieldsEditor collection="coverFields" allowDisplay />
            </Group>
            <Group title="Campos do caso de teste" hint="marque “No título” para compor o cabeçalho do caso">
              <FieldsEditor collection="caseFields" allowDisplay />
            </Group>
          </>
        )}

        {cat === 'secoes' && (
          <>
            <Group title="Introdução">
              <Row label="Exibir"><Check value={t.sections.intro.enabled} onChange={(v) => set('sections.intro.enabled', v)} label="" /></Row>
              <Row label="Título" wide><Text value={t.sections.intro.title} onChange={(v) => set('sections.intro.title', v)} /></Row>
              <Row label="Conteúdo" wide><Area rows={4} value={t.sections.intro.text} onChange={(v) => set('sections.intro.text', v)} /></Row>
            </Group>

            <Group title="Índice de casos">
              <Row label="Exibir"><Check value={t.sections.caseIndex.enabled} onChange={(v) => set('sections.caseIndex.enabled', v)} label="" /></Row>
              <Row label="Título" wide><Text value={t.sections.caseIndex.title} onChange={(v) => set('sections.caseIndex.title', v)} /></Row>
            </Group>

            <Group title="Resumo da execução">
              <Row label="Exibir"><Check value={t.sections.summary.enabled} onChange={(v) => set('sections.summary.enabled', v)} label="" /></Row>
              <Row label="Título" wide><Text value={t.sections.summary.title} onChange={(v) => set('sections.summary.title', v)} /></Row>
              <Row label="Posição">
                <Select
                  value={t.sections.summary.position}
                  onChange={(v) => set('sections.summary.position', v)}
                  options={[{ value: 'start', label: 'No início' }, { value: 'end', label: 'No final' }]}
                />
              </Row>
              <Row label="Gráfico de barras"><Check value={t.sections.summary.showChartBar} onChange={(v) => set('sections.summary.showChartBar', v)} label="" /></Row>
            </Group>

            <Group title="Assinaturas">
              <Row label="Exibir"><Check value={t.sections.signatures.enabled} onChange={(v) => set('sections.signatures.enabled', v)} label="" /></Row>
              <Row label="Título" wide><Text value={t.sections.signatures.title} onChange={(v) => set('sections.signatures.title', v)} /></Row>
              {t.sections.signatures.lines.map((l) => (
                <div className="sig-row" key={l.id}>
                  <Text
                    value={l.role}
                    placeholder="Cargo"
                    onChange={(v) => set('sections.signatures.lines', t.sections.signatures.lines.map((x) => (x.id === l.id ? { ...x, role: v } : x)))}
                  />
                  <Text
                    value={l.name}
                    placeholder="Nome"
                    onChange={(v) => set('sections.signatures.lines', t.sections.signatures.lines.map((x) => (x.id === l.id ? { ...x, name: v } : x)))}
                  />
                  <button
                    className="ico danger"
                    title="Remover"
                    onClick={() => set('sections.signatures.lines', t.sections.signatures.lines.filter((x) => x.id !== l.id))}
                  >✕</button>
                </div>
              ))}
              <button
                className="btn block"
                onClick={() => set('sections.signatures.lines', [...t.sections.signatures.lines, { id: uid(), role: 'Cargo', name: '' }])}
              >
                + Adicionar assinatura
              </button>
            </Group>
          </>
        )}

        {cat === 'salvos' && <TemplateLibrary />}
      </div>
    </div>
  );
}
