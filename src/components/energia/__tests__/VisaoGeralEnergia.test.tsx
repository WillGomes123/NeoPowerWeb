/**
 * Visão geral do módulo Energia no redesenho (Figma, Frame 18): o "Comece por
 * aqui" conta as etapas feitas, destaca a da vez e leva à aba certa; os cinco
 * cartões mostram os números do painel.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { VisaoGeral } from '../VisaoGeral';
import type { PainelEnergia } from '../../../lib/energia';

const painelVazio = (extra: Partial<PainelEnergia> = {}): PainelEnergia =>
  ({
    parametros: { tarifaB: 0, tarifaA: 0, fioBParticipacao: 0, fioBEscalonamento: 0, taxaNeopower: 0.1 },
    usinas: [],
    pontos: [],
    conexoes: [],
    kpis: {
      usinasOperando: 0,
      usinasEmHomologacao: 0,
      pontosComEnergia: 0,
      pontosTotal: 0,
      compensadoKwh: 0,
      geradoKwh: 0,
      economia: 0,
      repasseUsinas: 0,
      neopower: 0,
    },
    totaisApuracao: {},
    alertas: [],
    distribuidoras: {},
    modalidades: {},
    ...extra,
  }) as unknown as PainelEnergia;

const abrir = (painel: PainelEnergia, irPara = vi.fn()) => {
  render(<VisaoGeral painel={painel} podeEditar mudar={vi.fn()} irPara={irPara} />);
  return irPara;
};

describe('Energia · Visão geral (redesenho)', () => {
  it('módulo vazio: 0 de 3 etapas e a primeira leva às usinas', async () => {
    const irPara = abrir(painelVazio());
    expect(screen.getByRole('heading', { name: 'Comece por aqui' })).toBeInTheDocument();
    expect(screen.getByText('0 de 3 etapas')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Cadastrar usina/ }));
    expect(irPara).toHaveBeenCalledWith('usinas');
  });

  it('com usina cadastrada, a etapa 1 vira "Ver usinas" e conta 1 de 3', () => {
    abrir(painelVazio({ usinas: [{ id: 1 }] as unknown as PainelEnergia['usinas'] }));
    expect(screen.getByText('1 de 3 etapas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ver usinas/ })).toBeInTheDocument();
  });

  it('mostra os cinco cartões do Figma', () => {
    abrir(painelVazio());
    for (const rotulo of [
      'Usinas cadastradas',
      'Pontos consumidores',
      'Energia compensada',
      'Economia dos pontos',
      'Repasse às usinas',
    ]) {
      expect(screen.getByRole('region', { name: rotulo })).toBeInTheDocument();
    }
    expect(screen.getByText('Aguardando cadastro para exibir o consumo.')).toBeInTheDocument();
  });
});
