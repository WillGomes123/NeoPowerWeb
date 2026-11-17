import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent } from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { ScrollArea } from '../components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Icone } from '../components/painel/Icone';
import {
  AbasDaPagina,
  BotaoAtualizar,
  CabecalhoDaPagina,
  CartaoContador,
  classeDaPilula,
  classeDoCartao,
} from '../components/painel/Pagina';
import iconeCarregadores from '../assets/icones/op-carregadores.svg';
import iconeOffline from '../assets/icones/op-offline.svg';
import {
  Play,
  Square,
  RotateCcw,
  Unlock,
  MessageSquare,
  Zap,
  Settings,
  Shield,
  Battery,
  FileText,
  Download,
  Upload,
  Trash2,
  Clock,
  Key,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Database,
  List,
  Calendar,
  Activity,
  Send,
  Wifi,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { ehTagDeCliente, mensagemDoInicioRemoto } from '../lib/inicioRemoto';
import { useSocket } from '../lib/hooks/useSocket';
import { useEnviosDiagnostico, type NovoEnvio } from '../lib/hooks/useEnviosDiagnostico';
import {
  ServidorDiagnosticosIndisponivel,
  arquivoDaResposta,
  criarPedidoDiagnostico,
  servidorDiagnosticosNoAr,
  type PedidoDiagnostico,
} from '../lib/diagnosticos';
import { PainelDiagnosticos } from '../components/diagnosticos/PainelDiagnosticos';

// ============================================================================
// Types
// ============================================================================

interface ChargePoint {
  charge_point_id: string;
  address?: string | null;
  isConnected: boolean;
  vendor?: string;
  model?: string;
  serialNumber?: string;
  firmwareVersion?: string;
  lastHeartbeat?: string;
  protocol?: string;
  locationId?: number | null;
  description?: string;
  power_kw?: number | string | null;
}

// Limite de potência: o operador digita kW e o carregador recebe corrente por
// fase (A). Em W o MOBY CVBE (Vip Energy, 12/09) aplicou 2 A: o conector foi para
// SuspendedEVSE e a recarga encerrava sozinha. Em A o mesmo firmware aplica certo.
const TENSAO_FASE_V = 220;
const CORRENTE_MINIMA_A = 6; // abaixo disso nenhum carro carrega

/** Carregador de até 7,4 kW é monofásico; acima, ou sem potência cadastrada, trifásico. */
function kwParaAmperes(kw: number, potenciaCarregadorKw?: number | string | null) {
  const potencia = Number(potenciaCarregadorKw);
  const fases = Number.isFinite(potencia) && potencia > 0 && potencia <= 7.4 ? 1 : 3;
  // Para baixo: o limite nunca passa da potência pedida.
  const amperes = Math.floor((kw * 1000) / (TENSAO_FASE_V * fases));
  return { amperes, fases };
}

const formatarKw = (kw: number) => kw.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/** Valor do item "Nenhum" no propósito do ClearChargingProfile (o Select não aceita ""). */
const PROPOSITO_NENHUM = 'nenhum';
const minimoKw = (fases: number) => formatarKw(Math.ceil((CORRENTE_MINIMA_A * TENSAO_FASE_V * fases) / 100) / 10);

interface Location {
  id: number;
  nomeDoLocal: string;
  endereco: string;
}

interface OperationResult {
  id: string;
  chargePointId: string;
  command: string;
  status: 'success' | 'error' | 'pending';
  message?: string;
  response?: unknown;
  timestamp: Date;
}

type OperationCategory = 'basic' | 'configuration' | 'transactions' | 'reservations' | 'smartcharging' | 'locallist' | 'firmware' | 'security';

interface Operation {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  category: OperationCategory;
}

// Convert datetime-local value (YYYY-MM-DDTHH:mm) to ISO 8601 (YYYY-MM-DDTHH:mm:ss.000Z)
const toISO = (datetimeLocal: string | undefined): string | undefined => {
  if (!datetimeLocal) return undefined;
  try {
    return new Date(datetimeLocal).toISOString();
  } catch {
    return datetimeLocal;
  }
};

// ============================================================================
// Operations Definition
// ============================================================================

const operations: Operation[] = [
  // Básico
  { id: 'reset', name: 'Reinicializar', icon: <RotateCcw className="w-4 h-4" />, description: 'Reinicia o carregador. Soft mantém sessões ativas; Hard força reinicialização completa e desconecta tudo.', category: 'basic' },
  { id: 'clearCache', name: 'Limpar Cache', icon: <Trash2 className="w-4 h-4" />, description: 'Apaga o cache local de autorizações RFID. Use quando um cartão válido está sendo rejeitado pelo carregador.', category: 'basic' },
  { id: 'changeAvailability', name: 'Alterar Disponibilidade', icon: <Wifi className="w-4 h-4" />, description: 'Marca o conector como Operativo (disponível para recarga) ou Inoperativo (fora de serviço temporariamente).', category: 'basic' },
  { id: 'unlockConnector', name: 'Destrancar Conector', icon: <Unlock className="w-4 h-4" />, description: 'Libera o travamento físico do conector. Use quando o cabo ficou preso após encerrar a recarga.', category: 'basic' },

  // Configuração
  { id: 'getConfiguration', name: 'Ler Configuração', icon: <Settings className="w-4 h-4" />, description: 'Consulta os parâmetros de configuração do carregador (ex.: intervalo de heartbeat, número de conectores, modo de autorização).', category: 'configuration' },
  { id: 'changeConfiguration', name: 'Alterar Configuração', icon: <Settings className="w-4 h-4" />, description: 'Modifica um parâmetro de configuração do carregador. Algumas mudanças exigem reinicialização para entrar em vigor.', category: 'configuration' },
  { id: 'triggerMessage', name: 'Disparar Mensagem', icon: <Send className="w-4 h-4" />, description: 'Solicita que o carregador envie imediatamente uma mensagem OCPP (ex.: StatusNotification para atualizar status, Heartbeat para verificar conexão).', category: 'configuration' },

  // Transações
  { id: 'remoteStartTransaction', name: 'Iniciar Recarga', icon: <Play className="w-4 h-4" />, description: 'Inicia remotamente uma sessão de carregamento. Requer um ID Tag (código RFID) autorizado no sistema.', category: 'transactions' },
  { id: 'remoteStopTransaction', name: 'Parar Recarga', icon: <Square className="w-4 h-4" />, description: 'Encerra uma sessão de carregamento ativa. Selecione a transação pelo ID listado para parar a sessão correta.', category: 'transactions' },

  // Reservas
  { id: 'reserveNow', name: 'Fazer Reserva', icon: <Calendar className="w-4 h-4" />, description: 'Bloqueia um conector para uso exclusivo de um ID Tag por tempo determinado. Outros usuários não conseguem iniciar recarga.', category: 'reservations' },
  { id: 'cancelReservation', name: 'Cancelar Reserva', icon: <XCircle className="w-4 h-4" />, description: 'Remove uma reserva ativa pelo ID da reserva, liberando imediatamente o conector para outros usuários.', category: 'reservations' },

  // Smart Charging
  { id: 'setChargingProfile', name: 'Limitar Potência', icon: <Battery className="w-4 h-4" />, description: 'Define o limite máximo de potência de carregamento (W). Use para controlar a velocidade de carga do veículo e gerenciar a demanda elétrica.', category: 'smartcharging' },
  { id: 'clearChargingProfile', name: 'Remover Limite', icon: <Trash2 className="w-4 h-4" />, description: 'Remove um perfil de carregamento aplicado, voltando ao comportamento padrão do carregador sem restrições de potência.', category: 'smartcharging' },
  { id: 'getCompositeSchedule', name: 'Agenda de Carga', icon: <Clock className="w-4 h-4" />, description: 'Consulta a agenda de carregamento resultante (combinação de todos os perfis ativos) para um conector e período de tempo.', category: 'smartcharging' },

  // Lista Local
  { id: 'getLocalListVersion', name: 'Versão Lista Local', icon: <Database className="w-4 h-4" />, description: 'Consulta o número de versão da lista de autorização local armazenada no carregador. Útil para verificar se a lista está atualizada.', category: 'locallist' },
  { id: 'sendLocalList', name: 'Enviar Lista Local', icon: <List className="w-4 h-4" />, description: 'Atualiza os IDs Tag autorizados diretamente no carregador. Funciona mesmo sem conexão ao servidor central (autorização offline).', category: 'locallist' },

  // Firmware & Diagnósticos
  { id: 'updateFirmware', name: 'Atualizar Firmware', icon: <Upload className="w-4 h-4" />, description: 'Solicita que o carregador baixe e instale um novo firmware a partir de uma URL. O carregador fará o download na data/hora especificada.', category: 'firmware' },
  { id: 'getDiagnostics', name: 'Obter Diagnósticos', icon: <FileText className="w-4 h-4" />, description: 'Faz o carregador enviar seus logs de diagnóstico ao servidor NeoPower (ou a um FTP/HTTP próprio). O arquivo aparece na aba Diagnósticos. Essencial para análise de problemas de hardware.', category: 'firmware' },
  { id: 'dataTransfer', name: 'Transferir Dados', icon: <Download className="w-4 h-4" />, description: 'Envia mensagens proprietárias do fabricante ao carregador (funcionalidades específicas não cobertas pelo protocolo OCPP padrão).', category: 'firmware' },

  // Segurança (OCPP 1.6J)
  { id: 'extendedTriggerMessage', name: 'Mensagem Estendida', icon: <MessageSquare className="w-4 h-4" />, description: 'Versão segura do Disparar Mensagem, com tipos adicionais como LogStatus e SignChargePointCertificate (extensão OCPP 1.6J).', category: 'security' },
  { id: 'getLog', name: 'Obter Log', icon: <FileText className="w-4 h-4" />, description: 'Solicita o envio de logs de diagnóstico ou segurança para um servidor remoto. Identifica erros internos do carregador.', category: 'security' },
  { id: 'signedUpdateFirmware', name: 'Firmware Assinado', icon: <Shield className="w-4 h-4" />, description: 'Atualiza o firmware com verificação de assinatura digital para garantir autenticidade e integridade (extensão de segurança OCPP 1.6J).', category: 'security' },
  { id: 'installCertificate', name: 'Instalar Certificado', icon: <Key className="w-4 h-4" />, description: 'Instala um certificado TLS/SSL no carregador para comunicação segura e autenticada com o servidor central.', category: 'security' },
  { id: 'deleteCertificate', name: 'Excluir Certificado', icon: <Trash2 className="w-4 h-4" />, description: 'Remove um certificado instalado no carregador, identificado pelo hash do emissor e número de série.', category: 'security' },
  { id: 'getInstalledCertificateIds', name: 'Listar Certificados', icon: <List className="w-4 h-4" />, description: 'Lista todos os certificados TLS/SSL instalados no carregador, com seus tipos e identificadores.', category: 'security' },
];

const categoryConfig: Record<OperationCategory, { label: string; color: string; bgColor: string; borderColor: string }> = {
  basic: { label: 'Comandos Básicos', color: 'text-foreground', bgColor: 'from-card to-card', borderColor: 'border-border' },
  configuration: { label: 'Configuração', color: 'text-foreground', bgColor: 'from-card to-card', borderColor: 'border-border' },
  transactions: { label: 'Transações', color: 'text-foreground', bgColor: 'from-card to-card', borderColor: 'border-border' },
  reservations: { label: 'Reservas', color: 'text-foreground', bgColor: 'from-card to-card', borderColor: 'border-border' },
  smartcharging: { label: 'Smart Charging', color: 'text-foreground', bgColor: 'from-card to-card', borderColor: 'border-border' },
  locallist: { label: 'Local Auth List', color: 'text-foreground', bgColor: 'from-card to-card', borderColor: 'border-border' },
  firmware: { label: 'Firmware & Diagnósticos', color: 'text-foreground', bgColor: 'from-card to-card', borderColor: 'border-border' },
  security: { label: 'Security Extensions', color: 'text-foreground', bgColor: 'from-card to-card', borderColor: 'border-border' },
};

// ============================================================================
// Main Component
// ============================================================================

export const Operations = () => {
  const [chargePoints, setChargePoints] = useState<ChargePoint[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [selectedChargePoints, setSelectedChargePoints] = useState<string[]>([]);
  const [selectedOperation, setSelectedOperation] = useState<string | null>(null);
  const [showCommandDialog, setShowCommandDialog] = useState(false);
  // Sem tag padrão: com 'USER001' já preenchido, o início pelo painel saía sem
  // usuário e a recarga não era cobrada (transação 177, 24,54 kWh, R$ 0,00).
  const [commandParams, setCommandParams] = useState<Record<string, string>>({});
  const [executing, setExecuting] = useState(false);
  const [results, setResults] = useState<OperationResult[]>([]);
  const [activeTab, setActiveTab] = useState('operations');
  // Categoria de comandos aberta no quadro "Escolha um comando" (Figma).
  const [categoriaAberta, setCategoriaAberta] = useState<OperationCategory>('basic');
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  // Transactions ativas dos chargers selecionados — populadas quando o admin
  // abre o command "remoteStopTransaction" pra escolher qual sessão parar.
  const [activeTransactions, setActiveTransactions] = useState<Array<{
    id: number;
    transactionId: number;
    chargerId: string;
    userId: number | null;
    idTag: string;
    startTimestamp: string;
    consumedWh: number;
    totalCost: number;
  }>>([]);
  const [loadingActiveTxs, setLoadingActiveTxs] = useState(false);

  // Obter Diagnósticos: receptor da API (um endereço de envio por carregador)
  // ou URL própria. 'fora' = API ainda sem o receptor (404) — só URL própria.
  const [servidorDiag, setServidorDiag] = useState<'verificando' | 'no_ar' | 'fora' | 'incerto'>('verificando');
  const [diagCarregadorInicial, setDiagCarregadorInicial] = useState<string | undefined>();
  const {
    envios: enviosDiag,
    adicionar: adicionarEnviosDiag,
    removerConcluidos: limparEnviosDiag,
  } = useEnviosDiagnostico();
  const destinoDiag: 'neopower' | 'propria' =
    servidorDiag === 'fora' || commandParams.destino === 'propria' ? 'propria' : 'neopower';
  const enviosAguardando = enviosDiag.filter(e => e.estado === 'aguardando').length;

  // Real-time socket connection for live charger status updates
  const { isConnected: socketConnected, chargerStatuses } = useSocket();

  // Merge REST data with real-time socket status
  const mergedChargePoints = useMemo(() => {
    if (chargerStatuses.size === 0) return chargePoints;
    return chargePoints.map(cp => {
      const socketStatus = chargerStatuses.get(cp.charge_point_id);
      if (!socketStatus) return cp;
      return {
        ...cp,
        isConnected: socketStatus.status !== 'Offline',
        lastHeartbeat: socketStatus.timestamp,
      };
    });
  }, [chargePoints, chargerStatuses]);

  // Group chargers by location
  const chargersByLocation = useMemo(() => {
    const groups: Record<string, { name: string; chargers: ChargePoint[] }> = {};

    // Initialize groups for known locations
    locations.forEach(loc => {
      groups[loc.id.toString()] = {
        name: loc.nomeDoLocal,
        chargers: []
      };
    });

    // Fallback group for chargers without a valid location
    const noLocationKey = 'unassigned';
    groups[noLocationKey] = {
      name: 'Sem Local Atribuído',
      chargers: []
    };

    mergedChargePoints.forEach(cp => {
      const locId = cp.locationId?.toString();
      if (locId && groups[locId]) {
        groups[locId].chargers.push(cp);
      } else {
        groups[noLocationKey].chargers.push(cp);
      }
    });

    // Filter out groups that have no chargers
    return Object.entries(groups).filter(([_, group]) => group.chargers.length > 0);
  }, [locations, mergedChargePoints]);

  // Fetch locations
  const fetchLocations = useCallback(async () => {
    try {
      const response = await api.get('/locations/all');
      if (response.ok) {
        const data = await response.json();
        const ll = data.locations || data.data?.locations || data || [];
        setLocations(ll);
      }
    } catch (err) {
      console.error('Error fetching locations:', err);
    }
  }, []);

  // Fetch charge points
  const fetchChargePoints = useCallback(async () => {
    try {
      const response = await api.get('/chargers');
      if (!response.ok) throw new Error('Failed to fetch chargers');
      const data = await response.json();
      const list = Array.isArray(data) ? data : (data.data || []);
      setChargePoints(list);
      setApiError(null);
      setAtualizadoEm(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setApiError(message === 'Unauthorized' ? 'Sessão expirada' : 'Sem conexão com o servidor (OCPP_API offline?)');
      console.error('Error fetching charge points:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLocations();
  }, [fetchLocations]);

  useEffect(() => {
    void fetchChargePoints();
    const interval = setInterval(() => void fetchChargePoints(), 10000);
    return () => clearInterval(interval);
  }, [fetchChargePoints]);

  // Carrega transactions ativas dos chargers selecionados quando o admin
  // abre o dialog do remoteStopTransaction. Permite escolher transactionId
  // sem digitar — fim do erro 400 "ID da transação inválido".
  const loadActiveTransactions = useCallback(async (chargerIds: string[]) => {
    if (chargerIds.length === 0) {
      setActiveTransactions([]);
      return;
    }
    setLoadingActiveTxs(true);
    try {
      const all = await Promise.all(
        chargerIds.map(async (cpId) => {
          const r = await api.get(`/transactions/active?chargerId=${encodeURIComponent(cpId)}`);
          if (!r.ok) return [];
          const data = await r.json();
          return Array.isArray(data) ? data : [];
        })
      );
      setActiveTransactions(all.flat());
    } catch (e) {
      console.error('[Operations] Failed loading active transactions:', e);
      setActiveTransactions([]);
    } finally {
      setLoadingActiveTxs(false);
    }
  }, []);

  // Quando o user abre o dialog pra remoteStopTransaction, puxa as ativas.
  useEffect(() => {
    if (showCommandDialog && selectedOperation === 'remoteStopTransaction') {
      void loadActiveTransactions(selectedChargePoints);
    }
  }, [showCommandDialog, selectedOperation, selectedChargePoints, loadActiveTransactions]);

  // Ao abrir o Obter Diagnósticos, confere se a API já tem o receptor. Consulta
  // só de leitura: não gera token de envio.
  useEffect(() => {
    if (!showCommandDialog || selectedOperation !== 'getDiagnostics') return;
    const cpId = selectedChargePoints[0];
    if (!cpId) return;
    let ativo = true;
    void servidorDiagnosticosNoAr(cpId).then(noAr => {
      if (ativo) setServidorDiag(noAr === true ? 'no_ar' : noAr === false ? 'fora' : 'incerto');
    });
    return () => {
      ativo = false;
    };
  }, [showCommandDialog, selectedOperation, selectedChargePoints]);

  // Selection handlers
  const toggleChargePointSelection = (cpId: string) => {
    setSelectedChargePoints(prev =>
      prev.includes(cpId)
        ? prev.filter(id => id !== cpId)
        : [...prev, cpId]
    );
  };

  const selectAllConnected = () => {
    const connected = mergedChargePoints.filter(cp => cp.isConnected).map(cp => cp.charge_point_id);
    setSelectedChargePoints(connected);
  };

  const clearSelection = () => {
    setSelectedChargePoints([]);
  };

  // Add result to log. Devolve o id para o executeCommand atualizar a MESMA
  // linha (pendente → sucesso/erro): antes cada comando virava duas linhas e a
  // "pendente" ficava girando para sempre.
  const addResult = (result: Omit<OperationResult, 'id' | 'timestamp'>): string => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setResults(prev => [{ ...result, id, timestamp: new Date() }, ...prev].slice(0, 50));
    return id;
  };

  const updateResult = (id: string, patch: Partial<Omit<OperationResult, 'id'>>) => {
    setResults(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  };

  // Execute command (supports GET and POST)
  // If endpoint starts with '/', it's treated as an absolute path
  const executeCommand = async (
    cpId: string,
    endpoint: string,
    body: Record<string, unknown>,
    commandName: string,
    method: 'GET' | 'POST' | 'DELETE' = 'POST'
  ) => {
    const resultId = addResult({ chargePointId: cpId, command: commandName, status: 'pending' });

    try {
      let response: Response;
      // Support absolute paths (starting with /) or relative paths (charger-specific)
      const url = endpoint.startsWith('/')
        ? endpoint
        : `/chargers/${encodeURIComponent(cpId)}/${endpoint}`;

      if (method === 'GET') {
        response = await api.get(url);
      } else if (method === 'DELETE') {
        response = await api.delete(url, body);
      } else {
        response = await api.post(url, body);
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        const friendly = errData.details || errData.error || 'Erro desconhecido';

        // 503 = charger offline / inacessível. Toast claro pro admin.
        if (response.status === 503) {
          toast.error(`${cpId} está offline. ${friendly}`, { duration: 5000 });
        } else if (response.status === 404) {
          toast.error(`${cpId}: ${friendly}`, { duration: 4000 });
        }

        throw new Error(friendly);
      }
      const result = await response.json();
      // HTTP 200 só diz que o comando chegou; a resposta OCPP pode ser recusa.
      const statusOcpp = (result?.data ?? result)?.status;
      const recusado =
        typeof statusOcpp === 'string' &&
        ['Rejected', 'NotSupported', 'NotImplemented', 'UnlockFailed', 'Failed'].includes(statusOcpp);
      updateResult(
        resultId,
        recusado
          ? { status: 'error', response: result, message: `O carregador respondeu ${statusOcpp}.` }
          : {
              status: 'success',
              response: result,
              message: mensagemDoInicioRemoto(result?.data ?? result) ?? 'Executado com sucesso',
            }
      );
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      updateResult(resultId, { status: 'error', message: errorMessage });
      throw err;
    }
  };

  // Handle execute button
  const handleExecute = () => {
    if (!selectedOperation || selectedChargePoints.length === 0) {
      toast.error('Selecione um comando e pelo menos um carregador');
      return;
    }

    // Comandos OCPP só funcionam contra carregadores conectados em tempo real.
    // Bloqueia cedo com mensagem clara em vez de deixar o backend retornar 404
    // "Carregador X não encontrado ou não conectado" pra cada um.
    const offlineSelected = selectedChargePoints.filter((cpId) => {
      const cp = mergedChargePoints.find((c) => c.charge_point_id === cpId);
      return cp && !cp.isConnected;
    });
    if (offlineSelected.length === selectedChargePoints.length) {
      toast.error(
        offlineSelected.length === 1
          ? `Carregador ${offlineSelected[0]} está offline. Aguarde reconectar pra enviar comandos.`
          : `Nenhum carregador selecionado está online. Comandos OCPP só funcionam com charger conectado.`,
        { duration: 5000 }
      );
      return;
    }
    if (offlineSelected.length > 0) {
      toast.warning(
        `${offlineSelected.length} carregador(es) offline serão pulados: ${offlineSelected.join(', ')}`,
        { duration: 4000 }
      );
    }

    setCommandParams({});
    setShowCommandDialog(true);
  };

  // Handle command confirmation
  const handleCommandConfirm = async () => {
    if (!selectedOperation) return;
    if (selectedOperation === 'getDiagnostics' && destinoDiag === 'propria' && !commandParams.location?.trim()) {
      toast.error('Informe a URL do seu servidor FTP/HTTP.');
      return;
    }
    if (selectedOperation === 'remoteStartTransaction' && !commandParams.idTag?.trim()) {
      toast.error('Informe o e-mail do cliente (ou a ID Tag).');
      return;
    }
    if (selectedOperation === 'reserveNow' && !commandParams.idTag?.trim()) {
      toast.error('Informe a ID Tag. Para cobrar um cliente, use USER_<id do cliente>.');
      return;
    }
    // Tag que não é de cliente inicia uma recarga que ninguém paga. Quem está
    // no painel precisa escolher isso, e não cair nisso por descuido.
    if (
      selectedOperation === 'remoteStartTransaction' &&
      !ehTagDeCliente(commandParams.idTag) &&
      !window.confirm(
        [
          `A tag "${commandParams.idTag?.trim()}" não é de um cliente.`,
          'A recarga NÃO será cobrada de ninguém. Para cobrar, informe o e-mail do cliente.',
          'Iniciar mesmo assim?',
        ].join('\n\n')
      )
    ) {
      return;
    }
    setExecuting(true);

    const operation = operations.find(op => op.id === selectedOperation);
    const commandName = operation?.name || selectedOperation;

    let successCount = 0;
    let errorCount = 0;
    let ultimoErro = '';
    // Obter Diagnósticos pelo servidor NeoPower: um token por carregador.
    const novosEnvios: NovoEnvio[] = [];
    let servidorDiagFora = false;

    for (const cpId of selectedChargePoints) {
      // Pula chargers offline — comandos OCPP exigem WebSocket ativo
      const cp = mergedChargePoints.find((c) => c.charge_point_id === cpId);
      if (cp && !cp.isConnected) {
        addResult({
          chargePointId: cpId,
          command: commandName,
          status: 'error',
          message: 'Carregador offline. Comando não enviado.',
        });
        errorCount++;
        continue;
      }

      try {
        const params = commandParams;

        switch (selectedOperation) {
          case 'reset':
            await executeCommand(cpId, 'reset', { type: params.type || 'Soft' }, commandName);
            break;
          case 'clearCache':
            await executeCommand(cpId, 'clear-cache', {}, commandName);
            break;
          case 'changeAvailability':
            await executeCommand(cpId, 'availability', {
              connectorId: parseInt(params.connectorId) || 0,
              type: params.type || 'Operative'
            }, commandName);
            break;
          case 'unlockConnector':
            await executeCommand(cpId, 'unlock', { connectorId: parseInt(params.connectorId) || 1 }, commandName);
            break;
          case 'getConfiguration':
            await executeCommand(cpId, 'config', { key: params.keys ? params.keys.split(',').map((k: string) => k.trim()) : undefined }, commandName);
            break;
          case 'changeConfiguration':
            await executeCommand(cpId, 'config/change', { key: params.key, value: params.value }, commandName);
            break;
          case 'triggerMessage':
            await executeCommand(cpId, 'trigger-message', {
              requestedMessage: params.message,
              connectorId: params.connectorId ? parseInt(params.connectorId) : undefined
            }, commandName);
            break;
          case 'remoteStartTransaction': {
            const tag = params.idTag?.trim();
            if (!tag) {
              addResult({ chargePointId: cpId, command: commandName, status: 'error', message: 'ID Tag obrigatório. Preencha o código RFID do usuário.' });
              errorCount++;
              continue;
            }
            await executeCommand(cpId, '/command/start', {
              chargerId: cpId,
              idTag: tag,
              connectorId: params.connectorId ? parseInt(params.connectorId) : 1
            }, commandName);
            break;
          }
          case 'remoteStopTransaction': {
            const txId = parseInt(params.transactionId);
            if (!Number.isFinite(txId) || txId <= 0) {
              addResult({ chargePointId: cpId, command: commandName, status: 'error', message: 'Transaction ID inválido. Selecione uma transação ativa.' });
              break;
            }
            await executeCommand(cpId, '/command/stop', {
              chargerId: cpId,
              transactionId: txId
            }, commandName);
            break;
          }
          case 'reserveNow':
            await executeCommand(cpId, 'reserve', {
              connectorId: parseInt(params.connectorId) || 0,
              idTag: params.idTag,
              reservationId: parseInt(params.reservationId),
              expiryDate: toISO(params.expiryDate) || new Date(Date.now() + 3600000).toISOString()
            }, commandName);
            break;
          case 'cancelReservation':
            await executeCommand(cpId, 'cancel-reservation', { reservationId: parseInt(params.reservationId) }, commandName);
            break;
          case 'setChargingProfile': {
            let csChargingProfiles: Record<string, unknown>;
            let nomeDoComando = commandName;
            if (params.powerLimitKw) {
              const kw = parseFloat(String(params.powerLimitKw).replace(',', '.'));
              const carregador = chargePoints.find(c => c.charge_point_id === cpId);
              const { amperes, fases } = kwParaAmperes(kw, carregador?.power_kw);
              if (isNaN(kw) || amperes < CORRENTE_MINIMA_A) {
                addResult({ chargePointId: cpId, command: commandName, status: 'error', message: `Potência muito baixa. O mínimo para carregar é ${minimoKw(fases)} kW neste carregador (${fases === 3 ? 'trifásico' : 'monofásico'}).` });
                errorCount++;
                continue;
              }
              nomeDoComando = `${commandName} (${formatarKw(kw)} kW → ${amperes} A/fase)`;
              csChargingProfiles = {
                chargingProfileId: 1,
                stackLevel: 0,
                chargingProfilePurpose: 'TxDefaultProfile',
                // Absolute com startSchedule: o MOBY CVBE (Vip Energy) responde ProtocolError
                // ao perfil Recurring sem startSchedule — o schema OCPP 1.6 não exige, o
                // firmware sim. Horário sem milissegundos, que alguns firmwares recusam.
                chargingProfileKind: 'Absolute',
                chargingSchedule: {
                  startSchedule: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
                  chargingRateUnit: 'A',
                  chargingSchedulePeriod: [{ startPeriod: 0, limit: amperes }],
                },
              };
            } else {
              try {
                csChargingProfiles = JSON.parse(params.chargingProfile || '{}') as Record<string, unknown>;
              } catch {
                addResult({ chargePointId: cpId, command: commandName, status: 'error', message: 'JSON do perfil de carga inválido.' });
                errorCount++;
                continue;
              }
            }
            await executeCommand(cpId, 'charging-profile', {
              connectorId: parseInt(params.connectorId) || 0,
              csChargingProfiles,
            }, nomeDoComando);
            break;
          }
          case 'clearChargingProfile':
            await executeCommand(cpId, 'clear-charging-profile', {
              id: params.profileId ? parseInt(params.profileId) : undefined,
              connectorId: params.connectorId ? parseInt(params.connectorId) : undefined,
              chargingProfilePurpose: params.purpose || undefined,
              stackLevel: params.stackLevel ? parseInt(params.stackLevel) : undefined
            }, commandName);
            break;
          case 'getCompositeSchedule':
            await executeCommand(cpId, 'composite-schedule', {
              connectorId: parseInt(params.connectorId) || 0,
              duration: parseInt(params.duration) || 86400
            }, commandName);
            break;
          case 'getLocalListVersion':
            await executeCommand(cpId, 'local-list-version', {}, commandName, 'GET');
            break;
          case 'sendLocalList':
            await executeCommand(cpId, 'local-list', {
              listVersion: parseInt(params.listVersion),
              updateType: params.updateType || 'Full',
              localAuthorizationList: JSON.parse(params.authList || '[]')
            }, commandName);
            break;
          case 'updateFirmware':
            await executeCommand(cpId, 'update-firmware', {
              location: params.location,
              retrieveDate: toISO(params.retrieveDate) || new Date().toISOString()
            }, commandName);
            break;
          case 'getDiagnostics': {
            const periodo = { startTime: toISO(params.startTime), stopTime: toISO(params.stopTime) };
            if (destinoDiag === 'propria') {
              await executeCommand(cpId, 'diagnostics', { location: params.location?.trim(), ...periodo }, commandName);
              break;
            }
            if (servidorDiagFora) {
              addResult({ chargePointId: cpId, command: commandName, status: 'error', message: 'Servidor de diagnósticos da NeoPower indisponível. Comando não enviado.' });
              errorCount++;
              continue;
            }
            // Cada carregador recebe o seu endereço de envio (o token vai na URL).
            const iniciadoEm = Date.now();
            let pedido: PedidoDiagnostico;
            try {
              pedido = await criarPedidoDiagnostico(cpId);
            } catch (err) {
              if (err instanceof ServidorDiagnosticosIndisponivel) {
                servidorDiagFora = true;
                setServidorDiag('fora');
              }
              ultimoErro = err instanceof Error ? err.message : 'Não foi possível gerar o endereço de envio.';
              addResult({ chargePointId: cpId, command: commandName, status: 'error', message: ultimoErro });
              errorCount++;
              continue;
            }
            // FTP primeiro (é o que os MOBY aceitam); se o carregador responder sem
            // fileName — não aceitou aquele endereço —, tenta o https.
            const destinos = [pedido.uploadUrlFtp, pedido.uploadUrl].filter(
              (d): d is string => typeof d === 'string' && d.length > 0
            );
            let arquivoAnunciado: string | undefined;
            for (const location of destinos) {
              const resposta = await executeCommand(
                cpId,
                'diagnostics',
                { location, ...periodo },
                commandName
              );
              arquivoAnunciado = arquivoDaResposta(resposta);
              if (arquivoAnunciado) break;
            }
            novosEnvios.push({
              token: pedido.token,
              chargerId: cpId,
              iniciadoEm,
              arquivoAnunciado,
            });
            break;
          }
          case 'dataTransfer':
            await executeCommand(cpId, 'data-transfer', {
              vendorId: params.vendorId,
              messageId: params.messageId,
              data: params.data
            }, commandName);
            break;
          case 'extendedTriggerMessage':
            await executeCommand(cpId, 'extended-trigger', {
              requestedMessage: params.requestedMessage,
              connectorId: params.connectorId ? parseInt(params.connectorId) : undefined
            }, commandName);
            break;
          case 'getLog':
            await executeCommand(cpId, 'get-log', {
              logType: params.logType || 'DiagnosticsLog',
              requestId: parseInt(params.requestId) || 1,
              log: {
                remoteLocation: params.remoteLocation,
                oldestTimestamp: params.oldestTimestamp || undefined,
                latestTimestamp: params.latestTimestamp || undefined
              }
            }, commandName);
            break;
          case 'signedUpdateFirmware':
            await executeCommand(cpId, 'signed-update-firmware', {
              requestId: parseInt(params.requestId) || 1,
              firmware: {
                location: params.location,
                retrieveDateTime: toISO(params.retrieveDateTime) || new Date().toISOString(),
                installDateTime: toISO(params.installDateTime),
                signingCertificate: params.signingCertificate || undefined,
                signature: params.signature || undefined
              }
            }, commandName);
            break;
          case 'installCertificate':
            await executeCommand(cpId, 'install-certificate', {
              certificateType: params.certificateType,
              certificate: params.certificate
            }, commandName);
            break;
          case 'deleteCertificate':
            await executeCommand(cpId, 'delete-certificate', {
              certificateHashData: {
                hashAlgorithm: params.hashAlgorithm,
                issuerNameHash: params.issuerNameHash,
                issuerKeyHash: params.issuerKeyHash,
                serialNumber: params.serialNumber
              }
            }, commandName);
            break;
          case 'getInstalledCertificateIds':
            await executeCommand(cpId, 'installed-certificates', {
              certificateType: params.certificateType || 'CentralSystemRootCertificate'
            }, commandName);
            break;
          default:
            throw new Error('Comando não implementado');
        }
        successCount++;
      } catch (err) {
        errorCount++;
        ultimoErro = err instanceof Error ? err.message : String(err);
      }
    }

    setExecuting(false);

    // API sem o receptor e nada enviado: o diálogo continua aberto, já na URL própria.
    if (servidorDiagFora && successCount === 0) {
      toast.error('O servidor de diagnósticos da NeoPower ainda não está no ar. Informe uma URL própria (FTP/HTTP).', { duration: 6000 });
      return;
    }

    setShowCommandDialog(false);
    setSelectedOperation(null);
    setCommandParams({});

    if (novosEnvios.length > 0) {
      adicionarEnviosDiag(novosEnvios);
      setDiagCarregadorInicial(novosEnvios[0].chargerId);
      setActiveTab('diagnosticos');
    }

    if (novosEnvios.length > 0 && errorCount === 0) {
      toast.success(`Pedido enviado a ${novosEnvios.length} carregador(es). Acompanhe a chegada do arquivo aqui.`);
    } else if (successCount > 0 && errorCount === 0) {
      toast.success(`Comando executado em ${successCount} carregador(es)`);
    } else if (errorCount > 0 && successCount > 0) {
      toast.warning(`${successCount} sucesso(s), ${errorCount} erro(s). Veja a aba de Resultados.`);
    } else if (errorCount > 0) {
      toast.error(`Falha em ${errorCount} carregador(es): ${ultimoErro || 'veja o motivo na aba de Resultados.'}`);
    }
  };

  // Get operations by category
  const getOperationsByCategory = (category: OperationCategory) =>
    operations.filter(op => op.category === category);

  const connectedCount = mergedChargePoints.filter(cp => cp.isConnected).length;

  // ============================================================================
  // Render Command Form
  // ============================================================================

  const renderCommandForm = () => {
    const inputClass = "bg-surface-container-low border-outline-variant text-foreground placeholder:text-muted-foreground";

    switch (selectedOperation) {
      case 'reset':
        return (
          <div className="space-y-2">
            <Label>Tipo de Reset</Label>
            <Select value={commandParams.type || 'Soft'} onValueChange={v => setCommandParams({ ...commandParams, type: v })}>
              <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Soft">Soft (Reinicialização leve)</SelectItem>
                <SelectItem value="Hard">Hard (Reinicialização completa)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );

      case 'changeAvailability':
        return (
          <>
            <div className="space-y-2">
              <Label>Connector ID</Label>
              <Input className={inputClass} type="number" placeholder="0 = todos" value={commandParams.connectorId || ''} onChange={e => setCommandParams({ ...commandParams, connectorId: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={commandParams.type || 'Operative'} onValueChange={v => setCommandParams({ ...commandParams, type: v })}>
                <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Operative">Operative (Disponível)</SelectItem>
                  <SelectItem value="Inoperative">Inoperative (Indisponível)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        );

      case 'unlockConnector':
        return (
          <div className="space-y-2">
            <Label>Connector ID</Label>
            <Input className={inputClass} type="number" placeholder="1" value={commandParams.connectorId || ''} onChange={e => setCommandParams({ ...commandParams, connectorId: e.target.value })} />
          </div>
        );

      case 'changeConfiguration':
        return (
          <>
            <div className="space-y-2">
              <Label>Configuration Key</Label>
              <Input className={inputClass} placeholder="Ex: HeartbeatInterval" value={commandParams.key || ''} onChange={e => setCommandParams({ ...commandParams, key: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <Input className={inputClass} placeholder="Ex: 300" value={commandParams.value || ''} onChange={e => setCommandParams({ ...commandParams, value: e.target.value })} />
            </div>
          </>
        );

      case 'triggerMessage':
        return (
          <>
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Select value={commandParams.message || ''} onValueChange={v => setCommandParams({ ...commandParams, message: v })}>
                <SelectTrigger className={inputClass}><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BootNotification">Boot Notification</SelectItem>
                  <SelectItem value="DiagnosticsStatusNotification">Diagnostics Status</SelectItem>
                  <SelectItem value="FirmwareStatusNotification">Firmware Status</SelectItem>
                  <SelectItem value="Heartbeat">Heartbeat</SelectItem>
                  <SelectItem value="MeterValues">Meter Values</SelectItem>
                  <SelectItem value="StatusNotification">Status Notification</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Connector ID (opcional)</Label>
              <Input className={inputClass} type="number" value={commandParams.connectorId || ''} onChange={e => setCommandParams({ ...commandParams, connectorId: e.target.value })} />
            </div>
          </>
        );

      case 'remoteStartTransaction':
        return (
          <>
            <div className="space-y-2">
              <Label>E-mail do cliente (ou ID Tag) *</Label>
              <Input className={inputClass} placeholder="cliente@email.com" value={commandParams.idTag || ''} onChange={e => setCommandParams({ ...commandParams, idTag: e.target.value })} />
              <p className="text-xs text-on-surface-variant">
                Para cobrar um cliente, informe o <span className="font-semibold">e-mail do cadastro</span> dele (também vale <span className="font-mono font-semibold">USER_&lt;id&gt;</span>). Uma tag de cartão, que não seja de cliente, inicia uma recarga que não é cobrada.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Connector ID (opcional)</Label>
              <Input className={inputClass} type="number" placeholder="1" value={commandParams.connectorId || ''} onChange={e => setCommandParams({ ...commandParams, connectorId: e.target.value })} />
            </div>
          </>
        );

      case 'remoteStopTransaction':
        return (
          <div className="space-y-2">
            <Label>Transação ativa *</Label>
            {loadingActiveTxs ? (
              <p className="text-sm text-on-surface-variant">Carregando transações ativas...</p>
            ) : activeTransactions.length === 0 ? (
              <div className="rounded-lg border border-outline-variant/20 bg-surface-container p-3">
                <p className="text-sm text-on-surface-variant">
                  Nenhuma transação ativa nos chargers selecionados.
                </p>
                <p className="text-xs text-on-surface-variant/70 mt-1">
                  Você pode digitar o ID manualmente abaixo se souber:
                </p>
                <Input
                  className={`${inputClass} mt-2`}
                  type="number"
                  placeholder="Ex: 123"
                  value={commandParams.transactionId || ''}
                  onChange={e => setCommandParams({ ...commandParams, transactionId: e.target.value })}
                />
              </div>
            ) : (
              <Select
                value={commandParams.transactionId || ''}
                onValueChange={(v) => setCommandParams({ ...commandParams, transactionId: v })}
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="Selecione qual transação parar" />
                </SelectTrigger>
                <SelectContent>
                  {activeTransactions.map((tx) => {
                    const elapsedMin = Math.floor((Date.now() - new Date(tx.startTimestamp).getTime()) / 60000);
                    return (
                      <SelectItem key={tx.transactionId} value={String(tx.transactionId)}>
                        #{tx.transactionId} • {tx.chargerId} • {(tx.consumedWh / 1000).toFixed(2)} kWh • R$ {tx.totalCost.toFixed(2)} • {elapsedMin}min
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
            {commandParams.transactionId && (
              <p className="text-xs text-on-surface-variant">
                Transaction ID selecionado: <span className="font-mono font-semibold">{commandParams.transactionId}</span>
              </p>
            )}
          </div>
        );

      case 'reserveNow':
        return (
          <>
            <div className="space-y-2">
              <Label>Connector ID</Label>
              <Input className={inputClass} type="number" placeholder="0" value={commandParams.connectorId || ''} onChange={e => setCommandParams({ ...commandParams, connectorId: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>ID Tag *</Label>
              <Input className={inputClass} placeholder="TAG001" value={commandParams.idTag || ''} onChange={e => setCommandParams({ ...commandParams, idTag: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Reservation ID *</Label>
              <Input className={inputClass} type="number" placeholder="1" value={commandParams.reservationId || ''} onChange={e => setCommandParams({ ...commandParams, reservationId: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Expiry Date</Label>
              <Input className={inputClass} type="datetime-local" value={commandParams.expiryDate || ''} onChange={e => setCommandParams({ ...commandParams, expiryDate: e.target.value })} />
            </div>
          </>
        );

      case 'cancelReservation':
        return (
          <div className="space-y-2">
            <Label>Reservation ID *</Label>
            <Input className={inputClass} type="number" placeholder="1" value={commandParams.reservationId || ''} onChange={e => setCommandParams({ ...commandParams, reservationId: e.target.value })} />
          </div>
        );

      case 'setChargingProfile':
        return (
          <>
            <div className="space-y-2">
              <Label>Conector</Label>
              <Input className={inputClass} type="number" placeholder="0" value={commandParams.connectorId || ''} onChange={e => setCommandParams({ ...commandParams, connectorId: e.target.value })} />
              <p className="text-xs text-muted-foreground">0 = carregador inteiro; 1, 2... = conector específico</p>
            </div>
            <div className="space-y-2">
              <Label>Limite de Potência (kW)</Label>
              <Input
                className={inputClass}
                type="number"
                step="0.1"
                min="0"
                placeholder="Ex: 7 | 11 | 22"
                value={commandParams.powerLimitKw || ''}
                onChange={e => setCommandParams({ ...commandParams, powerLimitKw: e.target.value, chargingProfile: '' })}
              />
              <p className="text-xs text-muted-foreground">
                {(() => {
                  const kw = parseFloat(String(commandParams.powerLimitKw || '').replace(',', '.'));
                  if (!kw) return 'Digite a potência máxima em kW. O sistema converte para a corrente que o carregador entende.';
                  const carregador = chargePoints.find(c => c.charge_point_id === selectedChargePoints[0]);
                  const { amperes, fases } = kwParaAmperes(kw, carregador?.power_kw);
                  if (amperes < CORRENTE_MINIMA_A) return `Muito baixo: o mínimo para carregar é ${minimoKw(fases)} kW.`;
                  return `Será enviado ${amperes} A por fase (${fases === 3 ? 'trifásico' : 'monofásico'}, ≈ ${formatarKw((amperes * TENSAO_FASE_V * fases) / 1000)} kW).`;
                })()}{' '}
                Deixe em branco para usar o JSON avançado abaixo.
              </p>
            </div>
            {!commandParams.powerLimitKw && (
              <div className="space-y-2">
                <Label>Perfil Avançado (JSON)</Label>
                <textarea
                  className={`${inputClass} w-full h-28 p-2 rounded-md border font-mono text-xs`}
                  placeholder='{"chargingProfileId": 1, "stackLevel": 0, "chargingProfilePurpose": "TxDefaultProfile", ...}'
                  value={commandParams.chargingProfile || ''}
                  onChange={e => setCommandParams({ ...commandParams, chargingProfile: e.target.value })}
                />
              </div>
            )}
          </>
        );

      case 'clearChargingProfile':
        return (
          <>
            <div className="space-y-2">
              <Label>Profile ID (opcional)</Label>
              <Input className={inputClass} type="number" value={commandParams.profileId || ''} onChange={e => setCommandParams({ ...commandParams, profileId: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Connector ID (opcional)</Label>
              <Input className={inputClass} type="number" value={commandParams.connectorId || ''} onChange={e => setCommandParams({ ...commandParams, connectorId: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Purpose (opcional)</Label>
              {/* O Select do Radix não aceita item com value="" (derrubava a página
                  inteira ao abrir "Limpar perfil de carga"). "Nenhum" usa um valor
                  próprio e volta a ser vazio no estado, que o envio trata como
                  "sem filtro de propósito". */}
              <Select
                value={commandParams.purpose || PROPOSITO_NENHUM}
                onValueChange={v => setCommandParams({ ...commandParams, purpose: v === PROPOSITO_NENHUM ? '' : v })}
              >
                <SelectTrigger className={inputClass}><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={PROPOSITO_NENHUM}>Nenhum</SelectItem>
                  <SelectItem value="ChargePointMaxProfile">ChargePoint Max Profile</SelectItem>
                  <SelectItem value="TxDefaultProfile">Tx Default Profile</SelectItem>
                  <SelectItem value="TxProfile">Tx Profile</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        );

      case 'getCompositeSchedule':
        return (
          <>
            <div className="space-y-2">
              <Label>Connector ID</Label>
              <Input className={inputClass} type="number" placeholder="0" value={commandParams.connectorId || ''} onChange={e => setCommandParams({ ...commandParams, connectorId: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Duration (segundos)</Label>
              <Input className={inputClass} type="number" placeholder="86400" value={commandParams.duration || ''} onChange={e => setCommandParams({ ...commandParams, duration: e.target.value })} />
            </div>
          </>
        );

      case 'sendLocalList':
        return (
          <>
            <div className="space-y-2">
              <Label>List Version</Label>
              <Input className={inputClass} type="number" placeholder="1" value={commandParams.listVersion || ''} onChange={e => setCommandParams({ ...commandParams, listVersion: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Update Type</Label>
              <Select value={commandParams.updateType || 'Full'} onValueChange={v => setCommandParams({ ...commandParams, updateType: v })}>
                <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Full">Full (Substituir lista)</SelectItem>
                  <SelectItem value="Differential">Differential (Atualizar)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Authorization List (JSON)</Label>
              <textarea
                className={`${inputClass} w-full h-24 p-2 rounded-md border font-mono text-sm`}
                placeholder='[{"idTag": "TAG1", "idTagInfo": {"status": "Accepted"}}]'
                value={commandParams.authList || ''}
                onChange={e => setCommandParams({ ...commandParams, authList: e.target.value })}
              />
            </div>
          </>
        );

      case 'updateFirmware':
        return (
          <>
            <div className="space-y-2">
              <Label>Firmware Location (URL) *</Label>
              <Input className={inputClass} placeholder="https://server/firmware.bin" value={commandParams.location || ''} onChange={e => setCommandParams({ ...commandParams, location: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Retrieve Date</Label>
              <Input className={inputClass} type="datetime-local" value={commandParams.retrieveDate || ''} onChange={e => setCommandParams({ ...commandParams, retrieveDate: e.target.value })} />
            </div>
          </>
        );

      case 'getDiagnostics': {
        const opcaoClass = (ativa: boolean) =>
          `flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
            ativa ? 'border-primary bg-primary/10' : 'border-outline-variant/30 hover:border-primary/50'
          }`;
        return (
          <>
            {servidorDiag === 'fora' ? (
              <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <p className="font-medium text-foreground">O servidor de diagnósticos da NeoPower ainda não está no ar.</p>
                  <p className="text-muted-foreground mt-0.5">Por enquanto, informe a URL de um servidor FTP/HTTP seu para receber o arquivo.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Para onde o carregador envia</Label>
                <RadioGroup
                  value={destinoDiag}
                  onValueChange={v => setCommandParams({ ...commandParams, destino: v })}
                  className="gap-2"
                >
                  <label htmlFor="diag-neopower" className={opcaoClass(destinoDiag === 'neopower')}>
                    <RadioGroupItem value="neopower" id="diag-neopower" className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">Servidor NeoPower (recomendado)</span>
                      <span className="block text-xs text-muted-foreground mt-0.5">
                        Cada carregador recebe um endereço de envio exclusivo (FTP e, se ele não aceitar, HTTPS). O arquivo aparece na aba Diagnósticos, pronto para baixar.
                      </span>
                      {servidorDiag === 'verificando' && (
                        <span className="block text-xs text-muted-foreground/70 mt-1">Verificando o servidor…</span>
                      )}
                    </span>
                  </label>
                  <label htmlFor="diag-propria" className={opcaoClass(destinoDiag === 'propria')}>
                    <RadioGroupItem value="propria" id="diag-propria" className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">URL própria (FTP/HTTP)</span>
                      <span className="block text-xs text-muted-foreground mt-0.5">
                        Para quem tem um servidor FTP ou HTTP. O arquivo fica no seu servidor.
                      </span>
                    </span>
                  </label>
                </RadioGroup>
              </div>
            )}
            {destinoDiag === 'propria' && (
              <div className="space-y-2">
                <Label>Upload Location (URL) *</Label>
                <Input className={inputClass} placeholder="ftp://server/upload" value={commandParams.location || ''} onChange={e => setCommandParams({ ...commandParams, location: e.target.value })} />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Logs a partir de (opcional)</Label>
                <Input className={inputClass} type="datetime-local" value={commandParams.startTime || ''} onChange={e => setCommandParams({ ...commandParams, startTime: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Logs até (opcional)</Label>
                <Input className={inputClass} type="datetime-local" value={commandParams.stopTime || ''} onChange={e => setCommandParams({ ...commandParams, stopTime: e.target.value })} />
              </div>
            </div>
          </>
        );
      }

      case 'dataTransfer':
        return (
          <>
            <div className="space-y-2">
              <Label>Vendor ID *</Label>
              <Input className={inputClass} placeholder="Ex: NeoPower" value={commandParams.vendorId || ''} onChange={e => setCommandParams({ ...commandParams, vendorId: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Message ID (opcional)</Label>
              <Input className={inputClass} placeholder="Ex: CustomMessage" value={commandParams.messageId || ''} onChange={e => setCommandParams({ ...commandParams, messageId: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Data (opcional)</Label>
              <Input className={inputClass} placeholder="Dados em texto" value={commandParams.data || ''} onChange={e => setCommandParams({ ...commandParams, data: e.target.value })} />
            </div>
          </>
        );

      case 'extendedTriggerMessage':
        return (
          <>
            <div className="space-y-2">
              <Label>Requested Message</Label>
              <Select value={commandParams.requestedMessage || ''} onValueChange={v => setCommandParams({ ...commandParams, requestedMessage: v })}>
                <SelectTrigger className={inputClass}><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BootNotification">Boot Notification</SelectItem>
                  <SelectItem value="LogStatusNotification">Log Status Notification</SelectItem>
                  <SelectItem value="FirmwareStatusNotification">Firmware Status Notification</SelectItem>
                  <SelectItem value="Heartbeat">Heartbeat</SelectItem>
                  <SelectItem value="MeterValues">Meter Values</SelectItem>
                  <SelectItem value="SignChargePointCertificate">Sign ChargePoint Certificate</SelectItem>
                  <SelectItem value="StatusNotification">Status Notification</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Connector ID (opcional)</Label>
              <Input className={inputClass} type="number" value={commandParams.connectorId || ''} onChange={e => setCommandParams({ ...commandParams, connectorId: e.target.value })} />
            </div>
          </>
        );

      case 'getLog':
        return (
          <>
            <div className="space-y-2">
              <Label>Log Type</Label>
              <Select value={commandParams.logType || 'DiagnosticsLog'} onValueChange={v => setCommandParams({ ...commandParams, logType: v })}>
                <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DiagnosticsLog">Diagnostics Log</SelectItem>
                  <SelectItem value="SecurityLog">Security Log</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Request ID</Label>
              <Input className={inputClass} type="number" placeholder="1" value={commandParams.requestId || ''} onChange={e => setCommandParams({ ...commandParams, requestId: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Remote Location (URL)</Label>
              <Input className={inputClass} placeholder="ftp://server/logs/" value={commandParams.remoteLocation || ''} onChange={e => setCommandParams({ ...commandParams, remoteLocation: e.target.value })} />
            </div>
          </>
        );

      case 'installCertificate':
        return (
          <>
            <div className="space-y-2">
              <Label>Certificate Type</Label>
              <Select value={commandParams.certificateType || 'CentralSystemRootCertificate'} onValueChange={v => setCommandParams({ ...commandParams, certificateType: v })}>
                <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CentralSystemRootCertificate">Central System Root Certificate</SelectItem>
                  <SelectItem value="ManufacturerRootCertificate">Manufacturer Root Certificate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Certificate (PEM)</Label>
              <textarea
                className={`${inputClass} w-full h-32 p-2 rounded-md border font-mono text-sm`}
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                value={commandParams.certificate || ''}
                onChange={e => setCommandParams({ ...commandParams, certificate: e.target.value })}
              />
            </div>
          </>
        );

      case 'deleteCertificate':
        return (
          <>
            <div className="space-y-2">
              <Label>Hash Algorithm</Label>
              <Select value={commandParams.hashAlgorithm || 'SHA256'} onValueChange={v => setCommandParams({ ...commandParams, hashAlgorithm: v })}>
                <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SHA256">SHA256</SelectItem>
                  <SelectItem value="SHA384">SHA384</SelectItem>
                  <SelectItem value="SHA512">SHA512</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Issuer Name Hash *</Label>
              <Input className={inputClass} placeholder="Hash do nome do emissor" value={commandParams.issuerNameHash || ''} onChange={e => setCommandParams({ ...commandParams, issuerNameHash: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Issuer Key Hash *</Label>
              <Input className={inputClass} placeholder="Hash da chave do emissor" value={commandParams.issuerKeyHash || ''} onChange={e => setCommandParams({ ...commandParams, issuerKeyHash: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Serial Number *</Label>
              <Input className={inputClass} placeholder="Número de série do certificado" value={commandParams.serialNumber || ''} onChange={e => setCommandParams({ ...commandParams, serialNumber: e.target.value })} />
            </div>
          </>
        );

      case 'signedUpdateFirmware':
        return (
          <>
            <div className="space-y-2">
              <Label>Request ID</Label>
              <Input className={inputClass} type="number" placeholder="1" value={commandParams.requestId || ''} onChange={e => setCommandParams({ ...commandParams, requestId: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Firmware Location (URL) *</Label>
              <Input className={inputClass} placeholder="https://server/firmware.bin" value={commandParams.location || ''} onChange={e => setCommandParams({ ...commandParams, location: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Retrieve DateTime</Label>
              <Input className={inputClass} type="datetime-local" value={commandParams.retrieveDateTime || ''} onChange={e => setCommandParams({ ...commandParams, retrieveDateTime: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Signing Certificate (PEM)</Label>
              <textarea
                className={`${inputClass} w-full h-24 p-2 rounded-md border font-mono text-sm`}
                placeholder="-----BEGIN CERTIFICATE-----"
                value={commandParams.signingCertificate || ''}
                onChange={e => setCommandParams({ ...commandParams, signingCertificate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Signature (Base64)</Label>
              <Input className={inputClass} placeholder="Assinatura em Base64" value={commandParams.signature || ''} onChange={e => setCommandParams({ ...commandParams, signature: e.target.value })} />
            </div>
          </>
        );

      case 'getInstalledCertificateIds':
        return (
          <div className="space-y-2">
            <Label>Certificate Type</Label>
            <Select value={commandParams.certificateType || 'CentralSystemRootCertificate'} onValueChange={v => setCommandParams({ ...commandParams, certificateType: v })}>
              <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CentralSystemRootCertificate">Central System Root Certificate</SelectItem>
                <SelectItem value="ManufacturerRootCertificate">Manufacturer Root Certificate</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );

      case 'getConfiguration':
        return (
          <div className="space-y-2">
            <Label>Chaves de configuração (opcional)</Label>
            <Input
              className={inputClass}
              placeholder="Ex: HeartbeatInterval, NumberOfConnectors (vazio = todas)"
              value={commandParams.keys || ''}
              onChange={e => setCommandParams({ ...commandParams, keys: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Separe múltiplas chaves por vírgula. Deixe vazio para retornar todas as configurações.</p>
          </div>
        );

      case 'clearCache':
      case 'getLocalListVersion':
        return (
          <p className="text-muted-foreground text-sm py-4">
            Este comando não requer parâmetros adicionais.
          </p>
        );

      default:
        return (
          <p className="text-muted-foreground text-sm py-4">
            Selecione um comando para ver os parâmetros.
          </p>
        );
    }
  };

  const atualizarTudo = async () => {
    setAtualizando(true);
    try {
      await Promise.all([fetchChargePoints(), fetchLocations()]);
    } finally {
      setAtualizando(false);
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
        <p className="text-muted-foreground">Carregando carregadores...</p>
      </div>
    );
  }

  // Contadores do topo (Figma): locais com carregador, carregadores, online e offline.
  const locaisComCarregador = new Set(
    mergedChargePoints.map(cp => cp.locationId).filter(id => id != null)
  ).size;
  const categorias = Object.keys(categoryConfig) as OperationCategory[];
  const operacaoEscolhida = operations.find(op => op.id === selectedOperation);

  return (
    <div className="space-y-[25px] pb-12">
      <CabecalhoDaPagina
        titulo="Centro de operações"
        subtitulo="Envie comandos OCPP aos carregadores e acompanhe o resultado."
        acoes={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-4 3xl:gap-8">
            {/* "Tempo real" do Figma: diz se a tela está recebendo o status ao vivo */}
            <span
              className={`${classeDaPilula} sm:w-[193px] inline-flex items-center justify-center`}
              title={socketConnected ? 'Status dos carregadores ao vivo' : 'Sem conexão ao vivo: use Atualizar'}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${socketConnected ? 'bg-estado-livre-forte animate-pulse' : 'bg-estado-offline-forte'}`}
                aria-hidden="true"
              />
              {socketConnected ? 'Tempo real' : 'Sem tempo real'}
            </span>
            <BotaoAtualizar
              aoAtualizar={() => void atualizarTudo()}
              carregando={atualizando}
              atualizadoEm={atualizadoEm}
              falhou={!!apiError && !!atualizadoEm}
            />
          </div>
        }
      />

      {/* Sem conexão com a API */}
      {apiError && (
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-[15px] bg-destructive/10 text-destructive">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="flex-1 text-[15px] font-medium">{apiError}</p>
          <button
            type="button"
            onClick={() => void atualizarTudo()}
            className="h-10 px-5 rounded-[25px] bg-card text-destructive text-sm font-semibold"
          >
            Reconectar
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-[25px] xl:max-w-[1100px]">
        <CartaoContador icone={<Icone nome="op-locais" tamanho={37} altura={38} />} rotulo="Locais" valor={locaisComCarregador} />
        <CartaoContador icone={<img src={iconeCarregadores} alt="" className="w-[37px] h-[38px]" />} rotulo="Carregadores" valor={mergedChargePoints.length} />
        <CartaoContador icone={<img src={iconeCarregadores} alt="" className="w-[37px] h-[38px]" />} rotulo="Online" valor={connectedCount} />
        <CartaoContador
          icone={<img src={iconeOffline} alt="" className="w-[37px] h-[38px]" />}
          rotulo="Offline"
          valor={mergedChargePoints.length - connectedCount}
          fundoDoIcone="bg-[#fedbd5] dark:bg-destructive/20"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-[25px]">
        <AbasDaPagina
          rotulo="Seções do Centro de operações"
          ativa={activeTab as 'operations' | 'results' | 'diagnosticos'}
          aoMudar={setActiveTab}
          abas={[
            { id: 'operations', rotulo: 'Comandos', icone: <Zap aria-hidden="true" className="w-5 h-5" /> },
            { id: 'results', rotulo: 'Resultados', icone: <Activity aria-hidden="true" className="w-5 h-5" />, contador: results.length },
            { id: 'diagnosticos', rotulo: 'Diagnósticos', icone: <FileText aria-hidden="true" className="w-5 h-5" />, contador: enviosAguardando },
          ]}
        />

        {/* Comandos: carregadores à esquerda, "Escolha um comando" à direita (Figma) */}
        <TabsContent value="operations">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,797fr)_minmax(0,770fr)] gap-[30px] items-start">
            <section className={`${classeDoCartao} p-[22px]`} aria-label="Carregadores">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[20px] font-semibold text-foreground">Carregadores</h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedChargePoints.length} de {mergedChargePoints.length} selecionados
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAllConnected}
                    className="h-10 px-4 rounded-[25px] bg-primary-soft text-primary-strong text-sm font-semibold"
                  >
                    Todos online ({connectedCount})
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="h-10 px-4 rounded-[25px] bg-[#d9d9d9] dark:bg-muted text-foreground text-sm font-semibold"
                  >
                    Limpar
                  </button>
                </div>
              </div>
              <ScrollArea className="h-[620px] mt-4 pr-3">
                <div className="space-y-5 pr-1 min-w-0">
                  {chargersByLocation.map(([locId, group]) => (
                    <div key={locId} className="space-y-2 min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold text-foreground min-w-0">
                        <span className="text-primary-strong shrink-0"><Icone nome="local" tamanho={18} /></span>
                        <span className="truncate">{group.name}</span>
                        <span className="text-muted-foreground font-medium shrink-0">· {group.chargers.length}</span>
                      </p>
                      {group.chargers.map(cp => {
                        const escolhido = selectedChargePoints.includes(cp.charge_point_id);
                        const tipo = `${cp.vendor || ''} ${cp.model || ''}`.trim();
                        return (
                          <button
                            key={cp.charge_point_id}
                            type="button"
                            onClick={() => toggleChargePointSelection(cp.charge_point_id)}
                            aria-pressed={escolhido}
                            className={`w-full min-h-[56px] px-4 py-2.5 rounded-[20px] border text-left transition flex items-center gap-3 min-w-0 ${
                              escolhido ? 'bg-primary-soft border-primary' : 'bg-card border-border hover:border-primary/60'
                            }`}
                          >
                            <span
                              className={`shrink-0 h-6 px-2.5 rounded-[25px] text-xs font-semibold inline-flex items-center ${
                                cp.isConnected ? 'bg-estado-livre text-estado-livre-forte' : 'bg-estado-offline text-estado-offline-forte'
                              }`}
                            >
                              {cp.isConnected ? 'Online' : 'Offline'}
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="block text-[15px] font-semibold text-foreground truncate">
                                {cp.description || tipo || cp.charge_point_id}
                              </span>
                              <span className="block text-xs text-muted-foreground truncate">
                                {cp.charge_point_id}
                                {tipo && cp.description ? ` · ${tipo}` : ''}
                              </span>
                            </span>
                            {escolhido && <CheckCircle2 className="w-5 h-5 text-primary-strong shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </section>

            <section className={`${classeDoCartao} p-[22px] space-y-4`} aria-label="Escolha um comando">
              <div>
                <h2 className="text-[20px] font-semibold text-foreground">Escolha um comando</h2>
                <p className="text-sm text-foreground">
                  {selectedChargePoints.length === 0
                    ? 'Selecione ao lado os carregadores que vão receber o comando.'
                    : `Vai para ${selectedChargePoints.length} carregador${selectedChargePoints.length === 1 ? '' : 'es'}.`}
                </p>
              </div>

              {categorias.map(categoria => {
                const ops = getOperationsByCategory(categoria);
                if (ops.length === 0) return null;
                const aberta = categoria === categoriaAberta;
                if (!aberta) {
                  // Categoria fechada: linha do Figma (ícone, nome, quantidade)
                  return (
                    <button
                      key={categoria}
                      type="button"
                      onClick={() => setCategoriaAberta(categoria)}
                      aria-expanded={false}
                      className="w-full min-h-[51px] px-[34px] rounded-[20px] border border-primary flex items-center gap-4 text-left hover:bg-primary-soft/50 transition"
                    >
                      <span className="w-[27px] h-[27px] rounded-[5px] bg-primary/60 text-primary-foreground flex items-center justify-center shrink-0">
                        {ops[0]?.icon}
                      </span>
                      <span className="flex-1 text-[13px] font-semibold text-foreground">{categoryConfig[categoria].label}</span>
                      <span className="h-[18px] min-w-[44px] px-2 rounded-[10px] bg-primary/60 text-primary-foreground text-[11px] font-bold inline-flex items-center justify-center">
                        {ops.length}
                      </span>
                    </button>
                  );
                }
                // Categoria aberta: bloco em degradê com os cartões dos comandos
                return (
                  <div
                    key={categoria}
                    className="rounded-[25px] border border-primary bg-gradient-to-r from-primary/30 to-transparent p-[22px] pt-[26px]"
                  >
                    <p className="text-[15px] font-semibold text-foreground mb-4">{categoryConfig[categoria].label}</p>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
                      {ops.map(op => {
                        const escolhido = selectedOperation === op.id;
                        return (
                          <button
                            key={op.id}
                            type="button"
                            onClick={() => setSelectedOperation(op.id)}
                            aria-pressed={escolhido}
                            title={op.description}
                            className={`min-h-[165px] p-[22px] rounded-[15px] border text-left flex flex-col gap-2 transition ${
                              escolhido ? 'bg-primary-soft border-primary ring-2 ring-primary/40' : 'bg-card border-primary hover:bg-primary-soft/40'
                            }`}
                          >
                            <span className="w-[27px] h-[27px] rounded-[5px] bg-primary-soft text-primary-strong flex items-center justify-center">
                              {op.icon}
                            </span>
                            <span className="text-[13px] font-semibold text-foreground">{op.name}</span>
                            <span className="text-[11px] leading-snug text-foreground/80 line-clamp-4">{op.description}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Executar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <p className="text-sm text-foreground">
                  {operacaoEscolhida ? (
                    <>
                      <span className="font-semibold">{operacaoEscolhida.name}</span>
                      {selectedChargePoints.length > 0 && ` · ${selectedChargePoints.length} carregador${selectedChargePoints.length === 1 ? '' : 'es'}`}
                    </>
                  ) : (
                    'Escolha um comando acima.'
                  )}
                </p>
                <button
                  type="button"
                  onClick={handleExecute}
                  disabled={!selectedOperation || selectedChargePoints.length === 0}
                  className="h-12 px-8 rounded-[25px] bg-primary text-primary-foreground text-[15px] font-semibold inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-4 h-4" aria-hidden="true" />
                  Executar
                </button>
              </div>
            </section>
          </div>
        </TabsContent>

        {/* Tab: Results */}
        <TabsContent value="results">
          <Card className={`${classeDoCartao} border-0 gap-0`}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-foreground">Histórico de Comandos</CardTitle>
                <CardDescription className="text-muted-foreground">Últimos {results.length} comandos executados</CardDescription>
              </div>
              {results.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setResults([])} className="border-border text-muted-foreground hover:bg-accent">
                  Limpar
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {results.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhum comando executado ainda</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2 pr-4">
                    {results.map(result => (
                      <div
                        key={result.id}
                        className={`p-3 rounded-lg border ${
                          result.status === 'success'
                            ? 'bg-primary/10 border-primary/30'
                            : result.status === 'error'
                            ? 'bg-red-500/10 border-red-500/30'
                            : 'bg-amber-500/10 border-amber-500/30'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {result.status === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                          ) : result.status === 'error' ? (
                            <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                          ) : (
                            <RefreshCw className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-spin mt-0.5 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-foreground">{result.command}</p>
                              <span className="text-xs text-muted-foreground">
                                {result.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{result.chargePointId}</p>
                            {result.message && (
                              <p className={`text-xs mt-1 ${result.status === 'error' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                                {result.message}
                              </p>
                            )}
                            {result.response != null && (
                              <pre className="mt-2 text-xs text-muted-foreground bg-black/20 p-2 rounded overflow-x-auto">
                                {JSON.stringify(result.response, null, 2)}
                              </pre>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Diagnósticos (envios em andamento e arquivos recebidos) */}
        <TabsContent value="diagnosticos">
          <PainelDiagnosticos
            carregadores={mergedChargePoints}
            envios={enviosDiag}
            onLimparConcluidos={limparEnviosDiag}
            carregadorInicial={diagCarregadorInicial ?? selectedChargePoints[0]}
          />
        </TabsContent>
      </Tabs>

      {/* Command Dialog */}
      <Dialog open={showCommandDialog} onOpenChange={setShowCommandDialog}>
        <DialogContent className="sm:max-w-[500px] bg-card border-border rounded-[15px]">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              {operations.find(op => op.id === selectedOperation)?.icon}
              {operations.find(op => op.id === selectedOperation)?.name}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Executar em <span className="text-primary font-medium">{selectedChargePoints.length} carregador(es)</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {renderCommandForm()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCommandDialog(false)} className="border-border text-muted-foreground hover:bg-accent">
              Cancelar
            </Button>
            <Button onClick={() => void handleCommandConfirm()} disabled={executing} className="bg-primary hover:bg-primary/80 text-on-primary">
              {executing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Executando...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Executar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Operations;
