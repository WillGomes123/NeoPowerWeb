import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

// Componente que lanca erro para testar
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

// Componente com erro customizado
const ThrowCustomError = ({ message }: { message: string }) => {
  throw new Error(message);
};

describe('ErrorBoundary', () => {
  // Suprimir console.error durante testes para manter output limpo
  const originalConsoleError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe('Captura de Erros', () => {
    it('deve renderizar children quando nao ha erro', () => {
      render(
        <ErrorBoundary>
          <div>Content without error</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Content without error')).toBeInTheDocument();
    });

    it('deve capturar erro e mostrar UI de fallback', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Ops! Algo deu errado')).toBeInTheDocument();
      expect(screen.getByText('Ocorreu um erro inesperado na aplicação')).toBeInTheDocument();
    });

    it('deve mostrar mensagem de erro capturado', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Error: Test error/)).toBeInTheDocument();
    });

    it('deve capturar erros customizados', () => {
      render(
        <ErrorBoundary>
          <ThrowCustomError message="Custom error message" />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Custom error message/)).toBeInTheDocument();
    });

    it('deve logar erro no console', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Fallback UI', () => {
    it('deve mostrar UI de erro padrao', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Ops! Algo deu errado')).toBeInTheDocument();
      expect(screen.getByText('Tentar Novamente')).toBeInTheDocument();
      expect(screen.getByText('Voltar ao Início')).toBeInTheDocument();
    });

    it('deve usar fallback customizado quando fornecido', () => {
      const customFallback = <div>Custom error UI</div>;

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom error UI')).toBeInTheDocument();
      expect(screen.queryByText('Ops! Algo deu errado')).not.toBeInTheDocument();
    });

    it('deve mostrar icone de alerta', () => {
      const { container } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Verificar presenca do icone AlertTriangle
      const alertIcon = container.querySelector('.text-red-500');
      expect(alertIcon).toBeInTheDocument();
    });

    it('deve mostrar mensagem de suporte', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(
        screen.getByText(/Se o problema persistir, entre em contato com o suporte/)
      ).toBeInTheDocument();
    });
  });

  describe('Reset', () => {
    it('deve resetar erro ao clicar em Tentar Novamente', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Ops! Algo deu errado')).toBeInTheDocument();

      const resetButton = screen.getByText('Tentar Novamente');
      fireEvent.click(resetButton);

      // Apos reset, renderizar sem erro
      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.queryByText('Ops! Algo deu errado')).not.toBeInTheDocument();
    });

    it('deve limpar estado de erro ao resetar', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const resetButton = screen.getByText('Tentar Novamente');
      fireEvent.click(resetButton);

      rerender(
        <ErrorBoundary>
          <div>Success content</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Success content')).toBeInTheDocument();
    });
  });

  describe('Botao Voltar ao Inicio', () => {
    it('deve ter botao Voltar ao Inicio', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Voltar ao Início')).toBeInTheDocument();
    });

    it('deve redirecionar para / ao clicar em Voltar ao Inicio', () => {
      // Mock window.location
      delete (window as { location?: Location }).location;
      window.location = { href: '' } as Location;

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const homeButton = screen.getByText('Voltar ao Início');
      fireEvent.click(homeButton);

      expect(window.location.href).toBe('/');
    });
  });

  describe('Detalhes de Erro em Desenvolvimento', () => {
    it('deve mostrar detalhes em modo desenvolvimento', () => {
      // Simular modo desenvolvimento
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Detalhes do erro (desenvolvimento)')).toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });

    it('nao deve mostrar detalhes em producao', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.queryByText('Detalhes do erro (desenvolvimento)')).not.toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Ciclo de Vida', () => {
    it('deve chamar getDerivedStateFromError', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Se chegou aqui, getDerivedStateFromError foi chamado
      expect(screen.getByText('Ops! Algo deu errado')).toBeInTheDocument();
    });

    it('deve chamar componentDidCatch', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // componentDidCatch deve ter sido chamado (verificado pelo console.error)
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Multiplos Erros', () => {
    it('deve capturar primeiro erro', () => {
      render(
        <ErrorBoundary>
          <ThrowCustomError message="First error" />
        </ErrorBoundary>
      );

      expect(screen.getByText(/First error/)).toBeInTheDocument();
    });

    it('deve capturar erro apos reset', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowCustomError message="First error" />
        </ErrorBoundary>
      );

      const resetButton = screen.getByText('Tentar Novamente');
      fireEvent.click(resetButton);

      rerender(
        <ErrorBoundary>
          <ThrowCustomError message="Second error" />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Second error/)).toBeInTheDocument();
    });
  });

  describe('Componentes Aninhados', () => {
    it('deve capturar erro em componente filho profundo', () => {
      const DeepChild = () => {
        throw new Error('Deep error');
      };

      const Parent = () => (
        <div>
          <div>
            <DeepChild />
          </div>
        </div>
      );

      render(
        <ErrorBoundary>
          <Parent />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Deep error/)).toBeInTheDocument();
    });

    it('deve capturar erro em qualquer nivel', () => {
      render(
        <ErrorBoundary>
          <div>
            <div>
              <div>
                <ThrowError shouldThrow={true} />
              </div>
            </div>
          </div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Ops! Algo deu errado')).toBeInTheDocument();
    });
  });

  describe('Estilizacao', () => {
    it('deve aplicar classes de estilo corretas', () => {
      const { container } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(container.querySelector('.min-h-screen')).toBeInTheDocument();
    });

    it('deve ter botoes com estilos distintos', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const resetButton = screen.getByText('Tentar Novamente').closest('button');
      const homeButton = screen.getByText('Voltar ao Início').closest('button');

      expect(resetButton).toHaveClass('bg-emerald-600');
      expect(homeButton).toHaveClass('border-emerald-800/30');
    });
  });

  describe('Edge Cases', () => {
    it('deve lidar com erro sem mensagem', () => {
      const ThrowEmptyError = () => {
        throw new Error();
      };

      render(
        <ErrorBoundary>
          <ThrowEmptyError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Ops! Algo deu errado')).toBeInTheDocument();
    });

    it('deve lidar com multiplos children', () => {
      render(
        <ErrorBoundary>
          <div>Child 1</div>
          <div>Child 2</div>
          <div>Child 3</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Child 1')).toBeInTheDocument();
      expect(screen.getByText('Child 2')).toBeInTheDocument();
      expect(screen.getByText('Child 3')).toBeInTheDocument();
    });

    it('deve lidar com children null', () => {
      render(<ErrorBoundary>{null}</ErrorBoundary>);

      expect(screen.queryByText('Ops! Algo deu errado')).not.toBeInTheDocument();
    });
  });

  describe('Integracao', () => {
    it('deve funcionar com fallback customizado complexo', () => {
      const ComplexFallback = (
        <div>
          <h1>Custom Error Page</h1>
          <p>Something went wrong</p>
          <button>Custom Action</button>
        </div>
      );

      render(
        <ErrorBoundary fallback={ComplexFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom Error Page')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Custom Action')).toBeInTheDocument();
    });

    it('deve permitir recuperacao apos erro', () => {
      let shouldError = true;
      const ConditionalError = () => {
        if (shouldError) {
          throw new Error('Conditional error');
        }
        return <div>Recovered content</div>;
      };

      const { rerender } = render(
        <ErrorBoundary>
          <ConditionalError />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Conditional error/)).toBeInTheDocument();

      // Resetar e mudar condicao
      shouldError = false;
      const resetButton = screen.getByText('Tentar Novamente');
      fireEvent.click(resetButton);

      rerender(
        <ErrorBoundary>
          <ConditionalError />
        </ErrorBoundary>
      );

      expect(screen.queryByText(/Conditional error/)).not.toBeInTheDocument();
    });
  });
});
