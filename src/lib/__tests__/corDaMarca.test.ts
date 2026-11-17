import { describe, it, expect } from 'vitest';
import { contraste, corForte, corSuave, misturar } from '../corDaMarca';

describe('corDaMarca', () => {
  it('mistura duas cores pelo peso', () => {
    expect(misturar('#00cc6a', '#ffffff', 1)).toBe('#00cc6a');
    expect(misturar('#00cc6a', '#ffffff', 0)).toBe('#ffffff');
    expect(misturar('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('o verde-limão da NeoPower escurece no tema claro até ser legível no branco', () => {
    expect(contraste('#00FF88', '#ffffff')).toBeLessThan(3);
    const forte = corForte('#00FF88', '#ffffff', false);
    expect(contraste(forte, '#ffffff')).toBeGreaterThanOrEqual(3);
  });

  it('não mexe numa cor que já tem contraste', () => {
    expect(corForte('#0b5394', '#ffffff', false)).toBe('#0b5394');
    expect(corForte('#00FF88', '#202020', true)).toBe('#00FF88');
  });

  it('uma marca escura clareia no tema escuro', () => {
    const forte = corForte('#1a237e', '#202020', true);
    expect(contraste(forte, '#202020')).toBeGreaterThanOrEqual(3);
  });

  it('o fundo suave fica perto do fundo do cartão', () => {
    expect(corSuave('#00cc6a', '#ffffff', false)).toBe('#ccf5e1');
    expect(contraste(corSuave('#00cc6a', '#202020', true), '#202020')).toBeLessThan(3);
  });
});
