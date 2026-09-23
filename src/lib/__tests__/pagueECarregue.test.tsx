import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync } from 'node:fs';
import { linkDePagamento, origemDaPaginaDePagamento } from '../pagueECarregue';

vi.mock('../auth', () => ({
  useAuth: () => ({ user: { branding: null } }),
}));

import { QrCodeTemplate } from '../../components/QrCodeTemplate';

describe('link do pague e carregue', () => {
  it('usa VITE_PAY_URL quando informada', () => {
    expect(origemDaPaginaDePagamento({ VITE_PAY_URL: 'https://pagar.vip.com.br/' })).toBe(
      'https://pagar.vip.com.br'
    );
  });

  it('usa a origem da API quando ela é absoluta', () => {
    expect(
      origemDaPaginaDePagamento({ VITE_API_URL: 'https://ocppapi-production.up.railway.app/api' })
    ).toBe('https://ocppapi-production.up.railway.app');
  });

  it('com API relativa (proxy), usa a API de produção', () => {
    expect(origemDaPaginaDePagamento({ VITE_API_URL: '/api' })).toBe(
      'https://ocppapi-production.up.railway.app'
    );
  });

  it('monta /pay/<carregador>/<conector> escapando o ID', () => {
    expect(linkDePagamento('55(24)05', 2, 'https://x.com')).toBe('https://x.com/pay/55(24)05/2');
    expect(linkDePagamento('a b', 1, 'https://x.com')).toBe('https://x.com/pay/a%20b/1');
  });
});

describe('adesivo de QR', () => {
  const pagina = {
    chargePointId: '240500147',
    connectorIndex: 1,
    totalConnectors: 1,
    description: 'ArtVille 01',
    model: 'CVBE-TR-220V/380V-22KW',
    vendor: 'MOBY',
    powerKw: 22,
    connectorType: 'Tipo 2',
  };
  const vip = {
    companyName: 'Vip Energy',
    primaryColor: '#2b00ff',
    logoUri:
      process.env.ADESIVO_LOGO ??
      'https://res.cloudinary.com/dn7b45jnn/image/upload/branding_logos/vip.png',
  };

  it('usa a marca do operador do carregador e traz os dois QRs', () => {
    const html = renderToStaticMarkup(<QrCodeTemplate pages={[{ ...pagina, marca: vip }]} />);
    expect(html).toContain('Pelo app Vip Energy');
    expect(html).toContain('Sem app, com Pix');
    expect(html).toContain('Código 240500147:1');
    expect((html.match(/<svg/g) ?? []).length).toBe(2);
    // Azul escuro da marca é clareado para ler sobre o fundo preto.
    expect(html).not.toContain('#2b00ff');
  });

  it('sem marca, usa NeoPower com o ícone (o logotipo tem texto escuro)', () => {
    const html = renderToStaticMarkup(<QrCodeTemplate pages={[pagina]} />);
    expect(html).toContain('Pelo app NeoPower');
    expect(html).toContain('neoicon');
    expect(html).not.toContain('NeoPower.png');
  });

  it('exporta o HTML para conferência visual', () => {
    if (!process.env.ADESIVO_HTML) return;
    const html = renderToStaticMarkup(
      <QrCodeTemplate pages={[pagina, { ...pagina, marca: vip }]} />
    );
    writeFileSync(process.env.ADESIVO_HTML, html);
  });
});
