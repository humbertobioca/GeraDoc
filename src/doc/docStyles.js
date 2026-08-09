import { PAGE_SIZES, MM_PX } from '../defaults.js';

export function pageGeometry(template) {
  const base = PAGE_SIZES[template.page.size] || PAGE_SIZES.A4;
  const landscape = template.page.orientation === 'landscape';
  const wMm = landscape ? base.h : base.w;
  const hMm = landscape ? base.w : base.h;
  const m = template.page.margin;

  const headerMm = template.header.enabled ? template.header.heightMm : 0;
  const footerMm = template.footer.enabled ? template.footer.heightMm : 0;

  const contentWmm = wMm - m.left - m.right;
  const contentHmm = hMm - m.top - m.bottom - headerMm - footerMm;

  return {
    wMm,
    hMm,
    headerMm,
    footerMm,
    contentWmm,
    contentHmm,
    contentWpx: contentWmm * MM_PX,
    contentHpx: contentHmm * MM_PX,
    pageWpx: wMm * MM_PX,
    pageHpx: hMm * MM_PX,
  };
}

const css = (s, extra = '') => `
  font-family: ${s.family}, sans-serif;
  font-size: ${s.size}pt;
  color: ${s.color};
  font-weight: ${s.bold ? 700 : 400};
  font-style: ${s.italic ? 'italic' : 'normal'};
  text-decoration: ${s.underline ? 'underline' : 'none'};
  text-align: ${s.align};
  line-height: ${s.lineHeight};
  margin-top: ${s.spaceBefore}pt;
  margin-bottom: ${s.spaceAfter}pt;
  ${extra}
`;

