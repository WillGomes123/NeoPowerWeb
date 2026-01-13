import React, { useState, useEffect } from 'react';
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
import { Button } from '../components/ui/button';
import { StatusBadge } from '../components/StatusBadge';
import { ChargerDetailsDialog } from '../components/ChargerDetailsDialog';
import { toast } from 'sonner';
import { Zap, CheckCircle2, Eye } from 'lucide-react';
import { api } from '../lib/api';

interface Charger {
  charge_point_id: string;
  model?: string;
  vendor?: string;
  locationId: number | null;
  isConnected: boolean;
  status?: string;
}

interface Location {
  id: number;
  nomeDoLocal: string;
  address: string;
}

export const Stations = () => {
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocations, setSelectedLocations] = useState<{ [key: string]: string }>({});
  const [selectedCharger, setSelectedCharger] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [chargersRes, locationsRes] = await Promise.all([
        api.get('/chargers'),
        api.get('/locations'),
      ]);

      if (!chargersRes.ok || !locationsRes.ok) {
        throw new Error('Erro ao buscar dados.');
      }

      const chargersData = await chargersRes.json();
      const locationsData = await locationsRes.json();

      setChargers(chargersData);
      setLocations(locationsData);

      // Inicializa o estado dos dropdowns
      const initialSelections: { [key: string]: string } = {};
      chargersData.forEach((c: Charger) => {
        if (!c.locationId && locationsData.length > 0) {
          initialSelections[c.charge_point_id] = locationsData[0].id.toString();
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

  const getLocationName = (locationId: number | null) => {
    if (!locationId) return 'Desconhecido';
    return locations.find(l => l.id === locationId)?.nomeDoLocal || 'Desconhecido';
  };

  const pendingChargers = chargers.filter(c => !c.locationId);
  const assignedChargers = chargers.filter(c => c.locationId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-emerald-400">Carregando estações...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-emerald-50 flex items-center gap-3">
          <Zap className="w-8 h-8 text-emerald-400" />
          Estações de Recarga
        </h1>
        <p className="text-emerald-300/60 mt-1">Gerenciamento de carregadores</p>
      </div>

      {/* Pending Chargers */}
      {pendingChargers.length > 0 && (
        <Card className="bg-gradient-to-br from-amber-950/40 to-emerald-900/20 border-amber-700/30 backdrop-blur-sm shadow-2xl shadow-amber-900/10">
          <CardHeader className="border-b border-amber-700/30 pb-6">
            <CardTitle className="text-amber-50 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              Carregadores Pendentes
            </CardTitle>
            <p className="text-sm text-amber-300/60">Associe estes carregadores a um local</p>
          </CardHeader>
          <CardContent className="pt-6">
            <EnhancedTable hoverable>
              <EnhancedTableHeader>
                <EnhancedTableRow hoverable={false}>
                  <EnhancedTableHead>Charge Point ID</EnhancedTableHead>
                  <EnhancedTableHead>Modelo</EnhancedTableHead>
                  <EnhancedTableHead>Fornecedor</EnhancedTableHead>
                  <EnhancedTableHead>Local</EnhancedTableHead>
                  <EnhancedTableHead>Ação</EnhancedTableHead>
                </EnhancedTableRow>
              </EnhancedTableHeader>
              <EnhancedTableBody>
                {pendingChargers.map((charger, index) => (
                  <EnhancedTableRow key={charger.charge_point_id} index={index}>
                    <EnhancedTableCell className="font-mono">
                      <span className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                        {charger.charge_point_id}
                      </span>
                    </EnhancedTableCell>
                    <EnhancedTableCell className="font-medium">
                      {charger.model || 'N/A'}
                    </EnhancedTableCell>
                    <EnhancedTableCell className="text-sm text-emerald-300/70">
                      {charger.vendor || 'N/A'}
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
                        <SelectTrigger className="w-[250px] bg-emerald-900/40 border-emerald-700/50 text-emerald-50 hover:bg-emerald-800/60">
                          <SelectValue placeholder="Selecione um local" />
                        </SelectTrigger>
                        <SelectContent className="bg-emerald-900 border-emerald-700">
                          {locations.map(location => (
                            <SelectItem
                              key={location.id}
                              value={location.id.toString()}
                              className="text-emerald-50 focus:bg-emerald-800 focus:text-emerald-50"
                            >
                              {location.nomeDoLocal} ({location.address})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </EnhancedTableCell>
                    <EnhancedTableCell>
                      <Button
                        size="sm"
                        onClick={() => handleAssignCharger(charger.charge_point_id)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 transition-all"
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
      <Card className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-emerald-800/30 backdrop-blur-sm shadow-2xl shadow-emerald-900/20">
        <CardHeader className="border-b border-emerald-800/30 pb-6">
          <CardTitle className="text-emerald-50 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            Carregadores Atribuídos
          </CardTitle>
          <p className="text-sm text-emerald-300/60">Carregadores já associados a locais</p>
        </CardHeader>
        <CardContent className="pt-6">
          {assignedChargers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Zap className="w-16 h-16 text-emerald-500/30 mb-4" />
              <p className="text-xl text-emerald-300 font-semibold">Nenhuma estação atribuída</p>
              <p className="text-base text-emerald-400/60 mt-2">
                {pendingChargers.length > 0
                  ? 'Atribua os carregadores pendentes acima a um local'
                  : 'Conecte um carregador OCPP para começar'}
              </p>
            </div>
          ) : (
          <EnhancedTable striped hoverable>
            <EnhancedTableHeader>
              <EnhancedTableRow hoverable={false}>
                <EnhancedTableHead>Charge Point ID</EnhancedTableHead>
                <EnhancedTableHead>Modelo</EnhancedTableHead>
                <EnhancedTableHead>Fornecedor</EnhancedTableHead>
                <EnhancedTableHead>Local</EnhancedTableHead>
                <EnhancedTableHead>Status</EnhancedTableHead>
                <EnhancedTableHead>Ações</EnhancedTableHead>
              </EnhancedTableRow>
            </EnhancedTableHeader>
            <EnhancedTableBody>
              {assignedChargers.map((charger, index) => (
                <EnhancedTableRow key={charger.charge_point_id} index={index}>
                  <EnhancedTableCell className="font-mono">
                    <span className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                      {charger.charge_point_id}
                    </span>
                  </EnhancedTableCell>
                  <EnhancedTableCell className="font-medium">
                    {charger.model || 'N/A'}
                  </EnhancedTableCell>
                  <EnhancedTableCell className="text-sm text-emerald-300/70">
                    {charger.vendor || 'N/A'}
                  </EnhancedTableCell>
                  <EnhancedTableCell>
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-900/40 text-emerald-300 border border-emerald-700/30 text-sm">
                      {getLocationName(charger.locationId)}
                    </span>
                  </EnhancedTableCell>
                  <EnhancedTableCell>
                    <StatusBadge status={charger.isConnected ? 'online' : 'offline'} />
                  </EnhancedTableCell>
                  <EnhancedTableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedCharger(charger.charge_point_id);
                        setDetailsOpen(true);
                      }}
                      className="border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/40"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Detalhes
                    </Button>
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
    </div>
  );
};
