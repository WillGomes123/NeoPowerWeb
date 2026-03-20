import { useQuery } from './useQuery';

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

interface LocationsResponse {
  locations: Location[];
  total: number;
}

/**
 * Fetches all locations. Used across 6+ pages.
 * Single source of truth for location data.
 */
export function useLocations() {
  const { data, loading, error, refetch } = useQuery<LocationsResponse>('/locations/all');
  return {
    locations: data?.locations || [],
    total: data?.total || 0,
    loading,
    error,
    refetch,
  };
}
