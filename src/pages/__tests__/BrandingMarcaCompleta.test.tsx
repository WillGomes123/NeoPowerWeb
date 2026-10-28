/**
 * White Label › Configurar Marca: os campos da marca completa (paleta, selos
 * de status, fonte, símbolo, suporte e documentos) vão no salvar. Campo vazio
 * vai como null, para a marca voltar ao padrão; formato errado para no
 * formulário, sem chamar a API.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';

import { Branding } from '../Branding';
import { camposDaMarcaCompleta } from '../../lib/marcaCompleta';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ user: { id: 1, role: 'admin', clientId: null, branding: null } }),
  guardarDadosDoUsuario: vi.fn(),
}));
vi.mock('../../components/branding/PagamentosDaMarca', () => ({ PagamentosDaMarca: () => null }));
vi.mock('../../components/PromotionsDialog', () => ({ PromotionsDialog: () => null }));

const resposta = (corpo: unknown, ok = true) => ({ ok, json: async () => corpo });

const fulgo = {
  clientId: 'fulgo',
  companyName: 'FulGo',
  logoType: 'image',
  logoUri: 'https://painel.exemplo/marcas/fulgo/icone-1024.png',
  primaryColor: '#2F1A99',
  splashBgColor: '#2F1A99',
  theme: 'light',
  headerColor: '#2F1A99',
  updatedAt: '2026-10-27T12:00:00Z',
};

const mockPut = vi.fn(async (_rota: string, _corpo: unknown) => resposta({ success: true }));

vi.mock('../../lib/api', () => ({
  api: {
    get: async (rota: string) => (rota === '/admin/branding' ? resposta([fulgo]) : resposta([])),
    put: (rota: string, corpo: unknown) => mockPut(rota, corpo),
    post: vi.fn(async () => resposta({})),
    delete: vi.fn(async () => resposta({})),
  },
}));

const editarFulgo = async () => {
  render(<Branding />);
  await screen.findByText('fulgo');
  await userEvent.click(screen.getByText('edit').closest('button')!);
  await screen.findByText('Configurar Marca');
};

const aba = (nome: string) => userEvent.click(screen.getByRole('tab', { name: nome }));

const preencher = async (rotulo: string, valor: string) => {
  const campo = screen.getByLabelText(rotulo);
  await userEvent.clear(campo);
  if (valor) await userEvent.type(campo, valor);
};

// Digitar em vários campos de várias abas passa dos 5 s padrão no jsdom.
describe('White Label: marca completa no salvar', { timeout: 30000 }, () => {
  beforeEach(() => {
    mockPut.mockClear();
    vi.mocked(toast.error).mockClear();
  });

  it('manda paleta, selos, fonte, símbolo, suporte e documentos', async () => {
    await editarFulgo();

    await aba('Cores do App');
    await preencher('Cor de destaque: botão principal', '#F5EF49');
    await preencher('Texto sobre o destaque', '#2F1A99');
    await preencher('Disponível', '#1FA463');
    await preencher('Offline', '#9A9AA5');
    await preencher('Família', 'Rubik');
    // Prévia: botão principal no destaque, cabeçalho no roxo.
    expect(screen.getByTestId('previa-botao-principal').style.backgroundColor).toBe(
      'rgb(245, 239, 73)'
    );
    expect(screen.getByTestId('previa-cabecalho').style.backgroundColor).toBe('rgb(47, 26, 153)');

    await aba('Logos');
    await preencher(
      'Símbolo: pin do mapa e favicon',
      'https://painel.exemplo/marcas/fulgo/simbolo-amarelo.png'
    );

    await aba('Identidade');
    await preencher('WhatsApp de suporte', '+55 (92) 99999-0000');
    await preencher('E-mail de suporte', 'suporte@fulgo.com.br');
    await preencher('Termos de uso (URL)', 'https://fulgo.com.br/termos');

    await userEvent.click(screen.getByText('Salvar Configuração'));

    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1));
    const [rota, corpo] = mockPut.mock.calls[0];
    expect(rota).toBe('/admin/branding/fulgo');
    expect(corpo).toMatchObject({
      accentColor: '#F5EF49',
      accentTextColor: '#2F1A99',
      headerColor: '#2F1A99',
      statusColors: { available: '#1FA463', offline: '#9A9AA5' },
      fontFamily: 'Rubik',
      symbolUri: 'https://painel.exemplo/marcas/fulgo/simbolo-amarelo.png',
      supportWhatsapp: '5592999990000',
      supportEmail: 'suporte@fulgo.com.br',
      termsUrl: 'https://fulgo.com.br/termos',
      privacyUrl: null,
    });
  });

  it('campo apagado vai como null (a marca volta ao padrão)', async () => {
    await editarFulgo();

    await aba('Cores do App');
    await preencher('Cabeçalho', '');
    await userEvent.click(screen.getByText('Salvar Configuração'));

    expect(toast.error).not.toHaveBeenCalled();
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1));
    expect(mockPut.mock.calls[0][1]).toMatchObject({
      headerColor: null,
      accentColor: null,
      accentTextColor: null,
      statusColors: null,
      fontFamily: null,
      symbolUri: null,
      supportWhatsapp: null,
      supportEmail: null,
      termsUrl: null,
      privacyUrl: null,
    });
  });

  it('cor fora do formato para no formulário, sem chamar a API', async () => {
    await editarFulgo();

    await aba('Cores do App');
    await preencher('Cor de destaque: botão principal', 'amarelo');
    await userEvent.click(screen.getByText('Salvar Configuração'));

    expect(toast.error).toHaveBeenCalledWith('Cor de destaque: use o formato #RRGGBB');
    expect(mockPut).not.toHaveBeenCalled();
  });
});

describe('camposDaMarcaCompleta', () => {
  it('confere WhatsApp, e-mail, links e fonte', () => {
    expect(camposDaMarcaCompleta({ supportWhatsapp: '9299' }).erro).toMatch(/WhatsApp/);
    expect(camposDaMarcaCompleta({ supportEmail: 'fulgo' }).erro).toMatch(/E-mail/);
    expect(camposDaMarcaCompleta({ termsUrl: 'http://fulgo.com.br' }).erro).toMatch(/Termos/);
    expect(camposDaMarcaCompleta({ privacyUrl: 'javascript:alert(1)' }).erro).toMatch(
      /privacidade/
    );
    expect(camposDaMarcaCompleta({ fontFamily: 'Rubik;' }).erro).toMatch(/Fonte/);
    expect(camposDaMarcaCompleta({ statusColors: { busy: '#F5EF4' } }).erro).toMatch(/Ocupado/);
  });

  it('sem nada preenchido, tudo null e sem erro', () => {
    const { campos, erro } = camposDaMarcaCompleta({});
    expect(erro).toBeNull();
    expect(Object.values(campos).every(v => v === null)).toBe(true);
  });
});
