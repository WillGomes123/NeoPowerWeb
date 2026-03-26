import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AddLocationForm } from '../components/AddLocationForm';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { useSocket } from '../lib/hooks/useSocket';
import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { DynamicMap, TileLayer, Marker, L } from '../components/DynamicMap';

interface Location {
  id: number;
  nomeDoLocal: string;
  endereco: string;
  numero?: string;
  cidade: string;
  estado: string;
  latitude: number;
  longitude: number;
  chargePoints?: any[];
  imageUrl?: string;
}

interface Charger {
  charge_point_id: string;
  description?: string;
  model?: string;
  address: string;
  latitude: number;
  longitude: number;
  isConnected: boolean;
  locationId?: number;
  ocppStatus?: string; // Available, Charging, Faulted, Preparing, etc.
}

export const Locations = () => {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Location[]>([]);
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [mapDialogLocation, setMapDialogLocation] = useState<Location | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { chargerStatuses } = useSocket();

  const mergedChargers = useMemo(() => {
    if (chargerStatuses.size === 0) return chargers;
    return chargers.map(charger => {
      const socketStatus = chargerStatuses.get(charger.charge_point_id);
      if (!socketStatus) return charger;
      return {
        ...charger,
        isConnected: socketStatus.status !== 'Offline' && socketStatus.status !== 'Unavailable',
        ocppStatus: socketStatus.status || 'Offline',
      };
    });
  }, [chargers, chargerStatuses]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [locRes, chRes] = await Promise.all([api.get('/locations/all'), api.get('/chargers')]);
      if (locRes.ok) { const d = await locRes.json(); setLocations(d.locations || []); }
      if (chRes.ok) { const d = await chRes.json(); setChargers(d); }
    } catch { toast.error('Erro ao carregar dados'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getStats = useCallback((loc: Location) => {
    const locChargers = mergedChargers.filter(c => c.locationId === loc.id);
    const total = loc.chargePoints?.length || locChargers.length;
    const available = locChargers.filter(c => c.ocppStatus === 'Available').length;
    const charging = locChargers.filter(c => c.ocppStatus === 'Charging').length;
    const faulted = locChargers.filter(c => c.ocppStatus === 'Faulted' || c.ocppStatus === 'Unavailable').length;
    const offline = total - available - charging - faulted;
    return { total, available, charging, faulted, offline };
  }, [mergedChargers]);

  const filtered = useMemo(() => {
    if (!searchQuery) return locations;
    const q = searchQuery.toLowerCase();
    return locations.filter(loc =>
      (loc.nomeDoLocal || '').toLowerCase().includes(q) ||
      (loc.endereco || '').toLowerCase().includes(q) ||
      (loc.cidade || '').toLowerCase().includes(q)
    );
  }, [locations, searchQuery]);

  const totalChargers = locations.reduce((s, l) => s + (l.chargePoints?.length || 0), 0);
  const totalAvailable = mergedChargers.filter(c => c.ocppStatus === 'Available').length;
  const totalCharging = mergedChargers.filter(c => c.ocppStatus === 'Charging').length;
  const totalOnline = totalAvailable + totalCharging;
  const networkHealth = totalChargers > 0 ? (totalOnline / totalChargers * 100) : 0;

  // Map center: average of all location coordinates, or default to Manaus
  const mapCenter = useMemo<[number, number]>(() => {
    const withCoords = locations.filter(l => l.latitude && l.longitude);
    if (withCoords.length === 0) return [-3.119, -60.0217]; // Manaus
    const avgLat = withCoords.reduce((s, l) => s + Number(l.latitude), 0) / withCoords.length;
    const avgLng = withCoords.reduce((s, l) => s + Number(l.longitude), 0) / withCoords.length;
    return [avgLat, avgLng];
  }, [locations]);

  // Status-colored marker icons
  const getMarkerIcon = useCallback((status: 'available' | 'charging' | 'faulted' | 'offline') => {
    if (typeof L === 'undefined') return undefined;
    const colors = {
      available: { bg: '#8eff71', glow: 'rgba(142,255,113,0.6)' },
      charging: { bg: '#88f6ff', glow: 'rgba(136,246,255,0.6)' },
      faulted: { bg: '#ff7351', glow: 'rgba(255,115,81,0.6)' },
      offline: { bg: '#777575', glow: 'rgba(119,117,117,0.3)' },
    };
    const c = colors[status];
    return L.divIcon({
      className: '',
      html: `<div style="width:26px;height:26px;background:${c.bg};border-radius:50%;border:3px solid #1a1919;box-shadow:0 0 10px ${c.glow};display:flex;align-items:center;justify-content:center">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="#0e0e0e"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>
      </div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
  }, []);

  // Determine dominant status for a location's marker on the main map
  const getLocationMarkerStatus = useCallback((loc: Location): 'available' | 'charging' | 'faulted' | 'offline' => {
    const locChargers = mergedChargers.filter(c => c.locationId === loc.id);
    if (locChargers.length === 0) return 'offline';
    if (locChargers.some(c => c.ocppStatus === 'Charging')) return 'charging';
    if (locChargers.some(c => c.ocppStatus === 'Faulted')) return 'faulted';
    if (locChargers.some(c => c.isConnected)) return 'available';
    return 'offline';
  }, [mergedChargers]);

  if (isAddingLocation) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)]">
        <AddLocationForm
          onSuccess={() => { setIsAddingLocation(false); fetchData(); toast.success('Local adicionado!'); }}
          onCancel={() => setIsAddingLocation(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-[0.3em] text-primary font-bold">NETWORK OVERVIEW</span>
          <h2 className="text-4xl font-headline font-bold tracking-tight text-on-surface">Locais</h2>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => fetchData()}
            className="px-6 py-2.5 bg-surface-container-highest text-on-surface rounded-full text-sm font-bold flex items-center gap-2 border border-outline-variant/15 hover:bg-surface-bright transition-colors"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
            Atualizar
          </button>
          <button
            onClick={() => setIsAddingLocation(true)}
            className="px-8 py-2.5 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-full text-sm font-extrabold flex items-center gap-2 shadow-[0_8px_20px_rgba(57,255,20,0.2)] hover:scale-105 transition-transform active:scale-95"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Novo Local
          </button>
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-12 gap-6">
        {/* Interactive Map */}
        <div className="col-span-12 lg:col-span-8 relative overflow-hidden rounded-xl border border-outline-variant/10 min-h-[380px]">
          <DynamicMap center={mapCenter} zoom={locations.length > 1 ? 10 : 13} style={{ height: '100%', width: '100%', minHeight: '380px' }}>
            <TileLayer
              attribution='&copy; <a href="https://carto.com">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
            />
            {locations.filter(l => l.latitude && l.longitude).map(loc => (
                <Marker
                  key={loc.id}
                  position={[Number(loc.latitude), Number(loc.longitude)]}
                  icon={getMarkerIcon(getLocationMarkerStatus(loc))}
                  eventHandlers={{ click: () => navigate(`/locais/${loc.id}`) }}
                />
            ))}
          </DynamicMap>
          {/* Legend */}
          <div className="absolute top-4 right-4 z-[1000] glass-card rounded-lg px-4 py-3 pointer-events-none border border-outline-variant/10">
            <div className="flex flex-col gap-2">
              {[
                { color: '#8eff71', label: 'Disponível' },
                { color: '#88f6ff', label: 'Carregando' },
                { color: '#ff7351', label: 'Problema' },
                { color: '#777575', label: 'Offline' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color, boxShadow: `0 0 6px ${item.color}40` }} />
                  <span className="text-[10px] text-on-surface-variant font-medium uppercase tracking-wider">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Overlay info */}
          <div className="absolute bottom-0 left-0 right-0 p-6 flex justify-between items-end bg-gradient-to-t from-[#0e0e0e]/90 via-[#0e0e0e]/50 to-transparent pointer-events-none z-[1000]">
            <div className="space-y-1">
              <h3 className="text-xl font-headline font-bold">Mapa da Rede</h3>
              <p className="text-on-surface-variant text-sm">
                {locations.filter(l => l.latitude && l.longitude).length} locais mapeados • {totalChargers} carregadores
              </p>
            </div>
          </div>
        </div>

        {/* Stats Sidebar */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          <div className="glass-card p-6 rounded-xl border border-outline-variant/10 flex flex-col justify-between h-1/2">
            <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-medium">Network Health</span>
            <div className="mt-4 flex items-end justify-between">
              <div className="text-5xl font-headline font-bold text-primary">{networkHealth.toFixed(1)}<span className="text-xl">%</span></div>
              <div className="text-right">
                <span className="text-xs text-secondary font-medium">{totalOnline} online</span>
              </div>
            </div>
            <div className="mt-4 w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
              <div className="bg-primary h-full rounded-full shadow-[0_0_8px_rgba(57,255,20,0.4)]" style={{ width: `${networkHealth}%` }} />
            </div>
          </div>
          <div className="glass-card p-6 rounded-xl border border-outline-variant/10 flex flex-col justify-between h-1/2">
            <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-medium">Total Locais</span>
            <div className="mt-4 flex items-end justify-between">
              <div className="text-5xl font-headline font-bold text-on-surface">{locations.length}</div>
              <div className="flex -space-x-3">
                <div className="w-8 h-8 rounded-full border-2 border-surface bg-primary" />
                <div className="w-8 h-8 rounded-full border-2 border-surface bg-secondary" />
                <div className="w-8 h-8 rounded-full border-2 border-surface bg-tertiary" />
              </div>
            </div>
            <p className="mt-4 text-xs text-on-surface-variant">{totalChargers} carregadores registrados</p>
          </div>
        </div>

        {/* Locations List Section */}
        <div className="col-span-12 mt-4">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-xl font-headline font-bold">Todos os Locais</h4>
            {/* Search */}
            <div className="relative w-64 group">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
              <input
                className="w-full bg-surface-container-low border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-1 focus:ring-primary/50 placeholder:text-on-surface-variant/50 transition-all outline-none text-on-surface"
                placeholder="Buscar locais..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3" />
              <p className="text-sm text-on-surface-variant">Carregando locais...</p>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16">
              <span className="material-symbols-outlined text-4xl text-outline mb-3">location_off</span>
              <p className="text-on-surface-variant font-medium">
                {searchQuery ? 'Nenhum local encontrado' : 'Nenhum local cadastrado'}
              </p>
              <p className="text-outline text-sm mt-1">
                {searchQuery ? 'Tente outro termo de busca' : 'Clique em "Novo Local" para começar'}
              </p>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtered.map(loc => {
                const stats = getStats(loc);
                const occupancy = stats.total > 0 ? Math.round((stats.available / stats.total) * 100) : 0;
                return (
                  <div
                    key={loc.id}
                    className="glass-card rounded-xl border border-outline-variant/10 hover:border-primary/30 transition-all duration-300 group cursor-pointer"
                    onClick={() => navigate(`/locais/${loc.id}`)}
                  >
                    {/* Card Header with image or gradient */}
                    <div className="relative h-36 rounded-t-xl overflow-hidden bg-gradient-to-br from-surface-container-highest via-surface-container to-surface-container-low">
                      {loc.imageUrl ? (
                        <img src={loc.imageUrl} alt={loc.nomeDoLocal} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="material-symbols-outlined text-6xl text-outline-variant/20 group-hover:text-primary/20 transition-colors">location_on</span>
                        </div>
                      )}
                      <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-surface-container-highest/80 backdrop-blur-md border border-outline-variant/20 text-[10px] font-bold uppercase">
                        {stats.available > 0 ? (
                          <span className="text-primary flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />Active
                          </span>
                        ) : (
                          <span className="text-on-surface-variant">Offline</span>
                        )}
                      </div>
                    </div>

                    <div className="p-6">
                      <div className="mb-4">
                        <h5 className="text-lg font-bold font-headline truncate group-hover:text-primary transition-colors">{loc.nomeDoLocal}</h5>
                        <p className="text-sm text-on-surface-variant truncate">
                          {loc.endereco}{loc.numero ? `, ${loc.numero}` : ''}{loc.cidade ? ` • ${loc.cidade}` : ''}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 py-4 border-y border-outline-variant/10">
                        <div>
                          <span className="text-[10px] uppercase text-on-surface-variant block mb-1">Carregadores</span>
                          <span className="text-xl font-headline font-bold">{String(stats.total).padStart(2, '0')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-on-surface-variant block mb-1">Ocupação</span>
                          <span className={`text-xl font-headline font-bold ${
                            occupancy >= 80 ? 'text-primary' : occupancy >= 40 ? 'text-secondary' : occupancy > 0 ? 'text-error' : 'text-on-surface-variant'
                          }`}>{occupancy}%</span>
                        </div>
                      </div>

                      <div className="mt-6 flex gap-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/locais/${loc.id}`); }}
                          className="flex-1 py-2 rounded-lg bg-surface-container-highest text-sm font-bold border border-outline-variant/10 hover:bg-surface-bright transition-colors"
                        >
                          Detalhes
                        </button>
                        {loc.latitude && loc.longitude && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setMapDialogLocation(loc); setMapDialogOpen(true); }}
                            className="flex-1 py-2 rounded-lg bg-primary/10 text-primary text-sm font-bold border border-primary/20 hover:bg-primary hover:text-on-primary transition-all"
                          >
                            Ver Mapa
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Map Dialog */}
      <Dialog open={mapDialogOpen} onOpenChange={setMapDialogOpen}>
        <DialogContent className="bg-surface-container border-outline-variant/20 !p-0 overflow-hidden" style={{ maxWidth: '700px', width: '95vw', height: '80vh', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
          <VisuallyHidden><DialogTitle>Mapa do Local</DialogTitle></VisuallyHidden>
          {mapDialogLocation && (
            <>
              <div className="p-4 border-b border-outline-variant/10 shrink-0">
                <h3 className="text-on-surface font-bold font-headline flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">location_on</span>
                  {mapDialogLocation.nomeDoLocal}
                </h3>
                <p className="text-on-surface-variant text-sm mt-0.5">
                  {mapDialogLocation.endereco}{mapDialogLocation.cidade ? `, ${mapDialogLocation.cidade}` : ''}{mapDialogLocation.estado ? ` - ${mapDialogLocation.estado}` : ''}
                </p>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <DynamicMap
                  center={[Number(mapDialogLocation.latitude), Number(mapDialogLocation.longitude)]}
                  zoom={16}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://carto.com">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  />
                  <Marker
                    position={[Number(mapDialogLocation.latitude), Number(mapDialogLocation.longitude)]}
                    icon={getMarkerIcon(getLocationMarkerStatus(mapDialogLocation))}
                  />
                </DynamicMap>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Background decorative glows */}
      <div className="fixed top-[-10%] right-[-5%] w-[40rem] h-[40rem] bg-primary/5 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[10%] w-[30rem] h-[30rem] bg-secondary/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
    </div>
  );
};

