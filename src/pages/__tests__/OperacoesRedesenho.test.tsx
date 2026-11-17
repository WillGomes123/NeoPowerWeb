/**
 * Centro de operações no redesenho de nov/2026, à risca do frame "Operações" do
 * Figma completado pela imagem de referência da Lauriane: subtítulo certo, abas
 * sublinhadas, contadores com a parte da rede, lista de carregadores com caixas
 * de seleção, busca e filtros, e a barra de execução embaixo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { Operations } from '../Operations';

const carregadores = [
  {
    charge_point_id: 'CP-DC-01',
    description: 'Virtual DC 60 kW',
    vendor: 'NeoPower',
    model: 'Virtual 60 kW',
    isConnected: true,
    locationId: 1,
  },
  {
    charge_point_id: 'CP-AC-01',
    description: 'Virtual AC 7,4 kW',
    vendor: 'NeoPower',
    model: 'Virtual 7.4 kW',
    isConnected: true,
    locationId: 1,
  },
  {
    charge_point_id: 'CP-AC-02',
    description: 'Carregador da Garagem',
    vendor: 'Wallbox',
    model: 'Pulsar',
    isConnected: false,
    locationId: 2,
  },
];

const ok = (corpo: unknown) => ({ ok: true, status: 200, json: async () => corpo });

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(async (url: string) => {
      if (url === '/chargers') return ok({ data: carregadores });
      if (url === '/locations/all')
        return ok({
          locations: [
            { id: 1, nomeDoLocal: 'Posto Centro', endereco: '' },
            { id: 2, nomeDoLocal: 'Condomínio Jardim', endereco: '' },
          ],
        });
      return ok([]);
    }),
    post: vi.fn(async () => ok({ status: 'Accepted' })),
    delete: vi.fn(async () => ok({})),
  },
}));
vi.mock('../../lib/hooks/useSocket', () => ({
  useSocket: () => ({ isConnected: true, chargerStatuses: new Map(), lastUpdate: null }),
}));
vi.mock('../../lib/hooks/useEnviosDiagnostico', () => ({
  useEnviosDiagnostico: () => ({ envios: [], adicionar: vi.fn(), removerConcluidos: vi.fn() }),
}));
vi.mock('../../components/diagnosticos/PainelDiagnosticos', () => ({
  PainelDiagnosticos: () => <div>Painel de diagnósticos</div>,
}));

// O Select do Radix usa captura de ponteiro e scrollIntoView, que o jsdom não tem.
Object.assign(Element.prototype, {
  hasPointerCapture: () => false,
  setPointerCapture: () => {},
  releasePointerCapture: () => {},
  scrollIntoView: () => {},
});
// A caixa de seleção e a área de rolagem do Radix medem os elementos.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const abrir = async () => {
  render(
    <MemoryRouter>
      <Operations />
    </MemoryRouter>
  );
  await screen.findByRole('heading', { name: 'Centro de operações' });
};

const lista = () => within(screen.getByRole('region', { name: 'Seleção de carregadores' }));
const barra = () => within(screen.getByRole('region', { name: 'Executar comando' }));
/** A pílula "N de M selecionados" do cartão Carregadores. */
const pilula = (texto: string) =>
  lista().getByText((_, el) => el?.tagName === 'SPAN' && el.textContent === texto);

beforeEach(() => {
  vi.clearAllMocks();
});

