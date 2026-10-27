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
