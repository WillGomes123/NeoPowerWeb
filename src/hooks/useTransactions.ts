import { useQuery } from './useQuery';

interface Transaction {
  transaction_id: number;
  charge_point_id: string;
  start_timestamp: string;
  stop_timestamp: string | null;
  consumed_wh: number | null;
  total_cost: number | null;
  address: string | null;
  status: string;
}

export function useTransactions() {
  return useQuery<Transaction[]>('/transactions');
}
