import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AddLocationForm } from '../components/AddLocationForm';
import { DynamicMap } from '../components/DynamicMap';
import { TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import '../styles/leaflet-custom.css';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { useSocket } from '../lib/hooks/useSocket';
import { MapPin, Plus, Search, Zap, Loader2, ChevronRight, RefreshCw } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';

interface Location {
  id: number;
  nomeDoLocal: string;
  endereco: string;
  cidade: string;
  estado: string;
  latitude: number;
  longitude: number;
  chargePoints?: any[];
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
}

const createIcon = (status: 'online' | 'offline' | 'mixed') => {
  if (!L) return null;
  const colors = { online: '#10b981', offline: '#6b7280', mixed: '#f59e0b' };
  const color = colors[status];
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -12],
  });
};

function ChangeMapView({ center, zoom }: { center: [number, number] | null; zoom: number }) {
  const map = useMap();
  React.useEffect(() => {
    if (center) map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export const Locations = () => {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Location[]>([]);
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [focusedCoords, setFocusedCoords] = useState<[number, number] | null>(null);
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
      };
    });
  }, [chargers, chargerStatuses]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [locationsResponse, chargersResponse] = await Promise.all([
        api.get('/locations/all'),
        api.get('/chargers'),
      ]);
      if (locationsResponse.ok) {
        const locationsData = await locationsResponse.json();
        setLocations(locationsData.locations || []);
      }
      if (chargersResponse.ok) {
        const chargersData = await chargersResponse.json();
        setChargers(chargersData);
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getLocationChargerStats = useCallback((loc: Location) => {
    const locChargers = mergedChargers.filter(c => c.locationId === loc.id);
    const total = loc.chargePoints?.length || locChargers.length;
    const online = locChargers.filter(c => c.isConnected).length;
    return { total, online, offline: total - online };
  }, [mergedChargers]);

  const filteredLocations = useMemo(() => {
    if (!searchQuery) return locations;
    const q = searchQuery.toLowerCase();
    return locations.filter(loc =>
      (loc.nomeDoLocal || '').toLowerCase().includes(q) ||
      (loc.endereco || '').toLowerCase().includes(q) ||
      (loc.cidade || '').toLowerCase().includes(q)
    );
  }, [locations, searchQuery]);

  // Map markers based on locations (not individual chargers)
  const locationMarkers = useMemo(() => {
    return locations
      .filter(loc => loc.latitude && loc.longitude)
      .map(loc => {
        const stats = getLocationChargerStats(loc);
        let status: 'online' | 'offline' | 'mixed' = 'offline';
        if (stats.online > 0 && stats.online === stats.total) status = 'online';
        else if (stats.online > 0) status = 'mixed';
        return { ...loc, status, stats };
      });
  }, [locations, getLocationChargerStats]);

  const handleFocusMap = (loc: Location) => {
    if (loc.latitude && loc.longitude) {
      setFocusedCoords([Number(loc.latitude), Number(loc.longitude)]);
    }
  };

  const handleOpenDetails = (loc: Location) => navigate(`/locais/${loc.id}`);

  const handleAddLocationSuccess = () => {
    setIsAddingLocation(false);
    fetchData();
    toast.success('Local adicionado com sucesso!');
  };

  const mapCenter: [number, number] = focusedCoords || [-14.235, -51.925];
  const mapZoom = focusedCoords ? 16 : 4;

  const totalChargers = locations.reduce((sum, loc) => sum + (loc.chargePoints?.length || 0), 0);
  const totalOnline = mergedChargers.filter(c => c.isConnected).length;

  if (isAddingLocation) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)]">
        <AddLocationForm
          onSuccess={handleAddLocationSuccess}
          onCancel={() => setIsAddingLocation(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <MapPin className="w-7 h-7 text-emerald-400" />
            Locais
          </h1>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-zinc-400 text-sm">{locations.length} locais</span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400 text-sm">{totalChargers} carregadores</span>
            <span className="text-zinc-600">|</span>
            <span className="text-emerald-400 text-sm">{totalOnline} online</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchData()}
            className="p-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-200 transition-all"
            title="Atualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsAddingLocation(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-lg font-medium transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            Adicionar Local
          </button>
        </div>
      </div>

      {/* Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 flex-1 min-h-0">
        {/* List Column */}
        <div className="flex flex-col min-h-0">
          {/* Search */}
          <div className="relative mb-3 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Buscar local..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white pl-9 h-9 text-sm"
            />
          </div>

          {/* Location Cards */}
          <div className="overflow-y-auto flex-1 space-y-2 pr-1">
            {loading && (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
                <p className="text-zinc-500 text-sm">Carregando locais...</p>
              </div>
            )}

            {!loading && filteredLocations.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <MapPin className="w-10 h-10 text-zinc-700 mb-3" />
                <p className="text-zinc-400 font-medium">
                  {searchQuery ? 'Nenhum local encontrado' : 'Nenhum local cadastrado'}
                </p>
                <p className="text-zinc-600 text-sm mt-1">
                  {searchQuery ? 'Tente outro termo de busca' : 'Clique em "Adicionar Local" para começar'}
                </p>
              </div>
            )}

            {!loading && filteredLocations.map(loc => {
              const stats = getLocationChargerStats(loc);
              return (
                <div
                  key={loc.id}
                  className="group bg-zinc-900/80 border border-zinc-800 rounded-lg overflow-hidden hover:border-zinc-600 hover:bg-zinc-800/80 transition-all cursor-pointer"
                  onClick={() => handleOpenDetails(loc)}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors flex-1 mr-2">
                        {loc.nomeDoLocal}
                      </h3>
                      <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 shrink-0 mt-0.5" />
                    </div>
                    <p className="text-xs text-zinc-500 mb-3 line-clamp-1">
                      {loc.endereco}{loc.cidade ? `, ${loc.cidade}` : ''}{loc.estado ? ` - ${loc.estado}` : ''}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-zinc-500" />
                          <span className="text-xs text-zinc-400">{stats.total} carregador{stats.total !== 1 ? 'es' : ''}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {stats.online > 0 && (
                          <Badge variant="outline" className="border-emerald-600/50 text-emerald-400 text-[10px] px-1.5 py-0 h-5">
                            {stats.online} online
                          </Badge>
                        )}
                        {stats.offline > 0 && (
                          <Badge variant="outline" className="border-zinc-700 text-zinc-500 text-[10px] px-1.5 py-0 h-5">
                            {stats.offline} off
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Map focus strip */}
                  {loc.latitude && loc.longitude && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleFocusMap(loc); }}
                      className="w-full py-1.5 bg-zinc-800/50 hover:bg-emerald-600/20 text-zinc-600 hover:text-emerald-400 text-[10px] uppercase tracking-wider font-medium transition-colors border-t border-zinc-800"
                    >
                      Ver no mapa
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Map Column */}
        <div className="rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 min-h-[400px]">
          <DynamicMap center={mapCenter} zoom={mapZoom} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            <ChangeMapView center={focusedCoords} zoom={mapZoom} />

            {locationMarkers.map(loc => {
              const icon = createIcon(loc.status);
              return icon ? (
                <Marker
                  key={loc.id}
                  position={[Number(loc.latitude), Number(loc.longitude)]}
                  icon={icon}
                  eventHandlers={{ click: () => handleOpenDetails(loc) }}
                >
                  <Popup>
                    <div className="text-gray-900 min-w-[180px]">
                      <strong className="block text-sm text-gray-800 mb-1">{loc.nomeDoLocal}</strong>
                      <p className="text-xs text-gray-500 mb-2">
                        {loc.endereco}{loc.cidade ? `, ${loc.cidade}` : ''}
                      </p>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-emerald-600 font-medium">{loc.stats.online} online</span>
                        <span className="text-gray-400">{loc.stats.offline} offline</span>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ) : null;
            })}
          </DynamicMap>
        </div>
      </div>
    </div>
  );
};
