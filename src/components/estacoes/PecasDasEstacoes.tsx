import type { InputHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ChartNoAxesColumn,
  Check,
  Construction,
  ExternalLink,
  LayoutGrid,
  Link2,
  List,
  Loader2,
  Map as IconeDeMapa,
  MoreHorizontal,
  QrCode,
  Search,
  Settings,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { EtiquetaDeEstado, classeDoBotaoContorno, type EstadoDaEtiqueta } from '../painel/Pecas';
import { IconeSvg } from '../painel/Icone';
import type { EstadoDoCarregador } from '../../lib/estadoDoCarregador';
import iconeCarregador from '../../assets/icones/estacoes-carregador.svg';

/*
 * Peças da tela de Estações, no desenho da Lauriane (Figma, Page 1, "Frame 10",
 * nov/2026): cartões de saúde da rede, filtros com chips de contagem, locais
 * com tabela de estações. O Frame está em cinza (wireframe); as cores e a
 * tipografia são as do redesenho (Visão geral, Locais). Atende também ao estudo
 * de usabilidade: estado com ícone e texto (H1), "Detalhes" como ação principal
 * e o resto no "…" (H8), exclusão em vermelho e com confirmação (H5), cabeçalho
 * do local com o resumo dos estados (H6).
 */

// ---------------------------------------------------------------------------
// Estados
// ---------------------------------------------------------------------------

/** Grupos dos chips do Frame 10: Online, Offline, Em manutenção, Indisponível. */
export type GrupoDeEstado = 'online' | 'offline' | 'manutencao' | 'indisponivel';

export interface DescricaoDoGrupo {
  id: GrupoDeEstado;
  rotulo: string;
  etiqueta: EstadoDaEtiqueta;
  /** O que entra no grupo (dica dos chips e das pílulas). */
  dica: string;
}

export const GRUPOS: DescricaoDoGrupo[] = [
  {
    id: 'online',
    rotulo: 'Online',
    etiqueta: 'livre',
    dica: 'Conectados e funcionando: disponíveis ou carregando',
  },
  {
    id: 'offline',
    rotulo: 'Offline',
    etiqueta: 'offline',
    dica: 'Já se conectaram e agora estão sem conexão',
  },
  {
    // "Em manutenção" é como o app chama o carregador fora de serviço (Unavailable).
    id: 'manutencao',
    rotulo: 'Em manutenção',
    etiqueta: 'instalacao',
    dica: 'Fora de serviço, ou em instalação (cadastrados e nunca conectados)',
  },
  {
    id: 'indisponivel',
    rotulo: 'Indisponível',
    etiqueta: 'problema',
    dica: 'Conectados, mas com falha no equipamento',
  },
];

export const GRUPO_DO_ESTADO: Record<EstadoDoCarregador, GrupoDeEstado> = {
  ativo: 'online',
  emUso: 'online',
  offline: 'offline',
  indisponivel: 'manutencao',
  instalacao: 'manutencao',
  falha: 'indisponivel',
};

// ?estado= da URL: os grupos e, para links antigos, os estados de antes.
const GRUPO_DA_URL: Record<string, GrupoDeEstado> = {
  online: 'online',
  livre: 'online',
  uso: 'online',
  offline: 'offline',
  manutencao: 'manutencao',
  instalacao: 'manutencao',
  indisponivel: 'indisponivel',
  problema: 'indisponivel',
};

export const grupoDaUrl = (valor: string | null): GrupoDeEstado | null =>
  (valor && GRUPO_DA_URL[valor]) || null;

export const rotuloDoGrupo = (g: GrupoDeEstado) => GRUPOS.find(x => x.id === g)!.rotulo;

export function contarGrupos(estados: EstadoDoCarregador[]): Record<GrupoDeEstado, number> {
  const c: Record<GrupoDeEstado, number> = {
    online: 0,
    offline: 0,
    manutencao: 0,
    indisponivel: 0,
  };
  for (const e of estados) c[GRUPO_DO_ESTADO[e]] += 1;
  return c;
}

/** Etiqueta de cada carregador: o estado exato, com ícone e texto. */
const ETIQUETA_DO_CARREGADOR: Record<
  EstadoDoCarregador,
  { estado: EstadoDaEtiqueta; rotulo: string }
> = {
  ativo: { estado: 'livre', rotulo: 'Disponível' },
  emUso: { estado: 'uso', rotulo: 'Carregando' },
  offline: { estado: 'offline', rotulo: 'Offline' },
  indisponivel: { estado: 'instalacao', rotulo: 'Em manutenção' },
  instalacao: { estado: 'instalacao', rotulo: 'Em instalação' },
  falha: { estado: 'problema', rotulo: 'Com falha' },
};

export function EstadoDoCarregadorNaTabela({ estado }: { estado: EstadoDoCarregador }) {
  const e = ETIQUETA_DO_CARREGADOR[estado];
  return <EtiquetaDeEstado estado={e.estado}>{e.rotulo}</EtiquetaDeEstado>;
}

export const ICONE_DO_GRUPO: Record<GrupoDeEstado, ReactNode> = {
  online: <Wifi className="w-4 h-4" />,
  offline: <WifiOff className="w-4 h-4" />,
  manutencao: <Construction className="w-4 h-4" />,
  indisponivel: <AlertTriangle className="w-4 h-4" />,
};

/**
 * Pílulas do cabeçalho do local ("12 Online", "12 Offline", "12 Em
 * manutenção"). As três do Frame aparecem sempre, mesmo zeradas, para cada
 * local ter a mesma legenda; "Indisponível" só quando há.
 */
export function ResumoDoLocal({ contagem }: { contagem: Record<GrupoDeEstado, number> }) {
  return (
    <>
      {GRUPOS.filter(g => g.id !== 'indisponivel' || contagem.indisponivel > 0).map(g =>
        contagem[g.id] > 0 ? (
          <span key={g.id} title={g.dica}>
            <EtiquetaDeEstado estado={g.etiqueta}>
              {contagem[g.id]} {g.rotulo}
            </EtiquetaDeEstado>
          </span>
        ) : (
          <span
            key={g.id}
            title={g.dica}
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-[25px] text-xs font-semibold whitespace-nowrap border border-border text-muted-foreground"
          >
            <span aria-hidden="true">{ICONE_DO_GRUPO[g.id]}</span>0 {g.rotulo}
          </span>
        )
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

/** "60 kW", "7,4 kW". A API manda a potência como texto ("60.00"). */
export const formatarPotencia = (kw: number | string) =>
  `${Number(kw).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kW`;

/** "62,8%". */
export const formatarPercentual = (fracao: number) =>
  `${(fracao * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

/**
 * AC ou DC. A API não tem o tipo de corrente: sai do conector (Type 1/2 = AC;
 * CCS e CHAdeMO = DC) e, no GB/T ou sem conector, da potência (acima de 22 kW
 * só em DC).
 */
export function tipoDeCorrente(c: {
  connector_type?: string | null;
  power_kw?: number | string | null;
}): 'AC' | 'DC' | null {
  const conector = (c.connector_type || '').toLowerCase().replace(/\s/g, '');
  if (/^(type|tipo)[12]$/.test(conector)) return 'AC';
  if (conector.startsWith('ccs') || conector.includes('chademo')) return 'DC';
  const kw = Number(c.power_kw);
  if (kw > 0) return kw > 22 ? 'DC' : 'AC';
  return null;
}

/** "Há 2 min", "Há 3 h", "Há 5 dias" ou a data. */
export function haQuanto(data: Date, agora: Date): string {
  const minutos = Math.floor((agora.getTime() - data.getTime()) / 60000);
  if (minutos < 1) return 'Agora mesmo';
  if (minutos < 60) return `Há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Há ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 30) return `Há ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  return data.toLocaleDateString('pt-BR');
}

// ---------------------------------------------------------------------------
// Cartões do topo
// ---------------------------------------------------------------------------

/** Barra de progresso dos cartões (Frame 10: barra arredondada com contorno). */
export function BarraDeProgresso({
  fracao,
  cor,
  rotulo,
}: {
  fracao: number;
  cor: string;
  rotulo: string;
}) {
  const pct = Math.min(100, Math.max(0, fracao * 100));
  return (
    <div
      role="progressbar"
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className="h-3.5 w-full rounded-full border border-border bg-muted overflow-hidden"
    >
      <div className={`h-full rounded-full ${cor}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Quadrado do ícone dos cartões, com o fundo do estado (cor fixa). */
export function IconeDoCartao({ classe, children }: { classe: string; children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className={`${classe} w-[41px] h-[38px] rounded-[5px] flex items-center justify-center shrink-0`}
    >
      {children}
    </span>
  );
}

/** Cartões "Estações", "Online" e "Offline": título, número, legenda e barra. */
export function CartaoDeNumero({
  icone,
  titulo,
  valor,
  legenda,
  fracao,
  corDaBarra = 'bg-primary',
}: {
  icone: ReactNode;
  titulo: string;
  valor: ReactNode;
  legenda: string;
  /** Sem fração, sem barra (o cartão "Estações" do Frame não tem). */
  fracao?: number;
  corDaBarra?: string;
}) {
  return (
    <section
      className="bg-card text-card-foreground rounded-[15px] shadow-cartao p-[22px] min-h-[200px] flex flex-col"
      aria-label={titulo}
    >
      <div className="flex items-center gap-[14px] min-w-0">
        {icone}
        <h2 className="text-[20px] leading-tight font-semibold text-foreground truncate">
          {titulo}
        </h2>
      </div>
      <div className="mt-auto pt-4 space-y-2">
        <p className="text-[clamp(1.75rem,2.1vw,2.5rem)] leading-none font-semibold tabular-nums text-foreground">
          {valor}
        </p>
        <p className="text-sm font-medium text-foreground">{legenda}</p>
        {fracao !== undefined ? (
          <BarraDeProgresso fracao={fracao} cor={corDaBarra} rotulo={`${titulo}: ${legenda}`} />
        ) : (
          // Sem barra, o espaço dela fica: os números dos quatro cartões se alinham.
          <div aria-hidden="true" className="h-3.5" />
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------

// Caixas da primeira linha do cartão de filtros (Frame 10): mesma altura,
// cantos de 15 px, contorno cinza (verde no escuro), como as pílulas do redesenho.
const classeDaCaixa =
  'h-[55px] rounded-[15px] border border-[#666] dark:border-primary bg-card shadow-pilula';

/** Busca do cartão de filtros, da altura dos seletores ao lado. */
export function BuscaDasEstacoes({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
  return (
    <label className={`relative block ${className}`}>
      <Search
        aria-hidden="true"
        className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"
      />
      <input
        type="search"
        {...props}
        className={`${classeDaCaixa} w-full pl-12 pr-4 text-[15px] font-medium text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20`}
      />
    </label>
  );
}

export interface OpcaoDoSeletor {
  valor: string;
  rotulo: string;
}

/** Seletor do Frame 10: rótulo pequeno em cima ("Estado") e o valor embaixo ("Todos"). */
export function SeletorComRotulo({
  rotulo,
  valor,
  opcoes,
  aoMudar,
  className = '',
}: {
  rotulo: string;
  valor: string;
  opcoes: OpcaoDoSeletor[];
  aoMudar: (valor: string) => void;
  className?: string;
}) {
  return (
    <Select value={valor} onValueChange={aoMudar}>
      <SelectTrigger
        aria-label={rotulo}
        className={`${classeDaCaixa} data-[size=default]:h-[55px] px-4 gap-3 text-left hover:bg-muted/40 ${className}`}
      >
        <span className="flex flex-col items-start min-w-0 leading-tight">
          <span className="text-xs font-medium text-muted-foreground">{rotulo}</span>
          <span className="text-sm font-semibold text-foreground truncate max-w-full">
            <SelectValue />
          </span>
        </span>
      </SelectTrigger>
      <SelectContent className="bg-popover border-border">
        {opcoes.map(o => (
          <SelectItem key={o.valor} value={o.valor}>
            {o.rotulo}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Caixa "Limpar filtros" da primeira linha. */
export function BotaoLimparFiltros({
  aoLimpar,
  ativo,
  icone,
  className = '',
}: {
  aoLimpar: () => void;
  ativo: boolean;
  icone: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={aoLimpar}
      disabled={!ativo}
      className={`${classeDaCaixa} px-4 inline-flex items-center justify-center gap-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {icone}
      Limpar filtros
    </button>
  );
}

// Pílula de duas partes do Frame 10 (chips e "Ordenar por"): a parte da
// esquerda é uma pílula própria, encostada na de fora.
const classeDaPilulaDupla =
  'h-11 inline-flex items-stretch rounded-[25px] border text-sm font-medium whitespace-nowrap transition';
const classeDaParteEsquerda = 'inline-flex items-center gap-2 rounded-[25px] border -m-px px-4';

/** Chip com contagem ("Online | 13"); marcado em verde, como o ChipDeFiltro. */
export function ChipComContagem({
  ativo,
  aoClicar,
  icone,
  rotulo,
  contagem,
  dica,
}: {
  ativo: boolean;
  aoClicar: () => void;
  icone: ReactNode;
  rotulo: string;
  contagem: number;
  dica?: string;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-pressed={ativo}
      title={dica}
      className={`${classeDaPilulaDupla} ${
        ativo
          ? 'bg-primary border-primary text-primary-foreground shadow-pilula'
          : 'bg-card border-foreground/70 dark:border-border text-foreground hover:bg-muted'
      }`}
    >
      <span
        className={`${classeDaParteEsquerda} ${
          ativo ? 'border-primary-foreground/50' : 'border-foreground/70 dark:border-border'
        }`}
      >
        <span aria-hidden="true">{icone}</span>
        {rotulo}
      </span>
      <span className="inline-flex items-center pl-3 pr-4 text-[15px] font-bold tabular-nums">
        {contagem}
      </span>
    </button>
  );
}

/** "Ordenar por | Nome A-Z". */
export function OrdenarPor({
  valor,
  opcoes,
  aoMudar,
}: {
  valor: string;
  opcoes: OpcaoDoSeletor[];
  aoMudar: (valor: string) => void;
}) {
  return (
    <div
      className={`${classeDaPilulaDupla} bg-card border-foreground/70 dark:border-border text-foreground`}
    >
      <span className={`${classeDaParteEsquerda} border-foreground/70 dark:border-border`}>
        Ordenar por
      </span>
      <Select value={valor} onValueChange={aoMudar}>
        <SelectTrigger
          aria-label="Ordenar por"
          className="h-full data-[size=default]:h-full border-0 shadow-none bg-transparent rounded-[25px] pl-3 pr-4 gap-2 text-sm font-medium text-foreground focus-visible:ring-2"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end" className="bg-popover border-border">
          {opcoes.map(o => (
            <SelectItem key={o.valor} value={o.valor}>
              {o.rotulo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Linha de exibição: "Expandir todos", "Ver no mapa", lista/grade
// ---------------------------------------------------------------------------

const classeDoBotaoDeExibicao =
  'h-11 px-4 rounded-[25px] border text-sm font-medium inline-flex items-center gap-2 transition';

/** "Expandir todos": marcado quando todos os locais estão abertos. */
export function BotaoExpandirTodos({
  marcado,
  aoAlternar,
}: {
  marcado: boolean;
  aoAlternar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoAlternar}
      aria-pressed={marcado}
      title={marcado ? 'Recolher todos os locais' : 'Expandir todos os locais'}
      className={`${classeDoBotaoDeExibicao} ${
        marcado
          ? 'bg-primary-soft border-primary text-primary-strong'
          : 'bg-card border-foreground/70 dark:border-border text-foreground hover:bg-muted'
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-5 rounded-[5px] border flex items-center justify-center ${
          marcado ? 'bg-primary border-primary text-primary-foreground' : 'border-current'
        }`}
      >
        {marcado && <Check className="w-3.5 h-3.5" />}
      </span>
      Expandir todos
    </button>
  );
}

/** "Ver no mapa": o mapa dos locais fica na página Locais. */
export function BotaoVerNoMapa() {
  return (
    <Link
      to="/locais"
      title="Abrir o mapa dos locais"
      className={`${classeDoBotaoDeExibicao} bg-card border-foreground/70 dark:border-border text-foreground hover:bg-muted`}
    >
      <IconeDeMapa aria-hidden="true" className="w-5 h-5" />
      Ver no mapa
    </Link>
  );
}

export type ModoDeExibicao = 'lista' | 'grade';

/** Alternância lista/grade do Frame 10. */
export function AlternarExibicao({
  modo,
  aoMudar,
}: {
  modo: ModoDeExibicao;
  aoMudar: (m: ModoDeExibicao) => void;
}) {
  const botao = (m: ModoDeExibicao, rotulo: string, icone: ReactNode) => (
    <button
      type="button"
      onClick={() => aoMudar(m)}
      aria-pressed={modo === m}
      aria-label={rotulo}
      title={rotulo}
      className={`w-14 -m-px rounded-[25px] inline-flex items-center justify-center border transition ${
        modo === m
          ? 'bg-primary-soft border-primary text-primary-strong'
          : 'border-transparent text-foreground hover:bg-muted'
      }`}
    >
      {icone}
    </button>
  );
  return (
    <div
      role="group"
      aria-label="Modo de exibição"
      className="h-11 inline-flex items-stretch rounded-[25px] border border-foreground/70 dark:border-border bg-card"
    >
      {botao('lista', 'Ver em lista', <List aria-hidden="true" className="w-5 h-5" />)}
      {botao('grade', 'Ver em grade', <LayoutGrid aria-hidden="true" className="w-5 h-5" />)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Estação (linha da tabela e cartão da grade)
// ---------------------------------------------------------------------------

export interface EstacaoNaTela {
  charge_point_id: string;
  description?: string;
  model?: string;
  vendor?: string;
  /** Vem como texto do banco ("60.00"), apesar do tipo. */
  power_kw?: number | string;
  connector_type?: string;
  last_seen?: string | null;
  connection_url?: string;
}

interface AcoesDaEstacaoProps {
  gerandoQr: boolean;
  aoVerDetalhes: () => void;
  aoVerAtividade: () => void;
  aoEditar: () => void;
  aoBaixarQr: () => void;
  aoCopiarLink: (url: string) => void;
  /** Só admin exclui (a API recusa o resto): sem a função, o item não aparece. */
  aoExcluir?: () => void;
}

const classeDoBotaoDeIcone =
  'h-10 w-10 shrink-0 rounded-[25px] border border-foreground/70 dark:border-primary bg-card text-foreground dark:text-primary-strong ' +
  'inline-flex items-center justify-center hover:bg-muted transition data-[state=open]:bg-muted disabled:opacity-50';

const classeDoMenu = 'min-w-[260px] rounded-[15px] border-border p-2 shadow-cartao';
const classeDoItemDoMenu =
  'rounded-[10px] px-3 py-2.5 text-sm font-medium gap-3 cursor-pointer [&_svg]:size-[18px]';
/**
 * Item de exclusão: vermelho, depois de um separador. O vermelho do tema
 * (#ff7351) fica claro demais para texto sobre branco; este passa no contraste
 * nos dois temas.
 */
const classeDoItemPerigo =
  `${classeDoItemDoMenu} font-semibold text-red-600 dark:text-red-400 focus:bg-red-50 focus:text-red-700 ` +
  'dark:focus:bg-red-500/15 dark:focus:text-red-300';

/** Ações do Frame 10: "Detalhes", atividade (gráfico), configurações e "…". */
export function AcoesDaEstacao({
  nome,
  connectionUrl,
  gerandoQr,
  aoVerDetalhes,
  aoVerAtividade,
  aoEditar,
  aoBaixarQr,
  aoCopiarLink,
  aoExcluir,
}: AcoesDaEstacaoProps & { nome: string; connectionUrl?: string }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <button type="button" onClick={aoVerDetalhes} className={classeDoBotaoContorno}>
        Detalhes
      </button>
      <button
        type="button"
        onClick={aoVerAtividade}
        className={classeDoBotaoDeIcone}
        aria-label={`Atividade de ${nome}: logs OCPP e de conexão`}
        title="Atividade: logs OCPP e de conexão"
      >
        <ChartNoAxesColumn aria-hidden="true" className="w-5 h-5" />
      </button>
      <button
        type="button"
        onClick={aoEditar}
        className={classeDoBotaoDeIcone}
        aria-label={`Configurar ${nome}: editar nome, conector e potência`}
        title="Configurar: editar nome, conector e potência"
      >
        <Settings aria-hidden="true" className="w-5 h-5" />
      </button>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          className={classeDoBotaoDeIcone}
          aria-label={`Mais ações de ${nome}`}
          title="Mais ações"
        >
          {gerandoQr ? (
            <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" />
          ) : (
            <MoreHorizontal aria-hidden="true" className="w-5 h-5" />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={classeDoMenu}>
          <DropdownMenuLabel className="px-3 pt-1 pb-2 text-xs font-medium text-muted-foreground truncate max-w-[280px]">
            {nome}
          </DropdownMenuLabel>
          <DropdownMenuItem
            className={classeDoItemDoMenu}
            onSelect={aoBaixarQr}
            disabled={gerandoQr}
          >
            <QrCode aria-hidden="true" />
            {gerandoQr ? 'Gerando QR Code…' : 'Baixar QR Code (PDF)'}
          </DropdownMenuItem>
          {connectionUrl && (
            <DropdownMenuItem
              className={classeDoItemDoMenu}
              onSelect={() => aoCopiarLink(connectionUrl)}
            >
              <Link2 aria-hidden="true" />
              Copiar link do servidor
            </DropdownMenuItem>
          )}
          {aoExcluir && (
            <>
              <DropdownMenuSeparator className="my-2" />
              <DropdownMenuItem className={classeDoItemPerigo} onSelect={aoExcluir}>
                <Trash2 aria-hidden="true" className="text-current" />
                Excluir carregador
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Nome, ID e o equipamento (no lugar do sub-local do Frame, que a API não tem). */
function IdentificacaoDaEstacao({ e }: { e: EstacaoNaTela }) {
  const nome = e.description || e.charge_point_id;
  const equipamento = [e.vendor, e.model].filter(Boolean).join(' ');
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span className="text-muted-foreground shrink-0">
        <IconeSvg src={iconeCarregador} tamanho={28} altura={35} />
      </span>
      <div className="min-w-0">
        <p className="text-base font-semibold text-foreground truncate" title={nome}>
          {nome}
        </p>
        <p className="text-[13px] text-muted-foreground truncate">
          {e.description && <span className="font-mono">{e.charge_point_id}</span>}
          {e.description && equipamento && <span className="inline-block w-4" />}
          {equipamento}
        </p>
      </div>
    </div>
  );
}

function UltimaAtividade({ lastSeen, agora }: { lastSeen?: string | null; agora: Date }) {
  const data = lastSeen ? new Date(lastSeen) : null;
  if (!data || Number.isNaN(data.getTime()))
    return <span className="text-muted-foreground">Nunca conectou</span>;
  return (
    <time dateTime={data.toISOString()} title={data.toLocaleString('pt-BR')}>
      {haQuanto(data, agora)}
    </time>
  );
}

const Potencia = ({ kw }: { kw?: number | string }) =>
  Number(kw) > 0 ? (
    <>{formatarPotencia(kw!)}</>
  ) : (
    <span className="text-muted-foreground font-medium">—</span>
  );

export interface PropsDaEstacao extends AcoesDaEstacaoProps {
  estacao: EstacaoNaTela;
  estado: EstadoDoCarregador;
  agora: Date;
  selecionada: boolean;
  aoSelecionar: (marcada: boolean) => void;
}

const classeDaCaixaDeSelecao = 'size-5 rounded-[5px] border-foreground/60 bg-card';

/** Cabeçalho da tabela de estações de um local (com a caixa "selecionar todas"). */
export function CabecalhoDaTabela({
  selecao,
  aoSelecionarTodas,
}: {
  selecao: boolean | 'indeterminate';
  aoSelecionarTodas: (marcada: boolean) => void;
}) {
  return (
    <>
      {/* Larguras fixas: em 1366 px a coluna de ações saía do cartão. No largo
          (3xl), as proporções do Frame 10. */}
      <colgroup>
        <col className="w-14" />
        <col />
        <col className="w-[150px] 3xl:w-[12%]" />
        <col className="w-[64px] 3xl:w-[8%]" />
        <col className="w-[96px] 3xl:w-[10%]" />
        <col className="w-[150px] 3xl:w-[15%]" />
        <col className="w-[275px] 3xl:w-[24%]" />
      </colgroup>
      <thead>
        <tr className="text-xs font-semibold uppercase tracking-wide text-muted-foreground bg-muted/60">
          <th className="w-14 pl-6 pr-2 py-3">
            <Checkbox
              checked={selecao}
              onCheckedChange={v => aoSelecionarTodas(v === true)}
              aria-label="Selecionar todas as estações deste local"
              className={classeDaCaixaDeSelecao}
            />
          </th>
          <th className="px-3 py-3 font-semibold">Estação / identificador</th>
          <th className="px-3 py-3 font-semibold">Status</th>
          <th className="px-3 py-3 font-semibold">Tipo</th>
          <th className="px-3 py-3 font-semibold">Potência</th>
          <th className="px-3 py-3 font-semibold whitespace-nowrap">Última atividade</th>
          <th className="pl-3 pr-6 py-3 font-semibold text-right">Ações</th>
        </tr>
      </thead>
    </>
  );
}

/** Linha da tabela do Frame 10. */
export function LinhaDaEstacao({
  estacao: e,
  estado,
  agora,
  selecionada,
  aoSelecionar,
  ...acoes
}: PropsDaEstacao) {
  const nome = e.description || e.charge_point_id;
  return (
    <tr className="even:bg-muted/40 hover:bg-muted/60 transition-colors">
      <td className="pl-6 pr-2 py-4">
        <Checkbox
          checked={selecionada}
          onCheckedChange={v => aoSelecionar(v === true)}
          aria-label={`Selecionar ${nome}`}
          className={classeDaCaixaDeSelecao}
        />
      </td>
      <td className="px-3 py-4">
        <IdentificacaoDaEstacao e={e} />
      </td>
      <td className="px-3 py-4">
        <EstadoDoCarregadorNaTabela estado={estado} />
      </td>
      <td className="px-3 py-4 text-[15px] font-medium text-foreground">
        {tipoDeCorrente(e) ?? <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-3 py-4 text-[15px] font-semibold text-foreground tabular-nums whitespace-nowrap">
        <Potencia kw={e.power_kw} />
      </td>
      <td className="px-3 py-4 text-[15px] text-foreground whitespace-nowrap">
        <UltimaAtividade lastSeen={e.last_seen} agora={agora} />
      </td>
      <td className="pl-3 pr-6 py-4">
        <AcoesDaEstacao nome={nome} connectionUrl={e.connection_url} {...acoes} />
      </td>
    </tr>
  );
}

/** Cartão da exibição em grade: os mesmos dados e ações da linha. */
export function CartaoDaEstacao({
  estacao: e,
  estado,
  agora,
  selecionada,
  aoSelecionar,
  ...acoes
}: PropsDaEstacao) {
  const nome = e.description || e.charge_point_id;
  const tipo = tipoDeCorrente(e);
  return (
    <li className="rounded-[15px] border border-border bg-card p-4 flex flex-col gap-3 min-w-0">
      <div className="flex items-start gap-3 min-w-0">
        <Checkbox
          checked={selecionada}
          onCheckedChange={v => aoSelecionar(v === true)}
          aria-label={`Selecionar ${nome}`}
          className={`mt-1 ${classeDaCaixaDeSelecao}`}
        />
        <div className="min-w-0 flex-1">
          <IdentificacaoDaEstacao e={e} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[15px] text-foreground">
        <EstadoDoCarregadorNaTabela estado={estado} />
        {tipo && <span className="font-medium">{tipo}</span>}
        <span className="font-semibold tabular-nums">
          <Potencia kw={e.power_kw} />
        </span>
      </div>
      <p className="text-[13px] text-muted-foreground">
        Última atividade:{' '}
        <span className="text-foreground">
          <UltimaAtividade lastSeen={e.last_seen} agora={agora} />
        </span>
      </p>
      <div className="mt-auto pt-1">
        <AcoesDaEstacao nome={nome} connectionUrl={e.connection_url} {...acoes} />
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Local
// ---------------------------------------------------------------------------

/**
 * "…" do cabeçalho do local: abrir a página do local e, separado, excluir. Não
 * está no Frame 10; fica aqui porque a exclusão do local precisava sair do
 * rodapé do cartão (estudo, H5) e não tem outro lugar no desenho.
 */
export function MenuDoLocal({
  id,
  nome,
  aoExcluir,
}: {
  id: number;
  nome: string;
  /** Só admin exclui: sem a função, o item não aparece. */
  aoExcluir?: () => void;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className={classeDoBotaoDeIcone}
        aria-label={`Mais ações do local ${nome}`}
        title="Mais ações do local"
      >
        <MoreHorizontal aria-hidden="true" className="w-5 h-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={classeDoMenu}>
        <DropdownMenuLabel className="px-3 pt-1 pb-2 text-xs font-medium text-muted-foreground truncate max-w-[280px]">
          {nome}
        </DropdownMenuLabel>
        <DropdownMenuItem asChild className={classeDoItemDoMenu}>
          <Link to={`/locais/${id}`}>
            <ExternalLink aria-hidden="true" />
            Abrir página do local
          </Link>
        </DropdownMenuItem>
        {aoExcluir && (
          <>
            <DropdownMenuSeparator className="my-2" />
            <DropdownMenuItem className={classeDoItemPerigo} onSelect={aoExcluir}>
              <Trash2 aria-hidden="true" className="text-current" />
              Excluir local
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Confirmação de exclusão
// ---------------------------------------------------------------------------

export interface PedidoDeExclusao {
  titulo: string;
  /** O que acontece: o estudo (H5) pede que a confirmação diga a consequência. */
  consequencia: ReactNode;
  /** Aviso extra (ex.: o local ainda tem carregadores). */
  aviso?: ReactNode;
  rotuloDoBotao: string;
  aoConfirmar: () => void;
}

/** Confirmação de exclusão: botão vermelho e o "Cancelar" com o foco. */
export function ConfirmarExclusao({
  pedido,
  aoFechar,
}: {
  pedido: PedidoDeExclusao | null;
  aoFechar: () => void;
}) {
  return (
    <AlertDialog
      open={!!pedido}
      onOpenChange={aberto => {
        if (!aberto) aoFechar();
      }}
    >
      <AlertDialogContent className="bg-card text-card-foreground border-0 rounded-[15px] shadow-cartao sm:max-w-[520px] p-7">
        {pedido && (
          <>
            <AlertDialogHeader className="gap-3">
              <AlertDialogTitle className="flex items-center gap-3 text-[20px] font-semibold text-foreground">
                <span
                  aria-hidden="true"
                  className="w-10 h-10 rounded-[5px] bg-red-600/10 text-red-600 dark:text-red-400 inline-flex items-center justify-center shrink-0"
                >
                  <Trash2 className="w-5 h-5" />
                </span>
                {pedido.titulo}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[15px] leading-relaxed text-foreground">
                {pedido.consequencia}
              </AlertDialogDescription>
              {pedido.aviso && (
                <div className="rounded-[10px] bg-estado-problema text-estado-problema-forte px-4 py-3 text-sm font-medium">
                  {pedido.aviso}
                </div>
              )}
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-3 pt-2">
              <AlertDialogCancel className="h-10 px-5 rounded-[25px] border-foreground/70 bg-card text-foreground text-sm font-medium hover:bg-muted">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={pedido.aoConfirmar}
                className="h-10 px-5 rounded-[25px] bg-red-600 hover:bg-red-700 text-white text-sm font-semibold"
              >
                {pedido.rotuloDoBotao}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
