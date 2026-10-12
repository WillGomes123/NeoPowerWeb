/**
 * Estações › Carregadores pendentes: excluir um pendente não pode trocar a
 * página pela tela de carregamento. Era o que acontecia (fetchData ligava o
 * `loading` a cada exclusão): a página era remontada, a lista de pendentes
 * fechava e a rolagem voltava ao topo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { Stations } from '../Stations';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('html2canvas', () => ({ default: vi.fn() }));
vi.mock('jspdf', () => ({ jsPDF: vi.fn() }));
vi.mock('../../components/QrCodeTemplate', () => ({ QrCodeTemplate: () => null }));
vi.mock('../../components/ChargerDetailsDialog', () => ({ ChargerDetailsDialog: () => null }));
vi.mock('../../components/ChargerLogsSheet', () => ({ ChargerLogsSheet: () => null }));
vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ user: { id: 1, role: 'admin', clientId: null } }),
}));
vi.mock('../../lib/hooks/useSocket', () => ({
  useSocket: () => ({ chargerStatuses: new Map() }),
}));

const resposta = (corpo: unknown, ok = true) => ({ ok, json: async () => corpo });

const pendente = (id: string) => ({
  charge_point_id: id,
  description: null,
  model: null,
  vendor: null,
  locationId: null,
  clientId: null,
  isConnected: false,
});

let carregadores = [pendente('PEND-A'), pendente('PEND-B'), pendente('PEND-C')];
/** Quando definido, o GET /chargers fica pendurado até o teste liberar. */
let segurarChargers: Promise<void> | null = null;

const mockGet = vi.fn(async (rota: string) => {
  if (rota === '/chargers') {
    if (segurarChargers) await segurarChargers;
    return resposta({ data: carregadores });
  }
  if (rota === '/locations/all') return resposta({ data: { locations: [{ id: 1, nomeDoLocal: 'Local 1' }] } });
  if (rota === '/overview-stats') return resposta({ kwhToday: 0 });
  return resposta({ data: [] });
});
const mockDelete = vi.fn(async (rota: string) => {
  const id = decodeURIComponent(rota.split('/').pop() || '');
  carregadores = carregadores.filter(c => c.charge_point_id !== id);
  return resposta({ success: true });
});

vi.mock('../../lib/api', () => ({
  api: {
    get: (rota: string) => mockGet(rota),
    delete: (rota: string) => mockDelete(rota),
    post: vi.fn(async () => resposta({})),
    put: vi.fn(async () => resposta({})),
  },
}));

const abrirPendentes = async () => {
  const titulo = await screen.findByText('Carregadores Pendentes de Configuração');
  await userEvent.click(titulo);
  await screen.findByText('PEND-A');
};

describe('Estações: excluir carregador pendente', () => {
  beforeEach(() => {
    carregadores = [pendente('PEND-A'), pendente('PEND-B'), pendente('PEND-C')];
    segurarChargers = null;
    mockGet.mockClear();
    mockDelete.mockClear();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('a lista continua aberta e sem tela de carregamento enquanto os dados são atualizados', async () => {
    render(<MemoryRouter><Stations /></MemoryRouter>);
    await abrirPendentes();

    // A atualização depois da exclusão fica pendurada: é nessa janela que a
    // página inteira virava a tela de carregamento.
    let liberar: () => void = () => {};
    segurarChargers = new Promise<void>(r => { liberar = r; });

    const botoes = screen.getAllByTitle('Excluir carregador');
    await userEvent.click(botoes[0]);

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/chargers/PEND-A'));
    // O excluído some na hora; os outros pendentes continuam na tela.
    await waitFor(() => expect(screen.queryByText('PEND-A')).toBeNull());
    expect(screen.getByText('PEND-B')).toBeTruthy();
    expect(screen.getByText('PEND-C')).toBeTruthy();
    expect(screen.getByText('Carregadores Pendentes de Configuração')).toBeTruthy();

    liberar();
    await waitFor(() => expect(mockGet.mock.calls.filter(c => c[0] === '/chargers').length).toBe(2));
    // Depois de atualizar, a lista segue aberta com os que restaram.
    expect(screen.getByText('PEND-B')).toBeTruthy();
    expect(screen.getByText('PEND-C')).toBeTruthy();
  });

  it('dá para excluir vários em seguida sem reabrir a lista', async () => {
    render(<MemoryRouter><Stations /></MemoryRouter>);
    await abrirPendentes();

    await userEvent.click(screen.getAllByTitle('Excluir carregador')[0]);
    await waitFor(() => expect(screen.queryByText('PEND-A')).toBeNull());
    await userEvent.click(screen.getAllByTitle('Excluir carregador')[0]);
    await waitFor(() => expect(screen.queryByText('PEND-B')).toBeNull());

    expect(mockDelete).toHaveBeenCalledTimes(2);
    expect(screen.getByText('PEND-C')).toBeTruthy();
  });
});
