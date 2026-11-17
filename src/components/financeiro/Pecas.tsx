import type { ReactNode } from 'react';
import { BlocoDeIcone, classeDoCartao, type Tom } from '../painel/Pagina';
import { dataLocal } from '../ui/utils';

/*
 * Peças das telas do menu Financeiro (Transações, Relatório financeiro,
 * Vouchers, Tarifas) no estilo do redesenho de nov/2026. Estas telas não têm
 * Figma: cada peça repete uma que a Lauriane já desenhou (Visão geral, Energia,
 * Operações, Notificações e Alarmes), sem elemento novo.
 */

interface CartaoDeIndicadorProps {
  tom?: Tom;
  icone: ReactNode;
  titulo: string;
  /** Linha curta sob o título: o período do número. */
  subtitulo?: ReactNode;
  /** O número, num texto só (ex.: "R$ 200,00"). */
  valor: ReactNode;
  /** Número na cor da marca (o valor a pagar). */
  destaque?: boolean;
  /** Número em vermelho (custo, saldo negativo). */
  negativo?: boolean;
  /** De onde sai o número: embaixo, em letra menor (como nos cartões de Energia). */
  children?: ReactNode;
}

/**
 * Cartão de indicador da Visão geral: bloco de ícone, título de 20 px, o
 * período embaixo, o número grande e o detalhe no rodapé. É uma `section` com
 * o título como nome, para o leitor de tela (e os testes) acharem o cartão
 * pelo que ele diz.
 */
export function CartaoDeIndicador({
  tom = 'marca',
  icone,
  titulo,
  subtitulo,
  valor,
  destaque,
  negativo,
  children,
}: CartaoDeIndicadorProps) {
  const corDoValor = negativo
    ? 'text-destructive'
    : destaque
      ? 'text-primary-strong'
      : 'text-foreground';
  return (
    <section
      aria-label={titulo}
      className={`${classeDoCartao} p-5 3xl:p-[22px] min-h-[165px] flex flex-col`}
    >
      <div className="flex items-start gap-4 3xl:gap-[18px]">
        <BlocoDeIcone tom={tom}>{icone}</BlocoDeIcone>
        <div className="min-w-0">
          <h3 className="text-[18px] 3xl:text-[20px] leading-tight font-semibold text-[#001119] dark:text-foreground">
            {titulo}
          </h3>
          {subtitulo && (
            <p className="text-[15px] font-medium text-muted-foreground truncate">{subtitulo}</p>
          )}
        </div>
      </div>
      <p
        className={`mt-[18px] text-[clamp(1.6rem,2.1vw,2.5rem)] leading-none font-semibold tabular-nums ${corDoValor}`}
      >
        {valor}
      </p>
      {children && (
        <div className="mt-auto pt-3 text-sm text-muted-foreground leading-snug">{children}</div>
      )}
    </section>
  );
}

/** Cabeçalho dos cartões de seção (o dos gráficos da Visão geral): ícone, título, subtítulo e o selo. */
export function CabecalhoDoCartao({
  icone,
  tom = 'marca',
  titulo,
  subtitulo,
  direita,
}: {
  icone: ReactNode;
  tom?: Tom;
  titulo: ReactNode;
  subtitulo?: ReactNode;
  direita?: ReactNode;
}) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
      <div className="flex items-start gap-4 3xl:gap-[18px] min-w-0">
        <BlocoDeIcone tom={tom}>{icone}</BlocoDeIcone>
        <div className="min-w-0">
          <h2 className="text-[20px] leading-tight font-semibold text-foreground">{titulo}</h2>
          {subtitulo && (
            <div className="text-[15px] font-medium text-muted-foreground mt-0.5">{subtitulo}</div>
          )}
        </div>
      </div>
      {direita && <div className="flex flex-wrap items-center gap-2 shrink-0">{direita}</div>}
    </div>
  );
}

/** Selo de contorno da Visão geral ("Receita líquida", "Diária"). */
export function SeloDeContorno({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 h-[27px] px-4 rounded-[25px] border border-foreground dark:border-primary text-sm font-medium text-foreground dark:text-primary-strong inline-flex items-center whitespace-nowrap">
      {children}
    </span>
  );
}

/** Número pequeno dentro de um cartão: o bloco "Agora" da Visão geral. */
export function NumeroMiudo({
  rotulo,
  valor,
  detalhe,
  destaque,
  negativo,
}: {
  rotulo: ReactNode;
  valor: ReactNode;
  detalhe?: ReactNode;
  /** Fundo e número na cor da marca. */
  destaque?: boolean;
  /** Número em vermelho (custo). */
  negativo?: boolean;
}) {
  const cor = negativo ? 'text-destructive' : destaque ? 'text-primary-strong' : 'text-foreground';
  return (
    <div className={`rounded-[5px] px-4 py-3 ${destaque ? 'bg-primary-soft' : 'bg-muted'}`}>
      <p className="text-sm font-medium text-muted-foreground">{rotulo}</p>
      <p className={`mt-1 text-[24px] leading-tight font-semibold tabular-nums ${cor}`}>{valor}</p>
      {detalhe && <p className="text-xs text-muted-foreground mt-1">{detalhe}</p>}
    </div>
  );
}

