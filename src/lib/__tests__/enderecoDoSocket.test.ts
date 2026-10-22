import { describe, it, expect } from 'vitest';
import { enderecoDoSocket } from '../enderecoDoSocket';

const ORIGEM = 'https://neopowerhub.com';

describe('enderecoDoSocket', () => {
  it('produção: tira o /api do final', () => {
    expect(enderecoDoSocket('https://ocppapi-production.up.railway.app/api', ORIGEM)).toBe(
      'https://ocppapi-production.up.railway.app'
    );
  });

  it('domínio que começa por "api" não perde o começo (era "wss://https/")', () => {
    expect(enderecoDoSocket('https://api-production-c0b8.up.railway.app/api', ORIGEM)).toBe(
      'https://api-production-c0b8.up.railway.app'
    );
  });

  it('aceita barra no fim e URL sem /api', () => {
    expect(enderecoDoSocket('https://api.exemplo.com/api/', ORIGEM)).toBe('https://api.exemplo.com');
    expect(enderecoDoSocket('https://api.exemplo.com', ORIGEM)).toBe('https://api.exemplo.com');
  });

  it('sem URL absoluta usa a origem do painel', () => {
    expect(enderecoDoSocket('/api', ORIGEM)).toBe(ORIGEM);
    expect(enderecoDoSocket('', ORIGEM)).toBe(ORIGEM);
    expect(enderecoDoSocket(undefined, ORIGEM)).toBe(ORIGEM);
  });
});
