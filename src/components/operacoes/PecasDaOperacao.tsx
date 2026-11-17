import { useId, useMemo, useState, type ReactNode } from 'react';
import { ChevronUp, Info, Play, Search } from 'lucide-react';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ScrollArea } from '../ui/scroll-area';
import { Icone, IconeSvg } from '../painel/Icone';
import { classeDoCartao } from '../painel/Pagina';
import { EtiquetaDeEstado } from '../painel/Pecas';
import iconeCarregadores from '../../assets/icones/op-carregadores.svg';

/*
 * Peças do Centro de operações no redesenho de nov/2026. O frame do Figma
 * ("Operações") dá o estilo e a imagem de referência que a Lauriane deixou ao
 * lado completa o que o frame não tem: abas sublinhadas, a lista de
 * carregadores com caixas de seleção e a barra de execução embaixo.
 */

export interface AbaSublinhada<T extends string> {
  id: T;
  rotulo: string;
  icone: ReactNode;
  /** Número ao lado do rótulo (resultados, envios aguardando). */
  contador?: number;
}

/** Abas da referência: ícone e texto, com o sublinhado verde na ativa (sem pílula). */
export function AbasSublinhadas<T extends string>({
  abas,
  ativa,
  aoMudar,
  rotulo,
}: {
  abas: AbaSublinhada<T>[];
  ativa: T;
  aoMudar: (id: T) => void;
  rotulo: string;
}) {
  return (
    <nav aria-label={rotulo} className="flex gap-2 sm:gap-6 overflow-x-auto border-b border-border">
      {abas.map(a => {
        const eAtiva = a.id === ativa;
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => aoMudar(a.id)}
            aria-current={eAtiva ? 'page' : undefined}
            className={`relative shrink-0 h-[52px] px-3 inline-flex items-center gap-3 text-base whitespace-nowrap transition-colors ${
              eAtiva
                ? 'font-semibold text-foreground'
                : 'font-medium text-muted-foreground hover:text-foreground'
            }`}
          >
            {a.icone}
            {a.rotulo}
            {!!a.contador && (
              <span className="min-w-6 h-6 px-1.5 rounded-full bg-primary-soft text-primary-strong text-xs font-bold inline-flex items-center justify-center">
                {a.contador}
              </span>
            )}
            {eAtiva && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-primary"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}

/**
 * Contador do topo (frame): bloco do ícone, rótulo e o número grande — com a
 * parte da rede ao lado (Online e Offline, como na referência).
 */
export function ContadorDaOperacao({
  icone,
  rotulo,
  valor,
  parte,
  fundoDoIcone = 'bg-primary-soft text-primary-strong',
}: {
  icone: ReactNode;
  rotulo: string;
  valor: ReactNode;
  /** Ex.: "63%". */
  parte?: string;
  fundoDoIcone?: string;
}) {
  return (
    <section
      className={`${classeDoCartao} min-h-[112px] px-5 3xl:px-[30px] py-4 flex items-center gap-4 3xl:gap-[20px]`}
      aria-label={rotulo}
    >
      <span
        aria-hidden="true"
        className={`${fundoDoIcone} w-[57px] h-[53px] rounded-[5px] flex items-center justify-center shrink-0`}
      >
        {icone}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-[#001119] dark:text-foreground truncate">
          {rotulo}
        </span>
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-[36px] leading-tight font-semibold tabular-nums text-foreground">
            {valor}
          </span>
          {parte && (
            <span className="text-base font-medium tabular-nums text-muted-foreground">
              {parte}
            </span>
          )}
        </span>
      </span>
    </section>
  );
}

export interface CarregadorDaLista {
  charge_point_id: string;
  description?: string;
  vendor?: string;
  model?: string;
  isConnected: boolean;
}

/** [id do local, { nome do local, carregadores }] — como o Centro de operações agrupa. */
export type GrupoDeCarregadores = [string, { name: string; chargers: CarregadorDaLista[] }];

type FiltroDeStatus = 'todos' | 'online' | 'offline';

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const classeDoFiltro =
  'h-[45px] data-[size=default]:h-[45px] w-full sm:w-auto sm:min-w-[210px] max-w-full sm:max-w-[280px] rounded-[10px] bg-card px-4 gap-2 ' +
  'text-sm font-medium text-foreground data-[placeholder]:text-foreground';

/**
 * Cartão "Carregadores" da referência: quantos estão selecionados, busca,
 * filtro por status e por local, e os carregadores agrupados por local, com
 * caixa de seleção, nome, "ID · fabricante modelo" e o estado.
 */
export function ListaDeCarregadores({
  grupos,
  total,
  online,
  selecionados,
  aoAlternar,
  aoSelecionarOnline,
  aoLimpar,
}: {
  grupos: GrupoDeCarregadores[];
  total: number;
  online: number;
  selecionados: string[];
  aoAlternar: (id: string) => void;
  aoSelecionarOnline: () => void;
  aoLimpar: () => void;
}) {
  const base = useId();
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<FiltroDeStatus>('todos');
  const [local, setLocal] = useState('todos');
  const [fechados, setFechados] = useState<ReadonlySet<string>>(new Set());

  // Local que sumiu da lista (recarga dos dados): volta a "todos os locais".
  const localValido = grupos.some(([id]) => id === local) ? local : 'todos';
  const termo = semAcento(busca.trim());

  const visiveis = useMemo(
    () =>
      grupos
        .filter(([id]) => localValido === 'todos' || id === localValido)
        .map(([id, g]): GrupoDeCarregadores => {
          // Busca pelo nome do local traz o local inteiro.
          const localBate = !!termo && semAcento(g.name).includes(termo);
          const chargers = g.chargers.filter(
            cp =>
              (status === 'todos' || (status === 'online') === cp.isConnected) &&
              (!termo ||
                localBate ||
                [cp.description, cp.charge_point_id, cp.vendor, cp.model].some(
                  t => !!t && semAcento(t).includes(termo)
                ))
          );
          return [id, { ...g, chargers }];
        })
        .filter(([, g]) => g.chargers.length > 0),
    [grupos, localValido, status, termo]
  );

  const alternarGrupo = (id: string) =>
    setFechados(antes => {
      const novo = new Set(antes);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  const offline = total - online;

  return (
    <section
      className={`${classeDoCartao} p-[22px] flex flex-col min-w-0`}
      aria-label="Seleção de carregadores"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-[220px]">
          <h2 className="text-[20px] leading-tight font-semibold text-foreground">Carregadores</h2>
          <p className="text-sm text-foreground mt-1">
            Selecione os carregadores para executar um comando.
          </p>
          {/* Atalhos de seleção, discretos */}
          <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] font-medium">
            <button
              type="button"
              onClick={aoSelecionarOnline}
              disabled={online === 0}
              className="text-[13px] font-medium text-primary-strong hover:underline disabled:opacity-50 disabled:no-underline"
            >
              Selecionar online ({online})
            </button>
            <span aria-hidden="true" className="text-muted-foreground">
              ·
            </span>
            <button
              type="button"
              onClick={aoLimpar}
              disabled={selecionados.length === 0}
              className="text-[13px] font-medium text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50 disabled:no-underline"
            >
              Limpar seleção
            </button>
          </span>
        </div>
        <span
          className="shrink-0 h-[34px] px-4 rounded-[25px] border border-primary bg-primary-soft/40 text-sm text-foreground inline-flex items-center gap-1.5 whitespace-nowrap"
          aria-live="polite"
        >
          <strong className="text-base font-semibold tabular-nums text-primary-strong">
            {selecionados.length}
          </strong>{' '}
          de{' '}
          <strong className="text-base font-semibold tabular-nums text-primary-strong">
            {total}
          </strong>{' '}
          selecionados
        </span>
      </div>

      <label className="relative block mt-4">
        <Search
          aria-hidden="true"
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"
        />
        <input
          type="search"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por local, carregador ou ID..."
          aria-label="Buscar por local, carregador ou ID"
          className="w-full h-[47px] rounded-[10px] border border-foreground/30 dark:border-border bg-card pl-12 pr-4 text-[15px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </label>

      <div className="mt-3 flex flex-col sm:flex-row flex-wrap gap-3">
        <Select value={status} onValueChange={v => setStatus(v as FiltroDeStatus)}>
          <SelectTrigger
            aria-label="Filtrar por status"
            className={`${classeDoFiltro} ${status === 'todos' ? 'border-foreground/30 dark:border-border' : 'border-primary'}`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span
                aria-hidden="true"
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  status === 'offline'
                    ? 'bg-estado-offline-forte'
                    : status === 'online'
                      ? 'bg-estado-livre-forte'
                      : 'bg-primary'
                }`}
              />
              Status:
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="todos">Todos ({total})</SelectItem>
            <SelectItem value="online">Online ({online})</SelectItem>
            <SelectItem value="offline">Offline ({offline})</SelectItem>
          </SelectContent>
        </Select>

        <Select value={localValido} onValueChange={setLocal}>
          <SelectTrigger
            aria-label="Filtrar por local"
            className={`${classeDoFiltro} ${localValido === 'todos' ? 'border-foreground/30 dark:border-border' : 'border-primary'}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="todos">Todos os locais</SelectItem>
            {grupos.map(([id, g]) => (
              <SelectItem key={id} value={id}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="mt-4 h-[560px] pr-3">
        {visiveis.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {grupos.length === 0
              ? 'Nenhum carregador cadastrado.'
              : 'Nenhum carregador encontrado com estes filtros.'}
          </p>
        ) : (
          <div className="space-y-3 min-w-0">
            {visiveis.map(([id, g], gi) => {
              // Buscando, os locais ficam abertos: o que bateu precisa aparecer.
              const aberto = !!termo || !fechados.has(id);
              return (
                <div key={id} className="rounded-[10px] border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => alternarGrupo(id)}
                    aria-expanded={aberto}
                    className="w-full min-h-[44px] px-4 flex items-center gap-3 bg-background dark:bg-muted text-left"
                  >
                    <span className="text-primary-strong shrink-0">
                      <Icone nome="local" tamanho={20} />
                    </span>
                    <span className="min-w-0 truncate text-sm font-semibold uppercase text-foreground">
                      {g.name}
                    </span>
                    <span className="shrink-0 min-w-6 h-6 px-2 rounded-full bg-card text-foreground text-xs font-semibold tabular-nums inline-flex items-center justify-center">
                      {g.chargers.length}
                    </span>
                    <ChevronUp
                      aria-hidden="true"
                      className={`ml-auto shrink-0 w-5 h-5 text-muted-foreground transition-transform ${aberto ? '' : 'rotate-180'}`}
                    />
                  </button>
                  {aberto && (
                    <ul className="divide-y divide-border">
                      {g.chargers.map((cp, ci) => {
                        const escolhido = selecionados.includes(cp.charge_point_id);
                        const tipo = `${cp.vendor || ''} ${cp.model || ''}`.trim();
                        const idDaCaixa = `${base}-${gi}-${ci}`;
                        return (
                          <li key={cp.charge_point_id}>
                            <label
                              htmlFor={idDaCaixa}
                              className={`flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors ${
                                escolhido ? 'bg-primary-soft/50' : 'hover:bg-muted/50'
                              }`}
                            >
                              <Checkbox
                                id={idDaCaixa}
                                checked={escolhido}
                                onCheckedChange={() => aoAlternar(cp.charge_point_id)}
                                className="size-[22px] rounded-[5px] border-foreground/40 bg-card dark:bg-card data-[state=checked]:border-primary [&_svg]:size-4"
                              />
                              <span className="flex-1 min-w-0">
                                <span className="block text-[15px] font-semibold text-foreground truncate">
                                  {cp.description || tipo || cp.charge_point_id}
                                </span>
                                <span className="block text-xs text-muted-foreground truncate">
                                  {cp.charge_point_id}
                                  {tipo && cp.description ? ` · ${tipo}` : ''}
                                </span>
                              </span>
                              <EtiquetaDeEstado estado={cp.isConnected ? 'livre' : 'offline'}>
                                {cp.isConnected ? 'Online' : 'Offline'}
                              </EtiquetaDeEstado>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </section>
  );
}

/**
 * Barra de largura total embaixo das duas colunas (referência): a operação
 * escolhida, em quantos carregadores vai e o "Executar comando". Os parâmetros
 * do comando continuam no diálogo que o Executar abre.
 */
export function BarraDeExecucao({
  operacao,
  quantidade,
  aoExecutar,
  desabilitado,
}: {
  operacao?: string;
  quantidade: number;
  aoExecutar: () => void;
  desabilitado: boolean;
}) {
  return (
    <section
      aria-label="Executar comando"
      className="sticky bottom-4 z-10 bg-card text-card-foreground rounded-[15px] shadow-cartao dark:border dark:border-border px-[22px] py-4 flex flex-wrap items-center gap-x-8 gap-y-4"
    >
      <div className="flex items-center gap-4 min-w-0">
        <span
          aria-hidden="true"
          className="w-[46px] h-[45px] rounded-[5px] bg-primary-soft text-primary-strong flex items-center justify-center shrink-0"
        >
          <Info className="w-6 h-6" />
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-medium text-muted-foreground">
            Operação selecionada
          </span>
          <span
            className={`block text-[20px] leading-tight font-semibold truncate ${operacao ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            {operacao ?? 'Nenhuma'}
          </span>
        </span>
      </div>

      <span aria-hidden="true" className="hidden md:block w-px h-12 bg-border" />

      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="w-[46px] h-[45px] rounded-[5px] bg-primary-soft text-primary-strong flex items-center justify-center shrink-0"
        >
          <IconeSvg src={iconeCarregadores} tamanho={26} altura={27} nome="op-carregadores" />
        </span>
        <span>
          <span className="block text-[13px] font-medium text-muted-foreground">Aplicar em</span>
          <span className="block text-[20px] leading-tight font-semibold text-foreground">
            <span className="tabular-nums">{quantidade}</span> carregador
            {quantidade === 1 ? '' : 'es'}
          </span>
        </span>
      </div>

      <button
        type="button"
        onClick={aoExecutar}
        disabled={desabilitado}
        className="w-full sm:w-auto sm:ml-auto h-[50px] px-8 rounded-[25px] bg-primary text-primary-foreground text-base font-semibold inline-flex items-center justify-center gap-2 hover:brightness-105 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Play className="w-5 h-5" aria-hidden="true" />
        Executar comando
      </button>
    </section>
  );
}
