import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Tab,
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import { PAGE_SIZES, STATUS } from '../defaults.js';
import { coverValue, statusLabel, visibleRows } from '../doc/blocks.jsx';

const MM_TWIP = 56.6929;
const PT_TWIP = 20;
const MM_PX = 96 / 25.4;

const hex = (c) => String(c || '#000000').replace('#', '').toUpperCase();

const ALIGN = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

/** Converte um estilo do template em opções de TextRun. */
const runOpts = (s, over = {}) => ({
  font: s.family,
  size: Math.round(s.size * 2), // meio-ponto
  color: hex(over.color || s.color),
  bold: over.bold ?? s.bold,
  italics: over.italic ?? s.italic,
  underline: (over.underline ?? s.underline) ? {} : undefined,
});

/** Cria parágrafo(s) a partir de um texto com quebras de linha. */
function para(text, s, over = {}) {
  const lines = String(text ?? '').split('\n');
  const children = [];
  lines.forEach((line, i) => {
    if (i > 0) children.push(new TextRun({ break: 1 }));
    children.push(new TextRun({ text: line, ...runOpts(s, over) }));
  });
  return new Paragraph({
    children,
    alignment: ALIGN[over.align || s.align] ?? AlignmentType.LEFT,
    spacing: {
      before: Math.round((over.spaceBefore ?? s.spaceBefore) * PT_TWIP),
      after: Math.round((over.spaceAfter ?? s.spaceAfter) * PT_TWIP),
      line: Math.round(s.lineHeight * 240),
      lineRule: 'auto',
    },
    heading: over.heading,
  });
}

const noBorders = {
  top: { style: BorderStyle.NONE, size: 0 },
  bottom: { style: BorderStyle.NONE, size: 0 },
  left: { style: BorderStyle.NONE, size: 0 },
  right: { style: BorderStyle.NONE, size: 0 },
  insideHorizontal: { style: BorderStyle.NONE, size: 0 },
  insideVertical: { style: BorderStyle.NONE, size: 0 },
};

const cellBorders = (color) => {
  const b = { style: BorderStyle.SINGLE, size: 4, color: hex(color) };
  return { top: b, bottom: b, left: b, right: b };
};

function dataUrlToBytes(dataUrl) {
  const [head, b64] = dataUrl.split(',');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const type = /image\/(\w+)/.exec(head)?.[1] ?? 'png';
  return { bytes, type: type === 'jpeg' ? 'jpg' : type };
}

function imageSize(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 800, h: 600 });
    img.src = src;
  });
}

/** Tabela rótulo/valor (usada na capa e nos campos do caso de teste). */
function kvTable(t, rows) {
  if (!rows.length) return [];
  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [34, 66],
      rows: rows.map(
        ([k, v], i) =>
          new TableRow({
            children: [
              new TableCell({
                width: { size: 34, type: WidthType.PERCENTAGE },
                borders: cellBorders(t.colors.border),
                shading: { type: ShadingType.CLEAR, fill: hex(t.colors.tableStripe) },
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [para(k, t.styles.tableCell, { bold: true, color: t.colors.primary, spaceAfter: 0 })],
              }),
              new TableCell({
                width: { size: 66, type: WidthType.PERCENTAGE },
                borders: cellBorders(t.colors.border),
                shading:
                  i % 2 === 1
                    ? { type: ShadingType.CLEAR, fill: hex(t.colors.tableStripe) }
                    : undefined,
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [para(v || '—', t.styles.tableCell, { spaceAfter: 0 })],
              }),
            ],
          }),
      ),
    }),
    para('', t.styles.body, { spaceAfter: 4 }),
  ];
}

/** Resolve {chaves}; {p} e {n} viram campos nativos de numeração do Word. */
function tokenRuns(text, s, t) {
  const children = [];
  const re = /\{(\w+)\}/g;
  let last = 0;
  let m;
  const push = (txt) => txt && children.push(new TextRun({ text: txt, ...runOpts(s) }));
  const str = String(text ?? '');

  while ((m = re.exec(str))) {
    push(str.slice(last, m.index));
    if (m[1] === 'p') children.push(new TextRun({ children: [PageNumber.CURRENT], ...runOpts(s) }));
    else if (m[1] === 'n') children.push(new TextRun({ children: [PageNumber.TOTAL_PAGES], ...runOpts(s) }));
    else push(coverValue(t, m[1]));
    last = m.index + m[0].length;
  }
  push(str.slice(last));
  return children;
}

