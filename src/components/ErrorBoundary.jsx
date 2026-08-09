import React from 'react';
import WindowControls from './WindowControls.jsx';

/**
 * Sem isso, qualquer exceção durante o render desmonta tudo e a janela fica
 * preta (a cor de fundo do app), sem mensagem nenhuma. Aqui a falha vira algo
 * legível e recuperável.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error('[gerador-evidencias] erro de render:', error, info);
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="crash">
        {/* a janela é frameless: sem estes botões não haveria como fechá-la */}
        <header className="crash-bar">
          <WindowControls />
        </header>
        <div className="crash-box">
          <h1>Algo quebrou na interface</h1>
          <p>
            Seu trabalho continua salvo no rascunho automático. Recarregue a janela para voltar ao
            documento; se o erro se repetir, copie a mensagem abaixo.
          </p>
          <pre>{String(error?.stack || error)}</pre>
          {info?.componentStack ? (
            <pre className="dim">{info.componentStack.trim()}</pre>
          ) : null}
          <div className="crash-actions">
            <button className="btn primary" onClick={() => window.location.reload()}>
              Recarregar
            </button>
            <button
              className="btn"
              onClick={() => navigator.clipboard?.writeText(String(error?.stack || error))}
            >
              Copiar erro
            </button>
          </div>
        </div>
      </div>
    );
  }
}
