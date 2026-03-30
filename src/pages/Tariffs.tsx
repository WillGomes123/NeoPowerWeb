import { useState, useEffect, useMemo } from 'react';
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
  min_price?: number;
  location_address: string | null;
  created_at: string;
  is_current: boolean;
}

interface Location {
  id: number;
  nomeDoLocal: string;
  endereco: string;
}

type FilterType = 'all' | 'global' | 'local';

export const Tariffs = () => {
  const [allTariffs, setAllTariffs] = useState<Tariff[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('global');
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchData = async () => {
    setLoading(true);
    try {
      // Carrega locais
      const locationsRes = await api.get('/locations/all');
      let loadedLocations: Location[] = [];
      if (locationsRes.ok) {
        const locationsData = await locationsRes.json();
        loadedLocations = locationsData.locations || locationsData || [];
        setLocations(loadedLocations);
      }

      // Tenta endpoint novo (retorna todas de uma vez)
      let usedNewEndpoint = false;
      try {
        const allRes = await api.get('/tariffs/all');
        if (allRes.ok) {
          const tariffData = await allRes.json();
          if (Array.isArray(tariffData) && tariffData.length > 0) {
            setAllTariffs(tariffData);
            usedNewEndpoint = true;
          }
        }
      } catch { /* endpoint não existe ainda */ }

      if (!usedNewEndpoint) {
        // Fallback: busca global + cada local via /tariffs/current
        const allFetched: Tariff[] = [];
        const seenIds = new Set<number>();

        const parseTariffResponse = (data: any): Tariff[] => {
          const result: Tariff[] = [];
          const history = data.history || [];
          const tariff = data.tariff || data;
          if (history.length > 0) {
            for (const h of history) {
              if (!seenIds.has(h.id)) {
                seenIds.add(h.id);
                result.push({
                  id: h.id,
                  price_per_kwh: h.price_per_kwh,
                  min_price: h.min_price,
                  location_address: h.address ?? null,
                  created_at: h.created_at,
                  is_current: h.is_current ?? (h.id === tariff?.id),
                });
              }
            }
          } else if (tariff?.price_per_kwh && !seenIds.has(tariff.id)) {
            seenIds.add(tariff.id);
            result.push({
              id: tariff.id ?? 0,
              price_per_kwh: tariff.price_per_kwh,
              location_address: tariff.address ?? null,
              created_at: tariff.created_at,
              is_current: true,
            });
          }
          return result;
        };

        // Global
        try {
          const globalRes = await api.get('/tariffs/current');
          if (globalRes.ok) allFetched.push(...parseTariffResponse(await globalRes.json()));
        } catch { /* ignore */ }

        // Por local
        for (const loc of loadedLocations) {
          try {
            const locRes = await api.get(`/tariffs/current?locationAddress=${encodeURIComponent(loc.endereco)}`);
            if (locRes.ok) {
              const items = parseTariffResponse(await locRes.json());
              // Só adiciona se tem tarifa específica do local (address != null)
              allFetched.push(...items.filter(t => t.location_address));
            }
          } catch { /* ignore */ }
        }

        setAllTariffs(allFetched.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
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

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  /* ── Dados derivados ── */
  const currentTariffs = useMemo(() => allTariffs.filter(t => t.is_current), [allTariffs]);
  const globalTariff = currentTariffs.find(t => !t.location_address);

  const filtered = useMemo(() => {
    if (filter === 'global') return allTariffs.filter(t => !t.location_address);
    if (filter === 'local') return allTariffs.filter(t => !!t.location_address);
    return allTariffs;
  }, [allTariffs, filter]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const current = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Agrupar locais únicos com tarifa atual
  const uniqueLocations = useMemo(() => {
    const map = new Map<string, Tariff>();
    for (const t of allTariffs) {
      if (t.location_address && t.is_current) {
        map.set(t.location_address, t);
      }
    }
    return Array.from(map.values());
  }, [allTariffs]);

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

      {/* Current Tariffs — Global + Per-Location Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Global Tariff Card */}
        <div className="bg-surface-container-highest rounded-xl border border-primary/20 relative overflow-hidden p-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[60px]" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>public</span>
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">TARIFA GLOBAL</span>
            </div>
            {globalTariff ? (
              <>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-3xl font-headline font-bold text-primary tracking-tighter">
                    {formatCurrency(globalTariff.price_per_kwh)}
                  </span>
                  <span className="text-sm text-on-surface-variant">/kWh</span>
                </div>
                <p className="text-[10px] text-on-surface-variant">
                  Atualizado em {formatDate(globalTariff.created_at)}
                </p>
              </>
            ) : (
              <p className="text-sm text-on-surface-variant">Nenhuma tarifa global configurada</p>
            )}
          </div>
        </div>

        {/* Per-Location Tariff Cards */}
        {uniqueLocations.map(tariff => (
          <div key={tariff.id} className="glass-card rounded-xl border border-outline-variant/10 relative overflow-hidden p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-tertiary text-base">location_on</span>
              <span className="text-[10px] font-bold text-tertiary uppercase tracking-widest truncate max-w-[200px]">
                {tariff.location_address}
              </span>
            </div>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-3xl font-headline font-bold text-on-surface tracking-tighter">
                {formatCurrency(tariff.price_per_kwh)}
              </span>
              <span className="text-sm text-on-surface-variant">/kWh</span>
            </div>
            <p className="text-[10px] text-on-surface-variant">
              Atualizado em {formatDate(tariff.created_at)}
            </p>
            {globalTariff && tariff.price_per_kwh !== globalTariff.price_per_kwh && (
              <div className="mt-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  tariff.price_per_kwh > globalTariff.price_per_kwh
                    ? 'bg-error/10 text-error'
                    : 'bg-primary/10 text-primary'
                }`}>
                  {tariff.price_per_kwh > globalTariff.price_per_kwh ? '↑' : '↓'}{' '}
                  {Math.abs(((tariff.price_per_kwh - globalTariff.price_per_kwh) / globalTariff.price_per_kwh) * 100).toFixed(0)}% vs global
                </span>
              </div>
            )}
          </div>
        ))}

        {/* Empty state for local tariffs */}
        {uniqueLocations.length === 0 && (
          <div className="glass-card rounded-xl border border-dashed border-outline-variant/20 p-6 flex flex-col items-center justify-center text-center">
            <span className="material-symbols-outlined text-3xl text-outline mb-2">add_location</span>
            <p className="text-xs text-on-surface-variant">Nenhuma tarifa por local</p>
            <p className="text-[10px] text-outline mt-1">Crie tarifas específicas para cada local</p>
          </div>
        )}
      </div>

      {/* Tariff History Table */}
      <div className="bg-surface-container-low rounded-xl border border-outline-variant/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-on-surface-variant">history</span>
            <h3 className="text-lg font-headline font-bold text-on-surface">Histórico de Tarifas</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-surface-container p-1 rounded-lg flex items-center border border-outline-variant/10">
              {(['all', 'global', 'local'] as FilterType[]).map(f => (
                <button
                  key={f}
                  onClick={() => { setFilter(f); setCurrentPage(1); }}
                  className={`px-3 py-1.5 text-xs font-bold font-headline rounded-md transition-all ${
                    filter === f ? 'bg-surface-container-highest text-primary' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {f === 'all' ? 'TODAS' : f === 'global' ? 'GLOBAL' : 'POR LOCAL'}
                </button>
              ))}
            </div>
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{filtered.length} registros</span>
          </div>
        </div>
        {filtered.length > 0 ? (
          <>
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
                  {current.map(tariff => (
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
                            <span className="material-symbols-outlined text-sm text-tertiary">location_on</span>
                            {tariff.location_address}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant">
                            <span className="material-symbols-outlined text-sm text-primary">public</span>
                            Global
                          </span>
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

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-outline-variant/10 flex justify-between items-center">
              <p className="text-xs text-on-surface-variant">
                Página <span className="font-bold text-on-surface">{currentPage}</span> de <span className="font-bold text-on-surface">{totalPages || 1}</span>
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg bg-surface-container-highest text-sm font-bold text-on-surface-variant hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-outline-variant/10"
                >
                  <span className="material-symbols-outlined text-base">chevron_left</span>
                  Anterior
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg bg-surface-container-highest text-sm font-bold text-on-surface-variant hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-outline-variant/10"
                >
                  Próxima
                  <span className="material-symbols-outlined text-base">chevron_right</span>
                </button>
              </div>
            </div>
          </>
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
