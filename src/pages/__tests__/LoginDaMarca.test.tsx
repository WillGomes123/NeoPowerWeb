/**
 * Login do painel por marca (/<tenant>/login): o logo do topo fica numa caixa
 * branca, então vai o de fundo claro em qualquer tema; e o logo da NeoPower só
 * aparece no login da NeoPower.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { Login } from '../Login';

const tenant = vi.hoisted(() => ({
  atual: { tenantBranding: null as Record<string, unknown> | null, isDark: true },
}));
vi.mock('../../contexts/TenantContext', () => ({
  useTenant: () => ({
    ...tenant.atual,
    tenantSlug: 'x',
    loadingTenant: false,
    toggleTheme: () => {},
  }),
}));
vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ login: vi.fn() }),
  MANTER_SESSAO_KEY: 'manter-sessao',
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const logoDoTopo = (tenantBranding: Record<string, unknown> | null, isDark: boolean) => {
  tenant.atual = { tenantBranding, isDark };
  const { container } = render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
  return container.querySelector('header img')?.getAttribute('src') ?? null;
};

const fulgo = {
  clientId: 'fulgo',
  companyName: 'FulGo',
  logoType: 'image',
  logoUri: 'https://painel.exemplo/marcas/fulgo/icone-1024.png',
  logoUriLight: 'https://painel.exemplo/marcas/fulgo/logo-horizontal-fundo-claro.png',
  logoUriDark: 'https://painel.exemplo/marcas/fulgo/logo-horizontal-fundo-escuro.png',
};

describe('logo do login por marca', () => {
  it('na caixa branca vai o logo de fundo claro, com o tema escuro ou claro', () => {
    expect(logoDoTopo(fulgo, true)).toBe(fulgo.logoUriLight);
    expect(logoDoTopo(fulgo, false)).toBe(fulgo.logoUriLight);
  });

  it('marca só com o ícone segue como antes', () => {
    expect(logoDoTopo({ ...fulgo, logoUriLight: '', logoUriDark: '' }, true)).toBe(fulgo.logoUri);
  });

  it('o logo da NeoPower fica só no login da NeoPower', () => {
    expect(logoDoTopo(null, true)).toContain('NeoPower');
    expect(
      logoDoTopo({ clientId: 'gelux', companyName: 'Gelux', logoType: 'image' }, true)
    ).toBeNull();
  });
});

describe('texto do cartão de login, que é escuro em qualquer tema', () => {
  const cartao = (isDark: boolean) => {
    tenant.atual = { tenantBranding: fulgo, isDark };
    const { container } = render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    const rotulo = container.querySelector('label[for="command-id"]')!;
    const selo = Array.from(container.querySelectorAll('span')).find(
      e => e.textContent === 'Acesso Seguro'
    )!;
    return { rotulo: rotulo.className, selo: selo.className, html: container.innerHTML };
  };

  it('tema claro: rótulo e selo claros, sem a cor do tema nem a primária escura', () => {
    const { rotulo, selo } = cartao(false);
    expect(rotulo).toContain('text-white/70');
    expect(rotulo).not.toContain('text-on-surface-variant');
    expect(selo).toContain('text-white/80');
    expect(selo).not.toContain('text-primary');
  });

  it('tema escuro: o selo continua na cor da marca', () => {
    expect(cartao(true).selo).toContain('text-primary');
  });

  it('nenhuma classe de cor ficou inválida depois da troca', () => {
    expect(cartao(false).html).not.toContain('text-white/70/');
  });
});