/**
 * Cabeçalho/rodapé como um parágrafo com paradas de tabulação — a forma nativa
 * do Word. Diferente de uma tabela de três colunas fixas, o texto da direita
 * ocupa toda a sobra e quebra de linha em vez de ser cortado.
 */
function hfParagraph(t, cfg, contentTwips) {
  const s = t.styles.headerFooter;
  const tab = () => new TextRun({ children: [new Tab()] });

  return new Paragraph({
    children: [
      ...tokenRuns(cfg.left, s, t),
      tab(),
      ...tokenRuns(cfg.center, s, t),
      tab(),
      ...tokenRuns(cfg.right, s, t),
    ],
    tabStops: [
      { type: TabStopType.CENTER, position: Math.round(contentTwips / 2) },
      { type: TabStopType.RIGHT, position: Math.round(contentTwips) },
    ],
    spacing: { before: 0, after: 0, line: Math.round(s.lineHeight * 240), lineRule: 'auto' },
  });
}

export async function buildDocx(project) {
  const t = project.template;
  const base = PAGE_SIZES[t.page.size] || PAGE_SIZES.A4;
  const landscape = t.page.orientation === 'landscape';
  const wMm = landscape ? base.h : base.w;
  const hMm = landscape ? base.w : base.h;
  const contentWmm = wMm - t.page.margin.left - t.page.margin.right;
  const contentWpx = contentWmm * MM_PX;
  const contentTwips = contentWmm * MM_TWIP;
  const maxHpx = t.figure.maxHeightMm * MM_PX;

  const pageSetup = {
    page: {
      size: {
        width: Math.round(wMm * MM_TWIP),
        height: Math.round(hMm * MM_TWIP),
        orientation: landscape ? 'landscape' : 'portrait',
      },
      margin: {
        top: Math.round(t.page.margin.top * MM_TWIP),
        right: Math.round(t.page.margin.right * MM_TWIP),
        bottom: Math.round(t.page.margin.bottom * MM_TWIP),
        left: Math.round(t.page.margin.left * MM_TWIP),
      },
    },
  };

  const sections = [];

  // ------------------------------------------------------------------ capa
  if (t.cover.enabled) {
    const kids = [];

    if (t.cover.logo) {
      const { bytes, type } = dataUrlToBytes(t.cover.logo);
      const nat = await imageSize(t.cover.logo);
      const w = t.cover.logoWidth * MM_PX;
      kids.push(
        new Paragraph({
          alignment: ALIGN[t.cover.logoAlign] ?? AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [
            new ImageRun({ data: bytes, type, transformation: { width: w, height: (nat.h / nat.w) * w } }),
          ],
        }),
      );
    }

    const titleField = t.coverFields.find((f) => f.show && f.display === 'title');
    const subField = t.coverFields.find((f) => f.show && f.display === 'subtitle');

    kids.push(para(titleField?.value || 'Documento de Testes Manuais', t.styles.docTitle));
    if (t.cover.showRule) {
      kids.push(
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: hex(t.colors.primary) } },
          spacing: { after: 240 },
          children: [],
        }),
      );
    }
    if (subField?.value) kids.push(para(subField.value, t.styles.subtitle));

    // mesmo respiro entre título e dados que o preview usa (mm -> pt)
    kids.push(para('', t.styles.body, { spaceBefore: 0, spaceAfter: t.cover.gapMm * 2.83465 }));

    kids.push(
      ...kvTable(
        t,
        visibleRows(t.coverFields, (f) => f.value, t.hideEmptyFields).map(({ f, value }) => [f.label, value]),
      ),
    );

    sections.push({
      properties: pageSetup,
      headers:
        t.header.enabled && t.header.showOnCover
          ? { default: new Header({ children: [hfParagraph(t, t.header, contentTwips)] }) }
          : undefined,
      footers:
        t.footer.enabled && t.footer.showOnCover
          ? { default: new Footer({ children: [hfParagraph(t, t.footer, contentTwips)] }) }
          : undefined,
      children: kids,
    });
  }

  // --------------------------------------------------------------- conteúdo
  const body = [];
  const summaryBlock = () => {
    const total = project.cases.length || 1;
    const counts = { passou: 0, falhou: 0, bloqueado: 0, nao_executado: 0 };
    for (const c of project.cases) counts[c.status] = (counts[c.status] || 0) + 1;

    const head = ['Resultado', 'Casos', '%'].map(
      (h) =>
        new TableCell({
          borders: cellBorders(t.colors.border),
          shading: { type: ShadingType.CLEAR, fill: hex(t.colors.tableHeaderBg) },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          children: [para(h, t.styles.tableHeader, { spaceAfter: 0 })],
        }),
    );

    const rows = STATUS.map(
      (s, i) =>
        new TableRow({
          children: [
            new TableCell({
              borders: cellBorders(t.colors.border),
              shading: i % 2 === 1 ? { type: ShadingType.CLEAR, fill: hex(t.colors.tableStripe) } : undefined,
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              children: [para(s.label, t.styles.tableCell, { color: t.statusColors[s.key], bold: true, spaceAfter: 0 })],
            }),
            new TableCell({
              borders: cellBorders(t.colors.border),
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              children: [para(String(counts[s.key] || 0), t.styles.tableCell, { spaceAfter: 0 })],
            }),
            new TableCell({
              borders: cellBorders(t.colors.border),
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              children: [para(`${Math.round(((counts[s.key] || 0) / total) * 100)}%`, t.styles.tableCell, { spaceAfter: 0 })],
            }),
          ],
        }),
    );

    return [
      para(t.sections.summary.title, t.styles.h1, { heading: HeadingLevel.HEADING_1 }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [55, 22, 23],
        rows: [new TableRow({ tableHeader: true, children: head }), ...rows],
      }),
      para('', t.styles.body, { spaceAfter: 4 }),
    ];
  };

  if (t.sections.intro.enabled && (t.sections.intro.text || '').trim()) {
    body.push(para(t.sections.intro.title, t.styles.h1, { heading: HeadingLevel.HEADING_1 }));
    body.push(para(t.sections.intro.text, t.styles.body));
  }

  if (t.sections.caseIndex.enabled) {
    body.push(para(t.sections.caseIndex.title, t.styles.h1, { heading: HeadingLevel.HEADING_1 }));
    const withStatus = t.sections.showCaseStatus;
    const head = (withStatus ? ['ID', 'Título', 'Status'] : ['ID', 'Título']).map(
      (h) =>
        new TableCell({
          borders: cellBorders(t.colors.border),
          shading: { type: ShadingType.CLEAR, fill: hex(t.colors.tableHeaderBg) },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          children: [para(h, t.styles.tableHeader, { spaceAfter: 0 })],
        }),
    );
    body.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: withStatus ? [18, 57, 25] : [18, 82],
        rows: [
          new TableRow({ tableHeader: true, children: head }),
          ...project.cases.map(
            (c, i) =>
              new TableRow({
                children: [
                  c.values.codigo || '',
                  c.values.titulo || '—',
                  ...(withStatus ? [statusLabel(c.status)] : []),
                ].map((v, col) =>
                  new TableCell({
                    borders: cellBorders(t.colors.border),
                    shading: i % 2 === 1 ? { type: ShadingType.CLEAR, fill: hex(t.colors.tableStripe) } : undefined,
                    margins: { top: 60, bottom: 60, left: 100, right: 100 },
                    children: [
                      para(v, t.styles.tableCell, {
                        spaceAfter: 0,
                        color: col === 2 ? t.statusColors[c.status] : undefined,
                        bold: col === 2,
                      }),
                    ],
                  }),
                ),
              }),
          ),
        ],
      }),
    );
    body.push(para('', t.styles.body, { spaceAfter: 4 }));
  }

  if (t.sections.summary.enabled && t.sections.summary.position === 'start') body.push(...summaryBlock());

  let figNumber = 0;

  for (let ci = 0; ci < project.cases.length; ci++) {
    const c = project.cases[ci];
    const heading =
      t.caseFields
        .filter((f) => f.show && f.display === 'title')
        .map((f) => c.values[f.key])
        .filter(Boolean)
        .join(' — ') || `Caso de teste ${ci + 1}`;

    body.push(
      new Paragraph({
        pageBreakBefore: ci > 0 && t.sections.caseOnNewPage,
        alignment: ALIGN[t.styles.h1.align],
        spacing: {
          before: Math.round(t.styles.h1.spaceBefore * PT_TWIP),
          after: Math.round(t.styles.h1.spaceAfter * PT_TWIP),
        },
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({ text: heading, ...runOpts(t.styles.h1) }),
          ...(t.sections.showCaseStatus
            ? [new TextRun({ text: `   [${statusLabel(c.status)}]`, ...runOpts(t.styles.h1, { color: t.statusColors[c.status] }) })]
            : []),
        ],
      }),
    );

    body.push(
      ...kvTable(
        t,
        visibleRows(t.caseFields, (f) => c.values[f.key], t.hideEmptyFields).map(({ f, value }) => [f.label, value]),
      ),
    );

    for (let si = 0; si < c.steps.length; si++) {
      const s = c.steps[si];
      const st = t.step;
      const titleTxt = st.numbered ? `${st.stepLabel} ${si + 1}` : st.stepLabel;

      body.push(
        new Paragraph({
          alignment: ALIGN[t.styles.h2.align],
          spacing: {
            before: Math.round(t.styles.h2.spaceBefore * PT_TWIP),
            after: Math.round(t.styles.h2.spaceAfter * PT_TWIP),
          },
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({ text: titleTxt, ...runOpts(t.styles.h2) }),
            ...(st.showStatus
              ? [new TextRun({ text: `   [${statusLabel(s.status)}]`, ...runOpts(t.styles.h2, { color: t.statusColors[s.status] }) })]
              : []),
          ],
        }),
      );

      const field = (label, value) => {
        if (!value) return;
        body.push(para(label, t.styles.h3, { heading: undefined }));
        body.push(para(value, t.styles.body));
      };

      if (st.showDescription) field(st.labels.description, s.description);

      if (s.image) {
        figNumber += 1;
        const { bytes, type } = dataUrlToBytes(s.image);
        const nat = await imageSize(s.image);
        let w = (contentWpx * t.figure.widthPercent) / 100;
        let h = (nat.h / nat.w) * w;
        if (h > maxHpx) {
          h = maxHpx;
          w = (nat.w / nat.h) * h;
        }
        body.push(
          new Paragraph({
            alignment: ALIGN[t.figure.align] ?? AlignmentType.CENTER,
            spacing: { before: 80, after: 40 },
            children: [new ImageRun({ data: bytes, type, transformation: { width: Math.round(w), height: Math.round(h) } })],
          }),
        );
        if (t.figure.caption) {
          const prefix = t.figure.captionPrefix ? `${t.figure.captionPrefix} ${figNumber} — ` : '';
          body.push(para(prefix + (s.caption || 'Evidência do passo'), t.styles.caption));
        }
      }

      if (st.showExpected) field(st.labels.expected, s.expected);
      if (st.showObtained) field(st.labels.obtained, s.obtained);
    }
  }

  if (t.sections.summary.enabled && t.sections.summary.position === 'end') body.push(...summaryBlock());

  if (t.sections.signatures.enabled) {
    body.push(para(t.sections.signatures.title, t.styles.h1, { heading: HeadingLevel.HEADING_1 }));
    body.push(para('', t.styles.body, { spaceAfter: 40 }));
    const n = t.sections.signatures.lines.length || 1;
    body.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        rows: [
          new TableRow({
            children: t.sections.signatures.lines.map(
              (l) =>
                new TableCell({
                  width: { size: 100 / n, type: WidthType.PERCENTAGE },
                  borders: {
                    ...noBorders,
                    top: { style: BorderStyle.SINGLE, size: 6, color: '333333' },
                  },
                  verticalAlign: VerticalAlign.TOP,
                  margins: { top: 100, bottom: 0, left: 150, right: 150 },
                  children: [
                    para(l.name || ' ', t.styles.body, { align: 'center', spaceAfter: 0 }),
                    para(l.role, t.styles.caption, { align: 'center', spaceAfter: 0 }),
                  ],
                }),
            ),
          }),
        ],
      }),
    );
  }

  sections.push({
    properties: pageSetup,
    headers: t.header.enabled
      ? { default: new Header({ children: [hfParagraph(t, t.header, contentTwips)] }) }
      : undefined,
    footers: t.footer.enabled
      ? { default: new Footer({ children: [hfParagraph(t, t.footer, contentTwips)] }) }
      : undefined,
    children: body,
  });

  const doc = new Document({
    creator: coverValue(t, 'responsavel') || 'Gerador de Evidências',
    title: coverValue(t, 'titulo') || 'Documento de Testes Manuais',
    description: coverValue(t, 'sistema') || '',
    sections,
  });

  const blob = await Packer.toBlob(doc);
  return new Uint8Array(await blob.arrayBuffer());
}
