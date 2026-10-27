/**
 * Adesivo do QR com a marca completa (FulGo): fundo no headerColor, logo
 * horizontal de fundo escuro, destaque no accentColor com accentTextColor no
 * selo e textos de apoio em branco com opacidade. Sem os campos novos, o
 * adesivo tem que sair igual ao de sempre (Vip Energy, Gelux, NeoPower).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ user: { branding: null } }),
}));

import { QrCodeTemplate, visualDoAdesivo, type MarcaDoAdesivo } from '../QrCodeTemplate';

const pagina = {
  chargePointId: '240500147',
  connectorIndex: 1,
  totalConnectors: 2,
  description: 'FulGo Mosteiro • Lento 01',
  powerKw: 7,
  connectorType: 'Tipo 2',
};

const vip: MarcaDoAdesivo = {
  companyName: 'Vip Energy',
  logoUri: 'https://res.cloudinary.com/x/vipenergy.jpg',
  primaryColor: '#2b00ff',
};

const fulgo: MarcaDoAdesivo = {
  companyName: 'FulGo',
  logoUri: 'https://painel.exemplo/marcas/fulgo/icone-1024.png',
  logoUriDark: 'https://painel.exemplo/marcas/fulgo/logo-horizontal-fundo-escuro.png',
  primaryColor: '#2F1A99',
  accentColor: '#F5EF49',
  accentTextColor: '#2F1A99',
  headerColor: '#2F1A99',
  fontFamily: 'Rubik',
};

/** A página do adesivo (794x1123) e o selo do conector. */
const abrir = (marca: MarcaDoAdesivo | null) => {
  const { container } = render(<QrCodeTemplate pages={[{ ...pagina, marca }]} />);
  const folha = container.querySelector('#qrcode-report-root > div') as HTMLElement;
  const selo = screen.getByText('CONECTOR 1');
  const subtitulo = screen.getByText('Estação de recarga para veículos elétricos');
  const chamada = screen.getByText('Escaneie para carregar');
  return { container, folha, selo, subtitulo, chamada };
};

