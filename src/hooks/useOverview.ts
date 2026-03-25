import { useState, useCallback } from 'react';
import { useQuery } from './useQuery';

interface OverviewData {
  revenueToday: number;
  revenueMonth: number;
  revenueTotal: number;
  kwhToday: number;
  kwhMonth: number;
  kwhTotal: number;
  transactionsMonth: number;
  transactionsTotal: number;
  totalDepositsGross: number;
  mercadoPagoFee: number;
  totalDepositsNet: number;
  depositsCount: number;
  last7DaysRevenue: { date: string; value: number }[];
  last7DaysKwh: { date: string; value: number }[];
  chargers: { total: number; online: number; offline: number; charging: number };
  activeVouchers?: number;
}

/**
 * Overview stats with optional date filtering.
 */
export function useOverview(startDate: string, endDate: string) {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  const qs = params.toString();
  const endpoint = `/overview-stats${qs ? `?${qs}` : ''}`;

  return useQuery<OverviewData>(endpoint);
}
