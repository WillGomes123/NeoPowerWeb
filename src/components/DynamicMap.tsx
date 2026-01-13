import React, { Suspense, lazy } from 'react';

// Componente de loading
const MapLoading = () => (
  <div className="flex items-center justify-center h-full w-full bg-emerald-950/20">
    <p className="text-emerald-400/50 animate-pulse">Carregando mapa...</p>
  </div>
);

// Lazy load do MapWrapper para garantir que só carrega no cliente
const MapWrapperLazy = lazy(() =>
  import('./MapWrapper').then(module => ({
    default: module.MapWrapper,
  }))
);

interface DynamicMapProps {
  center: [number, number];
  zoom: number;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const DynamicMap: React.FC<DynamicMapProps> = props => {
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <MapLoading />;
  }

  return (
    <Suspense fallback={<MapLoading />}>
      <MapWrapperLazy {...props} />
    </Suspense>
  );
};

// Re-exportar componentes do react-leaflet
export { TileLayer, Marker, Popup, useMap } from 'react-leaflet';

// Re-exportar L de leaflet
export { default as L } from 'leaflet';
