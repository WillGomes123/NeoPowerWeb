import { describe, it, expect } from 'vitest';
import { ehTagDeCliente, mensagemDoInicioRemoto } from '../inicioRemoto';

describe('ehTagDeCliente', () => {
  it('e-mail e USER_<id> são de cliente', () => {
    expect(ehTagDeCliente('ana.souza@yahoo.com.br')).toBe(true);
    expect(ehTagDeCliente('USER_ana.souza@yahoo.com.br')).toBe(true);
    expect(ehTagDeCliente(' USER_1474 ')).toBe(true);
    expect(ehTagDeCliente('user_1474')).toBe(true);
  });

  it('cartão, tag antiga do painel e vazio não são', () => {
    expect(ehTagDeCliente('04A2B9C1')).toBe(false);
    expect(ehTagDeCliente('USER001')).toBe(false);
    expect(ehTagDeCliente('USER_abc')).toBe(false);
    expect(ehTagDeCliente('')).toBe(false);
    expect(ehTagDeCliente(undefined)).toBe(false);
  });
});

describe('mensagemDoInicioRemoto', () => {
  it('diz em nome de quem a recarga foi iniciada', () => {
    expect(
      mensagemDoInicioRemoto({
        status: 'Accepted',
        idTag: 'USER_1474',
        cliente: { id: 1474, nome: 'Ana Souza' },
      })
    ).toBe(
      'Iniciado em nome de Ana Souza (USER_1474). A recarga será cobrada na carteira do cliente.'
    );
  });

  it('cliente sem nome no cadastro aparece pelo número', () => {
    expect(
      mensagemDoInicioRemoto({ status: 'Accepted', idTag: 'USER_9', cliente: { id: 9, nome: null } })
    ).toContain('em nome de cliente 9 (USER_9)');
  });

  it('tag avulsa: avisa que não há cobrança', () => {
    expect(mensagemDoInicioRemoto({ status: 'Accepted', idTag: 'CARTAO01', cliente: null })).toBe(
      'Iniciado com a tag CARTAO01, sem cliente: esta recarga não será cobrada.'
    );
  });

  it('resposta de outro comando, ou de API antiga, não muda o texto padrão', () => {
    expect(mensagemDoInicioRemoto({ status: 'Accepted' })).toBeNull();
    expect(mensagemDoInicioRemoto(null)).toBeNull();
    expect(mensagemDoInicioRemoto('ok')).toBeNull();
  });
});
