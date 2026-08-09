const { desktopCapturer, screen } = require('electron');

/**
 * Fotografa TODOS os monitores de uma vez, cada um em resolução nativa.
 *
 * `getSources` usa um único `thumbnailSize` para todas as telas, então pedimos
 * a maior resolução física do conjunto — assim nenhum monitor sai reduzido.
 * Monitores com escala do Windows (125%, 150%…) têm resolução física maior que
 * a lógica, daí a multiplicação por `scaleFactor`.
 */
async function grabAllScreens() {
  const displays = screen.getAllDisplays();
  const physical = (d) => ({
    w: Math.round(d.size.width * (d.scaleFactor || 1)),
    h: Math.round(d.size.height * (d.scaleFactor || 1)),
  });

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.max(...displays.map((d) => physical(d).w)),
      height: Math.max(...displays.map((d) => physical(d).h)),
    },
    fetchWindowIcons: false,
  });

  return displays
    .map((display, i) => {
      const source =
        sources.find((s) => String(s.display_id) === String(display.id)) || sources[i];
      if (!source || source.thumbnail.isEmpty()) return null;
      return { display, source, dataUrl: source.thumbnail.toDataURL() };
    })
    .filter(Boolean);
}

module.exports = { grabAllScreens };
