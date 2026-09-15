import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { RelatorioMensal } from '../indicadores/RelatorioMensal';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import type { Carregador, RelatorioMensal as Relatorio } from '../indicadores/tipos';

vi.mock('../../lib/auth', () => ({ useAuth: vi.fn() }));
vi.mock('../../lib/api', () => ({ api: { get: vi.fn(), put: vi.fn() } }));

// recharts mede o container; no jsdom ele não tem tamanho.
vi.mock('recharts', async () => {
  const real = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...real,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) => (
      <div style={{ width: 800, height: 300 }}>{children}</div>
    ),
  };
});

const carregador = (over: Partial<Carregador>): Carregador => ({
  chargePointId: 'CP1',
  nome: 'AP Brasil Compensa',
  local: 'AP Brasil Compensa',
  bairro: 'Compensa',
  cidade: 'Manaus',
  potenciaKw: 22,
  conectores: 1,
  faturamento: 14793,
  energiaKwh: 13259,
  operacoes: 563,
  usuarios: 132,
  novosUsuarios: 35,
  horasOcupadas: 521,
  horasDisponiveis: 744,
  ocupacaoPct: 70,
  precoMedioKwh: 1.12,
  ticketMedio: 26.28,
  duracaoMediaMin: 55,
  anterior: {
    faturamento: 13597,
    energiaKwh: 13641,
    operacoes: 560,
    usuarios: 120,
    novosUsuarios: 30,
    ocupacaoPct: 68,
  },
  ...over,
});

const resumo = {
  faturamento: 81819,
  energiaKwh: 60623,
  operacoes: 2782,
  usuariosAtivos: 598,
  novosUsuarios: 245,
  baseAcumulada: 1139,
  baseAtivaPct: 52.5,
  ocupacaoPct: 27.6,
  precoMedioKwh: 1.35,
  ticketMedio: 29.41,
  duracaoMediaMin: 62,
  carregadoresAtivos: 2,
};

const relatorio: Relatorio = {
  mes: '2026-08',
  fuso: 'America/Manaus',
  geradoEm: '2026-09-14 10:00:00',
  fechado: true,
  comparacaoParcial: false,
  periodo: { ini: '2026-08-01 00:00:00', fim: '2026-09-01 00:00:00', horas: 744 },
  periodoAnterior: { ini: '2026-07-01 00:00:00', fim: '2026-08-01 00:00:00', horas: 744 },
  resumo,
  resumoAnterior: { ...resumo, faturamento: 60572, operacoes: 2240, usuariosAtivos: 419 },
  variacoes: {
    faturamento: 35.1,
    energiaKwh: 22.1,
    operacoes: 24.2,
    usuariosAtivos: 42.7,
    novosUsuarios: null,
    baseAcumulada: 27.4,
    baseAtivaPp: 1.2,
    ocupacaoPp: 3,
    precoMedioKwh: 10.6,
    ticketMedio: 8.8,
  },
  serie: ['2026-06', '2026-07', '2026-08'].map((mes, i) => ({
    mes,
    faturamento: [40000, 60572, 81819][i],
    energiaKwh: [36331, 49639, 60623][i],
    operacoes: [1646, 2240, 2782][i],
    usuariosAtivos: [316, 419, 598][i],
    novosUsuarios: [150, 180, 245][i],
    baseAcumulada: [714, 894, 1139][i],
  })),
  carregadores: [
    carregador({}),
    carregador({
      chargePointId: 'CP8',
      nome: 'Tacacá',
      bairro: null,
      faturamento: 3441,
      ocupacaoPct: 9.6,
      novosUsuarios: 18,
    }),
  ],
  bairros: [
    {
      bairro: 'Compensa',
      carregadores: 1,
      novosUsuarios: 35,
      faturamento: 14793,
      energiaKwh: 13259,
      operacoes: 563,
    },
    {
      bairro: 'Sem bairro',
      carregadores: 1,
      novosUsuarios: 18,
      faturamento: 3441,
      energiaKwh: 2098,
      operacoes: 133,
    },
  ],
  horarios: [{ dia: 5, hora: 18, operacoes: 40, energiaKwh: 800 }],
  projecao: {
    base: '2026-08',
    taxas: { faturamento: 22, energiaKwh: 22.6, operacoes: 21.9, usuariosAtivos: 23.2 },
    meses: [
      {
        mes: '2026-09',
        faturamento: 99800,
        energiaKwh: 74304,
        operacoes: 3391,
        usuariosAtivos: 737,
      },
    ],
  },
  metas: {
    mes: '2026-08',
    definidas: true,
    atualizadoEm: null,
    numericas: [
      {
        chave: 'faturamento',
        rotulo: 'Faturamento em recarga',
        unidade: 'R$',
        meta: 75000,
        resultado: 81819,
        avaliacao: { status: 'bateu', atingidoPct: 109.1, diferenca: 9.1 },
      },
      {
        chave: 'operacoes',
        rotulo: 'Transações no mês',
        unidade: '',
        meta: 3000,
        resultado: 2782,
        avaliacao: { status: 'nao_bateu', atingidoPct: 92.7, diferenca: -7.3 },
      },
    ],
    itens: [
      {
        area: 'Comercial',
        descricao: 'Fechar parceria com uma rede',
        resultado: 'Grupo Tvlar',
        status: 'bateu',
      },
    ],
  },
  leituras: [
    { tipo: 'alerta', titulo: 'Carregador saturando', texto: 'AP Brasil Compensa (70%, 1 con.)' },
  ],
};

