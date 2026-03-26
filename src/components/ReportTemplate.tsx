import React from 'react';
import { useAuth } from '../lib/auth';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend
} from 'recharts';
import NeoPowerLogo from '../assets/NeoPower.png';

interface ReportTemplateProps {
  data: {
    locationName?: string;
    totalKwh: number;
    totalRevenue: number;
    totalFees: number;
    netReceived: number;
    totalPayout: number;
    sessionsCount: number;
    walletDeposits: number;
    walletWithdrawals: number;
    chartData?: any[];
    financialTableData?: any[];
  };
  period: string;
  generationDate: string;
}

export const ReportTemplate: React.FC<ReportTemplateProps> = ({ data, period, generationDate }) => {
  const { user } = useAuth();
  const branding = user?.branding;
  const primaryColor = branding?.primaryColor || '#10b981';
  const logo = branding?.logoUri || NeoPowerLogo;

  const ZINC_900 = '#18181b';
  const ZINC_500 = '#71717a';
  const ZINC_400 = '#a1a1aa';
  const ZINC_300 = '#d4d4d8';
  
  const EMERALD_500 = '#10b981';
  const EMERALD_400 = '#34d399';
  const EMERALD_50 = '#ecfdf5';
  
  const RED_400 = '#f87171';
  const RED_50 = '#fef2f2';
  
  const AMBER_500 = '#f59e0b';
  const AMBER_400 = '#fbbf24';

  const SHADOW_SM = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
  const SHADOW_2XL = '0 25px 50px -12px rgba(0, 0, 0, 0.25)';

  const KPICard = ({ title, value, unit, subtitle, color = primaryColor }: any) => (
    <div className="rounded-xl p-5 border flex flex-col justify-between h-36" style={{ backgroundColor: '#ffffff', borderColor: '#f4f4f5', boxShadow: SHADOW_SM }}>
      <div>
        <h4 className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: ZINC_400 }}>{title}</h4>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-black" style={{ color: ZINC_900 }}>{value}</span>
          {unit && <span className="text-xs font-bold" style={{ color: ZINC_400 }}>{unit}</span>}
        </div>
      </div>
      {subtitle && (
        <div className="mt-2 text-[10px] font-bold" style={{ color }}>
          {subtitle}
        </div>
      )}
    </div>
  );

  return (
    <div 
      id="report-root" 
      className="p-0 m-0 print:m-0" 
      style={{ 
        width: '794px',
        backgroundColor: '#f0f2f5',
        // Manual reset of Tailwind v4 variables that might evaluate to OKLCH
        ['--tw-shadow-color' as any]: 'transparent',
        ['--tw-ring-color' as any]: 'transparent',
        ['--tw-outline-color' as any]: 'transparent',
        ['--tw-ring-offset-color' as any]: 'transparent',
      }}
    >
      {/* PAGE 1: COVER */}
      <section className="h-[1123px] w-[794px] relative flex flex-col items-center justify-center overflow-hidden mb-px" style={{ backgroundColor: '#ffffff' }}>
        <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none">
          <div className="absolute -top-20 -left-20 w-[600px] h-[600px] rounded-full blur-[100px]" style={{ backgroundColor: primaryColor }}></div>
          <div className="absolute top-1/2 -right-20 w-[400px] h-[400px] rounded-full blur-[80px]" style={{ backgroundColor: primaryColor }}></div>
        </div>

        <div className="z-10 flex flex-col items-center text-center px-16">
          <div className="rounded-2xl p-6 mb-16 border" style={{ backgroundColor: '#ffffff', borderColor: '#fafafa', boxShadow: SHADOW_2XL }}>
            <img src={logo} alt="Logo" className="h-20 w-auto object-contain" />
          </div>
          
          <div className="px-8 py-2.5 rounded-full text-xs font-black tracking-[0.3em] uppercase mb-10" style={{ backgroundColor: '#000000', color: '#ffffff' }}>
            Relatório Financeiro
          </div>

          <h1 className="text-6xl font-black leading-[1.1] mb-12 tracking-tight" style={{ color: ZINC_900 }}>
            {data.locationName || 'Painel Operacional'}
          </h1>

          <div className="h-[2px] w-24 mb-12 opacity-30" style={{ backgroundColor: primaryColor }}></div>

          <div className="space-y-3 font-semibold" style={{ color: ZINC_500 }}>
            <p className="text-xl">Período: <span className="font-bold" style={{ color: ZINC_900 }}>{period}</span></p>
            <p className="text-lg">Data de Geração: <span className="font-bold" style={{ color: ZINC_900 }}>{generationDate}</span></p>
          </div>
        </div>

        <div className="absolute bottom-16 flex items-center gap-4 font-black uppercase tracking-[0.4em] text-[10px]" style={{ color: ZINC_300 }}>
          <div className="w-12 h-[2px] opacity-40" style={{ backgroundColor: primaryColor }}></div>
          NeoPower Billing Intelligence
        </div>
      </section>

      {/* PAGE 2: PERFORMANCE FINANCEIRA */}
      <section className="h-[1123px] w-[794px] p-10 flex flex-col mb-px" style={{ backgroundColor: '#f8f9fa' }}>
        <div className="flex justify-between items-start mb-8">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="h-8 w-auto opacity-40" style={{ filter: 'grayscale(100%)' }} />
            <div className="h-4 w-px" style={{ backgroundColor: ZINC_300 }}></div>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: ZINC_400 }}>Financeiro {period}</span>
          </div>
          <div className="rounded-full px-4 py-2 border" style={{ backgroundColor: '#ffffff', borderColor: '#e4e4e7', boxShadow: SHADOW_SM }}>
             <span className="text-[10px] font-black uppercase" style={{ color: primaryColor }}>OPERACIONAL</span>
          </div>
        </div>

        <h2 className="text-2xl font-black mb-6 flex items-center gap-3" style={{ color: ZINC_900 }}>
          Resumo de Recargas
          <div className="h-[4px] w-12 rounded-full" style={{ backgroundColor: primaryColor }}></div>
        </h2>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <KPICard title="Receita Bruta" value={`R$ ${data.totalRevenue.toFixed(2)}`} unit="" subtitle="Total faturado" />
          <KPICard title="Total de Taxas" value={`R$ ${data.totalFees.toFixed(2)}`} unit="" subtitle="Moove + Cartão + Imposto" color="#f87171" />
          <KPICard title="Valor Recebido" value={`R$ ${data.netReceived.toFixed(2)}`} unit="" subtitle="Líquido Platarforma" color="#34d399" />
          <KPICard title="Pago ao Cliente" value={`R$ ${data.totalPayout.toFixed(2)}`} unit="" subtitle="Investidores" />
        </div>

        <div className="rounded-2xl p-6 border flex-1 flex flex-col mb-8" style={{ backgroundColor: '#ffffff', borderColor: '#f4f4f5', boxShadow: SHADOW_SM }}>
          <h3 className="text-xs font-black uppercase tracking-widest mb-6" style={{ color: ZINC_400 }}>Receita vs Taxas por Período</h3>
          <div className="flex-1 w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.chartData || []}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={primaryColor} stopOpacity={0.3}/><stop offset="95%" stopColor={primaryColor} stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#999', fontSize: 9}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#999', fontSize: 9}} />
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{fontSize: 10, paddingTop: 20}} />
                <Area type="monotone" name="Receita" dataKey="revenue" stroke={primaryColor} strokeWidth={2} fill="url(#colorRev)" />
                <Area type="monotone" name="Taxas" dataKey="fees" stroke="#f87171" strokeWidth={2} fill="#fee2e2" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <h2 className="text-2xl font-black mb-6 flex items-center gap-3" style={{ color: ZINC_900 }}>
          Carteiras e Depósitos
          <div className="h-[4px] w-12 rounded-full" style={{ backgroundColor: '#6366f1' }}></div>
        </h2>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="rounded-2xl p-6 border flex items-center justify-between" style={{ backgroundColor: '#ffffff', borderColor: '#f4f4f5', boxShadow: SHADOW_SM }}>
            <div>
              <p className="text-[10px] font-bold uppercase mb-1" style={{ color: ZINC_400 }}>Total de Depósitos</p>
              <p className="text-2xl font-black" style={{ color: EMERALD_500 }}>R$ {data.walletDeposits.toFixed(2)}</p>
            </div>
            <div className="p-3 rounded-full font-black text-xs" style={{ backgroundColor: EMERALD_50, color: EMERALD_500 }}>WALLET</div>
          </div>
          <div className="rounded-2xl p-6 border flex items-center justify-between" style={{ backgroundColor: '#ffffff', borderColor: '#f4f4f5', boxShadow: SHADOW_SM }}>
            <div>
              <p className="text-[10px] font-bold uppercase mb-1" style={{ color: ZINC_400 }}>Total de Saídas</p>
              <p className="text-2xl font-black" style={{ color: RED_400 }}>R$ {data.walletWithdrawals.toFixed(2)}</p>
            </div>
            <div className="p-3 rounded-full font-black text-xs" style={{ backgroundColor: RED_50, color: RED_400 }}>OUTFLOW</div>
          </div>
        </div>

        <div className="mt-auto border-t pt-6 flex justify-between items-center text-[9px] font-bold" style={{ borderColor: '#f4f4f5', color: ZINC_300 }}>
           <span className="uppercase tracking-[0.3em]">NeoPower Financial System</span>
           <span>PÁGINA 02</span>
        </div>
      </section>

      {/* PAGE 3: DETALHAMENTO */}
      <section className="h-[1123px] w-[794px] p-10 flex flex-col mb-px" style={{ backgroundColor: '#f8f9fa' }}>
        <h2 className="text-2xl font-black mb-6 flex items-center gap-3" style={{ color: ZINC_900 }}>
          Extrato Detalhado
          <div className="h-[4px] w-12 rounded-full" style={{ backgroundColor: primaryColor }}></div>
        </h2>

        <div className="rounded-2xl overflow-hidden border" style={{ backgroundColor: '#ffffff', borderColor: '#f4f4f5', boxShadow: SHADOW_SM }}>
          <table className="w-full text-left">
            <thead className="text-[10px] uppercase font-black tracking-wider" style={{ backgroundColor: '#fafafa', color: ZINC_500 }}>
              <tr>
                <th className="px-5 py-4">Data</th>
                <th className="px-5 py-4">Estação</th>
                <th className="px-5 py-4 text-right">kWh</th>
                <th className="px-5 py-4 text-right">Receita</th>
                <th className="px-5 py-4 text-right">Taxas</th>
                <th className="px-5 py-4 text-right">Líquido</th>
              </tr>
            </thead>
            <tbody className="text-[11px] font-medium" style={{ color: ZINC_900 }}>
              {data.financialTableData?.slice(0, 15).map((row, i) => (
                <tr key={i} className="border-t" style={{ borderColor: '#f4f4f5' }}>
                  <td className="px-5 py-3 whitespace-nowrap" style={{ color: ZINC_400 }}>{row.date}</td>
                  <td className="px-5 py-3">{row.charger}</td>
                  <td className="px-5 py-3 text-right font-mono" style={{ color: AMBER_500 }}>{row.kwh}</td>
                  <td className="px-5 py-3 text-right font-bold">R$ {row.revenue}</td>
                  <td className="px-5 py-3 text-right" style={{ color: RED_400 }}>R$ {row.fees}</td>
                  <td className="px-5 py-3 text-right font-black" style={{ color: EMERALD_500 }}>R$ {row.net}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-4 text-[10px] font-bold text-center uppercase tracking-widest" style={{ backgroundColor: '#f9fafb', color: ZINC_400 }}>
            {data.financialTableData && data.financialTableData.length > 15 
              ? `Exibindo 15 de ${data.financialTableData.length} transações recentes` 
              : `Total de ${data.financialTableData?.length || 0} transações`}
          </div>
        </div>

        <div className="mt-10 rounded-2xl p-8 text-white relative overflow-hidden" style={{ backgroundColor: '#18181b' }}>
           <div className="absolute top-0 right-0 w-32 h-32 opacity-20 blur-3xl rounded-full translate-x-10 -translate-y-10" style={{ backgroundColor: primaryColor }}></div>
           <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-2" style={{ color: ZINC_500 }}>Conclusão do Período</p>
           <h4 className="text-xl font-bold mb-4">Operação Financeira Saudável</h4>
           <div className="grid grid-cols-2 gap-8 border-t pt-6" style={{ borderColor: '#27272a' }}>
              <div>
                 <p className="text-[9px] font-bold uppercase mb-1" style={{ color: ZINC_500 }}>Média de Receita por kWh</p>
                 <p className="text-lg font-black" style={{ color: EMERALD_400 }}>R$ {(data.totalRevenue / (data.totalKwh || 1)).toFixed(2)}</p>
              </div>
              <div>
                 <p className="text-[9px] font-bold uppercase mb-1" style={{ color: ZINC_500 }}>Sessões Processadas</p>
                 <p className="text-lg font-black" style={{ color: AMBER_400 }}>{data.sessionsCount}</p>
              </div>
           </div>
        </div>

        <div className="mt-auto border-t pt-6 flex justify-between items-center text-[9px] font-bold" style={{ borderColor: '#f4f4f5', color: ZINC_300 }}>
           <span className="uppercase tracking-[0.3em]">NeoPower Intelligence System</span>
           <span>PÁGINA 03</span>
        </div>
      </section>
    </div>
  );
};
