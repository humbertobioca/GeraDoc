const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // janela
  winMinimize: () => ipcRenderer.send('win:minimize'),
  winToggleMaximize: () => ipcRenderer.send('win:toggleMaximize'),
  winClose: () => ipcRenderer.send('win:close'),
  winIsMaximized: () => ipcRenderer.invoke('win:isMaximized'),
  onWinMaximized: (cb) => {
    const h = (_e, value) => cb(value);
    ipcRenderer.on('win:maximized', h);
    return () => ipcRenderer.removeListener('win:maximized', h);
  },

  // captura
  startCapture: () => ipcRenderer.invoke('capture:start'),
  setCaptureShortcut: (accel) => ipcRenderer.invoke('capture:shortcut', accel),
  getCaptureShortcut: () => ipcRenderer.invoke('capture:activeShortcut'),
  onCaptureDone: (cb) => {
    const h = (_e, dataUrl) => cb(dataUrl);
    ipcRenderer.on('capture:done', h);
    return () => ipcRenderer.removeListener('capture:done', h);
  },

  // overlay (usado somente pela janela de seleção)
  onOverlayImage: (cb) => {
    const h = (_e, payload) => cb(payload);
    ipcRenderer.on('overlay:image', h);
    return () => ipcRenderer.removeListener('overlay:image', h);
  },
  sendOverlayResult: (dataUrl) => ipcRenderer.send('overlay:result', dataUrl),
  cancelOverlay: () => ipcRenderer.send('overlay:cancel'),
  focusOverlay: () => ipcRenderer.send('overlay:focus'),

  // caixas de diálogo desenhadas pela interface
  onDialogRequest: (cb) => {
    const h = (_e, payload) => cb(payload);
    ipcRenderer.on('dialog:ask', h);
    return () => ipcRenderer.removeListener('dialog:ask', h);
  },
  dialogShown: (id) => ipcRenderer.send('dialog:shown', id),
  dialogAnswer: (payload) => ipcRenderer.send('dialog:answer', payload),

  docInfo: () => ipcRenderer.invoke('doc:info'),
  reportDocState: (st) => ipcRenderer.send('doc:state', st),
  onRequestSave: (cb) => {
    const h = (_e, opts) => cb(opts || {});
    ipcRenderer.on('app:requestSave', h);
    return () => ipcRenderer.removeListener('app:requestSave', h);
  },
  saveResult: (okSaved) => ipcRenderer.send('app:saveResult', okSaved),

  // atualização
  updateState: () => ipcRenderer.invoke('update:state'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  setUpdateFeedUrl: (url) => ipcRenderer.invoke('update:feedUrl', url),
  onUpdateState: (cb) => {
    const h = (_e, st) => cb(st);
    ipcRenderer.on('update:state', h);
    return () => ipcRenderer.removeListener('update:state', h);
  },

  newDocument: () => ipcRenderer.invoke('doc:new'),
  openDocument: () => ipcRenderer.invoke('doc:open'),
  resetAskPrefs: () => ipcRenderer.invoke('doc:resetAskPrefs'),

  // conflito da tecla PrintScreen no Windows 11
  printScreenConflict: () => ipcRenderer.invoke('system:printScreenConflict'),
  releasePrintScreen: () => ipcRenderer.invoke('system:releasePrintScreen'),

  // projeto
  autosave: (json) => ipcRenderer.invoke('project:autosave', json),
  loadDraft: () => ipcRenderer.invoke('project:loadDraft'),
  saveProject: (payload) => ipcRenderer.invoke('project:save', payload),
  saveProjectAs: (payload) => ipcRenderer.invoke('project:saveAs', payload),
  loadLastProject: () => ipcRenderer.invoke('project:loadLast'),
  forgetLastProject: () => ipcRenderer.invoke('project:forget'),
  onOpenFile: (cb) => {
    const h = (_e, payload) => cb(payload);
    ipcRenderer.on('file:open', h);
    return () => ipcRenderer.removeListener('file:open', h);
  },

  // preferências
  getPrefs: () => ipcRenderer.invoke('prefs:get'),
  setPrefs: (patch) => ipcRenderer.invoke('prefs:set', patch),

  // templates
  listTemplates: () => ipcRenderer.invoke('template:list'),
  saveTemplate: (payload) => ipcRenderer.invoke('template:save', payload),
  loadTemplate: (name) => ipcRenderer.invoke('template:load', name),
  deleteTemplate: (name) => ipcRenderer.invoke('template:delete', name),
  openTemplatesFolder: () => ipcRenderer.invoke('shell:openTemplatesFolder'),

  // exportação
  exportPdf: (payload) => ipcRenderer.invoke('export:pdf', payload),
  exportDocx: (payload) => ipcRenderer.invoke('export:docx', payload),
  showItemInFolder: (p) => ipcRenderer.invoke('shell:showItem', p),

  // imagens
  pickImages: () => ipcRenderer.invoke('image:pickFiles'),
});
