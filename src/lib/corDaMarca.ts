/**
 * Variações da cor principal da marca usadas no redesenho do painel.
 *
 * O Figma usa o verde #00cc6a em três papéis: preenchimento (botão, barra do
 * item ativo), fundo suave (ícones dos cartões, item ativo do menu) e texto
 * (item ativo, "+12 %"). Como cada marca tem a sua cor, os dois últimos são
 * derivados dela aqui:
 * - suave: a cor misturada ao fundo do cartão;
 * - forte: a cor escurecida (tema claro) ou clareada (tema escuro) até ter
 *   contraste de 3:1 com o cartão. O estudo de usabilidade pediu mais
 *   contraste, e um verde-limão como #00FF88 some no fundo branco.
 */

type Rgb = [number, number, number];

export function hexParaRgb(hex: string): Rgb {
  let h = hex.replace('#', '').trim();
  if (h.length === 3)
    h = h
      .split('')
      .map(c => c + c)
      .join('');
  const n = Number.parseInt(h.slice(0, 6), 16);
  if (!Number.isFinite(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbParaHex([r, g, b]: Rgb): string {
  return `#${[r, g, b]
    .map(c =>
      Math.round(Math.min(255, Math.max(0, c)))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`;
}

/** Luminância relativa (WCAG 2). */
function luminancia([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contraste(a: string, b: string): number {
  const la = luminancia(hexParaRgb(a));
  const lb = luminancia(hexParaRgb(b));
  const [claro, escuro] = la > lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (escuro + 0.05);
}

/** Mistura `cor` com `base`; `peso` é a fração de `cor` (0 a 1). */
export function misturar(cor: string, base: string, peso: number): string {
  const a = hexParaRgb(cor);
  const b = hexParaRgb(base);
  return rgbParaHex([0, 1, 2].map(i => a[i] * peso + b[i] * (1 - peso)) as Rgb);
}

/** Cor da marca com contraste mínimo sobre `fundo`, para texto e ícone. */
export function corForte(cor: string, fundo: string, temaEscuro: boolean, minimo = 3): string {
  const alvo = temaEscuro ? '#ffffff' : '#000000';
  let atual = cor;
  for (let passo = 0; passo < 20 && contraste(atual, fundo) < minimo; passo += 1) {
    atual = misturar(atual, alvo, 0.9);
  }
  return atual;
}

/** Fundo suave da marca (ícones dos cartões, item ativo do menu). */
export function corSuave(cor: string, fundo: string, temaEscuro: boolean): string {
  return misturar(cor, fundo, temaEscuro ? 0.3 : 0.2);
}
