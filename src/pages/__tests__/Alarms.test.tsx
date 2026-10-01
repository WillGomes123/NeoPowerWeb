/**
 * OCPP-5 — Histórico de alarmes: mensagem completa.
 *
 * A coluna "Mensagem" é `max-w-[240px] truncate`, então mensagem longa aparecia
 * cortada com reticências e não havia como ler o resto. Estes testes cobrem o
 * botão de expandir e a linha de detalhe que passaram a mostrar o texto inteiro.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Alarms, MESSAGE_PREVIEW_LIMIT, isMensagemLonga } from '../Alarms';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockGet = vi.fn();
vi.mock('../../lib/api', () => ({
  api: { get: (endpoint: string) => mockGet(endpoint) },
}));

const MENSAGEM_LONGA =
  'Falha de aterramento detectada no conector 2 durante a sessão de carga: ' +
  'corrente de fuga acima do limite de 30 mA, desarme do DR e bloqueio ' +
  'preventivo do conector. Verificar malha de aterramento do poste.';

const MENSAGEM_CURTA = 'Carregador offline.';

const alarme = (over: Record<string, unknown> = {}) => ({
  id: 'AL-1',
  charger_id: 'CP-0001',
  connector_id: 2,
  error_code: 'GroundFailure',
  severity: 'critical',
  status: 'active',
  message: MENSAGEM_LONGA,
  timestamp: '2026-09-29T12:00:00.000Z',
  location_name: 'Posto Central',
  ...over,
});

const responderCom = (alarmes: unknown[]) => {
  mockGet.mockImplementation((endpoint: string) => {
    if (endpoint === '/alarms') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(alarmes) });
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve([]) });
  });
};

beforeEach(() => {
  mockGet.mockReset();
});

describe('isMensagemLonga', () => {
  it('marca como longa a mensagem que não cabe na coluna', () => {
    expect(isMensagemLonga(MENSAGEM_LONGA)).toBe(true);
    expect(isMensagemLonga('x'.repeat(MESSAGE_PREVIEW_LIMIT + 1))).toBe(true);
  });

  it('não marca a mensagem que cabe', () => {
    expect(isMensagemLonga(MENSAGEM_CURTA)).toBe(false);
    expect(isMensagemLonga('x'.repeat(MESSAGE_PREVIEW_LIMIT))).toBe(false);
  });

  it('trata vazio, espaços e ausência sem quebrar', () => {
    expect(isMensagemLonga('')).toBe(false);
    expect(isMensagemLonga('   ')).toBe(false);
    expect(isMensagemLonga(null)).toBe(false);
    expect(isMensagemLonga(undefined)).toBe(false);
  });
});

describe('Histórico de Alarmes — mensagem completa', () => {
  it('oferece o botão de expandir quando a mensagem é longa', async () => {
    responderCom([alarme()]);
    render(<Alarms />);

    const botao = await screen.findByRole('button', { name: /ver mensagem completa/i });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
  });

  it('mostra a mensagem inteira ao expandir e some ao recolher', async () => {
    responderCom([alarme()]);
    const user = userEvent.setup();
    render(<Alarms />);

    const botao = await screen.findByRole('button', { name: /ver mensagem completa/i });
    // Antes de expandir, a mensagem aparece só uma vez (a prévia cortada).
    expect(screen.getAllByText(MENSAGEM_LONGA)).toHaveLength(1);

    await user.click(botao);

    // Agora aparece duas vezes: a prévia e a linha de detalhe.
    await waitFor(() => expect(screen.getAllByText(MENSAGEM_LONGA)).toHaveLength(2));
    expect(screen.getByText(/mensagem completa/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /recolher mensagem/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    );

    await user.click(screen.getByRole('button', { name: /recolher mensagem/i }));
    await waitFor(() => expect(screen.getAllByText(MENSAGEM_LONGA)).toHaveLength(1));
  });

  it('não oferece o botão quando a mensagem já cabe na coluna', async () => {
    responderCom([alarme({ message: MENSAGEM_CURTA, severity: 'high', error_code: 'Offline' })]);
    render(<Alarms />);

    expect(await screen.findByText(MENSAGEM_CURTA)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ver mensagem completa/i })).toBeNull();
  });

  it('mantém a mensagem completa no title, para quem só passa o mouse', async () => {
    responderCom([alarme()]);
    render(<Alarms />);

    const previa = await screen.findByTitle(MENSAGEM_LONGA);
    expect(previa).toHaveTextContent(MENSAGEM_LONGA);
  });

  it('expande uma linha sem abrir as outras', async () => {
    responderCom([
      alarme({ id: 'AL-1', message: `${MENSAGEM_LONGA} Alarme um.` }),
      alarme({ id: 'AL-2', message: `${MENSAGEM_LONGA} Alarme dois.` }),
    ]);
    const user = userEvent.setup();
    render(<Alarms />);

    const botoes = await screen.findAllByRole('button', { name: /ver mensagem completa/i });
    expect(botoes).toHaveLength(2);

    await user.click(botoes[0]);

    await waitFor(() =>
      expect(screen.getAllByText(`${MENSAGEM_LONGA} Alarme um.`)).toHaveLength(2)
    );
    expect(screen.getAllByText(`${MENSAGEM_LONGA} Alarme dois.`)).toHaveLength(1);
  });

  it('liga o botão à linha de detalhe por aria-controls', async () => {
    responderCom([alarme()]);
    const user = userEvent.setup();
    render(<Alarms />);

    const botao = await screen.findByRole('button', { name: /ver mensagem completa/i });
    await user.click(botao);

    const detalheId = screen
      .getByRole('button', { name: /recolher mensagem/i })
      .getAttribute('aria-controls');
    expect(detalheId).toBeTruthy();
    expect(document.getElementById(detalheId as string)).toBeInTheDocument();
  });
});
