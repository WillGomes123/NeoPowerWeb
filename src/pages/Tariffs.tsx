import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { DollarSign, Plus, History, MapPin } from 'lucide-react';

interface Tariff {
  id: number;
  price_per_kwh: number;
  location_address: string | null;
  created_at: string;
  is_current: boolean;
}

interface Location {
  id: number;
  name: string;
  address: string;
}

export const Tariffs = () => {
  const [currentTariff, setCurrentTariff] = useState<Tariff | null>(null);
  const [tariffHistory, setTariffHistory] = useState<Tariff[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('global');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tariffRes, locationsRes] = await Promise.all([
        api.get('/tariffs/current'),
        api.get('/locations'),
      ]);

      if (tariffRes.ok) {
        const tariffData = await tariffRes.json();
        setCurrentTariff(tariffData.tariff || tariffData);
        if (tariffData.history) {
          setTariffHistory(tariffData.history);
        }
      }

      if (locationsRes.ok) {
        const locationsData = await locationsRes.json();
        setLocations(Array.isArray(locationsData) ? locationsData : locationsData.locations || []);
      }
    } catch {
      toast.error('Erro ao carregar dados de tarifas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const handleSubmit = async () => {
    if (!newPrice || parseFloat(newPrice) <= 0) {
      toast.error('Informe um preço válido');
      return;
    }

    setSubmitting(true);
    try {
      const payload: { newPrice: number; locationAddress?: string } = {
        newPrice: parseFloat(newPrice),
      };

      if (selectedLocation !== 'global') {
        const location = locations.find(l => l.id.toString() === selectedLocation);
        if (location) {
          payload.locationAddress = location.address;
        }
      }

      const response = await api.post('/tariffs', payload);

      if (response.ok) {
        toast.success('Tarifa atualizada com sucesso!');
        setIsDialogOpen(false);
        setNewPrice('');
        setSelectedLocation('global');
        void fetchData();
      } else {
        const errData = await response.json();
        toast.error(errData.error || 'Erro ao atualizar tarifa');
      }
    } catch {
      toast.error('Erro ao atualizar tarifa');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Gestão de Tarifas</h1>
          <p className="text-zinc-400">Gerencie os preços por kWh</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="mr-2 h-4 w-4" />
              Nova Tarifa
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-800">
            <DialogHeader>
              <DialogTitle className="text-white">Definir Nova Tarifa</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Configure o preço por kWh para a rede ou para um local específico.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="price" className="text-zinc-300">
                  Preço por kWh (R$)
                </Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={newPrice}
                  onChange={e => setNewPrice(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location" className="text-zinc-300">
                  Aplicar para
                </Label>
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="global" className="text-white">
                      Tarifa Global (toda a rede)
                    </SelectItem>
                    {locations.map(location => (
                      <SelectItem
                        key={location.id}
                        value={location.id.toString()}
                        className="text-white"
                      >
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="border-zinc-700 text-zinc-300"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {submitting ? 'Salvando...' : 'Salvar Tarifa'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Current Tariff Card */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-500" />
            Tarifa Atual
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Preço vigente para carregamentos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentTariff ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-4xl font-bold text-emerald-500">
                  {formatCurrency(currentTariff.price_per_kwh)}
                  <span className="text-lg text-zinc-400 font-normal">/kWh</span>
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {currentTariff.location_address ? (
                    <Badge variant="outline" className="border-blue-500 text-blue-400">
                      <MapPin className="h-3 w-3 mr-1" />
                      {currentTariff.location_address}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-emerald-500 text-emerald-400">
                      Tarifa Global
                    </Badge>
                  )}
                </div>
              </div>
              <div className="text-right text-zinc-400 text-sm">
                <p>Atualizado em</p>
                <p className="text-white">{formatDate(currentTariff.created_at)}</p>
              </div>
            </div>
          ) : (
            <p className="text-zinc-400">Nenhuma tarifa configurada</p>
          )}
        </CardContent>
      </Card>

      {/* Tariff History */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <History className="h-5 w-5 text-zinc-400" />
            Histórico de Tarifas
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Alterações anteriores de preço
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tariffHistory.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800">
                  <TableHead className="text-zinc-400">Data</TableHead>
                  <TableHead className="text-zinc-400">Preço/kWh</TableHead>
                  <TableHead className="text-zinc-400">Local</TableHead>
                  <TableHead className="text-zinc-400">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tariffHistory.map(tariff => (
                  <TableRow key={tariff.id} className="border-zinc-800">
                    <TableCell className="text-zinc-300">{formatDate(tariff.created_at)}</TableCell>
                    <TableCell className="text-white font-medium">
                      {formatCurrency(tariff.price_per_kwh)}
                    </TableCell>
                    <TableCell className="text-zinc-300">
                      {tariff.location_address || 'Global'}
                    </TableCell>
                    <TableCell>
                      {tariff.is_current ? (
                        <Badge className="bg-emerald-500/20 text-emerald-400">Atual</Badge>
                      ) : (
                        <Badge variant="outline" className="border-zinc-600 text-zinc-400">
                          Anterior
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-zinc-400 text-center py-8">Nenhum histórico disponível</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Tariffs;