const responder = (corpo: unknown, ok = true) =>
  Promise.resolve({ ok, json: () => Promise.resolve(corpo) } as Response);

describe('RelatorioMensal', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
  });

  it('mostra KPIs, ranking, metas e leituras do mês', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '1', name: 'Admin', email: 'a@a', role: 'admin', clientId: null },
    } as ReturnType<typeof useAuth>);
    vi.mocked(api.get).mockReturnValue(responder(relatorio));

    render(<RelatorioMensal />);

    expect(await screen.findByText('R$ 81.819', { selector: 'span' })).toBeInTheDocument();
    expect(vi.mocked(api.get).mock.calls[0][0]).toMatch(
      /^\/indicators\/monthly\?mes=\d{4}-\d{2}&meses=12$/
    );
    expect(screen.getByText('Resumo de agosto')).toBeInTheDocument();
    const texto = document.body.textContent ?? '';
    expect(texto).toContain('sua rede fez 2.782 recargas para 598 motoristas e faturou R$ 81.819');
    expect(texto).toContain('35,1% a mais que em julho');
    expect(screen.getByText('Carregador saturando')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Carregadores/ }));
    expect(screen.getAllByText('AP Brasil Compensa').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /Motoristas/ }));
    expect(screen.getByText(/Alguns locais estão sem bairro/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Metas e projeção/ }));
    expect(document.body.textContent).toContain('2 batidas · 1 não batidas · 0 quase lá');
  });

  it('reordena a tabela de carregadores pela coluna clicada', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '1', name: 'Admin', email: 'a@a', role: 'admin', clientId: null },
    } as ReturnType<typeof useAuth>);
    vi.mocked(api.get).mockReturnValue(responder(relatorio));

    render(<RelatorioMensal />);
    await screen.findByText('Resumo de agosto');
    fireEvent.click(screen.getByRole('button', { name: /Carregadores/ }));

    const nomesNaTabela = () =>
      Array.from(document.querySelectorAll('tbody tr td:first-child p:first-child')).map(
        p => p.textContent
      );
    expect(nomesNaTabela()).toEqual(['AP Brasil Compensa', 'Tacacá']);
    const cabecalho = document.querySelector('thead') as HTMLElement;
    fireEvent.click(within(cabecalho).getByRole('button', { name: /^Faturamento/ }));
    expect(nomesNaTabela()).toEqual(['Tacacá', 'AP Brasil Compensa']);
  });

  it('mostra o erro da API', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '1', name: 'Op', email: 'o@o', role: 'operador', clientId: 'vipenergy' },
    } as ReturnType<typeof useAuth>);
    vi.mocked(api.get).mockReturnValue(responder({ error: 'Esse mês ainda não começou.' }, false));

    render(<RelatorioMensal />);
    expect(await screen.findByText('Esse mês ainda não começou.')).toBeInTheDocument();
  });

  it('não consulta a API para conta comum', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '2', name: 'Motorista', email: 'm@m', role: 'comum', clientId: 'vipenergy' },
    } as ReturnType<typeof useAuth>);

    render(<RelatorioMensal />);
    expect(
      await screen.findByText(/exclusivo de administradores e operadores/)
    ).toBeInTheDocument();
    await waitFor(() => expect(api.get).not.toHaveBeenCalled());
  });
});
