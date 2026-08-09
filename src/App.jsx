import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useStore, selectActiveCase } from './store.js';
import ContentPanel from './components/ContentPanel.jsx';
import TemplatePanel from './components/TemplatePanel.jsx';
import Preview from './components/Preview.jsx';
import Annotator from './components/Annotator.jsx';
import { ProfileSwitch } from './components/ui.jsx';
import WindowControls from './components/WindowControls.jsx';
import Logo from './components/Logo.jsx';
import DialogHost from './components/Dialog.jsx';
import { exportPdf, slug } from './export/exportPdf.js';
import { buildDocx } from './export/exportDocx.js';
import { coverValue } from './doc/blocks.jsx';

const SHORTCUTS = ['PrintScreen', 'CommandOrControl+Shift+X', 'Alt+Shift+S', 'CommandOrControl+Shift+P'];

const fileToDataUrl = (file) =>
  new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.readAsDataURL(file);
  });

export default function App() {
  const project = useStore((s) => s.project);
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const dirty = useStore((s) => s.dirty);
  const filePath = useStore((s) => s.filePath);
  const toast = useStore((s) => s.toast);
  const notify = useStore((s) => s.notify);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const active = useStore(selectActiveCase);

  const [editing, setEditing] = useState(null); // { image, target }
  const [shortcut, setShortcut] = useState('PrintScreen');
  const [exporting, setExporting] = useState(null);
  const [sidebar, setSidebar] = useState(500);
  const [psConflict, setPsConflict] = useState(false);
  const [update, setUpdate] = useState({ status: 'idle' });
  const pendingTarget = useRef(null);
  const ready = useRef(false); // evita gravar preferências antes de carregá-las

  // ---- barra lateral redimensionável
  const startResize = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebar;
    document.body.classList.add('resizing');

    const onMove = (ev) => setSidebar(Math.min(820, Math.max(380, startW + ev.clientX - startX)));
    const onUp = () => {
      document.body.classList.remove('resizing');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // ------------------------------------------------------------ inicialização
  useEffect(() => {
    (async () => {
      const p = (await window.api.getPrefs()) || {};
      if (p.sidebarWidth) setSidebar(p.sidebarWidth);
      if (p.zoom) useStore.getState().setZoom(p.zoom);
      if (p.tab) useStore.getState().setTab(p.tab);

      const info = await window.api.docInfo();
      const primeira = (info?.windowCount ?? 1) <= 1;

      // Rascunho desta janela tem prioridade: é trabalho ainda não salvo.
      // Só a primeira janela reabre o último documento salvo.
      const draft = await window.api.loadDraft();
      if (draft) {
        try {
          useStore.getState().loadProject(JSON.parse(draft));
          notify('Trabalho não salvo foi recuperado.', 'ok');
        } catch { /* rascunho corrompido: segue com documento novo */ }
      } else if (primeira) {
        const last = await window.api.loadLastProject();
        if (last) {
          try {
            useStore.getState().loadProject(JSON.parse(last.json), last.path);
            notify(`Reaberto: ${last.path.split(/[\\/]/).pop()}`, 'ok');
          } catch {
            await window.api.forgetLastProject();
            notify('O último documento não pôde ser lido.', 'warn');
          }
        }
      }

      const accel = await window.api.getCaptureShortcut();
      if (accel) setShortcut(accel);
      else notify('Não foi possível registrar o atalho de captura — escolha outro na barra superior.', 'warn');

      // O Windows 11 pode reservar o PrintScreen para a Ferramenta de Captura
      if (accel === 'PrintScreen' && (await window.api.printScreenConflict())) {
        setPsConflict(true);
      }

      ready.current = true;
    })();
  }, [notify]);

  // ---- preferências acompanham o que o usuário muda
  useEffect(() => {
    if (ready.current) window.api.setPrefs({ sidebarWidth: sidebar });
  }, [sidebar]);

  useEffect(() => {
    if (ready.current) window.api.setPrefs({ tab });
  }, [tab]);

  useEffect(
    () =>
      useStore.subscribe((s, prev) => {
        if (ready.current && s.zoom !== prev.zoom) window.api.setPrefs({ zoom: s.zoom });
      }),
    [],
  );

  // ---- título da janela: nome do arquivo enquanto houver um; senão só o app
  useEffect(() => {
    const nome = filePath ? filePath.split(/[\\/]/).pop() : null;
    document.title = nome ? `${nome} — GeraDoc` : 'GeraDoc';
    window.api.reportDocState({ filePath, dirty });
  }, [filePath, dirty]);

  // ---- diálogos pedidos pelo processo principal são desenhados aqui
  useEffect(
    () =>
      window.api.onDialogRequest(async ({ id, ...options }) => {
        window.api.dialogShown(id);
        const { response, checkboxChecked } = await useStore.getState().askDialog(options);
        window.api.dialogAnswer({ id, response, checkboxChecked });
      }),
    [],
  );

  // ---- falhas do processo principal viram aviso discreto, não caixa de erro crua
  useEffect(
    () => window.api.onMainError((msg) => notify(`Falha interna: ${msg}`, 'err')),
    [notify],
  );

  // ---- estado da atualização
  useEffect(() => {
    window.api.updateState().then((s) => s && setUpdate(s));
    return window.api.onUpdateState(setUpdate);
  }, []);

  // ---- abertura por duplo clique no Explorer (arquivo .evid)
  useEffect(
    () =>
      window.api.onOpenFile(({ path, json }) => {
        try {
          useStore.getState().loadProject(JSON.parse(json), path);
          notify(`Aberto: ${path.split(/[\\/]/).pop()}`, 'ok');
        } catch {
          notify('Este arquivo não pôde ser lido.', 'err');
        }
      }),
    [notify],
  );

  // ------------------------------------------------------------ salvamento automático
  // Com um arquivo .evid aberto, cada alteração vai direto para ele. Sem
  // arquivo ainda, o trabalho fica no rascunho interno até o primeiro "Salvar".
  useEffect(() => {
    if (!dirty) return;
    const id = setTimeout(async () => {
      const json = JSON.stringify(project);
      try {
        if (filePath) {
          await window.api.saveProject({ json, filePath });
          useStore.getState().markSaved();
        } else {
          await window.api.autosave(json);
        }
      } catch { /* disco cheio ou arquivo em uso: tenta de novo na próxima mudança */ }
    }, 1200);
    return () => clearTimeout(id);
  }, [project, dirty, filePath]);

  // ------------------------------------------------------------ captura
  const requestCapture = useCallback((target) => {
    pendingTarget.current = target ?? null;
    window.api.startCapture();
  }, []);

  useEffect(() => {
    return window.api.onCaptureDone((dataUrl) => {
      setEditing({ image: dataUrl, target: pendingTarget.current });
      pendingTarget.current = null;
    });
  }, []);

  const applyImage = (dataUrl, caption) => {
    const s = useStore.getState();
    const target = editing?.target;
    const caseId = target?.caseId || selectActiveCase(s)?.id;
    if (!caseId) {
      setEditing(null);
      return;
    }
    if (target?.stepId) {
      s.updateStep(caseId, target.stepId, { image: dataUrl, ...(caption ? { caption } : {}) }, true);
    } else {
      s.addStepsFromImages(caseId, [dataUrl]);
      if (caption) {
        const c = useStore.getState().project.cases.find((x) => x.id === caseId);
        const last = c.steps[c.steps.length - 1];
        s.updateStep(caseId, last.id, { caption });
      }
    }
    setEditing(null);
    notify('Print inserido no documento.', 'ok');
  };

  // ------------------------------------------------------------ colar / arrastar
  useEffect(() => {
    const onPaste = async (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return; // não sequestra colagem de texto
      const items = [...(e.clipboardData?.items || [])].filter((i) => i.type.startsWith('image/'));
      if (!items.length) return;
      e.preventDefault();
      const imgs = await Promise.all(items.map((i) => fileToDataUrl(i.getAsFile())));
      const s = useStore.getState();
      const caseId = selectActiveCase(s)?.id;
      if (!caseId) return;
      if (imgs.length === 1) setEditing({ image: imgs[0], target: { caseId, stepId: null } });
      else {
        s.addStepsFromImages(caseId, imgs);
        notify(`${imgs.length} prints inseridos como novos passos.`, 'ok');
      }
    };

    const onDrop = async (e) => {
      const files = [...(e.dataTransfer?.files || [])].filter((f) => f.type.startsWith('image/'));
      if (!files.length) return;
      e.preventDefault();
      const imgs = await Promise.all(files.map(fileToDataUrl));
      const s = useStore.getState();
      const caseId = selectActiveCase(s)?.id;
      if (!caseId) return;
      s.addStepsFromImages(caseId, imgs);
      notify(`${imgs.length} imagem(ns) adicionada(s).`, 'ok');
    };

    const prevent = (e) => e.preventDefault();
    document.addEventListener('paste', onPaste);
    document.addEventListener('drop', onDrop);
    document.addEventListener('dragover', prevent);
    return () => {
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('drop', onDrop);
      document.removeEventListener('dragover', prevent);
    };
  }, [notify]);

  // ------------------------------------------------------------ arquivo
  // lê o projeto do store na hora da chamada — nunca de uma closure antiga
  const saveAs = async () => {
    const atual = useStore.getState().project;
    const p = await window.api.saveProjectAs({
      json: JSON.stringify(atual, null, 2),
      suggestedName: slug(coverValue(atual.template, 'titulo') || 'documento'),
    });
    if (p) {
      useStore.getState().setFilePath(p);
      notify(`Salvo em ${p.split(/[\\/]/).pop()}`, 'ok');
    }
    return p;
  };

  /** Salvar: grava no arquivo já aberto; se não houver, pergunta onde. */
  const save = async () => {
    if (!filePath) return saveAs();
    await window.api.saveProject({ json: JSON.stringify(project, null, 2), filePath });
    useStore.getState().markSaved();
    notify(`Salvo em ${filePath.split(/[\\/]/).pop()}`, 'ok');
    return filePath;
  };

  /**
   * O processo principal pede que salvemos — ao fechar com alterações pendentes
   * ou antes de instalar uma atualização. No modo silencioso não abrimos
   * diálogo: um documento sem arquivo já está protegido pelo rascunho.
   */
  useEffect(
    () =>
      window.api.onRequestSave(async ({ silent }) => {
        try {
          const { project: p, filePath: fp } = useStore.getState();
          if (!fp) {
            if (silent) {
              await window.api.autosave(JSON.stringify(p));
              window.api.saveResult(true);
            } else {
              window.api.saveResult(!!(await saveAs()));
            }
            return;
          }
          await window.api.saveProject({ json: JSON.stringify(p, null, 2), filePath: fp });
          useStore.getState().markSaved();
          window.api.saveResult(true);
        } catch {
          window.api.saveResult(false);
        }
      }),
    // saveAs lê o projeto do store no momento da chamada, então não precisa
    // entrar nas dependências
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Novo e Abrir perguntam ao processo principal em qual janela agir; ele mostra
  // o diálogo nativo com o "Não perguntar mais" e cria a janela quando é o caso.
  const open = async () => {
    const res = await window.api.openDocument();
    if (res.action === 'cancel' || res.action === 'newWindow') return;
    try {
      useStore.getState().loadProject(JSON.parse(res.json), res.path);
      notify(`Aberto: ${res.path.split(/[\\/]/).pop()}`, 'ok');
    } catch {
      notify('Arquivo inválido.', 'err');
    }
  };

  const novo = async () => {
    const res = await window.api.newDocument();
    if (res.action !== 'current') return;
    useStore.getState().resetProject();
  };

  const doPdf = async () => {
    setExporting('pdf');
    try {
      const p = await exportPdf(project);
      if (p) {
        notify('PDF gerado com sucesso.', 'ok');
        window.api.showItemInFolder(p);
      }
    } catch (e) {
      notify(`Falha ao gerar PDF: ${e.message}`, 'err');
    } finally {
      setExporting(null);
    }
  };

  const doDocx = async () => {
    setExporting('docx');
    try {
      const bytes = await buildDocx(project);
      const p = await window.api.exportDocx({
        buffer: bytes,
        suggestedName: slug(coverValue(project.template, 'titulo') || 'documento'),
      });
      if (p) {
        notify('Word gerado com sucesso.', 'ok');
        window.api.showItemInFolder(p);
      }
    } catch (e) {
      notify(`Falha ao gerar Word: ${e.message}`, 'err');
    } finally {
      setExporting(null);
    }
  };

  // ------------------------------------------------------------ atalhos locais
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === 's') { e.preventDefault(); e.shiftKey ? saveAs() : save(); }
      else if (k === 'o') { e.preventDefault(); open(); }
      else if (k === 'z' && !e.shiftKey) {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault(); undo();
      } else if ((k === 'y') || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="app">
      <header className="topbar" onDoubleClick={() => window.api.winToggleMaximize()}>
        <div className="brand">
          <Logo />
          <div className="brand-text">
            <strong>GeraDoc</strong>
            <small title={filePath || 'ainda não salvo em arquivo'}>
              {filePath ? filePath.split(/[\\/]/).pop() : 'sem arquivo'}
              {dirty ? (
                <span className="unsaved"> • salvando…</span>
              ) : filePath ? (
                <span className="saved"> • salvo</span>
              ) : null}
            </small>
          </div>
        </div>

        <div className="tb-actions">
          <div className="tb-group" role="group" aria-label="Arquivo">
            <button className="btn" onClick={novo} title="Documento novo">Novo</button>
            <button className="btn" onClick={open} title="Abrir projeto (Ctrl+O)">Abrir</button>
            <button
              className="btn"
              onClick={save}
              title={filePath ? `Salvar em ${filePath} (Ctrl+S)` : 'Salvar projeto (Ctrl+S)'}
            >
              Salvar
            </button>
            <button className="btn" onClick={saveAs} title="Salvar como… (Ctrl+Shift+S)">
              Salvar como…
            </button>
          </div>

          <div className="tb-group" role="group" aria-label="Captura">
            <button
              className="btn primary"
              title={`Capturar tela (${shortcut.replace('CommandOrControl', 'Ctrl')})`}
              onClick={() => requestCapture({ caseId: active?.id, stepId: null })}
            >
              ⛶ Capturar
            </button>
            <select
              className="inp shortcut-sel"
              value={shortcut}
              title="Atalho global de captura — troque se outro programa já usar esta tecla"
              onChange={async (e) => {
              const accel = await window.api.setCaptureShortcut(e.target.value);
                if (accel) {
                  setShortcut(accel);
                  notify(`Atalho de captura: ${accel}`, 'ok');
                } else {
                  notify('Este atalho já está em uso por outro programa.', 'warn');
                }
              }}
            >
              {SHORTCUTS.map((s) => (
                <option key={s} value={s}>{s.replace('CommandOrControl', 'Ctrl')}</option>
              ))}
            </select>
          </div>

          <div className="tb-group" role="group" aria-label="Exportar">
            <button className="btn ok" disabled={!!exporting} onClick={doDocx} title="Gerar documento do Word">
              {exporting === 'docx' ? 'Gerando…' : '📄 Word'}
            </button>
            <button className="btn ok" disabled={!!exporting} onClick={doPdf} title="Gerar PDF">
              {exporting === 'pdf' ? 'Gerando…' : '📕 PDF'}
            </button>
            <button
              className="ico"
              title="Procurar atualizações"
              onClick={async () => {
                const s = await window.api.checkUpdate();
                setUpdate(s);
                if (s.status === 'uptodate') notify('O GeraDoc já está atualizado.', 'ok');
                else if (s.status === 'dev') notify('Atualização só funciona na versão instalada.', 'warn');
                else if (s.status === 'error') notify(`Falha ao procurar atualização: ${s.error}`, 'err');
              }}
            >
              ⭯
            </button>
          </div>
        </div>

        <WindowControls />
      </header>

      {['available', 'downloading', 'downloaded'].includes(update.status) ? (
        <div className={`banner ${update.status === 'downloaded' ? 'ok' : 'info'}`}>
          <span className="banner-ic">{update.status === 'downloaded' ? '✓' : '⭳'}</span>
          <div className="banner-text">
            {update.status === 'available' && (
              <>
                <b>Versão {update.version} disponível.</b> A atualização não apaga seus documentos
                nem suas preferências.
              </>
            )}
            {update.status === 'downloading' && (
              <>
                Baixando a versão {update.version}… <b>{update.percent}%</b>
              </>
            )}
            {update.status === 'downloaded' && (
              <>
                <b>Versão {update.version} pronta para instalar.</b> O GeraDoc salva tudo que está
                aberto, atualiza e reabre as mesmas janelas.
              </>
            )}
          </div>

          {update.status === 'available' && (
            <button className="btn tiny primary" onClick={() => window.api.downloadUpdate()}>
              Baixar agora
            </button>
          )}
          {update.status === 'downloading' && (
            <div className="banner-bar">
              <span style={{ width: `${update.percent}%` }} />
            </div>
          )}
          {update.status === 'downloaded' && (
            <button className="btn tiny primary" onClick={() => window.api.installUpdate()}>
              Reiniciar e atualizar
            </button>
          )}
          {update.status !== 'downloading' && (
            <button className="ico" title="Depois" onClick={() => setUpdate({ status: 'idle' })}>
              ✕
            </button>
          )}
        </div>
      ) : null}

      {psConflict ? (
        <div className="banner warn">
          <span className="banner-ic">⚠</span>
          <div className="banner-text">
            <b>O Windows está reservando a tecla PrintScreen</b> para a Ferramenta de Captura, por
            isso o atalho do GeraDoc não funciona com a janela minimizada.
          </div>
          <button
            className="btn tiny primary"
            onClick={async () => {
              const ok = await window.api.releasePrintScreen();
              setPsConflict(false);
              notify(
                ok
                  ? 'Tecla liberada. Faça logoff ou reinicie o Windows para valer.'
                  : 'Não foi possível alterar a configuração do Windows.',
                ok ? 'ok' : 'err',
              );
            }}
          >
            Liberar a tecla
          </button>
          <button
            className="btn tiny"
            onClick={async () => {
              const accel = await window.api.setCaptureShortcut('CommandOrControl+Shift+X');
              if (accel) setShortcut(accel);
              setPsConflict(false);
              notify('Atalho de captura alterado para Ctrl+Shift+X.', 'ok');
            }}
          >
            Usar Ctrl+Shift+X
          </button>
          <button className="ico" title="Dispensar" onClick={() => setPsConflict(false)}>✕</button>
        </div>
      ) : null}

      <div className="body">
        <aside className="editor" style={{ width: sidebar, flexBasis: sidebar }}>
          <div className="tabs">
            <button className={tab === 'conteudo' ? 'on' : ''} onClick={() => setTab('conteudo')}>
              Conteúdo
            </button>
            <button className={tab === 'template' ? 'on' : ''} onClick={() => setTab('template')}>
              Template
            </button>
          </div>

          <ProfileSwitch />

          {tab === 'conteudo' ? (
            <ContentPanel
              onCapture={requestCapture}
              onEditImage={(target, image) => setEditing({ image, target })}
            />
          ) : (
            <TemplatePanel />
          )}
        </aside>

        <div
          className="splitter"
          onMouseDown={startResize}
          onDoubleClick={() => setSidebar(500)}
          title="Arraste para redimensionar · duplo clique restaura"
          role="separator"
          aria-orientation="vertical"
        />

        <main className="viewer">
          <Preview />
        </main>
      </div>

      {editing ? (
        <Annotator
          image={editing.image}
          onCancel={() => setEditing(null)}
          onConfirm={applyImage}
          title={editing.target?.stepId ? 'Editar evidência' : 'Nova evidência'}
        />
      ) : null}

      <DialogHost />

      {toast ? (
        <div className={`toast ${toast.kind}`}>
          <span className="toast-ic" />
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
