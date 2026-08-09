import { buildStandaloneHtml } from '../doc/docStyles.js';
import { coverValue } from '../doc/blocks.jsx';

export const slug = (s) =>
  String(s || 'documento')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'documento';

/**
 * Exporta o PDF a partir do MESMO DOM que está no preview.
 * Isso garante que o arquivo saia exatamente igual ao que se vê na tela.
 */
export async function exportPdf(project) {
  const node = document.getElementById('doc-pages');
  if (!node) throw new Error('Preview ainda não foi renderizado.');

  const title = coverValue(project.template, 'titulo') || 'Documento de Testes';
  const html = buildStandaloneHtml(project.template, node.innerHTML, title);

  return window.api.exportPdf({
    html,
    suggestedName: slug(title),
    page: project.template.page,
  });
}
