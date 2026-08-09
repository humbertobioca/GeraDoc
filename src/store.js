import { create } from 'zustand';
import { newProject, newCase, newStep, uid, defaultTemplate, PROFILES } from './defaults.js';

const clone = (o) => JSON.parse(JSON.stringify(o));

/** Aplica um patch parcial sobre um objeto, descendo em objetos aninhados. */
function deepAssign(target, patch) {
  for (const k of Object.keys(patch)) {
    const v = patch[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object') {
      deepAssign(target[k], v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

/** Merge raso-profundo para não perder chaves novas ao abrir projetos antigos. */
function mergeTemplate(base, incoming) {
  if (!incoming) return base;
  const out = Array.isArray(base) ? incoming : { ...base };
  if (Array.isArray(base)) return incoming;
  for (const k of Object.keys(incoming)) {
    const b = base[k];
    const i = incoming[k];
    out[k] =
      b && i && typeof b === 'object' && typeof i === 'object' && !Array.isArray(b)
        ? mergeTemplate(b, i)
        : i;
  }
  return out;
}

/**
 * Une a lista de campos salva com a do padrão. Sem isso, um projeto criado
 * antes de um campo novo existir nunca o receberia — a lista salva substituiria
 * a padrão inteira. Cada campo que falta entra na mesma posição relativa que
 * ocupa no padrão; o que o usuário já editou é preservado como está.
 */
function mergeFieldList(base, incoming) {
  if (!Array.isArray(incoming) || !incoming.length) return base;
  const have = new Set(incoming.map((f) => f.key));
  const out = [...incoming];

  base.forEach((f, i) => {
    if (have.has(f.key)) return;
    const prevKey = base[i - 1]?.key;
    const at = prevKey ? out.findIndex((o) => o.key === prevKey) : -1;
    out.splice(at >= 0 ? at + 1 : out.length, 0, { ...f });
  });
  return out;
}

/** Aplica a união de campos e garante que todo caso tenha as chaves atuais. */
function migrateTemplate(project) {
  const base = defaultTemplate();
  const t = project.template;
  t.coverFields = mergeFieldList(base.coverFields, t.coverFields);
  t.caseFields = mergeFieldList(base.caseFields, t.caseFields);
  for (const c of project.cases) {
    for (const f of t.caseFields) if (!(f.key in c.values)) c.values[f.key] = '';
  }
  return project;
}

const HISTORY_LIMIT = 60;

export const useStore = create((set, get) => ({
  project: newProject(),
  filePath: null,
  dirty: false,
  activeCaseId: null,
  tab: 'conteudo', // conteudo | template
  zoom: 0.75,
  toast: null,
  past: [],
  future: [],

  // ------------------------------------------------------------ infraestrutura
  _commit(mutator, { history = true } = {}) {
    const { project, past } = get();
    const next = clone(project);
    mutator(next);
    set({
      project: next,
      dirty: true,
      past: history ? [...past, project].slice(-HISTORY_LIMIT) : past,
      future: history ? [] : get().future,
    });
  },

  undo() {
    const { past, project, future } = get();
    if (!past.length) return;
    set({
      project: past[past.length - 1],
      past: past.slice(0, -1),
      future: [project, ...future].slice(0, HISTORY_LIMIT),
      dirty: true,
    });
  },

  redo() {
    const { future, project, past } = get();
    if (!future.length) return;
    set({
      project: future[0],
      future: future.slice(1),
      past: [...past, project].slice(-HISTORY_LIMIT),
      dirty: true,
    });
  },

  notify(message, kind = 'info') {
    set({ toast: { message, kind, id: uid() } });
    setTimeout(() => {
      if (get().toast?.message === message) set({ toast: null });
    }, 3800);
  },

  setTab: (tab) => set({ tab }),
  setZoom: (zoom) => set({ zoom: Math.min(1.6, Math.max(0.35, zoom)) }),
  setActiveCase: (id) => set({ activeCaseId: id }),

  // ------------------------------------------------------------ projeto
  loadProject(project, filePath = null) {
    const base = defaultTemplate();
    const merged = migrateTemplate({
      ...project,
      template: mergeTemplate(base, project.template),
    });
    set({
      project: merged,
      filePath,
      dirty: false,
      past: [],
      future: [],
      activeCaseId: merged.cases[0]?.id ?? null,
    });
  },

  resetProject() {
    const p = newProject();
    set({ project: p, filePath: null, dirty: false, past: [], future: [], activeCaseId: p.cases[0].id });
  },

  setFilePath: (filePath) => set({ filePath, dirty: false }),
  markSaved: () => set({ dirty: false }),

  // ------------------------------------------------------------ template
  patchTemplate(path, value) {
    get()._commit((p) => {
      const keys = path.split('.');
      let node = p.template;
      for (let i = 0; i < keys.length - 1; i++) node = node[keys[i]];
      node[keys[keys.length - 1]] = value;
    });
  },

  /**
   * Aplica um perfil pronto (QA completo / Desenvolvedor simples).
   * Mexe só no que aparece no documento — tipografia, cores, margens e logo ficam intactos.
   */
  applyProfile(name) {
    const p = PROFILES[name];
    if (!p) return;
    get()._commit((proj) => {
      const t = proj.template;
      deepAssign(t, p.patch);
      t.profile = name;
      for (const f of t.coverFields) if (f.key in p.coverShow) f.show = p.coverShow[f.key];
      for (const f of t.caseFields) if (f.key in p.caseShow) f.show = p.caseShow[f.key];
    });
  },

  replaceTemplate(template) {
    get()._commit((p) => {
      p.template = mergeTemplate(defaultTemplate(), template);
      migrateTemplate(p);
    });
  },

  // --- campos dinâmicos (capa e caso de teste) ---
  addField(collection, field) {
    get()._commit((p) => {
      p.template[collection].push({
        id: uid(),
        key: field.key,
        label: field.label,
        type: field.type || 'text',
        display: field.display || 'table',
        show: true,
        value: '',
        options: field.options || [],
      });
      if (collection === 'caseFields') for (const c of p.cases) c.values[field.key] = '';
    });
  },

  updateField(collection, id, patch) {
    get()._commit((p) => {
      const f = p.template[collection].find((x) => x.id === id);
      if (!f) return;
      const oldKey = f.key;
      Object.assign(f, patch);
      if (patch.key && patch.key !== oldKey && collection === 'caseFields') {
        for (const c of p.cases) {
          c.values[patch.key] = c.values[oldKey] ?? '';
          delete c.values[oldKey];
        }
      }
    });
  },

  removeField(collection, id) {
    get()._commit((p) => {
      const f = p.template[collection].find((x) => x.id === id);
      p.template[collection] = p.template[collection].filter((x) => x.id !== id);
      if (f && collection === 'caseFields') for (const c of p.cases) delete c.values[f.key];
    });
  },

  moveField(collection, id, dir) {
    get()._commit((p) => {
      const arr = p.template[collection];
      const i = arr.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    });
  },

  setCoverValue(key, value) {
    get()._commit((p) => {
      const f = p.template.coverFields.find((x) => x.key === key);
      if (f) f.value = value;
    });
  },

  // ------------------------------------------------------------ casos de teste
  addCase() {
    const { project } = get();
    const c = newCase(project.template, project.cases.length + 1);
    get()._commit((p) => p.cases.push(c));
    set({ activeCaseId: c.id });
    return c.id;
  },

  duplicateCase(id) {
    const { project } = get();
    const src = project.cases.find((c) => c.id === id);
    if (!src) return;
    const copy = clone(src);
    copy.id = uid();
    copy.steps = copy.steps.map((s) => ({ ...s, id: uid() }));
    copy.values = {
      ...copy.values,
      codigo: `CT-${String(project.cases.length + 1).padStart(3, '0')}`,
      titulo: `${copy.values.titulo || ''} (cópia)`.trim(),
    };
    get()._commit((p) => {
      const i = p.cases.findIndex((c) => c.id === id);
      p.cases.splice(i + 1, 0, copy);
    });
    set({ activeCaseId: copy.id });
  },

  removeCase(id) {
    get()._commit((p) => {
      p.cases = p.cases.filter((c) => c.id !== id);
    });
    if (get().activeCaseId === id) set({ activeCaseId: get().project.cases[0]?.id ?? null });
  },

  moveCase(id, dir) {
    get()._commit((p) => {
      const i = p.cases.findIndex((c) => c.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.cases.length) return;
      [p.cases[i], p.cases[j]] = [p.cases[j], p.cases[i]];
    });
  },

  setCaseValue(caseId, key, value) {
    get()._commit(
      (p) => {
        const c = p.cases.find((x) => x.id === caseId);
        if (c) c.values[key] = value;
      },
      { history: false },
    );
  },

  setCaseStatus(caseId, status) {
    get()._commit((p) => {
      const c = p.cases.find((x) => x.id === caseId);
      if (c) c.status = status;
    });
  },

  // ------------------------------------------------------------ passos
  addStep(caseId, patch = {}) {
    const s = newStep(patch);
    get()._commit((p) => {
      const c = p.cases.find((x) => x.id === caseId);
      if (c) c.steps.push(s);
    });
    return s.id;
  },

  duplicateStep(caseId, stepId) {
    get()._commit((p) => {
      const c = p.cases.find((x) => x.id === caseId);
      if (!c) return;
      const i = c.steps.findIndex((s) => s.id === stepId);
      if (i < 0) return;
      c.steps.splice(i + 1, 0, { ...clone(c.steps[i]), id: uid() });
    });
  },

  updateStep(caseId, stepId, patch, history = false) {
    get()._commit(
      (p) => {
        const c = p.cases.find((x) => x.id === caseId);
        const s = c?.steps.find((x) => x.id === stepId);
        if (s) Object.assign(s, patch);
      },
      { history },
    );
  },

  removeStep(caseId, stepId) {
    get()._commit((p) => {
      const c = p.cases.find((x) => x.id === caseId);
      if (c) c.steps = c.steps.filter((s) => s.id !== stepId);
    });
  },

  moveStep(caseId, stepId, dir) {
    get()._commit((p) => {
      const c = p.cases.find((x) => x.id === caseId);
      if (!c) return;
      const i = c.steps.findIndex((s) => s.id === stepId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= c.steps.length) return;
      [c.steps[i], c.steps[j]] = [c.steps[j], c.steps[i]];
    });
  },

  /** Cria um passo por imagem — usado ao colar/soltar vários prints de uma vez. */
  addStepsFromImages(caseId, images) {
    get()._commit((p) => {
      const c = p.cases.find((x) => x.id === caseId);
      if (!c) return;
      // se o último passo estiver totalmente vazio, aproveita ele
      const last = c.steps[c.steps.length - 1];
      let list = [...images];
      if (last && !last.image && !last.description && !last.expected && !last.obtained) {
        last.image = list.shift();
      }
      for (const img of list) c.steps.push(newStep({ image: img }));
    });
  },
}));

// -------------------------------------------------------------------- seletores
export const selectActiveCase = (s) =>
  s.project.cases.find((c) => c.id === s.activeCaseId) ?? s.project.cases[0] ?? null;

export const countStatus = (project) => {
  const acc = { passou: 0, falhou: 0, bloqueado: 0, nao_executado: 0 };
  for (const c of project.cases) acc[c.status] = (acc[c.status] || 0) + 1;
  return acc;
};
