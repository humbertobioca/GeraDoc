export const uid = () => Math.random().toString(36).slice(2, 10);

export const MM_PX = 96 / 25.4; // 1mm em px na tela (CSS)

export const FONTS = [
  'Arial',
  'Calibri',
  'Segoe UI',
  'Times New Roman',
  'Georgia',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Courier New',
];

export const PAGE_SIZES = {
  A4: { w: 210, h: 297 },
  Letter: { w: 215.9, h: 279.4 },
};

export const STATUS = [
  { key: 'nao_executado', label: 'Não executado' },
  { key: 'passou', label: 'Passou' },
  { key: 'falhou', label: 'Falhou' },
  { key: 'bloqueado', label: 'Bloqueado' },
];

export const FIELD_TYPES = [
  { key: 'text', label: 'Texto curto' },
  { key: 'textarea', label: 'Texto longo' },
  { key: 'date', label: 'Data' },
  { key: 'select', label: 'Lista de opções' },
];

export const style = (o = {}) => ({
  family: 'Arial',
  size: 11,
  color: '#222222',
  bold: false,
  italic: false,
  underline: false,
  align: 'left',
  lineHeight: 1.5,
  spaceBefore: 0,
  spaceAfter: 6,
  ...o,
});

export const STYLE_KEYS = [
  { key: 'docTitle', label: 'Título do documento (capa)' },
  { key: 'subtitle', label: 'Subtítulo da capa' },
  { key: 'h1', label: 'Título 1 (seção)' },
  { key: 'h2', label: 'Título 2 (caso de teste)' },
  { key: 'h3', label: 'Título 3 (passo)' },
  { key: 'body', label: 'Corpo do texto' },
  { key: 'caption', label: 'Legenda da figura' },
  { key: 'tableHeader', label: 'Cabeçalho de tabela' },
  { key: 'tableCell', label: 'Célula de tabela' },
  { key: 'headerFooter', label: 'Cabeçalho e rodapé' },
];

/**
 * Perfis prontos. Aplicar um perfil só mexe no QUE aparece no documento —
 * tipografia, cores, margens e logo permanecem como você deixou.
 */
export const PROFILES = {
  qa: {
    label: 'QA — completo',
    hint: 'Documento formal de homologação: status, resultado esperado/obtido, resumo da execução e índice de casos.',
    patch: {
      hideEmptyFields: false,
      step: {
        showDescription: true,
        showExpected: true,
        showObtained: true,
        showStatus: true,
        stepLabel: 'Passo',
      },
      sections: {
        showCaseStatus: true,
        caseIndex: { enabled: true },
        summary: { enabled: true },
      },
    },
    coverShow: {
      titulo: true, sistema: true, modulo: true, versao: true, ambiente: true,
      numero_bug: true, responsavel: true, data: true,
    },
    caseShow: { codigo: true, titulo: true, objetivo: true, precondicoes: true, massa: true },
  },

  dev: {
    label: 'Desenvolvedor — simples',
    hint: 'Só print + descrição. Sem status, sem resultado esperado/obtido, sem resumo. Nada é obrigatório e campo em branco não aparece no documento.',
    patch: {
      hideEmptyFields: true,
      step: {
        showDescription: true,
        showExpected: false,
        showObtained: false,
        showStatus: false,
        stepLabel: 'Evidência',
      },
      sections: {
        showCaseStatus: false,
        caseIndex: { enabled: false },
        summary: { enabled: false },
        signatures: { enabled: false },
      },
    },
    // Na capa o dev preenche só o essencial de um registro de bug.
    coverShow: {
      titulo: true, numero_bug: true, responsavel: true, data: true,
      sistema: false, modulo: false, versao: false, ambiente: false,
      aprovador: false, observacoes_gerais: false,
    },
    caseShow: {
      codigo: true, titulo: true,
      objetivo: false, precondicoes: false, massa: false, ambiente: false, observacoes: false,
    },
  },
};

