// Types for the NeoPower Dashboard

export type UserRole = 'admin' | 'atem' | 'comum';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  locationIds?: string[];
  branding?: BrandingConfig | null;
}

export interface BrandingConfig {
  clientId: string;
  companyName?: string;
  logoType: 'programmatic' | 'image';
  logoUri?: string;
  logoUriLight?: string;
  logoUriDark?: string;
  primaryColor: string;
  theme?: 'dark' | 'light';
}

export interface Location {
  id: number;
  nomeDoLocal: string;
  endereco: string;
  numero: string;
  cidade: string;
  estado: string;
  cep: string;
  latitude: number;
  longitude: number;
  razaoSocial: string;
  cnpj: string;
  tipoDeNegocio: string;
  tipoDeLocal: string;
  horarioFuncionamento: any;
  nomeResponsavel: string;
  emailResponsavel: string;
  telefoneResponsavel: string;
  chargePoints?: any[];
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

// Meter Values (Charging Curve)
export interface MeterValue {
  timestamp: string;
  power_kw: number;
  current_a?: number;
  voltage_v?: number;
  soc_percent?: number;
  energy_kwh: number;
}

// Alarm Types
export type AlarmSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface Alarm {
  id: string;
  charger_id: string;
  connector_id: number;
  error_code: string;
  severity: AlarmSeverity;
  status: 'active' | 'acknowledged' | 'resolved';
  message: string;
  timestamp: string;
  resolved_at?: string;
  location_name?: string;
}

// Charging Schedule Types
export interface ChargingSchedule {
  id: string;
  charger_id: string;
  connector_id: number;
  schedule_type: 'once' | 'recurring';
  start_time: string;
  end_time?: string;
  days_of_week?: number[];
  max_rate_kw?: number;
  id_tag: string;
  enabled: boolean;
  created_at: string;
  charger_name?: string;
}

// Charging Goal Types
export interface ChargingGoal {
  id: string;
  charger_id: string;
  goal_type: 'energy' | 'cost' | 'time' | 'soc';
  target_value: number;
  enabled: boolean;
  charger_name?: string;
  created_at: string;
}
