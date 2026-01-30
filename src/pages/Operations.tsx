import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
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
import { Badge } from '../components/ui/badge';
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
  Server,
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
  WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';

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

// ============================================================================
// Operations Definition
// ============================================================================

const operations: Operation[] = [
  // Basic Operations
  { id: 'reset', name: 'Reset', icon: <RotateCcw className="w-4 h-4" />, description: 'Reiniciar carregador (Soft/Hard)', category: 'basic' },
  { id: 'clearCache', name: 'Clear Cache', icon: <Trash2 className="w-4 h-4" />, description: 'Limpar cache de autorização', category: 'basic' },
  { id: 'changeAvailability', name: 'Change Availability', icon: <Wifi className="w-4 h-4" />, description: 'Alterar disponibilidade do conector', category: 'basic' },
  { id: 'unlockConnector', name: 'Unlock Connector', icon: <Unlock className="w-4 h-4" />, description: 'Destravar conector', category: 'basic' },

  // Configuration
  { id: 'getConfiguration', name: 'Get Configuration', icon: <Settings className="w-4 h-4" />, description: 'Obter configuração do carregador', category: 'configuration' },
  { id: 'changeConfiguration', name: 'Change Configuration', icon: <Settings className="w-4 h-4" />, description: 'Alterar configuração do carregador', category: 'configuration' },
  { id: 'triggerMessage', name: 'Trigger Message', icon: <Send className="w-4 h-4" />, description: 'Disparar mensagem OCPP', category: 'configuration' },

  // Transactions
  { id: 'remoteStartTransaction', name: 'Remote Start Transaction', icon: <Play className="w-4 h-4" />, description: 'Iniciar sessão de carregamento', category: 'transactions' },
  { id: 'remoteStopTransaction', name: 'Remote Stop Transaction', icon: <Square className="w-4 h-4" />, description: 'Parar sessão de carregamento', category: 'transactions' },

  // Reservations
  { id: 'reserveNow', name: 'Reserve Now', icon: <Calendar className="w-4 h-4" />, description: 'Reservar conector', category: 'reservations' },
  { id: 'cancelReservation', name: 'Cancel Reservation', icon: <XCircle className="w-4 h-4" />, description: 'Cancelar reserva', category: 'reservations' },

  // Smart Charging
  { id: 'setChargingProfile', name: 'Set Charging Profile', icon: <Battery className="w-4 h-4" />, description: 'Definir perfil de carregamento', category: 'smartcharging' },
  { id: 'clearChargingProfile', name: 'Clear Charging Profile', icon: <Trash2 className="w-4 h-4" />, description: 'Limpar perfil de carregamento', category: 'smartcharging' },
  { id: 'getCompositeSchedule', name: 'Get Composite Schedule', icon: <Clock className="w-4 h-4" />, description: 'Obter agenda composta', category: 'smartcharging' },

  // Local Auth List
  { id: 'getLocalListVersion', name: 'Get Local List Version', icon: <Database className="w-4 h-4" />, description: 'Obter versão da lista local', category: 'locallist' },
  { id: 'sendLocalList', name: 'Send Local List', icon: <List className="w-4 h-4" />, description: 'Enviar lista de autorização local', category: 'locallist' },

  // Firmware & Diagnostics
  { id: 'updateFirmware', name: 'Update Firmware', icon: <Upload className="w-4 h-4" />, description: 'Atualizar firmware', category: 'firmware' },
  { id: 'getDiagnostics', name: 'Get Diagnostics', icon: <FileText className="w-4 h-4" />, description: 'Obter diagnósticos', category: 'firmware' },
  { id: 'dataTransfer', name: 'Data Transfer', icon: <Download className="w-4 h-4" />, description: 'Transferência de dados proprietários', category: 'firmware' },

  // Security Extensions (OCPP 1.6J)
  { id: 'extendedTriggerMessage', name: 'Extended Trigger Message', icon: <MessageSquare className="w-4 h-4" />, description: 'Trigger estendido (Security)', category: 'security' },
  { id: 'getLog', name: 'Get Log', icon: <FileText className="w-4 h-4" />, description: 'Obter logs do carregador', category: 'security' },
  { id: 'signedUpdateFirmware', name: 'Signed Update Firmware', icon: <Shield className="w-4 h-4" />, description: 'Atualizar firmware assinado', category: 'security' },
  { id: 'installCertificate', name: 'Install Certificate', icon: <Key className="w-4 h-4" />, description: 'Instalar certificado', category: 'security' },
  { id: 'deleteCertificate', name: 'Delete Certificate', icon: <Trash2 className="w-4 h-4" />, description: 'Deletar certificado', category: 'security' },
  { id: 'getInstalledCertificateIds', name: 'Get Installed Certificates', icon: <List className="w-4 h-4" />, description: 'Listar certificados instalados', category: 'security' },
];

