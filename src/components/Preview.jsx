import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store.js';
import { buildDocCss, pageGeometry } from '../doc/docStyles.js';
import { buildBlocks, CoverContent, resolveTokens } from '../doc/blocks.jsx';

/** Espera todas as imagens do container carregarem antes de medir alturas. */
async function waitImages(node) {
  if (!node) return;
  const imgs = [...node.querySelectorAll('img')];
  await Promise.all(
    imgs.map((img) =>
      img.complete && img.naturalWidth
        ? Promise.resolve()
        : new Promise((res) => {
            img.addEventListener('load', res, { once: true });
            img.addEventListener('error', res, { once: true });
          }),
    ),
  );
}

function HeaderFooter({ template, part, page, total }) {
  const cfg = template[part];
  if (!cfg.enabled) return <div className={`doc-${part}`} style={{ border: 0 }} />;

  const text = (raw) => resolveTokens(raw, template, page, total);
  const center = text(cfg.center);
  const slot = (raw, cls) => <div className={`hf-slot ${cls}`}>{text(raw)}</div>;

  return (
    <div className={`doc-${part}${center.trim() ? ' has-center' : ''}`}>
      {part === 'header' && cfg.logo ? <img className="hf-logo" src={cfg.logo} alt="" /> : null}
      {slot(cfg.left, 'l')}
      {slot(cfg.center, 'c')}
      {slot(cfg.right, 'r')}
    </div>
  );
}

export default function Preview() {
  const project = useStore((s) => s.project);
  const zoom = useStore((s) => s.zoom);
  const setZoom = useStore((s) => s.setZoom);
  const template = project.template;

  const measureRef = useRef(null);
  const [pages, setPages] = useState([]);
  const [busy, setBusy] = useState(true);

  const css = useMemo(() => buildDocCss(template), [template]);
  const geo = useMemo(() => pageGeometry(template), [template]);
  const blocks = useMemo(() => buildBlocks(project), [project]);

  // ---- paginação: mede cada bloco e empacota nas folhas
  useLayoutEffect(() => {
    let cancelled = false;
    setBusy(true);

    (async () => {
      const node = measureRef.current;
      if (!node) return;
      await waitImages(node);
      // dois frames para o layout assentar após o carregamento das imagens
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (cancelled) return;

      const kids = [...node.children];
      const limit = geo.contentHpx;
      const out = [];
      let cur = [];
      let used = 0;

      kids.forEach((kid, i) => {
        const h = kid.getBoundingClientRect().height;
        const forceBreak = blocks[i]?.pageBreakBefore && cur.length > 0;
        if (forceBreak || (cur.length > 0 && used + h > limit)) {
          out.push(cur);
          cur = [];
          used = 0;
        }
        cur.push(i);
        used += h;
      });
      if (cur.length) out.push(cur);
      if (!out.length) out.push([]);

      if (!cancelled) {
        setPages(out);
        setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blocks, geo.contentHpx, css]);

  /**
   * `pages` guarda índices para `blocks`. A repaginação é assíncrona (espera as
   * imagens carregarem), então existe um frame em que `blocks` já mudou e os
   * índices ainda são os antigos. Se o documento encolheu — trocar de perfil,
   * desligar o resumo, apagar um caso — os índices sobrando apontariam para
   * fora do array. Aqui eles são descartados e os blocos ainda não paginados
   * vão para o fim, até o efeito recalcular.
   */
  const safePages = useMemo(() => {
    const valid = pages.map((p) => p.filter((i) => i < blocks.length)).filter((p) => p.length);
    const seen = new Set(valid.flat());
    const missing = blocks.map((_, i) => i).filter((i) => !seen.has(i));
    if (missing.length) return [...valid, missing];
    return valid.length ? valid : [[]];
  }, [pages, blocks]);

  const hasCover = template.cover.enabled && template.cover.ownPage;
  const totalPages = safePages.length + (hasCover ? 1 : 0);

  // atalhos de zoom
  useEffect(() => {
    const onWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom(useStore.getState().zoom + (e.deltaY > 0 ? -0.06 : 0.06));
    };
    const el = document.getElementById('preview-scroll');
    el?.addEventListener('wheel', onWheel, { passive: false });
    return () => el?.removeEventListener('wheel', onWheel);
  }, [setZoom]);

  return (
    <div className="preview-root">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <div className="preview-bar">
        <span className="pv-info">
          {totalPages} {totalPages === 1 ? 'página' : 'páginas'} · {template.page.size}{' '}
          {template.page.orientation === 'landscape' ? 'paisagem' : 'retrato'}
          {busy ? ' · calculando…' : ''}
        </span>
        <div className="pv-zoom">
          <button onClick={() => setZoom(zoom - 0.1)} title="Diminuir">−</button>
          <button onClick={() => setZoom(0.75)}>{Math.round(zoom * 100)}%</button>
          <button onClick={() => setZoom(zoom + 0.1)} title="Aumentar">+</button>
        </div>
      </div>

      <div id="preview-scroll" className="preview-scroll">
        <div className="preview-zoom" style={{ transform: `scale(${zoom})`, width: geo.pageWpx }}>
          <div id="doc-pages">
            {hasCover ? (
              <div className="doc-page cover">
                {template.header.showOnCover ? (
                  <HeaderFooter template={template} part="header" page={1} total={totalPages} />
                ) : (
                  <div className="doc-header" style={{ border: 0 }} />
                )}
                <div className="doc-content">
                  <CoverContent template={template} />
                </div>
                {template.footer.showOnCover ? (
                  <HeaderFooter template={template} part="footer" page={1} total={totalPages} />
                ) : (
                  <div className="doc-footer" style={{ border: 0 }} />
                )}
              </div>
            ) : null}

            {safePages.map((idxs, pi) => {
              const pageNum = pi + 1 + (hasCover ? 1 : 0);
              return (
                <div className="doc-page" key={pi}>
                  <HeaderFooter template={template} part="header" page={pageNum} total={totalPages} />
                  <div className="doc-content">
                    {idxs.map((i) => (
                      <div className="blk-wrap" key={blocks[i].id} style={{ display: 'flow-root' }}>
                        {blocks[i].node}
                      </div>
                    ))}
                  </div>
                  <HeaderFooter template={template} part="footer" page={pageNum} total={totalPages} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Container invisível usado só para medir a altura de cada bloco */}
      <div
        ref={measureRef}
        className="measure-box"
        style={{ width: geo.contentWpx }}
        aria-hidden="true"
      >
        {blocks.map((b) => (
          <div className="blk-wrap" key={b.id} style={{ display: 'flow-root' }}>
            {b.node}
          </div>
        ))}
      </div>
    </div>
  );
}