describe('adesivo do QR sem a marca completa (igual ao de sempre)', () => {
  it('fundo grafite, cinzas fixos, cor da marca clareada e nome ao lado do logo', () => {
    const { folha, selo, subtitulo, chamada, container } = abrir(vip);

    expect(folha.style.backgroundColor).toBe('rgb(17, 17, 20)'); // #111114
    expect(folha.style.fontFamily).toBe('"Inter", "Segoe UI", Arial, sans-serif');
    expect(subtitulo.style.color).toBe('rgb(138, 138, 147)'); // #8A8A93

    const { destaque, tintaDoSelo } = visualDoAdesivo(vip);
    expect(destaque).not.toBe('#2b00ff'); // clareado para ler sobre o grafite
    expect(chamada.style.color).toBe(selo.style.backgroundColor);
    expect(tintaDoSelo).toBe('#FFFFFF');

    expect(screen.getByTestId('nome-da-marca')).toHaveTextContent('Vip Energy');
    expect(container.querySelector('img')?.getAttribute('src')).toBe(vip.logoUri);
  });

  it('as cores de sempre não mudam', () => {
    expect(visualDoAdesivo(vip)).toMatchObject({
      nome: 'Vip Energy',
      fundo: '#111114',
      logo: vip.logoUri,
      mostrarNome: true,
      tintas: {
        texto: '#FFFFFF',
        apoio: '#8A8A93',
        caixa: '#A6A6B0',
        discreto: '#6E6E78',
        tecnico: '#55555E',
        data: '#4A4A52',
        linha: '#26262C',
      },
    });
  });

  it('sem marca: NeoPower, com o ícone e o nome', () => {
    const { container } = abrir(null);
    expect(screen.getByTestId('nome-da-marca')).toHaveTextContent('NeoPower');
    expect(container.querySelector('img')?.getAttribute('src')).toContain('neoicon');
  });

  it('outra marca sem logo fica só com o nome, sem o ícone da NeoPower', () => {
    const { container } = abrir({ companyName: 'Gelux Eletropostos', primaryColor: '#58ee30' });
    expect(screen.getByTestId('nome-da-marca')).toHaveTextContent('Gelux Eletropostos');
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('adesivo do QR com a marca completa (FulGo)', () => {
  it('fundo no headerColor, logo de fundo escuro e sem repetir o nome', () => {
    const { folha, container } = abrir(fulgo);

    expect(folha.style.backgroundColor).toBe('rgb(47, 26, 153)'); // #2F1A99
    const logo = container.querySelector('img');
    expect(logo?.getAttribute('src')).toBe(fulgo.logoUriDark);
    // O logo horizontal já traz o nome: nada de "FulGo" em texto ao lado.
    expect(screen.queryByTestId('nome-da-marca')).toBeNull();
    // O app continua citado pelo nome.
    expect(screen.getByText('Pelo app FulGo')).toBeInTheDocument();
  });

  it('destaque no accentColor, com accentTextColor no selo', () => {
    const { selo, chamada } = abrir(fulgo);

    expect(selo.style.backgroundColor).toBe('rgb(245, 239, 73)'); // #F5EF49
    expect(selo.style.color).toBe('rgb(47, 26, 153)'); // #2F1A99
    expect(chamada.style.color).toBe('rgb(245, 239, 73)');
  });

  it('textos de apoio em branco com opacidade, não os cinzas fixos', () => {
    const { subtitulo } = abrir(fulgo);

    expect(subtitulo.style.color).toBe('rgba(255, 255, 255, 0.75)');
    expect(screen.getByText('ID 240500147').style.color).toBe('rgba(255, 255, 255, 0.65)');
    expect(screen.getByText('Com Pix:').style.color).toBe('rgb(255, 255, 255)');
  });

  it('QR sempre em caixa branca', () => {
    const { container } = abrir(fulgo);
    const qrs = container.querySelectorAll('svg');
    expect(qrs).toHaveLength(2);
    qrs.forEach(qr => {
      expect((qr.parentElement as HTMLElement).style.backgroundColor).toBe('rgb(255, 255, 255)');
    });
  });

  it('fonte da marca na frente, com as de sempre como reserva', () => {
    const { folha } = abrir(fulgo);
    expect(folha.style.fontFamily).toBe('"Rubik", "Inter", "Segoe UI", Arial, sans-serif');
  });

  it('só o destaque (sem cabeçalho): fundo grafite, selo com o texto da marca', () => {
    const { folha, selo } = abrir({ ...vip, accentColor: '#F5EF49', accentTextColor: '#2F1A99' });

    expect(folha.style.backgroundColor).toBe('rgb(17, 17, 20)');
    expect(selo.style.backgroundColor).toBe('rgb(245, 239, 73)');
    expect(selo.style.color).toBe('rgb(47, 26, 153)');
    // Sem o texto sobre o destaque, a tinta do selo sai pelo contraste.
    expect(visualDoAdesivo({ ...vip, accentColor: '#F5EF49' }).tintaDoSelo).toBe('#000000');
  });

  it('cor inválida é ignorada: vale o padrão', () => {
    const visual = visualDoAdesivo({ ...vip, headerColor: 'roxo', accentColor: '#FFF' });
    expect(visual.fundo).toBe('#111114');
    expect(visual.destaque).toBe(visualDoAdesivo(vip).destaque);
  });

  it('exporta o HTML para conferência visual', () => {
    if (!process.env.ADESIVO_FULGO_HTML) return;
    const html = renderToStaticMarkup(
      <QrCodeTemplate
        pages={[
          { ...pagina, marca: fulgo },
          { ...pagina, marca: vip },
        ]}
      />
    );
    writeFileSync(process.env.ADESIVO_FULGO_HTML, html);
  });
});
