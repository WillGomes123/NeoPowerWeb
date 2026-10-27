/**
 * Página pública de suporte (/<tenant>/suporte): o contato de cada marca.
 *
 * A NeoPower e toda marca sem contato próprio mostram o WhatsApp de suporte da
 * NeoPower; a marca com contato próprio (Vip Energy) segue com o e-mail dela; e
 * a marca que cadastrou o suporte no White Label (supportWhatsapp/supportEmail)
 * usa o dela antes de tudo.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { Support } from '../legal/Support';
import { contatoDeSuporte, WHATSAPP_SUPORTE_NEOPOWER } from '../legal/legalConfig';

interface MarcaDoTeste {
  clientId: string;
  companyName: string;
  supportWhatsapp?: string | null;
  supportEmail?: string | null;
}

const tenant = vi.hoisted(() => ({
  atual: { tenantSlug: 'neopower', tenantBranding: null as MarcaDoTeste | null },
}));
vi.mock('../../contexts/TenantContext', () => ({
  useTenant: () => ({ ...tenant.atual, loadingTenant: false, isDark: true, toggleTheme: () => {} }),
}));

const abrir = (
  tenantSlug: string,
  clientId: string,
  companyName: string,
  suporte: Pick<MarcaDoTeste, 'supportWhatsapp' | 'supportEmail'> = {}
) => {
  tenant.atual = { tenantSlug, tenantBranding: { clientId, companyName, ...suporte } };
  render(
    <MemoryRouter>
      <Support />
    </MemoryRouter>
  );
  return screen.getAllByRole('link').map(a => a.getAttribute('href') ?? '');
};

describe('contato de suporte por marca', () => {
  it('a NeoPower mostra o WhatsApp de suporte, com o número e a mensagem pronta', () => {
    const links = abrir('neopower', 'neopower-default', 'NeoPower');

    const whatsapp = links.find(href => href.startsWith('https://wa.me/'));
    expect(whatsapp).toBe(
      `https://wa.me/5511925785044?text=${encodeURIComponent('Olá! Preciso de ajuda com o app NeoPower.')}`
    );
    expect(screen.getByText(/\+55 11 92578-5044/)).toBeInTheDocument();
    expect(links.some(href => href.startsWith('mailto:'))).toBe(false);
  });

  it('a marca sem contato próprio cai no WhatsApp da NeoPower, dizendo de qual app é', () => {
    const links = abrir('gelux', 'gelux', 'Gelux Eletropostos');

    expect(links).toContain(
      `https://wa.me/5511925785044?text=${encodeURIComponent('Olá! Preciso de ajuda com o app Gelux Eletropostos.')}`
    );
    expect(links.some(href => href.startsWith('mailto:'))).toBe(false);
  });

  it('a marca com contato próprio segue com o e-mail dela, sem o WhatsApp da NeoPower', () => {
    const links = abrir('vipenergy', 'vipenergy', 'Vip Energy');

    expect(links.some(href => href.startsWith('mailto:vipenergyeletroposto@gmail.com'))).toBe(true);
    expect(links.some(href => href.includes('wa.me'))).toBe(false);
    expect(screen.getByText(/Escreva para a equipe Vip Energy/)).toBeInTheDocument();
  });

  it('a marca com suporte no White Label usa o WhatsApp e o e-mail dela', () => {
    const links = abrir('fulgo', 'fulgo', 'FulGo', {
      supportWhatsapp: '5592999990000',
      supportEmail: 'suporte@fulgo.com.br',
    });

    expect(links.some(href => href.startsWith('mailto:suporte@fulgo.com.br'))).toBe(true);
    expect(links).toContain(
      `https://wa.me/5592999990000?text=${encodeURIComponent('Olá! Preciso de ajuda com o app FulGo.')}`
    );
    expect(screen.getByText(/\+55 92 99999-0000/)).toBeInTheDocument();
    expect(links.some(href => href.includes('5511925785044'))).toBe(false);
    expect(document.body.textContent).not.toMatch(/NeoPower/);
  });

  it('o suporte do White Label vale antes do contato fixo da marca', () => {
    expect(contatoDeSuporte('vipenergy', { supportWhatsapp: '5571988887777' })).toEqual({
      whatsapp: '+55 71 98888-7777',
    });
    expect(contatoDeSuporte('vipenergy', { supportWhatsapp: '', supportEmail: null })).toEqual({
      email: 'vipenergyeletroposto@gmail.com',
    });
  });

  it('o clientId vale sem diferenciar maiúsculas', () => {
    expect(contatoDeSuporte('VipEnergy')).toEqual({ email: 'vipenergyeletroposto@gmail.com' });
    expect(contatoDeSuporte('neopower-default')).toEqual({ whatsapp: WHATSAPP_SUPORTE_NEOPOWER });
    expect(contatoDeSuporte('')).toEqual({ whatsapp: WHATSAPP_SUPORTE_NEOPOWER });
  });
});
