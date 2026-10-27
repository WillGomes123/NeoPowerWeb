/**
 * Fonte da marca (campo `fontFamily` do branding): uma família do Google Fonts,
 * carregada sob demanda. O adesivo do QR vira PDF pelo html2canvas, que desenha
 * o texto com as fontes já carregadas no documento; se a família ainda não
 * chegou quando a captura começa, o PDF sai na fonte reserva.
 */

/** Mesmo formato que a API aceita: letras, números e espaço, de 2 a 40. */
const FORMATO_DA_FAMILIA = /^[A-Za-z0-9 ]{2,40}$/;

/** Pesos usados no adesivo: texto, negrito e títulos. */
const PESOS = ['400', '700', '800'];

export function fonteValida(familia: string | null | undefined): familia is string {
  return !!familia && FORMATO_DA_FAMILIA.test(familia.trim());
}

/** CSS do Google Fonts para a família; sem `comPesos`, só o regular. */
export function urlDaFonte(familia: string, comPesos = true): string {
  const nome = familia.trim().replace(/ +/g, '+');
  return `https://fonts.googleapis.com/css2?family=${nome}${comPesos ? `:wght@${PESOS.join(';')}` : ''}&display=swap`;
}

/** Pilha do CSS: a fonte da marca na frente e as de sempre como reserva. */
export function pilhaDeFontes(familia: string | null | undefined, reserva: string): string {
  return fonteValida(familia) ? `'${familia.trim()}', ${reserva}` : reserva;
}

// Uma folha por URL: dois cliques seguidos não duplicam o <link>.
const folhas = new Map<string, Promise<boolean>>();

function anexarFolha(href: string): Promise<boolean> {
  const emCurso = folhas.get(href);
  if (emCurso) return emCurso;
  const carregando = new Promise<boolean>(resolve => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve(true);
    link.onerror = () => {
      folhas.delete(href);
      link.remove();
      resolve(false);
    };
    document.head.appendChild(link);
  });
  folhas.set(href, carregando);
  return carregando;
}

/**
 * Carrega a família e espera os arquivos chegarem (`document.fonts.ready`).
 * Nunca falha nem trava a geração do PDF: sem rede, família inexistente ou
 * demora acima de `limiteMs`, devolve false e o texto sai na fonte reserva.
 */
export async function carregarFonteDaMarca(
  familia: string | null | undefined,
  limiteMs = 5000
): Promise<boolean> {
  if (!fonteValida(familia) || typeof document === 'undefined') return false;
  const nome = familia.trim();

  const carregar = async () => {
    // O css2 do Google recusa (400) um peso que a família não tem; aí vai só o regular.
    const ok =
      (await anexarFolha(urlDaFonte(nome))) || (await anexarFolha(urlDaFonte(nome, false)));
    if (!ok || !document.fonts) return ok;
    // A folha só declara as fontes; o arquivo baixa quando alguém pede.
    await Promise.all(
      PESOS.map(peso => document.fonts.load(`${peso} 16px '${nome}'`).catch(() => []))
    );
    await document.fonts.ready;
    return document.fonts.check(`16px '${nome}'`);
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<boolean>(resolve => {
    timer = setTimeout(() => resolve(false), limiteMs);
  });
  try {
    return await Promise.race([carregar(), limite]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
