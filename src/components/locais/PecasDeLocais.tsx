import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { classeDoCartao } from '../painel/Pagina';
import { classeDoBotaoContorno } from '../painel/Pecas';
import { IconeSvg } from '../painel/Icone';
import { cn } from '../ui/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import type { EstadoDoCarregador } from '../../lib/estadoDoCarregador';
import iconePino from '../../assets/icones/locais-pino.svg';
import iconeAbrir from '../../assets/icones/locais-abrir.svg';
import iconeCarregador from '../../assets/icones/locais-carregador.svg';
import iconeDisponivel from '../../assets/icones/locais-disponivel.svg';
import iconeRaio from '../../assets/icones/locais-raio.svg';
import iconeAlerta from '../../assets/icones/locais-alerta.svg';
import iconeSemConexao from '../../assets/icones/locais-sem-conexao.svg';
import iconeSeta from '../../assets/icones/locais-seta.svg';
import iconeGrade from '../../assets/icones/locais-modo-grade.svg';
import iconeLista from '../../assets/icones/locais-modo-lista.svg';
import iconeCartaoCarregador from '../../assets/icones/locais-cartao-carregador.svg';
import iconeCartaoOcupacao from '../../assets/icones/locais-cartao-ocupacao.svg';

/*
 * Peças da tela de Locais (Figma da Lauriane, nov/2026, frames 182:4680 e
 * 185:524 com os elementos soltos por cima deles): contador do topo, chips com
 * seta, legenda do mapa, "Local selecionado", seletor grade/lista e o cartão
 * de cada local na aba "Locais registrados".
 */

export interface LocalResumo {
  id: number;
  nomeDoLocal: string;
  endereco: string;
  numero?: string;
  cidade: string;
  /** UF do endereço (não é o estado do carregador). */
  estado: string;
  latitude: number;
  longitude: number;
  imageUrl?: string;
}

export interface ResumoDoLocal {
  /** Carregadores cadastrados no local. */
  total: number;
  /** Conectados e livres. */
  ativos: number;
  /** Carregando agora. */
  emUso: number;
  /** Já se conectaram alguma vez (os em instalação ficam de fora). */
  instalados: number;
  /** Estado que o local mostra: o mais relevante dos seus carregadores. */
  estado: EstadoDoCarregador;
}

/** Linha 1: rua e número; linha 2: cidade e UF. */
export function enderecoDoLocal(loc: LocalResumo): [string, string] {
  const rua = `${loc.endereco || ''}${loc.numero ? `, ${loc.numero}` : ''}`;
  const cidade = `${loc.cidade || ''}${loc.estado ? ` - ${loc.estado}` : ''}`;
  return [rua, cidade];
}

export const temCoordenadas = (loc: LocalResumo) => !!(loc.latitude && loc.longitude);

/** Ocupação = carregadores em uso ÷ instalados (null quando nenhum foi instalado). */
export function ocupacaoDoLocal(r: ResumoDoLocal): number | null {
  return r.instalados > 0 ? Math.round((r.emUso / r.instalados) * 100) : null;
}

/**
 * Estado operacional do local, o mesmo dos chips "Filtrar por status":
 * carregando ou livre = operacional; com falha ou indisponível = problema.
 */
export type GrupoDoLocal = 'operacional' | 'problema' | 'offline' | 'instalacao' | 'vazio';

export function grupoDoLocal(r: ResumoDoLocal): GrupoDoLocal {
  if (r.total === 0) return 'vazio';
  if (r.estado === 'ativo' || r.estado === 'emUso') return 'operacional';
  if (r.estado === 'falha' || r.estado === 'indisponivel') return 'problema';
  return r.estado === 'offline' ? 'offline' : 'instalacao';
}

const TEXTO_DO_GRUPO: Record<GrupoDoLocal, string> = {
  operacional: 'Operacional',
  problema: 'Problema',
  offline: 'Offline',
  instalacao: 'Em instalação',
  vazio: 'Sem carregador',
};

// Detalhe no "title" da pílula (o Figma mostra só a palavra).
const DETALHE_DO_ESTADO: Record<EstadoDoCarregador, string> = {
  ativo: 'Carregadores conectados e livres',
  emUso: 'Carregando agora',
  falha: 'Carregador com falha',
  indisponivel: 'Carregador fora de serviço',
  offline: 'Carregadores sem conexão',
  instalacao: 'Carregadores que ainda não se conectaram',
};

