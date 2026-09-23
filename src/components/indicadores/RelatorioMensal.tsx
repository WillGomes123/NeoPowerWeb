import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { MetasDialog } from './MetasDialog';
import {
  DIAS_SEMANA,
  STATUS_META,
  fmtBRL,
  fmtCompacto,
  fmtDataHora,
  fmtInt,
  fmtKwh,
  fmtNum,
  fmtPct,
  fmtVar,
  mesAtualLocal,
  mesCurto,
  mesPorExtenso,
  nomeDoMes,
  somarMeses,
  variacaoPct,
  type Carregador,
  type MetaNumerica,
  type PontoSerie,
  type RelatorioMensal as Relatorio,
} from './tipos';

/*
 * Relatório mensal pensado para o cliente (operador da marca): linguagem do dia
 * a dia (recargas, motoristas, uso dos carregadores), um resumo em frase no topo
 * e o detalhe separado em abas. Os números vêm de GET /indicators/monthly.
 */

// Azul mais claro que o da apresentação: precisa contrastar no tema escuro e no claro.
const AZUL = '#4F7CA8';
const VERDE = '#16A34A';
const VERMELHO = '#DC2626';
const AMBAR = '#D97706';

const tooltipStyle = {
  contentStyle: {
    backgroundColor: '#1a1919',
    border: '1px solid #494847',
    borderRadius: 8,
    padding: 10,
  },
  labelStyle: { color: '#adaaaa', marginBottom: 4, fontSize: 12 },
  itemStyle: { color: '#f5f5f5', fontSize: 12 },
};

// ---------------------------------------------------------------------------
// Peças pequenas
// ---------------------------------------------------------------------------

function Variacao({ valor, sufixo = '%' }: { valor: number | null; sufixo?: string }) {
  if (valor === null) return null;
  if (valor === 0)
    return (
      <span className="inline-flex items-center rounded-full bg-surface-container-highest px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant">
        igual
      </span>
    );
  const subiu = valor > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${subiu ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}
    >
      <span className="material-symbols-outlined text-[14px] leading-none">
        {subiu ? 'arrow_upward' : 'arrow_downward'}
      </span>
      {fmtVar(valor, sufixo).replace('+', '').replace('-', '')}
    </span>
  );
}

/** Ícone de ajuda com a explicação no hover (e no toque, pelo title). */
function Ajuda({ texto }: { texto: string }) {
  return (
    <span
      title={texto}
      aria-label={texto}
      className="material-symbols-outlined text-[15px] leading-none text-on-surface-variant/70 cursor-help align-middle no-print"
    >
      help
    </span>
  );
}

function Secao({
  titulo,
  subtitulo,
  icone,
  acoes,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  icone: string;
  acoes?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="glass-panel rounded-xl border border-outline-variant/10 p-5 lg:p-6 print-avoid">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="font-headline text-base font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">{icone}</span>
            {titulo}
          </h3>
          {subtitulo && <p className="text-sm text-on-surface-variant mt-1">{subtitulo}</p>}
        </div>
        {acoes && <div className="no-print">{acoes}</div>}
      </div>
      {children}
    </section>
  );
}

