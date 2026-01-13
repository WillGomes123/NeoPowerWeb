import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 * Captura erros no React e exibe uma UI de erro amigável
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Atualiza o estado para exibir a UI de fallback na próxima renderização
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log do erro (em produção, enviar para serviço como Sentry)
    console.error('❌ Error Boundary capturou um erro:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Em produção, enviar para serviço de monitoramento
    // if (process.env.NODE_ENV === 'production') {
    //   // Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
    // }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Se um fallback customizado foi fornecido, usá-lo
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // UI de erro padrão
      return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-emerald-950/20 to-zinc-950 flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full bg-zinc-900/50 border-emerald-800/30 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                <div>
                  <CardTitle className="text-2xl text-emerald-50">Ops! Algo deu errado</CardTitle>
                  <p className="text-emerald-300/60 text-sm mt-1">
                    Ocorreu um erro inesperado na aplicação
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {this.state.error && (
                <div className="bg-zinc-950/50 border border-emerald-800/20 rounded-lg p-4">
                  <p className="text-red-400 font-mono text-sm">{this.state.error.toString()}</p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={this.handleReset}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Tentar Novamente
                </Button>

                <Button
                  onClick={() => (window.location.href = '/')}
                  variant="outline"
                  className="flex-1 border-emerald-800/30 hover:bg-emerald-900/20"
                >
                  Voltar ao Início
                </Button>
              </div>

              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-emerald-300/60 text-sm hover:text-emerald-300">
                    Detalhes do erro (desenvolvimento)
                  </summary>
                  <pre className="mt-2 p-4 bg-zinc-950/80 border border-emerald-800/20 rounded text-xs text-emerald-100/80 overflow-auto max-h-96">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}

              <div className="mt-6 pt-4 border-t border-emerald-800/20">
                <p className="text-emerald-300/40 text-xs text-center">
                  Se o problema persistir, entre em contato com o suporte
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
