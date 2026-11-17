import type { InputHTMLAttributes, ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Construction, Search, WifiOff, Zap } from 'lucide-react';

/*
 * Peças pequenas do redesenho (Figma da Lauriane, nov/2026), comuns a todas as
 * telas: botões em pílula, campo de busca, chip de filtro, cabeçalho de tabela
 * e a etiqueta de estado do carregador. As peças de página (cartão, cabeçalho,
 * abas, contador, Atualizar) ficam em ./Pagina.tsx.
 */

/** Botão principal: pílula na cor da marca (o "Atualizar" e o "Novo local" do Figma). */
export const classeDoBotaoPrincipal =
  'h-12 px-6 rounded-[25px] bg-primary text-primary-foreground text-[15px] font-medium inline-flex items-center justify-center gap-2 ' +
  'hover:brightness-105 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed';

/** Botão secundário: pílula cinza (os "Ir para…" do Figma). */
export const classeDoBotaoSecundario =
  'h-12 px-6 rounded-[25px] bg-[#d9d9d9] dark:bg-muted text-foreground text-[15px] font-medium inline-flex items-center justify-center gap-2 ' +
  'hover:brightness-95 transition disabled:opacity-50 disabled:cursor-not-allowed';

/** Botão de contorno: pílula branca com borda (o "Detalhes" e o "Ver no mapa" do Figma). */
export const classeDoBotaoContorno =
  'h-10 px-5 rounded-[25px] border border-foreground/70 dark:border-primary bg-card text-foreground dark:text-primary-strong text-sm font-medium ' +
  'inline-flex items-center justify-center gap-2 hover:bg-muted transition disabled:opacity-50 disabled:cursor-not-allowed';

/** Botão de ação destrutiva (excluir): texto e contorno vermelhos, nunca verde. */
export const classeDoBotaoPerigo =
  'h-10 px-5 rounded-[25px] border border-destructive/60 bg-card text-destructive text-sm font-medium ' +
  'inline-flex items-center justify-center gap-2 hover:bg-destructive/10 transition disabled:opacity-50';

/** Cabeçalho de tabela do redesenho: maiúsculas pequenas, cinza, sobre fundo suave. */
export const classeDoCabecalhoDaTabela =
  'text-xs font-semibold uppercase tracking-wide text-muted-foreground bg-muted/60';

/** Campo de busca em pílula, com a lupa (barra de filtros de Locais, Notificações, Câmeras). */
export function CampoDeBusca({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
  return (
    <label className={`relative block w-full sm:max-w-[451px] ${className}`}>
      <Search
        aria-hidden="true"
        className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"
      />
      <input
        type="search"
        placeholder="Pesquisar"
        {...props}
        className="w-full h-[43px] rounded-[25px] border border-foreground/80 dark:border-border bg-card pl-12 pr-4 text-[15px] font-medium text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}

/** Chip de filtro em pílula ("Todas (53)", "Problema (3)"): marcado em verde. */
export function ChipDeFiltro({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`h-[43px] px-5 rounded-[25px] border text-[15px] font-medium whitespace-nowrap transition ${
        ativo
          ? 'bg-primary border-primary text-primary-foreground shadow-pilula'
          : 'bg-card border-foreground/70 dark:border-border text-foreground hover:bg-muted'
      }`}
    >
      {children}
    </button>
  );
}

/** Barra de filtros do Figma: cartão branco largo com a busca e os chips. */
export function BarraDeFiltros({ children }: { children: ReactNode }) {
  return (
    <div className="bg-card rounded-[15px] shadow-cartao px-4 py-4 flex flex-wrap items-center gap-3">
      {children}
    </div>
  );
}

export type EstadoDaEtiqueta = 'livre' | 'uso' | 'offline' | 'problema' | 'instalacao';

const ESTILO_DO_ESTADO: Record<EstadoDaEtiqueta, { classe: string; icone: ReactNode }> = {
  livre: {
    classe: 'bg-estado-livre text-estado-livre-forte',
    icone: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  uso: { classe: 'bg-estado-uso text-estado-uso-forte', icone: <Zap className="w-3.5 h-3.5" /> },
  offline: {
    classe: 'bg-estado-offline text-estado-offline-forte',
    icone: <WifiOff className="w-3.5 h-3.5" />,
  },
  problema: {
    classe: 'bg-estado-problema text-estado-problema-forte',
    icone: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  instalacao: {
    classe: 'bg-muted text-muted-foreground',
    icone: <Construction className="w-3.5 h-3.5" />,
  },
};

/**
 * Etiqueta de estado do carregador com ícone e texto (estudo de usabilidade,
 * H1: o estado não pode depender só da cor). Cores fixas de estado, não da marca.
 */
export function EtiquetaDeEstado({
  estado,
  children,
}: {
  estado: EstadoDaEtiqueta;
  children: ReactNode;
}) {
  const e = ESTILO_DO_ESTADO[estado];
  return (
    <span
      className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-[25px] text-xs font-semibold whitespace-nowrap ${e.classe}`}
    >
      <span aria-hidden="true">{e.icone}</span>
      {children}
    </span>
  );
}
