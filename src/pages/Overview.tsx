import { useEffect, useState, useMemo, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Ticket, X } from 'lucide-react';
import { dataLocal } from '../components/ui/utils';
import { DateRangePicker } from '../components/ui/date-range-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useSocket } from '../lib/hooks/useSocket';
import { Icone } from '../components/painel/Icone';
import {
  BlocoDeIcone,
  BotaoAtualizar,
  CabecalhoDaPagina,
  classeDaPilula,
  classeDoCartao,
  type Tom,
} from '../components/painel/Pagina';
import iconeReceitaOperacional from '../assets/icones/kpi-receita-operacional.svg';
import iconeDepositos from '../assets/icones/kpi-depositos.svg';
import iconeLivre from '../assets/icones/estado-livre.svg';
import iconeEmUso from '../assets/icones/estado-em-uso.svg';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

/*
 * Visão geral — redesenho de nov/2026 (Figma da Lauriane, Frames 14 e 16).
 * Segue o Figma; onde ele não diz nada, entram as correções do estudo de
 * usabilidade: período escrito em cada gráfico (H1), "última atualização" e
 * aviso de falha (H1), atalho para os carregadores offline (H1/H9), "Limpar
 * filtros" (H3) e o escopo dos filtros escrito no cabeçalho (H7).
 */

interface ChartPoint {
  date: string;
  value: number;
}

interface LocalDaLista {
  id: number;
  nomeDoLocal?: string;
  location_name?: string;
  endereco?: string;
}

interface EstacaoDaLista {
  charge_point_id: string;
  description?: string | null;
  locationId?: number | null;
}

interface OverviewData {
  /** Local a que estes números se referem; null = a rede toda. */
  locationId?: number | null;
  /** Estação a que estes números se referem; null = todas. */
  chargerId?: string | null;
  /**
   * Financeiro do local (ou da estação) escolhido, pela regra do Relatório
   * Financeiro por local. `taxaMp` e `liquidoNeoPower` só vêm para a plataforma.
   */
  financeiroDoLocal?: {
    recargas: number;
    receita: number;
    /** Sem estes três quando `comissaoOculta` (operadores de Manaus). */
    comissaoPercent?: number;
    comissao?: number;
    repasse?: number;
    comissaoOculta?: boolean;
    taxaMp?: number;
    liquidoNeoPower?: number;
  } | null;
  revenueToday: number;
  revenueMonth: number;
  revenueTotal: number;
  kwhToday: number;
  kwhMonth: number;
  kwhTotal: number;
  transactionsMonth: number;
  transactionsTotal: number;
  totalDepositsGross: number;
  mercadoPagoFee: number;
  totalDepositsNet: number;
  depositsCount: number;
  last7DaysRevenue: ChartPoint[];
  last7DaysKwh: ChartPoint[];
  chargers: {
    total: number;
    online: number;
    offline: number;
    charging: number;
    /** Cadastrados que nunca se conectaram (API nova); fora do offline. */
    emInstalacao?: number;
  };
  activeVouchers?: number;
}

/** Recarga em andamento (GET /transactions/active), com o consumo do medidor. */
interface RecargaAgora {
  transactionId: number;
  chargerId: string;
  startTimestamp: string;
  energyKwh?: number;
  powerKw?: number | null;
  estimatedCost?: number;
  userName?: string | null;
  locationId?: number | null;
}

/**
 * De quanto em quanto tempo a tela se atualiza sozinha. As recargas em
 * andamento acompanham o medidor (uma leitura por minuto); os totais, que só
 * mudam quando uma recarga é cobrada, vão mais devagar. Com a aba em segundo
 * plano, nada é pedido.
 */
const INTERVALO_DO_AGORA_MS = 15_000;
const INTERVALO_DOS_TOTAIS_MS = 60_000;

const fmt = (v: number, decimals = 2) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/* ── Peças da tela ── */

/** Valor grande do cartão: "R$" menor à esquerda ou unidade à direita. */
function ValorGrande({
  prefixo,
  valor,
  sufixo,
  destaque,
}: {
  prefixo?: string;
  valor: string;
  sufixo?: string;
  destaque?: boolean;
}) {
  return (
    <p
      className={`flex items-baseline gap-2 font-semibold tabular-nums leading-none ${destaque ? 'text-primary-strong' : 'text-foreground'}`}
    >
      {prefixo && <span className="text-[clamp(1.25rem,1.67vw,2rem)]">{prefixo}</span>}
      <span className="text-[clamp(1.75rem,2.1vw,2.5rem)]">{valor}</span>
      {sufixo && (
        <span className="text-[clamp(1rem,1.1vw,1.25rem)] text-muted-foreground">{sufixo}</span>
      )}
    </p>
  );
}

interface CartaoIndicadorProps {
  tom: Tom;
  icone: ReactNode;
  titulo: string;
  subtitulo: string;
  valor: ReactNode;
  /** Variação (%) — só quando há com o que comparar. */
  variacao?: number;
  /** Linha de baixo, à direita: o detalhe que explica o número. */
  rodape?: ReactNode;
}