const categoryConfig: Record<OperationCategory, { label: string; color: string; bgColor: string; borderColor: string }> = {
  basic: { label: 'Comandos Básicos', color: 'text-emerald-400', bgColor: 'from-emerald-950/40 to-emerald-900/20', borderColor: 'border-emerald-800/30' },
  configuration: { label: 'Configuração', color: 'text-blue-400', bgColor: 'from-blue-950/40 to-blue-900/20', borderColor: 'border-blue-800/30' },
  transactions: { label: 'Transações', color: 'text-green-400', bgColor: 'from-green-950/40 to-green-900/20', borderColor: 'border-green-800/30' },
  reservations: { label: 'Reservas', color: 'text-orange-400', bgColor: 'from-orange-950/40 to-orange-900/20', borderColor: 'border-orange-800/30' },
  smartcharging: { label: 'Smart Charging', color: 'text-amber-400', bgColor: 'from-amber-950/40 to-amber-900/20', borderColor: 'border-amber-800/30' },
  locallist: { label: 'Local Auth List', color: 'text-cyan-400', bgColor: 'from-cyan-950/40 to-cyan-900/20', borderColor: 'border-cyan-800/30' },
  firmware: { label: 'Firmware & Diagnósticos', color: 'text-violet-400', bgColor: 'from-violet-950/40 to-violet-900/20', borderColor: 'border-violet-800/30' },
  security: { label: 'Security Extensions', color: 'text-purple-400', bgColor: 'from-purple-950/40 to-purple-900/20', borderColor: 'border-purple-800/30' },
};

// ============================================================================
// Main Component
// ============================================================================