/** CSS do documento em si. Idêntico no preview e no PDF exportado. */
export function buildDocCss(template) {
  const g = pageGeometry(template);
  const s = template.styles;
  const c = template.colors;
  const m = template.page.margin;

  return `
@page { size: ${g.wMm}mm ${g.hMm}mm; margin: 0; }

.doc-page {
  position: relative;
  width: ${g.wMm}mm;
  height: ${g.hMm}mm;
  background: #fff;
  padding: ${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm;
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.doc-header {
  height: ${g.headerMm}mm;
  flex: 0 0 ${g.headerMm}mm;
  display: flex; align-items: center; gap: 8px;
  ${css(s.headerFooter)}
  margin: 0;
  ${template.header.showRule ? `border-bottom: 0.6pt solid ${c.border};` : ''}
}
.doc-footer {
  height: ${g.footerMm}mm;
  flex: 0 0 ${g.footerMm}mm;
  display: flex; align-items: center; gap: 8px;
  ${css(s.headerFooter)}
  margin: 0;
  ${template.footer.showRule ? `border-top: 0.6pt solid ${c.border};` : ''}
}
/* Os textos do cabeçalho/rodapé nunca são cortados: quebram em até 2 linhas.
   Sem texto ao centro (o caso comum) a coluna da direita fica com toda a
   sobra e o título cresce para a esquerda. Com texto ao centro, as três
   colunas voltam a ser iguais para o do meio ficar realmente centralizado. */
.hf-slot {
  min-width: 0;
  overflow: hidden;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.hf-slot:empty { display: none; }
.hf-slot.l { flex: 0 1 auto; text-align: left; }
.hf-slot.c { flex: 0 1 auto; text-align: center; }
.hf-slot.r { flex: 1 1 auto; text-align: right; }
.doc-header.has-center .hf-slot,
.doc-footer.has-center .hf-slot { flex: 1 1 0; }
.hf-logo { height: ${template.header.logoHeight}mm; width: auto; object-fit: contain; }

.doc-content { flex: 1 1 auto; min-height: 0; }
.doc-page.cover .doc-content { ${template.cover.verticalCenter ? 'display:flex; flex-direction:column; justify-content:center;' : ''} }

.blk { break-inside: avoid; page-break-inside: avoid; }

.st-docTitle { ${css(s.docTitle)} }
.st-subtitle { ${css(s.subtitle)} }
.st-h1 { ${css(s.h1)} }
.st-h2 { ${css(s.h2)} }
.st-h3 { ${css(s.h3)} }
.st-body { ${css(s.body)} white-space: pre-wrap; }
.st-caption { ${css(s.caption)} }

.rule { border: 0; border-top: 1.5pt solid ${c.primary}; margin: 4pt 0 0; }

.cover-logo { display: block; width: ${template.cover.logoWidth}mm; height: auto; margin-bottom: 10mm;
  margin-left: ${template.cover.logoAlign === 'center' ? 'auto' : template.cover.logoAlign === 'right' ? 'auto' : '0'};
  margin-right: ${template.cover.logoAlign === 'center' ? 'auto' : template.cover.logoAlign === 'left' ? 'auto' : '0'}; }

table.doc-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 4pt 0 8pt; }
table.doc-table th {
  ${css(s.tableHeader)}
  background: ${c.tableHeaderBg};
  border: 0.6pt solid ${c.border};
  padding: 4pt 6pt;
  vertical-align: top;
}
table.doc-table td {
  ${css(s.tableCell)}
  border: 0.6pt solid ${c.border};
  padding: 4pt 6pt;
  vertical-align: top;
  word-wrap: break-word;
  white-space: pre-wrap;
}
table.doc-table tr.stripe td { background: ${c.tableStripe}; }
table.doc-table td.k {
  width: 34%;
  font-weight: 700;
  background: ${c.tableStripe};
  color: ${c.primary};
}
/* respiro entre o título e o quadro de dados, configurável no template */
.cover-box {
  margin-top: ${template.cover.gapMm}mm;
  ${template.cover.boxed ? `border: 0.8pt solid ${c.border}; padding: 6mm; border-radius: 2mm;` : ''}
}
.cover-box table.doc-table { margin-top: 0; margin-bottom: 0; }

.fig-wrap { text-align: ${template.figure.align}; margin: 4pt 0 0; }
.fig-wrap img {
  width: ${template.figure.widthPercent}%;
  max-width: 100%;
  max-height: ${template.figure.maxHeightMm}mm;
  height: auto;
  object-fit: contain;
  ${template.figure.border ? `border: 0.75pt solid ${template.figure.borderColor};` : ''}
  border-radius: ${template.figure.borderRadius}pt;
  ${template.figure.shadow ? 'box-shadow: 0 1.5pt 5pt rgba(0,0,0,.18);' : ''}
}

.step-block { margin-bottom: 8pt; }
.lbl { ${css(s.h3)} margin-bottom: 2pt; }
.badge {
  display: inline-block; padding: 1.5pt 7pt; border-radius: 9pt;
  font-size: ${s.tableCell.size}pt; font-family: ${s.tableCell.family}, sans-serif;
  color: #fff; font-weight: 700;
}
.chart-row { display: flex; align-items: center; gap: 6pt; margin: 3pt 0; }
.chart-lbl { width: 30mm; ${css(s.tableCell)} margin: 0; }
.chart-track { flex: 1; height: 9pt; background: #eef1f5; border-radius: 5pt; overflow: hidden; }
.chart-fill { height: 100%; border-radius: 5pt; }
.chart-val { width: 18mm; text-align: right; ${css(s.tableCell)} margin: 0; }

.sig-grid { display: flex; gap: 12mm; margin-top: 16mm; }
.sig { flex: 1; text-align: center; }
.sig .line { border-top: 0.8pt solid #333; margin-bottom: 3pt; }
`;
}

/** Documento HTML autocontido usado pelo printToPDF. */
export function buildStandaloneHtml(template, pagesHtml, title) {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(title || 'Documento')}</title>
<style>
  *{ box-sizing: border-box; }
  html,body{ margin:0; padding:0; background:#fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .doc-page{ page-break-after: always; break-after: page; }
  .doc-page:last-child{ page-break-after: auto; break-after: auto; }
  ${buildDocCss(template)}
</style></head>
<body>${pagesHtml}</body></html>`;
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
