import type { ReactNode } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { cn } from '../ui/utils';
import { classeDaPilula, classeDoCartao } from '../painel/Pagina';
import {
  classeDoBotaoContorno,
  classeDoBotaoPerigo,
  classeDoBotaoPrincipal,
} from '../painel/Pecas';

/*
 * Peças das telas de Configurações (Usuários, Perfis, Carteiras, White Label,
 * Email, Atendimento, Erros do app) no redesenho de nov/2026. Essas telas não
 * têm Figma: usam só o vocabulário que a Lauriane desenhou nas outras (cartão
 * branco de 15 px, pílulas de filtro, tabela de Notificações/Alarmes com o
 * cabeçalho em maiúsculas e as linhas verdes arredondadas).
 */

/** Botão principal na altura dos diálogos (40 px), ao lado do "Cancelar". */
export const classeDoBotaoPrincipalMenor = cn(classeDoBotaoPrincipal, 'h-10 px-5 text-sm');

/** Caixa de diálogo: fundo do cartão, cantos de 15 px, sem a borda escura antiga. */
export const classeDoDialogo = 'bg-card text-card-foreground border-border rounded-[15px]';

/** Campo de formulário dentro dos diálogos. */
export const classeDoCampo =
  'h-11 data-[size=default]:h-11 rounded-[10px] bg-card border-border text-foreground placeholder:text-muted-foreground';

/** Rótulo de campo: frase curta, sem as maiúsculas espaçadas do tema antigo. */
export const classeDoRotulo = 'text-sm font-medium text-foreground';

/** Pílula de filtro da barra de filtros (borda #666 e sombra), na altura da busca (43 px). */
export const classeDoFiltro = cn(
  classeDaPilula,
  'h-[43px] data-[size=default]:h-[43px] sm:w-[220px] px-[18px] text-sm'
);

/** Select pequeno em pílula (função do usuário na linha da tabela). */
export const classeDoSelectPequeno =
  'h-9 data-[size=default]:h-9 rounded-[25px] border-border bg-card text-sm text-foreground';

/** Botão de ícone redondo das linhas de tabela (editar, mais ações ⋮). */
export const classeDoBotaoDeIcone =
  'w-9 h-9 rounded-full inline-flex items-center justify-center text-foreground ' +
  'hover:bg-card transition-colors disabled:opacity-40 disabled:cursor-not-allowed ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

/** O mesmo botão de ícone, para excluir: sempre vermelho. */
export const classeDoBotaoDeIconePerigo =
  'w-9 h-9 rounded-full inline-flex items-center justify-center text-destructive ' +
  'hover:bg-card transition-colors disabled:opacity-40 disabled:cursor-not-allowed ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40';

/** Etiqueta em pílula das tabelas (como as de estado do Figma). */
export const classeDaEtiqueta =
  'inline-flex items-center gap-1.5 h-7 px-3 rounded-[25px] text-xs font-semibold whitespace-nowrap';

/*
 * Tabela de Notificações/Alarmes do Figma: cabeçalho em maiúsculas, sem fundo;
 * cada linha é uma faixa verde clara de cantos arredondados, com um respiro
 * entre elas. As mesmas medidas da tela de Alarmes.
 */

/** Cartão que leva a tabela (título de 20 px em cima). */
export const classeDoCartaoDaTabela = `${classeDoCartao} px-3 3xl:px-[13px] pt-5 pb-3`;

/** A tabela: linhas separadas por 10 px. */
export const classeDaTabela =
  'w-full text-left border-separate border-spacing-y-[10px] text-sm text-foreground';

/** Célula do cabeçalho. */
export const classeDoTh =
  'px-3 3xl:px-4 pb-1 text-left text-[13px] 3xl:text-[15px] font-semibold uppercase text-foreground whitespace-nowrap';

/** Célula das linhas verdes; a primeira e a última arredondam a linha. */
export const classeDoTd =
  'px-3 3xl:px-4 py-3 align-middle bg-primary/[0.14] first:rounded-l-[15px] last:rounded-r-[15px]';

/**
 * As mesmas linhas aplicadas na <tr>, para tabelas que não mexem em cada
 * célula (White Label e Atendimento, que têm PRs abertos).
 */
export const classeDaLinha =
  '[&>td]:px-3 3xl:[&>td]:px-4 [&>td]:bg-primary/[0.14] [&>td]:align-middle [&>td:first-child]:rounded-l-[15px] [&>td:last-child]:rounded-r-[15px]';

/** O cabeçalho aplicado na <tr> do <thead>, pelo mesmo motivo. */
export const classeDaLinhaDoCabecalho =
  '[&>th]:px-3 3xl:[&>th]:px-4 [&>th]:pb-1 [&>th]:pt-0 [&>th]:text-[13px] 3xl:[&>th]:text-[15px] [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-normal [&>th]:text-foreground [&>th]:whitespace-nowrap';

/** Título do cartão da tabela (20 px) com a contagem à direita. */
export function CabecalhoDoCartao({ titulo, detalhe }: { titulo: ReactNode; detalhe?: ReactNode }) {
  return (
    <div className="px-3 3xl:px-5 mb-1 flex flex-wrap items-baseline justify-between gap-3">
      <h2 className="text-[20px] leading-tight font-semibold text-foreground">{titulo}</h2>
      {detalhe && <p className="text-sm font-medium text-muted-foreground">{detalhe}</p>}
    </div>
  );
}

/** Lista ou tabela vazia: ícone apagado e o texto que a tela já tinha. */
export function EstadoVazio({
  icone,
  titulo,
  children,
}: {
  icone: ReactNode;
  titulo?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-2 px-6 py-14">
      <span className="text-muted-foreground/60" aria-hidden="true">
        {icone}
      </span>
      {titulo && <p className="text-[15px] font-medium text-foreground">{titulo}</p>}
      {children && <div className="text-sm text-muted-foreground max-w-md">{children}</div>}
    </div>
  );
}

/** Carregando a página pela primeira vez (depois disso, o "Atualizar" mostra o carregando). */
export function CarregandoPagina() {
  return (
    <div className="flex items-center justify-center h-64" role="status" aria-label="Carregando">
      <Loader2 className="w-8 h-8 animate-spin text-primary-strong" aria-hidden="true" />
    </div>
  );
}

/**
 * Confirmação de ação destrutiva: diz a consequência antes, o botão de
 * confirmar é vermelho e o "Cancelar" fica à mão.
 */
export function ConfirmarExclusao({
  aberto,
  aoMudar,
  titulo,
  children,
  rotuloDoBotao,
  carregando,
  aoConfirmar,
}: {
  aberto: boolean;
  aoMudar: (aberto: boolean) => void;
  titulo: string;
  /** A consequência, em frases curtas. */
  children: ReactNode;
  rotuloDoBotao: string;
  carregando: boolean;
  aoConfirmar: () => void;
}) {
  return (
    <AlertDialog open={aberto} onOpenChange={aoMudar}>
      <AlertDialogContent className={classeDoDialogo}>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[20px] font-semibold text-foreground">
            {titulo}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-[15px] text-muted-foreground space-y-2">{children}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-3">
          <button type="button" onClick={() => aoMudar(false)} className={classeDoBotaoContorno}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={aoConfirmar}
            disabled={carregando}
            className={classeDoBotaoPerigo}
          >
            {carregando ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            )}
            {carregando ? 'Aguarde…' : rotuloDoBotao}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
