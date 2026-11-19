import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronLeft, ChevronRight, Download } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Icone, IconeSvg } from '../painel/Icone';
import { BlocoDeIcone, BotaoAtualizar, CabecalhoDaPagina, classeDoCartao } from '../painel/Pagina';
import { classeDoCabecalhoDaTabela } from '../painel/Pecas';
import { MetasDialog } from './MetasDialog';
import { DestaquesDoMes } from './DestaquesDoMes';
import { MelhoresClientes } from './MelhoresClientes';
import { montarDestaques, type Destaque } from './destaques';
import iconeFaturamento from '../../assets/icones/indicadores-faturamento.svg';
import iconeRecargas from '../../assets/icones/indicadores-recargas.svg';
import iconeEnergia from '../../assets/icones/indicadores-energia.svg';
import iconeGrafico from '../../assets/icones/indicadores-grafico.svg';
import iconeRaio from '../../assets/icones/indicadores-raio.svg';
import iconeAbaVisao from '../../assets/icones/indicadores-aba-visao.svg';
import iconeAbaCarregadores from '../../assets/icones/indicadores-aba-carregadores.svg';
import iconeAbaMotoristas from '../../assets/icones/indicadores-aba-motoristas.svg';
import iconeAbaMetas from '../../assets/icones/indicadores-aba-metas.svg';
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
 *
 * Redesenho de nov/2026 (Figma da Lauriane, frame "Indicadores"), seguido à
 * risca: mês e "Mês em andamento" em pílulas sob o título, faixa verde com a
 * frase do mês, quatro cartões, abas em pílula (a primeira só com o ícone),
 * gráfico de 12 meses ao lado dos destaques e os quatro números menores. O que
 * a tela já fazia e o Figma não mostra (exportar, evolução diária, "como os
 * números são calculados") ficou no lugar menos intrusivo: o exportar no fim da
 * linha das abas e o resto no pé da página.
 */

// Azul mais claro que o da apresentação: precisa contrastar no tema escuro e no claro.
const AZUL = '#4F7CA8';
const VERDE = '#16A34A';
const VERMELHO = '#DC2626';
const AMBAR = '#D97706';

/** Gráficos nas cores do tema (claro e escuro), como na Visão geral. */
const tooltipStyle = {
  contentStyle: {
    backgroundColor: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 10,
    padding: 10,
    color: 'var(--color-foreground)',
  },
  labelStyle: {
    color: 'var(--color-muted-foreground)',
    marginBottom: 4,
    fontSize: 12,
    fontWeight: 600,
  },
  itemStyle: { color: 'var(--color-foreground)', fontSize: 12 },
};
const EIXO = { fill: 'var(--color-muted-foreground)', fontSize: 11 };
const COR_DA_GRADE = 'var(--color-border)';
const CURSOR = { fill: 'var(--color-muted)', fillOpacity: 0.6 };

/** "outubro" → "Outubro". */
const maiuscula = (s: string) => (s ? `${s.charAt(0).toUpperCase()}${s.slice(1)}` : s);
/** "2026-10" → "Outubro de 2026" (o navegador de mês do Figma). */
const mesComAno = (mes: string) => `${maiuscula(nomeDoMes(mes))} de ${mes.slice(0, 4)}`;
/** "2026-11" → "2026-11-30". */
const ultimoDiaDoMes = (mes: string) => {
  const [ano, m] = mes.split('-').map(Number);
  return `${mes}-${String(new Date(ano, m, 0).getDate()).padStart(2, '0')}`;
};

// ---------------------------------------------------------------------------
// Peças pequenas
// ---------------------------------------------------------------------------

/** Seta para cima (ou para baixo) dos cartões do Figma. */
const Seta = ({ subiu, tamanho }: { subiu: boolean; tamanho: number }) => (
  <span className={subiu ? '-rotate-90' : 'rotate-90'}>
    <Icone nome="seta-alta" tamanho={tamanho} />
  </span>
);

/** Seta e número dos cartões do Figma: "↑ 9,0%" na cor da marca, "↓ 1,1%" em vermelho. */
function Variacao({ valor, sufixo = '%' }: { valor: number | null; sufixo?: string }) {
  if (valor === null) return null;
  if (valor === 0)
    return <span className="text-[15px] font-medium text-muted-foreground">igual</span>;
  const subiu = valor > 0;
  return (
    <span
      className={`inline-flex items-center gap-[3px] text-[15px] font-medium tabular-nums ${subiu ? 'text-primary-strong' : 'text-destructive'}`}
    >
      <Seta subiu={subiu} tamanho={19} />
      <span className="sr-only">{subiu ? 'subiu' : 'caiu'}</span>
      {fmtVar(valor, sufixo).replace('+', '').replace('-', '')}
    </span>
  );
}

/**
 * Pílula verde (ou vermelha) dos cartões pequenos do Figma: "↑ 113,4%",
 * "↑ +2,9", "↑ +2,9 p.p". `comSinal` põe o "+"/"−" como no Figma.
 */
function PilulaDeVariacao({
  valor,
  sufixo = '%',
  comSinal = false,
}: {
  valor: number | null;
  sufixo?: string;
  comSinal?: boolean;
}) {
  if (valor === null) return null;
  if (valor === 0)
    return (
      <span className="h-7 px-3 rounded-[15px] bg-muted text-muted-foreground text-[13px] font-medium inline-flex items-center">
        igual
      </span>
    );
  const subiu = valor > 0;
  const numero = fmtVar(valor, sufixo).replace('+', '').replace('-', '');
  return (
    <span
      className={`h-7 px-3 rounded-[15px] shadow-cartao text-[15px] font-medium inline-flex items-center gap-1 tabular-nums whitespace-nowrap ${subiu ? 'bg-primary-soft text-primary-strong' : 'bg-destructive/10 text-destructive'}`}
    >
      <Seta subiu={subiu} tamanho={18} />
      <span className="sr-only">{subiu ? 'subiu' : 'caiu'}</span>
      {comSinal ? `${subiu ? '+' : '−'}${numero}` : numero}
    </span>
  );
}

/** Ícone de ajuda com a explicação no hover (e no toque, pelo title). */
function Ajuda({ texto }: { texto: string }) {
  return (
    <span
      title={texto}
      aria-label={texto}
      className="material-symbols-outlined text-[15px] leading-none text-muted-foreground/80 cursor-help align-middle no-print"
    >
      help
    </span>
  );
}

/** Bloco de ícone grande do Figma (55×55), nos cartões de gráfico e de destaques. */
const BlocoGrande = ({ children }: { children: ReactNode }) => (
  <span
    aria-hidden="true"
    className="w-[55px] h-[55px] rounded-[5px] bg-primary-soft text-primary-strong flex items-center justify-center shrink-0"
  >
    {children}
  </span>
);

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
    <section className={`${classeDoCartao} p-[22px] 3xl:p-[26px] print-avoid`} aria-label={titulo}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
        <div className="flex items-start gap-[18px] min-w-0">
          <BlocoDeIcone>
            <span className="material-symbols-outlined text-[22px]">{icone}</span>
          </BlocoDeIcone>
          <div className="min-w-0">
            <h3 className="text-[20px] leading-tight font-semibold text-foreground">{titulo}</h3>
            {subtitulo && (
              <p className="text-sm font-medium text-muted-foreground mt-1">{subtitulo}</p>
            )}
          </div>
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
    <div className="flex flex-wrap gap-1.5">
      {opcoes.map(o => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={valor === o.id}
          className={`h-8 px-3.5 rounded-[25px] text-[13px] font-medium transition-colors ${
            valor === o.id
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground hover:bg-muted/70'
          }`}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

const Vazio = ({ texto }: { texto: string }) => (
  <div className="h-40 flex flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-border text-muted-foreground">
    <span className="material-symbols-outlined text-4xl">leaderboard</span>
    <p className="text-sm">{texto}</p>
  </div>
);

// ---------------------------------------------------------------------------
// Vocabulário
// ---------------------------------------------------------------------------

type ChaveSerie = keyof Omit<PontoSerie, 'mes'>;
const METRICAS_SERIE: Array<{
  id: ChaveSerie;
  rotulo: string;
  unidade?: string;
  fmt: (n: number) => string;
}> = [
  { id: 'faturamento', rotulo: 'Faturamento', unidade: 'R$', fmt: n => fmtBRL(n) },
  { id: 'operacoes', rotulo: 'Recargas', fmt: fmtInt },
  { id: 'usuariosAtivos', rotulo: 'Motoristas', fmt: fmtInt },
  { id: 'energiaKwh', rotulo: 'Energia', unidade: 'kWh', fmt: n => fmtKwh(n) },
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

/** As quatro abas do Figma, com a largura de cada pílula. A primeira é só o ícone. */
const ABAS: Array<{
  id: Aba;
  rotulo: string;
  icone: ReactNode;
  largura: string;
  soIcone?: boolean;
}> = [
  {
    id: 'resumo',
    rotulo: 'Resumo',
    icone: <IconeSvg src={iconeAbaVisao} />,
    largura: 'w-[169px]',
    soIcone: true,
  },
  {
    id: 'carregadores',
    rotulo: 'Carregadores',
    icone: <IconeSvg src={iconeAbaCarregadores} />,
    largura: 'min-w-[201px]',
  },
  {
    id: 'motoristas',
    rotulo: 'Motoristas',
    icone: <IconeSvg src={iconeAbaMotoristas} />,
    largura: 'min-w-[190px]',
  },
  {
    id: 'metas',
    rotulo: 'Metas e projeção',
    icone: <IconeSvg src={iconeAbaMetas} />,
    largura: 'min-w-[241px]',
  },
];

/** Abas do Figma (Indicadores): pílulas separadas, a ativa na cor da marca. */
function AbasEmPilula({ ativa, aoMudar }: { ativa: Aba; aoMudar: (a: Aba) => void }) {
  return (
    <nav aria-label="Seções do relatório" className="flex flex-wrap gap-3 sm:gap-[21px]">
      {ABAS.map(a => {
        const eAtiva = a.id === ativa;
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => aoMudar(a.id)}
            aria-current={eAtiva ? 'page' : undefined}
            title={a.soIcone ? a.rotulo : undefined}
            className={`h-[43px] ${a.largura} px-[26px] rounded-[25px] border inline-flex items-center gap-[17px] text-[15px] font-semibold whitespace-nowrap shadow-pilula transition-colors ${
              eAtiva
                ? 'bg-primary border-primary text-primary-foreground'
                : 'bg-[#f4f6f8] dark:bg-card border-transparent text-foreground hover:bg-muted'
            }`}
          >
            {a.icone}
            {a.soIcone ? <span className="sr-only">{a.rotulo}</span> : a.rotulo}
          </button>
        );
      })}
    </nav>
  );
}

/** "2 pontos de atenção - 2 pontos de destaque - 1 para saber", como no Figma. */
function resumoNoFormatoDoFigma(destaques: Destaque[]): string {
  if (!destaques.length) return 'Nada fora do normal neste período';
  const n = (s: Destaque['severidade']) => destaques.filter(d => d.severidade === s).length;
  const partes = [
    n('atencao') && `${n('atencao')} ${n('atencao') === 1 ? 'ponto' : 'pontos'} de atenção`,
    n('ok') && `${n('ok')} ${n('ok') === 1 ? 'ponto' : 'pontos'} de destaque`,
    n('info') && `${n('info')} para saber`,
  ].filter(Boolean);
  return partes.join(' - ');
}

// ---------------------------------------------------------------------------
// Tela
// ---------------------------------------------------------------------------

export function RelatorioMensal({
  evolucaoDiaria,
}: {
  /**
   * "Evolução diária" (o gráfico dia a dia da página), no pé da página. Recebe
   * um número que muda a cada clique em "Atualizar", para buscar de novo.
   */
  evolucaoDiaria?: (atualizacao: number) => ReactNode;
} = {}) {
  const { user } = useAuth();
  const podeGerenciar = user?.role === 'admin' || (user?.role === 'operador' && !!user?.clientId);
  // Admin da plataforma vê todas as marcas. Na aba Carregadores ficam só os da
  // rede NeoPower; os das marcas white label seguem nos totais (pedido do dono,
  // 19/11/2026).
  const daPlataforma = user?.role === 'admin' && !user?.clientId;
  const empresa = user?.branding?.companyName || 'NeoPower';

  const [mes, setMes] = useState(mesAtualLocal());
  const [dados, setDados] = useState<Relatorio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  // Atualização que falhou com o mesmo mês na tela: os números ficam, com o aviso.
  const [falhou, setFalhou] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [atualizacao, setAtualizacao] = useState(0);
  const [diariaAberta, setDiariaAberta] = useState(false);
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
  const mesNaTela = useRef<string | null>(null);

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
    // Mesmo mês já na tela: se a atualização falhar, os números ficam e o botão
    // avisa. Mês novo: a tela não pode mostrar os números do mês anterior.
    const manterSeFalhar = mesNaTela.current === mes;
    const falhar = (mensagem: string) => {
      if (manterSeFalhar) {
        setFalhou(true);
      } else {
        setDados(null);
        mesNaTela.current = null;
        setErro(mensagem);
      }
    };
    try {
      const resp = await api.get(`/indicators/monthly?mes=${mes}&meses=12`);
      const corpo = await resp.json().catch(() => null);
      if (!resp.ok) {
        falhar(corpo?.error || 'Não foi possível carregar o relatório.');
        return;
      }
      setDados(corpo as Relatorio);
      mesNaTela.current = mes;
      setFalhou(false);
      setAtualizadoEm(new Date());
    } catch {
      falhar('Erro ao conectar com o servidor.');
    } finally {
      setCarregando(false);
    }
  }, [mes]);

  useEffect(() => {
    if (podeGerenciar) void carregar();
    else setCarregando(false);
  }, [carregar, podeGerenciar]);

  const carregadoresDaAba = useMemo(() => {
    if (!dados) return [];
    if (!daPlataforma) return dados.carregadores;
    return dados.carregadores.filter(c => c.redeNeoPower !== false);
  }, [dados, daPlataforma]);
  const soRedeNeoPower = !!dados && carregadoresDaAba.length < dados.carregadores.length;

  const carregadoresOrdenados = useMemo(() => {
    const lista = [...carregadoresDaAba];
    const { coluna, desc } = ordem;
    lista.sort((a, b) => {
      if (coluna === 'nome')
        return desc ? b.nome.localeCompare(a.nome) : a.nome.localeCompare(b.nome);
      const va = a[coluna] ?? -Infinity;
      const vb = b[coluna] ?? -Infinity;
      return desc ? vb - va : va - vb;
    });
    return lista;
  }, [carregadoresDaAba, ordem]);

  if (!podeGerenciar) {
    return (
      <div className={`${classeDoCartao} p-8 text-center text-muted-foreground`}>
        <span className="material-symbols-outlined text-4xl">lock</span>
        <p className="mt-2 text-[15px]">
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
    const linhas = carregadoresDaAba.map(c => [
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

  const atualizar = () => {
    void carregar();
    setAtualizacao(n => n + 1);
  };

  // Mês em pílula ("‹ Outubro de 2026 ›") e "Mês em andamento", sob o título (Figma).
  const navegadorDoMes = (
    <div className="no-print mt-[10px] flex flex-wrap items-center gap-3 sm:gap-[17px]">
      <div className="inline-flex items-center justify-between w-[214px] h-[43px] rounded-[25px] border border-primary bg-[#f4f6f8] dark:bg-card shadow-pilula px-[10px]">
        <button
          type="button"
          aria-label="Mês anterior"
          onClick={() => setMes(m => somarMeses(m, -1))}
          className="h-7 w-7 inline-flex items-center justify-center rounded-full text-foreground hover:bg-muted"
        >
          <ChevronLeft aria-hidden="true" className="w-[19px] h-[18px]" />
        </button>
        <label className="relative text-[11px] font-medium text-foreground cursor-pointer whitespace-nowrap">
          {mesComAno(mes)}
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
          className="h-7 w-7 inline-flex items-center justify-center rounded-full text-foreground hover:bg-muted disabled:opacity-30"
        >
          <ChevronRight aria-hidden="true" className="w-[19px] h-[18px]" />
        </button>
      </div>
      {r && !r.fechado && r.mes === mes && (
        <span className="inline-flex items-center justify-center gap-1 min-w-[314px] h-[43px] px-6 rounded-[25px] border border-[#089ef7] bg-[#e6f4fe] text-[#089ef7] dark:border-tom-azul-icone dark:bg-tom-azul dark:text-tom-azul-icone text-[11px] font-medium shadow-pilula whitespace-nowrap">
          <b className="font-semibold">Mês em andamento</b> dados até {fmtDataHora(r.periodo.fim)}
        </span>
      )}
    </div>
  );

  // Exportar (o Figma não tem): no fim da linha das abas, em pílula de contorno.
  const menuExportar = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={!r || exportando}
          className="h-[43px] px-[22px] rounded-[25px] border border-foreground dark:border-primary bg-card text-foreground dark:text-primary-strong text-[15px] font-medium inline-flex items-center gap-2 hover:bg-muted transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download aria-hidden="true" className="w-[18px] h-[18px]" />
          {exportando ? 'Gerando…' : 'Exportar'}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-popover border-border">
        <DropdownMenuItem onSelect={() => void exportarPptx()} className="gap-2 py-2">
          <span className="material-symbols-outlined text-lg text-primary-strong">slideshow</span>
          <span>
            <span className="block text-sm font-medium">Apresentação</span>
            <span className="block text-xs text-muted-foreground">
              PowerPoint pronto para a reunião
            </span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={exportarCsv} className="gap-2 py-2">
          <span className="material-symbols-outlined text-lg text-primary-strong">table_view</span>
          <span>
            <span className="block text-sm font-medium">Planilha por carregador</span>
            <span className="block text-xs text-muted-foreground">Arquivo CSV (Excel)</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={imprimir} className="gap-2 py-2">
          <span className="material-symbols-outlined text-lg text-primary-strong">print</span>
          <span>
            <span className="block text-sm font-medium">Imprimir ou salvar PDF</span>
            <span className="block text-xs text-muted-foreground">Relatório completo</span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-[25px]">
      <div className="no-print">
        <CabecalhoDaPagina
          rotulo="Desempenho da rede"
          titulo="Indicadores"
          subtitulo="Acompanhe o desempenho mensal da sua rede"
          detalhe={navegadorDoMes}
          acoes={
            <BotaoAtualizar
              aoAtualizar={atualizar}
              carregando={carregando}
              atualizadoEm={atualizadoEm}
              falhou={falhou}
            />
          }
        />
      </div>

      {erro && (
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-[15px] bg-destructive/10 text-destructive">
          <p className="flex-1 text-[15px] font-medium">{erro}</p>
          <button
            type="button"
            onClick={() => void carregar()}
            className="h-10 px-5 rounded-[25px] bg-card text-destructive text-sm font-semibold"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {carregando && !r && (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <p className="text-muted-foreground text-sm">
            Preparando o relatório de {mesPorExtenso(mes)}…
          </p>
        </div>
      )}

      {r && (
        <div className={`space-y-[25px] transition-opacity ${carregando ? 'opacity-60' : ''}`}>
          <div className="hidden print:block">
            <h1 className="text-2xl font-bold">Relatório de {mesPorExtenso(r.mes)}</h1>
            <p className="text-sm">
              {empresa} · {r.fechado ? 'mês fechado' : `dados até ${fmtDataHora(r.periodo.fim)}`}
            </p>
          </div>

          <ResumoDoMes r={r} mesAnteriorNome={mesAnteriorNome} />

          <div className="no-print flex flex-wrap items-center gap-3 sm:gap-[21px] 3xl:pt-[10px]">
            <AbasEmPilula ativa={aba} aoMudar={setAba} />
            <div className="ml-auto">{menuExportar}</div>
          </div>

          {/* Resumo (a aba só com o ícone) */}
          {mostrar('resumo') && (
            <div className="space-y-[25px] 3xl:space-y-[45px]">
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] 3xl:grid-cols-[minmax(0,1039fr)_minmax(0,497fr)] gap-[25px] 3xl:gap-[35px]">
                <Trajetoria
                  serie={r.serie}
                  metrica={metricaSerie}
                  onMetrica={setMetricaSerie}
                  mesSelecionado={r.mes}
                  comRotulos={imprimindo}
                />
                <Destaques r={r} />
              </div>
              <MaisNumeros r={r} />
            </div>
          )}

          {/* Carregadores */}
          {mostrar('carregadores') && (
            <div className="space-y-[25px]">
              <Secao
                titulo="Como cada carregador foi"
                subtitulo={`${soRedeNeoPower ? 'Rede NeoPower, comparada' : 'Comparado'} com ${r.comparacaoParcial ? `o mesmo período de ${mesAnteriorNome}` : mesAnteriorNome}. Toque no nome da coluna para ordenar.`}
                icone="ev_station"
              >
                <TabelaCarregadores
                  lista={carregadoresOrdenados}
                  ordem={ordem}
                  onOrdenar={coluna =>
                    setOrdem(o => ({ coluna, desc: o.coluna === coluna ? !o.desc : true }))
                  }
                  totalFaturamento={
                    soRedeNeoPower
                      ? carregadoresDaAba.reduce((t, c) => t + c.faturamento, 0)
                      : r.resumo.faturamento
                  }
                />
              </Secao>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-[25px]">
                <Secao
                  titulo="Uso dos carregadores"
                  subtitulo="Quanto tempo cada um ficou com carro conectado"
                  icone="timelapse"
                >
                  <Ocupacao lista={carregadoresDaAba} />
                </Secao>
                <Secao
                  titulo="Motoristas por carregador"
                  subtitulo="Total atendido e quantos eram novos"
                  icone="group_add"
                >
                  <Usuarios lista={carregadoresDaAba} />
                </Secao>
              </div>
            </div>
          )}

          {/* Motoristas */}
          {mostrar('motoristas') && (
            <div className="space-y-[25px]">
              <Motoristas r={r} />
              {/* Ranking para premiar (pedido do dono, 19/11/2026; não está no Figma). */}
              <MelhoresClientes
                inicio={`${mes}-01`}
                fim={ultimoDiaDoMes(mes)}
                rotuloDoPeriodo={mesComAno(mes)}
                atualizacao={atualizacao}
              />
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-[25px]">
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
            <div className="space-y-[25px]">
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
                    className="h-10 px-5 rounded-[25px] border border-primary bg-primary-soft text-primary-strong text-sm font-medium inline-flex items-center gap-1.5 hover:brightness-95 transition"
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

          {/* Pé da página: o que a tela já tinha e o Figma não mostra. */}
          {evolucaoDiaria && (
            <div className="no-print space-y-[25px]">
              <button
                type="button"
                onClick={() => setDiariaAberta(a => !a)}
                aria-expanded={diariaAberta}
                className={`${classeDoCartao} w-full flex items-center justify-between gap-3 px-5 py-4 text-left`}
              >
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold text-foreground">
                    Evolução diária
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    Receita, recargas, energia e motoristas dia a dia, no período que você escolher
                  </span>
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={`w-5 h-5 shrink-0 text-foreground transition-transform ${diariaAberta ? 'rotate-180' : ''}`}
                />
              </button>
              {diariaAberta && evolucaoDiaria(atualizacao)}
            </div>
          )}

          <details className={`${classeDoCartao} p-5 text-sm text-muted-foreground no-print`}>
            <summary className="cursor-pointer text-[15px] font-semibold text-foreground">
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
                <b>Preço médio do kWh</b>: {EXPLICA.preco} <b>Valor médio por recarga</b>:{' '}
                {EXPLICA.ticket}
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
  // Mês em andamento: a comparação é com o mesmo número de dias do mês anterior.
  const comparado = r.comparacaoParcial
    ? `ao mesmo período de ${mesAnteriorNome}`
    : `a ${mesAnteriorNome}`;

  const frase =
    a.operacoes === 0 ? (
      <>Nenhuma recarga concluída {r.fechado ? `em ${nomeMes}` : 'até agora neste mês'}.</>
    ) : (
      <>
        {r.fechado ? `Em ${nomeMes}` : `Até agora em ${nomeMes}`}, sua rede fez{' '}
        <b className="font-semibold">{fmtInt(a.operacoes)} recargas</b> para{' '}
        <b className="font-semibold">{fmtInt(a.usuariosAtivos)} motoristas</b> e faturou{' '}
        <b className="font-semibold">
          {fmtBRL(a.faturamento)}
          {v.faturamento !== null && (
            <>
              {' '}
              ({v.faturamento >= 0 ? '↑' : '↓'} {fmtNum(Math.abs(v.faturamento), 1)}% em relação{' '}
              {comparado})
            </>
          )}
        </b>
        .
        {a.novosUsuarios > 0 && (
          <>
            <br />
            <b className="font-semibold">{fmtInt(a.novosUsuarios)}</b>{' '}
            {a.novosUsuarios === 1 ? 'pessoa carregou' : 'pessoas carregaram'} com você pela
            primeira vez.
          </>
        )}
      </>
    );

  const cards: Array<{
    rotulo: string;
    icone: ReactNode;
    valor: string;
    /** Valor em reais: o "R$" menor, embaixo do ícone, como no Figma. */
    emReais?: boolean;
    vari: number | null;
    antes: string;
    ajuda?: string;
  }> = [
    {
      rotulo: 'Faturamento',
      icone: <IconeSvg src={iconeFaturamento} tamanho={25} />,
      valor: fmtBRL(a.faturamento),
      emReais: true,
      vari: v.faturamento,
      antes: fmtBRL(b.faturamento),
    },
    {
      rotulo: 'Recargas',
      icone: (
        <span className="text-tom-azul-icone">
          <IconeSvg src={iconeRecargas} tamanho={28} altura={29} />
        </span>
      ),
      valor: fmtInt(a.operacoes),
      vari: v.operacoes,
      antes: fmtInt(b.operacoes),
      ajuda: EXPLICA.recargas,
    },
    {
      rotulo: 'Motoristas',
      icone: <IconeSvg src={iconeAbaMotoristas} tamanho={24} />,
      valor: fmtInt(a.usuariosAtivos),
      vari: v.usuariosAtivos,
      antes: fmtInt(b.usuariosAtivos),
      ajuda: EXPLICA.motoristas,
    },
    {
      rotulo: 'Energia entregue',
      icone: <IconeSvg src={iconeEnergia} tamanho={26} altura={28} />,
      valor: fmtKwh(a.energiaKwh),
      vari: v.energiaKwh,
      antes: fmtKwh(b.energiaKwh),
    },
  ];

  return (
    <div className="space-y-[25px]">
      {/* Faixa verde do Figma com a frase do mês */}
      <div className="rounded-[25px] border border-primary/80 bg-gradient-to-r from-primary/35 to-primary/0 min-h-[147px] px-6 lg:px-[30px] pt-[21px] pb-6 print-avoid">
        <p className="text-[15px] font-semibold uppercase text-primary-strong">
          {r.fechado ? `Resumo de ${nomeMes}` : `${maiuscula(nomeMes)} até agora`}
        </p>
        <p className="mt-[15px] text-base leading-normal text-foreground">{frase}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 3xl:grid-cols-4 gap-[25px]">
        {cards.map(c => (
          <section
            key={c.rotulo}
            aria-label={c.rotulo}
            className={`${classeDoCartao} pl-[23px] pr-6 pt-[19px] pb-4 min-h-[168px] flex flex-col print-avoid`}
          >
            <div className="flex items-center gap-[18px] min-w-0">
              <BlocoDeIcone>{c.icone}</BlocoDeIcone>
              <h2
                title={c.ajuda}
                className="text-[22px] 3xl:text-[24px] leading-tight font-semibold text-[#001119] dark:text-foreground"
              >
                {c.rotulo}
              </h2>
            </div>
            {c.emReais ? (
              <p className="mt-[9px] flex items-baseline font-semibold tabular-nums text-foreground leading-tight">
                <span aria-hidden="true" className="w-[59px] shrink-0 text-[28px] 3xl:text-[32px]">
                  R$
                </span>
                <span aria-hidden="true" className="text-[34px] 3xl:text-[40px] break-all">
                  {c.valor.replace(/^R\$\s*/, '')}
                </span>
                <span className="sr-only">{c.valor}</span>
              </p>
            ) : (
              <span className="mt-[9px] pl-[59px] text-[34px] 3xl:text-[40px] leading-tight font-semibold tabular-nums text-foreground break-words">
                {c.valor}
              </span>
            )}
            <div className="mt-auto pt-2 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
              <Variacao valor={c.vari} />
              <span className="text-[15px] font-medium text-muted-foreground ml-auto">
                {maiuscula(mesAnteriorNome)}: {c.antes}
              </span>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Destaques({ r }: { r: Relatorio }) {
  const destaques = montarDestaques(r);
  return (
    <section
      aria-label="Destaques do mês"
      className={`${classeDoCartao} pt-[22px] pb-[17px] px-[13px] print-avoid`}
    >
      <div className="flex items-start gap-[13px] px-[9px] 3xl:px-[22px]">
        <BlocoGrande>
          <IconeSvg src={iconeGrafico} tamanho={40} />
        </BlocoGrande>
        <div className="min-w-0">
          <h3 className="text-[20px] leading-tight font-semibold text-foreground">
            Destaques do mês
          </h3>
          <p className="text-sm leading-[1.1] text-foreground mt-1.5 max-w-[338px]">
            {resumoNoFormatoDoFigma(destaques)}
          </p>
        </div>
      </div>
      <div className="mt-[30px]">
        <DestaquesDoMes destaques={destaques} />
      </div>
    </section>
  );
}

function MaisNumeros({ r }: { r: Relatorio }) {
  const { resumo: a, variacoes: v } = r;
  const itens: Array<{
    rotulo: string;
    prefixo?: string;
    valor: string;
    ajuda: string;
    vari?: number | null;
    sufixo?: string;
    comSinal?: boolean;
  }> = [
    {
      rotulo: 'Preço médio do kWh',
      prefixo: a.precoMedioKwh === null ? undefined : 'R$',
      valor: a.precoMedioKwh === null ? '—' : fmtNum(a.precoMedioKwh, 2),
      ajuda: EXPLICA.preco,
      vari: v.precoMedioKwh,
    },
    {
      rotulo: 'Valor médio por recarga',
      prefixo: a.ticketMedio === null ? undefined : 'R$',
      valor: a.ticketMedio === null ? '—' : fmtNum(a.ticketMedio, 2),
      ajuda: EXPLICA.ticket,
      vari: v.ticketMedio,
      comSinal: true,
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
      sufixo: ' p.p',
      comSinal: true,
    },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 3xl:grid-cols-[repeat(4,297px)] gap-[25px] 3xl:gap-[37px]">
      {itens.map(i => (
        <section
          key={i.rotulo}
          aria-label={i.rotulo}
          className={`${classeDoCartao} pl-[27px] pr-4 pt-[25px] pb-[18px] min-h-[124px] flex flex-col gap-3 print-avoid`}
        >
          <h3
            title={i.ajuda}
            className="flex items-center gap-[13px] text-base leading-tight font-semibold text-[#001119] dark:text-foreground 3xl:whitespace-nowrap"
          >
            <span className="text-primary-strong">
              <IconeSvg src={iconeRaio} tamanho={14} altura={17} />
            </span>
            {i.rotulo}
          </h3>
          <div className="flex flex-wrap items-center gap-x-9 gap-y-2">
            <p className="flex items-baseline gap-3 font-semibold tabular-nums text-foreground">
              {i.prefixo && <span className="text-[20px]">{i.prefixo}</span>}
              <span className="text-[24px] leading-tight">{i.valor}</span>
            </p>
            {i.vari !== undefined && (
              <PilulaDeVariacao valor={i.vari} sufixo={i.sufixo} comSinal={i.comSinal} />
            )}
          </div>
        </section>
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
      sufixo: ' p.p',
    },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-[25px]">
      {cards.map(c => (
        <section
          key={c.rotulo}
          aria-label={c.rotulo}
          className={`${classeDoCartao} p-[22px] print-avoid`}
        >
          <div className="flex items-center gap-[18px]">
            <BlocoDeIcone>
              <span className="material-symbols-outlined text-[22px]">{c.icone}</span>
            </BlocoDeIcone>
            <h3 className="text-[20px] leading-tight font-semibold text-[#001119] dark:text-foreground flex items-center gap-1.5">
              {c.rotulo}
              <Ajuda texto={c.ajuda} />
            </h3>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-[32px] leading-tight font-semibold tabular-nums text-foreground">
              {c.valor}
            </span>
            <PilulaDeVariacao valor={c.vari} sufixo={c.sufixo} />
          </div>
          <p className="text-[15px] font-medium text-muted-foreground mt-1">{c.detalhe}</p>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gráficos e tabelas
// ---------------------------------------------------------------------------

/** "Evolução nos últimos 12 meses": barras verdes, a do mês escolhido mais forte. */
function Trajetoria({
  serie,
  metrica,
  onMetrica,
  mesSelecionado,
  comRotulos,
}: {
  serie: PontoSerie[];
  metrica: ChaveSerie;
  onMetrica: (m: ChaveSerie) => void;
  mesSelecionado: string;
  /** Valor em cima das barras (na impressão, que não tem o tooltip). */
  comRotulos: boolean;
}) {
  const cfg = METRICAS_SERIE.find(m => m.id === metrica)!;
  const dados = serie.map(p => ({ mes: mesCurto(p.mes), chave: p.mes, valor: p[metrica] }));
  const temDados = dados.some(d => d.valor > 0);
  return (
    <section
      aria-label="Evolução nos últimos 12 meses"
      className={`${classeDoCartao} pl-[22px] pr-[22px] 3xl:pl-[27px] 3xl:pr-[48px] pt-[25px] pb-[22px] print-avoid`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex flex-1 items-start gap-[18px] 3xl:gap-[41px] min-w-0 sm:mt-[11px]">
          <BlocoGrande>
            <IconeSvg src={iconeGrafico} tamanho={40} />
          </BlocoGrande>
          <div className="min-w-0 pt-px">
            <h3 className="text-[20px] leading-tight font-semibold text-foreground">
              Evolução nos últimos 12 meses
            </h3>
            <p className="text-sm text-foreground mt-1">
              {cfg.rotulo}
              {cfg.unidade ? ` (${cfg.unidade})` : ''}
            </p>
          </div>
        </div>
        <Select value={metrica} onValueChange={v => onMetrica(v as ChaveSerie)}>
          <SelectTrigger
            aria-label="Indicador do gráfico"
            className="no-print shrink-0 h-[43px] data-[size=default]:h-[43px] w-full sm:w-[190px] rounded-[25px] border border-foreground dark:border-primary bg-card px-[28px] text-[15px] font-medium text-foreground dark:text-primary-strong [&_svg:not([class*='text-'])]:text-foreground [&_svg]:opacity-100"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {METRICAS_SERIE.map(m => (
              <SelectItem key={m.id} value={m.id}>
                {m.rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="mt-[30px]">
        {!temDados ? (
          <Vazio texto="Sem dados no período" />
        ) : (
          <ResponsiveContainer width="100%" height={310}>
            <BarChart
              data={dados}
              margin={{ top: 20, right: 8, left: 0, bottom: 0 }}
              barCategoryGap="12%"
            >
              <CartesianGrid stroke={COR_DA_GRADE} vertical={false} />
              <XAxis
                dataKey="mes"
                tick={EIXO}
                axisLine={false}
                tickLine={false}
                interval={0}
                dy={6}
              />
              <YAxis
                tick={{ ...EIXO, fontSize: 14, fill: 'var(--color-foreground)' }}
                axisLine={false}
                tickLine={false}
                width={60}
                tickFormatter={v => fmtCompacto(Number(v))}
              />
              <Tooltip
                {...tooltipStyle}
                cursor={CURSOR}
                formatter={(v: number) => [cfg.fmt(v), cfg.rotulo]}
              />
              <Bar
                isAnimationActive={false}
                dataKey="valor"
                maxBarSize={63}
                label={
                  comRotulos
                    ? {
                        position: 'top',
                        fill: 'var(--color-muted-foreground)',
                        fontSize: 10,
                        formatter: (v: number) => fmtCompacto(v),
                      }
                    : false
                }
              >
                {dados.map(d => (
                  <Cell
                    key={d.chave}
                    fill="var(--primary)"
                    fillOpacity={d.chave === mesSelecionado ? 1 : 0.51}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
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
        className={`inline-flex items-center gap-0.5 hover:text-primary-strong ${ordem.coluna === coluna ? 'text-primary-strong' : ''}`}
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
    return atual > 0 ? <span className="block text-[11px] text-tom-azul-icone">novo</span> : null;
  return (
    <span
      className={`block text-[11px] font-medium ${v >= 0 ? 'text-estado-livre-forte' : 'text-destructive'}`}
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
          <thead className={classeDoCabecalhoDaTabela}>
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
                <tr key={c.chargePointId} className="border-b border-border hover:bg-muted/60">
                  <td className="px-3 py-3">
                    <p className="font-medium text-foreground">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.bairro || c.chargePointId}
                      {c.potenciaKw ? ` · ${fmtNum(c.potenciaKw, 0)} kW` : ''}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className="font-semibold text-foreground">{fmtBRL(c.faturamento)}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {fmtPct(participacao, 0)} do total
                    </span>
                    <Delta atual={c.faturamento} anterior={c.anterior.faturamento} />
                  </td>
                  <td className="px-3 py-3 text-right text-foreground">
                    {fmtInt(c.operacoes)}
                    <Delta atual={c.operacoes} anterior={c.anterior.operacoes} />
                  </td>
                  <td className="px-3 py-3 text-right text-foreground">
                    {fmtKwh(c.energiaKwh)}
                    <Delta atual={c.energiaKwh} anterior={c.anterior.energiaKwh} />
                  </td>
                  <td className="px-3 py-3 text-right w-36">
                    <span className="font-semibold" style={{ color: cor }}>
                      {fmtPct(c.ocupacaoPct, 0)}
                    </span>
                    <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(100, c.ocupacaoPct)}%`, backgroundColor: cor }}
                      />
                    </div>
                  </td>
                  {maisColunas && (
                    <>
                      <td className="px-3 py-3 text-right text-foreground">{fmtInt(c.usuarios)}</td>
                      <td className="px-3 py-3 text-right text-foreground">
                        {fmtInt(c.novosUsuarios)}
                      </td>
                      <td className="px-3 py-3 text-right text-foreground">
                        {c.precoMedioKwh === null ? '—' : fmtBRL(c.precoMedioKwh, 2)}
                      </td>
                      <td className="px-3 py-3 text-right text-foreground">
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
        className="no-print inline-flex items-center gap-1 text-xs font-semibold text-primary-strong hover:underline"
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
            tick={EIXO}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            {...tooltipStyle}
            cursor={CURSOR}
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
              fill: 'var(--color-muted-foreground)',
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
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
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
        <p className="mt-3 rounded-[10px] bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
          tick={EIXO}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip {...tooltipStyle} cursor={CURSOR} />
        <Legend wrapperStyle={{ fontSize: 12 }} verticalAlign="top" height={28} />
        <Bar
          isAnimationActive={false}
          dataKey="usuarios"
          name="Motoristas atendidos"
          fill={AZUL}
          radius={[0, 6, 6, 0]}
          maxBarSize={14}
          label={{ position: 'right', fill: 'var(--color-muted-foreground)', fontSize: 10 }}
        />
        <Bar
          isAnimationActive={false}
          dataKey="novos"
          name="Novos motoristas"
          fill="var(--primary)"
          radius={[0, 6, 6, 0]}
          maxBarSize={14}
          label={{ position: 'right', fill: 'var(--color-muted-foreground)', fontSize: 10 }}
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
            <div key={c.chargePointId} className="rounded-[10px] bg-muted/60 p-3">
              <p className="text-xs text-primary-strong font-semibold">
                {['🥇', '🥈', '🥉'][i]} {i + 1}º lugar
              </p>
              <p className="text-2xl font-bold text-foreground">{fmtInt(c.novosUsuarios)}</p>
              <p className="text-xs text-foreground truncate" title={c.nome}>
                {c.nome}
              </p>
              <p className="text-[11px] text-muted-foreground">
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
                className={`font-medium ${b.bairro === 'Sem bairro' ? 'text-muted-foreground italic' : 'text-foreground'}`}
              >
                {b.bairro === 'Sem bairro' ? 'Bairro não informado' : b.bairro}
              </span>
              <span className="text-muted-foreground">
                <b className="text-foreground">{fmtInt(b.novosUsuarios)}</b>{' '}
                {b.novosUsuarios === 1 ? 'novo' : 'novos'} · {fmtBRL(b.faturamento)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${(b.novosUsuarios / maxNovos) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      {semBairro && (
        <p className="text-xs text-muted-foreground">
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
              <span key={h} className="text-[9px] text-center text-muted-foreground">
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
                      className="aspect-square rounded-[4px] bg-muted"
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
      <p className="text-sm text-muted-foreground">
        Horário mais procurado:{' '}
        <b className="text-foreground">
          {horaPico}h às {horaPico + 1}h
        </b>
        . Dia e hora de maior movimento:{' '}
        <b className="text-foreground">
          {DIAS_SEMANA[pico.dia - 1]}, {pico.hora}h
        </b>
        .
      </p>
    </div>
  );
}

const FragmentoDia = ({ dia, children }: { dia: string; children: ReactNode }) => (
  <>
    <span className="text-[10px] text-muted-foreground self-center">{dia}</span>
    {children}
  </>
);

function Metas({ r, onDefinir }: { r: Relatorio; onDefinir: () => void }) {
  const definidas = r.metas.numericas.filter(n => n.meta !== null);
  const itens = r.metas.itens;
  if (!definidas.length && !itens.length) {
    return (
      <div className="flex flex-col items-center text-center gap-3 py-6">
        <span className="material-symbols-outlined text-4xl text-muted-foreground">flag</span>
        <p className="text-sm text-muted-foreground max-w-md">
          Defina quanto quer faturar, quantas recargas espera e outras metas do mês. O resultado é
          comparado automaticamente e aparece também na apresentação.
        </p>
        <button
          type="button"
          onClick={onDefinir}
          className="no-print rounded-[25px] bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
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
              <div key={n.chave} className="rounded-[10px] bg-muted/60 p-4">
                <div className="flex justify-between items-start gap-2">
                  <p className="text-sm font-medium text-muted-foreground">
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
                <p className="mt-2 text-2xl font-bold text-foreground">
                  {fmtMeta(n.unidade, n.resultado)}
                </p>
                <p className="text-xs text-muted-foreground">
                  de {fmtMeta(n.unidade, n.meta!)}
                  {n.avaliacao?.atingidoPct != null && n.unidade !== '%'
                    ? ` · ${fmtPct(n.avaliacao.atingidoPct, 0)} da meta`
                    : ''}
                </p>
                <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
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
            <div key={area} className="rounded-[10px] border border-border p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-primary-strong mb-2">
                {area}
              </p>
              <ul className="space-y-2.5">
                {itens
                  .filter(i => i.area === area)
                  .map((it, idx) => (
                    <li key={idx} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-foreground">{it.descricao}</p>
                        {it.resultado && (
                          <p className="text-xs text-muted-foreground">Resultado: {it.resultado}</p>
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

      <p className="text-sm text-foreground">
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
              className={`rounded-[10px] p-3 ${x.chave === metrica ? 'bg-primary-soft ring-1 ring-primary/40' : 'bg-muted/60'}`}
            >
              <p className="text-xs text-muted-foreground">
                {x.rotulo} em {mesCurto(ultimo.mes)}
              </p>
              <p className="text-lg font-bold text-foreground">
                {ultimo[x.chave] === null ? '—' : cfgFmt(ultimo[x.chave]!)}
              </p>
              <p className="text-xs text-muted-foreground">
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
            stroke={COR_DA_GRADE}
            strokeOpacity={0.3}
            vertical={false}
          />
          <XAxis dataKey="mes" tick={EIXO} axisLine={false} tickLine={false} />
          <YAxis
            tick={EIXO}
            axisLine={false}
            tickLine={false}
            width={60}
            tickFormatter={v => fmtCompacto(Number(v))}
          />
          <Tooltip
            {...tooltipStyle}
            cursor={CURSOR}
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
              fill: 'var(--color-muted-foreground)',
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
              fill: 'var(--color-muted-foreground)',
              fontSize: 10,
              formatter: (v: number | null) => (v ? fmtCompacto(v) : ''),
            }}
          />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground">
        É uma estimativa simples: não leva em conta novos pontos, carregadores lotados ou meses mais
        fracos do ano.
      </p>
    </div>
  );
}
