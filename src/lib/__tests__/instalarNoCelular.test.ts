/**
 * Aviso para instalar o painel no celular: no Android o botão abre a janela de
 * instalação do navegador (beforeinstallprompt); no iPhone o aviso ensina o
 * Compartilhar › "Adicionar à Tela de Início"; no computador, com o app já
 * instalado ou dispensado há menos de 30 dias, nada aparece.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  CHAVE_DISPENSADO,
  _reiniciarParaTeste,
  dispensadoHaPouco,
  ehCelular,
  ehIos,
  escutarPedidoDeInstalacao,
  modoDoAviso,
  useAvisoDeInstalacao,
} from '../instalarNoCelular';

const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const DIA = 86_400_000;

// O localStorage do Node 25 não funciona sem --localstorage-file e passa por
// cima do jsdom. Os outros testes do painel usam o mesmo tipo de substituto.
const armazenado = new Map<string, string>();
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => armazenado.get(k) ?? null,
    setItem: (k: string, v: string) => void armazenado.set(k, String(v)),
    removeItem: (k: string) => void armazenado.delete(k),
    clear: () => armazenado.clear(),
  },
});

function comoAparelho(ua: string, plataforma = 'Linux armv8l', toques = 5) {
  vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(ua);
  vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue(plataforma);
  Object.defineProperty(window.navigator, 'maxTouchPoints', { value: toques, configurable: true });
}

/** O beforeinstallprompt do Chrome, com a resposta que o usuário dá na janela. */
function pedidoDoNavegador(resposta: 'accepted' | 'dismissed') {
  const evento = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: string; platform: string }>;
  };
  evento.prompt = vi.fn().mockResolvedValue(undefined);
  evento.userChoice = Promise.resolve({ outcome: resposta, platform: 'web' });
  return evento;
}

describe('regras do aviso', () => {
  it('reconhece iPhone, iPad (que se apresenta como Mac) e Android; computador não', () => {
    expect(ehIos(IPHONE, 'iPhone', 5)).toBe(true);
    expect(ehIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5)).toBe(true);
    expect(ehIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0)).toBe(false);
    expect(ehCelular(ANDROID, 'Linux armv8l', 5)).toBe(true);
    expect(ehCelular(WINDOWS, 'Win32', 0)).toBe(false);
  });

  it('dispensado vale por 30 dias', () => {
    const agora = Date.UTC(2026, 10, 19);
    expect(dispensadoHaPouco(null, agora)).toBe(false);
    expect(dispensadoHaPouco('lixo', agora)).toBe(false);
    expect(dispensadoHaPouco(String(agora - 10 * DIA), agora)).toBe(true);
    expect(dispensadoHaPouco(String(agora - 31 * DIA), agora)).toBe(false);
  });

  it('botão quando o navegador oferece; instruções só no iOS', () => {
    const base = {
      celular: true,
      ios: false,
      instalado: false,
      dispensado: false,
      temPedido: false,
    };
    expect(modoDoAviso({ ...base, temPedido: true })).toBe('instalar');
    expect(modoDoAviso({ ...base, ios: true })).toBe('ios');
    // Android sem o pedido (Firefox, ou o Chrome ainda não avisou): nada.
    expect(modoDoAviso(base)).toBeNull();
    expect(modoDoAviso({ ...base, celular: false, temPedido: true })).toBeNull();
    expect(modoDoAviso({ ...base, instalado: true, temPedido: true })).toBeNull();
    expect(modoDoAviso({ ...base, dispensado: true, ios: true })).toBeNull();
  });
});

describe('useAvisoDeInstalacao', () => {
  beforeAll(() => escutarPedidoDeInstalacao(window));

  beforeEach(() => {
    _reiniciarParaTeste();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Android: aparece quando o Chrome oferece e o botão abre a janela dele', async () => {
    comoAparelho(ANDROID);
    const { result } = renderHook(() => useAvisoDeInstalacao());
    expect(result.current.modo).toBeNull();

    const evento = pedidoDoNavegador('accepted');
    act(() => {
      window.dispatchEvent(evento);
    });
    expect(evento.defaultPrevented).toBe(true);
    expect(result.current.modo).toBe('instalar');

    await act(() => result.current.instalar());
    expect(evento.prompt).toHaveBeenCalledTimes(1);
    expect(result.current.modo).toBeNull();
    // Instalou: não é "dispensado", e o aviso não volta nesta página.
    expect(window.localStorage.getItem(CHAVE_DISPENSADO)).toBeNull();
  });

  it('Android: recusar na janela do navegador conta como dispensar', async () => {
    comoAparelho(ANDROID);
    const { result } = renderHook(() => useAvisoDeInstalacao());
    act(() => {
      window.dispatchEvent(pedidoDoNavegador('dismissed'));
    });
    await act(() => result.current.instalar());
    expect(result.current.modo).toBeNull();
    expect(Number(window.localStorage.getItem(CHAVE_DISPENSADO))).toBeGreaterThan(0);
  });

  it('iPhone: mostra as instruções e "Entendi" guarda por 30 dias', () => {
    comoAparelho(IPHONE, 'iPhone');
    const { result } = renderHook(() => useAvisoDeInstalacao());
    expect(result.current.modo).toBe('ios');

    act(() => result.current.dispensar());
    expect(result.current.modo).toBeNull();
    expect(renderHook(() => useAvisoDeInstalacao()).result.current.modo).toBeNull();
  });

  it('já aberto como app instalado: nada', () => {
    comoAparelho(IPHONE, 'iPhone');
    Object.defineProperty(window.navigator, 'standalone', { value: true, configurable: true });
    try {
      expect(renderHook(() => useAvisoDeInstalacao()).result.current.modo).toBeNull();
    } finally {
      Object.defineProperty(window.navigator, 'standalone', {
        value: undefined,
        configurable: true,
      });
    }
  });

  it('computador: nada, mesmo com o pedido do Chrome', () => {
    comoAparelho(WINDOWS, 'Win32', 0);
    const { result } = renderHook(() => useAvisoDeInstalacao());
    act(() => {
      window.dispatchEvent(pedidoDoNavegador('accepted'));
    });
    expect(result.current.modo).toBeNull();
  });
});
