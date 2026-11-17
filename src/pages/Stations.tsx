import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ChargerDetailsDialog } from '../components/ChargerDetailsDialog';
import { ChargerLogsSheet } from '../components/ChargerLogsSheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '../components/ui/accordion';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  CirclePlus,
  Copy,
  FilterX,
  HelpCircle,
  Info,
  Network,
  Plug,
  QrCode,
  SearchX,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useSocket } from '../lib/hooks/useSocket';
import { estadoDoCarregador } from '../lib/estadoDoCarregador';
import { QrCodeTemplate, type MarcaDoAdesivo } from '../components/QrCodeTemplate';
import { carregarFonteDaMarca } from '../lib/fonteDaMarca';
import {
  BlocoDeIcone,
  BotaoAtualizar,
  CabecalhoDaPagina,
  classeDaPilula,
  classeDoCartao,
} from '../components/painel/Pagina';
import {
  classeDoBotaoContorno,
  classeDoBotaoPrincipal,
  classeDoCabecalhoDaTabela,
} from '../components/painel/Pecas';
import { Icone, IconeSvg } from '../components/painel/Icone';
import {
  AlternarExibicao,
  BarraDeProgresso,
  BotaoExpandirTodos,
  BotaoLimparFiltros,
  BotaoVerNoMapa,
  BuscaDasEstacoes,
  CabecalhoDaTabela,
  CartaoDaEstacao,
  CartaoDeNumero,
  ChipComContagem,
  ConfirmarExclusao,
  EstadoDoCarregadorNaTabela,
  GRUPOS,
  GRUPO_DO_ESTADO,
  ICONE_DO_GRUPO,
  IconeDoCartao,
  LinhaDaEstacao,
  MenuDoLocal,
  OrdenarPor,
  ResumoDoLocal,
  SeletorComRotulo,
  contarGrupos,
  formatarPercentual,
  formatarPotencia,
  grupoDaUrl,
  rotuloDoGrupo,
  tipoDeCorrente,
  type GrupoDeEstado,
  type ModoDeExibicao,
  type OpcaoDoSeletor,
  type PedidoDeExclusao,
} from '../components/estacoes/PecasDasEstacoes';
import iconeCarregador from '../assets/icones/estacoes-carregador.svg';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface Charger {
  charge_point_id: string;
  model?: string;
  vendor?: string;
  description?: string;
  power_kw?: number;
  num_connectors?: number;
  connector_type?: string;
  locationId: number | null;
  isConnected: boolean;
  last_seen?: string | null;
  ocpp_status?: string | null;
  status?: string;
  clientId?: string | null;
  connection_url?: string;
}

interface Location {
  id: number;
  nomeDoLocal: string;
  endereco: string;
}

const estadoDe = (c: Charger) =>
  estadoDoCarregador({ isConnected: c.isConnected, last_seen: c.last_seen, ocppStatus: c.ocpp_status });

const grupoDe = (c: Charger): GrupoDeEstado => GRUPO_DO_ESTADO[estadoDe(c)];

const nomeDe = (c: Charger) => c.description || c.charge_point_id;

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Valor do select para "carregador da plataforma" — o Radix não aceita "". */
const SEM_OPERADOR = '__plataforma__';

/** Valor "todos" dos seletores de filtro (o Radix também não aceita ""). */
const TODOS = 'todos';

/** Chave do download de QR Codes em lote (vários carregadores num PDF). */
const LOTE_DE_QR = '__lote__';

// Campos do redesenho (pendentes e cadastro): 40 px de altura, cantos de 10 px.
const classeDoCampo = 'h-10 rounded-[10px] bg-card border-border text-foreground text-sm';

type Ordem = 'nome-az' | 'nome-za' | 'estado' | 'atividade';
const ORDENS: OpcaoDoSeletor[] = [
  { valor: 'nome-az', rotulo: 'Nome A-Z' },
  { valor: 'nome-za', rotulo: 'Nome Z-A' },
  { valor: 'estado', rotulo: 'Estado (online primeiro)' },
  { valor: 'atividade', rotulo: 'Última atividade' },
];
// "Estado": online primeiro, depois o que pede atenção, por último o offline.
const PESO_DO_GRUPO: Record<GrupoDeEstado, number> = { online: 0, indisponivel: 1, manutencao: 2, offline: 3 };
const porNome = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' });
const ultimaVez = (c: Charger) => (c.last_seen ? new Date(c.last_seen).getTime() || 0 : 0);

