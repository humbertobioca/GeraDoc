const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  screen,
  dialog,
  shell,
} = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { grabAllScreens } = require('./capture/screens.cjs');
const prefs = require('./prefs.cjs');
const updater = require('./updater.cjs');

const isDev = process.env.NODE_ENV === 'development';

/** Extensão própria do app — é ela que o Windows associa a este programa. */
const EXT = 'evid';
const FILTERS = [{ name: 'Documento do GeraDoc', extensions: [EXT] }];

const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * O Bloco de Notas e o PowerShell gravam UTF-8 com BOM, e o BOM faz o
 * JSON.parse falhar. Toda leitura de projeto passa por aqui.
 */
const stripBom = (text) => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
const readText = async (filePath) => stripBom(await fs.readFile(filePath, 'utf8'));

// ---------------------------------------------------------------- estado global

/**
 * Uma janela por documento. A chave é o id do webContents, que é o que chega
 * junto de cada mensagem IPC — assim cada handler sabe de qual documento veio.
 * @type {Map<number, { docId: string, win: BrowserWindow }>}
 */
const docWindows = new Map();

/** Estado que o renderer reporta: se tem arquivo e se há alteração pendente. */
const docState = new Map(); // webContents.id -> { filePath, dirty }

/** Janelas já autorizadas a fechar, para o handler de 'close' não repetir. */
const allowedToClose = new WeakSet();

/** Pedidos de salvamento aguardando resposta do renderer. */
const saveWaiters = new Map();

let lastFocused = null;
let overlayWindows = [];
let hiddenForCapture = [];
let capturing = false;
let captureRequester = null;
let activeShortcut = null;

const userDataDir = () => app.getPath('userData');
const draftsDir = () => path.join(userDataDir(), 'drafts');
const draftFile = (docId) => path.join(draftsDir(), `${docId}.json`);
const templatesDir = () => path.join(userDataDir(), 'templates');
const legacyAutosave = () => path.join(userDataDir(), 'autosave.json');

const winOf = (e) => BrowserWindow.fromWebContents(e.sender);
const docOf = (e) => docWindows.get(e.sender.id);

/** Janela que deve receber uma captura disparada pelo atalho global. */
function targetWindow() {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && docWindows.has(focused.webContents.id)) return focused;
  if (lastFocused && !lastFocused.isDestroyed()) return lastFocused;
  const first = docWindows.values().next().value;
  return first ? first.win : null;
}

// ---------------------------------------------------------------- janelas

/** Só reaproveita a posição salva se ela ainda cair dentro de algum monitor. */
function visibleBounds(saved) {
  if (!saved) return null;
  const fits = screen.getAllDisplays().some((d) => {
    const b = d.workArea;
    return (
      saved.x < b.x + b.width &&
      saved.x + saved.width > b.x &&
      saved.y < b.y + b.height &&
      saved.y + saved.height > b.y
    );
  });
  return fits ? saved : null;
}

