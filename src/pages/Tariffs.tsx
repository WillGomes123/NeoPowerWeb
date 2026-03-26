import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { toast } from 'sonner';
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
  DialogTrigger,
} from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

interface Tariff {
  id: number;
  price_per_kwh: number;
  location_address: string | null;
  created_at: string;
  is_current: boolean;
}

interface Location {
  id: number;
  nomeDoLocal: string;
  endereco: string;
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
        api.get('/locations/all'),
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
        setLocations(locationsData.locations || []);
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
          payload.locationAddress = location.endereco;
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold block mb-1">PRICING ENGINE</span>
          <h1 className="font-headline text-4xl font-bold tracking-tight text-on-surface">Tarifas</h1>
          <p className="text-on-surface-variant mt-1">Gerencie os preços por kWh da rede</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => void fetchData()} className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-outline-variant/20 hover:bg-surface-container-high transition-colors font-medium text-sm">
            <span className="material-symbols-outlined text-lg">refresh</span>
            Atualizar
          </button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-tr from-primary to-secondary text-on-primary font-bold text-sm shadow-[0_4px_20px_rgba(142,255,113,0.3)] hover:scale-105 active:scale-95 transition-all">
                <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
                Nova Tarifa
              </button>
            </DialogTrigger>
            <DialogContent className="bg-surface-container border-outline-variant/20 sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle className="text-on-surface font-headline flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">sell</span>
                  Definir Nova Tarifa
                </DialogTitle>
                <DialogDescription className="text-on-surface-variant">
                  Configure o preço por kWh para a rede ou para um local específico.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label className="text-on-surface-variant text-xs uppercase tracking-widest">
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
                    className="bg-surface-container-low border-outline-variant/20 text-on-surface"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-on-surface-variant text-xs uppercase tracking-widest">
                    Aplicar para
                  </Label>
                  <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                    <SelectTrigger className="bg-surface-container-low border-outline-variant/20 text-on-surface">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="bg-surface-container border-outline-variant/20">
                      <SelectItem value="global" className="text-on-surface focus:bg-surface-container-highest">
                        Tarifa Global (toda a rede)
                      </SelectItem>
                      {locations.map(location => (
                        <SelectItem
                          key={location.id}
                          value={location.id.toString()}
                          className="text-on-surface focus:bg-surface-container-highest"
                        >
                          {location.nomeDoLocal}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="flex justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="border-outline-variant/20 text-on-surface-variant rounded-full px-6"
                >
                  Cancelar
                </Button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-full bg-primary text-on-primary font-bold text-sm hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                >
                  {submitting ? 'Salvando...' : 'Salvar Tarifa'}
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Current Tariff — Featured Bento Card */}
      <div className="bg-surface-container-highest rounded-xl border border-primary/20 relative overflow-hidden p-8">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[60px]" />
        {currentTariff ? (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>sell</span>
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest">TARIFA VIGENTE</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-headline font-bold text-primary tracking-tighter">
                  {formatCurrency(currentTariff.price_per_kwh)}
                </span>
                <span className="text-lg text-on-surface-variant font-normal">/kWh</span>
              </div>
              <div className="flex items-center gap-3 mt-4">
                {currentTariff.location_address ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-tertiary/10 text-tertiary border border-tertiary/20 text-xs font-bold">
                    <span className="material-symbols-outlined text-sm">location_on</span>
                    {currentTariff.location_address}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-bold">
                    <span className="material-symbols-outlined text-sm">public</span>
                    Tarifa Global
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 justify-end text-on-surface-variant mb-1">
                <span className="material-symbols-outlined text-sm">schedule</span>
                <span className="text-xs uppercase tracking-widest font-bold">Atualizado em</span>
              </div>
              <p className="text-sm font-medium text-on-surface">{formatDate(currentTariff.created_at)}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 relative z-10">
            <span className="material-symbols-outlined text-4xl text-outline mb-3">sell</span>
            <p className="text-sm text-on-surface-variant">Nenhuma tarifa configurada</p>
          </div>
        )}
      </div>

      {/* Tariff History Table */}
      <div className="bg-surface-container-low rounded-xl border border-outline-variant/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/10 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-on-surface-variant">history</span>
            <h3 className="text-lg font-headline font-bold text-on-surface">Histórico de Tarifas</h3>
          </div>
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{tariffHistory.length} registros</span>
        </div>
        {tariffHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em] bg-surface-container/50">
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4">Preço/kWh</th>
                  <th className="px-6 py-4">Local</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {tariffHistory.map(tariff => (
                  <tr key={tariff.id} className="hover:bg-surface-container-highest/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-on-surface-variant">schedule</span>
                        <span className="text-sm text-on-surface-variant">{formatDate(tariff.created_at)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold font-headline text-on-surface">
                      {formatCurrency(tariff.price_per_kwh)}
                    </td>
                    <td className="px-6 py-4">
                      {tariff.location_address ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant">
                          <span className="material-symbols-outlined text-sm">location_on</span>
                          {tariff.location_address}
                        </span>
                      ) : (
                        <span className="text-sm text-on-surface-variant">Global</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {tariff.is_current ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                          Atual
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-outline/10 text-on-surface-variant border border-outline/20 text-[10px] font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-outline" />
                          Anterior
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="material-symbols-outlined text-4xl text-outline mb-3">history</span>
            <p className="text-sm text-on-surface-variant">Nenhum histórico disponível</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Tariffs;