export const Stations = () => {
  const { user } = useAuth();
  // Só a plataforma (admin sem operador) escolhe o dono de um carregador —
  // é o backend que manda, aqui a checagem só evita mostrar um campo que
  // resultaria em 403.
  const ehAdminPlataforma = user?.role === 'admin' && !user?.clientId;
  // Excluir carregador ou local é só admin na API; operador nem vê o botão.
  const isAdmin = user?.role === 'admin';
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [operadores, setOperadores] = useState<{ clientId: string; companyName?: string }[]>([]);
  const [selectedOwners, setSelectedOwners] = useState<{ [key: string]: string }>({});
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  // "Atualizar" e as atualizações depois de salvar/excluir não trocam a tela
  // pelo carregando: o botão mostra o andamento e a hora da última vez.
  const [atualizando, setAtualizando] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [falhou, setFalhou] = useState(false);
  // "Há 2 min" da última atividade: o relógio anda sozinho a cada minuto.
  const [agora, setAgora] = useState(() => new Date());
  const [selectedLocations, setSelectedLocations] = useState<{ [key: string]: string }>({});
  // Edições inline dos carregadores pendentes (descrição, modelo, fabricante,
  // potência, tipo de conector) — permite configurar o equipamento antes mesmo
  // de atribuir um local.
  const [pendingEdits, setPendingEdits] = useState<{
    [id: string]: { description: string; model: string; vendor: string; power_kw: string; connector_type: string };
  }>({});
  const [savingPending, setSavingPending] = useState<string | null>(null);
  const [selectedCharger, setSelectedCharger] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  // O botão de configurações (engrenagem) abre o mesmo diálogo, já em edição.
  const [editarAoAbrir, setEditarAoAbrir] = useState(false);
  // Painel lateral de logs (mensagens OCPP e conexões) de um carregador.
  const [logsCharger, setLogsCharger] = useState<{ id: string; nome: string } | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [downloadingQr, setDownloadingQr] = useState<string | null>(null);
  const [qrPages, setQrPages] = useState<{ chargePointId: string; connectorIndex: number; totalConnectors: number; description?: string; model?: string; vendor?: string; powerKw?: number; connectorType?: string; marca?: MarcaDoAdesivo | null }[]>([]);
  const { chargerStatuses, isConnected: aoVivo } = useSocket();
  const [kwhToday, setKwhToday] = useState(0);
  // null = API sem o campo (antes do deploy): mostra "—".
  const [quedas, setQuedas] = useState<{ hoje: number; mes: number } | null>(null);
  // Confirmação de exclusão aberta (carregador ou local).
  const [pedidoDeExclusao, setPedidoDeExclusao] = useState<PedidoDeExclusao | null>(null);

  // Filtro por estado na URL (?estado=offline): a Visão geral leva direto aos
  // carregadores offline. Busca, local, tipo e ordem ficam só na tela.
  const [params, setParams] = useSearchParams();
  const grupoDoFiltro = grupoDaUrl(params.get('estado'));
  const [busca, setBusca] = useState('');
  const [localDoFiltro, setLocalDoFiltro] = useState(TODOS);
  const [tipoDoFiltro, setTipoDoFiltro] = useState(TODOS);
  const [ordem, setOrdem] = useState<Ordem>('nome-az');
  const [modo, setModo] = useState<ModoDeExibicao>('lista');
  // Locais recolhidos (o resto fica aberto, inclusive os que chegarem depois).
  const [fechados, setFechados] = useState<Set<string>>(() => new Set());
  // Estações marcadas nas caixas de seleção (QR Codes em lote).
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set());

  const escolherGrupo = (grupo: GrupoDeEstado | null) => {
    const novos = new URLSearchParams(params);
    if (grupo) novos.set('estado', grupo);
    else novos.delete('estado');
    setParams(novos, { replace: true });
  };
  const limparFiltros = () => {
    setBusca('');
    setLocalDoFiltro(TODOS);
    setTipoDoFiltro(TODOS);
    escolherGrupo(null);
  };

  const [regForm, setRegForm] = useState({
    charge_point_id: '', description: '', model: '', vendor: '',
    connector_type: '', power_kw: '', num_connectors: '1', locationId: '',
  });

  const mergedChargers = useMemo(() => {
    if (chargerStatuses.size === 0) return chargers;
    return chargers.map(c => {
      const s = chargerStatuses.get(c.charge_point_id);
      if (!s) return c;
      // 'Offline' vem da desconexão; os outros status vêm do próprio
      // carregador, conectado (Unavailable = fora de serviço).
      return {
        ...c,
        isConnected: s.status !== 'Offline',
        ocpp_status: s.status || c.ocpp_status,
        last_seen: c.last_seen ?? s.timestamp,
      };
    });
  }, [chargers, chargerStatuses]);

  // `silencioso`: atualiza os dados sem trocar a página pela tela de
  // carregamento. Depois de salvar ou excluir, a tela inteira era desmontada e
  // remontada: a lista de pendentes fechava, a rolagem voltava ao topo e as
  // seleções das outras linhas se perdiam a cada exclusão.
  const fetchData = async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    setAtualizando(true);
    try {
      const [chRes, locRes, statsRes] = await Promise.all([
        api.get('/chargers'),
        api.get('/locations/all'),
        api.get('/overview-stats'),
      ]);
      if (!chRes.ok || !locRes.ok) throw new Error('Erro ao buscar dados.');
      const chData = await chRes.json();
      const locData = await locRes.json();
      const cl = chData.data || chData;
      const ll = locData.data?.locations || locData.locations || [];
      setChargers(cl);
      setLocations(ll);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setKwhToday(statsData.kwhToday || 0);
        setQuedas(statsData.quedasDeConexao ?? null);
      }

      const init: Record<string, string> = {};
      cl.forEach((c: Charger) => { if (!c.locationId && ll.length > 0) init[c.charge_point_id] = ll[0].id.toString(); });
      // Mantém o local já escolhido nas linhas que continuam pendentes.
      setSelectedLocations(prev => {
        const novo = { ...init };
        for (const id of Object.keys(novo)) {
          if (prev[id] && ll.some((l: { id: number }) => l.id.toString() === prev[id])) novo[id] = prev[id];
        }
        return novo;
      });

      // Dono atual de cada pendente, para o select já abrir no valor certo.
      const donos: Record<string, string> = {};
      cl.forEach((c: Charger) => { donos[c.charge_point_id] = c.clientId || SEM_OPERADOR; });
      setSelectedOwners(donos);
      setAtualizadoEm(new Date());
      setAgora(new Date());
      setFalhou(false);
    } catch {
      toast.error('Erro ao buscar dados');
      // Os dados que já estavam na tela ficam; o botão avisa que não atualizou.
      setFalhou(true);
    }
    finally {
      setLoading(false);
      setAtualizando(false);
    }
  };

  useEffect(() => { void fetchData(); }, []);

  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Lista de white labels, para vincular um carregador ao operador dono.
  // Só a plataforma enxerga (e só ela pode gravar).
  useEffect(() => {
    if (!ehAdminPlataforma) return;
    void (async () => {
      try {
        const r = await api.get('/admin/branding');
        if (!r.ok) return;
        const d = await r.json();
        setOperadores(Array.isArray(d.data) ? d.data : []);
      } catch { /* sem a lista, o select fica vazio e o resto da tela segue */ }
    })();
  }, [ehAdminPlataforma]);

  // Quem chega pela Visão geral (?estado=offline) cai direto nos filtros e na
  // lista filtrada, sem rolar por cima dos cartões.
  const filtrosRef = useRef<HTMLElement>(null);
  const jaRolouParaOFiltro = useRef(false);
  useEffect(() => {
    if (loading || jaRolouParaOFiltro.current) return;
    jaRolouParaOFiltro.current = true;
    if (grupoDoFiltro) filtrosRef.current?.scrollIntoView?.({ block: 'start' });
  }, [loading, grupoDoFiltro]);

  // Valores de edição de um pendente: o que o usuário digitou, ou os dados atuais.
  const pendingDefaults = (c: Charger) => ({
    description: c.description ?? '',
    model: c.model ?? '',
    vendor: c.vendor ?? '',
    power_kw: c.power_kw != null ? String(c.power_kw) : '',
    connector_type: c.connector_type ?? '',
  });
  const editOf = (c: Charger) => pendingEdits[c.charge_point_id] ?? pendingDefaults(c);
  const setEdit = (c: Charger, patch: Partial<ReturnType<typeof pendingDefaults>>) =>
    setPendingEdits(prev => ({
      ...prev,
      [c.charge_point_id]: { ...(prev[c.charge_point_id] ?? pendingDefaults(c)), ...patch },
    }));

  // Salva um pendente: grava as infos editadas (/info) e, se um local foi
  // escolhido, associa (/assign-location). Assim dá pra editar as informações
  // mesmo sem atribuir um local ainda.
  const handleSavePending = async (c: Charger) => {
    const ed = editOf(c);
    const locationId = selectedLocations[c.charge_point_id];
    setSavingPending(c.charge_point_id);
    try {
      const info = await api.put(`/chargers/${encodeURIComponent(c.charge_point_id)}/info`, {
        description: ed.description.trim() || null,
        model: ed.model.trim() || null,
        vendor: ed.vendor.trim() || null,
        power_kw: ed.power_kw ? Number(ed.power_kw) : null,
        connector_type: ed.connector_type || null,
      });
      if (!info.ok) {
        const b = await info.json().catch(() => null);
        throw new Error(b?.error || 'Erro ao salvar informações');
      }

      // Dono ANTES do local: trocar de operador desfaz um local que pertença a
      // outro tenant, então associar primeiro perderia a associação.
      const donoEscolhido = selectedOwners[c.charge_point_id];
      const donoAtual = c.clientId || SEM_OPERADOR;
      if (ehAdminPlataforma && donoEscolhido && donoEscolhido !== donoAtual) {
        const owner = await api.put(`/chargers/${encodeURIComponent(c.charge_point_id)}/owner`, {
          clientId: donoEscolhido === SEM_OPERADOR ? null : donoEscolhido,
        });
        if (!owner.ok) {
          const b = await owner.json().catch(() => null);
          throw new Error(b?.error || 'Erro ao vincular o operador');
        }
      }

      if (locationId) {
        const assign = await api.put(`/chargers/${encodeURIComponent(c.charge_point_id)}/assign-location`, { locationId: parseInt(locationId) });
        if (!assign.ok) {
          const b = await assign.json().catch(() => null);
          throw new Error(b?.error || 'Erro ao atribuir local');
        }
      }
      // Limpa o rascunho para o valor recarregado do backend voltar a valer.
      setPendingEdits(prev => { const n = { ...prev }; delete n[c.charge_point_id]; return n; });
      toast.success(locationId ? 'Carregador salvo e associado!' : 'Informações salvas!');
      void fetchData(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSavingPending(null);
    }
  };

  // URL de conexao do carregador recem-cadastrado, devolvida pelo backend.
  // Mostrada no proprio modal: e o momento em que o instalador esta com o
  // equipamento na mao e precisa do endereco para configurar.
  const [connectionUrl, setConnectionUrl] = useState<string | null>(null);

  const handleRegisterCharger = async () => {
    if (!regForm.charge_point_id.trim()) { toast.error('ID obrigatório'); return; }
    setRegistering(true);
    try {
      const p: Record<string, unknown> = { charge_point_id: regForm.charge_point_id.trim() };
      if (regForm.description) p.description = regForm.description;
      if (regForm.model) p.model = regForm.model;
      if (regForm.vendor) p.vendor = regForm.vendor;
      if (regForm.connector_type) p.connector_type = regForm.connector_type;
      if (regForm.power_kw) p.power_kw = parseFloat(regForm.power_kw);
      if (regForm.num_connectors) p.num_connectors = parseInt(regForm.num_connectors);
      if (regForm.locationId) p.locationId = parseInt(regForm.locationId);
      const r = await api.post('/chargers/register', p);
      const d = await r.json();
      if (!r.ok) { throw new Error(d.error || 'Erro'); }
      toast.success('Carregador registrado!');
      // Nao fecha ainda: mostra a URL de conexao para o instalador copiar.
      setConnectionUrl(d?.data?.connectionUrl ?? null);
      setRegForm({ charge_point_id: '', description: '', model: '', vendor: '', connector_type: '', power_kw: '', num_connectors: '1', locationId: '' });
      void fetchData(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro'); }
    finally { setRegistering(false); }
  };

  // Copia um texto (o link de conexão do servidor) para a área de transferência.
  const copyLink = (url: string) => {
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success('Link copiado'))
      .catch(() => toast.error('Não foi possível copiar'));
  };

  // A confirmação (AlertDialog) vem antes: ver pedirExclusaoDoCarregador.
  const handleDeleteCharger = async (chargerId: string) => {
    try {
      const r = await api.delete(`/chargers/${encodeURIComponent(chargerId)}`);
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || 'Erro ao excluir carregador');
      toast.success('Carregador excluído');
      // Some da lista na hora; a atualização em seguida só confirma.
      setChargers(prev => prev.filter(c => c.charge_point_id !== chargerId));
      void fetchData(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir carregador');
    }
  };

  const handleDeleteLocation = async (locId: number) => {
    try {
      const r = await api.delete(`/locations/${locId}`);
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || 'Erro ao excluir local');
      toast.success('Local excluído');
      setLocations(prev => prev.filter(l => l.id !== locId));
      void fetchData(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir local');
    }
  };

  // Confirmações que dizem a consequência (estudo de usabilidade, H5).
  const pedirExclusaoDoCarregador = (c: Charger) => {
    setPedidoDeExclusao({
      titulo: 'Excluir carregador?',
      consequencia: (
        <>
          O cadastro de <strong>“{nomeDe(c)}”</strong>
          {c.description ? ` (${c.charge_point_id})` : ''} sai da lista de estações e do app, e o
          QR Code dele deixa de levar à recarga. Esta ação não pode ser desfeita.
        </>
      ),
      aviso: 'O servidor não exclui um carregador com recarga em andamento.',
      rotuloDoBotao: 'Excluir carregador',
      aoConfirmar: () => void handleDeleteCharger(c.charge_point_id),
    });
  };

  const pedirExclusaoDoLocal = (loc: Location, carregadores: number) => {
    setPedidoDeExclusao({
      titulo: 'Excluir local?',
      consequencia: (
        <>
          O local <strong>“{loc.nomeDoLocal}”</strong> sai do painel e do app, com endereço e
          dados de cadastro. Esta ação não pode ser desfeita.
        </>
      ),
      aviso:
        carregadores > 0
          ? `Este local ainda tem ${plural(carregadores, 'carregador', 'carregadores')}. O servidor só exclui um local sem carregadores: exclua-os antes (no “…” de cada estação).`
          : undefined,
      rotuloDoBotao: 'Excluir local',
      aoConfirmar: () => void handleDeleteLocation(loc.id),
    });
  };

  // Gera o PDF dos adesivos de QR Code: um carregador (menu "…") ou vários
  // (caixas de seleção), uma página por conector.
  const handleDownloadQrCode = async (chargerIds: string[]) => {
    if (chargerIds.length === 0) return;
    let estiloDoPdf: HTMLStyleElement | null = null;
    setDownloadingQr(chargerIds.length === 1 ? chargerIds[0] : LOTE_DE_QR);
    toast.loading(chargerIds.length === 1 ? 'Gerando QR Code...' : `Gerando ${chargerIds.length} QR Codes...`, { id: 'qr-gen' });
    try {
      // O adesivo leva a marca do operador dono do carregador (o cliente final
      // usa o app dele), não a de quem está gerando o PDF. Uma busca por marca.
      const marcas = new Map<string, MarcaDoAdesivo | null>();
      const marcaDoOperador = async (clientId?: string | null): Promise<MarcaDoAdesivo | null> => {
        if (!clientId) return null;
        if (marcas.has(clientId)) return marcas.get(clientId) ?? null;
        let marca: MarcaDoAdesivo | null = null;
        try {
          const r = await api.get(`/branding/${encodeURIComponent(clientId)}`);
          if (r.ok) {
            const d = (await r.json()).data;
            if (d) {
              // O fundo do adesivo é escuro (ou o headerColor da marca): logo
              // e cor da versão para fundo escuro.
              marca = {
                companyName: d.companyName,
                logoUri: d.logoUri || null,
                logoUriDark: d.logoUriDark || null,
                primaryColor: d.primaryColorDark || d.primaryColor || null,
                accentColor: d.accentColor || null,
                accentTextColor: d.accentTextColor || null,
                headerColor: d.headerColor || null,
                fontFamily: d.fontFamily || null,
              };
            }
          }
        } catch { /* sem a marca do operador, usa a do usuário */ }
        marcas.set(clientId, marca);
        return marca;
      };

      const pages: typeof qrPages = [];
      // A fonte de cada marca baixa enquanto o adesivo monta; a captura espera por ela.
      const fontes: Promise<unknown>[] = [];
      for (const chargerId of chargerIds) {
        const charger = mergedChargers.find(c => c.charge_point_id === chargerId);
        const numConn = Number(charger?.num_connectors) || 1;
        const marca = await marcaDoOperador(charger?.clientId);
        fontes.push(Promise.resolve(carregarFonteDaMarca((marca ?? user?.branding)?.fontFamily)));
        for (let i = 0; i < numConn; i++) {
          pages.push({
            chargePointId: chargerId,
            connectorIndex: i + 1,
            totalConnectors: numConn,
            description: charger?.description,
            model: charger?.model,
            vendor: charger?.vendor,
            powerKw: charger?.power_kw,
            connectorType: charger?.connector_type,
            marca,
          });
        }
      }
      setQrPages(pages);

      // Wait for render
      await new Promise(resolve => setTimeout(resolve, 800));
      // O html2canvas desenha o texto com as fontes já carregadas no documento:
      // sem esperar, o PDF sai na fonte reserva.
      await Promise.all(fontes);
      await document.fonts?.ready;

      const root = document.getElementById('qrcode-report-root');
      if (!root) throw new Error('Template não encontrado');

      // O html2canvas mede a linha de base do texto com um <img> num <div> solto
      // no <body>; o `img { display: block }` do Tailwind estraga a medida e
      // desloca todo texto para baixo no PDF. A regra só alcança esse <div>.
      estiloDoPdf = document.createElement('style');
      estiloDoPdf.textContent = 'body > div:not(#root) > img { display: inline-block !important; }';
      document.head.appendChild(estiloDoPdf);

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Each child is a page div (794x1123px)
      const pageElements = root.children;
      for (let i = 0; i < pageElements.length; i++) {
        if (i > 0) pdf.addPage();

        const pagina = pageElements[i] as HTMLElement;
        const canvas = await html2canvas(pagina, {
          scale: 2,
          useCORS: true,
          logging: false,
          // Mesmo fundo da página (o headerColor da marca, ou o grafite).
          backgroundColor: pagina.style.backgroundColor || '#111114',
          windowWidth: 794,
          onclone: (doc) => {
            const allEls = doc.getElementsByTagName('*');
            for (let j = 0; j < allEls.length; j++) {
              const el = allEls[j] as HTMLElement;
              if (el.style) {
                for (let k = 0; k < el.style.length; k++) {
                  const prop = el.style[k];
                  const val = el.style.getPropertyValue(prop);
                  if (val && val.includes('oklch')) {
                    el.style.setProperty(prop, 'transparent', 'important');
                  }
                }
              }
            }
          },
        });

        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      }

      pdf.save(chargerIds.length === 1 ? `qrcode-${chargerIds[0]}.pdf` : `qrcodes-${chargerIds.length}-carregadores.pdf`);
      toast.success(chargerIds.length === 1 ? 'QR Code gerado com sucesso!' : 'QR Codes gerados com sucesso!', { id: 'qr-gen' });
    } catch (err) {
      console.error('Erro ao gerar QR Code:', err);
      toast.error('Erro ao gerar QR Code', { id: 'qr-gen' });
    } finally {
      estiloDoPdf?.remove();
      setDownloadingQr(null);
      setQrPages([]);
    }
  };

  const pendingChargers = mergedChargers.filter(c => !c.locationId);
  const assignedChargers = mergedChargers.filter(c => c.locationId);

  const { topChargerName, topChargerKwh } = useMemo(() => {
    if (mergedChargers.length === 0) return { topChargerName: '—', topChargerKwh: 0 };
    const sorted = [...mergedChargers].sort((a, b) => {
      const kwhA = (a as any).total_kwh_charged || 0;
      const kwhB = (b as any).total_kwh_charged || 0;
      return kwhB - kwhA;
    });
    const top = sorted[0];
    const kwh = (top as any).total_kwh_charged || 0;
    return {
      topChargerName: top.description || top.charge_point_id,
      topChargerKwh: kwh
    };
  }, [mergedChargers]);

  const activePower = useMemo(() => {
    return mergedChargers
      .filter(c => {
        const statusEvent = chargerStatuses.get(c.charge_point_id);
        const status = statusEvent?.status || c.status;
        return status === 'Charging';
      })
      // power_kw chega como texto ("60.00", decimal do banco): somar sem
      // converter concatenava.
      .reduce((acc, c) => acc + (Number(c.power_kw) || 0), 0);
  }, [mergedChargers, chargerStatuses]);

  const chargersByLocation = useMemo(() => {
    const groups: Record<number | string, Charger[]> = {};
    assignedChargers.forEach(c => {
      const locId = c.locationId || 'unknown';
      if (!groups[locId]) groups[locId] = [];
      groups[locId].push(c);
    });
    return groups;
  }, [assignedChargers]);

  // Base do link de conexão de quem está vendo: marca → /ocpp/<marca>/;
  // plataforma (admin sem marca) → /ocpp/, onde conectam os carregadores sem
  // marca. O instalador acrescenta o ID ao final, ou copia o link completo de
  // cada estação abaixo. Antes a base saía do primeiro carregador da lista, e o
  // admin, que vê todas as marcas, recebia o link de outra (/ocpp/FulgoTeste/).
  const serverBase = useMemo(() => {
    const exemplo = mergedChargers.find(c => c.connection_url)?.connection_url;
    const raiz = exemplo?.match(/^(.*?\/ocpp\/)/)?.[1] ?? 'wss://neocms.up.railway.app/ocpp/';
    const marca = ehAdminPlataforma ? null : user?.clientId || user?.branding?.clientId || null;
    return marca ? `${raiz}${marca}/` : raiz;
  }, [mergedChargers, ehAdminPlataforma, user?.clientId, user?.branding?.clientId]);

  // --- Cartões do topo: a rede inteira, sem os filtros -----------------------
  const totalDeEstacoes = mergedChargers.length;
  const contagemDaRede = contarGrupos(mergedChargers.map(estadoDe));
  const emInstalacao = mergedChargers.filter(c => estadoDe(c) === 'instalacao').length;
  // Disponibilidade = funcionando agora (disponíveis ou carregando) sobre os
  // instalados; o cadastrado que nunca ligou não derruba a conta.
  const instalados = totalDeEstacoes - emInstalacao;
  const disponibilidade = instalados > 0 ? contagemDaRede.online / instalados : 0;
  const fracaoDoTotal = (n: number) => (totalDeEstacoes > 0 ? n / totalDeEstacoes : 0);

  // --- Filtros ----------------------------------------------------------------
  const localPorId = useMemo(() => new Map(locations.map(l => [l.id, l])), [locations]);
  const termo = busca.trim().toLocaleLowerCase('pt-BR');
  // Busca por estação (nome, equipamento), ID ou localização (nome e endereço).
  const casaComBusca = (c: Charger) => {
    if (!termo) return true;
    const loc = c.locationId != null ? localPorId.get(c.locationId) : undefined;
    return [c.description, c.charge_point_id, c.model, c.vendor, loc?.nomeDoLocal, loc?.endereco].some(v =>
      v?.toLocaleLowerCase('pt-BR').includes(termo)
    );
  };
  const passaSemOEstado = (c: Charger) =>
    casaComBusca(c) &&
    (localDoFiltro === TODOS || String(c.locationId ?? '') === localDoFiltro) &&
    (tipoDoFiltro === TODOS || tipoDeCorrente(c) === tipoDoFiltro);
  const passaNoFiltro = (c: Charger) => passaSemOEstado(c) && (!grupoDoFiltro || grupoDe(c) === grupoDoFiltro);
  const temFiltro = !!grupoDoFiltro || !!termo || localDoFiltro !== TODOS || tipoDoFiltro !== TODOS;
  // Contagem dos chips: sobre o que os outros filtros deixam (o estado é o próprio chip).
  const baseDosChips = mergedChargers.filter(passaSemOEstado);
  const contagemDosChips = contarGrupos(baseDosChips.map(estadoDe));
  const pendentesVisiveis = pendingChargers.filter(passaNoFiltro);

  const opcoesDeLocal: OpcaoDoSeletor[] = [
    { valor: TODOS, rotulo: 'Todas' },
    ...locations
      .filter(l => (chargersByLocation[l.id] || []).length > 0)
      .map(l => ({ valor: String(l.id), rotulo: l.nomeDoLocal }))
      .sort((a, b) => porNome(a.rotulo, b.rotulo)),
  ];

  // --- Ordem ------------------------------------------------------------------
  const comparaEstacoes = (a: Charger, b: Charger) => {
    switch (ordem) {
      case 'nome-za':
        return porNome(nomeDe(b), nomeDe(a));
      case 'estado':
        return PESO_DO_GRUPO[grupoDe(a)] - PESO_DO_GRUPO[grupoDe(b)] || porNome(nomeDe(a), nomeDe(b));
      case 'atividade':
        return ultimaVez(b) - ultimaVez(a) || porNome(nomeDe(a), nomeDe(b));
      default:
        return porNome(nomeDe(a), nomeDe(b));
    }
  };
  const comparaLocais = (
    a: { loc: Location; lista: Charger[] },
    b: { loc: Location; lista: Charger[] }
  ) => {
    const online = (l: Charger[]) => l.filter(c => grupoDe(c) === 'online').length;
    const recente = (l: Charger[]) => Math.max(0, ...l.map(ultimaVez));
    switch (ordem) {
      case 'nome-za':
        return porNome(b.loc.nomeDoLocal, a.loc.nomeDoLocal);
      case 'estado':
        return online(b.lista) - online(a.lista) || porNome(a.loc.nomeDoLocal, b.loc.nomeDoLocal);
      case 'atividade':
        return recente(b.lista) - recente(a.lista) || porNome(a.loc.nomeDoLocal, b.loc.nomeDoLocal);
      default:
        return porNome(a.loc.nomeDoLocal, b.loc.nomeDoLocal);
    }
  };

  const locaisDaLista = locations
    .map(loc => ({ loc, lista: chargersByLocation[loc.id] || [] }))
    .filter(({ lista }) => lista.some(passaNoFiltro))
    .sort(comparaLocais);

  // Carregadores de locais que não vieram na lista (apagados ou de outro escopo).
  const outrosCarregadores = Object.keys(chargersByLocation)
    .filter(key => key !== 'unknown' && !locations.some(l => l.id.toString() === key.toString()))
    .flatMap(key => chargersByLocation[key]);
  const outrosVisiveis = outrosCarregadores.filter(passaNoFiltro);

  // --- Sanfona: "Expandir todos" ----------------------------------------------
  const valoresVisiveis = [
    ...locaisDaLista.map(({ loc }) => `location-${loc.id}`),
    ...(outrosVisiveis.length > 0 ? ['location-unknown'] : []),
  ];
  const abertos = valoresVisiveis.filter(v => !fechados.has(v));
  const todosAbertos = valoresVisiveis.length > 0 && abertos.length === valoresVisiveis.length;
  const aoMudarAbertos = (novos: string[]) =>
    setFechados(prev => {
      const n = new Set(prev);
      for (const v of valoresVisiveis) {
        if (novos.includes(v)) n.delete(v);
        else n.add(v);
      }
      return n;
    });
  const alternarTodos = () => setFechados(todosAbertos ? new Set(valoresVisiveis) : new Set());

  // --- Seleção ----------------------------------------------------------------
  const selecionadosValidos = mergedChargers
    .map(c => c.charge_point_id)
    .filter(id => selecionados.has(id));
  const alternarSelecao = (ids: string[], marcar: boolean) =>
    setSelecionados(prev => {
      const n = new Set(prev);
      for (const id of ids) {
        if (marcar) n.add(id);
        else n.delete(id);
      }
      return n;
    });

  const abrirDetalhes = (id: string, editar: boolean) => {
    setEditarAoAbrir(editar);
    setSelectedCharger(id);
    setDetailsOpen(true);
  };

  const propsDaEstacao = (c: Charger) => ({
    estacao: c,
    estado: estadoDe(c),
    agora,
    selecionada: selecionados.has(c.charge_point_id),
    aoSelecionar: (marcar: boolean) => alternarSelecao([c.charge_point_id], marcar),
    gerandoQr: downloadingQr === c.charge_point_id,
    aoVerDetalhes: () => abrirDetalhes(c.charge_point_id, false),
    aoVerAtividade: () => { setLogsCharger({ id: c.charge_point_id, nome: nomeDe(c) }); setLogsOpen(true); },
    aoEditar: () => abrirDetalhes(c.charge_point_id, true),
    aoBaixarQr: () => void handleDownloadQrCode([c.charge_point_id]),
    aoCopiarLink: copyLink,
    aoExcluir: isAdmin ? () => pedirExclusaoDoCarregador(c) : undefined,
  });

  // Tabela (ou grade) das estações de um local; quando o filtro esconde
  // algumas, diz quantas ficaram de fora.
  const corpoDoLocal = (lista: Charger[]) => {
    const visiveis = lista.filter(passaNoFiltro).sort(comparaEstacoes);
    const ids = visiveis.map(c => c.charge_point_id);
    const marcadas = ids.filter(id => selecionados.has(id)).length;
    const fora = lista.length - visiveis.length;
    return (
      <>
        {modo === 'lista' ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] table-fixed text-left border-collapse">
              <CabecalhoDaTabela
                selecao={marcadas === 0 ? false : marcadas === ids.length ? true : 'indeterminate'}
                aoSelecionarTodas={marcar => alternarSelecao(ids, marcar)}
              />
              <tbody>
                {visiveis.map(c => (
                  <LinhaDaEstacao key={c.charge_point_id} {...propsDaEstacao(c)} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(330px,1fr))] gap-4 px-6 pb-6 pt-2">
            {visiveis.map(c => (
              <CartaoDaEstacao key={c.charge_point_id} {...propsDaEstacao(c)} />
            ))}
          </ul>
        )}
        {fora > 0 && (
          <p className="px-6 py-3 border-t border-border text-[13px] text-muted-foreground">
            {plural(fora, 'estação deste local não aparece', 'estações deste local não aparecem')} por causa dos filtros.
          </p>
        )}
      </>
    );
  };

  // Gatilho da sanfona do local: o cabeçalho inteiro abre e fecha.
  const classeDoGatilho =
    'p-0 items-center gap-4 rounded-[10px] hover:no-underline text-left [&>svg]:size-6 [&>svg]:text-foreground';

  const unidades = (n: number) => plural(n, 'unidade', 'unidades');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const naoCarregou = falhou && !atualizadoEm;
  const nadaNosFiltros =
    temFiltro && totalDeEstacoes > 0 && pendentesVisiveis.length === 0 && locaisDaLista.length === 0 && outrosVisiveis.length === 0;

  return (
    <div className="space-y-[25px] pb-12">
      <CabecalhoDaPagina
        titulo="Estações de Recarga"
        subtitulo="Gerencie sua rede de modo geral."
        acoes={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-4 3xl:gap-8">
            {/* "Período" do Frame 10: os números desta tela são do momento (a
                API não guarda disponibilidade por período), e a pílula diz isso. */}
            <span
              className={`${classeDaPilula} inline-flex items-center justify-center`}
              title={
                aoVivo
                  ? 'Os números desta tela são de agora, com o status dos carregadores ao vivo'
                  : 'Os números desta tela são de agora (sem conexão ao vivo: use Atualizar)'
              }
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${aoVivo ? 'bg-estado-livre-forte animate-pulse' : 'bg-estado-offline-forte'}`}
                aria-hidden="true"
              />
              Período: agora
            </span>
            <BotaoAtualizar
              aoAtualizar={() => void fetchData(true)}
              carregando={atualizando}
              atualizadoEm={atualizadoEm}
              falhou={falhou}
            />
          </div>
        }
      />

      {/* A primeira busca falhou: sem dados, a tela diria "nenhuma estação". */}
      {naoCarregou && (
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-[15px] bg-destructive/10 text-foreground">
          <AlertTriangle aria-hidden="true" className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
          <p className="flex-1 text-[15px] font-medium">Não foi possível carregar as estações.</p>
          <button type="button" onClick={() => void fetchData()} className={classeDoBotaoContorno}>
            Tentar de novo
          </button>
        </div>
      )}

      {/* Cartões: Saúde da rede, Estações, Online, Offline */}
      {totalDeEstacoes > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[minmax(0,546fr)_repeat(3,minmax(0,260fr))] gap-[15px]">
          <section
            className={`${classeDoCartao} p-[22px] min-h-[200px] flex flex-col sm:col-span-2 xl:col-span-1`}
            aria-labelledby="titulo-saude"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-[14px] min-w-0">
                <BlocoDeIcone tom="marca">
                  <Activity aria-hidden="true" className="w-5 h-5" />
                </BlocoDeIcone>
                <h2 id="titulo-saude" className="text-[20px] leading-tight font-semibold text-foreground">
                  Saúde da rede
                </h2>
              </div>
              {/* O círculo do Frame: como o número é feito e os outros números da rede. */}
              <Popover>
                <PopoverTrigger
                  className="size-8 shrink-0 rounded-full border border-foreground/60 dark:border-primary text-foreground dark:text-primary-strong inline-flex items-center justify-center hover:bg-muted transition"
                  aria-label="Como a saúde da rede é calculada"
                  title="Como a saúde da rede é calculada"
                >
                  <Info aria-hidden="true" className="w-4 h-4" />
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[min(380px,calc(100vw-32px))] rounded-[15px] border-border bg-popover p-5 shadow-cartao space-y-3">
                  <p className="text-[15px] font-semibold text-foreground">Como calculamos</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Estações funcionando agora (disponíveis ou carregando) sobre as instaladas.
                    {emInstalacao > 0 && ` ${plural(emInstalacao, 'estação em instalação, que nunca conectou, fica', 'estações em instalação, que nunca conectaram, ficam')} de fora.`}{' '}
                    É uma foto do momento: a API ainda não guarda a disponibilidade de períodos anteriores.
                  </p>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm border-t border-border pt-3 [&>dt]:whitespace-nowrap">
                    <dt className="text-muted-foreground">Funcionando agora</dt>
                    <dd className="font-semibold text-foreground text-right tabular-nums">{contagemDaRede.online} de {instalados}</dd>
                    {/* Desconexões registradas pelo servidor (connection_events); antes era um número inventado. */}
                    <dt className="text-muted-foreground">Quedas de conexão</dt>
                    <dd className="font-semibold text-foreground text-right tabular-nums">
                      {quedas ? `${quedas.hoje} hoje · ${quedas.mes} no mês` : '—'}
                    </dd>
                    <dt className="text-muted-foreground">Carregador líder</dt>
                    <dd className="font-semibold text-foreground text-right">
                      <span className="block max-w-[150px] truncate" title={topChargerName}>{topChargerName}</span>
                      <span className="block text-xs font-medium text-muted-foreground">{topChargerKwh.toFixed(1)} kWh no total</span>
                    </dd>
                    <dt className="text-muted-foreground">Consumo hoje</dt>
                    <dd className="font-semibold text-foreground text-right tabular-nums">{kwhToday.toFixed(1)} kWh</dd>
                    <dt className="text-muted-foreground">Potência ativa</dt>
                    <dd className="font-semibold text-foreground text-right tabular-nums">{formatarPotencia(activePower)}</dd>
                  </dl>
                </PopoverContent>
              </Popover>
            </div>
            <p className="text-sm text-foreground mt-3 max-w-[380px]">
              Status técnico geral de todos os carregadores instalados, neste momento
            </p>
            <div className="mt-auto pt-4 space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                <p className="text-[clamp(2.25rem,3vw,3.25rem)] leading-none font-semibold tabular-nums text-foreground">
                  {formatarPercentual(disponibilidade).replace('%', ' %')}
                </p>
                <p className="text-sm font-medium text-foreground">Disponibilidade geral da rede, agora</p>
              </div>
              <BarraDeProgresso fracao={disponibilidade} cor="bg-primary" rotulo="Disponibilidade geral da rede" />
            </div>
          </section>

          <CartaoDeNumero
            icone={
              <IconeDoCartao classe="bg-primary-soft text-primary-strong">
                <IconeSvg src={iconeCarregador} tamanho={19} altura={24} />
              </IconeDoCartao>
            }
            titulo="Estações"
            valor={totalDeEstacoes}
            legenda="Total de estações na rede"
          />
          <CartaoDeNumero
            icone={
              <IconeDoCartao classe="bg-estado-livre text-estado-livre-forte">
                <Wifi className="w-5 h-5" />
              </IconeDoCartao>
            }
            titulo="Online"
            valor={contagemDaRede.online}
            legenda={`${formatarPercentual(fracaoDoTotal(contagemDaRede.online))} do total`}
            fracao={fracaoDoTotal(contagemDaRede.online)}
            corDaBarra="bg-estado-livre-forte"
          />
          <CartaoDeNumero
            icone={
              <IconeDoCartao classe="bg-estado-offline text-estado-offline-forte">
                <WifiOff className="w-5 h-5" />
              </IconeDoCartao>
            }
            titulo="Offline"
            valor={contagemDaRede.offline}
            legenda={`${formatarPercentual(fracaoDoTotal(contagemDaRede.offline))} do total`}
            fracao={fracaoDoTotal(contagemDaRede.offline)}
            corDaBarra="bg-estado-offline-forte"
          />
        </div>
      )}

      {/* Filtros: busca, seletores, chips por estado (o estado vai para a URL) e ordem */}
      {totalDeEstacoes > 0 && (
        <section
          ref={filtrosRef}
          aria-label="Filtros"
          className={`${classeDoCartao} scroll-mt-28 px-6 py-6 3xl:px-8 space-y-5`}
        >
          <div className="flex flex-wrap items-center gap-3">
            {/* Abaixo de 1700 px a busca fica numa linha só dela: ao lado dos
                quatro seletores ela encolhia até cortar o texto. */}
            <BuscaDasEstacoes
              className="basis-full 3xl:basis-0 3xl:flex-1 min-w-[240px]"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por estação, ID ou localização..."
              aria-label="Buscar por estação, ID ou localização"
            />
            <SeletorComRotulo
              rotulo="Estado"
              valor={grupoDoFiltro ?? TODOS}
              opcoes={[{ valor: TODOS, rotulo: 'Todos' }, ...GRUPOS.map(g => ({ valor: g.id, rotulo: g.rotulo }))]}
              aoMudar={v => escolherGrupo(v === TODOS ? null : (v as GrupoDeEstado))}
              className="w-full sm:w-auto sm:flex-1 3xl:flex-none 3xl:w-[160px]"
            />
            <SeletorComRotulo
              rotulo="Localizações"
              valor={localDoFiltro}
              opcoes={opcoesDeLocal}
              aoMudar={setLocalDoFiltro}
              className="w-full sm:w-auto sm:flex-1 3xl:flex-none 3xl:w-[180px]"
            />
            <SeletorComRotulo
              rotulo="Tipos de carregador"
              valor={tipoDoFiltro}
              opcoes={[
                { valor: TODOS, rotulo: 'Todos' },
                { valor: 'AC', rotulo: 'AC' },
                { valor: 'DC', rotulo: 'DC' },
              ]}
              aoMudar={setTipoDoFiltro}
              className="w-full sm:w-auto sm:flex-1 3xl:flex-none 3xl:w-[180px]"
            />
            <BotaoLimparFiltros
              aoLimpar={limparFiltros}
              ativo={temFiltro}
              icone={<FilterX aria-hidden="true" className="w-5 h-5" />}
              className="w-full sm:w-auto sm:flex-1 3xl:flex-none 3xl:w-[170px]"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap items-center gap-2.5">
              <ChipComContagem
                ativo={!grupoDoFiltro}
                aoClicar={() => escolherGrupo(null)}
                icone={<CircleDot className="w-4 h-4" />}
                rotulo="Todos"
                contagem={baseDosChips.length}
              />
              {GRUPOS.map(g => (
                <ChipComContagem
                  key={g.id}
                  ativo={grupoDoFiltro === g.id}
                  aoClicar={() => escolherGrupo(grupoDoFiltro === g.id ? null : g.id)}
                  icone={ICONE_DO_GRUPO[g.id]}
                  rotulo={g.rotulo}
                  contagem={contagemDosChips[g.id]}
                  dica={g.dica}
                />
              ))}
            </div>
            <div className="ml-auto">
              <OrdenarPor valor={ordem} opcoes={ORDENS} aoMudar={v => setOrdem(v as Ordem)} />
            </div>
          </div>
        </section>
      )}

      {/* Exibição: seleção à esquerda (só com estações marcadas); expandir, mapa e lista/grade à direita */}
      {(locaisDaLista.length > 0 || outrosVisiveis.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-h-11 flex flex-wrap items-center gap-3">
            {selecionadosValidos.length > 0 && (
              <>
                <span className="text-[15px] font-semibold text-foreground">
                  {plural(selecionadosValidos.length, 'estação selecionada', 'estações selecionadas')}
                </span>
                <button
                  type="button"
                  onClick={() => void handleDownloadQrCode(selecionadosValidos)}
                  disabled={downloadingQr !== null}
                  className={classeDoBotaoContorno}
                >
                  <QrCode aria-hidden="true" className="w-4 h-4" />
                  {downloadingQr === LOTE_DE_QR ? 'Gerando QR Codes…' : 'Baixar QR Codes'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelecionados(new Set())}
                  className="text-sm font-medium text-primary-strong hover:underline"
                >
                  Limpar seleção
                </button>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 ml-auto">
            <BotaoExpandirTodos marcado={todosAbertos} aoAlternar={alternarTodos} />
            <BotaoVerNoMapa />
            <AlternarExibicao modo={modo} aoMudar={setModo} />
          </div>
        </div>
      )}

      {/* Locais, cada um com a tabela das suas estações */}
      {(locaisDaLista.length > 0 || outrosVisiveis.length > 0) && (
        <Accordion type="multiple" value={abertos} onValueChange={aoMudarAbertos} className="space-y-[25px]">
          {locaisDaLista.map(({ loc, lista }) => (
            <AccordionItem
              key={loc.id}
              value={`location-${loc.id}`}
              className={`${classeDoCartao} overflow-hidden border-b-0`}
            >
              <div className="flex items-center gap-3 px-6 py-4">
                <div className="flex-1 min-w-0">
                  <AccordionTrigger className={classeDoGatilho}>
                    <span className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-2 min-w-0">
                      <span className="flex items-center gap-3 min-w-0" title={loc.endereco || undefined}>
                        <span className="text-primary-strong shrink-0">
                          <Icone nome="local" tamanho={28} />
                        </span>
                        <span className="text-[24px] leading-tight font-semibold text-foreground truncate">
                          {loc.nomeDoLocal}
                        </span>
                        {loc.endereco && <span className="sr-only">, {loc.endereco}</span>}
                      </span>
                      <span className="shrink-0 h-8 px-3 rounded-[25px] border border-foreground/50 dark:border-border text-[13px] font-medium text-foreground inline-flex items-center">
                        {unidades(lista.length)}
                      </span>
                      <span className="flex flex-wrap items-center gap-2 lg:ml-auto">
                        <ResumoDoLocal contagem={contarGrupos(lista.map(estadoDe))} />
                      </span>
                    </span>
                  </AccordionTrigger>
                </div>
                <MenuDoLocal
                  id={loc.id}
                  nome={loc.nomeDoLocal}
                  aoExcluir={isAdmin ? () => pedirExclusaoDoLocal(loc, lista.length) : undefined}
                />
              </div>
              <AccordionContent className="pb-0">{corpoDoLocal(lista)}</AccordionContent>
            </AccordionItem>
          ))}

          {/* Carregadores de locais não listados ou modificados */}
          {outrosVisiveis.length > 0 && (
            <AccordionItem value="location-unknown" className={`${classeDoCartao} overflow-hidden border-b-0`}>
              <div className="px-6 py-4">
                <AccordionTrigger className={classeDoGatilho}>
                  <span className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-2 min-w-0">
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="text-muted-foreground shrink-0">
                        <HelpCircle aria-hidden="true" className="w-7 h-7" />
                      </span>
                      <span className="text-[24px] leading-tight font-semibold text-foreground">Outros locais</span>
                    </span>
                    <span className="shrink-0 h-8 px-3 rounded-[25px] border border-foreground/50 dark:border-border text-[13px] font-medium text-foreground inline-flex items-center">
                      {unidades(outrosCarregadores.length)}
                    </span>
                    <span className="text-sm font-normal text-muted-foreground">
                      Estações associadas a locais não listados ou modificados
                    </span>
                    <span className="flex flex-wrap items-center gap-2 lg:ml-auto">
                      <ResumoDoLocal contagem={contarGrupos(outrosCarregadores.map(estadoDe))} />
                    </span>
                  </span>
                </AccordionTrigger>
              </div>
              <AccordionContent className="pb-0">{corpoDoLocal(outrosCarregadores)}</AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      )}

      {/* Os filtros não deixaram nenhuma estação */}
      {nadaNosFiltros && (
        <div className={`${classeDoCartao} flex flex-col items-center text-center gap-3 py-14 px-6`}>
          <BlocoDeIcone tom="cinza" grande>
            <SearchX aria-hidden="true" className="w-6 h-6" />
          </BlocoDeIcone>
          <p className="text-[20px] font-semibold text-foreground">
            {grupoDoFiltro === 'offline' && !termo && localDoFiltro === TODOS && tipoDoFiltro === TODOS
              ? 'Nenhuma estação offline agora'
              : 'Nenhuma estação encontrada'}
          </p>
          <p className="text-[15px] text-muted-foreground max-w-md">
            {grupoDoFiltro
              ? `Nenhuma estação em “${rotuloDoGrupo(grupoDoFiltro)}” com esses filtros.`
              : 'Nada com esses filtros. Tente outro nome, ID ou localização.'}
          </p>
          <button type="button" onClick={limparFiltros} className={`${classeDoBotaoContorno} mt-2`}>
            <X aria-hidden="true" className="w-4 h-4" />
            Limpar filtros
          </button>
        </div>
      )}

      {/* Nenhuma estação cadastrada */}
      {!naoCarregou && totalDeEstacoes === 0 && (
        <div className={`${classeDoCartao} flex flex-col items-center text-center py-16 px-8`}>
          <BlocoDeIcone tom="marca" grande>
            <Plug aria-hidden="true" className="w-6 h-6" />
          </BlocoDeIcone>
          <p className="text-[20px] font-semibold text-foreground mt-5">Nenhuma estação registrada</p>
          <p className="text-[15px] text-muted-foreground mt-2 max-w-sm">Registre o primeiro carregador OCPP da rede; depois configure no equipamento o link do servidor, logo abaixo.</p>
          <button
            type="button"
            onClick={() => setRegisterOpen(true)}
            className={`${classeDoBotaoPrincipal} mt-6`}
          >
            <CirclePlus aria-hidden="true" className="w-5 h-5" />
            Adicionar primeiro carregador
          </button>
        </div>
      )}

      {/* Fora do Frame 10, no fim da página: os carregadores que ainda não têm
          local e a instalação (link do servidor e cadastro de estação). */}
      {pendentesVisiveis.length > 0 && (
        <section className={`${classeDoCartao} overflow-hidden`}>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="pending-chargers" className="border-b-0">
              <AccordionTrigger className="px-6 py-5 items-center gap-4 rounded-none hover:no-underline hover:bg-muted/40 [&>svg]:size-5 [&>svg]:text-foreground">
                <span className="flex items-center gap-4 text-left min-w-0">
                  <BlocoDeIcone tom="amarelo" grande>
                    <AlertTriangle aria-hidden="true" className="w-6 h-6" />
                  </BlocoDeIcone>
                  <span className="min-w-0">
                    <span className="block text-[20px] leading-tight font-semibold text-foreground">Carregadores pendentes de configuração</span>
                    <span className="block text-sm font-normal text-foreground mt-1">
                      {pendentesVisiveis.length === 1
                        ? '1 carregador sem local atribuído.'
                        : `${pendentesVisiveis.length} carregadores sem local atribuído.`}{' '}
                      Abra para preencher os dados e escolher o local.
                    </span>
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-0">
                <div className="overflow-x-auto border-t border-border">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className={classeDoCabecalhoDaTabela}>
                        <th className="pl-6 pr-3 py-3 font-semibold">Carregador</th>
                        <th className="px-3 py-3 font-semibold">Modelo</th>
                        <th className="px-3 py-3 font-semibold">Fabricante</th>
                        <th className="px-3 py-3 font-semibold">Potência</th>
                        <th className="px-3 py-3 font-semibold">Tipo</th>
                        {ehAdminPlataforma && <th className="px-3 py-3 font-semibold">Operador</th>}
                        <th className="px-3 py-3 font-semibold">Atribuir local</th>
                        <th className="pl-3 pr-6 py-3 font-semibold">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {pendentesVisiveis.map(c => {
                        const ed = editOf(c);
                        return (
                        <tr key={c.charge_point_id} className="hover:bg-muted/30 transition-colors align-top">
                          <td className="pl-6 pr-3 py-4">
                            <p className="text-[13px] font-mono font-medium text-foreground mb-2">{c.charge_point_id}</p>
                            <Input value={ed.description} onChange={e => setEdit(c, { description: e.target.value })} placeholder="Descrição" aria-label={`Descrição de ${c.charge_point_id}`} className={`${classeDoCampo} w-[170px]`} />
                            <div className="mt-2"><EstadoDoCarregadorNaTabela estado={estadoDe(c)} /></div>
                          </td>
                          <td className="px-3 py-4 pt-[38px]">
                            <Input value={ed.model} onChange={e => setEdit(c, { model: e.target.value })} placeholder="Modelo" aria-label="Modelo" className={`${classeDoCampo} w-[130px]`} />
                          </td>
                          <td className="px-3 py-4 pt-[38px]">
                            <Input value={ed.vendor} onChange={e => setEdit(c, { vendor: e.target.value })} placeholder="Fabricante" aria-label="Fabricante" className={`${classeDoCampo} w-[130px]`} />
                          </td>
                          <td className="px-3 py-4 pt-[38px]">
                            <Input type="number" value={ed.power_kw} onChange={e => setEdit(c, { power_kw: e.target.value })} placeholder="kW" aria-label="Potência em kW" className={`${classeDoCampo} w-[90px]`} />
                          </td>
                          <td className="px-3 py-4 pt-[38px]">
                            <Select value={ed.connector_type} onValueChange={v => setEdit(c, { connector_type: v })}>
                              <SelectTrigger aria-label="Tipo de conector" className={`w-[120px] ${classeDoCampo}`}><SelectValue placeholder="Tipo" /></SelectTrigger>
                              <SelectContent className="bg-popover border-border">
                                {['Type1', 'Type2', 'CCS1', 'CCS2', 'CHAdeMO', 'GBT'].map(t => (
                                  <SelectItem key={t} value={t}>{t === 'GBT' ? 'GB/T' : t.replace('Type', 'Type ')}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          {ehAdminPlataforma && (
                            <td className="px-3 py-4 pt-[38px]">
                              <Select
                                value={selectedOwners[c.charge_point_id] || SEM_OPERADOR}
                                onValueChange={v => setSelectedOwners(p => ({ ...p, [c.charge_point_id]: v }))}
                              >
                                <SelectTrigger aria-label="Operador dono" className={`w-[170px] ${classeDoCampo}`}>
                                  <SelectValue placeholder="Plataforma" />
                                </SelectTrigger>
                                <SelectContent className="bg-popover border-border">
                                  <SelectItem value={SEM_OPERADOR}>Plataforma</SelectItem>
                                  {operadores.map(o => (
                                    <SelectItem key={o.clientId} value={o.clientId}>
                                      {o.companyName || o.clientId}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {/* O equipamento precisa apontar para a URL do dono. */}
                              <p className="text-xs text-muted-foreground mt-1.5 font-mono truncate w-[170px]">
                                {selectedOwners[c.charge_point_id] && selectedOwners[c.charge_point_id] !== SEM_OPERADOR
                                  ? `/ocpp/${selectedOwners[c.charge_point_id]}/${c.charge_point_id}`
                                  : `/ocpp/${c.charge_point_id}`}
                              </p>
                            </td>
                          )}
                          <td className="px-3 py-4 pt-[38px]">
                            {locations.length === 0 ? (
                              <span className="inline-flex items-start gap-1.5 text-[13px] font-medium text-estado-problema-forte max-w-[220px]">
                                <Info aria-hidden="true" className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>Nenhum local cadastrado — crie um em <Link to="/locais" className="font-semibold underline">Locais</Link> primeiro</span>
                              </span>
                            ) : (
                              <Select value={selectedLocations[c.charge_point_id] || ''} onValueChange={v => setSelectedLocations(p => ({ ...p, [c.charge_point_id]: v }))}>
                                <SelectTrigger aria-label="Local" className={`w-[210px] ${classeDoCampo}`}>
                                  <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent className="bg-popover border-border">
                                  {locations.map(l => (
                                    <SelectItem key={l.id} value={l.id.toString()}>{l.nomeDoLocal}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </td>
                          <td className="pl-3 pr-6 py-4 pt-[38px]">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => handleSavePending(c)}
                                disabled={savingPending === c.charge_point_id}
                                className="h-10 px-5 rounded-[25px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-105 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                              >
                                {savingPending === c.charge_point_id ? 'Salvando…' : 'Salvar'}
                              </button>
                              {/* Exclusão separada do "Salvar", em vermelho e com confirmação. */}
                              {isAdmin && (
                                <span className="pl-3 border-l border-border">
                                  <button
                                    type="button"
                                    onClick={() => pedirExclusaoDoCarregador(c)}
                                    className="h-10 w-10 rounded-[25px] border border-red-600/50 dark:border-red-400/50 text-red-600 dark:text-red-400 hover:bg-red-600/10 transition inline-flex items-center justify-center"
                                    title="Excluir carregador"
                                    aria-label={`Excluir carregador ${c.charge_point_id}`}
                                  >
                                    <Trash2 aria-hidden="true" className="w-4 h-4" />
                                  </button>
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>
      )}

      {/* Link de conexão do servidor (white label) e cadastro de estação — para o instalador */}
      <section
        className={`${classeDoCartao} p-[22px] flex flex-col 3xl:flex-row 3xl:items-center gap-4 justify-between`}
        aria-label="Instalação de estações"
      >
        <div className="flex items-start gap-4 min-w-0">
          <BlocoDeIcone tom="marca">
            <Network aria-hidden="true" className="w-5 h-5" />
          </BlocoDeIcone>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">Link do servidor para instalar nos eletropostos</h2>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-2xl">
              Configure esta URL no equipamento OCPP e acrescente o <b className="text-foreground">ID do carregador</b> ao final — ou copie o link completo de cada estação no “…” da tabela. Só carregadores cadastrados conseguem conectar.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0 w-full 3xl:w-auto">
          {serverBase ? (
            <>
              <code
                title={`${serverBase}<ID>`}
                className="flex-1 3xl:flex-none 3xl:max-w-[480px] min-w-0 truncate h-10 leading-10 rounded-[10px] bg-muted px-4 text-[13px] font-mono text-foreground"
              >
                {`${serverBase}<ID>`}
              </code>
              <button
                type="button"
                className={`${classeDoBotaoContorno} shrink-0`}
                onClick={() => copyLink(serverBase)}
                title="Copiar base do link"
              >
                <Copy aria-hidden="true" className="w-4 h-4" />
                Copiar
              </button>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">Cadastre um carregador para ver o link.</span>
          )}
          <button
            type="button"
            onClick={() => setRegisterOpen(true)}
            className={`${classeDoBotaoPrincipal} h-10 shrink-0`}
          >
            <CirclePlus aria-hidden="true" className="w-5 h-5" />
            Nova estação
          </button>
        </div>
      </section>

      {/* Charger Details Dialog */}
      <ChargerDetailsDialog
        chargePointId={selectedCharger}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        editarAoAbrir={editarAoAbrir}
        // Silenciosa: com a tela de carregamento, o diálogo era desmontado ao salvar.
        onUpdate={() => void fetchData(true)}
        onOpenLogs={(id, nome) => { setDetailsOpen(false); setLogsCharger({ id, nome }); setLogsOpen(true); }}
      />
      <ChargerLogsSheet
        chargePointId={logsCharger?.id ?? null}
        nome={logsCharger?.nome}
        open={logsOpen}
        onOpenChange={setLogsOpen}
      />

      <ConfirmarExclusao pedido={pedidoDeExclusao} aoFechar={() => setPedidoDeExclusao(null)} />

      {/* Register Charger Dialog */}
      <Dialog open={registerOpen} onOpenChange={o => { setRegisterOpen(o); if (!o) setConnectionUrl(null); }}>
        <DialogContent className="bg-card text-card-foreground border-0 rounded-[15px] shadow-cartao sm:max-w-lg p-7">
          <DialogHeader>
            <DialogTitle className="text-[20px] font-semibold text-foreground flex items-center gap-3">
              <BlocoDeIcone tom="marca">
                <Plug aria-hidden="true" className="w-5 h-5" />
              </BlocoDeIcone>
              Registrar novo carregador
            </DialogTitle>
          </DialogHeader>
          {connectionUrl ? (
            <div className="space-y-4 mt-2">
              <div className="rounded-[10px] bg-primary-soft p-4">
                <p className="text-foreground font-semibold text-[15px] flex items-center gap-2">
                  <CheckCircle2 aria-hidden="true" className="w-5 h-5 text-primary-strong" />
                  Carregador registrado
                </p>
                <p className="text-foreground text-sm mt-1 leading-relaxed">
                  Configure esta URL no equipamento. Só carregadores pré-cadastrados
                  conseguem conectar por ela — se o ID não bater, o servidor recusa.
                </p>
              </div>
              <div className="flex gap-2">
                <Input readOnly value={connectionUrl} onFocus={e => e.currentTarget.select()} aria-label="URL de conexão"
                  className={`${classeDoCampo} font-mono text-[13px]`} />
                <button type="button" className={`${classeDoBotaoContorno} shrink-0`}
                  onClick={() => { navigator.clipboard.writeText(connectionUrl).then(() => toast.success('URL copiada')).catch(() => toast.error('Não foi possível copiar')); }}>
                  <Copy aria-hidden="true" className="w-4 h-4" />
                  Copiar
                </button>
              </div>
              <div className="flex justify-end pt-2">
                <button type="button" onClick={() => { setRegisterOpen(false); setConnectionUrl(null); }}
                  className={classeDoBotaoPrincipal}>
                  Concluir
                </button>
              </div>
            </div>
          ) : (
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="reg-id" className="text-sm font-medium text-foreground">ID do carregador *</Label>
              <Input id="reg-id" placeholder="Ex: CP001, CHARGER-A1" value={regForm.charge_point_id} onChange={e => setRegForm(f => ({ ...f, charge_point_id: e.target.value }))} className={classeDoCampo} />
              <p className="text-xs text-muted-foreground">Este ID será usado no QR Code e deve corresponder ao ID OCPP</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-descricao" className="text-sm font-medium text-foreground">Descrição</Label>
              <Input id="reg-descricao" placeholder="Ex: Carregador Estacionamento A" value={regForm.description} onChange={e => setRegForm(f => ({ ...f, description: e.target.value }))} className={classeDoCampo} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reg-modelo" className="text-sm font-medium text-foreground">Modelo</Label>
                <Input id="reg-modelo" placeholder="Ex: Wallbox Plus" value={regForm.model} onChange={e => setRegForm(f => ({ ...f, model: e.target.value }))} className={classeDoCampo} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-fabricante" className="text-sm font-medium text-foreground">Fabricante</Label>
                <Input id="reg-fabricante" placeholder="Ex: ABB" value={regForm.vendor} onChange={e => setRegForm(f => ({ ...f, vendor: e.target.value }))} className={classeDoCampo} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reg-potencia" className="text-sm font-medium text-foreground">Potência (kW)</Label>
                <Input id="reg-potencia" type="number" placeholder="22" value={regForm.power_kw} onChange={e => setRegForm(f => ({ ...f, power_kw: e.target.value }))} className={classeDoCampo} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-conectores" className="text-sm font-medium text-foreground">Conectores</Label>
                <Input id="reg-conectores" type="number" min="1" value={regForm.num_connectors} onChange={e => setRegForm(f => ({ ...f, num_connectors: e.target.value }))} className={classeDoCampo} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Tipo de conector</Label>
                <Select value={regForm.connector_type} onValueChange={v => setRegForm(f => ({ ...f, connector_type: v }))}>
                  <SelectTrigger aria-label="Tipo de conector" className={`w-full ${classeDoCampo}`}><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {['Type1', 'Type2', 'CCS1', 'CCS2', 'CHAdeMO', 'GBT'].map(t => (
                      <SelectItem key={t} value={t}>{t === 'GBT' ? 'GB/T' : t.replace('Type', 'Type ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Local (opcional)</Label>
              <Select value={regForm.locationId} onValueChange={v => setRegForm(f => ({ ...f, locationId: v }))}>
                <SelectTrigger aria-label="Local" className={`w-full ${classeDoCampo}`}><SelectValue placeholder="Selecione um local" /></SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {locations.map(l => (
                    <SelectItem key={l.id} value={l.id.toString()}>{l.nomeDoLocal}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={() => setRegisterOpen(false)} className={classeDoBotaoContorno}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRegisterCharger}
                disabled={registering || !regForm.charge_point_id.trim()}
                className={`${classeDoBotaoPrincipal} h-10`}
              >
                {registering ? (
                  <span aria-hidden="true" className="w-4 h-4 animate-spin rounded-full border-b-2 border-primary-foreground" />
                ) : (
                  <CirclePlus aria-hidden="true" className="w-5 h-5" />
                )}
                Registrar
              </button>
            </div>
          </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Hidden QR Code template for PDF generation */}
      {qrPages.length > 0 && (
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
          <QrCodeTemplate pages={qrPages} />
        </div>
      )}
    </div>
  );
};