function createWindow({ docId = uid(), open = null } = {}) {
  const saved = visibleBounds(prefs.get('windowBounds'));
  // cada janela nova entra deslocada, para não cobrir exatamente a anterior
  const step = docWindows.size * 28;

  const win = new BrowserWindow({
    width: saved?.width ?? 1500,
    height: saved?.height ?? 950,
    x: saved?.x != null ? saved.x + step : undefined,
    y: saved?.y != null ? saved.y + step : undefined,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#12151c',
    show: false,
    frame: false, // a barra de título é desenhada pela própria interface
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    title: 'GeraDoc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
      additionalArguments: [`--doc-id=${docId}`],
    },
  });

  docWindows.set(win.webContents.id, { docId, win });

  if (isDev) win.loadURL('http://localhost:5173');
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  win.once('ready-to-show', () => {
    if (docWindows.size === 1 && prefs.get('windowMaximized')) win.maximize();
    win.show();
  });

  if (open) {
    win.webContents.once('did-finish-load', () =>
      win.webContents.send('file:open', open),
    );
  }

  // guarda posição e tamanho da janela principal, sem gravar a cada pixel
  let boundsTimer = null;
  const rememberBounds = () => {
    clearTimeout(boundsTimer);
    boundsTimer = setTimeout(() => {
      if (win.isDestroyed() || docWindows.size > 1) return;
      prefs.set({
        windowMaximized: win.isMaximized(),
        ...(win.isMaximized() ? {} : { windowBounds: win.getBounds() }),
      });
    }, 500);
  };
  win.on('resize', rememberBounds);
  win.on('move', rememberBounds);
  win.on('focus', () => {
    lastFocused = win;
  });

  const sendMax = () => {
    if (!win.isDestroyed()) win.webContents.send('win:maximized', win.isMaximized());
  };
  win.on('maximize', sendMax);
  win.on('unmaximize', sendMax);

  // Pergunta antes de descartar trabalho não salvo.
  win.on('close', (e) => {
    if (allowedToClose.has(win)) return;
    const st = docState.get(win.webContents.id);
    if (!st?.dirty) return;

    e.preventDefault();
    confirmClose(win, docId).then((fechar) => {
      if (!fechar || win.isDestroyed()) return;
      allowedToClose.add(win);
      win.destroy();
    });
  });

  win.on('closed', () => {
    clearTimeout(boundsTimer);
    docWindows.delete(win.webContents.id);
    docState.delete(win.webContents.id);
    saveWaiters.delete(win.webContents.id);
    if (lastFocused === win) lastFocused = null;
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

// ---------------------------------------------------------------- salvar e fechar

/**
 * Pede ao renderer que salve. Ele é quem tem o documento em memória, então o
 * salvamento acontece lá e a resposta volta por IPC.
 * @returns {Promise<boolean>} true se salvou
 */
function requestSave(win, { silent = false } = {}) {
  return new Promise((resolve) => {
    if (win.isDestroyed()) return resolve(false);
    const id = win.webContents.id;

    const timer = setTimeout(() => {
      if (saveWaiters.delete(id)) resolve(false);
    }, 120000);

    saveWaiters.set(id, (okSaved) => {
      clearTimeout(timer);
      resolve(okSaved);
    });

    win.webContents.send('app:requestSave', { silent });
  });
}

ipcMain.on('app:saveResult', (e, okSaved) => {
  const resolve = saveWaiters.get(e.sender.id);
  if (resolve) {
    saveWaiters.delete(e.sender.id);
    resolve(!!okSaved);
  }
});

ipcMain.on('doc:state', (e, st) => {
  docState.set(e.sender.id, st);
  const win = winOf(e);
  if (!win || win.isDestroyed()) return;
  // o título mostra o arquivo; sem arquivo, só o nome do app
  const nome = st?.filePath ? path.basename(st.filePath) : null;
  win.setTitle(nome ? `${nome} — GeraDoc` : 'GeraDoc');
});

async function confirmClose(win, docId) {
  const { response } = await dialog.showMessageBox(win, {
    type: 'warning',
    noLink: true,
    buttons: ['Salvar', 'Não salvar', 'Cancelar'],
    defaultId: 0,
    cancelId: 2,
    title: 'Fechar documento',
    message: 'Este documento tem alterações não salvas.',
    detail: 'Deseja salvá-las antes de fechar?',
  });

  if (response === 2) return false;
  if (response === 0) return requestSave(win);

  // "Não salvar": o rascunho temporário some junto, senão voltaria ao reabrir
  await fs.rm(draftFile(docId), { force: true });
  return true;
}

/** Grava tudo que está aberto, sem diálogos — usado antes de atualizar. */
async function saveEverything() {
  const wins = [...docWindows.values()].map((d) => d.win).filter((w) => !w.isDestroyed());
  await Promise.all(wins.map((w) => requestSave(w, { silent: true })));
}

/** Fotografia das janelas abertas, para reabrir depois da atualização. */
function currentSession() {
  return [...docWindows.entries()].map(([wcId, d]) => ({
    docId: d.docId,
    filePath: docState.get(wcId)?.filePath ?? null,
  }));
}

// ---------------------------------------------------------------- captura de tela

function closeOverlays() {
  const wins = overlayWindows;
  overlayWindows = [];
  for (const w of wins) {
    if (w.isDestroyed()) continue;
    w.removeAllListeners('closed'); // evita reentrar aqui ao fechar as irmãs
    w.close();
  }
  capturing = false;

  // devolve as janelas que escondemos para não sujar o print
  for (const w of hiddenForCapture) if (!w.isDestroyed()) w.showInactive();
  hiddenForCapture = [];

  // traz para frente quem pediu a captura — restaurando se estava minimizada,
  // senão o editor de marcações abriria numa janela invisível
  const win =
    captureRequester && !captureRequester.isDestroyed()
      ? BrowserWindow.fromWebContents(captureRequester)
      : targetWindow();
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
}

async function startCapture(requester = null) {
  if (capturing) return;
  capturing = true;

  const target = requester || targetWindow()?.webContents || null;
  captureRequester = target;

  try {
    hiddenForCapture = [...docWindows.values()]
      .map((d) => d.win)
      .filter((w) => !w.isDestroyed() && w.isVisible() && !w.isMinimized());
    for (const w of hiddenForCapture) w.hide();
    if (hiddenForCapture.length) await delay(220);

    const shots = await grabAllScreens();
    if (!shots.length) {
      closeOverlays();
      return;
    }

    // Uma janela de seleção por monitor: o usuário escolhe em qual tela recortar.
    overlayWindows = shots.map(({ display }) => {
      const win = new BrowserWindow({
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height,
        frame: false,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        enableLargerThanScreen: true,
        backgroundColor: '#000000',
        webPreferences: {
          preload: path.join(__dirname, 'preload.cjs'),
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      win.setAlwaysOnTop(true, 'screen-saver');
      win.setVisibleOnAllWorkspaces(true);
      win.on('closed', closeOverlays);
      return win;
    });

    await Promise.all(
      overlayWindows.map(async (win, i) => {
        await win.loadFile(path.join(__dirname, 'capture', 'overlay.html'));
        if (win.isDestroyed()) return;
        win.webContents.send('overlay:image', {
          dataUrl: shots[i].dataUrl,
          index: i + 1,
          total: shots.length,
        });
      }),
    );

    const point = screen.getCursorScreenPoint();
    const activeId = screen.getDisplayNearestPoint(point).id;
    const start = shots.findIndex((s) => s.display.id === activeId);
    const focusWin = overlayWindows[start >= 0 ? start : 0];
    if (focusWin && !focusWin.isDestroyed()) focusWin.focus();
  } catch (err) {
    console.error('Falha na captura:', err);
    closeOverlays();
  }
}

/** Registra o atalho global; devolve qual acelerador ficou ativo. */
function registerCaptureShortcut(preferred) {
  globalShortcut.unregisterAll();
  const candidates = [preferred, 'PrintScreen', 'CommandOrControl+Shift+X', 'Alt+Shift+S'].filter(
    Boolean,
  );
  for (const accel of candidates) {
    try {
      if (globalShortcut.register(accel, () => startCapture())) {
        activeShortcut = accel;
        return accel;
      }
    } catch {
      /* acelerador inválido, tenta o próximo */
    }
  }
  activeShortcut = null;
  return null;
}

// ---------------------------------------------------------------- rascunhos

async function listDrafts() {
  try {
    const files = await fs.readdir(draftsDir());
    return files.filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
  } catch {
    return [];
  }
}

/** Move o autosave.json de versões antigas para o novo formato de rascunhos. */
async function migrateLegacyDraft() {
  try {
    if (!fsSync.existsSync(legacyAutosave())) return;
    if ((await listDrafts()).length) return;
    await fs.mkdir(draftsDir(), { recursive: true });
    await fs.rename(legacyAutosave(), draftFile(uid()));
  } catch {
    /* rascunho antigo é descartável */
  }
}

// ---------------------------------------------------------------- IPC: janela

ipcMain.on('win:minimize', (e) => winOf(e)?.minimize());
ipcMain.on('win:toggleMaximize', (e) => {
  const w = winOf(e);
  if (!w) return;
  w.isMaximized() ? w.unmaximize() : w.maximize();
});
ipcMain.on('win:close', (e) => winOf(e)?.close());
ipcMain.handle('win:isMaximized', (e) => !!winOf(e)?.isMaximized());
ipcMain.handle('doc:info', (e) => ({
  docId: docOf(e)?.docId ?? null,
  windowCount: docWindows.size,
}));

// ---------------------------------------------------------------- IPC: captura

ipcMain.handle('capture:start', (e) => {
  startCapture(e.sender);
  return true;
});

ipcMain.handle('capture:shortcut', (_e, accel) => {
  const active = registerCaptureShortcut(accel);
  if (active) prefs.set({ captureShortcut: active });
  return active;
});
ipcMain.handle('capture:activeShortcut', () => activeShortcut);

ipcMain.on('overlay:result', (_e, dataUrl) => {
  if (dataUrl && captureRequester && !captureRequester.isDestroyed()) {
    captureRequester.send('capture:done', dataUrl);
  }
  closeOverlays();
});

ipcMain.on('overlay:cancel', () => closeOverlays());

ipcMain.on('overlay:focus', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win && !win.isDestroyed() && !win.isFocused()) win.focus();
});

/**
 * O Windows 11 pode reservar a tecla PrintScreen para a Ferramenta de Captura.
 * Quando isso está ligado, o atalho global do app nunca recebe a tecla.
 */
ipcMain.handle('system:printScreenConflict', () => {
  if (process.platform !== 'win32') return false;

  // No Windows 11 a opção vem LIGADA de fábrica e a chave só existe depois que
  // alguém mexe nela — ausente, portanto, significa que o Windows fica com a tecla.
  const build = Number(os.release().split('.')[2] || 0);
  const win11 = build >= 22000;

  return new Promise((resolve) => {
    execFile(
      'reg',
      ['query', 'HKCU\\Control Panel\\Keyboard', '/v', 'PrintScreenKeyForSnippingEnabled'],
      (err, stdout) => {
        if (err) return resolve(win11); // chave ausente
        const m = /PrintScreenKeyForSnippingEnabled\s+REG_DWORD\s+0x([0-9a-fA-F]+)/.exec(stdout);
        resolve(m ? parseInt(m[1], 16) === 1 : win11);
      },
    );
  });
});

/** Libera a tecla, a pedido explícito do usuário. Grava em HKCU, sem admin. */
ipcMain.handle('system:releasePrintScreen', () => {
  if (process.platform !== 'win32') return false;
  return new Promise((resolve) => {
    execFile(
      'reg',
      [
        'add', 'HKCU\\Control Panel\\Keyboard',
        '/v', 'PrintScreenKeyForSnippingEnabled',
        '/t', 'REG_DWORD', '/d', '0', '/f',
      ],
      (err) => resolve(!err),
    );
  });
});

// ---------------------------------------------------------------- IPC: documento

/** Pergunta em qual janela abrir, respeitando o "não perguntar mais". */
async function chooseTarget(kind, parentWin) {
  const askKey = kind === 'new' ? 'askOnNew' : 'askOnOpen';
  const targetKey = kind === 'new' ? 'newTarget' : 'openTarget';

  if (!prefs.get(askKey)) return prefs.get(targetKey) || 'current';

  const { response, checkboxChecked } = await dialog.showMessageBox(parentWin, {
    type: 'question',
    noLink: true,
    buttons: ['Nesta janela', 'Em uma nova janela', 'Cancelar'],
    defaultId: 0,
    cancelId: 2,
    title: kind === 'new' ? 'Novo documento' : 'Abrir documento',
    message: kind === 'new' ? 'Onde criar o novo documento?' : 'Onde abrir o documento?',
    detail:
      kind === 'new'
        ? 'Você pode manter vários documentos abertos ao mesmo tempo, cada um em sua janela.'
        : 'Abrir em uma nova janela mantém o documento atual como está.',
    checkboxLabel: 'Não perguntar mais',
    checkboxChecked: false,
  });

  if (response === 2) return 'cancel';
  const target = response === 0 ? 'current' : 'new';
  if (checkboxChecked) prefs.set({ [askKey]: false, [targetKey]: target });
  return target;
}

ipcMain.handle('doc:new', async (e) => {
  const target = await chooseTarget('new', winOf(e));
  if (target === 'cancel') return { action: 'cancel' };

  if (target === 'new') {
    createWindow();
    return { action: 'newWindow' };
  }

  const info = docOf(e);
  if (info) await fs.rm(draftFile(info.docId), { force: true });
  prefs.set({ lastProjectPath: null });
  return { action: 'current' };
});

ipcMain.handle('doc:open', async (e) => {
  const win = winOf(e);
  const target = await chooseTarget('open', win);
  if (target === 'cancel') return { action: 'cancel' };

  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Abrir documento',
    defaultPath: prefs.defaultDir(),
    properties: ['openFile'],
    filters: FILTERS,
  });
  if (canceled || !filePaths[0]) return { action: 'cancel' };

  const p = filePaths[0];
  const json = await readText(p);
  prefs.set({ lastProjectPath: p, lastProjectDir: path.dirname(p) });

  if (target === 'new') {
    createWindow({ open: { path: p, json } });
    return { action: 'newWindow' };
  }
  return { action: 'current', path: p, json };
});

ipcMain.handle('doc:resetAskPrefs', () =>
  prefs.set({ askOnNew: true, askOnOpen: true }),
);

// ---------------------------------------------------------------- IPC: persistência

/** Rascunho temporário, por documento, enquanto não há arquivo escolhido. */
ipcMain.handle('project:autosave', async (e, json) => {
  const info = docOf(e);
  if (!info) return null;
  await fs.mkdir(draftsDir(), { recursive: true });
  await fs.writeFile(draftFile(info.docId), json, 'utf8');
  return draftFile(info.docId);
});

ipcMain.handle('project:loadDraft', async (e) => {
  const info = docOf(e);
  if (!info) return null;
  try {
    return await readText(draftFile(info.docId));
  } catch {
    return null;
  }
});

ipcMain.handle('project:save', async (e, { json, filePath }) => {
  if (!filePath) return null;
  await fs.writeFile(filePath, json, 'utf8');
  prefs.set({ lastProjectPath: filePath, lastProjectDir: path.dirname(filePath) });
  // a partir de agora o arquivo é a fonte da verdade: o rascunho não serve mais
  const info = docOf(e);
  if (info) await fs.rm(draftFile(info.docId), { force: true });
  return filePath;
});

ipcMain.handle('project:saveAs', async (e, { json, suggestedName }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(winOf(e), {
    title: 'Salvar documento',
    defaultPath: path.join(prefs.defaultDir(), `${suggestedName || 'documento'}.${EXT}`),
    filters: FILTERS,
  });
  if (canceled || !filePath) return null;
  await fs.writeFile(filePath, json, 'utf8');
  prefs.set({ lastProjectPath: filePath, lastProjectDir: path.dirname(filePath) });
  const info = docOf(e);
  if (info) await fs.rm(draftFile(info.docId), { force: true });
  return filePath;
});

/** Reabre o último documento ao iniciar, se o arquivo ainda existir. */
ipcMain.handle('project:loadLast', async () => {
  const p = prefs.get('lastProjectPath');
  if (!p || !fsSync.existsSync(p)) return null;
  try {
    return { path: p, json: await readText(p) };
  } catch {
    return null;
  }
});

ipcMain.handle('project:forget', () => prefs.set({ lastProjectPath: null }));

ipcMain.handle('prefs:get', () => prefs.get());
ipcMain.handle('prefs:set', (_e, patch) => prefs.set(patch));

// ---------------------------------------------------------------- IPC: templates

ipcMain.handle('template:list', async () => {
  try {
    const files = await fs.readdir(templatesDir());
    return files.filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
  } catch {
    return [];
  }
});

ipcMain.handle('template:save', async (_e, { name, json }) => {
  await fs.mkdir(templatesDir(), { recursive: true });
  const safe = String(name).replace(/[^\w\-. ]+/g, '_').trim() || 'template';
  await fs.writeFile(path.join(templatesDir(), `${safe}.json`), json, 'utf8');
  return safe;
});

ipcMain.handle('template:load', async (_e, name) => {
  try {
    return await readText(path.join(templatesDir(), `${name}.json`));
  } catch {
    return null;
  }
});

ipcMain.handle('template:delete', async (_e, name) => {
  try {
    await fs.unlink(path.join(templatesDir(), `${name}.json`));
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('shell:openTemplatesFolder', async () => {
  await fs.mkdir(templatesDir(), { recursive: true });
  shell.openPath(templatesDir());
});

// ---------------------------------------------------------------- IPC: exportação

ipcMain.handle('export:pdf', async (e, { html, suggestedName, page }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(winOf(e), {
    title: 'Exportar PDF',
    // sempre ao lado do documento salvo — é lá que a evidência costuma morar
    defaultPath: path.join(prefs.defaultDir(), `${suggestedName || 'documento'}.pdf`),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return null;
  prefs.set({ lastExportDir: path.dirname(filePath) });

  const tmp = path.join(os.tmpdir(), `geradoc-${Date.now()}.html`);
  await fs.writeFile(tmp, html, 'utf8');

  const win = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false },
  });

  try {
    await win.loadFile(tmp);
    await delay(600); // dá tempo para fontes e imagens base64 renderizarem
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: page?.size === 'Letter' ? 'Letter' : 'A4',
      landscape: page?.orientation === 'landscape',
      margins: { marginType: 'none' },
      preferCSSPageSize: true,
    });
    await fs.writeFile(filePath, pdf);
    return filePath;
  } finally {
    win.destroy();
    fs.unlink(tmp).catch(() => {});
  }
});

ipcMain.handle('export:docx', async (e, { buffer, suggestedName }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(winOf(e), {
    title: 'Exportar Word',
    defaultPath: path.join(prefs.defaultDir(), `${suggestedName || 'documento'}.docx`),
    filters: [{ name: 'Documento do Word', extensions: ['docx'] }],
  });
  if (canceled || !filePath) return null;
  prefs.set({ lastExportDir: path.dirname(filePath) });
  await fs.writeFile(filePath, Buffer.from(buffer));
  return filePath;
});

ipcMain.handle('shell:showItem', (_e, filePath) => {
  if (filePath) shell.showItemInFolder(filePath);
});

ipcMain.handle('image:pickFiles', async (e) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(winOf(e), {
    title: 'Selecionar imagens',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] }],
  });
  if (canceled) return [];
  const out = [];
  for (const p of filePaths) {
    const buf = await fs.readFile(p);
    const ext = path.extname(p).slice(1).toLowerCase();
    out.push(`data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${buf.toString('base64')}`);
  }
  return out;
});