// A página é grande (lista, comandos, diálogos do Radix): com a suíte inteira
// rodando em paralelo, 5 s não bastam.
describe('Centro de operações (redesenho)', { timeout: 30000 }, () => {
  it('tem o subtítulo da referência, as abas sublinhadas e os contadores com a parte da rede', async () => {
    await abrir();
    expect(
      screen.getByText('Execute e gerencie comandos OCPP nos carregadores conectados.')
    ).toBeInTheDocument();
    const abas = within(screen.getByRole('navigation', { name: 'Seções do Centro de operações' }));
    expect(abas.getByRole('button', { name: /Operações/ })).toHaveAttribute('aria-current', 'page');
    expect(abas.getByRole('button', { name: /Resultados/ })).toBeInTheDocument();
    expect(abas.getByRole('button', { name: /Diagnósticos/ })).toBeInTheDocument();

    const online = within(screen.getByRole('region', { name: 'Online' }));
    expect(online.getByText('2')).toBeInTheDocument();
    expect(online.getByText('67%')).toBeInTheDocument();
    const offline = within(screen.getByRole('region', { name: 'Offline' }));
    expect(offline.getByText('1')).toBeInTheDocument();
    expect(offline.getByText('33%')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Locais' })).getByText('2')
    ).toBeInTheDocument();
  });

  it('lista os carregadores por local, com caixa de seleção, ID · fabricante modelo e o estado', async () => {
    await abrir();
    expect(lista().getByRole('button', { name: /Posto Centro/ })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(lista().getByText('CP-DC-01 · NeoPower Virtual 60 kW')).toBeInTheDocument();
    expect(lista().getAllByText('Online')).toHaveLength(2);
    expect(lista().getByText('Offline')).toBeInTheDocument();
    expect(pilula('0 de 3 selecionados')).toBeInTheDocument();

    await userEvent.click(lista().getByRole('checkbox', { name: /Virtual DC 60 kW/ }));
    expect(lista().getByRole('checkbox', { name: /Virtual DC 60 kW/ })).toBeChecked();
    expect(pilula('1 de 3 selecionados')).toBeInTheDocument();
    expect(barra().getByText(/carregador$/)).toHaveTextContent('1 carregador');

    // Recolher o local esconde as linhas dele
    await userEvent.click(lista().getByRole('button', { name: /Posto Centro/ }));
    expect(lista().queryByRole('checkbox', { name: /Virtual DC 60 kW/ })).not.toBeInTheDocument();
  });

  it('busca por local, carregador ou ID e filtra por status', async () => {
    await abrir();
    await userEvent.type(lista().getByRole('searchbox'), 'jardim');
    expect(lista().getByRole('checkbox', { name: /Carregador da Garagem/ })).toBeInTheDocument();
    expect(lista().queryByRole('checkbox', { name: /Virtual DC/ })).not.toBeInTheDocument();

    await userEvent.clear(lista().getByRole('searchbox'));
    await userEvent.click(lista().getByRole('combobox', { name: 'Filtrar por status' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Offline (1)' }));
    expect(lista().getAllByRole('checkbox')).toHaveLength(1);
    expect(lista().getByRole('checkbox', { name: /Carregador da Garagem/ })).toBeInTheDocument();
  });

  it('"Selecionar online" e "Limpar seleção" continuam no cabeçalho do cartão', async () => {
    await abrir();
    await userEvent.click(lista().getByRole('button', { name: 'Selecionar online (2)' }));
    expect(lista().getByRole('checkbox', { name: /Virtual DC 60 kW/ })).toBeChecked();
    expect(lista().getByRole('checkbox', { name: /Virtual AC 7,4 kW/ })).toBeChecked();
    expect(lista().getByRole('checkbox', { name: /Carregador da Garagem/ })).not.toBeChecked();
    await userEvent.click(lista().getByRole('button', { name: 'Limpar seleção' }));
    for (const caixa of lista().getAllByRole('checkbox')) expect(caixa).not.toBeChecked();
    expect(pilula('0 de 3 selecionados')).toBeInTheDocument();
  });

  it('escolher o comando marca o cartão e a barra executa com o diálogo de parâmetros', async () => {
    await abrir();
    const executar = barra().getByRole('button', { name: /Executar comando/ });
    expect(executar).toBeDisabled();
    expect(barra().getByText('Nenhuma')).toBeInTheDocument();

    await userEvent.click(lista().getByRole('checkbox', { name: /Virtual DC 60 kW/ }));
    const escolha = within(screen.getByRole('region', { name: 'Escolha um comando' }));
    expect(
      escolha.getByText(
        'Selecione o tipo de operação que deseja executar nos carregadores (1 selecionado).'
      )
    ).toBeInTheDocument();
    await userEvent.click(escolha.getByRole('button', { name: /Reinicializar/ }));
    expect(escolha.getByRole('button', { name: /Reinicializar/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(barra().getByText('Reinicializar')).toBeInTheDocument();

    expect(executar).toBeEnabled();
    await userEvent.click(executar);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Tipo de Reset')).toBeInTheDocument();
  });

  it('as outras categorias abrem e fecham pela linha', async () => {
    await abrir();
    const escolha = within(screen.getByRole('region', { name: 'Escolha um comando' }));
    const transacoes = escolha.getByRole('button', { name: /Transações/ });
    expect(transacoes).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(transacoes);
    expect(escolha.getByRole('button', { name: /Iniciar Recarga/ })).toBeInTheDocument();
    expect(escolha.queryByRole('button', { name: /Limpar Cache/ })).not.toBeInTheDocument();
  });
});
