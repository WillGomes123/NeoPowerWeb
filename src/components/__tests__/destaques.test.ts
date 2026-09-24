import { describe, it, expect } from 'vitest';
import { montarDestaques, nomeLegivel, resumoDosDestaques } from '../indicadores/destaques';
import type { Carregador, RelatorioMensal } from '../indicadores/tipos';

const cp = (
  id: number,
  local: string,
  desc: string,
  over: Partial<Carregador> = {}
): Carregador => ({
  chargePointId: `CP${id}`,
  nome: `${local} · ${desc}`,
  local,
  bairro: null,
  cidade: null,
  potenciaKw: 7,
  conectores: 1,
  faturamento: 0,
  energiaKwh: 0,
  operacoes: 0,
  usuarios: 0,
  novosUsuarios: 0,
  horasOcupadas: 0,
  horasDisponiveis: 720,
  ocupacaoPct: 0,
  precoMedioKwh: null,
  ticketMedio: null,
  duracaoMediaMin: null,
  anterior: {
    faturamento: 0,
    energiaKwh: 0,
    operacoes: 0,
    usuarios: 0,
    novosUsuarios: 0,
    ocupacaoPct: 0,
  },
  ...over,
});

const base = (carregadores: Carregador[], leituras: RelatorioMensal['leituras']) =>
  ({
    mes: '2026-09',
    comparacaoParcial: true,
    periodoAnterior: { ini: '2026-08-01 00:00:00', fim: '2026-08-24 00:00:00', horas: 552 },
    resumo: { faturamento: 1000, precoMedioKwh: 1.3, baseAtivaPct: 40 },
    variacoes: { faturamento: -15.3, energiaKwh: -10, operacoes: -12 },
    carregadores,
    leituras,
  }) as unknown as RelatorioMensal;

describe('destaques do mês', () => {
  it('agrupa os carregadores sem recarga por local e resume locais inteiros', () => {
    const lista = [
      cp(1, 'CONDOMÍNIO MORADA DOS PRÍNCIPES', 'Morada dos Principes 01'),
      cp(2, 'CONDOMÍNIO MORADA DOS PRÍNCIPES', 'Morada dos Principes 02'),
      cp(3, 'EDIFÍCIO DIAMOND', 'Diamond 01'),
      cp(4, 'EDIFÍCIO DIAMOND', 'Diamond 02'),
      cp(5, 'EDIFÍCIO DIAMOND', 'Diamond 03'),
      cp(6, 'EDIFÍCIO DIAMOND', 'Diamond 04'),
      cp(7, 'VILLA', 'Villa 01', { operacoes: 10, faturamento: 300, energiaKwh: 200 }),
      cp(8, 'VILLA', 'Villa 02'),
    ];
    const [d] = montarDestaques(
      base(lista, [{ tipo: 'alerta', titulo: 'Carregadores sem recarga', texto: 'texto longo' }])
    );
    expect(d.valor).toBe('7');
    expect(d.contexto).toBe('em 3 locais · de 8 no total');
    expect(d.grupos?.map(g => [g.local, g.todos, g.itens.length])).toEqual([
      ['Edifício Diamond', true, 4],
      ['Condomínio Morada dos Príncipes', true, 2],
      ['Villa', false, 1],
    ]);
    expect(d.grupos?.[2].itens[0].rotulo).toBe('Villa 02');
    expect(d.textoCurto).toContain('Edifício Diamond (todos os 4)');
  });

  it('põe atenção primeiro e cai no texto da API quando não reconhece a leitura', () => {
    const destaques = montarDestaques(
      base(
        [cp(1, 'A', 'A 01', { operacoes: 5, faturamento: 100, novosUsuarios: 3 })],
        [
          { tipo: 'positivo', titulo: 'Quem mais trouxe novos motoristas', texto: '...' },
          { tipo: 'info', titulo: 'Algo novo', texto: 'Texto da API.' },
          { tipo: 'alerta', titulo: 'Mês mais fraco', texto: '...' },
        ]
      )
    );
    expect(destaques.map(d => d.titulo)).toEqual([
      'Mês mais fraco',
      'Quem mais trouxe novos motoristas',
      'Algo novo',
    ]);
    expect(destaques[0].valor).toBe('-15,3%');
    expect(destaques[2].contexto).toBe('Texto da API.');
    expect(resumoDosDestaques(destaques)).toBe('1 ponto de atenção · 1 bom sinal · 1 para saber');
  });

  it('deixa legíveis só os nomes todos em maiúsculas', () => {
    expect(nomeLegivel('CONDOMÍNIO CARPE DIEM')).toBe('Condomínio Carpe Diem');
    expect(nomeLegivel('Vá de Bike')).toBe('Vá de Bike');
    expect(nomeLegivel('CP1')).toBe('CP1');
  });
});
