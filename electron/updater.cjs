const { app, ipcMain, BrowserWindow } = require('electron');
const { autoUpdater } = require('electron-updater');
const prefs = require('./prefs.cjs');

/**
 * Atualização automática.
 *
 * O download nunca começa sozinho: o app avisa, o usuário decide. Antes de
 * reiniciar para instalar, tudo que está aberto é gravado e a lista de janelas
 * é anotada, para o app voltar exatamente como estava.
 */

let broadcast = () => {};
let saveEverything = async () => {};
let state = { status: 'idle', version: null, percent: 0, error: null };

const isPackaged = () => app.isPackaged;

function setState(patch) {
  state = { ...state, ...patch };
  broadcast('update:state', state);
}

function configure() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.logger = null;
  // instalador por usuário: a atualização também não pede administrador
  autoUpdater.allowDowngrade = false;

  const url = prefs.get('updateFeedUrl');
  if (url) {
    try {
      autoUpdater.setFeedURL({ provider: 'generic', url });
    } catch (err) {
      console.error('Endereço de atualização inválido:', err.message);
    }
  }
}

function wireEvents() {
  autoUpdater.on('checking-for-update', () => setState({ status: 'checking', error: null }));

  autoUpdater.on('update-available', (info) =>
    setState({ status: 'available', version: info.version, error: null }),
  );

  autoUpdater.on('update-not-available', () =>
    setState({ status: 'uptodate', version: app.getVersion(), error: null }),
  );

  autoUpdater.on('download-progress', (p) =>
    setState({ status: 'downloading', percent: Math.round(p.percent) }),
  );

  autoUpdater.on('update-downloaded', (info) =>
    setState({ status: 'downloaded', version: info.version, percent: 100 }),
  );

  autoUpdater.on('error', (err) =>
    setState({ status: 'error', error: String(err?.message || err) }),
  );
}

/**
 * Fecha para instalar. Antes disso grava tudo e anota quais janelas reabrir —
 * documentos salvos voltam do arquivo, os não salvos voltam do rascunho.
 */
async function installAndRestart(sessionOf) {
  await saveEverything();
  prefs.set({ restoreSession: sessionOf() });
  setState({ status: 'installing' });
  setImmediate(() => autoUpdater.quitAndInstall(false, true));
}

function init({ broadcast: b, saveEverything: s, sessionOf }) {
  broadcast = b;
  saveEverything = s;
  configure();
  wireEvents();

  ipcMain.handle('update:state', () => state);

  ipcMain.handle('update:check', async () => {
    if (!isPackaged()) {
      setState({ status: 'dev', error: null });
      return state;
    }
    try {
      await autoUpdater.checkForUpdates();
    } catch (err) {
      setState({ status: 'error', error: String(err?.message || err) });
    }
    return state;
  });

  ipcMain.handle('update:download', async () => {
    try {
      await autoUpdater.downloadUpdate();
    } catch (err) {
      setState({ status: 'error', error: String(err?.message || err) });
    }
    return state;
  });

  ipcMain.handle('update:install', async () => {
    await installAndRestart(sessionOf);
    return true;
  });

  ipcMain.handle('update:feedUrl', (_e, url) => {
    prefs.set({ updateFeedUrl: url || null });
    configure();
    return prefs.get('updateFeedUrl');
  });

  // checagem silenciosa alguns segundos depois de abrir, para não atrasar o app
  if (isPackaged() && prefs.get('autoCheckUpdates')) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {
        /* sem rede ou servidor fora: silencioso, tenta na próxima abertura */
      });
    }, 6000);
  }
}

module.exports = { init };
