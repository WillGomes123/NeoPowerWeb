import { useState, useEffect, useMemo, type ReactNode } from 'react';
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
  /** Taxa de destrava (R$ por recarga). */
  connection_fee?: number | null;
  location_address: string | null;
  location_id?: number | null;
  charge_point_id?: string | null;
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

type FilterType = 'all' | 'global' | 'profile' | 'local' | 'charger';

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

const formatarDataCurta = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

const formatarDataCompleta = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

/** Mínimo por recarga e taxa de destrava, em texto corrido — só o que existe. */
function extrasDaTarifa(minimo?: number | null, destrava?: number | null): string {
  const partes: string[] = [];
  if (minimo != null && Number(minimo) > 0) partes.push(`mín. ${formatarMoeda(Number(minimo))}/recarga`);
  if (destrava != null && Number(destrava) > 0) partes.push(`destrava ${formatarMoeda(Number(destrava))}`);
  return partes.join(' · ');
}

/** Tarifa de local "pura": de um local, sem perfil e sem carregador. */
const ehDeLocal = (t: Tariff) =>
  !t.profileId && !t.charge_point_id && (t.location_id != null || !!t.location_address);

/** Global: sem local, sem endereço, sem perfil e sem carregador. */
const ehGlobal = (t: Tariff) =>
  !t.location_address && t.location_id == null && !t.profileId && !t.charge_point_id;

/** Escopo da tarifa editada na lista — o mesmo que ela já tinha. */
interface EscopoDaEdicao {
  locationId?: number | null;
  locationAddress?: string | null;
  profileId?: number | null;
  chargePointId?: string | null;
}

/** Colunas da lista (no celular: nome e preço; o resto na linha de baixo). */
const COLUNAS =
  'grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,2fr)_9rem_minmax(0,1.4fr)_5.5rem_6rem] items-center gap-x-4';

interface LinhaDePrecoProps {
  icone: string;
  titulo: string;
  subtitulo?: string | null;
  /** Preço por kWh; null quando não há tarifa nenhuma para mostrar. */
  preco: number | null;
  /** Local sem preço próprio: mostra o preço da global, apagado. */
  usaGlobal?: boolean;
  minimo?: number | null;
  destrava?: number | null;
  atualizadoEm?: string | null;
  editando: boolean;
  editPrice: string;
  setEditPrice: (v: string) => void;
  editMinPrice: string;
  setEditMinPrice: (v: string) => void;
  onEditar: () => void;
  onCancelar: () => void;
  onSalvar: () => Promise<void>;
  salvando: boolean;
}

/**
 * Uma linha da lista de preços. O preço é o que salta aos olhos; mínimo,
 * destrava e data ficam em texto discreto. Antes eram cartões com endereço,
 * selos coloridos e "% vs global", e o preço se perdia no meio (15/10/2026).
 */
