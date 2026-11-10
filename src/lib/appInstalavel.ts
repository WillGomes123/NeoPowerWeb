import { darkVars, lightVars } from './theme-constants';
import { registerServiceWorker } from './webPush';

/**
 * Painel instalável no celular ("Adicionar à tela inicial" do Chrome e do
 * Safari, sem app de loja) com a cara da marca da URL: o operador da Power Link
 * instala neopowerhub.com/powerlink e o celular mostra "Power Link" com o ícone
 * dela, abrindo direto no painel dela, sem a barra do navegador.
 *
 * - Manifesto: o da NeoPower é estático (public/manifest.webmanifest); o das
 *   marcas a API monta com o cadastro (GET /branding/<clientId>/manifest.webmanifest).
 * - Ícone do iOS (apple-touch-icon): o Safari usa ele antes do manifesto. Nas
 *   marcas é o ícone de 192 do próprio manifesto, para os dois serem o mesmo.
 * - Service worker (public/sw.js): registrado ao abrir, para o push funcionar
 *   no app instalado (no iPhone, só nele), e avisado da marca, para o toque na
 *   notificação abrir o painel dela.
 */

export const SLUG_DA_NEOPOWER = 'neopower';
const MANIFESTO_DA_NEOPOWER = '/manifest.webmanifest';
const ICONE_IOS_DA_NEOPOWER = '/icones/neopower-180.png';
const ICONE_DA_NEOPOWER = '/icones/neopower-192.png';
const TITULO = 'Plataforma de operabilidade de eletropostos';

interface MarcaDaUrl {
  clientId?: string | null;
  companyName?: string | null;
  theme?: string | null;
}

export interface AppDaMarca {
  nome: string;
  /** href do <link rel="manifest">. */
  manifesto: string;
  /** apple-touch-icon; null = o de 192 do manifesto, que só se sabe depois de buscá-lo. */
  iconeDoIos: string | null;
  /** Painel da marca (/powerlink/): onde o toque na notificação abre. */
  inicio: string;
  temaEscuro: boolean;
}

/** O app da marca da URL. NeoPower (ou marca que não carregou): o estático. */
export function appDaMarca(slug: string, marca: MarcaDaUrl | null, apiUrl: string): AppDaMarca {
  const clientId = marca?.clientId?.trim();
  if (slug === SLUG_DA_NEOPOWER || !clientId) {
    return {
      nome: 'NeoPower',
      manifesto: MANIFESTO_DA_NEOPOWER,
      iconeDoIos: ICONE_IOS_DA_NEOPOWER,
      inicio: `/${SLUG_DA_NEOPOWER}/`,
      temaEscuro: true,
    };
  }
  return {
    nome: marca?.companyName?.trim() || clientId,
    manifesto: `${apiUrl.replace(/\/+$/, '')}/branding/${encodeURIComponent(clientId)}/manifest.webmanifest`,
    iconeDoIos: null,
    inicio: `/${slug}/`,
    temaEscuro: marca?.theme !== 'light',
  };
}

/** Cria ou atualiza o <link>/<meta> do <head> identificado por `chave`=`valor`. */
function definir(
  doc: Document,
  tag: 'link' | 'meta',
  chave: 'rel' | 'name',
  valor: string,
  atributo: 'href' | 'content',
  conteudo: string
): void {
  let el = doc.head.querySelector(`${tag}[${chave}="${valor}"]`);
  if (!el) {
    el = doc.createElement(tag);
    el.setAttribute(chave, valor);
    doc.head.appendChild(el);
  }
  el.setAttribute(atributo, conteudo);
}

/** Nome, manifesto e ícone do iOS no <head>. */
export function aplicarAppDaMarca(app: AppDaMarca, doc: Document = document): void {
  doc.title = `${app.nome} | ${TITULO}`;
  definir(doc, 'link', 'rel', 'manifest', 'href', app.manifesto);
  definir(doc, 'meta', 'name', 'apple-mobile-web-app-title', 'content', app.nome);
  // O iOS lê a barra de status ao instalar; 'default' é a clara, de texto escuro.
  definir(
    doc,
    'meta',
    'name',
    'apple-mobile-web-app-status-bar-style',
    'content',
    app.temaEscuro ? 'black' : 'default'
  );
  if (app.iconeDoIos) definir(doc, 'link', 'rel', 'apple-touch-icon', 'href', app.iconeDoIos);
}

/** Barra de status do Android no fundo do painel, acompanhando o tema em uso. */
export function aplicarCorDaBarra(temaEscuro: boolean, doc: Document = document): void {
  const fundo = (temaEscuro ? darkVars : lightVars)['--color-background'];
  definir(doc, 'meta', 'name', 'theme-color', 'content', fundo);
}

/** O ícone "any" de 192 do manifesto (o mais perto dos 180 do iOS), em URL absoluta. */
export async function iconeDoManifesto(
  url: string,
  buscar: typeof fetch = fetch
): Promise<string | null> {
  try {
    const resposta = await buscar(url);
    if (!resposta.ok) return null;
    const { icons } = await resposta.json();
    if (!Array.isArray(icons)) return null;
    const usaveis = icons.filter(
      i =>
        typeof i?.src === 'string' && (!i.purpose || String(i.purpose).split(' ').includes('any'))
    );
    const icone = usaveis.find(i => i.sizes === '192x192') ?? usaveis[0];
    return icone ? new URL(icone.src, url).href : null;
  } catch {
    return null;
  }
}

/** Registra o public/sw.js e conta a ele a marca (ver o sw.js). Sem push, nada. */
async function avisarServiceWorker(inicio: string, icone: string | null): Promise<void> {
  const registro = await registerServiceWorker();
  if (!registro) return;
  const ativo = registro.active ?? (await navigator.serviceWorker.ready).active;
  ativo?.postMessage({ tipo: 'marca', inicio, icone });
}

/**
 * Deixa o painel instalável com a marca da URL. Chamado uma vez, assim que a
 * marca carrega, antes das páginas montarem (as legais trocam o título e
 * devolvem o anterior ao sair).
 */
export function instalarAppDaMarca(slug: string, marca: MarcaDaUrl | null, apiUrl: string): void {
  const app = appDaMarca(slug, marca, apiUrl);
  aplicarAppDaMarca(app);
  const icone = app.iconeDoIos
    ? Promise.resolve(ICONE_DA_NEOPOWER)
    : iconeDoManifesto(app.manifesto).then(icone => {
        if (icone) definir(document, 'link', 'rel', 'apple-touch-icon', 'href', icone);
        return icone;
      });
  void icone.then(i => avisarServiceWorker(app.inicio, i)).catch(() => undefined);
}
