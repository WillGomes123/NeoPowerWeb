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
import { DetalheDoRelato, SeloDoTipo } from '../components/erros-do-app/DetalheDoRelato';
import {
  CLASSES_DO_TOM,
  FILTROS_PADRAO,
  INFO_DOS_TIPOS,
  PERIODOS,
  POR_PAGINA,
  TIPOS_DE_RELATO,
  atrasoDaChegada,
  codigoDoRelato,
  consultaDosErros,
  dataHoraCompleta,
  ehTipoDeRelato,
  formatarDataHora,
  iconeDaPlataforma,
  jsEmUso,
  lerFiltros,
  mensagemDeErro,
  momentoDoRelato,
  normalizarPagina,
  normalizarResumo,
  paramsDosFiltros,
  rotuloDaPlataforma,
  temFiltroAtivo,
  versaoComBuild,
  versoesDoResumo,
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

  // A NeoPower é 'neo' e 'neopower-default', as duas com o mesmo nome: no filtro
  // escolhido, nome repetido leva o clientId junto.
  const rotuloDaMarcaEscolhida = (clientId: string) => {
    const nome = nomeDaMarca(clientId);
    return marcas.filter(m => m.nome === nome).length > 1 ? `${nome} (${clientId})` : nome;
  };

  const carregarResumo = useCallback(async () => {
    const g = ++geracaoDoResumo.current;
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
    } catch (e) {
      if (g !== geracaoDaLista.current) return;
      setErro(e instanceof Error && e.message ? e.message : 'Falha de rede ao buscar os erros');
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

  const versoes = useMemo(() => {
    const doResumo = versoesDoResumo(resumo);
    // A versão do filtro pode não ter relato nos últimos 7 dias: continua na lista.
    return filtros.versao && !doResumo.includes(filtros.versao)
      ? [filtros.versao, ...doResumo]
      : doResumo;
  }, [resumo, filtros.versao]);

  const cabecalho = (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div>
        <span className="text-primary text-xs tracking-[0.2em] uppercase font-bold">
          PLATAFORMA
        </span>
        <h2 className="text-4xl font-headline font-bold text-on-surface tracking-tight">
          Erros do app
        </h2>
        <p className="text-on-surface-variant text-sm mt-1 max-w-2xl">
          O que os apps das marcas relatam: erro de JS, app que fecha sozinho, tela de erro e OTA
          que não abriu. Quando o app cai, o relato só chega na abertura seguinte.
        </p>
      </div>
      <button
        type="button"
        onClick={atualizarTudo}
        disabled={atualizando}
        className="flex items-center gap-2 self-start md:self-auto bg-surface-container-low px-4 py-2.5 rounded-lg border border-outline-variant/10 text-on-surface-variant hover:text-primary transition-colors disabled:opacity-50"
      >
        <span
          className={`material-symbols-outlined text-sm ${atualizando ? 'animate-spin' : ''}`}
          aria-hidden="true"
        >
          refresh
        </span>
        <span className="text-xs font-bold font-headline uppercase tracking-wider">Atualizar</span>
      </button>
    </div>
  );

  if (estado === 'indisponivel' || estado === 'bloqueado') {
    return (
      <div className="space-y-8 pb-12">
        {cabecalho}
        <div className="max-w-xl mx-auto mt-8 text-center space-y-3">
          <span className="material-symbols-outlined text-5xl text-outline" aria-hidden="true">
            {estado === 'bloqueado' ? 'lock' : 'cloud_off'}
          </span>
          <p className="text-sm text-on-surface-variant">
            {estado === 'bloqueado'
              ? erro || 'Seu perfil não tem acesso aos erros do app.'
              : 'O servidor ainda não recebe os relatórios de erro do app. A tela passa a funcionar quando a API com /api/app/erros for publicada.'}
          </p>
        </div>
      </div>
    );
  }

  const total = lista?.total ?? 0;
  const porPagina = lista?.porPagina || POR_PAGINA;
  const totalDePaginas = Math.max(1, Math.ceil(total / porPagina));
  const inicio = total ? (pagina - 1) * porPagina + 1 : 0;
  const fim = Math.min(pagina * porPagina, total);
  const itens = lista?.itens ?? [];

  return (
    <div className="space-y-8 pb-12">
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
      <div className="flex flex-wrap items-end gap-3">
        <Filtro rotulo="Marca">
          <Select
            value={filtros.marca ?? TODAS}
            onValueChange={v => mudarFiltros({ marca: v === TODAS ? null : v })}
          >
            <SelectTrigger
              aria-label="Marca"
              className="bg-surface-container-low border-outline-variant/20 text-on-surface"
            >
              <SelectValue>
                {filtros.marca ? rotuloDaMarcaEscolhida(filtros.marca) : 'Todas as marcas'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-surface-container border-outline-variant/20">
              <SelectItem value={TODAS} className="text-on-surface">
                Todas as marcas
              </SelectItem>
              {(marcas.some(m => m.clientId === filtros.marca) || !filtros.marca
                ? marcas
                : [...marcas, { clientId: filtros.marca, nome: filtros.marca }]
              ).map(m => (
                <SelectItem key={m.clientId} value={m.clientId} className="text-on-surface">
                  {m.nome}
                  {/* Duas marcas podem ter o mesmo nome: o clientId diferencia. */}
                  <span className="font-mono text-[11px] text-on-surface-variant">
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
              className="bg-surface-container-low border-outline-variant/20 text-on-surface"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-surface-container border-outline-variant/20">
              <SelectItem value={TODAS} className="text-on-surface">
                Todas as versões
              </SelectItem>
              {versoes.map(v => (
                <SelectItem key={v} value={v} className="text-on-surface">
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
              className="bg-surface-container-low border-outline-variant/20 text-on-surface"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-surface-container border-outline-variant/20">
              <SelectItem value={TODAS} className="text-on-surface">
                Todos os tipos
              </SelectItem>
              {TIPOS_DE_RELATO.map(t => (
                <SelectItem key={t} value={t} className="text-on-surface">
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
              className="bg-surface-container-low border-outline-variant/20 text-on-surface"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-surface-container border-outline-variant/20">
              {PERIODOS.map(p => (
                <SelectItem key={p.id} value={p.id} className="text-on-surface">
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
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-bold text-on-surface-variant hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              filter_alt_off
            </span>
            Limpar filtros
          </button>
        )}
      </div>

      {/* Relatos */}
      <div className="bg-surface-container-low rounded-xl border border-outline-variant/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/10 flex flex-wrap justify-between items-center gap-2">
          <h3 className="text-lg font-headline font-bold text-on-surface">Relatos</h3>
          {lista && (
            <span className="text-xs text-on-surface-variant">
              {total} relato{total === 1 ? '' : 's'} no período
            </span>
          )}
        </div>

        {estado === 'erro' ? (
          <div className="flex flex-col items-center text-center py-16 gap-3">
            <span className="material-symbols-outlined text-4xl text-error" aria-hidden="true">
              error
            </span>
            <p className="text-sm text-on-surface">Não foi possível carregar os erros do app</p>
            {erro && <p className="text-xs text-on-surface-variant max-w-sm break-words">{erro}</p>}
            <button
              type="button"
              onClick={() => void carregarLista()}
              className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant/20 text-on-surface text-sm font-bold hover:bg-surface-container-highest transition-all"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                refresh
              </span>
              Tentar de novo
            </button>
          </div>
        ) : !lista ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : itens.length === 0 ? (
          <div className="flex flex-col items-center text-center py-16 gap-2 text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl text-outline" aria-hidden="true">
              {total > 0 ? 'last_page' : 'check_circle'}
            </span>
            {total > 0 ? (
              <>
                <p className="text-sm">Esta página não tem relatos.</p>
                <button
                  type="button"
                  onClick={() => irParaPagina(1)}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  Voltar para a primeira página
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-on-surface">Nenhum erro recebido no período</p>
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
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em] bg-surface-container/50">
                  <th className="px-4 py-3 font-bold">Quando</th>
                  <th className="px-4 py-3 font-bold">Marca</th>
                  <th className="px-4 py-3 font-bold">Versão / OTA</th>
                  <th className="px-4 py-3 font-bold">Plataforma</th>
                  <th className="px-4 py-3 font-bold">Tipo</th>
                  <th className="px-4 py-3 font-bold">Mensagem</th>
                  <th className="px-4 py-3 font-bold">Usuário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
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

        {lista && estado !== 'erro' && (
          <div className="px-6 py-4 border-t border-outline-variant/10 flex flex-wrap justify-between items-center gap-3">
            <p className="text-xs text-on-surface-variant">
              {total > 0 ? (
                <>
                  <span className="font-bold text-on-surface">
                    {inicio}–{fim}
                  </span>{' '}
                  de <span className="font-bold text-on-surface">{total}</span>
                </>
              ) : (
                'Nenhum relato'
              )}
              <span className="ml-3">
                Página <span className="font-bold text-on-surface">{pagina}</span> de{' '}
                <span className="font-bold text-on-surface">{totalDePaginas}</span>
              </span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => irParaPagina(pagina - 1)}
                disabled={pagina <= 1 || atualizando}
                className="flex items-center gap-1 px-4 py-2 rounded-lg bg-surface-container-highest text-sm font-bold text-on-surface-variant hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-outline-variant/10"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  chevron_left
                </span>
                Anterior
              </button>
              <button
                type="button"
                onClick={() => irParaPagina(pagina + 1)}
                disabled={pagina >= totalDePaginas || atualizando}
                className="flex items-center gap-1 px-4 py-2 rounded-lg bg-surface-container-highest text-sm font-bold text-on-surface-variant hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-outline-variant/10"
              >
                Próxima
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

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
    <div className="space-y-1.5 w-full sm:w-52">
      <span className="block text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">
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
  return (
    <tr
      onClick={aoAbrir}
      className="cursor-pointer hover:bg-surface-container-highest/30 transition-colors align-top"
    >
      <td className="px-4 py-3 whitespace-nowrap">
        <span
          className="text-sm text-on-surface tabular-nums"
          title={`Ocorreu: ${dataHoraCompleta(r.ocorridoEm)}\nRecebido: ${dataHoraCompleta(r.criadoEm)}`}
        >
          {formatarDataHora(momentoDoRelato(r))}
        </span>
        {atraso && (
          <span className="block text-[11px] text-on-surface-variant">chegou {atraso} depois</span>
        )}
      </td>
      <td
        className="px-4 py-3 text-sm text-on-surface whitespace-nowrap"
        title={r.clientId ?? undefined}
      >
        {marca}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-sm font-medium text-on-surface">
          {versaoComBuild(r.appVersao, r.appBuild)}
        </span>
        <span
          className="block font-mono text-[11px] text-on-surface-variant"
          title={r.updateId ?? undefined}
        >
          {js ?? '—'}
          {r.emergencia && (
            <span className="ml-1.5 font-sans font-bold text-red-600 dark:text-red-400">
              emergência
            </span>
          )}
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="flex items-center gap-1.5 text-sm text-on-surface">
          <span
            className="material-symbols-outlined text-base text-on-surface-variant"
            aria-hidden="true"
          >
            {iconeDaPlataforma(r.plataforma)}
          </span>
          {[rotuloDaPlataforma(r.plataforma), r.osVersao].filter(Boolean).join(' ')}
        </span>
        {r.modelo && (
          <span
            className="block max-w-[160px] truncate text-[11px] text-on-surface-variant"
            title={r.modelo}
          >
            {r.modelo}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <SeloDoTipo relato={r} />
      </td>
      <td className="px-4 py-3">
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
          <span className="block truncate text-sm text-on-surface group-hover:text-primary transition-colors">
            {r.mensagem || 'Sem mensagem'}
          </span>
          {ondeFoi && (
            <span className="block truncate font-mono text-[11px] text-on-surface-variant">
              {ondeFoi}
            </span>
          )}
        </button>
      </td>
      <td className="px-4 py-3 text-sm whitespace-nowrap">
        {r.userId != null ? (
          <span className="font-mono text-on-surface">#{r.userId}</span>
        ) : (
          <span className="text-on-surface-variant">sem login</span>
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
        <h3 className="text-lg font-headline font-bold text-on-surface">Últimos 7 dias</h3>
        <span className="text-xs text-on-surface-variant">
          Todas as marcas
          {resumo?.desde ? `, desde ${formatarDataHora(resumo.desde)}` : ''}. Clique para filtrar a
          lista.
        </span>
      </div>

      {estado === 'erro' && !resumo ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-outline-variant/10 bg-surface-container-low px-5 py-4 text-sm text-on-surface-variant">
          <span className="material-symbols-outlined text-error" aria-hidden="true">
            error
          </span>
          Não foi possível carregar o resumo.
          <button
            type="button"
            onClick={aoTentarDeNovo}
            className="text-xs font-bold text-primary hover:underline"
          >
            Tentar de novo
          </button>
        </div>
      ) : (
        <div className={estado === 'carregando' && !resumo ? 'opacity-50' : ''}>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="bg-surface-container-low p-5 rounded-xl border border-outline-variant/10">
              <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-lg" aria-hidden="true">
                  bug_report
                </span>
              </span>
              <p className="text-xs text-on-surface-variant mb-1">Relatos</p>
              <p className="text-2xl font-headline font-bold text-on-surface">
                {resumo ? total : '—'}
              </p>
              {resumo && (
                <p className="text-[11px] text-on-surface-variant mt-1">
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
                  className={`flex flex-col items-start bg-surface-container-low p-5 rounded-xl border text-left transition-all ${
                    ativo
                      ? 'border-primary ring-1 ring-primary/40'
                      : 'border-outline-variant/10 hover:border-outline-variant/40'
                  }`}
                >
                  <span
                    className={`w-8 h-8 rounded-lg border flex items-center justify-center mb-3 ${CLASSES_DO_TOM[info.tom]}`}
                  >
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">
                      {info.icone}
                    </span>
                  </span>
                  <span className="block text-xs text-on-surface-variant mb-1">{info.rotulo}</span>
                  <span className="block text-2xl font-headline font-bold text-on-surface">
                    {resumo ? (porTipo.get(tipo) ?? 0) : '—'}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 bg-surface-container-low rounded-xl border border-outline-variant/10 overflow-hidden">
            <div className="px-5 py-3 border-b border-outline-variant/10 flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-sm font-headline font-bold text-on-surface">Por versão do app</h4>
              <span className="text-[11px] text-on-surface-variant">
                versão (build) e plataforma
              </span>
            </div>
            {resumo && linhas.length === 0 ? (
              <p className="px-5 py-6 text-sm text-on-surface-variant">
                Nenhum relato nos últimos 7 dias.
              </p>
            ) : (
              <ul className="divide-y divide-outline-variant/5">
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
                          ativo ? 'bg-primary/5' : 'hover:bg-surface-container-highest/30'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className="material-symbols-outlined text-base text-on-surface-variant"
                            aria-hidden="true"
                          >
                            {iconeDaPlataforma(l.plataforma)}
                          </span>
                          <span className="truncate text-sm font-medium text-on-surface">
                            {versaoComBuild(l.appVersao, l.appBuild)}
                          </span>
                          <span className="text-xs text-on-surface-variant">
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
                          <span className="w-10 text-right text-sm font-bold text-on-surface tabular-nums">
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
                className="w-full px-5 py-2.5 border-t border-outline-variant/10 text-xs font-bold text-primary hover:bg-surface-container-highest/30 transition-colors"
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
