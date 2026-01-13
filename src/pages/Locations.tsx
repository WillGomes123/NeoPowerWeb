import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AddLocationForm } from '../components/AddLocationForm';
import { DynamicMap } from '../components/DynamicMap';
import { TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import '../styles/leaflet-custom.css';
import { api } from '../lib/api';
import { toast } from 'sonner';

// Tipos
interface Location {
  location_id: number;
  name: string;
  address: string;
  cidade: string;
  estado: string;
  latitude: number;
  longitude: number;
  charger_count?: number;
}

interface Charger {
  charge_point_id: string;
  address: string;
  latitude: number;
  longitude: number;
  isConnected: boolean;
}

// Ícones personalizados para o mapa
const createIcon = (status: 'online' | 'offline' | 'charging') => {
  if (!L) return null;

  let colorClass = 'pin-offline';
  if (status === 'online') colorClass = 'pin-online';
  if (status === 'charging') colorClass = 'pin-charging';

  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="pin ${colorClass}"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
  });
};

// Componente para mudar a view do mapa
function ChangeMapView({ center, zoom }: { center: [number, number] | null; zoom: number }) {
  const map = useMap();

  React.useEffect(() => {
    if (center) {
      map.setView(center, zoom);
    }
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

  // Buscar dados
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Buscar locais
      const locationsResponse = await api.get('/locations');
      if (locationsResponse.ok) {
        const locationsData = await locationsResponse.json();
        setLocations(locationsData);
      }

      // Buscar carregadores
      const chargersResponse = await api.get('/chargers');
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Ações
  const handleFocusMap = (loc: Location) => {
    if (loc.latitude && loc.longitude) {
      setFocusedCoords([loc.latitude, loc.longitude]);
    }
  };

  const handleOpenDetails = (loc: Location) => {
    navigate(`/locais/${loc.location_id}`);
  };

  const handleAddLocationSuccess = () => {
    setIsAddingLocation(false);
    fetchData();
    toast.success('Local adicionado com sucesso!');
  };

  const handleCancelAddLocation = () => {
    setIsAddingLocation(false);
  };

  // Configuração do mapa
  const mapCenter: [number, number] = focusedCoords || [-14.235, -51.925];
  const mapZoom = focusedCoords ? 16 : 4;

  // Se está adicionando local, renderiza o formulário inline
  if (isAddingLocation) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)]">
        <AddLocationForm
          onSuccess={handleAddLocationSuccess}
          onCancel={handleCancelAddLocation}
        />
      </div>
    );
  }

  // Renderiza a listagem normal de locais
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)]">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-emerald-50 flex items-center gap-3">
            <svg
              className="w-8 h-8 text-emerald-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Locais
          </h1>
          <p className="text-emerald-300/60 mt-1">Gerencie os locais dos eletropostos</p>
        </div>
        <button
          onClick={() => setIsAddingLocation(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg shadow-emerald-900/30 hover:shadow-emerald-900/50"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Adicionar Local
        </button>
      </div>

      {/* Layout de Mapa e Lista - Responsivo */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(300px,350px)_1fr] gap-6 flex-1 min-h-0">
        {/* Coluna da Lista */}
        <div className={`overflow-y-auto pr-2 custom-scrollbar ${locations.length === 0 || loading ? 'flex' : 'space-y-3'}`}>
          {loading && (
            <div className="flex flex-col items-center justify-center h-full w-full py-10 bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border border-emerald-800/30 rounded-lg">
              <div className="inline-block w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-emerald-300">Carregando locais...</p>
            </div>
          )}

          {!loading && locations.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full w-full py-16 bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border border-emerald-800/30 rounded-lg">
              <svg
                className="w-10 h-10 text-emerald-500/30 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <p className="text-lg text-emerald-300 font-semibold">Nenhum local cadastrado</p>
              <p className="text-sm text-emerald-400/60 mt-1">Clique em "Adicionar Local" para começar</p>
            </div>
          )}

          {locations.map(loc => (
            <div
              key={loc.location_id}
              className="group flex bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border border-emerald-800/30 rounded-lg overflow-hidden hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-900/20 transition-all duration-300 backdrop-blur-sm"
            >
              {/* Área clicável do card */}
              <button
                onClick={() => handleOpenDetails(loc)}
                className="flex-1 p-5 text-left hover:bg-emerald-800/10 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-bold text-emerald-50 group-hover:text-emerald-400 transition-colors">
                    {loc.name}
                  </h3>
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">
                    {loc.cidade}/{loc.estado}
                  </span>
                </div>
                <p className="text-sm text-emerald-300/70 mb-4 line-clamp-2">{loc.address}</p>
                <div className="flex items-center gap-2 text-emerald-300">
                  <svg
                    className="w-5 h-5 text-emerald-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  <span className="text-sm font-semibold">
                    {loc.charger_count || 0} Carregador{(loc.charger_count || 0) !== 1 ? 'es' : ''}
                  </span>
                </div>
              </button>

              {/* Botão do mapa */}
              <button
                onClick={() => handleFocusMap(loc)}
                className="w-14 bg-emerald-900/30 hover:bg-emerald-600 text-emerald-400 hover:text-white flex items-center justify-center transition-all duration-300 border-l border-emerald-800/30"
                title="Ver no mapa"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Coluna do Mapa */}
        <div className="rounded-lg overflow-hidden border border-emerald-800/30 shadow-2xl shadow-emerald-900/20 bg-gradient-to-br from-zinc-900 to-zinc-800 min-h-[400px]">
          <DynamicMap center={mapCenter} zoom={mapZoom} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />

            <ChangeMapView center={focusedCoords} zoom={mapZoom} />

            {/* Markers dos carregadores */}
            {chargers
              .filter(c => c.latitude && c.longitude)
              .map(charger => {
                const icon = createIcon(charger.isConnected ? 'online' : 'offline');
                return icon ? (
                  <Marker
                    key={charger.charge_point_id}
                    position={[charger.latitude, charger.longitude]}
                    icon={icon}
                  >
                    <Popup>
                      <div className="text-gray-900 p-2">
                        <strong className="block mb-2 text-lg text-emerald-700">
                          {charger.charge_point_id}
                        </strong>
                        <p className="text-sm text-gray-700 mb-2">{charger.address}</p>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block w-2 h-2 rounded-full ${charger.isConnected ? 'bg-green-500' : 'bg-gray-400'}`}
                          ></span>
                          <span
                            className={`text-xs font-semibold ${charger.isConnected ? 'text-green-600' : 'text-gray-500'}`}
                          >
                            {charger.isConnected ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ) : null;
              })}
          </DynamicMap>
        </div>
      </div>

      {/* Estilos dos pins do mapa */}
      <style>{`
        .pin {
          width: 24px;
          height: 24px;
          border-radius: 50% 50% 50% 0;
          position: absolute;
          transform: rotate(-45deg);
          border: 4px solid #ffffff;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.4);
        }

        .pin-online {
          background-color: #10b981;
          border-color: #10b981;
        }

        .pin-offline {
          background-color: #6b7280;
          border-color: #6b7280;
        }

        .pin-charging {
          background-color: #3b82f6;
          border-color: #3b82f6;
        }

        .custom-div-icon {
          background: transparent;
          border: none;
        }
      `}</style>
    </div>
  );
};
