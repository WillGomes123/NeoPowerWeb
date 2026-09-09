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
import { useAuth } from '../lib/auth';

interface Tariff {
  id: number;
  price_per_kwh: number;
  min_price?: number;
  location_address: string | null;
  location_id?: number | null;
  profileId?: number | null;
  profileName?: string | null;
  created_at: string;
  is_current: boolean;
}

interface Location {
  id: number;
  nomeDoLocal: string;
  endereco: string;
  numero?: string | null;
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
  subtitle?: string | null;
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
  subtitle,
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

        {subtitle && (
          <p
            className="text-[10px] text-on-surface-variant -mt-2 mb-2 truncate max-w-[220px]"
            title={subtitle}
          >
            {subtitle}
          </p>
        )}

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
                placeholder="mín/sessão (opc.)"
                value={editMinPrice}
                onChange={e => setEditMinPrice(e.target.value)}
                className="w-28 bg-surface-container-low border border-outline-variant/30 text-on-surface-variant rounded px-2 py-1 text-xs font-headline focus:outline-none focus:border-primary"
              />
              <span className="text-[10px] text-on-surface-variant">mín/sessão</span>
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
                  Mín/sessão: {formatCurrency(minPrice)}
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
  // Operador white-label (comum) só precifica os PRÓPRIOS locais — não a rede
  // global. Pra ele, a box já vem com o local selecionado e sem "Toda a rede".
  const { user } = useAuth();
  const isOperator = user?.role === 'comum';
  const [allTariffs, setAllTariffs] = useState<Tariff[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [newMinPrice, setNewMinPrice] = useState('');
  const [newFloorKwh, setNewFloorKwh] = useState('');
  const [newMaxPrice, setNewMaxPrice] = useState('');
  // Copiar o preço de uma tarifa já existente (reaproveitar em vez de redigitar).
  const [copyFromId, setCopyFromId] = useState<string>('');
  // Local e Perfil são independentes e combináveis. 'all' = sem filtro
  // (toda a rede / todos os perfis). Os dois juntos = tarifa de (local × perfil).
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [selectedProfile, setSelectedProfile] = useState<string>('all');
  const [selectedCharger, setSelectedCharger] = useState<string>('all');
  const [chargers, setChargers] = useState<{ charge_point_id: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pageTab, setPageTab] = useState<'tarifas' | 'perfis'>('tarifas');
  const [filter, setFilter] = useState<FilterType>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [editingCard, setEditingCard] = useState<{
    type: 'global' | 'profile' | 'local';
    id?: number | null;
    address?: string | null;
    // Identidade do card de local por ID (não por endereço): dois locais na
    // mesma rua compartilham `endereco`, então chavear a edição por endereço
    // colocaria os dois em modo de edição ao mesmo tempo.
    locId?: number | null;
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

      // Carrega carregadores (para tarifa por carregador)
      try {
        const chRes = await api.get('/chargers');
        if (chRes.ok) {
          const d = await chRes.json();
          const lista = (d?.data ?? d) as { charge_point_id: string }[];
          if (Array.isArray(lista)) setChargers(lista);
        }
      } catch { /* carregadores são opcionais */ }

      // Tenta endpoint novo (retorna todas de uma vez)
      let usedNewEndpoint = false;
      try {
        const allRes = await api.get('/tariffs/all');
        if (allRes.ok) {
          const tariffData = await allRes.json();
          if (Array.isArray(tariffData) && tariffData.length > 0) {
            // price_per_kwh/min_price vêm como string (decimal do TypeORM). Sem
            // Number() a comparação price > globalPrice seria lexicográfica
            // ("10.0" < "9.0") e a seta ↑/↓ apontaria errado.
            setAllTariffs(
              tariffData.map((t: Tariff) => ({
                ...t,
                price_per_kwh: Number(t.price_per_kwh),
                min_price: t.min_price != null ? Number(t.min_price) : t.min_price,
              })),
            );
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

  // Operador: quando os locais carregam, já seleciona o primeiro — ele não
  // define a tarifa "global da rede", então o padrão dele é um local.
  useEffect(() => {
    if (isOperator && locations.length > 0 && selectedLocation === 'all') {
      setSelectedLocation(String(locations[0].id));
    }
  }, [isOperator, locations, selectedLocation]);

  const handleSubmit = async () => {
    if (!newPrice || parseFloat(newPrice) <= 0) {
      toast.error('Informe um preço válido');
      return;
    }

    setSubmitting(true);
    try {
      type TariffPayload = {
        newPrice: number;
        minPrice?: number;
        floorPerKwh?: number;
        maxPrice?: number;
        locationAddress?: string;
        locationId?: number;
        chargePointId?: string;
        profileId?: number;
      };
      const base: TariffPayload = { newPrice: parseFloat(newPrice) };
      if (newMinPrice && parseFloat(newMinPrice) > 0) base.minPrice = parseFloat(newMinPrice);
      if (newFloorKwh && parseFloat(newFloorKwh) > 0) base.floorPerKwh = parseFloat(newFloorKwh);
      if (newMaxPrice && parseFloat(newMaxPrice) > 0) base.maxPrice = parseFloat(newMaxPrice);
      const prof = selectedProfile !== 'all' ? parseInt(selectedProfile) : undefined;
      const withProf = (p: TariffPayload): TariffPayload => (prof ? { ...p, profileId: prof } : p);

      // Uma requisição por escopo. "__all_mine__" aplica o MESMO preço a TODOS
      // os locais visíveis de uma vez — operador com vários locais no mesmo valor.
      const payloads: TariffPayload[] = [];
      if (selectedCharger !== 'all') {
        payloads.push(withProf({ ...base, chargePointId: selectedCharger }));
      } else if (selectedLocation === '__all_mine__') {
        for (const loc of locations) payloads.push(withProf({ ...base, locationId: loc.id }));
      } else if (selectedLocation !== 'all') {
        const location = locations.find(l => l.id.toString() === selectedLocation);
        payloads.push(withProf(location ? { ...base, locationId: location.id } : base));
      } else {
        payloads.push(withProf(base));
      }

      if (payloads.length === 0) {
        toast.error('Selecione onde aplicar a tarifa.');
        setSubmitting(false);
        return;
      }

      const results = await Promise.all(payloads.map(p => api.post('/tariffs', p)));
      const okCount = results.filter(r => r.ok).length;

      if (okCount === payloads.length) {
        toast.success(
          payloads.length > 1 ? `Tarifa aplicada em ${okCount} locais!` : 'Tarifa atualizada com sucesso!'
        );
        setIsDialogOpen(false);
        setNewPrice('');
        setNewMinPrice('');
        setNewFloorKwh('');
        setNewMaxPrice('');
        setCopyFromId('');
        setSelectedLocation('all');
        setSelectedProfile('all');
        setSelectedCharger('all');
        void fetchData();
      } else {
        const failed = results.find(r => !r.ok);
        const errData = failed ? await failed.json().catch(() => null) : null;
        toast.error(
          okCount > 0
            ? `Aplicada em ${okCount} de ${payloads.length} locais. ${errData?.error || ''}`.trim()
            : errData?.error || 'Erro ao atualizar tarifa'
        );
        if (okCount > 0) void fetchData();
      }
    } catch {
      toast.error('Erro ao atualizar tarifa');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveInline = async (
    type: 'global' | 'profile' | 'local',
    id?: number | null,
    address?: string | null,
    locId?: number | null
  ) => {
    if (!editPrice || parseFloat(editPrice) <= 0) {
      toast.error('Informe um preço válido');
      return;
    }

    setInlineSubmitting(true);
    try {
      const payload: {
        newPrice: number;
        minPrice?: number;
        locationAddress?: string;
        locationId?: number;
        profileId?: number;
      } = {
        newPrice: parseFloat(editPrice),
      };
      if (editMinPrice && parseFloat(editMinPrice) > 0) payload.minPrice = parseFloat(editMinPrice);

      if (type === 'local') {
        // Preferimos o id do local (distingue locais de mesma rua); caímos no
        // endereço só como legado.
        if (locId != null) payload.locationId = locId;
        else if (address) payload.locationAddress = address;
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

  // Rótulo do escopo de uma tarifa, para o seletor "copiar de existente".
  // Com location_id, mostra o NOME do local — senão dois locais de mesmo
  // endereço ficariam com rótulo idêntico.
  const tariffScopeLabel = (t: Tariff) => {
    if (t.location_id != null) {
      const loc = locations.find(l => l.id === t.location_id);
      return loc?.nomeDoLocal || t.location_address || `Local #${t.location_id}`;
    }
    return t.location_address
      ? t.location_address
      : t.profileId
        ? t.profileName || `Perfil #${t.profileId}`
        : 'Global (rede)';
  };
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

  // Uma linha por LOCAL do operador (não deduplica por endereço). Cada local
  // resolve sua tarifa atual primeiro por `location_id` (chave nova, distingue
  // dois locais na mesma rua) e, se não houver, pelo `endereco` (tarifas
  // antigas, ainda não migradas).
  //
  // Antes, a lista era montada a partir das tarifas deduplicadas por
  // `location_address`: dois locais na mesma rua (mesmo `endereco`, ex.: dois
  // condomínios na Avenida Alphaville) colapsavam num card só — um deles
  // "sumia". Agora cada local aparece pelo NOME e, ao salvar, a tarifa vai por
  // `location_id` — preços independentes mesmo com o mesmo endereço.
  const locationRows = useMemo(() => {
    return locations
      .map(loc => {
        const tariff =
          currentTariffs.find(t => t.location_id === loc.id) ??
          currentTariffs.find(t => t.location_id == null && t.location_address === loc.endereco) ??
          null;
        return { loc, tariff };
      })
      .filter((r): r is { loc: Location; tariff: Tariff } => !!r.tariff);
  }, [locations, currentTariffs]);

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
            <DialogContent className="bg-surface-container border-outline-variant/20 sm:max-w-[480px] max-h-[88vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-on-surface font-headline flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">sell</span>
                  Definir Nova Tarifa
                </DialogTitle>
                <DialogDescription className="text-on-surface-variant">
                  Configure o preço por kWh por local, por perfil de cliente, ou os dois combinados.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-5 py-4">
                {/* Copiar de uma tarifa existente — reaproveita o preço */}
                {currentTariffs.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-on-surface-variant text-xs uppercase tracking-widest flex items-center gap-1">
                      Copiar de uma tarifa existente
                      <span className="normal-case tracking-normal text-outline font-normal">opcional</span>
                    </Label>
                    <Select
                      value={copyFromId}
                      onValueChange={v => {
                        setCopyFromId(v);
                        const t = currentTariffs.find(x => String(x.id) === v);
                        if (t) {
                          setNewPrice(String(t.price_per_kwh));
                          setNewMinPrice(t.min_price != null && Number(t.min_price) > 0 ? String(t.min_price) : '');
                        }
                      }}
                    >
                      <SelectTrigger className="bg-surface-container-low border-outline-variant/20 text-on-surface">
                        <SelectValue placeholder="Escolha uma tarifa para reaproveitar o preço" />
                      </SelectTrigger>
                      <SelectContent className="bg-surface-container border-outline-variant/20">
                        {currentTariffs.map(t => (
                          <SelectItem key={`copy-${t.id}`} value={String(t.id)} className="text-on-surface focus:bg-surface-container-highest">
                            {tariffScopeLabel(t)} — {formatCurrency(t.price_per_kwh)}/kWh
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-on-surface-variant">Preenche o preço abaixo. Depois é só escolher onde aplicar.</p>
                  </div>
                )}

                {/* Preço — o principal, em destaque */}
                <div className="space-y-2">
                  <Label className="text-on-surface-variant text-xs uppercase tracking-widest">
                    Preço por kWh
                  </Label>
                  <div className="flex items-center gap-2 bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 focus-within:border-primary transition-colors">
                    <span className="text-2xl font-headline font-bold text-on-surface">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={newPrice}
                      onChange={e => setNewPrice(e.target.value)}
                      autoFocus
                      className="flex-1 min-w-0 bg-transparent text-3xl font-headline font-bold text-on-surface focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0"
                    />
                    <span className="text-sm text-on-surface-variant whitespace-nowrap">/kWh</span>
                  </div>
                </div>

                {/* Onde aplicar (Local) — visível e simples */}
                <div className="space-y-2">
                  <Label className="text-on-surface-variant text-xs uppercase tracking-widest">Onde aplicar</Label>
                  <Select value={selectedLocation} onValueChange={setSelectedLocation} disabled={selectedCharger !== 'all'}>
                    <SelectTrigger className="bg-surface-container-low border-outline-variant/20 text-on-surface">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="bg-surface-container border-outline-variant/20">
                      {!isOperator && (
                        <SelectItem value="all" className="text-on-surface focus:bg-surface-container-highest">Toda a rede (preço padrão)</SelectItem>
                      )}
                      {locations.length > 1 && (
                        <SelectItem value="__all_mine__" className="text-on-surface focus:bg-surface-container-highest">
                          {isOperator ? '⭐ Todos os meus locais (mesmo preço)' : '⭐ Todos os locais (mesmo preço)'}
                        </SelectItem>
                      )}
                      {locations.map(location => (
                        <SelectItem key={`l-${location.id}`} value={location.id.toString()} className="text-on-surface focus:bg-surface-container-highest">
                          {location.nomeDoLocal}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-on-surface-variant">
                    {isOperator
                      ? 'Escolha um local — ou "Todos os meus locais" para aplicar o mesmo preço em todos de uma vez.'
                      : 'Deixe em "Toda a rede" para o preço geral, ou escolha um local (ou "Todos os locais").'}
                  </p>
                </div>

                {/* Toggle de opções avançadas */}
                <button
                  type="button"
                  onClick={() => setShowAdvanced(v => !v)}
                  className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline w-fit"
                >
                  <span className="material-symbols-outlined text-base">{showAdvanced ? 'expand_less' : 'tune'}</span>
                  {showAdvanced ? 'Ocultar opções avançadas' : 'Opções avançadas (mínimo, teto, carregador, perfil)'}
                </button>

                <div className={showAdvanced ? 'space-y-4 rounded-xl border border-outline-variant/10 bg-surface-container-low/40 p-4' : 'hidden'}>
                  <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-on-surface-variant text-xs uppercase tracking-widest flex items-center gap-1">
                      Mínimo por sessão (R$)
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
                  <div className="space-y-2">
                    <Label className="text-on-surface-variant text-xs uppercase tracking-widest flex items-center gap-1">
                      Piso por kWh (custo)
                      <span className="normal-case tracking-normal text-outline font-normal">opcional</span>
                    </Label>
                    <Input
                      id="floorKwh"
                      type="number"
                      step="0.0001"
                      min="0"
                      placeholder="0.0000"
                      value={newFloorKwh}
                      onChange={e => setNewFloorKwh(e.target.value)}
                      className="bg-surface-container-low border-outline-variant/20 text-on-surface"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-on-surface-variant text-xs uppercase tracking-widest flex items-center gap-1">
                      Teto por sessão (R$)
                      <span className="normal-case tracking-normal text-outline font-normal">opcional</span>
                    </Label>
                    <Input
                      id="maxPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={newMaxPrice}
                      onChange={e => setNewMaxPrice(e.target.value)}
                      className="bg-surface-container-low border-outline-variant/20 text-on-surface"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed -mt-2">
                  <b>Mínimo por sessão</b>: nenhuma recarga com energia custa menos que isso — cobre o custo de conexão de sessões curtas (sessão de 0 kWh não é cobrada).<br />
                  <b>Piso por kWh</b>: a cobrança nunca fica abaixo desse custo por kWh — protege de vender energia no prejuízo. Normalmente vem preenchido pela aba <b>Conta de Energia</b> do local.<br />
                  <b>Teto por sessão</b>: nenhuma recarga custa mais que isso — sanidade contra sessão disparada (0 ou vazio = sem teto).
                </p>

                <div className="space-y-2">
                  <Label className="text-on-surface-variant text-xs uppercase tracking-widest flex items-center gap-1">
                    Carregador
                    <span className="normal-case tracking-normal text-outline font-normal">mais específico que o local</span>
                  </Label>
                  <Select value={selectedCharger} onValueChange={setSelectedCharger}>
                    <SelectTrigger className="bg-surface-container-low border-outline-variant/20 text-on-surface">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="bg-surface-container border-outline-variant/20">
                      <SelectItem value="all" className="text-on-surface focus:bg-surface-container-highest">
                        Nenhum (usar Local abaixo)
                      </SelectItem>
                      {chargers.map(cp => (
                        <SelectItem
                          key={`c-${cp.charge_point_id}`}
                          value={cp.charge_point_id}
                          className="text-on-surface focus:bg-surface-container-highest"
                        >
                          {cp.charge_point_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedCharger !== 'all' && (
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">
                      A tarifa vale só para este carregador e vence a do local. O campo Local abaixo é ignorado.
                    </p>
                  )}
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
                    Combine Local/Carregador + Perfil para um preço específico — ex.: um local exclusivo para o perfil "Uber". Deixe no padrão para valer a todos.
                  </p>
                </div>
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
        {/* Global Tariff Card — oculto para operador (tenant): a tarifa global é
            da REDE (não é dele), ele não pode editá-la e só confundia. */}
        {isOperator ? null : globalTariff ? (
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
        {locationRows.map(({ loc, tariff }) => {
          const isCurrentEditing = editingCard?.type === 'local' && editingCard.locId === loc.id;
          const enderecoLegivel = [loc.endereco, loc.numero].filter(Boolean).join(', ');
          return (
            <TariffCard
              key={loc.id}
              type="local"
              title={loc.nomeDoLocal || loc.endereco}
              subtitle={enderecoLegivel}
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
                setEditingCard({ type: 'local', locId: loc.id, address: loc.endereco });
                setEditPrice(tariff.price_per_kwh.toString());
                setEditMinPrice(tariff.min_price ? tariff.min_price.toString() : '');
              }}
              onCancelEdit={() => {
                setEditingCard(null);
                setEditPrice('');
                setEditMinPrice('');
              }}
              onSave={() => handleSaveInline('local', null, loc.endereco, loc.id)}
              submitting={inlineSubmitting}
            />
          );
        })}

        {/* Empty state for local tariffs */}
        {locationRows.length === 0 && (
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
