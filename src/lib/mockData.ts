import { Location, Charger, Transaction, Voucher, User, ChartDataPoint } from '../types';

// Mock Users
export const mockUsers: User[] = [
  {
    id: '1',
    name: 'Admin User',
    email: 'admin@neopower.com',
    role: 'admin',
  },
  {
    id: '2',
    name: 'João Silva',
    email: 'joao@example.com',
    role: 'comum',
    locationIds: ['1', '2'],
  },
  {
    id: '3',
    name: 'Maria Santos',
    email: 'maria@example.com',
    role: 'atem',
    locationIds: ['3'],
  },
];

// Mock Locations
export const mockLocations: Location[] = [
  {
    id: '1',
    name: 'Shopping Center Norte',
    address: 'Av. Paulista, 1000 - São Paulo, SP',
    lat: -23.561414,
    lng: -46.655881,
    chargerCount: 4,
    pricePerKwh: 0.85,
  },
  {
    id: '2',
    name: 'Estacionamento Sul',
    address: 'Rua Augusta, 500 - São Paulo, SP',
    lat: -23.565,
    lng: -46.652,
    chargerCount: 2,
    pricePerKwh: 0.92,
  },
  {
    id: '3',
    name: 'Centro Empresarial',
    address: 'Av. Faria Lima, 2000 - São Paulo, SP',
    lat: -23.575,
    lng: -46.682,
    chargerCount: 6,
    pricePerKwh: 0.88,
  },
  {
    id: '4',
    name: 'Parque das Nações',
    address: 'Rua da Consolação, 100 - São Paulo, SP',
    lat: -23.545,
    lng: -46.665,
    chargerCount: 3,
    pricePerKwh: 0.8,
  },
];

// Mock Chargers
export const mockChargers: Charger[] = [
  // Assigned chargers
  {
    id: 'CHG001',
    model: 'NeoPower Pro 22kW',
    serialNumber: 'NP-22-001',
    locationId: '1',
    status: 'online',
    power: 22,
  },
  {
    id: 'CHG002',
    model: 'NeoPower Pro 22kW',
    serialNumber: 'NP-22-002',
    locationId: '1',
    status: 'charging',
    power: 22,
  },
  {
    id: 'CHG003',
    model: 'NeoPower Fast 50kW',
    serialNumber: 'NP-50-001',
    locationId: '1',
    status: 'online',
    power: 50,
  },
  {
    id: 'CHG004',
    model: 'NeoPower Pro 22kW',
    serialNumber: 'NP-22-003',
    locationId: '1',
    status: 'offline',
    power: 22,
  },
  {
    id: 'CHG005',
    model: 'NeoPower Pro 22kW',
    serialNumber: 'NP-22-004',
    locationId: '2',
    status: 'online',
    power: 22,
  },
  {
    id: 'CHG006',
    model: 'NeoPower Fast 50kW',
    serialNumber: 'NP-50-002',
    locationId: '2',
    status: 'charging',
    power: 50,
  },
  {
    id: 'CHG007',
    model: 'NeoPower Pro 22kW',
    serialNumber: 'NP-22-005',
    locationId: '3',
    status: 'online',
    power: 22,
  },
  {
    id: 'CHG008',
    model: 'NeoPower Fast 50kW',
    serialNumber: 'NP-50-003',
    locationId: '3',
    status: 'online',
    power: 50,
  },
  {
    id: 'CHG009',
    model: 'NeoPower Ultra 150kW',
    serialNumber: 'NP-150-001',
    locationId: '3',
    status: 'charging',
    power: 150,
  },
  {
    id: 'CHG010',
    model: 'NeoPower Pro 22kW',
    serialNumber: 'NP-22-006',
    locationId: '3',
    status: 'online',
    power: 22,
  },
  {
    id: 'CHG011',
    model: 'NeoPower Fast 50kW',
    serialNumber: 'NP-50-004',
    locationId: '3',
    status: 'offline',
    power: 50,
  },
  {
    id: 'CHG012',
    model: 'NeoPower Pro 22kW',
    serialNumber: 'NP-22-007',
    locationId: '3',
    status: 'online',
    power: 22,
  },
  {
    id: 'CHG013',
    model: 'NeoPower Pro 22kW',
    serialNumber: 'NP-22-008',
    locationId: '4',
    status: 'online',
    power: 22,
  },
  {
    id: 'CHG014',
    model: 'NeoPower Fast 50kW',
    serialNumber: 'NP-50-005',
    locationId: '4',
    status: 'online',
    power: 50,
  },
  {
    id: 'CHG015',
    model: 'NeoPower Pro 22kW',
    serialNumber: 'NP-22-009',
    locationId: '4',
    status: 'charging',
    power: 22,
  },
  // Pending chargers
  {
    id: 'CHG016',
    model: 'NeoPower Pro 22kW',
    serialNumber: 'NP-22-010',
    status: 'offline',
    power: 22,
  },
  {
    id: 'CHG017',
    model: 'NeoPower Fast 50kW',
    serialNumber: 'NP-50-006',
    status: 'offline',
    power: 50,
  },
  {
    id: 'CHG018',
    model: 'NeoPower Ultra 150kW',
    serialNumber: 'NP-150-002',
    status: 'offline',
    power: 150,
  },
];