/** Cartão de indicador do Figma: ícone, título, período, valor e variação. */
function CartaoIndicador({
  tom,
  icone,
  titulo,
  subtitulo,
  valor,
  variacao,
  rodape,
}: CartaoIndicadorProps) {
  return (
    <section
      className={`${classeDoCartao} p-[22px] min-h-[165px] flex flex-col`}
      aria-label={titulo}
    >
      <div className="flex items-start gap-[18px]">
        <BlocoDeIcone tom={tom}>{icone}</BlocoDeIcone>
        <div className="min-w-0">
          <h2 className="text-[20px] leading-tight font-semibold text-[#001119] dark:text-foreground">
            {titulo}
          </h2>
          <p className="text-[15px] font-medium text-muted-foreground truncate">{subtitulo}</p>
        </div>
      </div>
      <div className="mt-[18px]">{valor}</div>
      {(variacao !== undefined || rodape) && (
        <div className="mt-auto pt-3 flex items-end justify-between gap-3 text-sm">
          {variacao !== undefined ? (
            <span
              className={`inline-flex items-center gap-1 text-[15px] font-medium ${variacao >= 0 ? 'text-primary-strong' : 'text-destructive'}`}
            >
              <span className={variacao >= 0 ? '' : 'rotate-180'}>
                <Icone nome="seta-alta" tamanho={19} />
              </span>
              {variacao >= 0 ? '+' : '−'}
              {Math.abs(variacao).toFixed(1).replace('.', ',')} %
            </span>
          ) : (
            <span />
          )}
          {rodape && <div className="text-right text-muted-foreground min-w-0">{rodape}</div>}
        </div>
      )}
    </section>
  );
}

/** Rótulo e valor do rodapé dos cartões, numa linha. */
function LinhaDoRodape({
  rotulo,
  valor,
  valorClasse = 'text-foreground',
}: {
  rotulo: string;
  valor: string;
  valorClasse?: string;
}) {
  return (
    <p className="flex justify-end gap-2 whitespace-nowrap">
      <span>{rotulo}</span>
      <span className={`font-semibold tabular-nums ${valorClasse}`}>{valor}</span>
    </p>
  );
}

/** Cabeçalho dos cartões de gráfico e de status: ícone, título, subtítulo e um selo à direita. */
function CabecalhoDoCartao({
  icone,
  titulo,
  subtitulo,
  selo,
}: {
  icone: ReactNode;
  titulo: string;
  subtitulo: string;
  selo?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-[18px] min-w-0">
        <BlocoDeIcone>{icone}</BlocoDeIcone>
        <div className="min-w-0">
          <h2 className="text-[20px] leading-tight font-semibold text-foreground">{titulo}</h2>
          <p className="text-[15px] font-medium text-foreground">{subtitulo}</p>
        </div>
      </div>
      {selo}
    </div>
  );
}

/** Selo de contorno do Figma ("Receita líquida", "Diária"). */
function Selo({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 h-[27px] px-4 rounded-[25px] border border-foreground dark:border-primary text-sm font-medium text-foreground dark:text-primary-strong inline-flex items-center">
      {children}
    </span>
  );
}

/** Gráfico sem dados: o mesmo recado de antes, no desenho novo. */
function SemDados({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="h-[190px] flex flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-border text-center px-6">
      <p className="text-[15px] font-semibold text-foreground">{titulo}</p>
      <p className="text-sm text-muted-foreground">{texto}</p>
    </div>
  );
}

/** Um número do bloco "Agora". */
function NumeroDoAgora({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className={`rounded-[5px] px-4 py-3 ${destaque ? 'bg-primary-soft' : 'bg-muted'}`}>
      <p className="text-sm font-medium text-muted-foreground">{rotulo}</p>
      <p
        className={`mt-1 text-[24px] font-semibold tabular-nums ${destaque ? 'text-primary-strong' : 'text-foreground'}`}
      >
        {valor}
      </p>
    </div>
  );
}

/** Cartão lateral do Figma: ícone, rótulo e o número grande à direita. */
function CartaoLateral({
  icone,
  rotulo,
  valor,
}: {
  icone: ReactNode;
  rotulo: string;
  valor: string;
}) {
  return (
    <section
      className={`${classeDoCartao} min-h-[87px] px-[22px] py-3 flex items-center gap-[18px]`}
      aria-label={rotulo}
    >
      <BlocoDeIcone grande>{icone}</BlocoDeIcone>
      <h2 className="flex-1 text-[20px] leading-tight font-semibold text-foreground">{rotulo}</h2>
      <span className="text-[32px] font-bold tabular-nums text-foreground">{valor}</span>
    </section>
  );
}

const eixoDoGrafico = {
  fill: 'var(--color-muted-foreground)',
  fontSize: 12,
  fontFamily: "'Inter', sans-serif",
};
const dicaDoGrafico = {
  contentStyle: {
    backgroundColor: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: '10px',
    color: 'var(--color-foreground)',
  },
  labelStyle: { color: 'var(--color-muted-foreground)', fontWeight: 600 },
};

