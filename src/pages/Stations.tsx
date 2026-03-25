import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  EnhancedTable,
  EnhancedTableHeader,
  EnhancedTableBody,
  EnhancedTableRow,
  EnhancedTableHead,
  EnhancedTableCell,
} from '../components/EnhancedTable';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { StatusBadge } from '../components/StatusBadge';
import { ChargerDetailsDialog } from '../components/ChargerDetailsDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import { Zap, CheckCircle2, Eye, Plus, QrCode, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { useSocket } from '../lib/hooks/useSocket';

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
  status?: string;
}

interface Location {
  id: number;
  nomeDoLocal: string;
  endereco: string;
}

export const Stations = () => {
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocations, setSelectedLocations] = useState<{ [key: string]: string }>({});
  const [selectedCharger, setSelectedCharger] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [downloadingQr, setDownloadingQr] = useState<string | null>(null);
  const { chargerStatuses } = useSocket();

  // Register form state
  const [regForm, setRegForm] = useState({
    charge_point_id: '',
    description: '',
    model: '',
    vendor: '',
    connector_type: '',
    power_kw: '',
    num_connectors: '1',
    locationId: '',
  });

  const mergedChargers = useMemo(() => {
    if (chargerStatuses.size === 0) return chargers;
    return chargers.map(charger => {
      const socketStatus = chargerStatuses.get(charger.charge_point_id);
      if (!socketStatus) return charger;
      return {
        ...charger,
        isConnected: socketStatus.status !== 'Offline' && socketStatus.status !== 'Unavailable',
      };
    });
  }, [chargers, chargerStatuses]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [chargersRes, locationsRes] = await Promise.all([
        api.get('/chargers'),
        api.get('/locations/all'),
      ]);

      if (!chargersRes.ok || !locationsRes.ok) {
        throw new Error('Erro ao buscar dados.');
      }

      const chargersData = await chargersRes.json();
      const locationsData = await locationsRes.json();

      // Handle response envelope
      const chargersList = chargersData.data || chargersData;
      const locationsList = locationsData.data?.locations || locationsData.locations || [];

      setChargers(chargersList);
      setLocations(locationsList);

      const initialSelections: { [key: string]: string } = {};
      chargersList.forEach((c: Charger) => {
        if (!c.locationId && locationsList.length > 0) {
          initialSelections[c.charge_point_id] = locationsList[0].id.toString();
        }
      });
      setSelectedLocations(initialSelections);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao buscar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const handleAssignCharger = async (chargerId: string) => {
    const locationId = selectedLocations[chargerId];
    if (!locationId) {
      toast.error('Selecione um local antes de salvar');
      return;
    }

    try {
      const response = await api.put(`/chargers/${chargerId}/assign-location`, {
        locationId: parseInt(locationId),
      });

      if (!response.ok) {
        throw new Error('Falha ao atribuir o local.');
      }

      toast.success('Carregador associado com sucesso!');
      void fetchData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atribuir carregador');
    }
  };

  const handleRegisterCharger = async () => {
    if (!regForm.charge_point_id.trim()) {
      toast.error('ID do carregador é obrigatório');
      return;
    }

    setRegistering(true);
    try {
      const payload: Record<string, unknown> = {
        charge_point_id: regForm.charge_point_id.trim(),
      };
      if (regForm.description) payload.description = regForm.description;
      if (regForm.model) payload.model = regForm.model;
      if (regForm.vendor) payload.vendor = regForm.vendor;
      if (regForm.connector_type) payload.connector_type = regForm.connector_type;
      if (regForm.power_kw) payload.power_kw = parseFloat(regForm.power_kw);
      if (regForm.num_connectors) payload.num_connectors = parseInt(regForm.num_connectors);
      if (regForm.locationId) payload.locationId = parseInt(regForm.locationId);

      const response = await api.post('/chargers/register', payload);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao registrar carregador');
      }

      toast.success('Carregador registrado com sucesso!');
      setRegisterOpen(false);
      setRegForm({
        charge_point_id: '',
        description: '',
        model: '',
        vendor: '',
        connector_type: '',
        power_kw: '',
        num_connectors: '1',
        locationId: '',
      });
      void fetchData();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao registrar';
      toast.error(msg);
    } finally {
      setRegistering(false);
    }
  };

  const handleDownloadQrCode = async (chargerId: string) => {
    setDownloadingQr(chargerId);
    try {
      const response = await api.get(`/chargers/${chargerId}/qrcode`);
      if (!response.ok) {
        throw new Error('Erro ao gerar QR Code');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qrcode-${chargerId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('QR Code baixado!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao gerar QR Code');
    } finally {
      setDownloadingQr(null);
    }
  };

  const getLocationName = (locationId: number | null) => {
    if (!locationId) return 'Desconhecido';
    return locations.find(l => l.id === locationId)?.nomeDoLocal || 'Desconhecido';
  };

  const pendingChargers = mergedChargers.filter(c => !c.locationId);
  const assignedChargers = mergedChargers.filter(c => c.locationId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-400">Carregando estações...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Zap className="w-8 h-8 text-emerald-400" />
            Estações de Recarga
          </h1>
          <p className="text-zinc-400 mt-1">Gerenciamento de carregadores</p>
        </div>
        <Button
          onClick={() => setRegisterOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Registrar Carregador
        </Button>
      </div>

      {/* Pending Chargers */}
      {pendingChargers.length > 0 && (
        <Card className="bg-zinc-900/50 border-amber-700/30">
          <CardHeader className="border-b border-zinc-800 pb-6">
            <CardTitle className="text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              Carregadores Pendentes
            </CardTitle>
            <p className="text-sm text-zinc-400">Associe estes carregadores a um local</p>
          </CardHeader>
          <CardContent className="pt-6">
            <EnhancedTable hoverable>
              <EnhancedTableHeader>
                <EnhancedTableRow hoverable={false}>
                  <EnhancedTableHead>Charge Point ID</EnhancedTableHead>
                  <EnhancedTableHead>Modelo</EnhancedTableHead>
                  <EnhancedTableHead>Fornecedor</EnhancedTableHead>
                  <EnhancedTableHead>Potência</EnhancedTableHead>
                  <EnhancedTableHead>Local</EnhancedTableHead>
                  <EnhancedTableHead>Ação</EnhancedTableHead>
                </EnhancedTableRow>
              </EnhancedTableHeader>
              <EnhancedTableBody>
                {pendingChargers.map((charger, index) => (
                  <EnhancedTableRow key={charger.charge_point_id} index={index}>
                    <EnhancedTableCell className="font-mono">
                      <div className="flex flex-col gap-1">
                        <span className="text-zinc-300 font-medium">
                          {charger.description || charger.charge_point_id}
                        </span>
                        {charger.description && (
                          <span className="text-xs text-zinc-500 font-mono">
                            {charger.charge_point_id}
                          </span>
                        )}
                      </div>
                    </EnhancedTableCell>
                    <EnhancedTableCell className="font-medium">
                      {charger.model || 'N/A'}
                    </EnhancedTableCell>
                    <EnhancedTableCell className="text-sm text-zinc-400">
                      {charger.vendor || 'N/A'}
                    </EnhancedTableCell>
                    <EnhancedTableCell className="text-sm">
                      {charger.power_kw ? <span className="text-emerald-400">{charger.power_kw} kW</span> : <span className="text-zinc-500">—</span>}
                    </EnhancedTableCell>
                    <EnhancedTableCell>
                      <Select
                        value={selectedLocations[charger.charge_point_id] || ''}
                        onValueChange={value =>
                          setSelectedLocations(prev => ({
                            ...prev,
                            [charger.charge_point_id]: value,
                          }))
                        }
                      >
                        <SelectTrigger className="w-[250px] bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
                          <SelectValue placeholder="Selecione um local" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-800 border-zinc-700">
                          {locations.map(location => (
                            <SelectItem
                              key={location.id}
                              value={location.id.toString()}
                              className="text-white focus:bg-zinc-700 focus:text-white"
                            >
                              {location.nomeDoLocal} ({location.endereco})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </EnhancedTableCell>
                    <EnhancedTableCell>
                      <Button
                        size="sm"
                        onClick={() => handleAssignCharger(charger.charge_point_id)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white transition-all"
                      >
                        Salvar
                      </Button>
                    </EnhancedTableCell>
                  </EnhancedTableRow>
                ))}
              </EnhancedTableBody>
            </EnhancedTable>
          </CardContent>
        </Card>
      )}

      {/* Assigned Chargers */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="border-b border-zinc-800 pb-6">
          <CardTitle className="text-white flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            Carregadores Atribuídos
          </CardTitle>
          <p className="text-sm text-zinc-400">Carregadores já associados a locais</p>
        </CardHeader>
        <CardContent className="pt-6">
          {assignedChargers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Zap className="w-16 h-16 text-zinc-600 mb-4" />
              <p className="text-xl text-zinc-300 font-semibold">Nenhuma estação atribuída</p>
              <p className="text-base text-zinc-500 mt-2">
                {pendingChargers.length > 0
                  ? 'Atribua os carregadores pendentes acima a um local'
                  : 'Registre um carregador para começar'}
              </p>
            </div>
          ) : (
            <EnhancedTable striped hoverable>
              <EnhancedTableHeader>
                <EnhancedTableRow hoverable={false}>
                  <EnhancedTableHead>Charge Point ID</EnhancedTableHead>
                  <EnhancedTableHead>Modelo</EnhancedTableHead>
                  <EnhancedTableHead>Fornecedor</EnhancedTableHead>
                  <EnhancedTableHead>Potência</EnhancedTableHead>
                  <EnhancedTableHead>Local</EnhancedTableHead>
                  <EnhancedTableHead>Status</EnhancedTableHead>
                  <EnhancedTableHead>Ações</EnhancedTableHead>
                </EnhancedTableRow>
              </EnhancedTableHeader>
              <EnhancedTableBody>
                {assignedChargers.map((charger, index) => (
                  <EnhancedTableRow key={charger.charge_point_id} index={index}>
                    <EnhancedTableCell className="font-mono">
                      <div className="flex flex-col gap-1">
                        <span className="text-zinc-300 font-medium">
                          {charger.description || charger.charge_point_id}
                        </span>
                        {charger.description && (
                          <span className="text-xs text-zinc-500 font-mono">
                            {charger.charge_point_id}
                          </span>
                        )}
                      </div>
                    </EnhancedTableCell>
                    <EnhancedTableCell className="font-medium">
                      {charger.model || 'N/A'}
                    </EnhancedTableCell>
                    <EnhancedTableCell className="text-sm text-zinc-400">
                      {charger.vendor || 'N/A'}
                    </EnhancedTableCell>
                    <EnhancedTableCell className="text-sm">
                      {charger.power_kw ? <span className="text-emerald-400">{charger.power_kw} kW</span> : <span className="text-zinc-500">—</span>}
                    </EnhancedTableCell>
                    <EnhancedTableCell>
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 text-sm">
                        {getLocationName(charger.locationId)}
                      </span>
                    </EnhancedTableCell>
                    <EnhancedTableCell>
                      <StatusBadge status={charger.isConnected ? 'online' : 'offline'} />
                    </EnhancedTableCell>
                    <EnhancedTableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedCharger(charger.charge_point_id);
                            setDetailsOpen(true);
                          }}
                          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Detalhes
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadQrCode(charger.charge_point_id)}
                          disabled={downloadingQr === charger.charge_point_id}
                          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                        >
                          {downloadingQr === charger.charge_point_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <QrCode className="h-4 w-4 mr-1" />
                              QR Code
                            </>
                          )}
                        </Button>
                      </div>
                    </EnhancedTableCell>
                  </EnhancedTableRow>
                ))}
              </EnhancedTableBody>
            </EnhancedTable>
          )}
        </CardContent>
      </Card>

      {/* Charger Details Dialog */}
      <ChargerDetailsDialog
        chargePointId={selectedCharger}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onUpdate={fetchData}
      />

      {/* Register Charger Dialog */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-400" />
              Registrar Novo Carregador
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-zinc-300">ID do Carregador *</Label>
              <Input
                placeholder="Ex: CP001, CHARGER-A1"
                value={regForm.charge_point_id}
                onChange={e => setRegForm(f => ({ ...f, charge_point_id: e.target.value }))}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
              <p className="text-xs text-zinc-500">
                Este ID será usado no QR Code e deve corresponder ao ID configurado no carregador OCPP
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300">Descrição</Label>
              <Input
                placeholder="Ex: Carregador Estacionamento A"
                value={regForm.description}
                onChange={e => setRegForm(f => ({ ...f, description: e.target.value }))}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-zinc-300">Modelo</Label>
                <Input
                  placeholder="Ex: Wallbox Plus"
                  value={regForm.model}
                  onChange={e => setRegForm(f => ({ ...f, model: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Fabricante</Label>
                <Input
                  placeholder="Ex: ABB, Schneider"
                  value={regForm.vendor}
                  onChange={e => setRegForm(f => ({ ...f, vendor: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-zinc-300">Potência (kW)</Label>
                <Input
                  type="number"
                  placeholder="Ex: 22"
                  value={regForm.power_kw}
                  onChange={e => setRegForm(f => ({ ...f, power_kw: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Conectores</Label>
                <Input
                  type="number"
                  min="1"
                  value={regForm.num_connectors}
                  onChange={e => setRegForm(f => ({ ...f, num_connectors: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Tipo Conector</Label>
                <Select
                  value={regForm.connector_type}
                  onValueChange={value => setRegForm(f => ({ ...f, connector_type: value }))}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="Type1" className="text-white focus:bg-zinc-700 focus:text-white">Type 1</SelectItem>
                    <SelectItem value="Type2" className="text-white focus:bg-zinc-700 focus:text-white">Type 2</SelectItem>
                    <SelectItem value="CCS1" className="text-white focus:bg-zinc-700 focus:text-white">CCS 1</SelectItem>
                    <SelectItem value="CCS2" className="text-white focus:bg-zinc-700 focus:text-white">CCS 2</SelectItem>
                    <SelectItem value="CHAdeMO" className="text-white focus:bg-zinc-700 focus:text-white">CHAdeMO</SelectItem>
                    <SelectItem value="GBT" className="text-white focus:bg-zinc-700 focus:text-white">GB/T</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300">Local (opcional)</Label>
              <Select
                value={regForm.locationId}
                onValueChange={value => setRegForm(f => ({ ...f, locationId: value }))}
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder="Selecione um local" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {locations.map(loc => (
                    <SelectItem
                      key={loc.id}
                      value={loc.id.toString()}
                      className="text-white focus:bg-zinc-700 focus:text-white"
                    >
                      {loc.nomeDoLocal} ({loc.endereco})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setRegisterOpen(false)}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleRegisterCharger}
                disabled={registering || !regForm.charge_point_id.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {registering ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Registrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