export const Operations = () => {
  const [chargePoints, setChargePoints] = useState<ChargePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChargePoints, setSelectedChargePoints] = useState<string[]>([]);
  const [selectedOperation, setSelectedOperation] = useState<string | null>(null);
  const [showCommandDialog, setShowCommandDialog] = useState(false);
  const [commandParams, setCommandParams] = useState<Record<string, string>>({});
  const [executing, setExecuting] = useState(false);
  const [results, setResults] = useState<OperationResult[]>([]);
  const [activeTab, setActiveTab] = useState('operations');

  // Fetch charge points
  const fetchChargePoints = useCallback(async () => {
    try {
      const response = await api.get('/chargers');
      if (!response.ok) throw new Error('Failed to fetch chargers');
      const data = await response.json();
      setChargePoints(data);
    } catch (err) {
      console.error('Error fetching charge points:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchChargePoints();
    const interval = setInterval(() => void fetchChargePoints(), 10000);
    return () => clearInterval(interval);
  }, [fetchChargePoints]);

  // Selection handlers
  const toggleChargePointSelection = (cpId: string) => {
    setSelectedChargePoints(prev =>
      prev.includes(cpId)
        ? prev.filter(id => id !== cpId)
        : [...prev, cpId]
    );
  };

  const selectAllConnected = () => {
    const connected = chargePoints.filter(cp => cp.isConnected).map(cp => cp.charge_point_id);
    setSelectedChargePoints(connected);
  };

  const clearSelection = () => {
    setSelectedChargePoints([]);
  };

  // Add result to log
  const addResult = (result: Omit<OperationResult, 'id' | 'timestamp'>) => {
    setResults(prev => [{
      ...result,
      id: Date.now().toString(),
      timestamp: new Date(),
    }, ...prev].slice(0, 50));
  };

  // Execute command (supports GET and POST)
  const executeCommand = async (
    cpId: string,
    endpoint: string,
    body: Record<string, unknown>,
    commandName: string,
    method: 'GET' | 'POST' | 'DELETE' = 'POST'
  ) => {
    addResult({ chargePointId: cpId, command: commandName, status: 'pending' });

    try {
      let response: Response;
      const url = `/chargers/${encodeURIComponent(cpId)}/${endpoint}`;

      if (method === 'GET') {
        response = await api.get(url);
      } else if (method === 'DELETE') {
        response = await api.delete(url, body);
      } else {
        response = await api.post(url, body);
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(errData.details || errData.error || 'Erro desconhecido');
      }
      const result = await response.json();
      addResult({ chargePointId: cpId, command: commandName, status: 'success', response: result, message: 'Executado com sucesso' });
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      addResult({ chargePointId: cpId, command: commandName, status: 'error', message: errorMessage });
      throw err;
    }
  };

  // Handle execute button
  const handleExecute = () => {
    if (!selectedOperation || selectedChargePoints.length === 0) {
      toast.error('Selecione um comando e pelo menos um carregador');
      return;
    }
    setCommandParams({});
    setShowCommandDialog(true);
  };

  // Handle command confirmation
  const handleCommandConfirm = async () => {
    if (!selectedOperation) return;
    setExecuting(true);

    const operation = operations.find(op => op.id === selectedOperation);
    const commandName = operation?.name || selectedOperation;

    let successCount = 0;
    let errorCount = 0;

    for (const cpId of selectedChargePoints) {
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
            await executeCommand(cpId, 'config', {}, commandName, 'GET');
            break;
          case 'changeConfiguration':
            await executeCommand(cpId, 'config', { key: params.key, value: params.value }, commandName);
            break;
          case 'triggerMessage':
            await executeCommand(cpId, 'trigger', {
              message: params.message,
              connectorId: params.connectorId ? parseInt(params.connectorId) : undefined
            }, commandName);
            break;
          case 'remoteStartTransaction':
            await executeCommand(cpId, 'start', {
              idTag: params.idTag,
              connectorId: params.connectorId ? parseInt(params.connectorId) : undefined
            }, commandName);
            break;
          case 'remoteStopTransaction':
            await executeCommand(cpId, 'stop', { transactionId: parseInt(params.transactionId) }, commandName);
            break;
          case 'reserveNow':
            await executeCommand(cpId, 'reserve', {
              connectorId: parseInt(params.connectorId) || 0,
              idTag: params.idTag,
              reservationId: parseInt(params.reservationId),
              expiryDate: params.expiryDate
            }, commandName);
            break;
          case 'cancelReservation':
            await executeCommand(cpId, 'cancel-reservation', { reservationId: parseInt(params.reservationId) }, commandName);
            break;
          case 'setChargingProfile':
            await executeCommand(cpId, 'charging-profile', {
              connectorId: parseInt(params.connectorId) || 0,
              csChargingProfiles: JSON.parse(params.chargingProfile || '{}')
            }, commandName);
            break;
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
              retrieveDate: params.retrieveDate || new Date().toISOString()
            }, commandName);
            break;
          case 'getDiagnostics':
            await executeCommand(cpId, 'diagnostics', { location: params.location }, commandName);
            break;
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
              remoteLocation: params.remoteLocation
            }, commandName);
            break;
          case 'signedUpdateFirmware':
            await executeCommand(cpId, 'signed-update-firmware', {
              requestId: parseInt(params.requestId) || 1,
              location: params.location,
              retrieveDateTime: params.retrieveDateTime,
              signingCertificate: params.signingCertificate,
              signature: params.signature
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
            await executeCommand(cpId, 'certificates', {}, commandName, 'GET');
            break;
          default:
            throw new Error('Comando não implementado');
        }
        successCount++;
      } catch {
        errorCount++;
      }
    }

    setExecuting(false);
    setShowCommandDialog(false);
    setSelectedOperation(null);
    setCommandParams({});

    if (successCount > 0 && errorCount === 0) {
      toast.success(`Comando executado em ${successCount} carregador(es)`);
    } else if (errorCount > 0 && successCount > 0) {
      toast.warning(`${successCount} sucesso(s), ${errorCount} erro(s)`);
    } else if (errorCount > 0) {
      toast.error(`Falha em ${errorCount} carregador(es)`);
    }
  };

  // Get operations by category
  const getOperationsByCategory = (category: OperationCategory) =>
    operations.filter(op => op.category === category);

  const connectedCount = chargePoints.filter(cp => cp.isConnected).length;
  const offlineCount = chargePoints.filter(cp => !cp.isConnected).length;

  // ============================================================================
  // Render Command Form
  // ============================================================================

  const renderCommandForm = () => {
    const inputClass = "bg-zinc-900/50 border-zinc-700 text-zinc-100 placeholder:text-zinc-500";

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
              <Label>ID Tag (RFID) *</Label>
              <Input className={inputClass} placeholder="Ex: TAG001" value={commandParams.idTag || ''} onChange={e => setCommandParams({ ...commandParams, idTag: e.target.value })} />
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
            <Label>Transaction ID *</Label>
            <Input className={inputClass} type="number" placeholder="Ex: 123" value={commandParams.transactionId || ''} onChange={e => setCommandParams({ ...commandParams, transactionId: e.target.value })} />
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
              <Label>Connector ID</Label>
              <Input className={inputClass} type="number" placeholder="0" value={commandParams.connectorId || ''} onChange={e => setCommandParams({ ...commandParams, connectorId: e.target.value })} />
              <p className="text-xs text-zinc-500">0 = ChargePoint como um todo</p>
            </div>
            <div className="space-y-2">
              <Label>Charging Profile (JSON)</Label>
              <textarea
                className={`${inputClass} w-full h-32 p-2 rounded-md border font-mono text-sm`}
                placeholder='{"chargingProfileId": 1, "stackLevel": 0, ...}'
                value={commandParams.chargingProfile || ''}
                onChange={e => setCommandParams({ ...commandParams, chargingProfile: e.target.value })}
              />
            </div>
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
              <Select value={commandParams.purpose || ''} onValueChange={v => setCommandParams({ ...commandParams, purpose: v })}>
                <SelectTrigger className={inputClass}><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
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

      case 'getDiagnostics':
        return (
          <div className="space-y-2">
            <Label>Upload Location (URL) *</Label>
            <Input className={inputClass} placeholder="ftp://server/upload" value={commandParams.location || ''} onChange={e => setCommandParams({ ...commandParams, location: e.target.value })} />
          </div>
        );

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

      case 'clearCache':
      case 'getConfiguration':
      case 'getLocalListVersion':
      case 'getInstalledCertificateIds':
        return (
          <p className="text-zinc-400 text-sm py-4">
            Este comando não requer parâmetros adicionais.
          </p>
        );

      default:
        return (
          <p className="text-zinc-400 text-sm py-4">
            Selecione um comando para ver os parâmetros.
          </p>
        );
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
        <p className="text-emerald-300/60">Carregando carregadores...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-emerald-50 flex items-center gap-3">
            <Server className="w-8 h-8 text-emerald-400" />
            Centro de Operações OCPP
          </h1>
          <p className="text-emerald-300/60 mt-1">
            Execute comandos OCPP nos carregadores conectados
          </p>
        </div>
        <Button onClick={() => void fetchChargePoints()} variant="outline" className="border-emerald-700 text-emerald-300 hover:bg-emerald-900/50">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-500/20 rounded-xl">
              <Server className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-emerald-300/60">Total</p>
              <p className="text-2xl font-bold text-emerald-400">{chargePoints.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-500/20 rounded-xl">
              <Wifi className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-emerald-300/60">Online</p>
              <p className="text-2xl font-bold text-emerald-400">{connectedCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-zinc-900/80 to-zinc-800/50 border-zinc-700/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-zinc-700/50 rounded-xl">
              <WifiOff className="w-6 h-6 text-zinc-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Offline</p>
              <p className="text-2xl font-bold text-zinc-300">{offlineCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-950/40 to-blue-900/20 border-blue-800/30">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <CheckCircle2 className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-blue-300/60">Selecionados</p>
              <p className="text-2xl font-bold text-blue-400">{selectedChargePoints.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-emerald-950/50 border border-emerald-800/30">
          <TabsTrigger value="operations" className="data-[state=active]:bg-emerald-600">
            <Zap className="w-4 h-4 mr-2" />
            Operações
          </TabsTrigger>
          <TabsTrigger value="results" className="data-[state=active]:bg-emerald-600">
            <Activity className="w-4 h-4 mr-2" />
            Resultados
            {results.length > 0 && (
              <Badge variant="secondary" className="ml-2 bg-emerald-500/20 text-emerald-300">{results.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab: Operations */}
        <TabsContent value="operations" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Charge Point Selection */}
            <Card className="bg-gradient-to-br from-zinc-900/80 to-zinc-800/50 border-zinc-700/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-zinc-100 text-lg">Carregadores</CardTitle>
                <CardDescription className="text-zinc-400">
                  {selectedChargePoints.length} de {chargePoints.length} selecionados
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={selectAllConnected} className="flex-1 border-emerald-700 text-emerald-300 hover:bg-emerald-900/50 text-xs">
                    Online ({connectedCount})
                  </Button>
                  <Button size="sm" variant="outline" onClick={clearSelection} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs">
                    Limpar
                  </Button>
                </div>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2 pr-4">
                    {chargePoints.map(cp => (
                      <button
                        key={cp.charge_point_id}
                        onClick={() => toggleChargePointSelection(cp.charge_point_id)}
                        className={`w-full p-3 rounded-lg border text-left transition-all ${
                          selectedChargePoints.includes(cp.charge_point_id)
                            ? 'bg-emerald-500/20 border-emerald-500'
                            : 'bg-zinc-800/50 border-zinc-700/50 hover:border-zinc-600'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <span className={`w-2.5 h-2.5 rounded-full block ${cp.isConnected ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                            {cp.isConnected && (
                              <span className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping opacity-75" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-zinc-100 truncate text-sm">{cp.charge_point_id}</p>
                            <p className="text-xs text-zinc-400 truncate">{cp.vendor || 'N/A'} {cp.model || ''}</p>
                          </div>
                          {selectedChargePoints.includes(cp.charge_point_id) && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Operations Panel */}
            <div className="lg:col-span-3 space-y-4">
              {/* Operations by Category */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(Object.entries(categoryConfig) as [OperationCategory, typeof categoryConfig[OperationCategory]][]).map(([category, config]) => {
                  const categoryOps = getOperationsByCategory(category);
                  if (categoryOps.length === 0) return null;

                  return (
                    <Card key={category} className={`bg-gradient-to-br ${config.bgColor} ${config.borderColor}`}>
                      <CardHeader className="pb-2">
                        <CardTitle className={`text-sm font-medium ${config.color}`}>
                          {config.label}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-2">
                        {categoryOps.map(op => (
                          <button
                            key={op.id}
                            onClick={() => setSelectedOperation(op.id)}
                            disabled={selectedChargePoints.length === 0}
                            className={`p-2 rounded-lg border text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                              selectedOperation === op.id
                                ? 'bg-white/10 border-white/30'
                                : 'bg-black/20 border-white/10 hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={config.color}>{op.icon}</span>
                              <span className="text-xs font-medium text-zinc-100 truncate">{op.name}</span>
                            </div>
                          </button>
                        ))}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Execute Button */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-950/50 to-transparent rounded-xl border border-emerald-800/30">
                <div className="flex items-center gap-4 flex-wrap">
                  {selectedOperation && (
                    <Badge variant="outline" className="border-emerald-500 text-emerald-300 bg-emerald-500/10">
                      {operations.find(op => op.id === selectedOperation)?.name}
                    </Badge>
                  )}
                  {selectedChargePoints.length > 0 && (
                    <span className="text-sm text-emerald-300/60">
                      {selectedChargePoints.length} carregador(es)
                    </span>
                  )}
                  {!selectedOperation && selectedChargePoints.length === 0 && (
                    <span className="text-sm text-zinc-400">
                      Selecione carregadores e um comando
                    </span>
                  )}
                </div>
                <Button
                  size="lg"
                  onClick={handleExecute}
                  disabled={!selectedOperation || selectedChargePoints.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Executar
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab: Results */}
        <TabsContent value="results">
          <Card className="bg-gradient-to-br from-zinc-900/80 to-zinc-800/50 border-zinc-700/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-zinc-100">Histórico de Comandos</CardTitle>
                <CardDescription className="text-zinc-400">Últimos {results.length} comandos executados</CardDescription>
              </div>
              {results.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setResults([])} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                  Limpar
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {results.length === 0 ? (
                <div className="text-center py-12 text-zinc-400">
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
                            ? 'bg-emerald-500/10 border-emerald-500/30'
                            : result.status === 'error'
                            ? 'bg-red-500/10 border-red-500/30'
                            : 'bg-amber-500/10 border-amber-500/30'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {result.status === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                          ) : result.status === 'error' ? (
                            <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                          ) : (
                            <RefreshCw className="w-4 h-4 text-amber-400 animate-spin mt-0.5 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-zinc-100">{result.command}</p>
                              <span className="text-xs text-zinc-500">
                                {result.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400">{result.chargePointId}</p>
                            {result.message && (
                              <p className={`text-xs mt-1 ${result.status === 'error' ? 'text-red-400' : 'text-zinc-500'}`}>
                                {result.message}
                              </p>
                            )}
                            {result.response && (
                              <pre className="mt-2 text-xs text-zinc-500 bg-black/20 p-2 rounded overflow-x-auto">
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
      </Tabs>

      {/* Command Dialog */}
      <Dialog open={showCommandDialog} onOpenChange={setShowCommandDialog}>
        <DialogContent className="sm:max-w-[500px] bg-zinc-900 border-zinc-700">
          <DialogHeader>
            <DialogTitle className="text-zinc-100 flex items-center gap-2">
              {operations.find(op => op.id === selectedOperation)?.icon}
              {operations.find(op => op.id === selectedOperation)?.name}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Executar em <span className="text-emerald-400 font-medium">{selectedChargePoints.length} carregador(es)</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {renderCommandForm()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCommandDialog(false)} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              Cancelar
            </Button>
            <Button onClick={() => void handleCommandConfirm()} disabled={executing} className="bg-emerald-600 hover:bg-emerald-500">
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
