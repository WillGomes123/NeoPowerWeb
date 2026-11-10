/**
 * Painel instalável no celular com a marca da URL: o operador da Power Link
 * instala neopowerhub.com/powerlink e o celular mostra "Power Link" com o ícone
 * dela. O <head> ganha o manifesto da marca (servido pela API), o nome e o
 * ícone do iOS, e o service worker do push fica sabendo de que marca é.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  appDaMarca,
  aplicarAppDaMarca,
  aplicarCorDaBarra,
  iconeDoManifesto,
  instalarAppDaMarca,
} from '../appInstalavel';

const API = 'https://api.exemplo/api';
const POWER_LINK = { clientId: 'powerlink', companyName: 'Power Link', theme: 'light' };
const MANIFESTO_DA_POWER_LINK = `${API}/branding/powerlink/manifest.webmanifest`;
const ICONE_192 = 'https://res.cloudinary.com/x/image/upload/b_rgb:000000/c_fit/v1/pl.png';

const noHead = (seletor: string) => document.head.querySelector(seletor);
const atributo = (seletor: string, nome: string) => noHead(seletor)?.getAttribute(nome);

const respostaDoManifesto = (icons: unknown) =>
  ({ ok: true, json: async () => ({ icons }) }) as Response;

describe('appDaMarca', () => {
  it('Power Link: manifesto da API, nome e painel dela', () => {
    expect(appDaMarca('powerlink', POWER_LINK, API)).toEqual({
      nome: 'Power Link',
      manifesto: MANIFESTO_DA_POWER_LINK,
      iconeDoIos: null,
      inicio: '/powerlink/',
      temaEscuro: false,
    });
  });

  it('API com barra no fim e marca sem nome', () => {
    const app = appDaMarca('powerlink', { clientId: 'powerlink', theme: 'dark' }, `${API}/`);
    expect(app.manifesto).toBe(MANIFESTO_DA_POWER_LINK);
    expect(app.nome).toBe('powerlink');
    expect(app.temaEscuro).toBe(true);
  });

  it('NeoPower: o manifesto estático, mesmo com a marca "neo" carregada', () => {
    const app = appDaMarca('neopower', { clientId: 'neo', companyName: 'NeoPower' }, API);
    expect(app).toEqual({
      nome: 'NeoPower',
      manifesto: '/manifest.webmanifest',
      iconeDoIos: '/icones/neopower-180.png',
      inicio: '/neopower/',
      temaEscuro: true,
    });
    expect(appDaMarca('neopower', null, API).manifesto).toBe('/manifest.webmanifest');
  });
});

describe('aplicarAppDaMarca e aplicarCorDaBarra', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.title = '';
  });

  it('põe nome, manifesto e barra do iOS da marca, sem duplicar ao repetir', () => {
    const app = appDaMarca('powerlink', POWER_LINK, API);
    aplicarAppDaMarca(app);
    aplicarAppDaMarca(app);
    expect(document.title).toBe('Power Link | Plataforma de operabilidade de eletropostos');
    expect(document.head.querySelectorAll('link[rel="manifest"]')).toHaveLength(1);
    expect(atributo('link[rel="manifest"]', 'href')).toBe(MANIFESTO_DA_POWER_LINK);
    expect(atributo('meta[name="apple-mobile-web-app-title"]', 'content')).toBe('Power Link');
    // Tema claro: barra clara do iOS, de texto escuro.
    expect(atributo('meta[name="apple-mobile-web-app-status-bar-style"]', 'content')).toBe(
      'default'
    );
    // O ícone do iOS da marca só vem depois de ler o manifesto.
    expect(noHead('link[rel="apple-touch-icon"]')).toBeNull();
  });

  it('NeoPower já leva o ícone do iOS estático', () => {
    aplicarAppDaMarca(appDaMarca('neopower', null, API));
    expect(atributo('link[rel="apple-touch-icon"]', 'href')).toBe('/icones/neopower-180.png');
    expect(atributo('meta[name="apple-mobile-web-app-status-bar-style"]', 'content')).toBe('black');
  });

  it('a barra do Android é o fundo do painel no tema em uso', () => {
    aplicarCorDaBarra(true);
    expect(atributo('meta[name="theme-color"]', 'content')).toBe('#0e0e0e');
    aplicarCorDaBarra(false);
    expect(document.head.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1);
    expect(atributo('meta[name="theme-color"]', 'content')).toBe('#f8fafc');
  });
});

describe('iconeDoManifesto', () => {
  it('pega o "any" de 192, não o maskable', async () => {
    const buscar = vi.fn(async () =>
      respostaDoManifesto([
        { src: 'https://cdn/mask-192.png', sizes: '192x192', purpose: 'maskable' },
        { src: 'https://cdn/any-512.png', sizes: '512x512', purpose: 'any' },
        { src: ICONE_192, sizes: '192x192', purpose: 'any' },
      ])
    );
    expect(await iconeDoManifesto(MANIFESTO_DA_POWER_LINK, buscar)).toBe(ICONE_192);
    expect(buscar).toHaveBeenCalledWith(MANIFESTO_DA_POWER_LINK);
  });

  it('sem o de 192, o primeiro "any"; endereço relativo vira absoluto', async () => {
    const buscar = async () => respostaDoManifesto([{ src: '/marcas/x/icone.png' }]);
    expect(await iconeDoManifesto(MANIFESTO_DA_POWER_LINK, buscar)).toBe(
      'https://api.exemplo/marcas/x/icone.png'
    );
  });

  it('manifesto que não veio ou veio estranho: null, sem lançar', async () => {
    expect(await iconeDoManifesto('x', async () => ({ ok: false }) as Response)).toBeNull();
    expect(await iconeDoManifesto('x', async () => respostaDoManifesto('nada'))).toBeNull();
    expect(
      await iconeDoManifesto('x', async () => {
        throw new Error('sem rede');
      })
    ).toBeNull();
  });
});

describe('instalarAppDaMarca', () => {
  const postMessage = vi.fn();
  const register = vi.fn();

  beforeEach(() => {
    document.head.innerHTML = '';
    postMessage.mockReset();
    register.mockReset().mockResolvedValue({ scope: '/', active: { postMessage } });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respostaDoManifesto([{ src: ICONE_192, sizes: '192x192' }]))
    );
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register, ready: Promise.resolve({ active: { postMessage } }) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // @ts-expect-error: o jsdom não tem service worker; o teste é que pôs.
    delete navigator.serviceWorker;
  });

  it('marca: ícone do iOS vem do manifesto e o service worker sabe da marca', async () => {
    vi.stubGlobal('PushManager', function PushManager() {});
    instalarAppDaMarca('powerlink', POWER_LINK, API);
    expect(atributo('link[rel="manifest"]', 'href')).toBe(MANIFESTO_DA_POWER_LINK);
    await vi.waitFor(() => expect(postMessage).toHaveBeenCalled());
    expect(atributo('link[rel="apple-touch-icon"]', 'href')).toBe(ICONE_192);
    expect(register).toHaveBeenCalledWith('/sw.js');
    expect(postMessage).toHaveBeenCalledWith({
      tipo: 'marca',
      inicio: '/powerlink/',
      icone: ICONE_192,
    });
  });

  it('NeoPower: nada a buscar, o service worker leva o ícone estático', async () => {
    vi.stubGlobal('PushManager', function PushManager() {});
    instalarAppDaMarca('neopower', null, API);
    await vi.waitFor(() => expect(postMessage).toHaveBeenCalled());
    expect(fetch).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith({
      tipo: 'marca',
      inicio: '/neopower/',
      icone: '/icones/neopower-192.png',
    });
  });

  it('navegador sem push (Safari fora do app instalado): só o <head>, sem erro', async () => {
    // O jsdom não tem PushManager, como o Safari do iPhone fora do app instalado.
    expect('PushManager' in window).toBe(false);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    instalarAppDaMarca('powerlink', POWER_LINK, API);
    await vi.waitFor(() =>
      expect(atributo('link[rel="apple-touch-icon"]', 'href')).toBe(ICONE_192)
    );
    await new Promise(r => setTimeout(r, 0));
    expect(register).not.toHaveBeenCalled();
  });
});
