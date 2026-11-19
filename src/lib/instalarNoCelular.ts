import { useEffect, useReducer, useState } from 'react';

/**
 * Aviso para instalar o painel no celular (19/11/2026).
 *
 * No computador, o Chrome mostra o botão "Instalar" na barra de endereço. No
 * celular não existe esse botão. No Android, a instalação fica escondida no
 * menu ⋮; no iPhone, só existe pelo Compartilhar › "Adicionar à Tela de
 * Início". O painel já cumpre os requisitos de instalação (manifesto e service
 * worker, em lib/appInstalavel.ts). Faltava oferecer a instalação na página.
 *
 * - Android (Chrome, Edge, Samsung): o navegador dispara `beforeinstallprompt`
 *   quando a página pode ser instalada. O evento chega antes de o React montar,
 *   por isso o ouvinte é registrado no main.tsx. Guardamos o evento, e o botão
 *   "Instalar" abre a janela de instalação do próprio navegador.
 * - iPhone e iPad: o Safari não tem esse evento nem botão que a página possa
 *   acionar. O aviso explica o caminho pelo Compartilhar.
 * - Não aparece no computador, com o app já instalado (aberto em tela cheia)
 *   nem se o usuário dispensou o aviso há menos de 30 dias.
 */

/** O `beforeinstallprompt` do Chromium (ainda fora do lib.dom). */
interface PedidoDeInstalacao extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type ModoDoAviso = 'instalar' | 'ios' | null;

export const CHAVE_DISPENSADO = 'neopower:aviso-instalar-dispensado';
const DIAS_SEM_AVISO = 30;

/** iPhone, iPod ou iPad (o iPadOS se apresenta como Mac, mas tem toque). */
export function ehIos(ua: string, plataforma: string, toques: number): boolean {
  return /iPhone|iPad|iPod/i.test(ua) || (plataforma === 'MacIntel' && toques > 1);
}

export function ehCelular(ua: string, plataforma: string, toques: number): boolean {
  return ehIos(ua, plataforma, toques) || /Android|Mobile/i.test(ua);
}

/** O usuário tocou em "Agora não" ou "Entendi" há menos de 30 dias. */
export function dispensadoHaPouco(salvo: string | null, agora: number): boolean {
  const quando = Number(salvo);
  return quando > 0 && agora - quando < DIAS_SEM_AVISO * 86_400_000;
}

export function modoDoAviso(p: {
  celular: boolean;
  ios: boolean;
  instalado: boolean;
  dispensado: boolean;
  temPedido: boolean;
}): ModoDoAviso {
  if (!p.celular || p.instalado || p.dispensado) return null;
  if (p.temPedido) return 'instalar';
  return p.ios ? 'ios' : null;
}

/** Aberto como app instalado, e não numa aba do navegador. */
function abertoComoApp(win: Window): boolean {
  const modo = (m: string) => win.matchMedia?.(`(display-mode: ${m})`).matches ?? false;
  return (
    modo('standalone') ||
    modo('fullscreen') ||
    (win.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

// O pedido do navegador chega uma vez por página carregada e vale para um único
// prompt(). Fica no módulo porque chega antes de qualquer componente existir.
let pedido: PedidoDeInstalacao | null = null;
let instaladoAgora = false;
const ouvintes = new Set<() => void>();
const avisarOuvintes = () => ouvintes.forEach(f => f());

/** Registrar no main.tsx, antes do render: o evento chega cedo. */
export function escutarPedidoDeInstalacao(win: Window = window): void {
  win.addEventListener('beforeinstallprompt', evento => {
    // O aviso da página substitui a barrinha do Chrome. Ela aparece pouco, e
    // as duas juntas oferecem a mesma coisa duas vezes.
    evento.preventDefault();
    pedido = evento as PedidoDeInstalacao;
    avisarOuvintes();
  });
  win.addEventListener('appinstalled', () => {
    pedido = null;
    instaladoAgora = true;
    avisarOuvintes();
  });
}

/** Só para os testes: volta ao estado de página recém-aberta. */
export function _reiniciarParaTeste(): void {
  pedido = null;
  instaladoAgora = false;
  ouvintes.clear();
}

function lerDispensado(): string | null {
  try {
    return window.localStorage.getItem(CHAVE_DISPENSADO);
  } catch {
    return null;
  }
}

function gravarDispensado(agora: number): void {
  try {
    window.localStorage.setItem(CHAVE_DISPENSADO, String(agora));
  } catch {
    // Sem armazenamento (aba anônima, bloqueio), o aviso volta na próxima visita.
  }
}

export function useAvisoDeInstalacao(): {
  modo: ModoDoAviso;
  instalar: () => Promise<void>;
  dispensar: () => void;
} {
  const [, atualizar] = useReducer((n: number) => n + 1, 0);
  const [dispensado, setDispensado] = useState(() =>
    dispensadoHaPouco(lerDispensado(), Date.now())
  );

  useEffect(() => {
    ouvintes.add(atualizar);
    return () => {
      ouvintes.delete(atualizar);
    };
  }, []);

  const nav = window.navigator;
  const ios = ehIos(nav.userAgent, nav.platform, nav.maxTouchPoints ?? 0);
  const modo = modoDoAviso({
    celular: ehCelular(nav.userAgent, nav.platform, nav.maxTouchPoints ?? 0),
    ios,
    instalado: instaladoAgora || abertoComoApp(window),
    dispensado,
    temPedido: !!pedido,
  });

  const dispensar = () => {
    gravarDispensado(Date.now());
    setDispensado(true);
  };

  const instalar = async () => {
    const atual = pedido;
    if (!atual) return;
    pedido = null; // o mesmo pedido não abre a janela duas vezes
    await atual.prompt();
    const { outcome } = await atual.userChoice;
    if (outcome === 'accepted') instaladoAgora = true;
    else dispensar(); // recusou na janela do navegador: não insistir
    avisarOuvintes();
  };

  return { modo, instalar, dispensar };
}
