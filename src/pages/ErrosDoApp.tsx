import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { cn } from '../components/ui/utils';
import { DetalheDoRelato, SeloDoTipo } from '../components/erros-do-app/DetalheDoRelato';
import {
  BotaoAtualizar,
  CabecalhoDaPagina,
  classeDoCartao,
} from '../components/painel/Pagina';
import { classeDoBotaoContorno } from '../components/painel/Pecas';
import {
  classeDaTabela,
  classeDoCartaoDaTabela,
  classeDoFiltro,
  classeDoTd,
  classeDoTh,
} from '../components/configuracoes/Pecas';
import {
  APELIDOS_DE_MARCA,
  CLASSES_DO_TOM,
  FILTROS_PADRAO,
  INFO_DOS_TIPOS,
  PERIODOS,
  TIPOS_DE_RELATO,
  atrasoDaChegada,
  codigoDoRelato,
  consultaDosErros,
  dataHoraCompleta,
  ehTipoDeRelato,
  faixaDaPagina,
  formatarDataHora,
  iconeDaPlataforma,
  jsEmUso,
  lerFiltros,
  mensagemDaFalha,
  mensagemDeErro,
  momentoDoRelato,
  normalizarPagina,
  normalizarResumo,
  paramsDosFiltros,
  rotuloDaPlataforma,
  temFiltroAtivo,
  versaoComBuild,
  versoesDoFiltro,
  type FiltrosDeErros,
  type PaginaDeRelatos,
  type Periodo,
  type RelatoDeErro,
  type ResumoDeErros,
  type TipoDeRelato,
} from '../lib/errosDoApp';

/**
 * Erros do app: o que os apps das marcas relatam (erro de JS, app que fecha
 * sozinho, tela de erro, OTA que não abriu), com versão, build e OTA de quem
 * mandou. Só a plataforma vê, porque os relatos são de todas as marcas e trazem
 * usuário e aparelho. A API também barra.
 */

interface MarcaOpcao {
  clientId: string;
  nome: string;
}

// O build da NeoPower manda 'neopower-default' no X-Client-Id, e essa marca
// pode não estar na lista (a configuração dela no banco é 'neo').
const MARCA_NEOPOWER: MarcaOpcao = { clientId: 'neopower-default', nome: 'NeoPower' };

// O Select do Radix não aceita value vazio: "todas" é o "sem filtro".
const TODAS = 'todas';

/** Versões mostradas no resumo antes do "Mostrar todas". */
const VERSOES_NO_RESUMO = 6;

type EstadoDaLista = 'carregando' | 'pronto' | 'erro' | 'indisponivel' | 'bloqueado';
type EstadoDoResumo = 'carregando' | 'pronto' | 'erro';