/** Pílula de contorno com o estado do local (Figma: "Operacional"). */
export function PilulaDoEstado({
  resumo,
  pequena = false,
}: {
  resumo: ResumoDoLocal;
  pequena?: boolean;
}) {
  const grupo = grupoDoLocal(resumo);
  return (
    <span
      title={grupo === 'vazio' ? 'Nenhum carregador cadastrado' : DETALHE_DO_ESTADO[resumo.estado]}
      className={cn(
        'inline-flex items-center justify-center rounded-[25px] border border-[#37352f] dark:border-foreground/70 font-medium whitespace-nowrap',
        'text-[#666666] dark:text-muted-foreground',
        pequena
          ? 'h-[27px] min-w-[111px] px-4 text-[10px]'
          : 'h-[30px] min-w-[117px] px-[18px] text-xs'
      )}
    >
      {TEXTO_DO_GRUPO[grupo]}
    </span>
  );
}

/** Contador do topo (Figma: cartão 249×119, bloco 65×61 cinza claro, ícone de 48). */
export function ContadorDeLocais({
  icone,
  rotulo,
  valor,
}: {
  icone: ReactNode;
  rotulo: string;
  valor: ReactNode;
}) {
  // O espaço interno segue a largura do próprio cartão (consulta de contêiner):
  // entre 1700 e 1850 px os seis cartões ficam com ~215 px e não cabem as
  // medidas do Figma (feitas para 249 px).
  return (
    <section aria-label={rotulo} className={`${classeDoCartao} @container min-w-0`}>
      <div className="min-h-[119px] px-3 @min-[240px]:px-[17px] py-4 flex items-center gap-3 @min-[240px]:gap-[25px]">
        <span
          aria-hidden="true"
          className="bg-tom-cinza w-[65px] h-[61px] rounded-[5px] flex items-center justify-center shrink-0"
        >
          {icone}
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] leading-[1.1] font-semibold text-[#001119] dark:text-foreground">
            {rotulo}
          </span>
          <span className="block text-[36px] leading-tight font-semibold tabular-nums text-foreground">
            {valor}
          </span>
        </span>
      </div>
    </section>
  );
}

// Chip de filtro do Figma: pílula de 43 px com contorno escuro e a seta para baixo.
const classeDoChip = (ativo: boolean) =>
  cn(
    'h-[43px] pl-[31px] pr-5 rounded-[25px] border text-[15px] font-medium whitespace-nowrap inline-flex items-center gap-3 transition',
    ativo
      ? 'bg-primary border-primary text-primary-foreground shadow-pilula'
      : 'bg-card border-[#37352f] dark:border-border text-[#37352f] dark:text-foreground hover:bg-muted'
  );

const Seta = () => <IconeSvg src={iconeSeta} tamanho={19} altura={18} className="rotate-90" />;

/** "Todas (53)", "Operacional (22)"…: escolhe o status (o marcado fica verde). */
export function ChipComSeta({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={ativo} className={classeDoChip(ativo)}>
      {children}
      <Seta />
    </button>
  );
}

