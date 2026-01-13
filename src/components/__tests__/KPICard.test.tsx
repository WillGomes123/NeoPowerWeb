import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KPICard } from '../KPICard';
import { Zap } from 'lucide-react';

describe('KPICard', () => {
  describe('Renderizacao de Valores', () => {
    it('deve renderizar titulo e valor basico', () => {
      render(<KPICard title="Total de Estações" value={42} />);

      expect(screen.getByText('Total de Estações')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('deve renderizar valor como string', () => {
      render(<KPICard title="Status" value="Online" />);

      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Online')).toBeInTheDocument();
    });

    it('deve renderizar valor como numero', () => {
      render(<KPICard title="Energia Total" value={12345} />);

      expect(screen.getByText('Energia Total')).toBeInTheDocument();
      expect(screen.getByText('12345')).toBeInTheDocument();
    });

    it('deve renderizar com icone', () => {
      const { container } = render(
        <KPICard title="Potencia" value={100} icon={<Zap data-testid="zap-icon" />} />
      );

      expect(screen.getByText('Potencia')).toBeInTheDocument();
      expect(screen.getByTestId('zap-icon')).toBeInTheDocument();
    });

    it('deve renderizar sem icone', () => {
      const { container } = render(<KPICard title="Titulo" value={50} />);

      expect(screen.getByText('Titulo')).toBeInTheDocument();
      const iconContainer = container.querySelector('.text-zinc-500');
      expect(iconContainer).not.toBeInTheDocument();
    });
  });

  describe('Formatacao de Numeros', () => {
    it('deve renderizar numeros grandes', () => {
      render(<KPICard title="Receita" value={1234567} />);

      expect(screen.getByText('1234567')).toBeInTheDocument();
    });

    it('deve renderizar zero', () => {
      render(<KPICard title="Falhas" value={0} />);

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('deve renderizar numeros negativos', () => {
      render(<KPICard title="Perda" value={-100} />);

      expect(screen.getByText('-100')).toBeInTheDocument();
    });

    it('deve renderizar valores decimais', () => {
      render(<KPICard title="Media" value="15.5 kWh" />);

      expect(screen.getByText('15.5 kWh')).toBeInTheDocument();
    });

    it('deve renderizar valores com unidades', () => {
      render(<KPICard title="Energia" value="R$ 1.234,56" />);

      expect(screen.getByText('R$ 1.234,56')).toBeInTheDocument();
    });
  });

  describe('Trends - Positivo/Negativo', () => {
    it('deve mostrar trend positivo com icone de seta para cima', () => {
      render(<KPICard title="Receita" value="R$ 10.000" change={15.5} />);

      expect(screen.getByText('15.5%')).toBeInTheDocument();
      expect(screen.getByText('vs. período anterior')).toBeInTheDocument();

      const changeElement = screen.getByText('15.5%');
      expect(changeElement).toHaveClass('text-emerald-500');
    });

    it('deve mostrar trend negativo com icone de seta para baixo', () => {
      render(<KPICard title="Receita" value="R$ 8.000" change={-10.3} />);

      expect(screen.getByText('10.3%')).toBeInTheDocument();

      const changeElement = screen.getByText('10.3%');
      expect(changeElement).toHaveClass('text-red-500');
    });

    it('deve mostrar trend zero como positivo', () => {
      render(<KPICard title="Estavel" value={100} change={0} />);

      expect(screen.getByText('0%')).toBeInTheDocument();

      const changeElement = screen.getByText('0%');
      expect(changeElement).toHaveClass('text-emerald-500');
    });

    it('nao deve mostrar trend quando change nao fornecido', () => {
      render(<KPICard title="Titulo" value={100} />);

      expect(screen.queryByText(/vs\. período anterior/)).not.toBeInTheDocument();
    });

    it('deve mostrar trend muito pequeno', () => {
      render(<KPICard title="Titulo" value={100} change={0.1} />);

      expect(screen.getByText('0.1%')).toBeInTheDocument();
    });

    it('deve mostrar trend muito grande', () => {
      render(<KPICard title="Titulo" value={100} change={999.9} />);

      expect(screen.getByText('999.9%')).toBeInTheDocument();
    });

    it('deve usar Math.abs para valores negativos no display', () => {
      render(<KPICard title="Titulo" value={100} change={-25.7} />);

      // Deve mostrar 25.7%, nao -25.7%
      expect(screen.getByText('25.7%')).toBeInTheDocument();
      expect(screen.queryByText('-25.7%')).not.toBeInTheDocument();
    });
  });

  describe('Periodo', () => {
    it('deve mostrar periodo quando fornecido', () => {
      render(<KPICard title="Energia" value={1000} period="/mes" />);

      expect(screen.getByText('/mes')).toBeInTheDocument();
    });

    it('nao deve mostrar periodo quando nao fornecido', () => {
      render(<KPICard title="Energia" value={1000} />);

      const periodElement = document.querySelector('.text-xs.text-zinc-500');
      // Pode ter o periodo do trend, mas nao o periodo do valor
      expect(screen.queryByText('/mes')).not.toBeInTheDocument();
    });

    it('deve mostrar periodo com trend', () => {
      render(<KPICard title="Energia" value={1000} period="/dia" change={5.2} />);

      expect(screen.getByText('/dia')).toBeInTheDocument();
      expect(screen.getByText('5.2%')).toBeInTheDocument();
      expect(screen.getByText('vs. período anterior')).toBeInTheDocument();
    });
  });

  describe('Estilizacao e Classes', () => {
    it('deve aplicar classes de estilo corretas no Card', () => {
      const { container } = render(<KPICard title="Titulo" value={100} />);

      const card = container.querySelector('.bg-zinc-900');
      expect(card).toBeInTheDocument();
    });

    it('deve ter titulo com estilo correto', () => {
      render(<KPICard title="Titulo Teste" value={100} />);

      const title = screen.getByText('Titulo Teste');
      expect(title.closest('.text-sm.text-zinc-400')).toBeInTheDocument();
    });

    it('deve ter valor com estilo correto', () => {
      render(<KPICard title="Titulo" value={100} />);

      const value = screen.getByText('100');
      expect(value).toHaveClass('text-2xl', 'text-white');
    });
  });

  describe('Casos Completos', () => {
    it('deve renderizar KPI completo com todos os props', () => {
      render(
        <KPICard
          title="Energia Total"
          value="1.234 kWh"
          change={12.5}
          period="/mes"
          icon={<Zap data-testid="icon" />}
        />
      );

      expect(screen.getByText('Energia Total')).toBeInTheDocument();
      expect(screen.getByText('1.234 kWh')).toBeInTheDocument();
      expect(screen.getByText('12.5%')).toBeInTheDocument();
      expect(screen.getByText('/mes')).toBeInTheDocument();
      expect(screen.getByTestId('icon')).toBeInTheDocument();
    });

    it('deve renderizar multiplos KPICards com valores diferentes', () => {
      const { rerender } = render(<KPICard title="KPI 1" value={100} change={5} />);

      expect(screen.getByText('KPI 1')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();

      rerender(<KPICard title="KPI 2" value={200} change={-3} />);

      expect(screen.getByText('KPI 2')).toBeInTheDocument();
      expect(screen.getByText('200')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('deve renderizar com valor vazio', () => {
      render(<KPICard title="Titulo" value="" />);

      expect(screen.getByText('Titulo')).toBeInTheDocument();
    });

    it('deve renderizar com titulo muito longo', () => {
      const longTitle = 'Este é um titulo muito longo para testar como o componente se comporta';
      render(<KPICard title={longTitle} value={100} />);

      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    it('deve renderizar com change undefined explicitamente', () => {
      render(<KPICard title="Titulo" value={100} change={undefined} />);

      expect(screen.queryByText('vs. período anterior')).not.toBeInTheDocument();
    });

    it('deve renderizar com period vazio', () => {
      render(<KPICard title="Titulo" value={100} period="" />);

      expect(screen.getByText('Titulo')).toBeInTheDocument();
    });
  });

  describe('Acessibilidade', () => {
    it('deve ter estrutura semantica correta', () => {
      const { container } = render(<KPICard title="Titulo" value={100} />);

      // Verificar que tem Card com estrutura correta
      expect(container.querySelector('[class*="bg-zinc-900"]')).toBeInTheDocument();
    });

    it('deve manter contraste adequado para trends', () => {
      render(<KPICard title="Titulo" value={100} change={10} />);

      const positiveChange = screen.getByText('10%');
      expect(positiveChange).toHaveClass('text-emerald-500');
    });
  });
});
