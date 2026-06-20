import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AddLocationForm } from '../components/AddLocationForm';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { toast } from 'sonner';
import { useSocket } from '../lib/hooks/useSocket';
import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { DynamicMap, TileLayer, Marker, Popup, L } from '../components/DynamicMap';

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
  const [activeTab, setActiveTab] = useState<'map' | 'list'>('map');
  const { chargerStatuses } = useSocket();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

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

  const handleDeleteLocation = async (e: React.MouseEvent, id: number, name: string) => {
    e.stopPropagation();
    if (!window.confirm(`Tem certeza que deseja excluir o local "${name}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      const res = await api.delete(`/locations/${id}`);
      if (res.ok) {
        toast.success('Local excluído com sucesso!');
        fetchData();
      } else {
        const error = await res.json();
        toast.error(error.message || 'Erro ao excluir local');
      }
    } catch (err) {
      toast.error('Erro ao conectar com o servidor');
    }
  };

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
            className="px-8 py-2.5 bg-linear-to-r from-primary to-primary-container text-on-primary rounded-full text-sm font-extrabold flex items-center gap-2 shadow-[0_8px_20px_rgba(57,255,20,0.2)] hover:scale-105 transition-transform active:scale-95"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Novo Local
          </button>
        </div>
      </div>


      {/* Tabs Menu */}
      <div className="flex border-b border-outline-variant/10 gap-6">
        <button
          onClick={() => setActiveTab('map')}
          className={`pb-3 text-sm font-bold tracking-wider uppercase transition-all border-b-2 cursor-pointer ${
            activeTab === 'map'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Visualização em Mapa
        </button>
        <button
          onClick={() => setActiveTab('list')}
          className={`pb-3 text-sm font-bold tracking-wider uppercase transition-all border-b-2 cursor-pointer ${
            activeTab === 'list'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Locais Registrados
        </button>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-12 gap-6">
        {activeTab === 'map' ? (
          /* Interactive Map (Full Width) */
          <div className="col-span-12 relative overflow-hidden rounded-xl border border-outline-variant/10 min-h-[650px]">
            <DynamicMap center={mapCenter} zoom={locations.length > 1 ? 10 : 13} style={{ height: '650px', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://carto.com">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
              />
              {locations.filter(l => l.latitude && l.longitude).map(loc => {
                const stats = getStats(loc);
                return (
                  <Marker
                    key={loc.id}
                    position={[Number(loc.latitude), Number(loc.longitude)]}
                    icon={getMarkerIcon(getLocationMarkerStatus(loc))}
                  >
                    <Popup>
                      <div className="p-1 min-w-[150px] text-foreground">
                        <h4 className="font-headline font-bold text-sm mb-1 text-on-surface">{loc.nomeDoLocal}</h4>
                        <p className="text-xs text-on-surface-variant mb-2">
                          {stats.total} {stats.total === 1 ? 'carregador' : 'carregadores'}
                        </p>
                        <button
                          onClick={() => navigate(`/locais/${loc.id}`)}
                          className="w-full py-1.5 bg-primary text-on-primary text-xs font-bold rounded hover:bg-primary-container transition-colors text-center cursor-pointer"
                        >
                          Ver Detalhes
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </DynamicMap>
            {/* Legend & KPI Overlay */}
            <div className="absolute top-4 right-4 z-1000 flex flex-col gap-2.5 pointer-events-none">
              {/* Legend Card */}
              <div className="glass-card rounded-lg px-4 py-3 border border-zinc-800 bg-zinc-950/90 backdrop-blur-md shadow-2xl">
                <div className="flex flex-col gap-2">
                  {[
                    { color: '#8eff71', label: 'Disponível' },
                    { color: '#88f6ff', label: 'Carregando' },
                    { color: '#ff7351', label: 'Problema' },
                    { color: '#777575', label: 'Offline' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color, boxShadow: `0 0 6px ${item.color}40` }} />
                      <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Small KPI Boxes */}
              <div className="flex flex-col gap-2">
                <div className="glass-card bg-zinc-950/90 backdrop-blur-md border border-zinc-800 px-3 py-2 rounded-lg flex items-center gap-2.5 shadow-2xl">
                  <span className="material-symbols-outlined text-primary text-base">location_on</span>
                  <div>
                    <p className="text-[8px] text-zinc-400 uppercase font-bold tracking-wider leading-none">Locais</p>
                    <p className="text-xs font-headline font-bold text-zinc-100 mt-0.5 leading-none">{locations.length}</p>
                  </div>
                </div>
                <div className="glass-card bg-zinc-950/90 backdrop-blur-md border border-zinc-800 px-3 py-2 rounded-lg flex items-center gap-2.5 shadow-2xl">
                  <span className="material-symbols-outlined text-secondary text-base">ev_station</span>
                  <div>
                    <p className="text-[8px] text-zinc-400 uppercase font-bold tracking-wider leading-none">Carregadores</p>
                    <p className="text-xs font-headline font-bold text-zinc-100 mt-0.5 leading-none">{totalChargers}</p>
                  </div>
                </div>
              </div>
            </div>
            {/* Overlay info */}
            <div className="absolute bottom-0 left-0 right-0 p-6 flex justify-between items-end bg-linear-to-t from-background/90 via-background/50 to-transparent pointer-events-none z-1000">
              <div className="space-y-1">
                <h3 className="text-xl font-headline font-bold">Mapa da Rede</h3>
                <p className="text-on-surface-variant text-sm">
                  {locations.filter(l => l.latitude && l.longitude).length} locais mapeados • {totalChargers} carregadores
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Locations List Section */
          <div className="col-span-12">
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
                      <div className="relative h-36 rounded-t-xl overflow-hidden bg-linear-to-br from-surface-container-highest via-surface-container to-surface-container-low">
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
                          {isAdmin && (
                            <button
                              onClick={(e) => handleDeleteLocation(e, loc.id, loc.nomeDoLocal)}
                              className="p-2 rounded-lg bg-error/10 text-error border border-error/20 hover:bg-error hover:text-on-error transition-all"
                              title="Excluir Local"
                            >
                              <span className="material-symbols-outlined text-lg">delete</span>
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
        )}
      </div>

      {/* Map Dialog */}
      <Dialog open={mapDialogOpen} onOpenChange={setMapDialogOpen}>
        <DialogContent className="bg-surface-container border-outline-variant/20 p-0! overflow-hidden" style={{ maxWidth: '700px', width: '95vw', height: '80vh', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
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
      <div className="fixed top-[-10%] right-[-5%] w-160 h-160 bg-primary/5 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[10%] w-120 h-120 bg-secondary/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
    </div>
  );
};

