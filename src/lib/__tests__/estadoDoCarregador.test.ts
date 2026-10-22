import { describe, it, expect } from 'vitest';
import { estadoDoCarregador, estadoDoLocal } from '../estadoDoCarregador';

/**
 * Estado do carregador no painel: o cadastrado que nunca ligou é "em
 * instalação", não offline (22/10/2026: 12 dos 17 "offline" eram cadastros).
 */
describe('estadoDoCarregador', () => {
  it('nunca conectou (sem last_seen) está em instalação', () => {
    expect(estadoDoCarregador({ isConnected: false, last_seen: null })).toBe('instalacao');
    expect(estadoDoCarregador({ isConnected: false })).toBe('instalacao');
  });

  it('conectou e caiu é offline', () => {
    expect(estadoDoCarregador({ isConnected: false, last_seen: '2026-10-05T12:00:00Z', ocppStatus: 'Available' })).toBe('offline');
  });

  it('conectado: em uso, com falha, indisponível ou ativo', () => {
    const on = { isConnected: true, last_seen: '2026-10-22T12:00:00Z' };
    expect(estadoDoCarregador({ ...on, ocppStatus: 'Charging' })).toBe('emUso');
    expect(estadoDoCarregador({ ...on, ocppStatus: 'SuspendedEV' })).toBe('emUso');
    expect(estadoDoCarregador({ ...on, ocppStatus: 'Faulted' })).toBe('falha');
    expect(estadoDoCarregador({ ...on, ocppStatus: 'Unavailable' })).toBe('indisponivel');
    expect(estadoDoCarregador({ ...on, ocppStatus: 'Available' })).toBe('ativo');
    expect(estadoDoCarregador({ ...on, ocppStatus: 'Preparing' })).toBe('ativo');
    expect(estadoDoCarregador({ ...on, ocppStatus: null })).toBe('ativo');
  });
});

describe('estadoDoLocal', () => {
  it('o mais relevante vence: em uso, falha, ativo, indisponível, offline, instalação', () => {
    expect(estadoDoLocal(['ativo', 'emUso', 'offline'])).toBe('emUso');
    expect(estadoDoLocal(['ativo', 'falha'])).toBe('falha');
    expect(estadoDoLocal(['offline', 'ativo'])).toBe('ativo');
    expect(estadoDoLocal(['offline', 'indisponivel'])).toBe('indisponivel');
    expect(estadoDoLocal(['instalacao', 'offline'])).toBe('offline');
    expect(estadoDoLocal(['instalacao', 'instalacao'])).toBe('instalacao');
  });

  it('local sem carregador fica em instalação', () => {
    expect(estadoDoLocal([])).toBe('instalacao');
  });
});