export const Overview = () => {
  const { user } = useAuth();
  // A API só manda os depósitos para o super admin (carteiras são globais);
  // para operador/admin da marca eles vêm zerados, então o card fica oculto.
  const isSuperAdmin = user?.role === 'admin' && !user?.branding?.clientId;
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Atualização que falhou com números já na tela: eles ficam, com o aviso.
  const [falhou, setFalhou] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  // '' = a rede toda. Guardado como texto porque é o que o Select devolve.
  const [locationId, setLocationId] = useState('');
  const [chargerId, setChargerId] = useState('');
  const [locais, setLocais] = useState<LocalDaLista[]>([]);
  const [estacoes, setEstacoes] = useState<EstacaoDaLista[]>([]);
  const [previousData, setPreviousData] = useState<OverviewData | null>(null);

  const { isConnected, chargerStatuses } = useSocket();

  const chargerCountRef = useRef(0);
  useEffect(() => {
    const onlineCount = Array.from(chargerStatuses.values()).filter(
      s => s.status !== 'Offline' && s.status !== 'Unavailable'
    ).length;
    if (chargerCountRef.current !== onlineCount && chargerCountRef.current !== 0) {
      void fetchOverview(true, true);
    }
    chargerCountRef.current = onlineCount;
  }, [chargerStatuses]);

  // `mesmoEscopo = false` quando o local ou o período mudou: comparar o local
  // novo com os números da rede dava "-100%" num cartão que não caiu nada.
  // `silencioso`: atualização automática — sem o carregando e sem trocar os
  // números por um erro passageiro (tenta de novo no próximo ciclo).
  const fetchOverview = async (mesmoEscopo = true, silencioso = false) => {
    if (!silencioso) {
      setAtualizando(true);
      setError(null);
    }
    try {
      let endpoint = '/overview-stats';
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (locationId) params.append('locationId', locationId);
      if (chargerId) params.append('chargerId', chargerId);
      if (params.toString()) endpoint += `?${params.toString()}`;

      const response = await api.get(endpoint);
      if (!response.ok) throw new Error('Falha ao buscar dados.');
      const overviewData = await response.json();
      if (!silencioso) setPreviousData(mesmoEscopo && data ? data : null);
      setData(overviewData);
      setAtualizadoEm(new Date());
      setFalhou(false);
    } catch (err: any) {
      if (!silencioso) {
        // Sem números ainda: a tela de erro. Com números: eles ficam e o
        // botão avisa que a atualização não veio.
        if (data) setFalhou(true);
        else setError(err.message || 'Erro ao buscar dados.');
      }
    } finally {
      if (!silencioso) {
        setAtualizando(false);
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void fetchOverview(false);
  }, [startDate, endDate, locationId, chargerId]);

  // Os totais se atualizam sozinhos: uma recarga cobrada entra na receita e no
  // kWh sem precisar recarregar a página.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.hidden) return;
      void fetchOverview(true, true);
    }, INTERVALO_DOS_TOTAIS_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, locationId, chargerId]);

  // Recargas em andamento, com o consumo do medidor. Os totais acima só contam
  // a recarga depois de cobrada; aqui o operador vê o que está entrando agora.
  const [agora, setAgora] = useState<RecargaAgora[] | null>(null);
  const buscarAgora = async () => {
    try {
      const res = await api.get('/transactions/active');
      if (!res.ok) return;
      const corpo = await res.json();
      const lista = Array.isArray(corpo) ? corpo : (corpo?.data ?? []);
      setAgora(Array.isArray(lista) ? lista : []);
    } catch {
      /* falha de rede: fica o último retrato e tenta no próximo ciclo */
    }
  };
  useEffect(() => {
    void buscarAgora();
    const t = setInterval(() => {
      if (document.hidden) return;
      void buscarAgora();
    }, INTERVALO_DO_AGORA_MS);
    return () => clearInterval(t);
  }, []);

  // Lista do seletor: dos locais que este usuário pode ver, só os que já
  // renderam alguma recarga. A lista inteira tem dezenas de cadastros antigos,
  // de teste e de marca que ainda não opera — escolher um deles só abriria uma
  // tela de zeros. Um local novo entra aqui sozinho na primeira recarga cobrada.
  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get('/locations/all?comReceita=true');
        if (!res.ok) return;
        const corpo = await res.json();
        const lista = corpo.locations || corpo.data?.locations || corpo.data || corpo || [];
        setLocais(Array.isArray(lista) ? lista : []);
      } catch {
        // Sem a lista o seletor não aparece; o resto da tela continua de pé.
      }
    })();
  }, []);

  // Estações do seletor: as que este usuário vê (a API já recorta pela marca).
  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get('/chargers');
        if (!res.ok) return;
        const corpo = await res.json();
        const lista = corpo.data || corpo;
        setEstacoes(Array.isArray(lista) ? lista : []);
      } catch {
        // Sem a lista o seletor de estação não aparece.
      }
    })();
  }, []);

  // Só as estações do local escolhido; trocar de local solta a estação de outro.
  const estacoesDoFiltro = useMemo(
    () => estacoes.filter(e => !locationId || String(e.locationId ?? '') === locationId),
    [estacoes, locationId]
  );
  useEffect(() => {
    if (chargerId && !estacoesDoFiltro.some(e => e.charge_point_id === chargerId)) setChargerId('');
  }, [estacoesDoFiltro, chargerId]);

  const temFiltro = !!(startDate || endDate || locationId || chargerId);
  const limparFiltros = () => {
    setStartDate('');
    setEndDate('');
    setLocationId('');
    setChargerId('');
  };

  const calculateChange = (current: number, previous: number | undefined): number | undefined => {
    if (!previous || previous === 0) return undefined;
    return ((current - previous) / previous) * 100;
  };

  const statusCounts = useMemo(() => {
    if (!data?.chargers) return { online: 0, offline: 0, charging: 0, emInstalacao: 0 };
    return {
      online: data.chargers.online,
      offline: data.chargers.offline,
      charging: data.chargers.charging,
      emInstalacao: data.chargers.emInstalacao ?? 0,
    };
  }, [data]);

  // Os três estados são disjuntos (a API desconta os carregando dos online) e
  // somam os carregadores instalados. O cadastrado que nunca ligou fica à parte
  // (emInstalacao): contado como offline, metade da rede parecia fora do ar.
  const statusTotal = statusCounts.online + statusCounts.charging + statusCounts.offline;
  const statusConectados = statusCounts.online + statusCounts.charging;
  const statusPct = (n: number) => (statusTotal > 0 ? Math.round((n / statusTotal) * 100) : 0);

  // Com local ou estação escolhidos, a receita líquida é o repasse do escopo
  // (receita das recargas − comissão), a mesma conta do relatório por local.
  // Na rede toda: para a plataforma, o depósito líquido (recarga é consumo do
  // saldo, somar as duas contava o mesmo real duas vezes); para a marca, a
  // receita das recargas.
  const receitaDe = (d: OverviewData | null) =>
    d?.financeiroDoLocal
      ? (d.financeiroDoLocal.repasse ?? d.financeiroDoLocal.receita)
      : d?.locationId != null || d?.chargerId != null
        ? // Servidor ainda sem o financeiro do escopo: ao menos a receita das
          // recargas dele, nunca o zero dos depósitos.
          d?.revenueTotal || 0
        : isSuperAdmin
          ? d?.totalDepositsNet || 0
          : d?.revenueTotal || 0;
  const doLocal = data?.financeiroDoLocal ?? null;
  const netRevenue = receitaDe(data);
  const grossDeposits = data?.totalDepositsGross || 0;
  const revenueChange = calculateChange(
    netRevenue,
    previousData ? receitaDe(previousData) : undefined
  );
  // A API devolve o período em revenueToday/kwhToday quando há filtro; o "Month"
  // é sempre o mês atual. Os cards mostram o período quando ele está filtrado.
  const filtrado = !!(startDate || endDate);
  const dataCurta = (d: string) => dataLocal(d).toLocaleDateString('pt-BR');
  // Com período escolhido, todos os cartões falam da mesma janela (o servidor
  // recorta tudo por ela). O rótulo diz qual é, para ninguém somar meses
  // diferentes achando que são o mesmo número.
  const rotuloDoPeriodo = `${startDate ? dataCurta(startDate) : 'Início'} a ${endDate ? dataCurta(endDate) : 'hoje'}`;
  const janelaDosGraficos = filtrado ? rotuloDoPeriodo : 'últimos 7 dias';
  const nomeDoLocal = (l: LocalDaLista) => l.nomeDoLocal || l.location_name || `Local ${l.id}`;
  const nomeDaEstacao = (e: EstacaoDaLista) => e.description?.trim() || e.charge_point_id;
  const localEscolhido = locais.find(l => String(l.id) === locationId);
  const estacaoEscolhida = estacoes.find(e => e.charge_point_id === chargerId);
  // A API devolve o escopo que de fato aplicou. Enquanto ela não estiver
  // atualizada, o número é da rede toda — e dizer "Local: X" em cima disso seria
  // mentira. Melhor avisar do que mostrar um total que não é daquele posto.
  const localConfirmado = !locationId || String(data?.locationId ?? '') === locationId;
  const estacaoConfirmada = !chargerId || String(data?.chargerId ?? '') === chargerId;
  const escopoConfirmado = localConfirmado && estacaoConfirmada;
  const comEscopo = !!(locationId || chargerId);

  // Recargas em andamento no escopo da tela. O local de cada uma vem da API;
  // a que ainda não o manda fica com a rede toda, em vez de esconder tudo.
  const agoraTemLocal = (agora ?? []).some(r => r.locationId !== undefined);
  const agoraNoEscopo = (agora ?? []).filter(
    r =>
      (!locationId || !agoraTemLocal || String(r.locationId ?? '') === locationId) &&
      (!chargerId || r.chargerId === chargerId)
  );
  const somaAgora = agoraNoEscopo.reduce(
    (s, r) => ({
      kwh: s.kwh + (r.energyKwh || 0),
      kw: s.kw + (r.powerKw || 0),
      valor: s.valor + (r.estimatedCost || 0),
    }),
    { kwh: 0, kw: 0, valor: 0 }
  );
  const LINHAS_DO_AGORA = 8;

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-destructive">{error}</p>
        <button
          type="button"
          onClick={() => void fetchOverview(false)}
          className="h-11 px-6 rounded-[25px] bg-primary text-primary-foreground text-[15px] font-medium"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  if (!data) return null;

  const mostraDepositos = isSuperAdmin && !comEscopo;

  // Escopo dos filtros, escrito (estudo, H7): o que a tela está somando.
  const escopo = [
    filtrado ? `Período: ${rotuloDoPeriodo}` : 'Período: todo',
    localEscolhido ? `Local: ${nomeDoLocal(localEscolhido)}` : 'Todos os locais',
    estacaoEscolhida ? `Estação: ${nomeDaEstacao(estacaoEscolhida)}` : 'Todas as estações',
  ].join(' · ');

  const statusItens = [
    {
      chave: 'livre',
      label: 'Livres',
      value: statusCounts.online,
      fundo: 'bg-estado-livre',
      barra: 'bg-estado-livre',
      icone: <img src={iconeLivre} alt="" className="w-[29px] h-[29px]" />,
    },
    {
      chave: 'uso',
      label: 'Em uso',
      value: statusCounts.charging,
      fundo: 'bg-estado-uso',
      barra: 'bg-estado-uso',
      icone: <img src={iconeEmUso} alt="" className="w-[27px] h-[27px]" />,
    },
    {
      chave: 'offline',
      label: 'Offline',
      value: statusCounts.offline,
      fundo: 'bg-estado-offline',
      barra: 'bg-estado-offline',
      icone: (
        <span className="text-estado-offline-forte">
          <Icone nome="estado-offline" />
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-[25px] pb-12">
      <CabecalhoDaPagina
        titulo="Visão geral"
        subtitulo="Acompanhe o desempenho da sua rede de recarga."
        detalhe={
          <div className="space-y-1">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>{escopo}</span>
              <span
                className="inline-flex items-center gap-1.5"
                title={
                  isConnected
                    ? 'Status dos carregadores ao vivo'
                    : 'Sem conexão ao vivo: os números se atualizam a cada minuto'
                }
              >
                <span
                  className={`w-2 h-2 rounded-full ${isConnected ? 'bg-estado-livre-forte animate-pulse' : 'bg-estado-offline-forte'}`}
                />
                {isConnected ? 'ao vivo' : 'sem ao vivo'}
              </span>
              {temFiltro && (
                <button
                  type="button"
                  onClick={limparFiltros}
                  className="inline-flex items-center gap-1 font-medium text-primary-strong hover:underline"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                  Limpar filtros
                </button>
              )}
            </p>
            {!escopoConfirmado && (
              <p className="text-amber-600 dark:text-amber-400">
                {!localConfirmado
                  ? 'Servidor ainda não filtra por local — números da rede toda.'
                  : 'Servidor ainda não filtra por estação — números sem esse filtro.'}
              </p>
            )}
          </div>
        }
        filtros={
          <>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onClear={() => {
                setStartDate('');
                setEndDate('');
              }}
              placeholder="Todo o período"
              className={`${classeDaPilula} justify-start`}
            />
            {locais.length > 0 && (
              <Select
                value={locationId || 'todos'}
                onValueChange={v => setLocationId(v === 'todos' ? '' : v)}
              >
                <SelectTrigger className={classeDaPilula} aria-label="Filtrar por local">
                  <span className="flex items-center gap-3 min-w-0">
                    <Icone nome="local" />
                    <SelectValue placeholder="Todos os locais" />
                  </span>
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="todos">Todos os locais</SelectItem>
                  {locais.map(l => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {nomeDoLocal(l)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {estacoesDoFiltro.length > 0 && (
              <Select
                value={chargerId || 'todas'}
                onValueChange={v => setChargerId(v === 'todas' ? '' : v)}
              >
                <SelectTrigger className={classeDaPilula} aria-label="Filtrar por estação">
                  <span className="flex items-center gap-3 min-w-0">
                    <Icone nome="estacao" />
                    <SelectValue placeholder="Todas as estações" />
                  </span>
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="todas">Todas as estações</SelectItem>
                  {estacoesDoFiltro.map(e => (
                    <SelectItem key={e.charge_point_id} value={e.charge_point_id}>
                      {nomeDaEstacao(e)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </>
        }
        acoes={
          <BotaoAtualizar
            aoAtualizar={() => {
              void fetchOverview();
              void buscarAgora();
            }}
            carregando={atualizando}
            atualizadoEm={atualizadoEm}
            falhou={falhou}
          />
        }
      />

      {/* Indicadores financeiros e de energia */}
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 ${mostraDepositos ? 'min-[1700px]:grid-cols-4' : 'lg:grid-cols-3'} gap-[25px]`}
      >
        <CartaoIndicador
          tom="marca"
          icone={<Icone nome="kpi-receita-liquida" tamanho={27} />}
          titulo={doLocal?.comissaoOculta ? 'Receita' : 'Receita líquida'}
          subtitulo={
            doLocal && !doLocal.comissaoOculta
              ? `Repasse ao dono (${100 - (doLocal.comissaoPercent ?? 0)}%) · ${filtrado ? rotuloDoPeriodo : 'todo o histórico'}`
              : filtrado
                ? rotuloDoPeriodo
                : 'Todo o histórico'
          }
          valor={<ValorGrande prefixo="R$" valor={fmt(netRevenue)} />}
          variacao={revenueChange}
          rodape={
            doLocal ? (
              // De onde sai o número de cima: receita − comissão = repasse.
              <>
                <LinhaDoRodape
                  rotulo={`Recargas (${doLocal.recargas})`}
                  valor={`R$ ${fmt(doLocal.receita)}`}
                />
                {!doLocal.comissaoOculta && (
                  <LinhaDoRodape
                    rotulo={`Comissão (${doLocal.comissaoPercent}%)`}
                    valor={`− R$ ${fmt(doLocal.comissao ?? 0)}`}
                  />
                )}
                {doLocal.liquidoNeoPower !== undefined && (
                  <LinhaDoRodape
                    rotulo="Líquido NeoPower"
                    valor={`R$ ${fmt(doLocal.liquidoNeoPower)}`}
                    valorClasse="text-primary-strong"
                  />
                )}
              </>
            ) : (
              // Recargas à parte: consumo do saldo, não soma na receita.
              <LinhaDoRodape
                rotulo={isSuperAdmin ? 'Recargas (consumo)' : 'Transações'}
                valor={
                  isSuperAdmin
                    ? `R$ ${fmt(data.revenueTotal || 0)}`
                    : String(data.transactionsTotal || 0)
                }
              />
            )
          }
        />

        <CartaoIndicador
          tom="azul"
          icone={<img src={iconeReceitaOperacional} alt="" className="w-7 h-7" />}
          titulo="Receita operacional"
          subtitulo={filtrado ? rotuloDoPeriodo : 'Mês atual'}
          valor={
            <ValorGrande
              prefixo="R$"
              valor={fmt(filtrado ? data.revenueToday : data.revenueMonth)}
            />
          }
          rodape={
            !filtrado && <LinhaDoRodape rotulo="Hoje" valor={`R$ ${fmt(data.revenueToday)}`} />
          }
        />

        {/* Depósitos: só a plataforma (a API não manda os do operador) e só na
            rede toda — depósito entra na carteira do cliente, não num local. */}
        {mostraDepositos && (
          <CartaoIndicador
            tom="amarelo"
            icone={<img src={iconeDepositos} alt="" className="w-[25px] h-[25px]" />}
            titulo="Depósitos recebidos"
            subtitulo={filtrado ? rotuloDoPeriodo : 'Todo o histórico'}
            valor={<ValorGrande prefixo="R$" valor={fmt(grossDeposits)} />}
            rodape={
              <>
                <LinhaDoRodape rotulo="Depósitos" valor={String(data.depositsCount || 0)} />
                <LinhaDoRodape
                  rotulo="Taxa Mercado Pago"
                  valor={`− R$ ${fmt(data.mercadoPagoFee || 0)}`}
                  valorClasse="text-destructive"
                />
              </>
            }
          />
        )}

        <CartaoIndicador
          tom="cinza"
          icone={<Icone nome="kpi-energia" tamanho={27} />}
          titulo="Energia consumida"
          subtitulo={filtrado ? rotuloDoPeriodo : 'Mês atual'}
          valor={
            <ValorGrande valor={fmt(filtrado ? data.kwhToday : data.kwhMonth, 1)} sufixo="kWh" />
          }
          rodape={
            !filtrado && <LinhaDoRodape rotulo="Hoje" valor={`${fmt(data.kwhToday, 1)} kWh`} />
          }
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-[804fr_749fr] gap-8">
        <section className={`${classeDoCartao} p-[22px] pb-4`} aria-label="Análise da receita">
          <CabecalhoDoCartao
            icone={<Icone nome="grafico-linha" tamanho={30} altura={25} />}
            titulo="Análise da receita"
            subtitulo={`Receita diária das recargas · ${janelaDosGraficos}`}
            selo={<Selo>Receita (R$)</Selo>}
          />
          <div className="mt-4">
            {!data.last7DaysRevenue?.length ? (
              <SemDados
                titulo="Nenhum faturamento registrado"
                texto="Não houve recargas com receita neste período."
              />
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <AreaChart
                  data={data.last7DaysRevenue}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="var(--color-outline-variant)" />
                  <XAxis
                    dataKey="date"
                    tick={eixoDoGrafico}
                    axisLine={false}
                    tickLine={false}
                    dy={8}
                  />
                  <YAxis
                    tick={eixoDoGrafico}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                    tickFormatter={v => `R$ ${v}`}
                  />
                  <Tooltip
                    {...dicaDoGrafico}
                    itemStyle={{ color: 'var(--color-primary-strong)', fontWeight: 700 }}
                    formatter={(v: number) => [`R$ ${fmt(v)}`, 'Receita']}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    fill="url(#revGrad)"
                    dot={{
                      r: 4,
                      fill: 'var(--color-card)',
                      stroke: 'var(--primary)',
                      strokeWidth: 2,
                    }}
                    activeDot={{
                      r: 6,
                      fill: 'var(--primary)',
                      stroke: 'var(--color-card)',
                      strokeWidth: 2,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className={`${classeDoCartao} p-[22px] pb-4`} aria-label="Consumo de energia">
          <CabecalhoDoCartao
            icone={<Icone nome="grafico-barras" />}
            titulo="Consumo de energia"
            subtitulo={`Energia diária entregue (kWh) · ${janelaDosGraficos}`}
            selo={<Selo>Diária</Selo>}
          />
          <div className="mt-4">
            {!data.last7DaysKwh?.length ? (
              <SemDados
                titulo="Nenhum consumo de energia"
                texto="Não houve recargas neste período."
              />
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <BarChart
                  data={data.last7DaysKwh}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <XAxis
                    dataKey="date"
                    tick={eixoDoGrafico}
                    axisLine={{ stroke: '#9e9e9d', strokeWidth: 4 }}
                    tickLine={false}
                    dy={8}
                  />
                  <YAxis
                    tick={eixoDoGrafico}
                    axisLine={{ stroke: '#9e9e9d', strokeWidth: 4 }}
                    tickLine={false}
                    width={64}
                    tickFormatter={v => `${v} kWh`}
                  />
                  <Tooltip
                    {...dicaDoGrafico}
                    itemStyle={{ color: 'var(--color-primary-strong)', fontWeight: 700 }}
                    cursor={{ fill: 'var(--color-muted)' }}
                    formatter={(v: number) => [`${fmt(v, 1)} kWh`, 'Energia']}
                  />
                  <Bar
                    dataKey="value"
                    fill="var(--primary)"
                    fillOpacity={0.6}
                    radius={[5, 5, 0, 0]}
                    maxBarSize={42}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      {/* Operação da rede: status dos carregadores e os números de apoio */}
      <div className="grid grid-cols-1 lg:grid-cols-[887fr_669fr] gap-[30px]">
        <section className={`${classeDoCartao} p-[22px]`} aria-label="Status dos carregadores">
          <CabecalhoDoCartao
            icone={<Icone nome="plugue" />}
            titulo="Status dos carregadores"
            subtitulo="Conectividade e uso da rede"
            selo={
              statusTotal > 0 && (
                <span className="text-sm font-medium text-foreground whitespace-nowrap">
                  {statusPct(statusConectados)}% conectados
                </span>
              )
            }
          />
          {statusTotal === 0 ? (
            <p className="py-10 text-center text-[15px] text-muted-foreground">
              Nenhum carregador instalado ainda.
            </p>
          ) : (
            // Indicador direto no lugar do gráfico de rosca: com poucos
            // carregadores a rosca virava um anel de uma cor só e não se lia nada.
            <div className="mt-4 space-y-4">
              <div>
                <p className="font-semibold text-foreground leading-none">
                  <span className="text-[40px] tabular-nums">{statusConectados}</span>
                  <span className="text-[24px]"> de </span>
                  <span className="text-[40px] tabular-nums">{statusTotal}</span>
                </p>
                <p className="text-[15px] font-medium text-foreground mt-1">
                  Carregadores conectados
                </p>
              </div>

              {/* Barra segmentada: proporção de cada estado */}
              <div
                className="flex h-3 w-full overflow-hidden rounded-[5px] bg-estado-offline"
                role="img"
                aria-label={statusItens.map(d => `${d.label}: ${d.value}`).join(', ')}
              >
                {statusItens
                  .filter(d => d.value > 0 && d.chave !== 'offline')
                  .map(d => (
                    <div
                      key={d.chave}
                      className={`h-full ${d.barra}`}
                      style={{ width: `${(d.value / statusTotal) * 100}%` }}
                      title={`${d.label}: ${d.value}`}
                    />
                  ))}
              </div>

              <div
                className={`grid gap-[27px] ${statusCounts.emInstalacao > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}
              >
                {statusItens.map(d => {
                  const conteudo = (
                    <>
                      {d.icone}
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold text-foreground">
                          {d.label}
                        </span>
                        <span className="block text-sm text-foreground">
                          {statusPct(d.value)}% da rede
                        </span>
                      </span>
                      <span className="text-[24px] font-semibold tabular-nums text-foreground">
                        {d.value}
                      </span>
                    </>
                  );
                  const classe = `${d.fundo} min-h-[59px] rounded-[5px] px-[20px] py-2 flex items-center gap-[14px]`;
                  // Offline leva aos carregadores que precisam de atenção (estudo, H1/H9).
                  return d.chave === 'offline' && d.value > 0 ? (
                    <Link
                      key={d.chave}
                      to="/estacoes?estado=offline"
                      className={`${classe} hover:ring-2 hover:ring-estado-offline-forte/40 transition`}
                      title="Ver os carregadores offline"
                    >
                      {conteudo}
                    </Link>
                  ) : (
                    <div key={d.chave} className={classe}>
                      {conteudo}
                    </div>
                  );
                })}
                {statusCounts.emInstalacao > 0 && (
                  <div className="min-h-[59px] rounded-[5px] px-[20px] py-2 flex items-center gap-[14px] border border-dashed border-border">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-foreground">
                        Em instalação
                      </span>
                      <span className="block text-sm text-foreground">
                        ainda não ligado{statusCounts.emInstalacao === 1 ? '' : 's'}
                      </span>
                    </span>
                    <span className="text-[24px] font-semibold tabular-nums text-foreground">
                      {statusCounts.emInstalacao}
                    </span>
                  </div>
                )}
              </div>

              {statusCounts.offline > 0 && (
                <p className="text-sm text-foreground">
                  {statusCounts.offline === statusTotal
                    ? 'Todos os carregadores estão offline. '
                    : `${statusCounts.offline} carregador${statusCounts.offline === 1 ? '' : 'es'} sem conexão. `}
                  <Link
                    to="/estacoes?estado=offline"
                    className="font-semibold text-primary-strong hover:underline"
                  >
                    Ver quais →
                  </Link>
                </p>
              )}
            </div>
          )}
        </section>

        <div className="flex flex-col gap-[14px]">
          <CartaoLateral
            icone={<Ticket aria-hidden="true" className="w-6 h-6" strokeWidth={2} />}
            rotulo="Vouchers ativos"
            valor={String(data.activeVouchers ?? 0)}
          />
          <CartaoLateral
            icone={<Icone nome="recibo" />}
            rotulo={filtrado ? 'Transações (período)' : 'Transações (mês)'}
            valor={String(data.transactionsMonth)}
          />
          <CartaoLateral
            icone={<Icone nome="estacao" />}
            rotulo="Estações totais"
            valor={String(data.chargers.total)}
          />
        </div>
      </div>

      {/* Agora: recargas em andamento, pelo medidor (não está no Figma; já existia) */}
      {agora !== null && (
        <section className={`${classeDoCartao} p-[22px]`} aria-label="Recargas em andamento agora">
          <CabecalhoDoCartao
            icone={<Icone nome="kpi-receita-liquida" tamanho={22} />}
            titulo="Agora"
            subtitulo="Recargas em andamento, pelo medidor · atualiza a cada 15 s"
            selo={
              locationId && !agoraTemLocal ? (
                <span className="text-sm text-amber-600 dark:text-amber-400">
                  Servidor ainda não separa por local — rede toda
                </span>
              ) : undefined
            }
          />
          <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <NumeroDoAgora rotulo="Em andamento" valor={String(agoraNoEscopo.length)} />
            <NumeroDoAgora
              rotulo="Energia até agora"
              valor={`${fmt(somaAgora.kwh, 1)} kWh`}
              destaque
            />
            <NumeroDoAgora rotulo="Potência agora" valor={`${fmt(somaAgora.kw, 1)} kW`} />
            <NumeroDoAgora rotulo="Valor estimado" valor={`R$ ${fmt(somaAgora.valor)}`} />
          </div>
          {agoraNoEscopo.length > 0 && (
            <div className="mt-4 divide-y divide-border border-t border-border">
              {agoraNoEscopo.slice(0, LINHAS_DO_AGORA).map(r => (
                <div
                  key={r.transactionId}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-[15px]"
                >
                  <span className="font-semibold text-foreground min-w-[120px]">{r.chargerId}</span>
                  <span className="text-muted-foreground basis-full sm:basis-auto sm:flex-1 min-w-0 truncate">
                    {r.userName || `#${r.transactionId}`}
                    {' · desde '}
                    {new Date(r.startTimestamp).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span className="text-foreground tabular-nums">
                    {fmt(r.energyKwh || 0, 2)} kWh
                  </span>
                  <span className="text-muted-foreground tabular-nums w-[72px] text-right">
                    {r.powerKw != null ? `${fmt(r.powerKw, 1)} kW` : '—'}
                  </span>
                  <span className="font-semibold text-primary-strong tabular-nums w-[90px] text-right">
                    R$ {fmt(r.estimatedCost || 0)}
                  </span>
                </div>
              ))}
              {agoraNoEscopo.length > LINHAS_DO_AGORA && (
                <p className="pt-2.5 text-sm text-muted-foreground">
                  + {agoraNoEscopo.length - LINHAS_DO_AGORA} em Transações
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
