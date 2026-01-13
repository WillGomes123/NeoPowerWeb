// Types for the NeoPower Dashboard

export type UserRole = 'admin' | 'atem' | 'comum';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  locationIds?: string[];
}

export interface Location {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  chargerCount: number;
  pricePerKwh: number;
}

export interface Charger {
  id: string;
  model: string;
  serialNumber: string;
  locationId?: string;
  status: 'online' | 'offline' | 'charging';
  power: number;
}

export interface Transaction {
  id: string;
  chargerId: string;
  chargerName: string;
  startTime: string;
  endTime?: string;
  energyKwh: number;
  cost: number;
  status: 'active' | 'completed' | 'failed';
  userId?: string;
}

export interface Voucher {
  id: string;
  code: string;
  name: string;
  type: 'percentage' | 'fixed' | 'kwh';
  value: number;
  validFrom: string;
  validTo: string;
  usageCount: number;
  maxUsage?: number;
  status: 'active' | 'inactive';
}

export interface KPI {
  label: string;
  value: string | number;
  change?: number;
  period?: string;
}

export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

// API Response Types
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
  success?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// OCPP Command Types
export interface OCPPCommand {
  type:
    | 'Reset'
    | 'ChangeAvailability'
    | 'UnlockConnector'
    | 'TriggerMessage'
    | 'RemoteStartTransaction'
    | 'RemoteStopTransaction';
  connectorId?: number;
  resetType?: 'Hard' | 'Soft';
  availabilityType?: 'Operative' | 'Inoperative';
  requestedMessage?: string;
  idTag?: string;
  transactionId?: number;
}

export interface OCPPCommandResponse {
  status: string;
  message?: string;
}

// Location Detail Types
export interface LocationTransaction {
  id: string;
  chargerName: string;
  startTime: string;
  endTime?: string;
  energyKwh: number;
  cost: number;
  status: string;
}

export interface LocationPerformance {
  totalEnergy: number;
  totalRevenue: number;
  averageSessionTime: number;
  utilizationRate: number;
}

// User Management Types
export interface UserFormData {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  locationIds?: string[];
}

// Voucher Form Types
export interface VoucherFormData {
  code: string;
  name: string;
  type: 'percentage' | 'fixed' | 'kwh';
  value: number;
  validFrom: string;
  validTo: string;
  maxUsage?: number;
  status: 'active' | 'inactive';
}

// Overview Stats
export interface OverviewStats {
  totalChargers: number;
  onlineChargers: number;
  chargingChargers: number;
  totalEnergy: number;
  totalRevenue: number;
  revenueGrowth: number;
}

// Financial Report Types
export interface FinancialReportData {
  period: string;
  revenue: number;
  energy: number;
  transactions: number;
  averageValue: number;
}

// Map Types
export interface MapLocation {
  id: string;
  name: string;
  position: [number, number];
  chargerCount: number;
  status: string;
}
