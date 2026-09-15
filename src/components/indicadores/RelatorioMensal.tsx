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
  type PontoSerie,
  type RelatorioMensal as Relatorio,
} from './tipos';

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

function Variacao({
  valor,
  sufixo = '%',
  inverter = false,
}: {
  valor: number | null;
  sufixo?: string;
  inverter?: boolean;
}) {
  if (valor === null)
    return <span className="text-[11px] text-on-surface-variant">sem base de comparação</span>;
  const bom = inverter ? valor <= 0 : valor >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${bom ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
    >
      <span className="material-symbols-outlined text-[14px] leading-none">
        {valor >= 0 ? 'trending_up' : 'trending_down'}
      </span>
      {fmtVar(valor, sufixo)}
    </span>
  );
}

function Secao({
  titulo,
  subtitulo,
  icone,
  acoes,
  children,
  className = '',
}: {
  titulo: string;
  subtitulo?: string;
  icone: string;
  acoes?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`glass-panel rounded-lg border border-outline-variant/10 p-5 lg:p-6 print-avoid ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="font-headline text-base font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">{icone}</span>
            {titulo}
          </h3>
          {subtitulo && <p className="text-xs text-on-surface-variant mt-1">{subtitulo}</p>}
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
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
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
// Métricas selecionáveis
// ---------------------------------------------------------------------------

type ChaveSerie = keyof Omit<PontoSerie, 'mes'>;
const METRICAS_SERIE: Array<{ id: ChaveSerie; rotulo: string; fmt: (n: number) => string }> = [
  { id: 'faturamento', rotulo: 'Faturamento', fmt: n => fmtBRL(n) },
  { id: 'energiaKwh', rotulo: 'Energia', fmt: n => fmtKwh(n) },
  { id: 'operacoes', rotulo: 'Transações', fmt: fmtInt },
  { id: 'usuariosAtivos', rotulo: 'Usuários no mês', fmt: fmtInt },
  { id: 'novosUsuarios', rotulo: 'Novos usuários', fmt: fmtInt },
  { id: 'baseAcumulada', rotulo: 'Base acumulada', fmt: fmtInt },
];

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
      'Faturamento anterior (R$)',
      'Energia (kWh)',
      'Energia anterior (kWh)',
      'Operações',
      'Operações anteriores',
      'Usuários',
      'Novos usuários',
      'Horas ocupadas',
      'Horas disponíveis',
      'Ocupação (%)',
      'Preço médio (R$/kWh)',
      'Ticket médio (R$)',
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
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carregadores_${dados.mes}${dados.fechado ? '' : '_parcial'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const mesMaximo = mesAtualLocal();
  const r = dados;
  const refAnterior = r
    ? r.comparacaoParcial
      ? `mesmo período de ${nomeDoMes(r.periodoAnterior.ini.slice(0, 7))}`
      : nomeDoMes(r.periodoAnterior.ini.slice(0, 7))
    : '';

  return (
    <div className="space-y-6">
      {/* Barra de controle */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 no-print">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={() => setMes(m => somarMeses(m, -1))}
            className="h-10 w-10 inline-flex items-center justify-center rounded-lg bg-surface-container-high text-on-surface hover:text-primary"
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <input
            type="month"
            value={mes}
            max={mesMaximo}
            onChange={e => e.target.value && setMes(e.target.value)}
            className="h-10 rounded-lg bg-surface-container-high border border-outline-variant/20 px-3 text-sm text-on-surface"
          />
          <button
            type="button"
            aria-label="Próximo mês"
            disabled={mes >= mesMaximo}
            onClick={() => setMes(m => somarMeses(m, 1))}
            className="h-10 w-10 inline-flex items-center justify-center rounded-lg bg-surface-container-high text-on-surface hover:text-primary disabled:opacity-40"
          >
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
          {r && (
            <span
              className={`ml-1 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${r.fechado ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-sky-500/15 text-sky-600 dark:text-sky-400'}`}
            >
              <span className="material-symbols-outlined text-sm">
                {r.fechado ? 'task_alt' : 'schedule'}
              </span>
              {r.fechado
                ? 'Mês fechado'
                : `Parcial até ${fmtDataHora(r.periodo.fim)} · comparado ao ${refAnterior}`}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void carregar()}
            disabled={carregando}
            className="h-10 px-3 inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-on-surface-variant bg-surface-container-high hover:text-primary"
          >
            <span
              className={`material-symbols-outlined text-lg ${carregando ? 'animate-spin' : ''}`}
            >
              refresh
            </span>
            Atualizar
          </button>
          <button
            type="button"
            onClick={() => setMetasAbertas(true)}
            disabled={!r}
            className="h-10 px-3 inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-on-surface bg-surface-container-high hover:text-primary disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">flag</span>
            Metas
          </button>
          <button
            type="button"
            onClick={exportarCsv}
            disabled={!r}
            className="h-10 px-3 inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-on-surface bg-surface-container-high hover:text-primary disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">table_view</span>
            CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!r}
            className="h-10 px-3 inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-on-surface bg-surface-container-high hover:text-primary disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">print</span>
            Imprimir / PDF
          </button>
          <button
            type="button"
            onClick={() => void exportarPptx()}
            disabled={!r || exportando}
            className="h-10 px-4 inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold bg-primary text-on-primary disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-lg">slideshow</span>
            {exportando ? 'Gerando…' : 'Baixar apresentação'}
          </button>
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
            Calculando o relatório de {mesPorExtenso(mes)}…
          </p>
        </div>
      )}

      {r && (
        <div className={`space-y-6 transition-opacity ${carregando ? 'opacity-60' : ''}`}>
          <div className="hidden print:block">
            <h1 className="text-2xl font-bold">Performance da Rede — {mesPorExtenso(r.mes)}</h1>
            <p className="text-sm">
              {empresa} · {r.fechado ? 'mês fechado' : `parcial até ${fmtDataHora(r.periodo.fim)}`}
            </p>
          </div>

          <Kpis r={r} refAnterior={refAnterior} />

          <Secao
            titulo="Trajetória"
            subtitulo={`Últimos ${r.serie.length} meses — ${mesCurto(r.serie[0].mes)} a ${mesCurto(r.mes)}${r.fechado ? '' : ' (mês atual parcial)'}`}
            icone="stacked_bar_chart"
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

          <Secao
            titulo="Desempenho por carregador"
            subtitulo={`${mesPorExtenso(r.mes)} · variação vs ${refAnterior} · clique no título da coluna para ordenar`}
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
              titulo="Taxa de ocupação"
              subtitulo="Horas com veículo conectado ÷ horas disponíveis (24h por conector)"
              icone="timelapse"
            >
              <Ocupacao lista={r.carregadores} />
            </Secao>
            <Secao
              titulo="Usuários por carregador"
              subtitulo="Total no período x novos (1ª recarga na rede)"
              icone="group_add"
            >
              <Usuarios lista={r.carregadores} />
            </Secao>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Secao
              titulo="Onde a rede está crescendo"
              subtitulo="Novos usuários e faturamento por bairro do local"
              icone="location_city"
            >
              <Bairros r={r} />
            </Secao>
            <Secao
              titulo="Horários de pico"
              subtitulo="Recargas iniciadas por dia da semana e hora"
              icone="calendar_view_week"
            >
              <MapaDeCalor r={r} />
            </Secao>
          </div>

          <Secao
            titulo={`Metas de ${nomeDoMes(r.mes)}`}
            subtitulo={
              r.metas.definidas
                ? 'Resultado do período frente às metas definidas'
                : 'Nenhuma meta definida para este mês'
            }
            icone="flag"
            acoes={
              <button
                type="button"
                onClick={() => setMetasAbertas(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <span className="material-symbols-outlined text-base">edit</span>
                {r.metas.definidas ? 'Editar metas' : 'Definir metas'}
              </button>
            }
          >
            <Metas r={r} />
          </Secao>

          <Secao
            titulo="Projeção"
            subtitulo={
              r.projecao.base
                ? `Mantendo o crescimento composto observado até ${mesCurto(r.projecao.base)} (último mês fechado)`
                : 'Histórico insuficiente para projetar'
            }
            icone="query_stats"
            acoes={
              <Chips
                opcoes={[
                  { id: 'faturamento', rotulo: 'Faturamento' },
                  { id: 'energiaKwh', rotulo: 'Energia' },
                  { id: 'operacoes', rotulo: 'Transações' },
                  { id: 'usuariosAtivos', rotulo: 'Usuários' },
                ]}
                valor={metricaProjecao}
                onChange={setMetricaProjecao}
              />
            }
          >
            <ProjecaoView r={r} metrica={metricaProjecao} />
          </Secao>

          <Secao
            titulo="Leituras e próximos passos"
            subtitulo="Pontos de atenção gerados a partir dos números — revise antes de levar para a reunião"
            icone="lightbulb"
          >
            {r.leituras.length === 0 ? (
              <p className="text-sm text-on-surface-variant">Nada fora do normal neste período.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {r.leituras.map((l, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border-l-4 bg-surface-container-high/50 p-4 ${l.tipo === 'positivo' ? 'border-emerald-500' : l.tipo === 'alerta' ? 'border-red-500' : 'border-sky-500'}`}
                  >
                    <p className="font-semibold text-on-surface text-sm">{l.titulo}</p>
                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                      {l.texto}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Secao>

          <details className="glass-panel rounded-lg border border-outline-variant/10 p-5 text-sm text-on-surface-variant no-print">
            <summary className="cursor-pointer font-semibold text-on-surface">
              Como os números são calculados
            </summary>
            <ul className="mt-3 space-y-1.5 list-disc pl-5 text-xs leading-relaxed">
              <li>
                <b>Operação</b>: recarga finalizada com energia entregue. Recargas em andamento ou
                sem energia não entram.
              </li>
              <li>
                <b>Usuários no mês</b>: pessoas diferentes que carregaram no período.
              </li>
              <li>
                <b>Novo usuário</b>: a 1ª recarga da pessoa na rede caiu no período. Ele conta só no
                carregador dessa 1ª recarga, então a soma por carregador e por bairro bate com o
                total.
              </li>
              <li>
                <b>Base acumulada</b>: quem já carregou ao menos uma vez até o fim do período.{' '}
                <b>Base ativa</b> = usuários no mês ÷ base acumulada.
              </li>
              <li>
                <b>Ocupação</b>: horas com veículo conectado ÷ (24h × dias × conectores). Sessões
                acima de 24h são limitadas a 24h.
              </li>
              <li>
                <b>Mês em andamento</b>: compara com o mesmo número de dias e horas do mês anterior.
              </li>
              <li>
                <b>Projeção</b>: crescimento composto mensal dos últimos meses fechados (até 7
                intervalos), limitado a +100% ao mês.
              </li>
              <li>
                Datas no fuso {r.fuso.replace('_', ' ')}. Bairro vem do cadastro do local
                (preenchido pelo CEP quando vazio).
              </li>
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
// Blocos
// ---------------------------------------------------------------------------

function Kpis({ r, refAnterior }: { r: Relatorio; refAnterior: string }) {
  const { resumo: a, resumoAnterior: b, variacoes: v } = r;
  const cards: Array<{
    rotulo: string;
    valor: string;
    icone: string;
    variacao: ReactNode;
    detalhe: string;
  }> = [
    {
      rotulo: 'Faturamento',
      valor: fmtBRL(a.faturamento),
      icone: 'payments',
      variacao: <Variacao valor={v.faturamento} />,
      detalhe: `${fmtBRL(b.faturamento)} no ${refAnterior}`,
    },
    {
      rotulo: 'Energia fornecida',
      valor: fmtKwh(a.energiaKwh),
      icone: 'electric_bolt',
      variacao: <Variacao valor={v.energiaKwh} />,
      detalhe: `${fmtKwh(b.energiaKwh)} no ${refAnterior}`,
    },
    {
      rotulo: 'Operações',
      valor: fmtInt(a.operacoes),
      icone: 'bolt',
      variacao: <Variacao valor={v.operacoes} />,
      detalhe: `${fmtInt(b.operacoes)} no ${refAnterior}`,
    },
    {
      rotulo: 'Usuários no mês',
      valor: fmtInt(a.usuariosAtivos),
      icone: 'group',
      variacao: <Variacao valor={v.usuariosAtivos} />,
      detalhe: `${fmtInt(b.usuariosAtivos)} no ${refAnterior}`,
    },
    {
      rotulo: 'Novos usuários',
      valor: fmtInt(a.novosUsuarios),
      icone: 'person_add',
      variacao: <Variacao valor={v.novosUsuarios} />,
      detalhe: `Base: ${fmtInt(a.baseAcumulada - a.novosUsuarios)} → ${fmtInt(a.baseAcumulada)}`,
    },
    {
      rotulo: 'Base acumulada',
      valor: fmtInt(a.baseAcumulada),
      icone: 'groups',
      variacao: <Variacao valor={v.baseAcumulada} />,
      detalhe: 'Já carregaram ao menos uma vez',
    },
    {
      rotulo: 'Base ativa',
      valor: a.baseAtivaPct === null ? '—' : fmtPct(a.baseAtivaPct),
      icone: 'how_to_reg',
      variacao: <Variacao valor={v.baseAtivaPp} sufixo=" p.p." />,
      detalhe: `${fmtInt(a.usuariosAtivos)} de ${fmtInt(a.baseAcumulada)} usuários`,
    },
    {
      rotulo: 'Ocupação média',
      valor: fmtPct(a.ocupacaoPct),
      icone: 'timelapse',
      variacao: <Variacao valor={v.ocupacaoPp} sufixo=" p.p." />,
      detalhe: `${a.carregadoresAtivos} carregadores com recarga`,
    },
  ];
  const secundarios = [
    {
      rotulo: 'Preço médio',
      valor: a.precoMedioKwh === null ? '—' : `${fmtBRL(a.precoMedioKwh, 2)}/kWh`,
      variacao: v.precoMedioKwh,
    },
    {
      rotulo: 'Ticket médio',
      valor: a.ticketMedio === null ? '—' : fmtBRL(a.ticketMedio, 2),
      variacao: v.ticketMedio,
    },
    {
      rotulo: 'Duração média',
      valor: a.duracaoMediaMin === null ? '—' : `${fmtInt(a.duracaoMediaMin)} min`,
      variacao: null as number | null,
    },
    {
      rotulo: 'Energia por operação',
      valor: a.operacoes ? `${fmtNum(a.energiaKwh / a.operacoes, 1)} kWh` : '—',
      variacao: null as number | null,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {cards.map(c => (
          <div
            key={c.rotulo}
            className="glass-panel rounded-lg border border-outline-variant/10 p-4 lg:p-5 flex flex-col gap-1 print-avoid"
          >
            <div className="flex justify-between items-start">
              <span className="text-on-surface-variant text-[11px] uppercase tracking-widest">
                {c.rotulo}
              </span>
              <span className="material-symbols-outlined text-base text-primary">{c.icone}</span>
            </div>
            <span className="text-xl lg:text-2xl font-headline font-bold text-on-surface">
              {c.valor}
            </span>
            {c.variacao}
            <span className="text-[11px] text-on-surface-variant truncate" title={c.detalhe}>
              {c.detalhe}
            </span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {secundarios.map(s => (
          <div
            key={s.rotulo}
            className="rounded-lg bg-surface-container-high/50 px-4 py-2.5 flex items-center justify-between gap-2"
          >
            <span className="text-[11px] uppercase tracking-widest text-on-surface-variant">
              {s.rotulo}
            </span>
            <span className="text-right">
              <span className="block text-sm font-semibold text-on-surface">{s.valor}</span>
              {s.variacao !== null && <Variacao valor={s.variacao} />}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
        <Bar isAnimationActive={false}
          dataKey="valor"
          radius={[4, 4, 0, 0]}
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
              fillOpacity={d.chave === mesSelecionado ? 1 : 0.45}
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
      className={`px-3 py-2 font-semibold whitespace-nowrap ${alinhar === 'left' ? 'text-left' : 'text-right'}`}
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
    return atual > 0 ? <span className="block text-[10px] text-sky-500">novo</span> : null;
  return (
    <span
      className={`block text-[10px] font-semibold ${v >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
    >
      {fmtVar(v)}
    </span>
  );
}

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
  if (!lista.length) return <Vazio texto="Nenhum carregador no escopo" />;
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm min-w-[980px]">
        <thead className="text-[11px] uppercase tracking-wider text-on-surface-variant border-b border-outline-variant/20">
          <tr>
            <ThOrdenavel coluna="nome" alinhar="left" ordem={ordem} onOrdenar={onOrdenar}>
              Carregador
            </ThOrdenavel>
            <ThOrdenavel coluna="faturamento" ordem={ordem} onOrdenar={onOrdenar}>
              Faturamento
            </ThOrdenavel>
            <ThOrdenavel coluna="energiaKwh" ordem={ordem} onOrdenar={onOrdenar}>
              Energia
            </ThOrdenavel>
            <ThOrdenavel coluna="operacoes" ordem={ordem} onOrdenar={onOrdenar}>
              Operações
            </ThOrdenavel>
            <ThOrdenavel coluna="ocupacaoPct" ordem={ordem} onOrdenar={onOrdenar}>
              Ocupação
            </ThOrdenavel>
            <ThOrdenavel coluna="usuarios" ordem={ordem} onOrdenar={onOrdenar}>
              Usuários
            </ThOrdenavel>
            <ThOrdenavel coluna="novosUsuarios" ordem={ordem} onOrdenar={onOrdenar}>
              Novos
            </ThOrdenavel>
            <ThOrdenavel coluna="precoMedioKwh" ordem={ordem} onOrdenar={onOrdenar}>
              R$/kWh
            </ThOrdenavel>
            <ThOrdenavel coluna="ticketMedio" ordem={ordem} onOrdenar={onOrdenar}>
              Ticket
            </ThOrdenavel>
          </tr>
        </thead>
        <tbody>
          {lista.map(c => {
            const participacao =
              totalFaturamento > 0 ? (c.faturamento / totalFaturamento) * 100 : 0;
            const corOcup = c.ocupacaoPct >= 60 ? VERMELHO : c.ocupacaoPct >= 40 ? AMBAR : VERDE;
            return (
              <tr
                key={c.chargePointId}
                className="border-b border-outline-variant/10 hover:bg-surface-container-high/40"
              >
                <td className="px-3 py-2.5">
                  <p className="font-medium text-on-surface">{c.nome}</p>
                  <p className="text-[11px] text-on-surface-variant">
                    {c.chargePointId} · {c.conectores} con.
                    {c.potenciaKw ? ` · ${fmtNum(c.potenciaKw, 0)} kW` : ''}
                    {c.bairro ? ` · ${c.bairro}` : ''}
                  </p>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="font-semibold text-on-surface">{fmtBRL(c.faturamento)}</span>
                  <span className="block text-[10px] text-on-surface-variant">
                    {fmtPct(participacao)} da rede
                  </span>
                  <Delta atual={c.faturamento} anterior={c.anterior.faturamento} />
                </td>
                <td className="px-3 py-2.5 text-right text-on-surface">
                  {fmtKwh(c.energiaKwh)}
                  <Delta atual={c.energiaKwh} anterior={c.anterior.energiaKwh} />
                </td>
                <td className="px-3 py-2.5 text-right text-on-surface">
                  {fmtInt(c.operacoes)}
                  <Delta atual={c.operacoes} anterior={c.anterior.operacoes} />
                </td>
                <td className="px-3 py-2.5 text-right w-40">
                  <span className="font-semibold" style={{ color: corOcup }}>
                    {fmtPct(c.ocupacaoPct)}
                  </span>
                  <div className="mt-1 h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, c.ocupacaoPct)}%`,
                        backgroundColor: corOcup,
                      }}
                    />
                  </div>
                  <span className="block text-[10px] text-on-surface-variant mt-0.5">
                    {fmtInt(c.horasOcupadas)}h de {fmtInt(c.horasDisponiveis)}h
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right text-on-surface">{fmtInt(c.usuarios)}</td>
                <td className="px-3 py-2.5 text-right text-on-surface">
                  {fmtInt(c.novosUsuarios)}
                </td>
                <td className="px-3 py-2.5 text-right text-on-surface">
                  {c.precoMedioKwh === null ? '—' : fmtBRL(c.precoMedioKwh, 2)}
                </td>
                <td className="px-3 py-2.5 text-right text-on-surface">
                  {c.ticketMedio === null ? '—' : fmtBRL(c.ticketMedio, 2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
  if (!dados.length) return <Vazio texto="Nenhum carregador no escopo" />;
  const saturados = lista.filter(c => c.ocupacaoPct >= 60);
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
              `${fmtPct(v)} · ${fmtInt((p.payload as { horas: number }).horas)}h · ${(p.payload as { conectores: number }).conectores} con.`,
              'Ocupação',
            ]}
          />
          <ReferenceLine
            x={60}
            stroke={VERMELHO}
            strokeDasharray="4 4"
            label={{ value: '60%', fill: VERMELHO, fontSize: 10, position: 'top' }}
          />
          <Bar isAnimationActive={false}
            dataKey="valor"
            radius={[0, 4, 4, 0]}
            maxBarSize={20}
            label={{
              position: 'right',
              fill: '#adaaaa',
              fontSize: 10,
              formatter: (v: number) => fmtPct(v),
            }}
          >
            {dados.map((d, i) => (
              <Cell key={i} fill={d.valor >= 60 ? VERMELHO : d.valor >= 40 ? AMBAR : AZUL} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {saturados.length > 0 && (
        <p className="mt-3 text-xs text-red-600 dark:text-red-400">
          <b>{saturados.map(c => c.nome).join(', ')}</b> acima de 60%: tende a formar fila no pico.
          Avalie mais conectores ou um ponto próximo.
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
  if (!dados.length) return <Vazio texto="Nenhum usuário no período" />;
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
        <Legend wrapperStyle={{ fontSize: 11 }} verticalAlign="top" height={28} />
        <Bar isAnimationActive={false}
          dataKey="usuarios"
          name="Usuários no período"
          fill={AZUL}
          radius={[0, 4, 4, 0]}
          maxBarSize={14}
          label={{ position: 'right', fill: '#adaaaa', fontSize: 10 }}
        />
        <Bar isAnimationActive={false}
          dataKey="novos"
          name="Novos usuários"
          fill="var(--primary)"
          radius={[0, 4, 4, 0]}
          maxBarSize={14}
          label={{ position: 'right', fill: '#adaaaa', fontSize: 10 }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Bairros({ r }: { r: Relatorio }) {
  const lista = r.bairros;
  if (!lista.length) return <Vazio texto="Nenhum local no escopo" />;
  const maxNovos = Math.max(1, ...lista.map(b => b.novosUsuarios));
  const semBairro = lista.find(b => b.bairro === 'Sem bairro');
  const lider = r.carregadores
    .filter(c => c.novosUsuarios > 0)
    .sort((a, b) => b.novosUsuarios - a.novosUsuarios)
    .slice(0, 3);
  return (
    <div className="space-y-5">
      {lider.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {lider.map((c, i) => (
            <div key={c.chargePointId} className="rounded-lg bg-surface-container-high/50 p-3">
              <p className="text-[10px] uppercase tracking-widest text-primary font-bold">
                {i + 1}º em novos usuários
              </p>
              <p className="text-2xl font-headline font-bold text-on-surface">
                {fmtInt(c.novosUsuarios)}
              </p>
              <p className="text-xs text-on-surface truncate" title={c.nome}>
                {c.nome}
              </p>
              <p className="text-[11px] text-on-surface-variant">
                {c.bairro ? `Bairro: ${c.bairro}` : 'Sem bairro cadastrado'}
              </p>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-2.5">
        {lista.map(b => (
          <div key={b.bairro}>
            <div className="flex justify-between text-xs mb-1">
              <span
                className={`font-medium ${b.bairro === 'Sem bairro' ? 'text-on-surface-variant italic' : 'text-on-surface'}`}
              >
                {b.bairro}{' '}
                <span className="text-on-surface-variant font-normal">
                  · {b.carregadores} carreg.
                </span>
              </span>
              <span className="text-on-surface-variant">
                <b className="text-on-surface">{fmtInt(b.novosUsuarios)}</b> novos ·{' '}
                {fmtBRL(b.faturamento)}
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
        <p className="text-[11px] text-on-surface-variant">
          Locais sem bairro: preencha em Locais › detalhes do local (o CEP preenche sozinho).
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
          { id: 'operacoes', rotulo: 'Operações' },
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
                {h % 3 === 0 ? h : ''}
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
                      title={`${dia} ${h}h: ${fmtInt(cel?.operacoes ?? 0)} operações · ${fmtKwh(cel?.energiaKwh ?? 0)}`}
                      className="aspect-square rounded-[3px] bg-surface-container-highest"
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
      <p className="text-xs text-on-surface-variant">
        Pico:{' '}
        <b className="text-on-surface">
          {DIAS_SEMANA[pico.dia - 1]} às {pico.hora}h
        </b>{' '}
        · horário mais movimentado no geral:{' '}
        <b className="text-on-surface">
          {horaPico}h–{horaPico + 1}h
        </b>
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

function Metas({ r }: { r: Relatorio }) {
  const definidas = r.metas.numericas.filter(n => n.meta !== null);
  const itens = r.metas.itens;
  if (!definidas.length && !itens.length) {
    return (
      <p className="text-sm text-on-surface-variant">
        Defina metas numéricas (faturamento, transações, usuários, base ativa) e metas por área. O
        resultado é comparado automaticamente e entra na apresentação.
      </p>
    );
  }
  const fmtMeta = (unidade: string, n: number) =>
    unidade === 'R$'
      ? fmtBRL(n)
      : unidade === '%'
        ? fmtPct(n)
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
              <div key={n.chave} className="rounded-lg bg-surface-container-high/50 p-4">
                <div className="flex justify-between items-start gap-2">
                  <p className="text-xs uppercase tracking-widest text-on-surface-variant">
                    {n.rotulo}
                  </p>
                  {st && (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${st.classe}`}
                    >
                      {st.rotulo}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xl font-headline font-bold text-on-surface">
                  {fmtMeta(n.unidade, n.resultado)}
                </p>
                <p className="text-xs text-on-surface-variant">
                  Meta {fmtMeta(n.unidade, n.meta!)} ·{' '}
                  {fmtVar(n.avaliacao?.diferenca ?? null, n.unidade === '%' ? ' p.p.' : '%')}
                </p>
                <div className="mt-2 h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
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
            <div key={area} className="rounded-lg border border-outline-variant/15 p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2">
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
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_META[it.status].classe}`}
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

      <p className="text-xs font-semibold text-on-surface">
        {contagem('bateu')} batidas · {contagem('nao_bateu')} não batidas · {contagem('quase')}{' '}
        quase lá
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
    return <Vazio texto="São necessários ao menos 3 meses com operação para projetar" />;
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
    { chave: 'energiaKwh', rotulo: 'Energia' },
    { chave: 'operacoes', rotulo: 'Transações' },
    { chave: 'usuariosAtivos', rotulo: 'Usuários no mês' },
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
              className={`rounded-lg p-3 ${x.chave === metrica ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-surface-container-high/50'}`}
            >
              <p className="text-[11px] uppercase tracking-widest text-on-surface-variant">
                {x.rotulo} em {mesCurto(ultimo.mes)}
              </p>
              <p className="text-lg font-headline font-bold text-on-surface">
                {ultimo[x.chave] === null ? '—' : cfgFmt(ultimo[x.chave]!)}
              </p>
              <p className="text-[11px] text-on-surface-variant">
                {taxa === null ? 'histórico insuficiente' : `${fmtVar(taxa)} ao mês`}
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
          <Legend wrapperStyle={{ fontSize: 11 }} verticalAlign="top" height={28} />
          <Bar isAnimationActive={false}
            dataKey="real"
            name="Realizado"
            stackId="p"
            fill="var(--primary)"
            radius={[4, 4, 0, 0]}
            maxBarSize={44}
            label={{
              position: 'top',
              fill: '#adaaaa',
              fontSize: 10,
              formatter: (v: number | null) => (v ? fmtCompacto(v) : ''),
            }}
          />
          <Bar isAnimationActive={false}
            dataKey="projetado"
            name="Projetado"
            stackId="p"
            fill="var(--primary)"
            fillOpacity={0.35}
            stroke="var(--primary)"
            strokeDasharray="4 3"
            radius={[4, 4, 0, 0]}
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
      <p className="text-[11px] text-on-surface-variant">
        Projeção mecânica: não considera capacidade dos carregadores (pontos saturados não conseguem
        crescer no mesmo ritmo), novos pontos nem sazonalidade.
      </p>
    </div>
  );
}
