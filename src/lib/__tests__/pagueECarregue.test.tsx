import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync } from 'node:fs';
import { linkDePagamento, origemDaPaginaDePagamento } from '../pagueECarregue';

vi.mock('../auth', () => ({
  useAuth: () => ({ user: { branding: { companyName: 'Vip Energy', primaryColor: '#F5C400' } } }),
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
  it('traz o QR do app e o QR do Pix', () => {
    const html = renderToStaticMarkup(
      <QrCodeTemplate
        pages={[
          {
            chargePointId: '240500190',
            connectorIndex: 1,
            totalConnectors: 2,
            description: 'Morada dos Príncipes 02',
            model: 'CVBE-TR-220V/380V-22KW',
            vendor: 'MOBY',
            powerKw: 22,
            connectorType: 'Tipo 2',
          },
        ]}
      />
    );
    expect(html).toContain('Pelo app Vip Energy');
    expect(html).toContain('Sem app, com Pix');
    expect(html).toContain('CÓDIGO: 240500190:1');
    expect((html.match(/<svg/g) ?? []).length).toBe(2);
    if (process.env.ADESIVO_HTML) {
      writeFileSync(
        process.env.ADESIVO_HTML,
        `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000">${html}</body>`
      );
    }
  });
});
