import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth, MANTER_SESSAO_KEY } from '../auth';

/**
 * "Manter Sessão Ativa" do login. Antes a caixa estava só desenhada: o painel
 * saía depois de 30 min sem mexer ("Sessão expirada") e pedia login de novo em
 * outra aba ou com o navegador reaberto, marcada ou não.
 */

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

const RESPOSTA_DO_LOGIN = {
  success: true,
  data: {
    token: 'token-de-acesso',
    refreshToken: 'token-de-renovacao',
    user: { id: 1, name: 'Administrador', email: 'admin@neopower.com', role: 'admin', clientId: null },
  },
};

const DUAS_HORAS = 2 * 60 * 60 * 1000;

async function entrar(manter: boolean) {
  const { result, unmount } = renderHook(() => useAuth(), { wrapper });
  await act(async () => {
    await result.current.login('admin@neopower.com', 'senha', manter);
  });
  expect(result.current.user?.email).toBe('admin@neopower.com');
  unmount();
}

/** Outra aba ou o navegador reaberto: o sessionStorage começa vazio. */
function abrirDeNovo() {
  sessionStorage.clear();
  return renderHook(() => useAuth(), { wrapper });
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(RESPOSTA_DO_LOGIN), { status: 200 }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Manter Sessão Ativa', () => {
  it('marcada: outra aba (ou o navegador reaberto) continua logada', async () => {
    await entrar(true);
    expect(localStorage.getItem(MANTER_SESSAO_KEY)).toBe('1');

    const { result } = abrirDeNovo();
    await waitFor(() => expect(result.current.user?.email).toBe('admin@neopower.com'));
    expect(result.current.user?.role).toBe('admin');
  });

  it('desmarcada: como antes, outra aba pede login', async () => {
    await entrar(false);
    expect(localStorage.getItem(MANTER_SESSAO_KEY)).toBeNull();
    expect(localStorage.getItem('userData')).toBeNull();

    const { result } = abrirDeNovo();
    await new Promise(r => setTimeout(r, 20));
    expect(result.current.user).toBeNull();
  });

  it('marcada: 2 h sem mexer não derruba a sessão', async () => {
    await entrar(true);
    localStorage.setItem('lastActivity', String(Date.now() - DUAS_HORAS));

    const { result } = abrirDeNovo();
    await waitFor(() => expect(result.current.user?.email).toBe('admin@neopower.com'));
    expect(localStorage.getItem('token')).toBe('token-de-acesso');
  });

  it('desmarcada: 2 h sem mexer encerra a sessão, como sempre', async () => {
    await entrar(false);
    localStorage.setItem('lastActivity', String(Date.now() - DUAS_HORAS));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await new Promise(r => setTimeout(r, 20));
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  it('sair apaga a sessão, mas a caixa lembra a escolha', async () => {
    await entrar(true);
    const { result } = abrirDeNovo();
    await waitFor(() => expect(result.current.user).not.toBeNull());

    act(() => result.current.logout());

    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(localStorage.getItem('userData')).toBeNull();
    expect(sessionStorage.getItem('userData')).toBeNull();
    expect(localStorage.getItem(MANTER_SESSAO_KEY)).toBe('1');

    const depois = abrirDeNovo();
    await new Promise(r => setTimeout(r, 20));
    expect(depois.result.current.user).toBeNull();
  });
});