export const ErrosDoApp = () => {
  const [params, setParams] = useSearchParams();
  const { filtros, pagina } = useMemo(() => lerFiltros(params), [params]);

  const [marcas, setMarcas] = useState<MarcaOpcao[]>([MARCA_NEOPOWER]);
  const [resumo, setResumo] = useState<ResumoDeErros | null>(null);
  const [estadoDoResumo, setEstadoDoResumo] = useState<EstadoDoResumo>('carregando');
  const [lista, setLista] = useState<PaginaDeRelatos | null>(null);
  const [estado, setEstado] = useState<EstadoDaLista>('carregando');
  const [erro, setErro] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [relatoAberto, setRelatoAberto] = useState<RelatoDeErro | null>(null);
  const [detalheAberto, setDetalheAberto] = useState(false);

  // Cada consulta ganha um número; a resposta de uma consulta mais antiga
  // (filtro trocado no meio) é descartada.
  const geracaoDaLista = useRef(0);
  const geracaoDoResumo = useRef(0);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const r = await api.get('/admin/branding');
        if (!r.ok) return;
        const data = await r.json();
        const brutas: Array<{ clientId?: string; companyName?: string }> = Array.isArray(data)
          ? data
          : data?.payload || [];
        const lista: MarcaOpcao[] = brutas
          .filter((b): b is { clientId: string; companyName?: string } => !!b?.clientId)
          .map(b => ({ clientId: b.clientId, nome: b.companyName || b.clientId }));
        if (!lista.some(m => m.clientId === MARCA_NEOPOWER.clientId)) lista.unshift(MARCA_NEOPOWER);
        if (vivo) setMarcas(lista);
      } catch {
        // Sem a lista, a marca aparece pelo clientId.
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const nomeDaMarca = useCallback(
    (clientId: string | null) => {
      if (!clientId) return 'Sem marca';
      return marcas.find(m => m.clientId === clientId)?.nome ?? clientId;
    },
    [marcas]
  );

  // O 'neo' fica para dar nome a um relato que venha com ele, mas sai do filtro:
  // o app NeoPower manda 'neopower-default' e filtrar por 'neo' viria vazio.
  const opcoesDeMarca = useMemo(
    () => marcas.filter(m => !APELIDOS_DE_MARCA.has(m.clientId)),
    [marcas]
  );

  // Duas marcas com o mesmo nome: no filtro escolhido, o clientId vai junto.
  const rotuloDaMarcaEscolhida = (clientId: string) => {
    const nome = nomeDaMarca(clientId);
    return opcoesDeMarca.filter(m => m.nome === nome).length > 1 ? `${nome} (${clientId})` : nome;
  };

  const carregarResumo = useCallback(async () => {
    const g = ++geracaoDoResumo.current;
    // Some o aviso de falha enquanto tenta de novo; os números antigos ficam.
    setEstadoDoResumo('carregando');
    try {
      const r = await api.get('/app/erros/resumo');
      if (g !== geracaoDoResumo.current) return;
      if (!r.ok) {
        // O 404 e o 403 também chegam à lista, que mostra o aviso da página.
        setEstadoDoResumo('erro');
        return;
      }
      const dados = normalizarResumo(await r.json());
      if (g !== geracaoDoResumo.current) return;
      setResumo(dados);
      setEstadoDoResumo('pronto');
    } catch {
      if (g === geracaoDoResumo.current) setEstadoDoResumo('erro');
    }
  }, []);

  const carregarLista = useCallback(async () => {
    const g = ++geracaoDaLista.current;
    setAtualizando(true);
    try {
      const r = await api.get(`/app/erros?${consultaDosErros(filtros, pagina)}`);
      if (g !== geracaoDaLista.current) return;
      if (r.status === 404) {
        // API sem a rota: o relatório de erros ainda não foi publicado nela.
        setEstado('indisponivel');
        return;
      }
      if (!r.ok) {
        const corpo: unknown = await r.json().catch(() => null);
        if (g !== geracaoDaLista.current) return;
        setErro(mensagemDeErro(corpo, r.status));
        setEstado(r.status === 403 ? 'bloqueado' : 'erro');
        return;
      }
      const dados = normalizarPagina(await r.json());
      if (g !== geracaoDaLista.current) return;
      setLista(dados);
      setErro(null);
      setEstado('pronto');
      setAtualizadoEm(new Date());
    } catch (e) {
      if (g !== geracaoDaLista.current) return;
      setErro(mensagemDaFalha(e));
      setEstado('erro');
    } finally {
      if (g === geracaoDaLista.current) setAtualizando(false);
    }
  }, [filtros, pagina]);

  useEffect(() => {
    void carregarResumo();
  }, [carregarResumo]);

  useEffect(() => {
    void carregarLista();
  }, [carregarLista]);

  // Sai da página: respostas que ainda chegarem são ignoradas.
  useEffect(
    () => () => {
      geracaoDaLista.current++;
      geracaoDoResumo.current++;
    },
    []
  );

  const atualizarTudo = () => {
    void carregarResumo();
    void carregarLista();
  };

  // Filtro novo volta para a primeira página. `replace` para o "voltar" do
  // navegador não passar por cada clique de filtro.
  const mudarFiltros = (mudanca: Partial<FiltrosDeErros>) =>
    setParams(paramsDosFiltros({ ...filtros, ...mudanca }, 1), { replace: true });
  const irParaPagina = (p: number) => setParams(paramsDosFiltros(filtros, p), { replace: true });

  const abrir = (r: RelatoDeErro) => {
    setRelatoAberto(r);
    setDetalheAberto(true);
  };

  const versoes = useMemo(
    () => versoesDoFiltro(resumo, lista?.itens ?? [], filtros.versao),
    [resumo, lista, filtros.versao]
  );

  const faixa = useMemo(() => (lista ? faixaDaPagina(lista) : null), [lista]);

  // Link de uma página que não existe mais (a limpeza dos 90 dias apagou
  // relatos): vai para a última página que tem relatos.
  useEffect(() => {
    if (!lista || !faixa?.passouDoFim || estado !== 'pronto' || atualizando) return;
    if (lista.pagina !== pagina) return;
    setParams(paramsDosFiltros(filtros, faixa.totalDePaginas), { replace: true });
  }, [lista, faixa, estado, atualizando, pagina, filtros, setParams]);

  const cabecalho = (
    <CabecalhoDaPagina
      rotulo="Plataforma"
      titulo="Erros do app"
      subtitulo={
        <span className="text-muted-foreground">
          O que os apps das marcas relatam: erro de JS, app que fecha sozinho, tela de erro e OTA
          que não abriu. Quando o app cai, o relato só chega na abertura seguinte.
        </span>
      }
      acoes={
        <BotaoAtualizar
          aoAtualizar={atualizarTudo}
          carregando={atualizando}
          atualizadoEm={atualizadoEm}
          falhou={estado === 'erro'}
        />
      }
    />
  );

  if (estado === 'indisponivel' || estado === 'bloqueado') {
    return (
      <div className="space-y-[25px] pb-12">
        {cabecalho}
        <div className="max-w-xl mx-auto mt-8 text-center space-y-3">
          <span className="material-symbols-outlined text-5xl text-muted-foreground/60" aria-hidden="true">
            {estado === 'bloqueado' ? 'lock' : 'cloud_off'}
          </span>
          <p className="text-sm text-muted-foreground">
            {estado === 'bloqueado'
              ? erro || 'Seu perfil não tem acesso aos erros do app.'
              : 'O servidor ainda não recebe os relatórios de erro do app. A tela passa a funcionar quando a API com /api/app/erros for publicada.'}
          </p>
        </div>
      </div>
    );
  }

  const total = lista?.total ?? 0;
  const itens = lista?.itens ?? [];

  return (
    <div className="space-y-[25px] pb-12">
      {cabecalho}

      <Resumo
        resumo={resumo}
        estado={estadoDoResumo}
        filtros={filtros}
        aoTentarDeNovo={() => void carregarResumo()}
        aoFiltrarTipo={tipo => mudarFiltros({ tipo })}
        aoFiltrarVersao={versao => mudarFiltros({ versao })}
      />

      {/* Filtros: valem para a lista abaixo (o resumo é sempre 7 dias, todas as marcas). */}
      <div className={`${classeDoCartao} px-4 py-4 flex flex-wrap items-end gap-3`}>
        <Filtro rotulo="Marca">
          <Select
            value={filtros.marca ?? TODAS}
            onValueChange={v => mudarFiltros({ marca: v === TODAS ? null : v })}
          >
            <SelectTrigger
              aria-label="Marca"
              className={classeDoFiltro}
            >
              <SelectValue>
                {filtros.marca ? rotuloDaMarcaEscolhida(filtros.marca) : 'Todas as marcas'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>
                Todas as marcas
              </SelectItem>
              {(opcoesDeMarca.some(m => m.clientId === filtros.marca) || !filtros.marca
                ? opcoesDeMarca
                : [...opcoesDeMarca, { clientId: filtros.marca, nome: filtros.marca }]
              ).map(m => (
                <SelectItem key={m.clientId} value={m.clientId}>
                  {m.nome}
                  {/* Duas marcas podem ter o mesmo nome: o clientId diferencia. */}
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {m.clientId}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Filtro>

        <Filtro rotulo="Versão">
          <Select
            value={filtros.versao ?? TODAS}
            onValueChange={v => mudarFiltros({ versao: v === TODAS ? null : v })}
          >
            <SelectTrigger
              aria-label="Versão"
              className={classeDoFiltro}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>
                Todas as versões
              </SelectItem>
              {versoes.map(v => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Filtro>

        <Filtro rotulo="Tipo">
          <Select
            value={filtros.tipo ?? TODAS}
            onValueChange={v => mudarFiltros({ tipo: ehTipoDeRelato(v) ? v : null })}
          >
            <SelectTrigger
              aria-label="Tipo"
              className={classeDoFiltro}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>
                Todos os tipos
              </SelectItem>
              {TIPOS_DE_RELATO.map(t => (
                <SelectItem key={t} value={t}>
                  {INFO_DOS_TIPOS[t].rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Filtro>

        <Filtro rotulo="Período (chegada)">
          <Select
            value={filtros.periodo}
            onValueChange={v => mudarFiltros({ periodo: v as Periodo })}
          >
            <SelectTrigger
              aria-label="Período"
              className={classeDoFiltro}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODOS.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Filtro>

        {temFiltroAtivo(filtros) && (
          <button
            type="button"
            onClick={() => setParams(paramsDosFiltros(FILTROS_PADRAO, 1), { replace: true })}
            className={cn(classeDoBotaoContorno, 'h-[43px]')}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              filter_alt_off
            </span>
            Limpar filtros
          </button>
        )}
      </div>

      {/* Relatos */}
      <section className={classeDoCartaoDaTabela} aria-label="Relatos">
        <div className="px-3 3xl:px-5 mb-1 flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-[20px] leading-tight font-semibold text-foreground">Relatos</h3>
          {lista && (
            <span className="text-sm font-medium text-muted-foreground">
              {total} relato{total === 1 ? '' : 's'} no período
            </span>
          )}
        </div>

        {estado === 'erro' ? (
          <div className="flex flex-col items-center text-center py-16 gap-3">
            <span className="material-symbols-outlined text-4xl text-destructive" aria-hidden="true">
              error
            </span>
            <p className="text-sm text-foreground">Não foi possível carregar os erros do app</p>
            {erro && <p className="text-xs text-muted-foreground max-w-sm break-words">{erro}</p>}
            <button
              type="button"
              onClick={() => void carregarLista()}
              disabled={atualizando}
              className={`mt-2 ${classeDoBotaoContorno}`}
            >
              <span
                className={`material-symbols-outlined text-base ${atualizando ? 'animate-spin' : ''}`}
                aria-hidden="true"
              >
                refresh
              </span>
              {atualizando ? 'Tentando…' : 'Tentar de novo'}
            </button>
          </div>
        ) : !lista || faixa?.passouDoFim ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-strong" />
          </div>
        ) : itens.length === 0 ? (
          <div className="flex flex-col items-center text-center py-16 gap-2 text-muted-foreground">
            <span className="material-symbols-outlined text-4xl text-muted-foreground/60" aria-hidden="true">
              {total > 0 ? 'last_page' : 'check_circle'}
            </span>
            {total > 0 ? (
              <>
                <p className="text-sm">Esta página não tem relatos.</p>
                <button
                  type="button"
                  onClick={() => irParaPagina(1)}
                  className="text-sm font-semibold text-primary-strong hover:underline"
                >
                  Voltar para a primeira página
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-foreground">Nenhum erro recebido no período</p>
                <p className="text-xs max-w-sm">
                  {temFiltroAtivo(filtros)
                    ? 'Há filtros ativos; mude ou limpe os filtros para ver mais.'
                    : 'Quando o app cai, o relato só chega na abertura seguinte.'}
                </p>
              </>
            )}
          </div>
        ) : (
          // Na troca de filtro ou de página a lista anterior fica, apagada, até
          // a nova chegar: sem pular para um spinner.
          <div
            className={`overflow-x-auto transition-opacity ${atualizando ? 'opacity-60' : ''}`}
            aria-busy={atualizando}
          >
            <table className={classeDaTabela}>
              <thead>
                <tr>
                  <th className={classeDoTh}>Quando</th>
                  <th className={classeDoTh}>Marca</th>
                  <th className={classeDoTh}>Versão / OTA</th>
                  <th className={classeDoTh}>Plataforma</th>
                  <th className={classeDoTh}>Tipo</th>
                  <th className={classeDoTh}>Mensagem</th>
                  <th className={classeDoTh}>Usuário</th>
                </tr>
              </thead>
              <tbody>
                {itens.map(r => (
                  <LinhaDoRelato
                    key={r.id}
                    relato={r}
                    marca={nomeDaMarca(r.clientId)}
                    aoAbrir={() => abrir(r)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Os números são da página que chegou, não da pedida: na troca de página
            não aparecem sobre a lista anterior. */}
        {faixa && estado !== 'erro' && !faixa.passouDoFim && (
          <div className="px-3 3xl:px-5 pt-2 pb-1 flex flex-wrap justify-between items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {faixa.inicio > 0 ? (
                <>
                  <span className="font-semibold text-foreground">
                    {faixa.inicio}–{faixa.fim}
                  </span>{' '}
                  de <span className="font-semibold text-foreground">{total}</span>
                </>
              ) : total > 0 ? (
                'Nenhum relato nesta página'
              ) : (
                'Nenhum relato'
              )}
              <span className="ml-3">
                Página <span className="font-semibold text-foreground">{faixa.pagina}</span> de{' '}
                <span className="font-semibold text-foreground">{faixa.totalDePaginas}</span>
              </span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => irParaPagina(faixa.pagina - 1)}
                disabled={faixa.pagina <= 1 || atualizando}
                className={classeDoBotaoContorno}
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  chevron_left
                </span>
                Anterior
              </button>
              <button
                type="button"
                onClick={() => irParaPagina(faixa.pagina + 1)}
                disabled={faixa.pagina >= faixa.totalDePaginas || atualizando}
                className={classeDoBotaoContorno}
              >
                Próxima
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        )}
      </section>

      <DetalheDoRelato
        relato={relatoAberto}
        aberto={detalheAberto}
        nomeDaMarca={nomeDaMarca}
        aoFechar={() => setDetalheAberto(false)}
      />
    </div>
  );
};

function Filtro({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5 w-full sm:w-auto">
      <span className="block px-3 text-muted-foreground text-[13px] font-medium">
        {rotulo}
      </span>
      {children}
    </div>
  );
}

function LinhaDoRelato({
  relato: r,
  marca,
  aoAbrir,
}: {
  relato: RelatoDeErro;
  marca: string;
  aoAbrir: () => void;
}) {
  const atraso = atrasoDaChegada(r);
  const js = jsEmUso(r);
  const ondeFoi = [r.tela, codigoDoRelato(r)].filter(Boolean).join(' · ');
  const td = cn(classeDoTd, 'align-top');
  return (
    <tr onClick={aoAbrir} className="cursor-pointer">
      <td className={`${td} whitespace-nowrap`}>
        <span
          className="text-sm text-foreground tabular-nums"
          title={`Ocorreu: ${dataHoraCompleta(r.ocorridoEm)}\nRecebido: ${dataHoraCompleta(r.criadoEm)}`}
        >
          {formatarDataHora(momentoDoRelato(r))}
        </span>
        {atraso && (
          <span className="block text-[11px] text-muted-foreground">chegou {atraso} depois</span>
        )}
      </td>
      <td className={`${td} text-foreground whitespace-nowrap`} title={r.clientId ?? undefined}>
        {marca}
      </td>
      <td className={`${td} whitespace-nowrap`}>
        <span className="text-sm font-medium text-foreground">
          {versaoComBuild(r.appVersao, r.appBuild)}
        </span>
        <span
          className="block font-mono text-[11px] text-muted-foreground"
          title={r.updateId ?? undefined}
        >
          {js ?? '—'}
          {r.emergencia && (
            <span className="ml-1.5 font-sans font-bold text-destructive">
              emergência
            </span>
          )}
        </span>
      </td>
      <td className={`${td} whitespace-nowrap`}>
        <span className="flex items-center gap-1.5 text-sm text-foreground">
          <span
            className="material-symbols-outlined text-base text-muted-foreground"
            aria-hidden="true"
          >
            {iconeDaPlataforma(r.plataforma)}
          </span>
          {[rotuloDaPlataforma(r.plataforma), r.osVersao].filter(Boolean).join(' ')}
        </span>
        {r.modelo && (
          <span
            className="block max-w-[160px] truncate text-[11px] text-muted-foreground"
            title={r.modelo}
          >
            {r.modelo}
          </span>
        )}
      </td>
      <td className={td}>
        <SeloDoTipo relato={r} />
      </td>
      <td className={td}>
        {/* Botão para o detalhe abrir também pelo teclado; a linha toda abre no clique. */}
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            aoAbrir();
          }}
          className="block max-w-[360px] text-left group"
          title={r.mensagem ?? undefined}
        >
          <span className="block truncate text-sm text-foreground group-hover:text-primary-strong transition-colors">
            {r.mensagem || 'Sem mensagem'}
          </span>
          {ondeFoi && (
            <span className="block truncate font-mono text-[11px] text-muted-foreground">
              {ondeFoi}
            </span>
          )}
        </button>
      </td>
      <td className={`${td} whitespace-nowrap`}>
        {r.userId != null ? (
          <span className="font-mono text-foreground">#{r.userId}</span>
        ) : (
          <span className="text-muted-foreground">sem login</span>
        )}
      </td>
    </tr>
  );
}

/** Resumo dos últimos 7 dias, de todas as marcas: por tipo e por versão. */
function Resumo({
  resumo,
  estado,
  filtros,
  aoTentarDeNovo,
  aoFiltrarTipo,
  aoFiltrarVersao,
}: {
  resumo: ResumoDeErros | null;
  estado: 'carregando' | 'pronto' | 'erro';
  filtros: FiltrosDeErros;
  aoTentarDeNovo: () => void;
  aoFiltrarTipo: (tipo: TipoDeRelato | null) => void;
  aoFiltrarVersao: (versao: string | null) => void;
}) {
  const [todasAsVersoes, setTodasAsVersoes] = useState(false);

  const porTipo = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const l of resumo?.porTipo ?? []) mapa.set(l.tipo, (mapa.get(l.tipo) ?? 0) + l.total);
    return mapa;
  }, [resumo]);
  const total = [...porTipo.values()].reduce((s, n) => s + n, 0);
  const derrubaram = (porTipo.get('js_fatal') ?? 0) + (porTipo.get('encerramento_abrupto') ?? 0);

  const linhas = resumo?.porVersao ?? [];
  const maior = linhas.reduce((m, l) => Math.max(m, l.total), 0);
  const visiveis = todasAsVersoes ? linhas : linhas.slice(0, VERSOES_NO_RESUMO);

  return (
    <section className="space-y-4" aria-label="Resumo dos últimos 7 dias">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[20px] leading-tight font-semibold text-foreground">Últimos 7 dias</h3>
        {/* Os números antigos continuam, mas quem lê precisa saber que não são os de agora. */}
        {estado === 'erro' && resumo && (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="material-symbols-outlined text-sm text-destructive" aria-hidden="true">
              error
            </span>
            Não foi possível atualizar o resumo.
            <button
              type="button"
              onClick={aoTentarDeNovo}
              className="font-semibold text-primary-strong hover:underline"
            >
              Tentar de novo
            </button>
          </span>
        )}
        <span className="text-sm text-muted-foreground">
          Todas as marcas
          {resumo?.desde ? `, desde ${formatarDataHora(resumo.desde)}` : ''}. Clique para filtrar a
          lista.
        </span>
      </div>

      {estado === 'erro' && !resumo ? (
        <div className={`${classeDoCartao} flex flex-wrap items-center gap-3 px-5 py-4 text-sm text-muted-foreground`}>
          <span className="material-symbols-outlined text-destructive" aria-hidden="true">
            error
          </span>
          Não foi possível carregar o resumo.
          <button
            type="button"
            onClick={aoTentarDeNovo}
            className="font-semibold text-primary-strong hover:underline"
          >
            Tentar de novo
          </button>
        </div>
      ) : (
        <div className={estado === 'carregando' && !resumo ? 'opacity-50' : ''}>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 3xl:gap-[25px]">
            <div className={`${classeDoCartao} p-5`}>
              <span className="w-[41px] h-[38px] rounded-[5px] bg-primary-soft text-primary-strong flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-lg" aria-hidden="true">
                  bug_report
                </span>
              </span>
              <p className="text-sm font-semibold text-foreground mb-1">Relatos</p>
              <p className="text-[28px] leading-tight font-semibold tabular-nums text-foreground">
                {resumo ? total : '—'}
              </p>
              {resumo && (
                <p className="text-xs text-muted-foreground mt-1">
                  {derrubaram} derrubaram o app
                </p>
              )}
            </div>
            {TIPOS_DE_RELATO.map(tipo => {
              const info = INFO_DOS_TIPOS[tipo];
              const ativo = filtros.tipo === tipo;
              return (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => aoFiltrarTipo(ativo ? null : tipo)}
                  aria-pressed={ativo}
                  title={info.descricao}
                  // Sem glass-card: a borda e a sombra dele (CSS fora das camadas do
                  // Tailwind) apagariam a marcação do filtro ativo. O flex alinha o
                  // conteúdo no topo, como no card de Relatos (o botão centraliza).
                  className={`${classeDoCartao} flex flex-col items-start p-5 text-left transition-all ${
                    ativo ? 'ring-2 ring-primary' : 'hover:ring-1 hover:ring-border'
                  }`}
                >
                  <span
                    className={`w-[41px] h-[38px] rounded-[5px] border flex items-center justify-center mb-3 ${CLASSES_DO_TOM[info.tom]}`}
                  >
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">
                      {info.icone}
                    </span>
                  </span>
                  <span className="block text-sm font-semibold text-foreground mb-1">{info.rotulo}</span>
                  <span className="block text-[28px] leading-tight font-semibold tabular-nums text-foreground">
                    {resumo ? (porTipo.get(tipo) ?? 0) : '—'}
                  </span>
                </button>
              );
            })}
          </div>

          <div className={`${classeDoCartao} mt-4 3xl:mt-[25px] overflow-hidden`}>
            <div className="px-5 py-4 border-b border-border flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-base font-semibold text-foreground">Por versão do app</h4>
              <span className="text-sm text-muted-foreground">
                versão (build) e plataforma
              </span>
            </div>
            {resumo && linhas.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                Nenhum relato nos últimos 7 dias.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {visiveis.map(l => {
                  const ativo = !!l.appVersao && filtros.versao === l.appVersao;
                  // Barra fina, uma cor só (a da marca), proporcional ao maior total.
                  const largura = maior ? Math.max(2, (l.total / maior) * 100) : 0;
                  return (
                    <li key={`${l.appVersao}|${l.appBuild}|${l.plataforma}`}>
                      <button
                        type="button"
                        disabled={!l.appVersao}
                        onClick={() => l.appVersao && aoFiltrarVersao(ativo ? null : l.appVersao)}
                        aria-pressed={ativo}
                        className={`w-full grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-2.5 text-left transition-colors disabled:cursor-default ${
                          ativo ? 'bg-primary-soft' : 'hover:bg-muted/50'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className="material-symbols-outlined text-base text-muted-foreground"
                            aria-hidden="true"
                          >
                            {iconeDaPlataforma(l.plataforma)}
                          </span>
                          <span className="truncate text-sm font-medium text-foreground">
                            {versaoComBuild(l.appVersao, l.appBuild)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {rotuloDaPlataforma(l.plataforma)}
                          </span>
                        </span>
                        <span className="flex items-center gap-3">
                          <span
                            className="block w-24 sm:w-48 h-2 rounded-r-[4px] bg-primary/15"
                            aria-hidden="true"
                          >
                            <span
                              className="block h-full rounded-r-[4px] bg-primary"
                              style={{ width: `${largura}%` }}
                            />
                          </span>
                          <span className="w-10 text-right text-sm font-semibold text-foreground tabular-nums">
                            {l.total}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {linhas.length > VERSOES_NO_RESUMO && (
              <button
                type="button"
                onClick={() => setTodasAsVersoes(v => !v)}
                className="w-full px-5 py-3 border-t border-border text-sm font-semibold text-primary-strong hover:bg-muted/50 transition-colors"
              >
                {todasAsVersoes ? 'Mostrar menos' : `Mostrar todas (${linhas.length})`}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