// Mock Transactions
export const mockTransactions: Transaction[] = [
  {
    id: 'TXN001',
    chargerId: 'CHG001',
    chargerName: 'Shopping Center Norte - CHG001',
    startTime: '2025-11-03T08:30:00',
    endTime: '2025-11-03T10:15:00',
    energyKwh: 18.5,
    cost: 15.73,
    status: 'completed',
  },
  {
    id: 'TXN002',
    chargerId: 'CHG002',
    chargerName: 'Shopping Center Norte - CHG002',
    startTime: '2025-11-03T09:00:00',
    energyKwh: 12.3,
    cost: 10.46,
    status: 'active',
  },
  {
    id: 'TXN003',
    chargerId: 'CHG003',
    chargerName: 'Shopping Center Norte - CHG003',
    startTime: '2025-11-03T07:45:00',
    endTime: '2025-11-03T08:30:00',
    energyKwh: 25.7,
    cost: 21.85,
    status: 'completed',
  },
  {
    id: 'TXN004',
    chargerId: 'CHG005',
    chargerName: 'Estacionamento Sul - CHG005',
    startTime: '2025-11-03T06:00:00',
    endTime: '2025-11-03T08:20:00',
    energyKwh: 32.4,
    cost: 29.81,
    status: 'completed',
  },
  {
    id: 'TXN005',
    chargerId: 'CHG006',
    chargerName: 'Estacionamento Sul - CHG006',
    startTime: '2025-11-03T10:30:00',
    energyKwh: 8.2,
    cost: 7.54,
    status: 'active',
  },
  {
    id: 'TXN006',
    chargerId: 'CHG007',
    chargerName: 'Centro Empresarial - CHG007',
    startTime: '2025-11-02T15:00:00',
    endTime: '2025-11-02T17:30:00',
    energyKwh: 28.9,
    cost: 25.43,
    status: 'completed',
  },
  {
    id: 'TXN007',
    chargerId: 'CHG008',
    chargerName: 'Centro Empresarial - CHG008',
    startTime: '2025-11-02T14:20:00',
    endTime: '2025-11-02T16:00:00',
    energyKwh: 35.6,
    cost: 31.33,
    status: 'completed',
  },
  {
    id: 'TXN008',
    chargerId: 'CHG009',
    chargerName: 'Centro Empresarial - CHG009',
    startTime: '2025-11-02T11:00:00',
    endTime: '2025-11-02T11:45:00',
    energyKwh: 62.3,
    cost: 54.82,
    status: 'completed',
  },
];

// Mock Vouchers
export const mockVouchers: Voucher[] = [
  {
    id: 'VCH001',
    code: 'WELCOME2025',
    name: 'Desconto de Boas-Vindas',
    type: 'percentage',
    value: 15,
    validFrom: '2025-01-01',
    validTo: '2025-12-31',
    usageCount: 45,
    maxUsage: 100,
    status: 'active',
  },
  {
    id: 'VCH002',
    code: 'ENERGIA10',
    name: '10 kWh Grátis',
    type: 'kwh',
    value: 10,
    validFrom: '2025-11-01',
    validTo: '2025-11-30',
    usageCount: 12,
    maxUsage: 50,
    status: 'active',
  },
  {
    id: 'VCH003',
    code: 'PROMO5REAIS',
    name: 'R$ 5 de Desconto',
    type: 'fixed',
    value: 5,
    validFrom: '2025-10-01',
    validTo: '2025-10-31',
    usageCount: 28,
    maxUsage: 30,
    status: 'inactive',
  },
];

// Chart data for last 7 days
export const revenueChartData: ChartDataPoint[] = [
  { date: '28/10', value: 1240.5 },
  { date: '29/10', value: 1580.3 },
  { date: '30/10', value: 1420.75 },
  { date: '31/10', value: 1890.2 },
  { date: '01/11', value: 1670.4 },
  { date: '02/11', value: 2120.6 },
  { date: '03/11', value: 1850.9 },
];

export const energyChartData: ChartDataPoint[] = [
  { date: '28/10', value: 1450 },
  { date: '29/10', value: 1820 },
  { date: '30/10', value: 1680 },
  { date: '31/10', value: 2240 },
  { date: '01/11', value: 1920 },
  { date: '02/11', value: 2480 },
  { date: '03/11', value: 2180 },
];

// Get charger status counts
export const getChargerStatusCounts = () => {
  const online = mockChargers.filter(c => c.locationId && c.status === 'online').length;
  const offline = mockChargers.filter(c => c.locationId && c.status === 'offline').length;
  const charging = mockChargers.filter(c => c.locationId && c.status === 'charging').length;

  return { online, offline, charging };
};

// Calculate daily revenue
export const calculateDailyRevenue = () => {
  const today = new Date().toISOString().split('T')[0];
  const todayTransactions = mockTransactions.filter(t => t.startTime.startsWith(today));
  return todayTransactions.reduce((sum, t) => sum + t.cost, 0);
};

// Calculate monthly revenue
export const calculateMonthlyRevenue = () => {
  const currentMonth = new Date().getMonth();
  const monthlyTransactions = mockTransactions.filter(t => {
    const txMonth = new Date(t.startTime).getMonth();
    return txMonth === currentMonth;
  });
  return monthlyTransactions.reduce((sum, t) => sum + t.cost, 0);
};

// Calculate daily energy
export const calculateDailyEnergy = () => {
  const today = new Date().toISOString().split('T')[0];
  const todayTransactions = mockTransactions.filter(t => t.startTime.startsWith(today));
  return todayTransactions.reduce((sum, t) => sum + t.energyKwh, 0);
};

// Calculate monthly energy
export const calculateMonthlyEnergy = () => {
  const currentMonth = new Date().getMonth();
  const monthlyTransactions = mockTransactions.filter(t => {
    const txMonth = new Date(t.startTime).getMonth();
    return txMonth === currentMonth;
  });
  return monthlyTransactions.reduce((sum, t) => sum + t.energyKwh, 0);
};