function Chips<T extends string>({
  opcoes,
  valor,
  onChange,
}: {
  opcoes: Array<{ id: T; rotulo: string }>;
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {opcoes.map(o => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            valor === o.id
              ? 'bg-primary/15 text-primary'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
          }`}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

const Vazio = ({ texto }: { texto: string }) => (
  <div className="h-40 flex flex-col items-center justify-center gap-2 text-on-surface-variant">
    <span className="material-symbols-outlined text-4xl text-outline">leaderboard</span>
    <p className="text-sm">{texto}</p>
  </div>
);

// ---------------------------------------------------------------------------
// Vocabulário
// ---------------------------------------------------------------------------

type ChaveSerie = keyof Omit<PontoSerie, 'mes'>;
const METRICAS_SERIE: Array<{ id: ChaveSerie; rotulo: string; fmt: (n: number) => string }> = [
  { id: 'faturamento', rotulo: 'Faturamento', fmt: n => fmtBRL(n) },
  { id: 'operacoes', rotulo: 'Recargas', fmt: fmtInt },
  { id: 'usuariosAtivos', rotulo: 'Motoristas', fmt: fmtInt },
  { id: 'energiaKwh', rotulo: 'Energia', fmt: n => fmtKwh(n) },
  { id: 'novosUsuarios', rotulo: 'Novos motoristas', fmt: fmtInt },
  { id: 'baseAcumulada', rotulo: 'Motoristas na base', fmt: fmtInt },
];

const ROTULO_META: Record<MetaNumerica['chave'], string> = {
  faturamento: 'Faturamento',
  energiaKwh: 'Energia entregue',
  operacoes: 'Recargas',
  novosUsuarios: 'Novos motoristas',
  baseUsuarios: 'Motoristas na base',
  baseAtivaPct: 'Motoristas ativos',
};

const EXPLICA = {
  recargas:
    'Recargas concluídas com energia entregue. Recargas em andamento ou sem energia não contam.',
  motoristas: 'Quantas pessoas diferentes carregaram na sua rede no período.',
  novos: 'Pessoas que carregaram na sua rede pela primeira vez neste período.',
  base: 'Todas as pessoas que já carregaram na sua rede pelo menos uma vez.',
  ativos:
    'De todos os motoristas que já carregaram com você, quantos voltaram a carregar neste mês.',
  uso: 'Quanto tempo os carregadores ficaram com um carro conectado, considerando 24 horas por dia em cada conector.',
  preco: 'Faturamento dividido pela energia entregue.',
  ticket: 'Quanto cada recarga rendeu, em média.',
};

type ColunaTabela =
  | 'nome'
  | 'faturamento'
  | 'energiaKwh'
  | 'operacoes'
  | 'ocupacaoPct'
  | 'usuarios'
  | 'novosUsuarios'
  | 'precoMedioKwh'
  | 'ticketMedio';

type Aba = 'resumo' | 'carregadores' | 'motoristas' | 'metas';

const ABAS: Array<{ id: Aba; rotulo: string; icone: string }> = [
  { id: 'resumo', rotulo: 'Resumo', icone: 'dashboard' },
  { id: 'carregadores', rotulo: 'Carregadores', icone: 'ev_station' },
  { id: 'motoristas', rotulo: 'Motoristas', icone: 'group' },
  { id: 'metas', rotulo: 'Metas e projeção', icone: 'flag' },
];

// ---------------------------------------------------------------------------
// Tela
// ---------------------------------------------------------------------------

export function RelatorioMensal() {
  const { user } = useAuth();
  const podeGerenciar = user?.role === 'admin' || (user?.role === 'operador' && !!user?.clientId);
  const empresa = user?.branding?.companyName || 'NeoPower';

  const [mes, setMes] = useState(mesAtualLocal());
  const [dados, setDados] = useState<Relatorio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>('resumo');
  const [metricaSerie, setMetricaSerie] = useState<ChaveSerie>('faturamento');
  const [metricaProjecao, setMetricaProjecao] = useState<
    'faturamento' | 'energiaKwh' | 'operacoes' | 'usuariosAtivos'
  >('faturamento');
  const [ordem, setOrdem] = useState<{ coluna: ColunaTabela; desc: boolean }>({
    coluna: 'faturamento',
    desc: true,
  });
  const [metasAbertas, setMetasAbertas] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [imprimindo, setImprimindo] = useState(false);

  useEffect(() => {
    const antes = () => setImprimindo(true);
    const depois = () => setImprimindo(false);
    window.addEventListener('beforeprint', antes);
    window.addEventListener('afterprint', depois);
    return () => {
      window.removeEventListener('beforeprint', antes);
      window.removeEventListener('afterprint', depois);
    };
  }, []);

  const imprimir = () => {
    // Monta todas as abas antes de abrir a impressão, para os gráficos entrarem.
    setImprimindo(true);
    setTimeout(() => window.print(), 400);
  };

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resp = await api.get(`/indicators/monthly?mes=${mes}&meses=12`);
      const corpo = await resp.json().catch(() => null);
      if (!resp.ok) {
        setDados(null);
        setErro(corpo?.error || 'Não foi possível carregar o relatório.');
        return;
      }
      setDados(corpo as Relatorio);
    } catch {
      setErro('Erro ao conectar com o servidor.');
      setDados(null);
    } finally {
      setCarregando(false);
    }
  }, [mes]);

  useEffect(() => {
    if (podeGerenciar) void carregar();
    else setCarregando(false);
  }, [carregar, podeGerenciar]);

  const carregadoresOrdenados = useMemo(() => {
    if (!dados) return [];
    const lista = [...dados.carregadores];
    const { coluna, desc } = ordem;
    lista.sort((a, b) => {
      if (coluna === 'nome')
        return desc ? b.nome.localeCompare(a.nome) : a.nome.localeCompare(b.nome);
      const va = a[coluna] ?? -Infinity;
      const vb = b[coluna] ?? -Infinity;
      return desc ? vb - va : va - vb;
    });
    return lista;
  }, [dados, ordem]);

  if (!podeGerenciar) {
    return (
      <div className="glass-panel rounded-lg p-8 text-center text-on-surface-variant">
        <span className="material-symbols-outlined text-4xl text-outline">lock</span>
        <p className="mt-2 text-sm">
          O relatório mensal é exclusivo de administradores e operadores da marca.
        </p>
      </div>
    );
  }

  const exportarPptx = async () => {
    if (!dados) return;
    setExportando(true);
    const id = toast.loading('Montando a apresentação…');
    try {
      const { exportarApresentacao } = await import('./exportarApresentacao');
      await exportarApresentacao(dados, { empresa, corDaMarca: user?.branding?.primaryColor });
      toast.success('Apresentação baixada', { id });
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível gerar a apresentação', { id });
    } finally {
      setExportando(false);
    }
  };

  const exportarCsv = () => {
    if (!dados) return;
    const cab = [
      'Carregador',
      'ID',
      'Bairro',
      'Conectores',
      'Faturamento (R$)',
      'Faturamento mês anterior (R$)',
      'Energia (kWh)',
      'Energia mês anterior (kWh)',
      'Recargas',
      'Recargas mês anterior',
      'Motoristas',
      'Novos motoristas',
      'Horas em uso',
      'Horas disponíveis',
      'Uso (%)',
      'Preço médio (R$/kWh)',
      'Valor médio por recarga (R$)',
      'Duração média (min)',
    ];
    const num = (v: number | null) => (v === null ? '' : String(v).replace('.', ','));
    const linhas = dados.carregadores.map(c => [
      c.nome,
      c.chargePointId,
      c.bairro ?? '',
      c.conectores,
      num(c.faturamento),
      num(c.anterior.faturamento),
      num(c.energiaKwh),
      num(c.anterior.energiaKwh),
      c.operacoes,
      c.anterior.operacoes,
      c.usuarios,
      c.novosUsuarios,
      num(c.horasOcupadas),
      num(c.horasDisponiveis),
      num(c.ocupacaoPct),
      num(c.precoMedioKwh),
      num(c.ticketMedio),
      num(c.duracaoMediaMin),
    ]);
    const csv = [cab, ...linhas]
      .map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob([String.fromCharCode(0xfeff) + csv], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carregadores_${dados.mes}${dados.fechado ? '' : '_parcial'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const mesMaximo = mesAtualLocal();
  const r = dados;
  const mesAnteriorNome = r ? nomeDoMes(r.periodoAnterior.ini.slice(0, 7)) : '';
  // Só a aba ativa é montada (gráfico montado escondido fica com largura zero);
  // para imprimir, todas.
  const mostrar = (a: Aba) => imprimindo || aba === a;

  return (
    <div className="space-y-6">
      {/* Mês e ações */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 no-print">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-full bg-surface-container-high p-1">
            <button
              type="button"
              aria-label="Mês anterior"
              onClick={() => setMes(m => somarMeses(m, -1))}
              className="h-8 w-8 inline-flex items-center justify-center rounded-full text-on-surface hover:bg-surface-container-highest"
            >
              <span className="material-symbols-outlined text-xl">chevron_left</span>
            </button>
            <label className="relative px-3 text-sm font-semibold text-on-surface cursor-pointer">
              {mesPorExtenso(mes)}
              <input
                type="month"
                aria-label="Escolher mês"
                value={mes}
                max={mesMaximo}
                onChange={e => e.target.value && setMes(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>
            <button
              type="button"
              aria-label="Próximo mês"
              disabled={mes >= mesMaximo}
              onClick={() => setMes(m => somarMeses(m, 1))}
              className="h-8 w-8 inline-flex items-center justify-center rounded-full text-on-surface hover:bg-surface-container-highest disabled:opacity-30"
            >
              <span className="material-symbols-outlined text-xl">chevron_right</span>
            </button>
          </div>
          {r && !r.fechado && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-600 dark:text-sky-400">
              <span className="material-symbols-outlined text-sm">schedule</span>
              Mês em andamento · dados até {fmtDataHora(r.periodo.fim)}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void carregar()}
            disabled={carregando}
            title="Atualizar dados"
            aria-label="Atualizar dados"
            className="h-10 w-10 inline-flex items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant hover:text-primary"
          >
            <span
              className={`material-symbols-outlined text-xl ${carregando ? 'animate-spin' : ''}`}
            >
              refresh
            </span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={!r || exportando}
                className="h-10 px-4 inline-flex items-center gap-1.5 rounded-full text-sm font-semibold bg-primary text-on-primary disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-lg">download</span>
                {exportando ? 'Gerando…' : 'Exportar'}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-popover border-border">
              <DropdownMenuItem onSelect={() => void exportarPptx()} className="gap-2 py-2">
                <span className="material-symbols-outlined text-lg text-primary">slideshow</span>
                <span>
                  <span className="block text-sm font-medium">Apresentação</span>
                  <span className="block text-xs text-muted-foreground">
                    PowerPoint pronto para a reunião
                  </span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={exportarCsv} className="gap-2 py-2">
                <span className="material-symbols-outlined text-lg text-primary">table_view</span>
                <span>
                  <span className="block text-sm font-medium">Planilha por carregador</span>
                  <span className="block text-xs text-muted-foreground">Arquivo CSV (Excel)</span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={imprimir} className="gap-2 py-2">
                <span className="material-symbols-outlined text-lg text-primary">print</span>
                <span>
                  <span className="block text-sm font-medium">Imprimir ou salvar PDF</span>
                  <span className="block text-xs text-muted-foreground">Relatório completo</span>
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {erro && (
        <div className="bg-error/10 border border-error/30 rounded-lg p-4 text-error text-sm">
          {erro}
        </div>
      )}

      {carregando && !r && (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <p className="text-on-surface-variant text-sm">
            Preparando o relatório de {mesPorExtenso(mes)}…
          </p>
        </div>
      )}

      {r && (
        <div className={`space-y-6 transition-opacity ${carregando ? 'opacity-60' : ''}`}>
          <div className="hidden print:block">
            <h1 className="text-2xl font-bold">Relatório de {mesPorExtenso(r.mes)}</h1>
            <p className="text-sm">
              {empresa} · {r.fechado ? 'mês fechado' : `dados até ${fmtDataHora(r.periodo.fim)}`}
            </p>
          </div>

          <ResumoDoMes r={r} mesAnteriorNome={mesAnteriorNome} />

          {/* Abas */}
          <div className="no-print flex gap-1 overflow-x-auto rounded-full bg-surface-container-high p-1 w-full sm:w-fit">
            {ABAS.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAba(a.id)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  aba === a.id
                    ? 'bg-surface-container-lowest text-on-surface shadow'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-lg ${aba === a.id ? 'text-primary' : ''}`}
                >
                  {a.icone}
                </span>
                {a.rotulo}
              </button>
            ))}
          </div>

          {/* Resumo */}
          {mostrar('resumo') && (
            <div className="space-y-6">
              <Destaques r={r} />
              <Secao
                titulo="Evolução nos últimos 12 meses"
                subtitulo={`De ${mesCurto(r.serie[0].mes)} a ${mesCurto(r.mes)}. A barra mais forte é o mês escolhido.`}
                icone="bar_chart"
                acoes={
                  <Chips
                    opcoes={METRICAS_SERIE.map(m => ({ id: m.id, rotulo: m.rotulo }))}
                    valor={metricaSerie}
                    onChange={setMetricaSerie}
                  />
                }
              >
                <Trajetoria serie={r.serie} metrica={metricaSerie} mesSelecionado={r.mes} />
              </Secao>
              <MaisNumeros r={r} />
            </div>
          )}

          {/* Carregadores */}
          {mostrar('carregadores') && (
            <div className="space-y-6">
              <Secao
                titulo="Como cada carregador foi"
                subtitulo={`Comparado com ${r.comparacaoParcial ? `o mesmo período de ${mesAnteriorNome}` : mesAnteriorNome}. Toque no nome da coluna para ordenar.`}
                icone="ev_station"
              >
                <TabelaCarregadores
                  lista={carregadoresOrdenados}
                  ordem={ordem}
                  onOrdenar={coluna =>
                    setOrdem(o => ({ coluna, desc: o.coluna === coluna ? !o.desc : true }))
                  }
                  totalFaturamento={r.resumo.faturamento}
                />
              </Secao>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Secao
                  titulo="Uso dos carregadores"
                  subtitulo="Quanto tempo cada um ficou com carro conectado"
                  icone="timelapse"
                >
                  <Ocupacao lista={r.carregadores} />
                </Secao>
                <Secao
                  titulo="Motoristas por carregador"
                  subtitulo="Total atendido e quantos eram novos"
                  icone="group_add"
                >
                  <Usuarios lista={r.carregadores} />
                </Secao>
              </div>
            </div>
          )}

          {/* Motoristas */}
          {mostrar('motoristas') && (
            <div className="space-y-6">
              <Motoristas r={r} />
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Secao
                  titulo="De onde vêm os novos motoristas"
                  subtitulo="Pelo bairro do local onde fizeram a primeira recarga"
                  icone="location_city"
                >
                  <Bairros r={r} />
                </Secao>
                <Secao
                  titulo="Quando os motoristas carregam"
                  subtitulo="Início das recargas por dia da semana e horário"
                  icone="calendar_view_week"
                >
                  <MapaDeCalor r={r} />
                </Secao>
              </div>
            </div>
          )}

          {/* Metas e projeção */}
          {mostrar('metas') && (
            <div className="space-y-6">
              <Secao
                titulo={`Metas de ${nomeDoMes(r.mes)}`}
                subtitulo={
                  r.metas.definidas
                    ? 'Resultado do mês comparado com o que foi planejado'
                    : 'Defina metas para acompanhar o mês'
                }
                icone="flag"
                acoes={
                  <button
                    type="button"
                    onClick={() => setMetasAbertas(true)}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15"
                  >
                    <span className="material-symbols-outlined text-base">
                      {r.metas.definidas ? 'edit' : 'add'}
                    </span>
                    {r.metas.definidas ? 'Editar metas' : 'Definir metas'}
                  </button>
                }
              >
                <Metas r={r} onDefinir={() => setMetasAbertas(true)} />
              </Secao>

              <Secao
                titulo="Para onde a rede está indo"
                subtitulo={
                  r.projecao.base
                    ? `Estimativa se o ritmo de crescimento até ${mesCurto(r.projecao.base)} continuar`
                    : 'Ainda não há histórico suficiente para estimar'
                }
                icone="trending_up"
                acoes={
                  <Chips
                    opcoes={[
                      { id: 'faturamento', rotulo: 'Faturamento' },
                      { id: 'operacoes', rotulo: 'Recargas' },
                      { id: 'usuariosAtivos', rotulo: 'Motoristas' },
                      { id: 'energiaKwh', rotulo: 'Energia' },
                    ]}
                    valor={metricaProjecao}
                    onChange={setMetricaProjecao}
                  />
                }
              >
                <ProjecaoView r={r} metrica={metricaProjecao} />
              </Secao>
            </div>
          )}

          <details className="glass-panel rounded-xl border border-outline-variant/10 p-5 text-sm text-on-surface-variant no-print">
            <summary className="cursor-pointer font-semibold text-on-surface">
              Como os números são calculados
            </summary>
            <ul className="mt-3 space-y-1.5 list-disc pl-5 text-xs leading-relaxed">
              <li>
                <b>Recargas</b>: {EXPLICA.recargas}
              </li>
              <li>
                <b>Motoristas</b>: {EXPLICA.motoristas}
              </li>
              <li>
                <b>Novos motoristas</b>: {EXPLICA.novos} Cada um conta só no carregador da primeira
                recarga, então a soma por carregador e por bairro bate com o total.
              </li>
              <li>
                <b>Motoristas na base</b>: {EXPLICA.base} <b>Motoristas ativos</b>: {EXPLICA.ativos}
              </li>
              <li>
                <b>Uso dos carregadores</b>: {EXPLICA.uso} Recargas acima de 24 horas contam como 24
                horas.
              </li>
              <li>
                <b>Mês em andamento</b>: a comparação é com o mesmo número de dias do mês anterior.
              </li>
              <li>
                <b>Projeção</b>: mantém o ritmo de crescimento dos últimos meses fechados. Não
                considera novos pontos, lotação dos carregadores nem sazonalidade.
              </li>
              <li>Datas no fuso {r.fuso.replace('_', ' ')}. O bairro vem do cadastro do local.</li>
            </ul>
          </details>

          <MetasDialog
            aberto={metasAbertas}
            onFechar={() => setMetasAbertas(false)}
            mes={r.mes}
            numericas={r.metas.numericas}
            itens={r.metas.itens}
            onSalvo={() => void carregar()}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resumo
