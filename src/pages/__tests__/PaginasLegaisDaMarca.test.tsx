/**
 * Páginas públicas por marca (/<tenant>/termos, /privacidade, /excluir-conta,
 * /suporte): a marca com documento próprio (termsUrl/privacyUrl) é levada para
 * ele, e nenhuma página de outra marca cita a NeoPower.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ComponentType } from 'react';

import { TermsOfUse } from '../legal/TermsOfUse';
import { PrivacyPolicy } from '../legal/PrivacyPolicy';
import { AccountDeletion } from '../legal/AccountDeletion';
import { Support } from '../legal/Support';
import { navegacao } from '../legal/legalConfig';

const tenant = vi.hoisted(() => ({
  atual: { tenantSlug: 'neopower', tenantBranding: null as Record<string, unknown> | null },
}));
vi.mock('../../contexts/TenantContext', () => ({
  useTenant: () => ({
    ...tenant.atual,
    loadingTenant: false,
    isDark: false,
    toggleTheme: () => {},
  }),
}));

const abrir = (Pagina: ComponentType, marca: Record<string, unknown>) => {
  tenant.atual = { tenantSlug: String(marca.clientId), tenantBranding: marca };
  return render(
    <MemoryRouter>
      <Pagina />
    </MemoryRouter>
  );
};

const fulgo = {
  clientId: 'fulgo',
  companyName: 'FulGo',
  logoType: 'image',
  logoUri: 'https://painel.exemplo/marcas/fulgo/icone-1024.png',
  logoUriLight: 'https://painel.exemplo/marcas/fulgo/logo-horizontal-fundo-claro.png',
  logoUriDark: 'https://painel.exemplo/marcas/fulgo/logo-horizontal-fundo-escuro.png',
};

describe('documentos próprios da marca', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Termos levam para o termsUrl da marca, com o link à vista', () => {
    const ir = vi.spyOn(navegacao, 'substituir').mockImplementation(() => {});
    abrir(TermsOfUse, { ...fulgo, termsUrl: 'https://fulgo.com.br/termos' });

    expect(ir).toHaveBeenCalledWith('https://fulgo.com.br/termos');
    expect(screen.getByRole('link', { name: /fulgo\.com\.br\/termos/ })).toHaveAttribute(
      'href',
      'https://fulgo.com.br/termos'
    );
    // O texto padrão dos termos não aparece.
    expect(screen.queryByText('Aceitação dos Termos')).toBeNull();
  });

  it('Privacidade leva para o privacyUrl da marca', () => {
    const ir = vi.spyOn(navegacao, 'substituir').mockImplementation(() => {});
    abrir(PrivacyPolicy, { ...fulgo, privacyUrl: 'https://fulgo.com.br/privacidade' });

    expect(ir).toHaveBeenCalledWith('https://fulgo.com.br/privacidade');
    expect(screen.queryByText('Dados que coletamos')).toBeNull();
  });

  it('endereço que não é https não sai da página: fica o texto padrão', () => {
    const ir = vi.spyOn(navegacao, 'substituir').mockImplementation(() => {});
    abrir(TermsOfUse, { ...fulgo, termsUrl: 'javascript:alert(1)' });
    abrir(PrivacyPolicy, { ...fulgo, privacyUrl: 'http://fulgo.com.br/privacidade' });

    expect(ir).not.toHaveBeenCalled();
    expect(screen.getByText('Aceitação dos Termos')).toBeInTheDocument();
    expect(screen.getByText('Dados que coletamos')).toBeInTheDocument();
  });
});

describe('nenhuma menção à NeoPower nas páginas de outra marca', () => {
  const paginas = { TermsOfUse, PrivacyPolicy, AccountDeletion, Support };

  for (const [nome, Pagina] of Object.entries(paginas)) {
    it(`${nome} da FulGo`, () => {
      const { container } = abrir(Pagina, fulgo);
      expect(container.textContent).toContain('FulGo');
      expect(container.textContent).not.toMatch(/NeoPower/i);
      expect(container.innerHTML).not.toMatch(/NeoPower\.png/);
    });
  }

  it('na caixa branca do topo vai o logo de fundo claro, sem repetir o nome', () => {
    const { container } = abrir(TermsOfUse, fulgo);
    expect(container.querySelector('header img')?.getAttribute('src')).toBe(fulgo.logoUriLight);
    expect(container.querySelector('header')?.textContent).not.toContain('FulGo');
  });

  it('as páginas da NeoPower continuam citando a plataforma', () => {
    const { container } = abrir(TermsOfUse, { clientId: 'neo', companyName: 'NeoPower' });
    expect(container.textContent).toContain('NeoPower');
  });
});
