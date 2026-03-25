import { useMemo } from 'react';
import { useQuery } from './useQuery';
import { useSocket } from '../lib/hooks/useSocket';

interface Charger {
  charge_point_id: string;
  model?: string;
  vendor?: string;
  description?: string;
  power_kw?: number;
  locationId: number | null;
  isConnected: boolean;
  status?: string;
}

/**
 * Fetches chargers and merges with real-time socket status.
 * Replaces the duplicated merge logic in Stations and Locations pages.
 */
export function useChargers() {
  const { data, loading, error, refetch } = useQuery<Charger[]>('/chargers');
  const { chargerStatuses } = useSocket();

  const chargers = useMemo(() => {
    const list = data || [];
    if (chargerStatuses.size === 0) return list;
    return list.map(charger => {
      const socketStatus = chargerStatuses.get(charger.charge_point_id);
      if (!socketStatus) return charger;
      return {
        ...charger,
        isConnected: socketStatus.status !== 'Offline' && socketStatus.status !== 'Unavailable',
      };
    });
  }, [data, chargerStatuses]);

  return { chargers, loading, error, refetch };
}
