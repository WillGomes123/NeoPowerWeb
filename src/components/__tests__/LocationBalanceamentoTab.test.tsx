/**
 * Aba "Balanceamento de carga" do local: lê a visão, o status ao vivo e o
 * registro; o modo ativo só para o admin da plataforma (com confirmação); o
 * token do medidor aparece uma vez, com o endereço; a ligação dos
 * carregadores vai para a API com os números convertidos.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LocationBalanceamentoTab } from '../location-details/LocationBalanceamentoTab';
import type { StatusDoBalanceamento, VisaoDoBalanceamento } from '../../lib/balanceamento';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockGet = vi.fn();
const mockPut = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();
vi.mock('../../lib/api', () => ({
  api: {
    get: (e: string) => mockGet(e),
    put: (e: string, d: unknown) => mockPut(e, d),
    post: (e: string, d: unknown) => mockPost(e, d),
    delete: (e: string) => mockDelete(e),
  },
}));

const resposta = (dados: unknown, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => dados,
});

const ENDPOINT = 'https://ocppapi-production.up.railway.app/api/site-meters/readings';

const visao = (
  admin: boolean,
  modo: 'desligado' | 'observar' | 'ativo' = 'observar'
): VisaoDoBalanceamento => ({
  locationRefId: 21,
  config: {
    salva: true,
    modo,
    medidorId: 5,
    limitePorFaseA: 100,
    margemA: null,
    margemEfetivaA: 10,
    limitePotenciaKw: null,
    correnteMinimaA: 6,
    limiteSeguroA: 6,
    intervaloEnvioS: 15,
    histereseA: 1,
    modoAlteradoEm: null,
    atualizadoEm: null,
  },
  medidores: [
    {
      id: 5,
      locationRefId: 21,
      identificador: 'QGBT-01',
      nome: 'Quadro geral',
      pontoDeMedicao: 'entrada_total',
      fases: 3,
      ativo: true,
      temToken: true,
      tokenGeradoEm: '2026-10-10T12:00:00.000Z',
      ultimoContatoEm: new Date().toISOString(),
      online: true,
      criadoEm: '2026-10-10T12:00:00.000Z',
    },
  ],
  carregadores: [
    {
      chargePointId: 'CP-1',
      fabricante: 'Liteon',
      modelo: 'AC',
      potenciaKw: 22,
      status: 'Charging',
      conectado: true,
      doLocal: true,
      mapeado: true,
      fases: 'L1L2L3',
      correnteMaxA: 32,
      unidade: 'A',
      prioridade: 1,
      participa: true,
    },
    {
      chargePointId: 'CP-2',
      fabricante: null,
      modelo: null,
      potenciaKw: null,
      status: 'Available',
      conectado: true,
      doLocal: true,
      mapeado: false,
      fases: 'L1L2L3',
      correnteMaxA: 32,
      unidade: 'A',
      prioridade: null,
      participa: false,
    },
  ],
  endpoint: ENDPOINT,
  perfil: { chargingProfileId: 900, stackLevel: 1, proposito: 'ChargePointMaxProfile' },
  permissoes: { podeAtivar: admin, podeEditarLimites: admin, podeObservar: true },
});

const STATUS: StatusDoBalanceamento = {
  agora: new Date().toISOString(),
  modo: 'observar',
  estado: 'calculado',
  motivo: null,
  medidor: {
    id: 5,
    identificador: 'QGBT-01',
    nome: 'Quadro geral',
    fases: 3,
    pontoDeMedicao: 'entrada_total',
    ultimoContatoEm: new Date().toISOString(),
    online: true,
  },
  leitura: {
    medidoEm: new Date().toISOString(),
    recebidoEm: new Date().toISOString(),
    idadeS: 1.2,
    fresca: true,
    frescaAteS: 15,
    fases: {
      L1: { correnteA: 70, tensaoV: 220.4, potenciaW: null },
      L2: { correnteA: 60, tensaoV: 219.8, potenciaW: null },
      L3: { correnteA: 65, tensaoV: 221, potenciaW: null },
    },
    potenciaTotalW: 26400,
    frequenciaHz: 60,
    device: null,
  },
  limitePorFaseA: 100,
  margemA: 10,
  porFase: {
    L1: { medidoA: 70, evA: 16, semEvA: 54, disponivelA: 36 },
    L2: { medidoA: 60, evA: 16, semEvA: 44, disponivelA: 46 },
    L3: { medidoA: 65, evA: 15, semEvA: 50, disponivelA: 40 },
  },
  potencia: null,
  carregadores: [
    {
      chargePointId: 'CP-1',
      participa: true,
      emSessao: true,
      inicioSessao: new Date().toISOString(),
      fases: 'L1L2L3',
      correnteMaxA: 32,
      unidade: 'A',
      prioridade: 1,
      cargaA: { L1: 16, L2: 16, L3: 15 },
      idadeAmostraS: 10,
      calculadoA: 32,
      calculado: 32,
      motivo: null,
      enviado: null,
    },
  ],
};

function prepararApi(admin: boolean, modo: 'desligado' | 'observar' | 'ativo' = 'observar') {
  mockGet.mockImplementation(async (e: string) => {
    if (e.endsWith('/balanceamento')) return resposta(visao(admin, modo));
    if (e.endsWith('/balanceamento/status')) return resposta(STATUS);
    if (e.includes('/balanceamento/decisoes')) {
      return resposta({
        itens: [
          {
            id: 1,
            criadoEm: new Date().toISOString(),
            modo: 'observar',
            motivo: null,
            medidorId: 5,
            leituraEm: null,
            porFase: STATUS.porFase,
            potencia: null,
            carregadores: [
              {
                chargePointId: 'CP-1',
                limite: 32,
                unidade: 'A',
                envio: 'primeiro',
                enviado: false,
                simulado: true,
                status: null,
                erro: null,
              },
            ],
            enviado: false,
          },
        ],
      });
    }
    return resposta({ error: 'não encontrado' }, 404);
  });
  mockPut.mockImplementation(async (_e: string, d: { modo?: string }) =>
    resposta({ config: { ...visao(admin, modo).config, ...(d?.modo ? { modo: d.modo } : {}) } })
  );
}

beforeEach(() => {
  mockGet.mockReset();
  mockPut.mockReset();
  mockPost.mockReset();
  mockDelete.mockReset();
});

describe('LocationBalanceamentoTab', () => {
  it('mostra as fases, os carregadores, o medidor e o registro', async () => {
    prepararApi(false);
    render(<LocationBalanceamentoTab locationId={21} />);
    expect(await screen.findByText('Balanceamento de carga')).toBeInTheDocument();
    expect(screen.getByText('FASE L1')).toBeInTheDocument();
    expect(screen.getByText('FASE L3')).toBeInTheDocument();
    expect(screen.getByText('36,0 A')).toBeInTheDocument();
    expect(screen.getAllByText('QGBT-01').length).toBeGreaterThan(0);
    expect(screen.getByText(`POST ${ENDPOINT}`)).toBeInTheDocument();
    expect(screen.getByText(/seria enviado/)).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith('/locations/21/balanceamento/status');
  });

  it('operador: não liga o ativo nem edita limites, mas alterna desligado/observar', async () => {
    prepararApi(false);
    const user = userEvent.setup();
    render(<LocationBalanceamentoTab locationId={21} />);
    const ativo = await screen.findByRole('button', { name: 'Ativo' });
    expect(ativo).toBeDisabled();
    expect(screen.getByLabelText('Limite por fase (A)')).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Salvar limites/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Salvar ligação/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Desligado' }));
    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith('/locations/21/balanceamento', { modo: 'desligado' })
    );
  });

  it('admin: ativar pede confirmação antes de mandar limites', async () => {
    prepararApi(true);
    const user = userEvent.setup();
    render(<LocationBalanceamentoTab locationId={21} />);
    await user.click(await screen.findByRole('button', { name: 'Ativo' }));
    const dialogo = await screen.findByRole('alertdialog');
    expect(within(dialogo).getByText(/Ativar o balanceamento\?/)).toBeInTheDocument();
    expect(mockPut).not.toHaveBeenCalled();
    await user.click(within(dialogo).getByRole('button', { name: 'Ativar e enviar limites' }));
    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith('/locations/21/balanceamento', { modo: 'ativo' })
    );
  });

  it('cadastrar medidor mostra o token uma vez, com o endereço', async () => {
    prepararApi(true);
    mockPost.mockResolvedValue(
      resposta({
        medidor: { ...visao(true).medidores[0], id: 6, identificador: 'QGBT-02' },
        token: 'npmed_TOKEN-UNICO',
        endpoint: ENDPOINT,
      })
    );
    const user = userEvent.setup();
    render(<LocationBalanceamentoTab locationId={21} />);
    await user.click(await screen.findByRole('button', { name: /Cadastrar medidor/ }));
    await user.type(screen.getByLabelText('Identificador (meter_id)'), 'QGBT-02');
    await user.click(screen.getByRole('button', { name: /Cadastrar e gerar token/ }));
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/locations/21/site-meters', {
        identificador: 'QGBT-02',
        nome: undefined,
        pontoDeMedicao: 'entrada_total',
        fases: 3,
      })
    );
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('npmed_TOKEN-UNICO')).toBeInTheDocument();
    expect(within(dialogo).getByText(`POST ${ENDPOINT}`)).toBeInTheDocument();
  });

  it('admin salva a ligação dos carregadores com os números convertidos', async () => {
    prepararApi(true);
    mockPut.mockImplementation(async (e: string) =>
      e.endsWith('/carregadores')
        ? resposta({ carregadores: [] })
        : resposta({ config: visao(true).config })
    );
    const user = userEvent.setup();
    render(<LocationBalanceamentoTab locationId={21} />);
    await screen.findByRole('button', { name: /Salvar ligação/ });
    const linhas = screen.getAllByRole('switch');
    await user.click(linhas[1]); // CP-2 passa a participar
    await user.click(screen.getByRole('button', { name: /Salvar ligação/ }));
    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith('/locations/21/balanceamento/carregadores', {
        carregadores: [
          {
            chargePointId: 'CP-1',
            fases: 'L1L2L3',
            correnteMaxA: 32,
            unidade: 'A',
            prioridade: 1,
            participa: true,
          },
          {
            chargePointId: 'CP-2',
            fases: 'L1L2L3',
            correnteMaxA: 32,
            unidade: 'A',
            prioridade: null,
            participa: true,
          },
        ],
      })
    );
  });
});
