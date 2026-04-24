import React from 'react';
import { useAuth } from '../lib/auth';
import NeoPowerLogo from '../assets/NeoPower.png';

interface WalletsReportTemplateProps {
  data: {
    walletsCount: number;
    totalBalance: number;
    totalDeposits: number;
    totalCharges: number;
    activeTab: 'wallets' | 'transactions';
    wallets: any[];
    transactions: any[];
  };
  generationDate: string;
}

export const WalletsReportTemplate: React.FC<WalletsReportTemplateProps> = ({ data, generationDate }) => {
  const { user } = useAuth();
  const branding = user?.branding;
  const primaryColor = branding?.primaryColor || '#10b981';
  const logo = branding?.logoUriLight || branding?.logoUri || NeoPowerLogo;

  const ZINC_900 = '#18181b';
  const ZINC_500 = '#71717a';
  const ZINC_400 = '#a1a1aa';
  const ZINC_100 = '#f4f4f5';
  const ZINC_50 = '#fafafa';
  
  const WHITE = '#ffffff';
  const BLACK = '#000000';
  const ERROR = '#ef4444';

  const SHADOW_SM = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatDateTime = (iso: string) => {
    if (!iso) return '---';
    return new Date(iso).toLocaleString('pt-BR');
  };

  const KPICard = ({ title, value, unit, subtitle, color = ZINC_900 }: any) => (
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
          <span style={{ fontSize: '20px', fontWeight: '900', color: color }}>{value}</span>
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

  const getTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      deposit: 'Depósito',
      withdrawal: 'Saque',
      charge: 'Cobrança',
      refund: 'Reembolso',
    };
    return labels[type] || type;
  };

  return (
    <div 
      id="wallets-report-root" 
      style={{ 
        width: '794px',
        backgroundColor: '#f0f2f5',
        color: ZINC_900,
        fontFamily: 'sans-serif',
      }}
    >
      <section style={{ width: '794px', minHeight: '1123px', position: 'relative', display: 'flex', flexDirection: 'column', padding: '48px', backgroundColor: WHITE }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
          <div style={{ backgroundColor: WHITE, borderRadius: '16px', padding: '16px', border: `1px solid ${ZINC_50}`, boxShadow: SHADOW_SM }}>
            <img src={logo} alt="Logo" style={{ height: '48px', width: 'auto', objectFit: 'contain' }} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ backgroundColor: BLACK, color: WHITE, padding: '6px 24px', borderRadius: '9999px', fontSize: '10px', fontWeight: '900', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '8px' }}>
              Relatório de Carteiras Digitais
            </div>
            <p style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: ZINC_400 }}>Gerado em: {generationDate}</p>
          </div>
        </div>

        {/* Title */}
        <div style={{ marginBottom: '40px', borderLeft: `4px solid ${primaryColor}`, paddingLeft: '16px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '900', letterSpacing: '-0.02em', marginBottom: '8px', color: ZINC_900 }}>
            {data.activeTab === 'wallets' ? 'Carteiras dos Usuários' : 'Histórico de Transações'}
          </h1>
          <p style={{ fontSize: '14px', fontWeight: '500', color: ZINC_500 }}>
            Visualização consolidada de {data.activeTab === 'wallets' ? 'saldos e cadastros' : 'movimentações financeiras'}
          </p>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '40px' }}>
          <KPICard title="Saldo Total" value={formatCurrency(data.totalBalance)} subtitle={`${data.walletsCount} carteiras`} color={primaryColor} />
          <KPICard title="Total Depósitos" value={formatCurrency(data.totalDeposits)} color={primaryColor} />
          <KPICard title="Total Cobrado" value={formatCurrency(data.totalCharges)} color={ERROR} />
        </div>

        {/* Table */}
        <div style={{ backgroundColor: WHITE, borderRadius: '12px', border: `1px solid ${ZINC_100}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
            <thead style={{ backgroundColor: '#f8fafc', borderBottom: `2px solid ${ZINC_100}` }}>
              {data.activeTab === 'wallets' ? (
                <tr>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold', color: ZINC_500, textTransform: 'uppercase', fontSize: '9px' }}>ID</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold', color: ZINC_500, textTransform: 'uppercase', fontSize: '9px' }}>Usuário</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold', color: ZINC_500, textTransform: 'uppercase', fontSize: '9px' }}>Email</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold', color: ZINC_500, textTransform: 'uppercase', fontSize: '9px' }}>Saldo</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold', color: ZINC_500, textTransform: 'uppercase', fontSize: '9px' }}>Atualização</th>
                </tr>
              ) : (
                <tr>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold', color: ZINC_500, textTransform: 'uppercase', fontSize: '9px' }}>Data</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold', color: ZINC_500, textTransform: 'uppercase', fontSize: '9px' }}>Usuário</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold', color: ZINC_500, textTransform: 'uppercase', fontSize: '9px' }}>Tipo</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold', color: ZINC_500, textTransform: 'uppercase', fontSize: '9px' }}>Valor</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold', color: ZINC_500, textTransform: 'uppercase', fontSize: '9px' }}>Descrição</th>
                </tr>
              )}
            </thead>
            <tbody>
              {data.activeTab === 'wallets' ? (
                data.wallets.map((w, idx) => (
                  <tr key={idx} style={{ borderBottom: `1px solid ${ZINC_100}`, backgroundColor: idx % 2 === 0 ? WHITE : '#fafafa' }}>
                    <td style={{ padding: '12px 16px', color: ZINC_500 }}>#{w.id}</td>
                    <td style={{ padding: '12px 16px', fontWeight: '600', color: ZINC_900 }}>{w.userName}</td>
                    <td style={{ padding: '12px 16px', color: ZINC_500 }}>{w.userEmail}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 'bold', color: w.balance > 0 ? primaryColor : ZINC_500 }}>{formatCurrency(w.balance)}</td>
                    <td style={{ padding: '12px 16px', color: ZINC_500 }}>{formatDateTime(w.updatedAt)}</td>
                  </tr>
                ))
              ) : (
                data.transactions.map((tx, idx) => {
                  const isPositive = tx.type === 'deposit' || tx.type === 'refund';
                  const sign = isPositive ? '+' : '-';
                  return (
                    <tr key={idx} style={{ borderBottom: `1px solid ${ZINC_100}`, backgroundColor: idx % 2 === 0 ? WHITE : '#fafafa' }}>
                      <td style={{ padding: '12px 16px', color: ZINC_500 }}>{formatDateTime(tx.createdAt)}</td>
                      <td style={{ padding: '12px 16px', fontWeight: '600', color: ZINC_900 }}>{tx.userName}</td>
                      <td style={{ padding: '12px 16px', color: ZINC_500 }}>{getTypeLabel(tx.type)}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 'bold', color: isPositive ? primaryColor : ERROR }}>{sign}{formatCurrency(tx.amount)}</td>
                      <td style={{ padding: '12px 16px', color: ZINC_500, maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.description || '---'}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
