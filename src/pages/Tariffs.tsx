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
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Profiles } from './Profiles';

interface Tariff {
  id: number;
  price_per_kwh: number;
  min_price?: number;
  location_address: string | null;
  profileId?: number | null;
  profileName?: string | null;
  created_at: string;
  is_current: boolean;
}

interface Location {
  id: number;
  nomeDoLocal: string;
  endereco: string;
}

interface ProfileOption {
  id: number;
  name: string;
  color?: string | null;
}

type FilterType = 'all' | 'global' | 'profile' | 'local';

interface TariffCardProps {
  type: 'global' | 'profile' | 'local';
  title: string;
  price: number;
  minPrice?: number | null;
  updatedAt: string;
  globalPrice?: number;
  isEditing: boolean;
  editPrice: string;
  setEditPrice: (v: string) => void;
  editMinPrice: string;
  setEditMinPrice: (v: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => Promise<void>;
  submitting: boolean;
}

const TariffCard = ({
  type,
  title,
  price,
  minPrice,
  updatedAt,
  globalPrice,
  isEditing,
  editPrice,
  setEditPrice,
  editMinPrice,
  setEditMinPrice,
  onStartEdit,
  onCancelEdit,
  onSave,
  submitting,
}: TariffCardProps) => {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  const config = {
    global: {
      border: 'border-primary/20',
      text: 'text-primary',
      icon: 'public',
    },
    profile: {
      border: 'border-secondary/20',
      text: 'text-secondary',
      icon: 'badge',
    },
    local: {
      border: 'border-tertiary/20',
      text: 'text-tertiary',
      icon: 'location_on',
    },
  }[type];

  const showComparison = type !== 'global' && globalPrice !== undefined && price !== globalPrice;

  return (
    <div className={`glass-card rounded-xl border ${config.border} relative overflow-hidden p-6 hover:shadow-xl hover:border-primary/30 transition-all group flex flex-col justify-between min-h-[220px]`}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[60px] pointer-events-none" />
      <div className="relative z-10 flex-1">
        <div className="flex items-center gap-2 mb-3">
          <span className={`material-symbols-outlined ${config.text} text-base`} style={{ fontVariationSettings: "'FILL' 1" }}>
            {config.icon}
          </span>
          <span className={`text-[10px] font-bold ${config.text} uppercase tracking-widest truncate max-w-[200px]`}>
            {type === 'global' ? 'TARIFA GLOBAL' : title}
          </span>
        </div>

        {isEditing ? (
          <div className="space-y-2 mt-4">
            <div className="flex items-center gap-1.5">
              <span className="text-base font-headline font-bold text-on-surface">R$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={editPrice}
                onChange={e => setEditPrice(e.target.value)}
                className="w-24 bg-surface-container-low border border-outline-variant/30 text-on-surface rounded px-2 py-1 text-base font-bold font-headline focus:outline-none focus:border-primary"
                autoFocus
              />
              <span className="text-xs text-on-surface-variant">/kWh</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-on-surface-variant w-5">≥</span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="mín. (opcional)"
                value={editMinPrice}
                onChange={e => setEditMinPrice(e.target.value)}
                className="w-28 bg-surface-container-low border border-outline-variant/30 text-on-surface-variant rounded px-2 py-1 text-xs font-headline focus:outline-none focus:border-primary"
              />
              <span className="text-[10px] text-on-surface-variant">piso/kWh</span>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-3xl font-headline font-bold text-on-surface tracking-tighter">
                {formatCurrency(price)}
              </span>
              <span className="text-sm text-on-surface-variant">/kWh</span>
            </div>
            {minPrice != null && minPrice > 0 && (
              <div className="mb-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <span className="material-symbols-outlined text-[12px]">bolt</span>
                  Piso: {formatCurrency(minPrice)}/kWh
                </span>
              </div>
            )}
            <p className="text-[10px] text-on-surface-variant">
              Atualizado em {formatDate(updatedAt)}
            </p>
            {showComparison && globalPrice && (
              <div className="mt-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  price > globalPrice
                    ? 'bg-error/10 text-error'
                    : 'bg-primary/10 text-primary'
                }`}>
                  {price > globalPrice ? '↑' : '↓'}{' '}
                  {Math.abs(((price - globalPrice) / globalPrice) * 100).toFixed(0)}% vs global
                </span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="relative z-10 mt-4 pt-3 border-t border-outline-variant/5">
        {isEditing ? (
          <div className="flex gap-2">
            <button
              onClick={onSave}
              disabled={submitting}
              className="flex-1 py-1.5 rounded-full bg-primary text-on-primary font-bold text-xs hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
            >
              {submitting ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={onCancelEdit}
              className="flex-1 py-1.5 rounded-full border border-outline-variant/20 text-on-surface-variant font-bold text-xs hover:bg-surface-container-high active:scale-95 transition-all"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={onStartEdit}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline font-bold"
          >
            <span className="material-symbols-outlined text-sm">edit</span>
            Alterar Valor
          </button>
        )}
      </div>
    </div>
  );
};

export const Tariffs = () => {
  const [allTariffs, setAllTariffs] = useState<Tariff[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [newMinPrice, setNewMinPrice] = useState('');
  // Local e Perfil são independentes e combináveis. 'all' = sem filtro
  // (toda a rede / todos os perfis). Os dois juntos = tarifa de (local × perfil).
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [selectedProfile, setSelectedProfile] = useState<string>('all');
  const [submitting, setSubmitting] = useState(false);
  const [pageTab, setPageTab] = useState<'tarifas' | 'perfis'>('tarifas');
  const [filter, setFilter] = useState<FilterType>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [editingCard, setEditingCard] = useState<{
    type: 'global' | 'profile' | 'local';
    id?: number | null;
    address?: string | null;
  } | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editMinPrice, setEditMinPrice] = useState('');
  const [inlineSubmitting, setInlineSubmitting] = useState(false);

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

      // Carrega perfis de cliente (para tarifa por perfil)
      try {
        const profilesRes = await api.get('/profiles');
        if (profilesRes.ok) setProfiles(await profilesRes.json());
      } catch { /* perfis são opcionais */ }

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
      const payload: { newPrice: number; minPrice?: number; locationAddress?: string; profileId?: number } = {
        newPrice: parseFloat(newPrice),
      };
      if (newMinPrice && parseFloat(newMinPrice) > 0) payload.minPrice = parseFloat(newMinPrice);

      if (selectedLocation !== 'all') {
        const location = locations.find(l => l.id.toString() === selectedLocation);
        if (location) payload.locationAddress = location.endereco;
      }
      if (selectedProfile !== 'all') {
        payload.profileId = parseInt(selectedProfile);
      }

      const response = await api.post('/tariffs', payload);

      if (response.ok) {
        toast.success('Tarifa atualizada com sucesso!');
        setIsDialogOpen(false);
        setNewPrice('');
        setNewMinPrice('');
        setSelectedLocation('all');
        setSelectedProfile('all');
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

  const handleSaveInline = async (type: 'global' | 'profile' | 'local', id?: number | null, address?: string | null) => {
    if (!editPrice || parseFloat(editPrice) <= 0) {
      toast.error('Informe um preço válido');
      return;
    }

    setInlineSubmitting(true);
    try {
      const payload: { newPrice: number; minPrice?: number; locationAddress?: string; profileId?: number } = {
        newPrice: parseFloat(editPrice),
      };
      if (editMinPrice && parseFloat(editMinPrice) > 0) payload.minPrice = parseFloat(editMinPrice);

      if (type === 'local' && address) {
        payload.locationAddress = address;
      } else if (type === 'profile' && id) {
        payload.profileId = id;
      }

      const response = await api.post('/tariffs', payload);

      if (response.ok) {
        toast.success('Tarifa atualizada com sucesso!');
        setEditingCard(null);
        setEditPrice('');
        setEditMinPrice('');
        void fetchData();
      } else {
        const errData = await response.json();
        toast.error(errData.error || 'Erro ao atualizar tarifa');
      }
    } catch {
      toast.error('Erro ao atualizar tarifa');
    } finally {
      setInlineSubmitting(false);
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
  const globalTariff = currentTariffs.find(t => !t.location_address && !t.profileId);
  const profileTariffs = useMemo(() => currentTariffs.filter(t => !!t.profileId), [currentTariffs]);

  const filtered = useMemo(() => {
    if (filter === 'global') return allTariffs.filter(t => !t.location_address && !t.profileId);
    if (filter === 'profile') return allTariffs.filter(t => !!t.profileId);
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
        {pageTab === 'tarifas' && (
        <div className="flex items-center gap-3">
          <button onClick={() => void fetchData()} className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-outline-variant/20 hover:bg-surface-container-high transition-colors font-bold text-sm">
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
                  Configure o preço por kWh por local, por perfil de cliente, ou os dois combinados.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-3">
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
                    <Label className="text-on-surface-variant text-xs uppercase tracking-widest flex items-center gap-1">
                      Piso mínimo (R$/kWh)
                      <span className="normal-case tracking-normal text-outline font-normal">opcional</span>
                    </Label>
                    <Input
                      id="minPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={newMinPrice}
                      onChange={e => setNewMinPrice(e.target.value)}
                      className="bg-surface-container-low border-outline-variant/20 text-on-surface"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed -mt-2">
                  O piso mínimo garante que a cobrança nunca fique abaixo desse valor/kWh — útil para proteger o custo da conta de energia.
                </p>
                <div className="space-y-2">
                  <Label className="text-on-surface-variant text-xs uppercase tracking-widest">
                    Local
                  </Label>
                  <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                    <SelectTrigger className="bg-surface-container-low border-outline-variant/20 text-on-surface">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="bg-surface-container border-outline-variant/20">
                      <SelectItem value="all" className="text-on-surface focus:bg-surface-container-highest">
                        Toda a rede
                      </SelectItem>
                      {locations.map(location => (
                        <SelectItem
                          key={`l-${location.id}`}
                          value={location.id.toString()}
                          className="text-on-surface focus:bg-surface-container-highest"
                        >
                          {location.nomeDoLocal}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-on-surface-variant text-xs uppercase tracking-widest">
                    Perfil de cliente
                  </Label>
                  <Select value={selectedProfile} onValueChange={setSelectedProfile}>
                    <SelectTrigger className="bg-surface-container-low border-outline-variant/20 text-on-surface">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="bg-surface-container border-outline-variant/20">
                      <SelectItem value="all" className="text-on-surface focus:bg-surface-container-highest">
                        Padrão (todos os perfis)
                      </SelectItem>
                      {profiles.map(profile => (
                        <SelectItem
                          key={`p-${profile.id}`}
                          value={profile.id.toString()}
                          className="text-on-surface focus:bg-surface-container-highest"
                        >
                          {profile.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  Combine os dois para uma tarifa específica — ex.: um local com preço exclusivo para o perfil "Uber". Deixe ambos no padrão para a tarifa global.
                </p>
              </div>
              <DialogFooter className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  className="px-6 py-2.5 rounded-full border border-outline-variant/20 text-on-surface-variant font-bold text-sm hover:bg-surface-container-high active:scale-95 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
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
        )}
      </div>

      {/* Sub-abas: Tarifas | Perfis */}
      <div className="bg-surface-container p-1 rounded-lg inline-flex items-center border border-outline-variant/10">
        {(['tarifas', 'perfis'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setPageTab(tab)}
            className={`px-5 py-1.5 text-xs font-bold font-headline rounded-md transition-all ${pageTab === tab ? 'bg-surface-container-highest text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            {tab === 'tarifas' ? 'TARIFAS' : 'PERFIS'}
          </button>
        ))}
      </div>

      {pageTab === 'perfis' && <Profiles embedded />}

      {pageTab === 'tarifas' && (
      <>
      {/* Current Tariffs — Global + Per-Location Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Global Tariff Card */}
        {globalTariff ? (
          <TariffCard
            type="global"
            title="TARIFA GLOBAL"
            price={globalTariff.price_per_kwh}
            minPrice={globalTariff.min_price}
            updatedAt={globalTariff.created_at}
            isEditing={editingCard?.type === 'global'}
            editPrice={editPrice}
            setEditPrice={setEditPrice}
            editMinPrice={editMinPrice}
            setEditMinPrice={setEditMinPrice}
            onStartEdit={() => {
              setEditingCard({ type: 'global' });
              setEditPrice(globalTariff.price_per_kwh.toString());
              setEditMinPrice(globalTariff.min_price ? globalTariff.min_price.toString() : '');
            }}
            onCancelEdit={() => {
              setEditingCard(null);
              setEditPrice('');
              setEditMinPrice('');
            }}
            onSave={() => handleSaveInline('global')}
            submitting={inlineSubmitting}
          />
        ) : (
          <div className="glass-card rounded-xl border border-primary/20 p-6 flex flex-col justify-center min-h-[220px]">
            <p className="text-sm text-on-surface-variant">Nenhuma tarifa global configurada</p>
          </div>
        )}

        {/* Per-Profile Tariff Cards */}
        {profileTariffs.map(tariff => {
          const isCurrentEditing = editingCard?.type === 'profile' && editingCard.id === tariff.profileId;
          return (
            <TariffCard
              key={`profile-${tariff.id}`}
              type="profile"
              title={tariff.profileName || `Perfil #${tariff.profileId}`}
              price={tariff.price_per_kwh}
              minPrice={tariff.min_price}
              updatedAt={tariff.created_at}
              globalPrice={globalTariff?.price_per_kwh}
              isEditing={isCurrentEditing}
              editPrice={editPrice}
              setEditPrice={setEditPrice}
              editMinPrice={editMinPrice}
              setEditMinPrice={setEditMinPrice}
              onStartEdit={() => {
                setEditingCard({ type: 'profile', id: tariff.profileId });
                setEditPrice(tariff.price_per_kwh.toString());
                setEditMinPrice(tariff.min_price ? tariff.min_price.toString() : '');
              }}
              onCancelEdit={() => {
                setEditingCard(null);
                setEditPrice('');
                setEditMinPrice('');
              }}
              onSave={() => handleSaveInline('profile', tariff.profileId)}
              submitting={inlineSubmitting}
            />
          );
        })}

        {/* Per-Location Tariff Cards */}
        {uniqueLocations.map(tariff => {
          const isCurrentEditing = editingCard?.type === 'local' && editingCard.address === tariff.location_address;
          return (
            <TariffCard
              key={tariff.id}
              type="local"
              title={tariff.location_address || ''}
              price={tariff.price_per_kwh}
              minPrice={tariff.min_price}
              updatedAt={tariff.created_at}
              globalPrice={globalTariff?.price_per_kwh}
              isEditing={isCurrentEditing}
              editPrice={editPrice}
              setEditPrice={setEditPrice}
              editMinPrice={editMinPrice}
              setEditMinPrice={setEditMinPrice}
              onStartEdit={() => {
                setEditingCard({ type: 'local', address: tariff.location_address });
                setEditPrice(tariff.price_per_kwh.toString());
                setEditMinPrice(tariff.min_price ? tariff.min_price.toString() : '');
              }}
              onCancelEdit={() => {
                setEditingCard(null);
                setEditPrice('');
                setEditMinPrice('');
              }}
              onSave={() => handleSaveInline('local', null, tariff.location_address)}
              submitting={inlineSubmitting}
            />
          );
        })}

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
            <Select value={filter} onValueChange={(v: FilterType) => { setFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[150px] bg-surface-container-low border-outline-variant/20 text-on-surface text-xs h-9">
                <SelectValue placeholder="Filtrar escopo" />
              </SelectTrigger>
              <SelectContent className="bg-surface-container border-outline-variant/20">
                <SelectItem value="all" className="text-on-surface focus:bg-surface-container-highest">Todas</SelectItem>
                <SelectItem value="global" className="text-on-surface focus:bg-surface-container-highest">Global</SelectItem>
                <SelectItem value="profile" className="text-on-surface focus:bg-surface-container-highest">Por Perfil</SelectItem>
                <SelectItem value="local" className="text-on-surface focus:bg-surface-container-highest">Por Local</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">{filtered.length} registros</span>
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
                    <th className="px-6 py-4">Escopo</th>
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
                        {tariff.profileId ? (
                          <span className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant">
                            <span className="material-symbols-outlined text-sm text-secondary">badge</span>
                            {tariff.profileName || `Perfil #${tariff.profileId}`}
                          </span>
                        ) : tariff.location_address ? (
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
      </>
      )}
    </div>
  );
};

export default Tariffs;