// ---------------------------------------------------------------- abertura de arquivo

/** Acha um arquivo .evid passado na linha de comando (duplo clique no Explorer). */
function fileFromArgv(argv) {
  return (
    argv
      .slice(1)
      .find((a) => !a.startsWith('-') && a.toLowerCase().endsWith(`.${EXT}`) && fsSync.existsSync(a)) ||
    null
  );
}

/** Um arquivo vindo de fora sempre ganha a sua própria janela. */
async function openFileInNewWindow(filePath) {
  try {
    const json = await readText(filePath);
    prefs.set({ lastProjectPath: filePath, lastProjectDir: path.dirname(filePath) });
    createWindow({ open: { path: filePath, json } });
  } catch (err) {
    console.error('Não foi possível abrir o arquivo:', err.message);
  }
}

// ---------------------------------------------------------------- ciclo de vida

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    const file = fileFromArgv(argv);
    if (file) {
      openFileInNewWindow(file);
      return;
    }
    const win = targetWindow();
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

  app.whenReady().then(async () => {
    await migrateLegacyDraft();
    registerCaptureShortcut(prefs.get('captureShortcut'));

    updater.init({
      broadcast: (channel, payload) => {
        for (const { win } of docWindows.values()) {
          if (!win.isDestroyed()) win.webContents.send(channel, payload);
        }
      },
      saveEverything,
      sessionOf: currentSession,
    });

    const file = fileFromArgv(process.argv);
    const sessao = prefs.get('restoreSession');

    if (file) {
      await openFileInNewWindow(file);
    } else if (sessao?.length) {
      // volta exatamente como estava antes de instalar a atualização
      prefs.set({ restoreSession: null });
      for (const item of sessao) {
        if (item.filePath && fsSync.existsSync(item.filePath)) {
          const json = await readText(item.filePath).catch(() => null);
          if (json) {
            createWindow({ docId: item.docId, open: { path: item.filePath, json } });
            continue;
          }
        }
        createWindow({ docId: item.docId });
      }
      if (!docWindows.size) createWindow();
    } else {
      // uma janela por rascunho pendente (trabalho não salvo da sessão anterior)
      const drafts = await listDrafts();
      if (drafts.length) for (const docId of drafts) createWindow({ docId });
      else createWindow();
    }

    app.on('activate', () => {
      if (docWindows.size === 0) createWindow();
    });
  });
}

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