const LinhaDePreco = ({
  icone,
  titulo,
  subtitulo,
  preco,
  usaGlobal = false,
  minimo,
  destrava,
  atualizadoEm,
  editando,
  editPrice,
  setEditPrice,
  editMinPrice,
  setEditMinPrice,
  onEditar,
  onCancelar,
  onSalvar,
  salvando,
}: LinhaDePrecoProps) => {
  const extras = extrasDaTarifa(minimo, destrava);
  const linhaDeBaixo = [extras, atualizadoEm ? `atualizado ${formatarDataCurta(atualizadoEm)}` : '']
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className={`${COLUNAS} gap-y-1 px-4 md:px-6 py-3 border-t border-outline-variant/10 first:border-t-0 hover:bg-surface-container-high/40 transition-colors`}
    >
      <div className="min-w-0 flex items-center gap-3">
        <span className="material-symbols-outlined text-base text-on-surface-variant shrink-0">{icone}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-on-surface truncate" title={titulo}>
            {titulo}
          </p>
          {subtitulo && (
            <p className="text-xs text-on-surface-variant truncate" title={subtitulo}>
              {subtitulo}
            </p>
          )}
        </div>
      </div>

      {editando ? (
        <div className="col-span-2 md:col-span-4 flex flex-wrap items-center gap-x-3 gap-y-2 pt-2 md:pt-0 md:justify-end">
          <label className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-on-surface">R$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              aria-label="Preço por kWh"
              value={editPrice}
              onChange={e => setEditPrice(e.target.value)}
              autoFocus
              className="w-24 bg-surface-container-low border border-outline-variant/30 text-on-surface rounded-md px-2 py-1.5 text-sm font-bold tabular-nums focus:outline-none focus:border-primary"
            />
            <span className="text-xs text-on-surface-variant">/kWh</span>
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-xs text-on-surface-variant">mín.</span>
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              aria-label="Mínimo por recarga"
              placeholder="opcional"
              value={editMinPrice}
              onChange={e => setEditMinPrice(e.target.value)}
              className="w-24 bg-surface-container-low border border-outline-variant/30 text-on-surface rounded-md px-2 py-1.5 text-xs tabular-nums focus:outline-none focus:border-primary"
            />
            <span className="text-xs text-on-surface-variant">/recarga</span>
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => void onSalvar()}
              disabled={salvando}
              className="px-4 py-1.5 rounded-full bg-primary text-on-primary font-bold text-xs active:scale-95 transition-all disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={onCancelar}
              className="px-4 py-1.5 rounded-full border border-outline-variant/20 text-on-surface-variant font-bold text-xs hover:bg-surface-container-high active:scale-95 transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="text-right whitespace-nowrap">
            <span
              className={`text-lg md:text-xl font-headline font-bold tabular-nums ${usaGlobal ? 'text-on-surface-variant' : 'text-on-surface'}`}
            >
              {preco != null ? formatarMoeda(preco) : '—'}
            </span>
            {preco != null && <span className="text-xs text-on-surface-variant">/kWh</span>}
            {usaGlobal && (
              <p className="text-[10px] uppercase tracking-wider text-on-surface-variant">tarifa global</p>
            )}
          </div>
          {/* Celular: mínimo, destrava e data juntos, abaixo do nome. */}
          <p className="md:hidden text-xs text-on-surface-variant truncate">{linhaDeBaixo || ' '}</p>
          <p className="hidden md:block text-xs text-on-surface-variant truncate" title={extras || undefined}>
            {extras || '—'}
          </p>
          <p
            className="hidden md:block text-xs text-on-surface-variant tabular-nums"
            title={atualizadoEm ? formatarDataCompleta(atualizadoEm) : undefined}
          >
            {atualizadoEm ? formatarDataCurta(atualizadoEm) : '—'}
          </p>
          <div className="text-right">
            <button
              onClick={onEditar}
              className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              <span className="material-symbols-outlined text-sm">edit</span>
              {usaGlobal ? 'Definir' : 'Alterar'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

/** Um bloco da lista de preços: título, cabeçalho das colunas e as linhas. */
const ListaDePrecos = ({
  titulo,
  descricao,
  rotulo,
  children,
}: {
  titulo: string;
  descricao?: string;
  rotulo: string;
  children: ReactNode;
}) => (
  <section className="bg-surface-container-low rounded-xl border border-outline-variant/10 overflow-hidden">
    <header className="px-4 md:px-6 py-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-outline-variant/10">
      <h2 className="text-sm font-headline font-bold text-on-surface">{titulo}</h2>
      {descricao && <span className="text-xs text-on-surface-variant">{descricao}</span>}
    </header>
    <div
      className={`hidden md:grid ${COLUNAS.replace('grid ', '')} px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant bg-surface-container/40`}
    >
      <span>{rotulo}</span>
      <span className="text-right">Preço</span>
      <span>Mínimo e destrava</span>
      <span>Atualizado</span>
      <span />
    </div>
    {children}
  </section>
);

export const Tariffs = () => {
  // Quem não é admin da plataforma (admin da marca, operador) só precifica os
  // PRÓPRIOS locais — a tarifa global da rede é da plataforma, e a API recusa.
  // Pra ele, a box já vem com o local selecionado e sem "Toda a rede".
  const { user } = useAuth();
  const isOperator = !(user?.role === 'admin' && !user?.clientId);
  const [allTariffs, setAllTariffs] = useState<Tariff[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [newMinPrice, setNewMinPrice] = useState('');
  const [newFloorKwh, setNewFloorKwh] = useState('');
  const [newMaxPrice, setNewMaxPrice] = useState('');
  const [newConnectionFee, setNewConnectionFee] = useState('');
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

  // Linha em edição na lista de preços. `chave` identifica a linha (dois locais
  // na mesma rua têm chaves diferentes); `escopo` é o que vai no POST, o mesmo
  // da tarifa editada.
  const [editando, setEditando] = useState<{ chave: string; escopo: EscopoDaEdicao } | null>(null);
  const [busca, setBusca] = useState('');
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
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
                connection_fee: t.connection_fee != null ? Number(t.connection_fee) : t.connection_fee,
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
        connectionFee?: number;
        locationAddress?: string;
        locationId?: number;
        chargePointId?: string;
        profileId?: number;
      };
      const base: TariffPayload = { newPrice: parseFloat(newPrice) };
      if (newMinPrice && parseFloat(newMinPrice) > 0) base.minPrice = parseFloat(newMinPrice);
      if (newFloorKwh && parseFloat(newFloorKwh) > 0) base.floorPerKwh = parseFloat(newFloorKwh);
      if (newMaxPrice && parseFloat(newMaxPrice) > 0) base.maxPrice = parseFloat(newMaxPrice);
      // Taxa aceita 0 explícito (para tirar a taxa); vazio = herda a atual.
      if (newConnectionFee.trim() !== '' && parseFloat(newConnectionFee) >= 0) {
        base.connectionFee = parseFloat(newConnectionFee);
      }
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
        setNewConnectionFee('');
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

  const editar = (chave: string, escopo: EscopoDaEdicao, preco: number | null, minimo: number | null) => {
    setEditando({ chave, escopo });
    setEditPrice(preco != null ? String(preco) : '');
    setEditMinPrice(minimo ? String(minimo) : '');
  };

  const cancelarEdicao = () => {
    setEditando(null);
    setEditPrice('');
    setEditMinPrice('');
  };

  /** Salva a linha em edição no MESMO escopo da tarifa (global, local, perfil, carregador). */
  const handleSaveInline = async () => {
    if (!editando) return;
    if (!editPrice || parseFloat(editPrice) <= 0) {
      toast.error('Informe um preço válido');
      return;
    }

    setInlineSubmitting(true);
    try {
      const { escopo } = editando;
      const payload: {
        newPrice: number;
        minPrice?: number;
        locationAddress?: string;
        locationId?: number;
        profileId?: number;
        chargePointId?: string;
      } = {
        newPrice: parseFloat(editPrice),
      };
      if (editMinPrice && parseFloat(editMinPrice) > 0) payload.minPrice = parseFloat(editMinPrice);

      if (escopo.chargePointId) payload.chargePointId = escopo.chargePointId;
      // Preferimos o id do local (distingue locais de mesma rua); o endereço
      // só como legado.
      else if (escopo.locationId != null) payload.locationId = escopo.locationId;
      else if (escopo.locationAddress) payload.locationAddress = escopo.locationAddress;
      if (escopo.profileId) payload.profileId = escopo.profileId;

      const response = await api.post('/tariffs', payload);

      if (response.ok) {
        toast.success('Tarifa atualizada com sucesso!');
        cancelarEdicao();
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

  // Rótulo do escopo de uma tarifa (seletor "copiar de existente" e histórico).
  // Com location_id, mostra o NOME do local — senão dois locais de mesmo
  // endereço ficariam com rótulo idêntico.
  const tariffScopeLabel = (t: Tariff) => {
    if (t.charge_point_id) {
      const perfil = t.profileId ? ` · ${t.profileName || `Perfil #${t.profileId}`}` : '';
      return `Carregador ${t.charge_point_id}${perfil}`;
    }
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
  // Tarifa de carregador também não tem endereço: sem excluí-la, a mais recente
  // delas virava a "global" (ver ehGlobal).
  const globalTariff = currentTariffs.find(ehGlobal);

  const filtered = useMemo(() => {
    if (filter === 'global') return allTariffs.filter(ehGlobal);
    if (filter === 'profile') return allTariffs.filter(t => !!t.profileId);
    if (filter === 'local') return allTariffs.filter(ehDeLocal);
    if (filter === 'charger') return allTariffs.filter(t => !!t.charge_point_id);
    return allTariffs;
  }, [allTariffs, filter]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const current = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Uma linha por LOCAL — todos, inclusive os que usam a global — em ordem
  // alfabética, para achar o local pelo nome. Cada local resolve a tarifa
  // atual primeiro por `location_id` (distingue dois locais na mesma rua) e,
  // se não houver, pelo `endereco` (tarifas antigas, ainda não migradas). Só
  // tarifa de local: a de perfil ou de carregador naquele local tem lista própria.
  const linhasDeLocal = useMemo(
    () =>
      locations
        .map(loc => ({
          loc,
          tariff:
            currentTariffs.find(t => ehDeLocal(t) && t.location_id === loc.id) ??
            currentTariffs.find(
              t => ehDeLocal(t) && t.location_id == null && t.location_address === loc.endereco
            ) ??
            null,
        }))
        .sort((a, b) =>
          (a.loc.nomeDoLocal || a.loc.endereco || '').localeCompare(
            b.loc.nomeDoLocal || b.loc.endereco || '',
            'pt-BR'
          )
        ),
    [locations, currentTariffs]
  );
  const tarifasDeCarregador = useMemo(
    () =>
      currentTariffs
        .filter(t => !!t.charge_point_id)
        .sort((a, b) => (a.charge_point_id || '').localeCompare(b.charge_point_id || '', 'pt-BR')),
    [currentTariffs]
  );
  const tarifasDePerfil = useMemo(
    () => currentTariffs.filter(t => !!t.profileId && !t.charge_point_id),
    [currentTariffs]
  );

  // Busca por nome, endereço, carregador ou perfil, sem diferenciar acento.
  const normalizar = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const termo = normalizar(busca.trim());
  const casaBusca = (...textos: Array<string | null | undefined>) =>
    !termo || textos.some(t => !!t && normalizar(t).includes(termo));
  const locaisVisiveis = linhasDeLocal.filter(r => casaBusca(r.loc.nomeDoLocal, r.loc.endereco));
  const carregadoresVisiveis = tarifasDeCarregador.filter(t => casaBusca(t.charge_point_id, t.profileName));
  const perfisVisiveis = tarifasDePerfil.filter(t => casaBusca(t.profileName, tariffScopeLabel(t)));
  const localDaTarifa = (t: Tariff) =>
    (t.location_id != null ? locations.find(l => l.id === t.location_id)?.nomeDoLocal : null) ||
    t.location_address;

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
                          setNewConnectionFee(t.connection_fee != null && Number(t.connection_fee) > 0 ? String(t.connection_fee) : '');
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
                  {showAdvanced ? 'Ocultar opções avançadas' : 'Opções avançadas (mínimo, teto, taxa de destrava, carregador, perfil)'}
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
                  <div className="space-y-2">
                    <Label className="text-on-surface-variant text-xs uppercase tracking-widest flex items-center gap-1">
                      Taxa de destrava (R$)
                      <span className="normal-case tracking-normal text-outline font-normal">opcional</span>
                    </Label>
                    <Input
                      id="connectionFee"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={newConnectionFee}
                      onChange={e => setNewConnectionFee(e.target.value)}
                      className="bg-surface-container-low border-outline-variant/20 text-on-surface"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed -mt-2">
                  <b>Mínimo por sessão</b>: nenhuma recarga com energia custa menos que isso — cobre o custo de conexão de sessões curtas (sessão de 0 kWh não é cobrada).<br />
                  <b>Piso por kWh</b>: a cobrança nunca fica abaixo desse custo por kWh — protege de vender energia no prejuízo. Normalmente vem preenchido pela aba <b>Conta de Energia</b> do local.<br />
                  <b>Teto por sessão</b>: nenhuma recarga custa mais que isso — sanidade contra sessão disparada (0 ou vazio = sem teto).<br />
                  <b>Taxa de destrava</b>: valor fixo por recarga, somado à energia assim que a recarga entrega energia (o mínimo vale sobre a soma). Vazio mantém a taxa atual; 0 remove.
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
      {/* Lista de preços: o valor de cada local à vista, com busca. */}
      <div className="space-y-6">
        {/* Tarifa global — oculta para operador (tenant): é da REDE, ele não a edita. */}
        {!isOperator && (
          <ListaDePrecos titulo="Tarifa global da rede" descricao="vale para os locais sem preço próprio" rotulo="Escopo">
            {globalTariff ? (
              <LinhaDePreco
                icone="public"
                titulo="Toda a rede"
                preco={globalTariff.price_per_kwh}
                minimo={globalTariff.min_price}
                destrava={globalTariff.connection_fee}
                atualizadoEm={globalTariff.created_at}
                editando={editando?.chave === 'global'}
                editPrice={editPrice}
                setEditPrice={setEditPrice}
                editMinPrice={editMinPrice}
                setEditMinPrice={setEditMinPrice}
                onEditar={() => editar('global', {}, globalTariff.price_per_kwh, globalTariff.min_price ?? null)}
                onCancelar={cancelarEdicao}
                onSalvar={handleSaveInline}
                salvando={inlineSubmitting}
              />
            ) : (
              <p className="px-4 md:px-6 py-4 text-sm text-on-surface-variant">Nenhuma tarifa global configurada</p>
            )}
          </ListaDePrecos>
        )}

        <div className="relative max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg text-on-surface-variant pointer-events-none">
            search
          </span>
          <input
            type="search"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar local, carregador ou perfil"
            aria-label="Buscar tarifa"
            className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-surface-container-low border border-outline-variant/20 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary"
          />
        </div>

        <ListaDePrecos
          titulo="Preço por local"
          descricao={termo ? `${locaisVisiveis.length} de ${linhasDeLocal.length} locais` : `${linhasDeLocal.length} locais`}
          rotulo="Local"
        >
          {locaisVisiveis.length > 0 ? (
            locaisVisiveis.map(({ loc, tariff }) => {
              const chave = `loc:${loc.id}`;
              // Sem preço próprio, vale a global: mostra o preço dela, apagado.
              const vigente = tariff ?? globalTariff ?? null;
              return (
                <LinhaDePreco
                  key={loc.id}
                  icone="location_on"
                  titulo={loc.nomeDoLocal || loc.endereco}
                  subtitulo={[loc.endereco, loc.numero].filter(Boolean).join(', ')}
                  preco={vigente?.price_per_kwh ?? null}
                  usaGlobal={!tariff}
                  minimo={vigente?.min_price}
                  destrava={vigente?.connection_fee}
                  atualizadoEm={tariff?.created_at ?? null}
                  editando={editando?.chave === chave}
                  editPrice={editPrice}
                  setEditPrice={setEditPrice}
                  editMinPrice={editMinPrice}
                  setEditMinPrice={setEditMinPrice}
                  onEditar={() =>
                    editar(
                      chave,
                      { locationId: loc.id, locationAddress: loc.endereco },
                      vigente?.price_per_kwh ?? null,
                      tariff?.min_price ?? null
                    )
                  }
                  onCancelar={cancelarEdicao}
                  onSalvar={handleSaveInline}
                  salvando={inlineSubmitting}
                />
              );
            })
          ) : (
            <p className="px-4 md:px-6 py-6 text-sm text-on-surface-variant">
              {termo ? 'Nenhum local encontrado.' : 'Nenhum local cadastrado.'}
            </p>
          )}
        </ListaDePrecos>

        {carregadoresVisiveis.length > 0 && (
          <ListaDePrecos
            titulo="Preço por carregador"
            descricao="vale só no carregador e passa na frente do preço do local"
            rotulo="Carregador"
          >
            {carregadoresVisiveis.map(t => {
              const chave = `cp:${t.charge_point_id}:${t.profileId ?? ''}`;
              return (
                <LinhaDePreco
                  key={t.id}
                  icone="ev_station"
                  titulo={t.charge_point_id || ''}
                  subtitulo={t.profileId ? `perfil ${t.profileName || `#${t.profileId}`}` : null}
                  preco={t.price_per_kwh}
                  minimo={t.min_price}
                  destrava={t.connection_fee}
                  atualizadoEm={t.created_at}
                  editando={editando?.chave === chave}
                  editPrice={editPrice}
                  setEditPrice={setEditPrice}
                  editMinPrice={editMinPrice}
                  setEditMinPrice={setEditMinPrice}
                  onEditar={() =>
                    editar(
                      chave,
                      { chargePointId: t.charge_point_id, profileId: t.profileId },
                      t.price_per_kwh,
                      t.min_price ?? null
                    )
                  }
                  onCancelar={cancelarEdicao}
                  onSalvar={handleSaveInline}
                  salvando={inlineSubmitting}
                />
              );
            })}
          </ListaDePrecos>
        )}

        {perfisVisiveis.length > 0 && (
          <ListaDePrecos titulo="Preço por perfil de cliente" descricao="vale para os clientes do perfil" rotulo="Perfil">
            {perfisVisiveis.map(t => {
              const chave = `perfil:${t.id}`;
              const local = localDaTarifa(t);
              return (
                <LinhaDePreco
                  key={t.id}
                  icone="badge"
                  titulo={t.profileName || `Perfil #${t.profileId}`}
                  subtitulo={local ? `em ${local}` : 'em toda a rede'}
                  preco={t.price_per_kwh}
                  minimo={t.min_price}
                  destrava={t.connection_fee}
                  atualizadoEm={t.created_at}
                  editando={editando?.chave === chave}
                  editPrice={editPrice}
                  setEditPrice={setEditPrice}
                  editMinPrice={editMinPrice}
                  setEditMinPrice={setEditMinPrice}
                  onEditar={() =>
                    editar(
                      chave,
                      { profileId: t.profileId, locationId: t.location_id, locationAddress: t.location_address },
                      t.price_per_kwh,
                      t.min_price ?? null
                    )
                  }
                  onCancelar={cancelarEdicao}
                  onSalvar={handleSaveInline}
                  salvando={inlineSubmitting}
                />
              );
            })}
          </ListaDePrecos>
        )}
      </div>

      {/* Histórico de alterações — recolhido: a lista acima já mostra o preço atual. */}
      <div className="bg-surface-container-low rounded-xl border border-outline-variant/10 overflow-hidden">
        <div
          className={`px-4 md:px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 ${mostrarHistorico ? 'border-b border-outline-variant/10' : ''}`}
        >
          <button
            type="button"
            onClick={() => setMostrarHistorico(v => !v)}
            aria-expanded={mostrarHistorico}
            className="flex items-center gap-2 text-left"
          >
            <span className="material-symbols-outlined text-on-surface-variant">history</span>
            <h3 className="text-base font-headline font-bold text-on-surface">Histórico de alterações</h3>
            <span className="material-symbols-outlined text-on-surface-variant">
              {mostrarHistorico ? 'expand_less' : 'expand_more'}
            </span>
          </button>
          {mostrarHistorico && (
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
                <SelectItem value="charger" className="text-on-surface focus:bg-surface-container-highest">Por Carregador</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">{filtered.length} registros</span>
          </div>
          )}
        </div>
        {!mostrarHistorico ? null : filtered.length > 0 ? (
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
                        {/* Carregador antes de tudo: sem endereço, a tarifa de
                            carregador aparecia aqui como "Global". */}
                        {tariff.charge_point_id ? (
                          <span className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant">
                            <span className="material-symbols-outlined text-sm text-tertiary">ev_station</span>
                            {tariffScopeLabel(tariff)}
                          </span>
                        ) : tariff.profileId ? (
                          <span className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant">
                            <span className="material-symbols-outlined text-sm text-secondary">badge</span>
                            {tariff.profileName || `Perfil #${tariff.profileId}`}
                          </span>
                        ) : tariff.location_address || tariff.location_id != null ? (
                          <span className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant">
                            <span className="material-symbols-outlined text-sm text-tertiary">location_on</span>
                            {tariffScopeLabel(tariff)}
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
