import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

/*
 * Peças de página do redesenho (Figma da Lauriane, nov/2026), comuns a todas
 * as telas: cartão, bloco de ícone, cabeçalho com filtros e o botão
 * "Atualizar" com a hora da última atualização.
 */

/** Cartão branco de cantos 15 px e sombra suave (sem sombra no escuro). */
export const classeDoCartao = 'bg-card text-card-foreground rounded-[15px] shadow-cartao';

/** Pílula de filtro (período, local, estação): 55 px de altura, borda e sombra. */
export const classeDaPilula =
  'h-[55px] data-[size=default]:h-[55px] w-full sm:w-[248px] rounded-[25px] border border-[#666] dark:border-primary bg-card px-[22px] gap-3 ' +
  'text-[15px] font-medium text-foreground dark:text-primary-strong shadow-pilula hover:bg-card hover:text-foreground ' +
  'dark:hover:text-primary-strong data-[placeholder]:text-foreground';

export type Tom = 'marca' | 'azul' | 'amarelo' | 'cinza';

const FUNDO_DO_TOM: Record<Tom, string> = {
  marca: 'bg-primary-soft text-primary-strong',
  azul: 'bg-tom-azul text-tom-azul-icone',
  amarelo: 'bg-tom-amarelo text-tom-amarelo-icone',
  cinza: 'bg-tom-cinza text-tom-cinza-icone',
};

/** Quadradinho colorido atrás do ícone dos cartões (41×38 no Figma). */
export function BlocoDeIcone({
  tom = 'marca',
  children,
  grande = false,
}: {
  tom?: Tom;
  children: ReactNode;
  grande?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`${FUNDO_DO_TOM[tom]} ${grande ? 'w-[46px] h-[45px]' : 'w-[41px] h-[38px]'} rounded-[5px] flex items-center justify-center shrink-0`}
    >
      {children}
    </span>
  );
}

interface CabecalhoProps {
  /** Rótulo pequeno acima do título (ex.: "GERAÇÃO DISTRIBUÍDA"). */
  rotulo?: string;
  titulo: string;
  subtitulo?: ReactNode;
  /** Linha extra sob o subtítulo: escopo dos filtros, avisos. */
  detalhe?: ReactNode;
  filtros?: ReactNode;
  acoes?: ReactNode;
}

/** Título à esquerda; filtros e ações à direita, quebrando para baixo no estreito. */
export function CabecalhoDaPagina({
  rotulo,
  titulo,
  subtitulo,
  detalhe,
  filtros,
  acoes,
}: CabecalhoProps) {
  return (
    <header className="flex flex-col min-[1700px]:flex-row min-[1700px]:items-start justify-between gap-6">
      <div className="min-w-0 flex-1 pt-2">
        {rotulo && <p className="text-[15px] uppercase text-foreground/80 mb-1">{rotulo}</p>}
        <h1 className="text-[32px] leading-tight font-semibold text-foreground dark:text-primary-strong">
          {titulo}
        </h1>
        {subtitulo && <p className="text-[15px] font-medium text-foreground mt-1">{subtitulo}</p>}
        {detalhe && <div className="text-sm text-muted-foreground mt-2">{detalhe}</div>}
      </div>
      {(filtros || acoes) && (
        <div className="flex flex-col sm:flex-row sm:flex-wrap min-[1700px]:flex-nowrap items-stretch sm:items-start gap-4 min-[1700px]:gap-8 min-[1700px]:justify-end shrink-0">
          {filtros && (
            <div className="flex flex-col sm:flex-row sm:flex-wrap min-[1700px]:flex-nowrap gap-4 min-[1700px]:gap-8 sm:pt-[7px]">
              {filtros}
            </div>
          )}
          {acoes}
        </div>
      )}
    </header>
  );
}

/** "hoje às 14:30", "ontem às 09:12" ou "15/11 às 08:00". */
export function quandoFoi(data: Date, agora = new Date()): string {
  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dia = (d: Date) => d.toLocaleDateString('pt-BR');
  if (dia(data) === dia(agora)) return `hoje às ${hora}`;
  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);
  if (dia(data) === dia(ontem)) return `ontem às ${hora}`;
  return `${data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${hora}`;
}

interface BotaoAtualizarProps {
  aoAtualizar: () => void;
  carregando: boolean;
  /** Última vez que os números chegaram. */
  atualizadoEm: Date | null;
  /** A última tentativa falhou (os números na tela são os anteriores). */
  falhou?: boolean;
}

/**
 * Botão verde "Atualizar" com a hora da última atualização embaixo. O estudo
 * de usabilidade (H1) pediu que a tela dissesse quando os dados chegaram, que
 * mostrasse o carregando e que avisasse quando a atualização falha.
 */
export function BotaoAtualizar({
  aoAtualizar,
  carregando,
  atualizadoEm,
  falhou,
}: BotaoAtualizarProps) {
  return (
    <div className="flex flex-col items-stretch sm:items-end gap-1 shrink-0">
      <button
        type="button"
        onClick={aoAtualizar}
        disabled={carregando}
        className="h-12 sm:w-[201px] px-6 rounded-[25px] bg-primary text-primary-foreground text-[15px] font-medium
          inline-flex items-center justify-center gap-2 hover:brightness-105 active:scale-[0.98] transition disabled:opacity-80"
      >
        {carregando && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
        {carregando ? 'Atualizando…' : 'Atualizar'}
      </button>
      <p
        role="status"
        aria-live="polite"
        className={`text-[13px] font-medium text-center sm:text-right ${falhou ? 'text-destructive' : 'text-foreground'}`}
      >
        {falhou
          ? `Não foi possível atualizar${atualizadoEm ? ` · dados de ${quandoFoi(atualizadoEm)}` : ''}`
          : atualizadoEm
            ? `Última atualização ${quandoFoi(atualizadoEm)}`
            : ' '}
      </p>
    </div>
  );
}
