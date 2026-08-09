/**
 * Gera build/icon.ico e build/icon.png a partir de build/icon.svg.
 *
 * Usa o próprio Electron como rasterizador (nenhuma dependência extra):
 * renderiza o SVG num BrowserWindow transparente, captura a página e
 * redimensiona para os tamanhos que o Windows pede.
 *
 *   npm run icon
 */
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const BUILD = path.join(ROOT, 'build');
const SIZES = [16, 24, 32, 48, 64, 128, 256];
const RENDER = 512;

/** Monta um .ico com PNGs embutidos (formato aceito do Windows Vista em diante). */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // tipo: ícone
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  let offset = 6 + images.length * 16;

  for (const { size, buf } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // 0 significa 256
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // cores da paleta
    e.writeUInt8(0, 3); // reservado
    e.writeUInt16LE(1, 4); // planos
    e.writeUInt16LE(32, 6); // bits por pixel
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += buf.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.buf)]);
}

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const svg = fs.readFileSync(path.join(BUILD, 'icon.svg'), 'utf8');

  const win = new BrowserWindow({
    width: RENDER,
    height: RENDER,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    useContentSize: true,
    webPreferences: { offscreen: true },
  });

  const html = `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:transparent;width:${RENDER}px;height:${RENDER}px;overflow:hidden}
    svg{display:block;width:${RENDER}px;height:${RENDER}px}
  </style>${svg}`;

  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 500));

  const shot = await win.webContents.capturePage();
  const { width, height } = shot.getSize();
  if (width !== RENDER || height !== RENDER) {
    console.error(`Captura saiu em ${width}x${height}, esperado ${RENDER}x${RENDER}`);
    app.exit(1);
    return;
  }

  // canto deve ser transparente — se não for, o fundo vazou para o ícone
  const bmp = shot.toBitmap(); // BGRA
  const cornerAlpha = bmp[3];
  const centerAlpha = bmp[((RENDER / 2) * RENDER + RENDER / 2) * 4 + 3];

  const images = SIZES.map((size) => ({
    size,
    buf: shot.resize({ width: size, height: size, quality: 'best' }).toPNG(),
  }));

  fs.writeFileSync(path.join(BUILD, 'icon.ico'), buildIco(images));
  fs.writeFileSync(path.join(BUILD, 'icon.png'), shot.resize({ width: 256, height: 256, quality: 'best' }).toPNG());

  console.log(`icon.ico  ${SIZES.join(', ')} px  (${fs.statSync(path.join(BUILD, 'icon.ico')).size} bytes)`);
  console.log(`icon.png  256px  (${fs.statSync(path.join(BUILD, 'icon.png')).size} bytes)`);
  console.log(`alfa: canto=${cornerAlpha} centro=${centerAlpha}`);

  if (cornerAlpha !== 0) console.warn('AVISO: o canto do ícone não ficou transparente.');
  if (centerAlpha !== 255) console.warn('AVISO: o centro do ícone ficou translúcido.');

  app.exit(cornerAlpha === 0 && centerAlpha === 255 ? 0 : 1);
});