export const defaultTemplate = () => ({
  name: 'Padrão',
  profile: 'qa',

  /** Campos sem valor são omitidos do documento em vez de virarem "—". */
  hideEmptyFields: false,

  page: {
    size: 'A4',
    orientation: 'portrait',
    margin: { top: 22, right: 20, bottom: 18, left: 25 },
  },

  colors: {
    primary: '#1f4e79',
    tableHeaderBg: '#1f4e79',
    tableHeaderText: '#ffffff',
    tableStripe: '#f4f7fb',
    border: '#c9d2dd',
  },

  styles: {
    docTitle: style({ size: 26, bold: true, align: 'center', color: '#1f4e79', spaceAfter: 10, lineHeight: 1.25 }),
    subtitle: style({ size: 14, align: 'center', color: '#5a6673', spaceAfter: 28 }),
    h1: style({ size: 16, bold: true, color: '#1f4e79', spaceBefore: 12, spaceAfter: 8 }),
    h2: style({ size: 13.5, bold: true, color: '#1f4e79', spaceBefore: 10, spaceAfter: 6 }),
    h3: style({ size: 11.5, bold: true, color: '#333333', spaceBefore: 8, spaceAfter: 4 }),
    body: style({ size: 11, align: 'justify', lineHeight: 1.5, spaceAfter: 6 }),
    caption: style({ size: 9, italic: true, color: '#6b7684', align: 'center', spaceBefore: 4, spaceAfter: 10 }),
    tableHeader: style({ size: 10, bold: true, color: '#ffffff', align: 'left', lineHeight: 1.3, spaceAfter: 0 }),
    tableCell: style({ size: 10, align: 'left', lineHeight: 1.35, spaceAfter: 0 }),
    headerFooter: style({ size: 8.5, color: '#7a8592', lineHeight: 1.2, spaceAfter: 0 }),
  },

  cover: {
    enabled: true,
    logo: null,
    logoWidth: 45, // mm
    logoAlign: 'center',
    showRule: true,
    boxed: true, // desenha os dados da capa dentro de um quadro
    verticalCenter: true,
    ownPage: true,
    gapMm: 16, // respiro entre o título e o quadro de dados
  },

  // Campos da capa. display: title | subtitle | table
  coverFields: [
    { id: uid(), key: 'titulo', label: 'Título', type: 'text', display: 'title', show: true, value: 'Documento de Testes Manuais' },
    { id: uid(), key: 'sistema', label: 'Sistema', type: 'text', display: 'subtitle', show: true, value: '' },
    { id: uid(), key: 'modulo', label: 'Módulo', type: 'text', display: 'table', show: true, value: '' },
    { id: uid(), key: 'versao', label: 'Versão', type: 'text', display: 'table', show: true, value: '1.0' },
    { id: uid(), key: 'ambiente', label: 'Ambiente', type: 'select', display: 'table', show: true, value: 'Homologação', options: ['Desenvolvimento', 'Homologação', 'Produção'] },
    { id: uid(), key: 'numero_bug', label: 'Número do bug', type: 'text', display: 'table', show: true, value: '' },
    { id: uid(), key: 'responsavel', label: 'Responsável', type: 'text', display: 'table', show: true, value: '' },
    { id: uid(), key: 'data', label: 'Data de execução', type: 'date', display: 'table', show: true, value: '' },
    { id: uid(), key: 'aprovador', label: 'Aprovador', type: 'text', display: 'table', show: false, value: '' },
    { id: uid(), key: 'observacoes_gerais', label: 'Observações gerais', type: 'textarea', display: 'table', show: false, value: '' },
  ],

  header: {
    enabled: true,
    heightMm: 12,
    left: '{sistema}',
    center: '',
    right: '{titulo}',
    showRule: true,
    logo: null,
    logoHeight: 8,
    showOnCover: false,
  },

  footer: {
    enabled: true,
    heightMm: 12,
    left: '{data}',
    center: '',
    right: 'Página {p} de {n}',
    showRule: true,
    showOnCover: false,
  },

  toc: { enabled: false, title: 'Sumário' },

  figure: {
    widthPercent: 92,
    align: 'center',
    border: true,
    borderColor: '#c9d2dd',
    borderRadius: 3,
    shadow: false,
    caption: true,
    captionPrefix: 'Figura',
    maxHeightMm: 150,
  },

  statusColors: {
    passou: '#1e7d34',
    falhou: '#c62828',
    bloqueado: '#c77700',
    nao_executado: '#6b7684',
  },

  // Campos de cada caso de teste
  caseFields: [
    { id: uid(), key: 'codigo', label: 'ID', type: 'text', display: 'title', show: true },
    { id: uid(), key: 'titulo', label: 'Título', type: 'text', display: 'title', show: true },
    { id: uid(), key: 'objetivo', label: 'Objetivo', type: 'textarea', display: 'table', show: true },
    { id: uid(), key: 'precondicoes', label: 'Pré-condições', type: 'textarea', display: 'table', show: true },
    { id: uid(), key: 'massa', label: 'Massa de dados', type: 'textarea', display: 'table', show: true },
    { id: uid(), key: 'ambiente', label: 'Ambiente / URL', type: 'text', display: 'table', show: false },
    { id: uid(), key: 'observacoes', label: 'Observações', type: 'textarea', display: 'table', show: false },
  ],

  step: {
    numbered: true,
    stepLabel: 'Passo',
    showDescription: true,
    showExpected: true,
    showObtained: true,
    showStatus: true,
    labels: {
      description: 'Ação executada',
      expected: 'Resultado esperado',
      obtained: 'Resultado obtido',
      status: 'Status',
    },
    layout: 'blocks', // 'blocks' = rótulo + texto | 'table' = tabela de 2 colunas
  },

  sections: {
    caseOnNewPage: false,
    showCaseStatus: true,
    intro: { enabled: false, title: 'Objetivo do documento', text: '' },
    summary: {
      enabled: true,
      title: 'Resumo da execução',
      showChartBar: true,
      position: 'end', // 'start' | 'end'
    },
    caseIndex: { enabled: false, title: 'Casos de teste executados' },
    signatures: {
      enabled: false,
      title: 'Aprovações',
      lines: [
        { id: uid(), role: 'Analista de Testes', name: '' },
        { id: uid(), role: 'Responsável Técnico', name: '' },
      ],
    },
  },
});

export const newStep = (patch = {}) => ({
  id: uid(),
  description: '',
  image: null,
  caption: '',
  expected: '',
  obtained: '',
  status: 'nao_executado',
  ...patch,
});

export const newCase = (template, index = 1) => {
  const values = {};
  for (const f of template.caseFields) values[f.key] = '';
  values.codigo = `CT-${String(index).padStart(3, '0')}`;
  values.titulo = 'Novo caso de teste';
  return { id: uid(), values, status: 'nao_executado', steps: [newStep()] };
};

export const newProject = () => {
  const template = defaultTemplate();
  return {
    version: 1,
    template,
    cases: [newCase(template, 1)],
  };
};
