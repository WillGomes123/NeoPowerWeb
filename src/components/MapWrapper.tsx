import React, { useEffect, useState } from 'react';
import 'leaflet/dist/leaflet.css';

// Exportações de tipo apenas
export type { Map as LeafletMap } from 'leaflet';

interface MapWrapperProps {
  center: [number, number];
  zoom: number;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const MapWrapper: React.FC<MapWrapperProps> = ({
  center,
  zoom,
  children,
  className = '',
  style = { height: '100%', width: '100%' },
}) => {
  const [Map, setMap] = useState<React.ComponentType<{
    center: [number, number];
    zoom: number;
    scrollWheelZoom: boolean;
    style: React.CSSProperties;
    className: string;
    children: React.ReactNode;
  }> | null>(null);

  useEffect(() => {
    // Importação dinâmica apenas no cliente
    void import('react-leaflet').then(module => {
      setMap(() => module.MapContainer);
    });
  }, []);

  if (!Map) {
    return (
      <div
        style={style}
        className={`flex items-center justify-center bg-emerald-950/20 ${className}`}
      >
        <p className="text-emerald-400/50 animate-pulse">Carregando mapa...</p>
      </div>
    );
  }

  return (
    <Map center={center} zoom={zoom} scrollWheelZoom={true} style={style} className={className}>
      {children}
    </Map>
  );
};

// Re-exportações para componentes filhos
export { TileLayer, Marker, Popup, useMap } from 'react-leaflet';
export { default as L } from 'leaflet';
