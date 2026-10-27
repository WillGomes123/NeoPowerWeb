/**
 * Fonte da marca no adesivo do QR: a família do Google Fonts entra no <head>
 * antes da captura do html2canvas, e nada disso pode travar ou derrubar a
 * geração do PDF.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { carregarFonteDaMarca, fonteValida, pilhaDeFontes, urlDaFonte } from '../fonteDaMarca';

const folhaDe = (href: string) =>
  Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).find(
    l => l.getAttribute('href') === href
  );

describe('fonte da marca', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('aceita o mesmo formato da API', () => {
    expect(fonteValida('Rubik')).toBe(true);
    expect(fonteValida('Open Sans')).toBe(true);
    expect(fonteValida('')).toBe(false);
    expect(fonteValida(null)).toBe(false);
    expect(fonteValida("Rubik'; } body { x")).toBe(false);
  });

  it('monta o CSS do Google com os pesos do adesivo', () => {
    expect(urlDaFonte('Rubik')).toBe(
      'https://fonts.googleapis.com/css2?family=Rubik:wght@400;700;800&display=swap'
    );
    expect(urlDaFonte('Open Sans', false)).toBe(
      'https://fonts.googleapis.com/css2?family=Open+Sans&display=swap'
    );
  });

  it('põe a fonte da marca na frente da pilha, só se for válida', () => {
    expect(pilhaDeFontes('Rubik', 'Arial')).toBe("'Rubik', Arial");
    expect(pilhaDeFontes(null, 'Arial')).toBe('Arial');
    expect(pilhaDeFontes('x', 'Arial')).toBe('Arial');
  });

  it('sem fonte (ou inválida) não mexe no documento', async () => {
    expect(await carregarFonteDaMarca(null)).toBe(false);
    expect(await carregarFonteDaMarca('<script>')).toBe(false);
    expect(document.head.querySelector('link')).toBeNull();
  });

  it('carrega a folha do Google e espera ela chegar', async () => {
    const carregando = carregarFonteDaMarca('Rubik');
    const link = folhaDe(urlDaFonte('Rubik'));
    expect(link).toBeTruthy();
    link!.dispatchEvent(new Event('load'));
    expect(await carregando).toBe(true);
  });

  it('se a família não tem os pesos, tenta só o regular', async () => {
    const carregando = carregarFonteDaMarca('Bebas Neue');
    folhaDe(urlDaFonte('Bebas Neue'))!.dispatchEvent(new Event('error'));
    const regular = await vi.waitFor(() => {
      const link = folhaDe(urlDaFonte('Bebas Neue', false));
      expect(link).toBeTruthy();
      return link!;
    });
    regular.dispatchEvent(new Event('load'));
    expect(await carregando).toBe(true);
  });

  it('não trava a geração do PDF quando a fonte não chega', async () => {
    expect(await carregarFonteDaMarca('Fonte Lenta', 20)).toBe(false);
  });
});
