/**
 * Rede de segurança para a ponte com o Electron.
 *
 * Se o preload não carregar (ou se a UI for aberta num navegador comum, como
 * ao rodar `npm run dev:web`), `window.api` fica indefinido e a primeira
 * chamada derruba a árvore inteira do React — a tela fica preta sem nenhuma
 * pista. Este fallback mantém a interface de pé e sinaliza o modo degradado.
 */
const noop = async () => null;

const fallback = {
  winMinimize: () => {},
  winToggleMaximize: () => {},
  winClose: () => {},
  winIsMaximized: async () => false,
  onWinMaximized: () => () => {},
  startCapture: noop,
  setCaptureShortcut: noop,
  getCaptureShortcut: noop,
  onCaptureDone: () => () => {},
  onOverlayImage: () => () => {},
  sendOverlayResult: () => {},
  cancelOverlay: () => {},
  onDialogRequest: () => () => {},
  dialogShown: () => {},
  dialogAnswer: () => {},
  docInfo: async () => ({ docId: 'web', windowCount: 1 }),
  reportDocState: () => {},
  onRequestSave: () => () => {},
  saveResult: () => {},
  updateState: async () => ({ status: 'dev' }),
  checkUpdate: async () => ({ status: 'dev' }),
  downloadUpdate: async () => ({ status: 'dev' }),
  installUpdate: noop,
  setUpdateFeedUrl: noop,
  onUpdateState: () => () => {},
  newDocument: async () => ({ action: 'current' }),
  openDocument: async () => ({ action: 'cancel' }),
  resetAskPrefs: noop,
  printScreenConflict: async () => false,
  releasePrintScreen: async () => false,
  autosave: noop,
  loadDraft: noop,
  saveProject: noop,
  saveProjectAs: noop,
  loadLastProject: noop,
  forgetLastProject: noop,
  onOpenFile: () => () => {},
  getPrefs: async () => ({}),
  setPrefs: noop,
  listTemplates: async () => [],
  saveTemplate: noop,
  loadTemplate: noop,
  deleteTemplate: noop,
  openTemplatesFolder: noop,
  exportPdf: noop,
  exportDocx: noop,
  showItemInFolder: noop,
  pickImages: async () => [],
};

export const usingFallbackApi = !window.api;

if (usingFallbackApi) {
  window.api = fallback;
  console.warn(
    '[gerador-evidencias] window.api ausente — rodando em modo limitado. ' +
      'Captura de tela, salvar em disco e exportação ficam indisponíveis.',
  );
}
