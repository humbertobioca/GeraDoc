import React from 'react';
import Tooltip from './Tooltip.jsx';
import { IconAlert, IconCheck, IconDraft } from './Icons.jsx';

/**
 * Estado do salvamento, em ícone.
 *
 * Um documento sem arquivo escolhido nunca deixa de ter "alterações pendentes"
 * — é isso que faz o app perguntar antes de fechar. Por isso o estado visual é
 * separado disso: aqui mostramos onde o trabalho está de fato guardado.
 */
const ESTADOS = {
  saving: {
    cls: 'saving',
    label: 'Salvando…',
  },
  saved: {
    cls: 'ok',
    icon: <IconCheck size={13} />,
    label: 'Salvo no arquivo',
  },
  draft: {
    cls: 'draft',
    icon: <IconDraft size={13} />,
    label: 'Guardado temporariamente',
    hint: 'sem arquivo',
  },
  error: {
    cls: 'err',
    icon: <IconAlert size={13} />,
    label: 'Não foi possível salvar',
  },
};

export default function SaveStatus({ state, filePath }) {
  const info = ESTADOS[state];
  if (!info) return null; // documento novo e intocado: nada a mostrar

  const hint =
    state === 'saved' && filePath ? filePath.split(/[\\/]/).pop() : info.hint;

  const detalhe =
    state === 'draft'
      ? 'Suas alterações estão a salvo num rascunho e voltam se o app fechar. Use Salvar para escolher a pasta e o nome.'
      : null;

  return (
    <Tooltip label={info.label} hint={hint}>
      <span className={`save-status ${info.cls}`} aria-label={info.label} title={detalhe || undefined}>
        {info.icon ?? <span className="mini-spinner" />}
      </span>
    </Tooltip>
  );
}
