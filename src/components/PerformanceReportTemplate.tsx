import React from 'react';
import { useAuth } from '../lib/auth';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend, BarChart, Bar
} from 'recharts';
import NeoPowerLogo from '../assets/NeoPower.png';

interface PerformanceReportTemplateProps {
  data: {
    locationName?: string;
    totalKwh: number;
    sessionsCount: number;
    avgOccupancy: number;
    avgUtilization: number;
    avgAvailability: number;
    chartData: any[]; // { date, occupancy, utilization, availability }
  };
  period: string;
  generationDate: string;
}

export const PerformanceReportTemplate: React.FC<PerformanceReportTemplateProps> = ({ data, period, generationDate }) => {
  const { user } = useAuth();
  const branding = user?.branding;
  const primaryColor = branding?.primaryColor || '#10b981';
  const logo = branding?.logoUri || NeoPowerLogo;

  const ZINC_900 = '#18181b';
  const ZINC_500 = '#71717a';
  const ZINC_400 = '#a1a1aa';
  const ZINC_300 = '#d4d4d8';
  const ZINC_100 = '#f4f4f5';
  const ZINC_50 = '#fafafa';
  
  const EMERALD_500 = '#10b981';
  const BLUE_500 = '#3b82f6';
  const AMBER_500 = '#f59e0b';
  const WHITE = '#ffffff';
  const BLACK = '#000000';

  const SHADOW_SM = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';

  const KPICard = ({ title, value, unit, subtitle }: any) => (
    <div style={{ 
      backgroundColor: WHITE, 
      borderColor: ZINC_100, 
      borderWidth: '1px',
      borderStyle: 'solid',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: SHADOW_SM,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      height: '110px'
    }}>
      <div>
        <h4 style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', color: ZINC_400 }}>{title}</h4>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span style={{ fontSize: '20px', fontWeight: '900', color: ZINC_900 }}>{value}</span>
          {unit && <span style={{ fontSize: '10px', fontWeight: 'bold', color: ZINC_400 }}>{unit}</span>}
        </div>
      </div>
      {subtitle && (
        <div style={{ marginTop: '8px', fontSize: '9px', fontWeight: 'bold', color: ZINC_400 }}>
          {subtitle}
        </div>
      )}
    </div>
  );

  return (
    <div 
      id="performance-report-root" 
      style={{ 
        width: '794px',
        backgroundColor: '#f0f2f5',
        color: ZINC_900,
        fontFamily: 'sans-serif',
        ['--tw-shadow-color' as any]: 'transparent',
        ['--tw-ring-color' as any]: 'transparent',
        ['--tw-outline-color' as any]: 'transparent',
        ['--tw-ring-offset-color' as any]: 'transparent',
        ['--tw-border-color' as any]: 'transparent',
      }}
    >
      {/* PÁGINA 1: CAPA E RESUMO */}
      <section style={{ height: '1123px', width: '794px', position: 'relative', display: 'flex', flexDirection: 'column', padding: '48px', overflow: 'hidden', marginBottom: '1px', backgroundColor: WHITE }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '64px' }}>
          <div style={{ backgroundColor: WHITE, borderRadius: '16px', padding: '16px', border: `1px solid ${ZINC_50}`, boxShadow: SHADOW_SM }}>
            <img src={logo} alt="Logo" style={{ height: '48px', width: 'auto', objectFit: 'contain' }} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ backgroundColor: BLACK, color: WHITE, padding: '6px 24px', borderRadius: '9999px', fontSize: '10px', fontWeight: '900', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '8px' }}>
              Relatório de Performance
            </div>
            <p style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: ZINC_400 }}>Gerado em: {generationDate}</p>
          </div>
        </div>

        <div style={{ marginBottom: '48px' }}>
          <h1 style={{ fontSize: '48px', fontWeight: '900', letterSpacing: '-0.025em', marginBottom: '16px', color: ZINC_900 }}>
            {data.locationName || 'Performance de Local'}
          </h1>
          <p style={{ fontSize: '20px', fontWeight: '500', color: ZINC_500 }}>Período de Análise: <span style={{ fontWeight: 'bold', color: primaryColor }}>{period}</span></p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '48px' }}>
          <KPICard title="Ocupação Média" value={`${data.avgOccupancy}%`} unit="" subtitle="Tempo de uso" />
          <KPICard title="Utilização Diária" value={`${data.avgUtilization}`} unit="kWh" subtitle="Média por dia" color={AMBER_500} />
          <KPICard title="Disponibilidade" value={`${data.avgAvailability}%`} unit="" subtitle="Uptime total" color={BLUE_500} />
          <KPICard title="Energia Total" value={`${data.totalKwh}`} unit="kWh" subtitle="Consumo no período" />
          <KPICard title="Sessões" value={`${data.sessionsCount}`} unit="" subtitle="Recargas totais" />
        </div>

        <div style={{ backgroundColor: WHITE, borderRadius: '16px', padding: '32px', border: `1px solid ${ZINC_100}`, boxShadow: SHADOW_SM, marginBottom: '32px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '32px', color: ZINC_400 }}>Tendência de Ocupação vs Utilização</h3>
          <div style={{ height: '350px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.chartData}>
                <defs>
                  <linearGradient id="colorOcc" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={primaryColor} stopOpacity={0.3}/><stop offset="95%" stopColor={primaryColor} stopOpacity={0}/></linearGradient>
                  <linearGradient id="colorUtil" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={AMBER_500} stopOpacity={0.3}/><stop offset="95%" stopColor={AMBER_500} stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#999', fontSize: 9}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#999', fontSize: 9}} />
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{fontSize: 10, paddingTop: 20}} />
                <Area type="monotone" name="Ocupação (%)" dataKey="occupancy" stroke={primaryColor} strokeWidth={3} fill="url(#colorOcc)" />
                <Area type="monotone" name="Utilização (kWh)" dataKey="utilization" stroke={AMBER_500} strokeWidth={3} fill="url(#colorUtil)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ marginTop: 'auto', borderTop: `1px solid ${ZINC_100}`, paddingTop: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', fontWeight: '900', color: ZINC_300 }}>
           <span style={{ textTransform: 'uppercase', letterSpacing: '0.4em' }}>NeoPower Intelligence System</span>
           <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>PÁGINA 01</span>
           </div>
        </div>
      </section>

      {/* PÁGINA 2: DISPONIBILIDADE E DETALHAMENTO */}
      <section style={{ height: '1123px', width: '794px', position: 'relative', display: 'flex', flexDirection: 'column', padding: '48px', overflow: 'hidden', marginBottom: '1px', backgroundColor: WHITE }}>
        <div style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '8px', color: ZINC_900 }}>Disponibilidade Diária</h2>
          <p style={{ fontSize: '11px', fontWeight: '500', color: ZINC_400 }}>Monitoramento de Uptime dos carregadores no período selecionado.</p>
        </div>

        <div style={{ backgroundColor: WHITE, borderRadius: '16px', padding: '32px', border: `1px solid ${ZINC_100}`, boxShadow: SHADOW_SM, marginBottom: '48px' }}>
          <div style={{ height: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#999', fontSize: 9}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#999', fontSize: 9}} />
                <Tooltip />
                <Bar name="Disponibilidade (%)" dataKey="availability" fill={BLUE_500} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '8px', color: ZINC_900 }}>Histórico Consolidado</h2>
          <p style={{ fontSize: '11px', fontWeight: '500', color: ZINC_400 }}>Dados térmicos e operacionais tabulados por dia.</p>
        </div>

        <div style={{ borderRadius: '16px', overflow: 'hidden', border: `1px solid ${ZINC_100}`, boxShadow: SHADOW_SM, marginBottom: '48px' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: '900', letterSpacing: '0.05em', backgroundColor: ZINC_50, color: ZINC_500 }}>
              <tr>
                <th style={{ padding: '16px 20px' }}>Data</th>
                <th style={{ padding: '16px 20px', textAlign: 'right' }}>Ocupação (%)</th>
                <th style={{ padding: '16px 20px', textAlign: 'right' }}>Utilização (kWh)</th>
                <th style={{ padding: '16px 20px', textAlign: 'right' }}>Disponibilidade (%)</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: '11px', fontWeight: '500', color: ZINC_900 }}>
              {data.chartData.map((row, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${ZINC_100}` }}>
                  <td style={{ padding: '12px 20px', color: ZINC_400 }}>{row.date}</td>
                  <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 'bold', color: row.occupancy > 0 ? primaryColor : ZINC_400 }}>
                    {row.occupancy}%
                  </td>
                  <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 'bold', color: row.utilization > 0 ? AMBER_500 : ZINC_400 }}>
                    {row.utilization} kWh
                  </td>
                  <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: '900', color: row.availability === 100 ? EMERALD_500 : '#f87171' }}>
                    {row.availability}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 'auto', borderTop: `1px solid ${ZINC_100}`, paddingTop: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', fontWeight: '900', color: ZINC_300 }}>
           <span style={{ textTransform: 'uppercase', letterSpacing: '0.4em' }}>NeoPower Intelligence System</span>
           <span style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>PÁGINA 02</span>
        </div>
      </section>
    </div>
  );
};
