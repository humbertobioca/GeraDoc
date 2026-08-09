const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

/**
 * Preferências do usuário, gravadas em %APPDATA%\gerador-evidencias\prefs.json.
 * Sobrevivem à desinstalação (deleteAppDataOnUninstall = false).
 */
const DEFAULTS = {
  sidebarWidth: 500,
  zoom: 0.75,
  tab: 'conteudo',
  captureShortcut: 'PrintScreen',
  lastProjectPath: null, // último .evid aberto/salvo — reaberto ao iniciar
  lastProjectDir: null, // pasta usada nos diálogos de abrir/salvar
  lastExportDir: null, // usada só quando não há projeto salvo
  windowBounds: null,
  windowMaximized: false,

  // "Novo" e "Abrir": perguntar em qual janela, com opção de não perguntar mais
  askOnNew: true,
  askOnOpen: true,
  newTarget: 'current', // 'current' | 'new'
  openTarget: 'current',

  // atualização
  autoCheckUpdates: true,
  updateFeedUrl: null, // sobrepõe o endereço definido no build, se preenchido
  /**
   * Janelas a reabrir na próxima inicialização. Preenchido só quando o app é
   * fechado para instalar uma atualização — num fechamento comum fica vazio.
   * @type {{docId: string, filePath: string|null}[] | null}
   */
  restoreSession: null,
};

const file = () => path.join(app.getPath('userData'), 'prefs.json');

let cache = null;

function all() {
  if (cache) return cache;
  try {
    cache = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file(), 'utf8')) };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

function get(key) {
  return key === undefined ? all() : all()[key];
}

function set(patch) {
  cache = { ...all(), ...patch };
  try {
    fs.writeFileSync(file(), JSON.stringify(cache, null, 2), 'utf8');
  } catch (err) {
    console.error('Não foi possível gravar as preferências:', err.message);
  }
  return cache;
}

/** Pasta que os diálogos devem abrir: onde está o projeto, senão a última usada. */
function defaultDir() {
  const p = all();
  const fromProject = p.lastProjectPath ? path.dirname(p.lastProjectPath) : null;
  for (const dir of [fromProject, p.lastProjectDir, p.lastExportDir]) {
    if (dir && fs.existsSync(dir)) return dir;
  }
  return app.getPath('documents');
}

module.exports = { get, set, defaultDir, DEFAULTS };