/** "Filtrar por status:" com a seta: abre as mesmas opções dos chips. */
export function MenuFiltrarPorStatus<T extends string>({
  opcoes,
  valor,
  aoMudar,
}: {
  opcoes: { id: T; rotulo: string }[];
  valor: T;
  aoMudar: (v: T) => void;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className={classeDoChip(false)}>
        Filtrar por status:
        <Seta />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[214px] rounded-[10px]">
        <DropdownMenuRadioGroup value={valor} onValueChange={v => aoMudar(v as T)}>
          {opcoes.map(o => (
            <DropdownMenuRadioItem key={o.id} value={o.id} className="text-[15px]">
              {o.rotulo}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Legenda do mapa: bloco colorido com o ícone, título e descrição (cores do Figma).
const ITENS_DA_LEGENDA: { titulo: string; descricao: string; fundo: string; icone: ReactNode }[] = [
  {
    titulo: 'Disponível',
    descricao: 'Pronto pra uso',
    fundo: 'bg-[#d3fde2] text-[#00cc6a] dark:bg-estado-livre dark:text-estado-livre-forte',
    icone: <IconeSvg src={iconeRaio} tamanho={20} altura={25} />,
  },
  {
    titulo: 'Carregando',
    descricao: 'Em uso no momento',
    fundo: 'bg-tom-azul text-tom-azul-icone',
    icone: <IconeSvg src={iconeRaio} tamanho={20} altura={25} />,
  },
  {
    titulo: 'Problema',
    descricao: 'Requer atenção',
    fundo: 'bg-tom-amarelo text-[#fec80b]',
    icone: <IconeSvg src={iconeAlerta} />,
  },
  {
    titulo: 'Offline',
    descricao: 'Sem conexão',
    fundo: 'bg-tom-cinza text-[#666666] dark:text-tom-cinza-icone',
    icone: <IconeSvg src={iconeSemConexao} />,
  },
];

// Só aparece quando há no mapa local sem carregador conectado ainda (marcador tracejado).
const ITEM_EM_INSTALACAO = {
  titulo: 'Em instalação',
  descricao: 'Ainda não se conectou',
  fundo: 'bg-tom-cinza text-[#9e9e9d]',
  icone: <IconeSvg src={iconePino} />,
};

export function LegendaDoMapa({ comEmInstalacao }: { comEmInstalacao: boolean }) {
  const itens = comEmInstalacao ? [...ITENS_DA_LEGENDA, ITEM_EM_INSTALACAO] : ITENS_DA_LEGENDA;
  return (
    <section className={`${classeDoCartao} px-[30px] py-[21px]`} aria-labelledby="legenda-do-mapa">
      <h2
        id="legenda-do-mapa"
        className="text-base font-semibold text-[#001119] dark:text-foreground"
      >
        Legenda (status do carregador)
      </h2>
      <ul className="mt-[18px] grid grid-cols-2 gap-x-4 gap-y-[23px]">
        {itens.map(item => (
          <li key={item.titulo} className="flex items-center gap-[10px] min-w-0">
            <span
              aria-hidden="true"
              className={`${item.fundo} w-[41px] h-[38px] rounded-[5px] flex items-center justify-center shrink-0`}
            >
              {item.icone}
            </span>
            <span className="min-w-0">
              <span className="block text-base leading-tight font-medium text-[#001119] dark:text-foreground">
                {item.titulo}
              </span>
              <span className="block text-sm leading-tight font-medium text-[#666666] dark:text-muted-foreground">
                {item.descricao}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NumeroDoLocal({
  icone,
  rotulo,
  valor,
  gap = 'gap-3',
}: {
  icone: ReactNode;
  rotulo: string;
  valor: ReactNode;
  gap?: string;
}) {
  return (
    <div className={`flex items-center ${gap} min-w-0`}>
      <span aria-hidden="true" className="text-[#575757] dark:text-foreground/80 shrink-0">
        {icone}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-[#666666] dark:text-muted-foreground">
          {rotulo}
        </span>
        <span className="block text-[20px] leading-tight font-medium tabular-nums text-[#001119] dark:text-foreground">
          {valor}
        </span>
      </span>
    </div>
  );
}

/** Bloco verde-claro com o pino (ou a foto do local, quando houver). */
function BlocoDoPino({ loc, grande = false }: { loc: LocalResumo; grande?: boolean }) {
  const medida = grande ? 'w-[50px] h-[46px]' : 'w-[48px] h-[43px]';
  if (loc.imageUrl) {
    return (
      <img
        src={loc.imageUrl}
        alt=""
        className={`${medida} rounded-[5px] object-cover shrink-0 bg-primary-soft`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${medida} rounded-[5px] bg-[#d3fde2] text-[#00cc6a] dark:bg-estado-livre dark:text-estado-livre-forte flex items-center justify-center shrink-0`}
    >
      <IconeSvg src={iconePino} />
    </span>
  );
}

/** "Local selecionado" ao lado do mapa (Figma 182:4680 e o botão solto por cima dele). */
export function CartaoLocalSelecionado({
  local,
  resumo,
}: {
  local: LocalResumo | null;
  resumo: ResumoDoLocal | null;
}) {
  return (
    <section
      className={`${classeDoCartao} px-[29px] pt-[19px] pb-6 flex flex-col min-h-[319px] xl:flex-1`}
      aria-labelledby="local-selecionado"
    >
      <h2
        id="local-selecionado"
        className="text-base font-semibold text-[#001119] dark:text-foreground"
      >
        Local selecionado
      </h2>
      {!local || !resumo ? (
        <p className="mt-4 text-sm font-medium text-muted-foreground">
          Clique num local no mapa para ver os carregadores dele.
        </p>
      ) : (
        <>
          <div className="mt-[17px] flex items-start gap-4 min-w-0">
            <BlocoDoPino loc={local} grande />
            <div className="flex-1 min-w-0">
              <p
                className="text-base font-medium text-[#001119] dark:text-foreground truncate"
                title={local.nomeDoLocal}
              >
                {local.nomeDoLocal}
              </p>
              {enderecoDoLocal(local)
                .filter(Boolean)
                .map(linha => (
                  <p
                    key={linha}
                    className="text-sm font-medium text-[#666666] dark:text-muted-foreground truncate"
                    title={linha}
                  >
                    {linha}
                  </p>
                ))}
            </div>
            <Link
              to={`/locais/${local.id}`}
              aria-label={`Abrir os detalhes de ${local.nomeDoLocal}`}
              title="Abrir os detalhes do local"
              className="p-1 -m-1 rounded-[5px] text-black dark:text-foreground hover:text-primary-strong hover:bg-muted transition shrink-0"
            >
              {/* No Figma o ícone está girado 90° (seta para cima e para a direita) */}
              <IconeSvg src={iconeAbrir} className="-rotate-90" />
            </Link>
          </div>
          <div className="mt-5">
            <PilulaDoEstado resumo={resumo} />
          </div>
          <div className="mt-5 flex flex-wrap justify-between gap-x-3 gap-y-3">
            <NumeroDoLocal
              icone={<IconeSvg src={iconeCarregador} />}
              rotulo="Carregadores"
              valor={resumo.total}
            />
            <NumeroDoLocal
              icone={<IconeSvg src={iconeDisponivel} tamanho={29} />}
              rotulo="Disponíveis"
              valor={resumo.ativos}
            />
            <NumeroDoLocal
              icone={<IconeSvg src={iconeRaio} tamanho={20} altura={25} />}
              rotulo="Carregando"
              valor={resumo.emUso}
            />
          </div>
          <div className="mt-auto pt-7">
            <Link
              to={`/locais/${local.id}`}
              className="h-[47px] w-full rounded-[25px] bg-primary text-primary-foreground text-sm font-medium shadow-[0_4px_4px_rgba(0,0,0,0.25)] inline-flex items-center justify-center hover:brightness-105 active:scale-[0.99] transition"
            >
              Ver detalhes do local
            </Link>
          </div>
        </>
      )}
    </section>
  );
}

/** Seletor grade/lista do Figma (185:524): pílula de 122 px; o modo ativo ganha o contorno interno. */
export function AlternarGradeLista({
  modo,
  aoMudar,
}: {
  modo: 'grade' | 'lista';
  aoMudar: (m: 'grade' | 'lista') => void;
}) {
  return (
    <div
      role="group"
      aria-label="Exibir os locais em"
      className="relative w-[122px] h-[43px] rounded-[25px] border border-[#37352f] dark:border-border shrink-0"
    >
      {(['grade', 'lista'] as const).map(m => {
        const ativo = modo === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => aoMudar(m)}
            aria-pressed={ativo}
            aria-label={m === 'grade' ? 'Grade' : 'Lista'}
            title={m === 'grade' ? 'Ver em grade' : 'Ver em lista'}
            className={cn(
              'absolute -top-px h-[43px] w-[70px] rounded-[25px] inline-flex items-center justify-center text-[#37352f] dark:text-foreground transition',
              m === 'grade' ? '-left-px' : '-right-px',
              ativo
                ? 'z-[1] border border-[#37352f] dark:border-foreground bg-card'
                : 'border border-transparent hover:bg-muted'
            )}
          >
            <IconeSvg src={m === 'grade' ? iconeGrade : iconeLista} />
          </button>
        );
      })}
    </div>
  );
}

/** Cartão de um local na aba "Locais registrados" (Figma 185:524, nas cores do mapa). */
export function CartaoDoLocal({
  local,
  resumo,
  emLinha = false,
  aoVerDetalhes,
  aoVerNoMapa,
  aoAbrirMapaDoLocal,
  aoExcluir,
}: {
  local: LocalResumo;
  resumo: ResumoDoLocal;
  /** Modo "lista" do seletor: o mesmo cartão numa linha só. */
  emLinha?: boolean;
  aoVerDetalhes: () => void;
  aoVerNoMapa: () => void;
  aoAbrirMapaDoLocal: () => void;
  /** Só para o admin; sem ele, o item "Excluir local" não aparece. */
  aoExcluir?: () => void;
}) {
  const ocupacao = ocupacaoDoLocal(resumo);
  const noMapa = temCoordenadas(local);
  const [rua, cidade] = enderecoDoLocal(local);
  const temMenu = noMapa || !!aoExcluir;
  const botao = cn(classeDoBotaoContorno, 'h-[38px] min-w-0 px-3 text-xs text-black');
  return (
    <article
      className={cn(
        classeDoCartao,
        'p-[25px] pb-[18px] min-w-0 flex flex-col',
        emLinha &&
          'lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-10 lg:py-5'
      )}
      aria-label={local.nomeDoLocal}
    >
      <div className="flex items-start gap-[27px] min-w-0">
        <BlocoDoPino loc={local} />
        <div className="flex-1 min-w-0">
          <h3
            className="text-base font-medium text-[#001119] dark:text-foreground truncate"
            title={local.nomeDoLocal}
          >
            {local.nomeDoLocal}
          </h3>
          <p className="mt-[13px] text-[11px] font-medium text-[#666666] dark:text-muted-foreground line-clamp-2">
            {[rua, cidade].filter(Boolean).join(', ')}
          </p>
        </div>
        <div className="shrink-0">
          <PilulaDoEstado resumo={resumo} pequena />
        </div>
      </div>

      <div
        className={cn(
          'grid grid-cols-2 gap-6 items-start pl-[14px]',
          emLinha ? 'mt-8 lg:mt-0' : 'mt-8'
        )}
      >
        <NumeroDoLocal
          icone={<IconeSvg src={iconeCartaoCarregador} tamanho={35} altura={31} />}
          rotulo="Carregadores"
          valor={resumo.total}
          gap="gap-4"
        />
        <div className="min-w-0">
          <NumeroDoLocal
            icone={<IconeSvg src={iconeCartaoOcupacao} tamanho={37} altura={31} />}
            rotulo="Ocupação"
            valor={ocupacao === null ? '—' : `${ocupacao}%`}
            gap="gap-4"
          />
          <div
            className="mt-[11px] h-[9px] w-full max-w-[200px] rounded-[25px] bg-[#d9d9d9] dark:bg-white/15 overflow-hidden"
            role="meter"
            aria-label={`Ocupação: ${resumo.emUso} de ${resumo.instalados} carregadores instalados em uso`}
            aria-valuenow={ocupacao ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <i
              className="block h-full rounded-[25px] bg-primary"
              style={{ width: `${ocupacao ?? 0}%` }}
            />
          </div>
        </div>
      </div>

      <div className={cn('flex gap-[10px]', emLinha ? 'mt-7 lg:mt-0' : 'mt-auto pt-7')}>
        <button type="button" onClick={aoVerDetalhes} className={cn(botao, 'flex-[143]')}>
          Detalhes
        </button>
        <button
          type="button"
          onClick={aoVerNoMapa}
          disabled={!noMapa}
          title={noMapa ? undefined : 'Este local não tem coordenadas no cadastro'}
          className={cn(botao, 'flex-[191]')}
        >
          Ver no mapa
        </button>
        {temMenu && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              aria-label={`Mais ações de ${local.nomeDoLocal}`}
              className={cn(botao, 'w-[73px] shrink-0 px-0')}
            >
              {/* Os três pontos do Figma: 6 px, cinza-escuro */}
              <span
                aria-hidden="true"
                className="flex gap-[6px] text-[#575757] dark:text-primary-strong"
              >
                {[0, 1, 2].map(i => (
                  <i key={i} className="block w-[6px] h-[6px] rounded-full bg-current" />
                ))}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[200px] rounded-[10px]">
              {noMapa && (
                <DropdownMenuItem onSelect={aoAbrirMapaDoLocal}>Mapa do local</DropdownMenuItem>
              )}
              {noMapa && aoExcluir && <DropdownMenuSeparator />}
              {aoExcluir && (
                <DropdownMenuItem variant="destructive" onSelect={aoExcluir}>
                  Excluir local
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </article>
  );
}
