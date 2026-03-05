import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Zap, RefreshCw, Power, MapPin, Info, Activity, Clock, Save, Pencil } from 'lucide-react';

interface ChargerDetails {
  charge_point_id: string;
  model?: string;
  vendor?: string;
  serial_number?: string;
  firmware_version?: string;
  description?: string;
  connector_type?: string;
  power_kw?: number;
  locationId: number | null;
  isConnected: boolean;
  status?: string;
  last_heartbeat?: string;
  connectors?: Connector[];
}

interface Connector {
  id: number;
  status: string;
  error_code?: string;
}

interface ChargerDetailsDialogProps {
  chargePointId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

export const ChargerDetailsDialog = ({
  chargePointId,
  open,
  onOpenChange,
  onUpdate,
}: ChargerDetailsDialogProps) => {
  const [charger, setCharger] = useState<ChargerDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [changingAvailability, setChangingAvailability] = useState(false);
  const [resetType, setResetType] = useState<'Soft' | 'Hard'>('Soft');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editConnectorType, setEditConnectorType] = useState('');
  const [editPowerKw, setEditPowerKw] = useState('');

  useEffect(() => {
    if (open && chargePointId) {
      void fetchChargerDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, chargePointId]);

  const fetchChargerDetails = async () => {
    if (!chargePointId) return;

    setLoading(true);
    try {
      const response = await api.get(`/chargers/${chargePointId}/details`);
      if (response.ok) {
        const data = await response.json();
        setCharger(data);
        setEditName(data.description || '');
        setEditConnectorType(data.connector_type || '');
        setEditPowerKw(data.power_kw ? String(data.power_kw) : '');
        setEditing(false);
      } else {
        toast.error('Erro ao carregar detalhes do carregador');
      }
    } catch {
      toast.error('Erro ao carregar detalhes do carregador');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveInfo = async () => {
    if (!chargePointId) return;

    setSaving(true);
    try {
      const response = await api.put(`/chargers/${chargePointId}/info`, {
        description: editName || null,
        connector_type: editConnectorType || null,
        power_kw: editPowerKw ? Number(editPowerKw) : null,
      });

      if (response.ok) {
        toast.success('Informações atualizadas!');
        setEditing(false);
        void fetchChargerDetails();
        onUpdate?.();
      } else {
        toast.error('Erro ao salvar informações');
      }
    } catch {
      toast.error('Erro ao salvar informações');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!chargePointId) return;

    setResetting(true);
    try {
      const response = await api.post(`/chargers/${chargePointId}/reset`, {
        type: resetType,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'Accepted') {
          toast.success(`Reset ${resetType} aceito pelo carregador`);
        } else {
          toast.warning(`Reset ${resetType} rejeitado pelo carregador`);
        }
        onUpdate?.();
      } else {
        const errData = await response.json();
        toast.error(errData.error || 'Erro ao enviar comando de reset');
      }
    } catch {
      toast.error('Erro ao enviar comando de reset');
    } finally {
      setResetting(false);
    }
  };

  const handleChangeAvailability = async (available: boolean) => {
    if (!chargePointId) return;

    setChangingAvailability(true);
    try {
      const response = await api.post(`/chargers/${chargePointId}/availability`, {
        type: available ? 'Operative' : 'Inoperative',
        connectorId: 0, // 0 = all connectors
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'Accepted') {
          toast.success(`Carregador ${available ? 'ativado' : 'desativado'} com sucesso`);
          void fetchChargerDetails();
          onUpdate?.();
        } else {
          toast.warning('Comando de disponibilidade rejeitado');
        }
      } else {
        const errData = await response.json();
        toast.error(errData.error || 'Erro ao alterar disponibilidade');
      }
    } catch {
      toast.error('Erro ao alterar disponibilidade');
    } finally {
      setChangingAvailability(false);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'available':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'charging':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'preparing':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'faulted':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'unavailable':
        return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
      default:
        return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-white flex items-center gap-2">
            <Zap className="h-5 w-5 text-emerald-500" />
            Detalhes do Carregador
          </DialogTitle>
          <DialogDescription className="text-zinc-400">{chargePointId}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        ) : charger ? (
          <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
            {/* Status Overview */}
            <Card className="bg-zinc-800/50 border-zinc-700 shrink-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Status
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge
                    className={`${charger.isConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}
                  >
                    {charger.isConnected ? 'Conectado' : 'Desconectado'}
                  </Badge>
                  {charger.status && (
                    <Badge className={getStatusColor(charger.status)}>{charger.status}</Badge>
                  )}
                </div>
                <div className="text-sm text-zinc-400 flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Último heartbeat: {formatDate(charger.last_heartbeat)}
                </div>
              </CardContent>
            </Card>

            {/* Charger Name & Connector Type (editable) */}
            <Card className="bg-zinc-800/50 border-zinc-700 shrink-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-zinc-400 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Pencil className="h-4 w-4" />
                    Identificação
                  </span>
                  {!editing && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing(true)}
                      className="text-zinc-400 hover:text-white h-7 px-2"
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {editing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Nome do carregador</label>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Ex: Carregador 1, Estação A..."
                        className="bg-zinc-900 border-zinc-700 text-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-zinc-500 mb-1 block">Tipo de conector</label>
                        <Select value={editConnectorType} onValueChange={setEditConnectorType}>
                          <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white">
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-900 border-zinc-700">
                            {['CCS2', 'CCS1', 'CHAdeMO', 'Tipo 2', 'Tipo 1', 'GBT'].map((t) => (
                              <SelectItem key={t} value={t} className="text-white">{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500 mb-1 block">Potência (kW)</label>
                        <Input
                          type="number"
                          value={editPowerKw}
                          onChange={(e) => setEditPowerKw(e.target.value)}
                          placeholder="Ex: 50"
                          className="bg-zinc-900 border-zinc-700 text-white"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={handleSaveInfo}
                        disabled={saving}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Save className="h-3 w-3 mr-1" />
                        {saving ? 'Salvando...' : 'Salvar'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(false);
                          setEditName(charger.description || '');
                          setEditConnectorType(charger.connector_type || '');
                          setEditPowerKw(charger.power_kw ? String(charger.power_kw) : '');
                        }}
                        className="text-zinc-400"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-zinc-500">Nome</p>
                      <p className="text-white">{charger.description || <span className="text-zinc-500 italic">Sem nome</span>}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Tipo de conector</p>
                      <p className="text-white">{charger.connector_type || <span className="text-zinc-500 italic">Não definido</span>}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Potência (kW)</p>
                      <p className="text-white">{charger.power_kw ? `${charger.power_kw} kW` : <span className="text-zinc-500 italic">Não definida</span>}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Device Info */}
            <Card className="bg-zinc-800/50 border-zinc-700 shrink-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Informações do Dispositivo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-zinc-500">Modelo</p>
                    <p className="text-white">{charger.model || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Fornecedor</p>
                    <p className="text-white">{charger.vendor || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Número de Série</p>
                    <p className="text-white font-mono text-sm">{charger.serial_number || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Firmware</p>
                    <p className="text-white font-mono text-sm">
                      {charger.firmware_version || 'N/A'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Connectors */}
            {charger.connectors && charger.connectors.length > 0 && (
              <Card className="bg-zinc-800/50 border-zinc-700 shrink-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Conectores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {charger.connectors.map(connector => (
                      <div
                        key={connector.id}
                        className="flex items-center justify-between p-2 bg-zinc-900/50 rounded-lg"
                      >
                        <span className="text-zinc-300">Conector {connector.id}</span>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(connector.status)}>
                            {connector.status}
                          </Badge>
                          {connector.error_code && connector.error_code !== 'NoError' && (
                            <Badge className="bg-red-500/20 text-red-400">
                              {connector.error_code}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <Card className="bg-zinc-800/50 border-zinc-700 shrink-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
                  <Power className="h-4 w-4" />
                  Ações
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Reset */}
                <div className="flex items-center gap-3">
                  <Select
                    value={resetType}
                    onValueChange={(value: 'Soft' | 'Hard') => setResetType(value)}
                  >
                    <SelectTrigger className="w-32 bg-zinc-900 border-zinc-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      <SelectItem value="Soft" className="text-white">
                        Soft Reset
                      </SelectItem>
                      <SelectItem value="Hard" className="text-white">
                        Hard Reset
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleReset}
                    disabled={resetting || !charger.isConnected}
                    variant="outline"
                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${resetting ? 'animate-spin' : ''}`} />
                    {resetting ? 'Resetando...' : 'Resetar'}
                  </Button>
                </div>

                {/* Availability */}
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => handleChangeAvailability(true)}
                    disabled={changingAvailability || !charger.isConnected}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    Ativar
                  </Button>
                  <Button
                    onClick={() => handleChangeAvailability(false)}
                    disabled={changingAvailability || !charger.isConnected}
                    variant="outline"
                    className="border-red-700 text-red-400 hover:bg-red-900/20"
                  >
                    Desativar
                  </Button>
                  {!charger.isConnected && (
                    <span className="text-xs text-zinc-500">Carregador desconectado</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-12 text-zinc-400 flex-1">Carregador não encontrado</div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ChargerDetailsDialog;