// ---------------------------------------------------------------------------

function ResumoDoMes({ r, mesAnteriorNome }: { r: Relatorio; mesAnteriorNome: string }) {
  const { resumo: a, resumoAnterior: b, variacoes: v } = r;
  const nomeMes = nomeDoMes(r.mes);
  const comparado = r.comparacaoParcial
    ? `no mesmo período de ${mesAnteriorNome}`
    : `em ${mesAnteriorNome}`;

  const frase =
    a.operacoes === 0 ? (
      <>Nenhuma recarga concluída {r.fechado ? `em ${nomeMes}` : 'até agora neste mês'}.</>
    ) : (
      <>
        {r.fechado ? `Em ${nomeMes}` : `Até agora em ${nomeMes}`}, sua rede fez{' '}
        <b className="text-on-surface">{fmtInt(a.operacoes)} recargas</b> para{' '}
        <b className="text-on-surface">{fmtInt(a.usuariosAtivos)} motoristas</b> e faturou{' '}
        <b className="text-on-surface">{fmtBRL(a.faturamento)}</b>
        {v.faturamento !== null && (
          <>
            {' '}
            <span
              className={
                v.faturamento >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }
            >
              ({fmtNum(Math.abs(v.faturamento), 1)}% {v.faturamento >= 0 ? 'a mais' : 'a menos'} que{' '}
              {comparado})
            </span>
          </>
        )}
        .
        {a.novosUsuarios > 0 && (
          <>
            {' '}
            <b className="text-on-surface">{fmtInt(a.novosUsuarios)}</b>{' '}
            {a.novosUsuarios === 1 ? 'pessoa carregou' : 'pessoas carregaram'} com você pela
            primeira vez.
          </>
        )}
      </>
    );

  const cards = [
    {
      rotulo: 'Faturamento',
      icone: 'payments',
      valor: fmtBRL(a.faturamento),
      vari: v.faturamento,
      antes: fmtBRL(b.faturamento),
    },
    {
      rotulo: 'Recargas',
      icone: 'bolt',
      valor: fmtInt(a.operacoes),
      vari: v.operacoes,
      antes: fmtInt(b.operacoes),
      ajuda: EXPLICA.recargas,
    },
    {
      rotulo: 'Motoristas',
      icone: 'group',
      valor: fmtInt(a.usuariosAtivos),
      vari: v.usuariosAtivos,
      antes: fmtInt(b.usuariosAtivos),
      ajuda: EXPLICA.motoristas,
    },
    {
      rotulo: 'Energia entregue',
      icone: 'electric_bolt',
      valor: fmtKwh(a.energiaKwh),
      vari: v.energiaKwh,
      antes: fmtKwh(b.energiaKwh),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-transparent to-transparent p-5 lg:p-6 print-avoid">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary mb-2">
          {r.fechado
            ? `Resumo de ${nomeMes}`
            : `${nomeMes.charAt(0).toUpperCase()}${nomeMes.slice(1)} até agora`}
        </p>
        <p className="text-lg lg:text-xl leading-relaxed text-on-surface-variant max-w-4xl">
          {frase}
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {cards.map(c => (
          <div
            key={c.rotulo}
            className="glass-panel rounded-xl border border-outline-variant/10 p-4 lg:p-5 flex flex-col gap-2 print-avoid"
          >
            <div className="flex items-center gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-lg text-primary">{c.icone}</span>
              <span className="text-sm font-medium">{c.rotulo}</span>
              {c.ajuda && <Ajuda texto={c.ajuda} />}
            </div>
            <span className="text-2xl lg:text-3xl font-headline font-bold text-on-surface">
              {c.valor}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Variacao valor={c.vari} />
              <span className="text-xs text-on-surface-variant">
                {mesAnteriorNome}: {c.antes}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Destaques({ r }: { r: Relatorio }) {
  const estilo = {
    positivo: {
      icone: 'thumb_up',
      cor: 'text-emerald-600 dark:text-emerald-400',
      fundo: 'bg-emerald-500/10',
    },
    alerta: {
      icone: 'priority_high',
      cor: 'text-amber-600 dark:text-amber-400',
      fundo: 'bg-amber-500/10',
    },
    info: { icone: 'info', cor: 'text-sky-600 dark:text-sky-400', fundo: 'bg-sky-500/10' },
  } as const;
  return (
    <Secao
      titulo="Destaques do mês"
      subtitulo="O que merece atenção nos números"
      icone="auto_awesome"
    >
      {r.leituras.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Nada fora do normal neste período.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {r.leituras.map((l, i) => {
            const e = estilo[l.tipo];
            return (
              <div key={i} className="flex gap-3 rounded-xl bg-surface-container-high/40 p-4">
                <span
                  className={`material-symbols-outlined h-9 w-9 shrink-0 rounded-full ${e.fundo} ${e.cor} inline-flex items-center justify-center text-xl`}
                >
                  {e.icone}
                </span>
                <div>
                  <p className="font-semibold text-on-surface text-sm">{l.titulo}</p>
                  <p className="text-sm text-on-surface-variant mt-0.5 leading-relaxed">
                    {l.texto}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Secao>
  );
}

function MaisNumeros({ r }: { r: Relatorio }) {
  const { resumo: a, variacoes: v } = r;
  const itens: Array<{
    rotulo: string;
    valor: string;
    ajuda: string;
    vari?: number | null;
    sufixo?: string;
  }> = [
    {
      rotulo: 'Preço médio do kWh',
      valor: a.precoMedioKwh === null ? '—' : fmtBRL(a.precoMedioKwh, 2),
      ajuda: EXPLICA.preco,
      vari: v.precoMedioKwh,
    },
    {
      rotulo: 'Valor médio por recarga',
      valor: a.ticketMedio === null ? '—' : fmtBRL(a.ticketMedio, 2),
      ajuda: EXPLICA.ticket,
      vari: v.ticketMedio,
    },
    {
      rotulo: 'Duração média da recarga',
      valor: a.duracaoMediaMin === null ? '—' : `${fmtInt(a.duracaoMediaMin)} min`,
      ajuda: 'Tempo médio entre o início e o fim de cada recarga.',
    },
    {
      rotulo: 'Uso dos carregadores',
      valor: fmtPct(a.ocupacaoPct, 0),
      ajuda: EXPLICA.uso,
      vari: v.ocupacaoPp,
      sufixo: ' pontos',
    },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {itens.map(i => (
        <div key={i.rotulo} className="rounded-xl bg-surface-container-high/40 px-4 py-3">
          <p className="text-xs text-on-surface-variant flex items-center gap-1">
            {i.rotulo} <Ajuda texto={i.ajuda} />
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold text-on-surface">{i.valor}</span>
            {i.vari !== undefined && <Variacao valor={i.vari} sufixo={i.sufixo} />}
          </div>
        </div>
      ))}
    </div>
  );
}

function Motoristas({ r }: { r: Relatorio }) {
  const { resumo: a, variacoes: v } = r;
  const cards = [
    {
      rotulo: 'Novos motoristas',
      icone: 'person_add',
      valor: fmtInt(a.novosUsuarios),
      detalhe: 'carregaram pela primeira vez',
      ajuda: EXPLICA.novos,
      vari: v.novosUsuarios,
      sufixo: '%',
    },
    {
      rotulo: 'Motoristas na base',
      icone: 'groups',
      valor: fmtInt(a.baseAcumulada),
      detalhe: `eram ${fmtInt(a.baseAcumulada - a.novosUsuarios)} no início do mês`,
      ajuda: EXPLICA.base,
      vari: v.baseAcumulada,
      sufixo: '%',
    },
    {
      rotulo: 'Motoristas ativos',
      icone: 'how_to_reg',
      valor: a.baseAtivaPct === null ? '—' : fmtPct(a.baseAtivaPct, 0),
      detalhe: `${fmtInt(a.usuariosAtivos)} de ${fmtInt(a.baseAcumulada)} voltaram a carregar`,
      ajuda: EXPLICA.ativos,
      vari: v.baseAtivaPp,
      sufixo: ' pontos',
    },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
      {cards.map(c => (
        <div
          key={c.rotulo}
          className="glass-panel rounded-xl border border-outline-variant/10 p-5 print-avoid"
        >
          <div className="flex items-center gap-2 text-on-surface-variant">
            <span className="material-symbols-outlined text-lg text-primary">{c.icone}</span>
            <span className="text-sm font-medium">{c.rotulo}</span>
            <Ajuda texto={c.ajuda} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-3xl font-headline font-bold text-on-surface">{c.valor}</span>
            <Variacao valor={c.vari} sufixo={c.sufixo} />
          </div>
          <p className="text-sm text-on-surface-variant mt-1">{c.detalhe}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gráficos e tabelas
// ---------------------------------------------------------------------------

function Trajetoria({
  serie,
  metrica,
  mesSelecionado,
}: {
  serie: PontoSerie[];
  metrica: ChaveSerie;
  mesSelecionado: string;
}) {
  const cfg = METRICAS_SERIE.find(m => m.id === metrica)!;
  const dados = serie.map(p => ({ mes: mesCurto(p.mes), chave: p.mes, valor: p[metrica] }));
  if (!dados.some(d => d.valor > 0)) return <Vazio texto="Sem dados no período" />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={dados} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#494847"
          strokeOpacity={0.3}
          vertical={false}
        />
        <XAxis
          dataKey="mes"
          tick={{ fill: '#adaaaa', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#adaaaa', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={60}
          tickFormatter={v => fmtCompacto(Number(v))}
        />
        <Tooltip
          {...tooltipStyle}
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          formatter={(v: number) => [cfg.fmt(v), cfg.rotulo]}
        />
        <Bar
          isAnimationActive={false}
          dataKey="valor"
          radius={[6, 6, 0, 0]}
          maxBarSize={48}
          label={{
            position: 'top',
            fill: '#adaaaa',
            fontSize: 10,
            formatter: (v: number) => fmtCompacto(v),
          }}
        >
          {dados.map(d => (
            <Cell
              key={d.chave}
              fill="var(--primary)"
              fillOpacity={d.chave === mesSelecionado ? 1 : 0.4}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function ThOrdenavel({
  coluna,
  children,
  alinhar = 'right',
  ordem,
  onOrdenar,
}: {
  coluna: ColunaTabela;
  children: ReactNode;
  alinhar?: 'left' | 'right';
  ordem: { coluna: ColunaTabela; desc: boolean };
  onOrdenar: (c: ColunaTabela) => void;
}) {
  return (
    <th
      className={`px-3 py-2 font-medium whitespace-nowrap ${alinhar === 'left' ? 'text-left' : 'text-right'}`}
    >
      <button
        type="button"
        onClick={() => onOrdenar(coluna)}
        className={`inline-flex items-center gap-0.5 hover:text-primary ${ordem.coluna === coluna ? 'text-primary' : ''}`}
      >
        {children}
        {ordem.coluna === coluna && (
          <span className="material-symbols-outlined text-sm">
            {ordem.desc ? 'arrow_downward' : 'arrow_upward'}
          </span>
        )}
      </button>
    </th>
  );
}

function Delta({ atual, anterior }: { atual: number; anterior: number }) {
  const v = variacaoPct(atual, anterior);
  if (v === null)
    return atual > 0 ? <span className="block text-[11px] text-sky-500">novo</span> : null;
  return (
    <span
      className={`block text-[11px] font-medium ${v >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
    >
      {fmtVar(v)}
    </span>
  );
}

const corDoUso = (pct: number) => (pct >= 60 ? VERMELHO : pct >= 40 ? AMBAR : VERDE);

function TabelaCarregadores({
  lista,
  ordem,
  onOrdenar,
  totalFaturamento,
}: {
  lista: Carregador[];
  ordem: { coluna: ColunaTabela; desc: boolean };
  onOrdenar: (c: ColunaTabela) => void;
  totalFaturamento: number;
}) {
  const [maisColunas, setMaisColunas] = useState(false);
  if (!lista.length) return <Vazio texto="Nenhum carregador encontrado" />;
  const th = { ordem, onOrdenar };
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto -mx-2">
        <table className={`w-full text-sm ${maisColunas ? 'min-w-[980px]' : 'min-w-[720px]'}`}>
          <thead className="text-xs text-on-surface-variant border-b border-outline-variant/20">
            <tr>
              <ThOrdenavel coluna="nome" alinhar="left" {...th}>
                Carregador
              </ThOrdenavel>
              <ThOrdenavel coluna="faturamento" {...th}>
                Faturamento
              </ThOrdenavel>
              <ThOrdenavel coluna="operacoes" {...th}>
                Recargas
              </ThOrdenavel>
              <ThOrdenavel coluna="energiaKwh" {...th}>
                Energia
              </ThOrdenavel>
              <ThOrdenavel coluna="ocupacaoPct" {...th}>
                Uso
              </ThOrdenavel>
              {maisColunas && (
                <>
                  <ThOrdenavel coluna="usuarios" {...th}>
                    Motoristas
                  </ThOrdenavel>
                  <ThOrdenavel coluna="novosUsuarios" {...th}>
                    Novos
                  </ThOrdenavel>
                  <ThOrdenavel coluna="precoMedioKwh" {...th}>
                    R$/kWh
                  </ThOrdenavel>
                  <ThOrdenavel coluna="ticketMedio" {...th}>
                    Por recarga
                  </ThOrdenavel>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {lista.map(c => {
              const participacao =
                totalFaturamento > 0 ? (c.faturamento / totalFaturamento) * 100 : 0;
              const cor = corDoUso(c.ocupacaoPct);
              return (
                <tr
                  key={c.chargePointId}
                  className="border-b border-outline-variant/10 hover:bg-surface-container-high/40"
                >
                  <td className="px-3 py-3">
                    <p className="font-medium text-on-surface">{c.nome}</p>
                    <p className="text-xs text-on-surface-variant">
                      {c.bairro || c.chargePointId}
                      {c.potenciaKw ? ` · ${fmtNum(c.potenciaKw, 0)} kW` : ''}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className="font-semibold text-on-surface">{fmtBRL(c.faturamento)}</span>
                    <span className="block text-[11px] text-on-surface-variant">
                      {fmtPct(participacao, 0)} do total
                    </span>
                    <Delta atual={c.faturamento} anterior={c.anterior.faturamento} />
                  </td>
                  <td className="px-3 py-3 text-right text-on-surface">
                    {fmtInt(c.operacoes)}
                    <Delta atual={c.operacoes} anterior={c.anterior.operacoes} />
                  </td>
                  <td className="px-3 py-3 text-right text-on-surface">
                    {fmtKwh(c.energiaKwh)}
                    <Delta atual={c.energiaKwh} anterior={c.anterior.energiaKwh} />
                  </td>
                  <td className="px-3 py-3 text-right w-36">
                    <span className="font-semibold" style={{ color: cor }}>
                      {fmtPct(c.ocupacaoPct, 0)}
                    </span>
                    <div className="mt-1 h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(100, c.ocupacaoPct)}%`, backgroundColor: cor }}
                      />
                    </div>
                  </td>
                  {maisColunas && (
                    <>
                      <td className="px-3 py-3 text-right text-on-surface">{fmtInt(c.usuarios)}</td>
                      <td className="px-3 py-3 text-right text-on-surface">
                        {fmtInt(c.novosUsuarios)}
                      </td>
                      <td className="px-3 py-3 text-right text-on-surface">
                        {c.precoMedioKwh === null ? '—' : fmtBRL(c.precoMedioKwh, 2)}
                      </td>
                      <td className="px-3 py-3 text-right text-on-surface">
                        {c.ticketMedio === null ? '—' : fmtBRL(c.ticketMedio, 2)}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={() => setMaisColunas(m => !m)}
        className="no-print inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
      >
        <span className="material-symbols-outlined text-base">
          {maisColunas ? 'unfold_less' : 'unfold_more'}
        </span>
        {maisColunas
          ? 'Mostrar menos colunas'
          : 'Mostrar mais colunas (motoristas, preço, valor por recarga)'}
      </button>
    </div>
  );
}

const alturaBarras = (n: number) => Math.max(200, n * 34 + 40);
const nomeCurto = (s: string) => (s.length > 26 ? `${s.slice(0, 25)}…` : s);

function Ocupacao({ lista }: { lista: Carregador[] }) {
  const dados = [...lista]
    .sort((a, b) => b.ocupacaoPct - a.ocupacaoPct)
    .map(c => ({
      nome: nomeCurto(c.nome),
      conectores: c.conectores,
      valor: c.ocupacaoPct,
      horas: c.horasOcupadas,
    }));
  if (!dados.length) return <Vazio texto="Nenhum carregador encontrado" />;
  const lotados = lista.filter(c => c.ocupacaoPct >= 60);
  return (
    <>
      <ResponsiveContainer width="100%" height={alturaBarras(dados.length)}>
        <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
          <XAxis
            type="number"
            domain={[0, (max: number) => Math.max(70, Math.ceil(max / 10) * 10)]}
            hide
          />
          <YAxis
            type="category"
            dataKey="nome"
            width={190}
            tick={{ fill: '#adaaaa', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            {...tooltipStyle}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            formatter={(v: number, _n, p) => [
              `${fmtPct(v, 0)} do tempo · ${fmtInt((p.payload as { horas: number }).horas)} horas`,
              'Uso',
            ]}
          />
          <ReferenceLine x={60} stroke={VERMELHO} strokeDasharray="4 4" />
          <Bar
            isAnimationActive={false}
            dataKey="valor"
            radius={[0, 6, 6, 0]}
            maxBarSize={20}
            label={{
              position: 'right',
              fill: '#adaaaa',
              fontSize: 10,
              formatter: (v: number) => fmtPct(v, 0),
            }}
          >
            {dados.map((d, i) => (
              <Cell key={i} fill={d.valor >= 60 ? VERMELHO : d.valor >= 40 ? AMBAR : VERDE} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-variant">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: VERDE }} />
          até 40%: tranquilo
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: AMBAR }} />
          40–60%: movimentado
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: VERMELHO }} />
          acima de 60%: pode ter fila
        </span>
      </div>
      {lotados.length > 0 && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          <b>{lotados.map(c => c.nome).join(', ')}</b> {lotados.length === 1 ? 'está' : 'estão'} com
          muito uso e pode haver fila nos horários de pico. Vale considerar mais conectores ou um
          ponto próximo.
        </p>
      )}
    </>
  );
}

function Usuarios({ lista }: { lista: Carregador[] }) {
  const dados = [...lista]
    .filter(c => c.usuarios > 0)
    .sort((a, b) => b.usuarios - a.usuarios)
    .map(c => ({ nome: nomeCurto(c.nome), usuarios: c.usuarios, novos: c.novosUsuarios }));
  if (!dados.length) return <Vazio texto="Nenhum motorista no período" />;
  return (
    <ResponsiveContainer width="100%" height={alturaBarras(dados.length) + 30}>
      <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="nome"
          width={170}
          tick={{ fill: '#adaaaa', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Legend wrapperStyle={{ fontSize: 12 }} verticalAlign="top" height={28} />
        <Bar
          isAnimationActive={false}
          dataKey="usuarios"
          name="Motoristas atendidos"
          fill={AZUL}
          radius={[0, 6, 6, 0]}
          maxBarSize={14}
          label={{ position: 'right', fill: '#adaaaa', fontSize: 10 }}
        />
        <Bar
          isAnimationActive={false}
          dataKey="novos"
          name="Novos motoristas"
          fill="var(--primary)"
          radius={[0, 6, 6, 0]}
          maxBarSize={14}
          label={{ position: 'right', fill: '#adaaaa', fontSize: 10 }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Bairros({ r }: { r: Relatorio }) {
  const lista = r.bairros;
  if (!lista.length) return <Vazio texto="Nenhum local encontrado" />;
  const maxNovos = Math.max(1, ...lista.map(b => b.novosUsuarios));
  const semBairro = lista.find(b => b.bairro === 'Sem bairro');
  const lideres = r.carregadores
    .filter(c => c.novosUsuarios > 0)
    .sort((a, b) => b.novosUsuarios - a.novosUsuarios)
    .slice(0, 3);
  return (
    <div className="space-y-5">
      {lideres.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {lideres.map((c, i) => (
            <div key={c.chargePointId} className="rounded-xl bg-surface-container-high/50 p-3">
              <p className="text-xs text-primary font-semibold">
                {['🥇', '🥈', '🥉'][i]} {i + 1}º lugar
              </p>
              <p className="text-2xl font-headline font-bold text-on-surface">
                {fmtInt(c.novosUsuarios)}
              </p>
              <p className="text-xs text-on-surface truncate" title={c.nome}>
                {c.nome}
              </p>
              <p className="text-[11px] text-on-surface-variant">
                {c.bairro || 'Bairro não informado'}
              </p>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-3">
        {lista.map(b => (
          <div key={b.bairro}>
            <div className="flex justify-between text-sm mb-1">
              <span
                className={`font-medium ${b.bairro === 'Sem bairro' ? 'text-on-surface-variant italic' : 'text-on-surface'}`}
              >
                {b.bairro === 'Sem bairro' ? 'Bairro não informado' : b.bairro}
              </span>
              <span className="text-on-surface-variant">
                <b className="text-on-surface">{fmtInt(b.novosUsuarios)}</b>{' '}
                {b.novosUsuarios === 1 ? 'novo' : 'novos'} · {fmtBRL(b.faturamento)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-container-highest overflow-hidden">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${(b.novosUsuarios / maxNovos) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      {semBairro && (
        <p className="text-xs text-on-surface-variant">
          Alguns locais estão sem bairro. Preencha em Locais › detalhes do local.
        </p>
      )}
    </div>
  );
}

function MapaDeCalor({ r }: { r: Relatorio }) {
  const [medida, setMedida] = useState<'operacoes' | 'energiaKwh'>('operacoes');
  const mapa = new Map(r.horarios.map(h => [`${h.dia}-${h.hora}`, h]));
  const max = Math.max(1, ...r.horarios.map(h => h[medida]));
  if (!r.horarios.length) return <Vazio texto="Nenhuma recarga no período" />;
  const pico = [...r.horarios].sort((a, b) => b[medida] - a[medida])[0];
  const porHora = Array.from({ length: 24 }, (_, h) =>
    r.horarios.filter(x => x.hora === h).reduce((s, x) => s + x[medida], 0)
  );
  const horaPico = porHora.indexOf(Math.max(...porHora));
  return (
    <div className="space-y-3">
      <Chips
        opcoes={[
          { id: 'operacoes', rotulo: 'Recargas' },
          { id: 'energiaKwh', rotulo: 'Energia' },
        ]}
        valor={medida}
        onChange={setMedida}
      />
      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <div
            className="grid gap-[3px]"
            style={{ gridTemplateColumns: '36px repeat(24, minmax(0, 1fr))' }}
          >
            <span />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="text-[9px] text-center text-on-surface-variant">
                {h % 3 === 0 ? `${h}h` : ''}
              </span>
            ))}
            {DIAS_SEMANA.map((dia, i) => (
              <FragmentoDia key={dia} dia={dia}>
                {Array.from({ length: 24 }, (_, h) => {
                  const cel = mapa.get(`${i + 1}-${h}`);
                  const valor = cel?.[medida] ?? 0;
                  return (
                    <div
                      key={h}
                      title={`${dia}, ${h}h: ${fmtInt(cel?.operacoes ?? 0)} recargas · ${fmtKwh(cel?.energiaKwh ?? 0)}`}
                      className="aspect-square rounded-[4px] bg-surface-container-highest"
                      style={
                        valor
                          ? {
                              backgroundColor: 'var(--primary)',
                              opacity: 0.15 + 0.85 * (valor / max),
                            }
                          : undefined
                      }
                    />
                  );
                })}
              </FragmentoDia>
            ))}
          </div>
        </div>
      </div>
      <p className="text-sm text-on-surface-variant">
        Horário mais procurado:{' '}
        <b className="text-on-surface">
          {horaPico}h às {horaPico + 1}h
        </b>
        . Dia e hora de maior movimento:{' '}
        <b className="text-on-surface">
          {DIAS_SEMANA[pico.dia - 1]}, {pico.hora}h
        </b>
        .
      </p>
    </div>
  );
}

const FragmentoDia = ({ dia, children }: { dia: string; children: ReactNode }) => (
  <>
    <span className="text-[10px] text-on-surface-variant self-center">{dia}</span>
    {children}
  </>
);

function Metas({ r, onDefinir }: { r: Relatorio; onDefinir: () => void }) {
  const definidas = r.metas.numericas.filter(n => n.meta !== null);
  const itens = r.metas.itens;
  if (!definidas.length && !itens.length) {
    return (
      <div className="flex flex-col items-center text-center gap-3 py-6">
        <span className="material-symbols-outlined text-4xl text-outline">flag</span>
        <p className="text-sm text-on-surface-variant max-w-md">
          Defina quanto quer faturar, quantas recargas espera e outras metas do mês. O resultado é
          comparado automaticamente e aparece também na apresentação.
        </p>
        <button
          type="button"
          onClick={onDefinir}
          className="no-print rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
        >
          Definir metas de {nomeDoMes(r.mes)}
        </button>
      </div>
    );
  }
  const fmtMeta = (unidade: string, n: number) =>
    unidade === 'R$'
      ? fmtBRL(n)
      : unidade === '%'
        ? fmtPct(n, 0)
        : unidade === 'kWh'
          ? fmtKwh(n)
          : fmtInt(n);
  const contagem = (st: string) =>
    itens.filter(i => i.status === st).length +
    definidas.filter(n => n.avaliacao?.status === st).length;
  const areas = [...new Set(itens.map(i => i.area))];

  return (
    <div className="space-y-5">
      {definidas.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {definidas.map(n => {
            const st = n.avaliacao ? STATUS_META[n.avaliacao.status] : null;
            const pct = Math.min(100, n.avaliacao?.atingidoPct ?? 0);
            return (
              <div key={n.chave} className="rounded-xl bg-surface-container-high/50 p-4">
                <div className="flex justify-between items-start gap-2">
                  <p className="text-sm font-medium text-on-surface-variant">
                    {ROTULO_META[n.chave] ?? n.rotulo}
                  </p>
                  {st && (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${st.classe}`}
                    >
                      {st.rotulo}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-2xl font-headline font-bold text-on-surface">
                  {fmtMeta(n.unidade, n.resultado)}
                </p>
                <p className="text-xs text-on-surface-variant">
                  de {fmtMeta(n.unidade, n.meta!)}
                  {n.avaliacao?.atingidoPct != null && n.unidade !== '%'
                    ? ` · ${fmtPct(n.avaliacao.atingidoPct, 0)} da meta`
                    : ''}
                </p>
                <div className="mt-2 h-2 rounded-full bg-surface-container-highest overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: `#${st?.cor ?? '64748B'}` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {itens.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {areas.map(area => (
            <div key={area} className="rounded-xl border border-outline-variant/15 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">
                {area}
              </p>
              <ul className="space-y-2.5">
                {itens
                  .filter(i => i.area === area)
                  .map((it, idx) => (
                    <li key={idx} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-on-surface">{it.descricao}</p>
                        {it.resultado && (
                          <p className="text-xs text-on-surface-variant">
                            Resultado: {it.resultado}
                          </p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_META[it.status].classe}`}
                      >
                        {STATUS_META[it.status].rotulo}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <p className="text-sm text-on-surface">
        <b>{contagem('bateu')}</b> batidas · <b>{contagem('nao_bateu')}</b> não batidas ·{' '}
        <b>{contagem('quase')}</b> quase lá
        {contagem('em_andamento') ? ` · ${contagem('em_andamento')} em andamento` : ''}
        {contagem('dispensada') ? ` · ${contagem('dispensada')} dispensadas` : ''}
        {contagem('pendente') ? ` · ${contagem('pendente')} pendentes` : ''}
      </p>
    </div>
  );
}

function ProjecaoView({
  r,
  metrica,
}: {
  r: Relatorio;
  metrica: 'faturamento' | 'energiaKwh' | 'operacoes' | 'usuariosAtivos';
}) {
  const p = r.projecao;
  if (!p.base || !p.meses.length)
    return <Vazio texto="São necessários pelo menos 3 meses com recargas para estimar" />;
  const fmt = METRICAS_SERIE.find(m => m.id === metrica)!.fmt;
  const reais = r.serie.filter(s => s.mes <= p.base!).slice(-6);
  const dados = [
    ...reais.map(s => ({
      mes: mesCurto(s.mes),
      real: s[metrica],
      projetado: null as number | null,
    })),
    ...p.meses.map(m => ({
      mes: mesCurto(m.mes),
      real: null as number | null,
      projetado: m[metrica],
    })),
  ];
  const ultimo = p.meses[p.meses.length - 1];
  const resumo: Array<{
    chave: 'faturamento' | 'energiaKwh' | 'operacoes' | 'usuariosAtivos';
    rotulo: string;
  }> = [
    { chave: 'faturamento', rotulo: 'Faturamento' },
    { chave: 'operacoes', rotulo: 'Recargas' },
    { chave: 'usuariosAtivos', rotulo: 'Motoristas' },
    { chave: 'energiaKwh', rotulo: 'Energia' },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {resumo.map(x => {
          const cfgFmt = METRICAS_SERIE.find(m => m.id === x.chave)!.fmt;
          const taxa = p.taxas[x.chave];
          return (
            <div
              key={x.chave}
              className={`rounded-xl p-3 ${x.chave === metrica ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-surface-container-high/50'}`}
            >
              <p className="text-xs text-on-surface-variant">
                {x.rotulo} em {mesCurto(ultimo.mes)}
              </p>
              <p className="text-lg font-headline font-bold text-on-surface">
                {ultimo[x.chave] === null ? '—' : cfgFmt(ultimo[x.chave]!)}
              </p>
              <p className="text-xs text-on-surface-variant">
                {taxa === null ? 'histórico insuficiente' : `crescendo ${fmtNum(taxa, 0)}% ao mês`}
              </p>
            </div>
          );
        })}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={dados} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#494847"
            strokeOpacity={0.3}
            vertical={false}
          />
          <XAxis
            dataKey="mes"
            tick={{ fill: '#adaaaa', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#adaaaa', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={60}
            tickFormatter={v => fmtCompacto(Number(v))}
          />
          <Tooltip
            {...tooltipStyle}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            formatter={(v: number, nome: string) => [fmt(v), nome]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} verticalAlign="top" height={28} />
          <Bar
            isAnimationActive={false}
            dataKey="real"
            name="Realizado"
            stackId="p"
            fill="var(--primary)"
            radius={[6, 6, 0, 0]}
            maxBarSize={44}
            label={{
              position: 'top',
              fill: '#adaaaa',
              fontSize: 10,
              formatter: (v: number | null) => (v ? fmtCompacto(v) : ''),
            }}
          />
          <Bar
            isAnimationActive={false}
            dataKey="projetado"
            name="Estimativa"
            stackId="p"
            fill="var(--primary)"
            fillOpacity={0.3}
            stroke="var(--primary)"
            strokeDasharray="4 3"
            radius={[6, 6, 0, 0]}
            maxBarSize={44}
            label={{
              position: 'top',
              fill: '#adaaaa',
              fontSize: 10,
              formatter: (v: number | null) => (v ? fmtCompacto(v) : ''),
            }}
          />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-on-surface-variant">
        É uma estimativa simples: não leva em conta novos pontos, carregadores lotados ou meses mais
        fracos do ano.
      </p>
    </div>
  );
}