/** Sem dados: o quadro tracejado dos gráficos vazios da Visão geral. */
export function Vazio({ titulo, texto }: { titulo: ReactNode; texto?: ReactNode }) {
  return (
    <div className="py-10 flex flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-border text-center px-6">
      <p className="text-[15px] font-semibold text-foreground">{titulo}</p>
      {texto && <p className="text-sm text-muted-foreground">{texto}</p>}
    </div>
  );
}

/*
 * Tabela de Notificações e Alarmes do Figma: cabeçalho em maiúsculas pequenas
 * sobre o cartão branco e cada linha numa faixa verde-clara de cantos
 * arredondados, com 10 px entre as linhas.
 */
export const classeDaTabela = 'w-full border-separate border-spacing-y-[10px] text-sm';
export const classeDoTh =
  'px-3 3xl:px-4 pb-1 text-[13px] 3xl:text-[15px] font-semibold uppercase text-foreground whitespace-nowrap';
/** Célula sem o fundo: o fundo vem da linha (verde, ou outro para destacar). */
export const classeDaCelula =
  'px-3 3xl:px-4 py-3 align-middle first:rounded-l-[15px] last:rounded-r-[15px]';
export const fundoDaLinha = 'bg-primary/[0.14]';

/**
 * A mesma tabela, aplicada de fora: para as telas com PR aberto que mexe nas
 * linhas (Transações #82, Vouchers #84). O contêiner pinta as células sem
 * tocar no código das linhas e das colunas, e a coluna nova do PR já entra
 * no mesmo desenho.
 */
export const classeDoConteinerDaTabela =
  'overflow-x-auto px-4 pb-2 ' +
  '[&_table]:border-separate [&_table]:border-spacing-y-[10px] ' +
  '[&_thead_tr]:bg-transparent [&_thead_th]:pt-3 [&_thead_th]:pb-1 [&_thead_th]:px-3 3xl:[&_thead_th]:px-4 ' +
  '[&_thead_th]:text-[13px] 3xl:[&_thead_th]:text-[15px] [&_thead_th]:font-semibold [&_thead_th]:tracking-normal ' +
  '[&_thead_th]:uppercase [&_thead_th]:text-foreground [&_thead_th]:whitespace-nowrap ' +
  '[&_tbody_td]:px-3 3xl:[&_tbody_td]:px-4 ' +
  '[&_tbody_td:first-child]:rounded-l-[15px] [&_tbody_td:last-child]:rounded-r-[15px] ' +
  // A linha de "nenhum resultado" (uma célula só) fica sem a faixa verde.
  '[&_tbody_td:not(:only-child)]:bg-primary/[0.14] [&_tbody_tr:hover_td:not(:only-child)]:bg-primary/[0.22]';

/**
 * Pílula para o ExportButton (peça comum, que não aceita classe): o contêiner
 * das ações pinta o botão filho direto como o "Nova campanha" do Figma. O
 * BotaoAtualizar fica de fora porque o botão dele mora dentro de um `div`.
 */
export const classeDasAcoesComExportar =
  'flex flex-col sm:flex-row items-stretch sm:items-start gap-3 ' +
  '[&>button]:h-12 [&>button]:px-6 [&>button]:rounded-[25px] [&>button]:text-[15px] [&>button]:font-medium ' +
  '[&>button]:bg-card [&>button]:border-foreground/70 [&>button]:text-foreground [&>button]:shadow-pilula ' +
  'dark:[&>button]:border-primary dark:[&>button]:text-primary-strong dark:[&>button]:bg-card';

/** "Hoje", "15/11/2026" ou "01/11/2026 — 15/11/2026"; sem datas, o texto de vazio. */
export function rotuloDoPeriodo(inicio: string, fim: string, vazio = 'Todo o período'): string {
  if (!inicio && !fim) return vazio;
  const dia = (d: string) => dataLocal(d).toLocaleDateString('pt-BR');
  const hoje = new Date().toLocaleDateString('pt-BR');
  if (inicio && fim) {
    if (inicio === fim) return dia(inicio) === hoje ? 'Hoje' : dia(inicio);
    return `${dia(inicio)} — ${dia(fim)}`;
  }
  return inicio ? `Desde ${dia(inicio)}` : `Até ${dia(fim)}`;
}
