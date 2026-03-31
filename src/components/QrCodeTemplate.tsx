import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import NeoPowerLogo from '../assets/NeoPower.png';
import { useAuth } from '../lib/auth';

interface QrCodePageProps {
  chargePointId: string;
  connectorIndex: number;
  totalConnectors: number;
  description?: string;
  model?: string;
  vendor?: string;
  powerKw?: number;
  connectorType?: string;
}

interface QrCodeTemplateProps {
  pages: QrCodePageProps[];
}

function QrCodePage({ page }: { page: QrCodePageProps }) {
  const { user } = useAuth();
  const branding = user?.branding;
  const primaryColor = branding?.primaryColor || '#00FF66';
  const logo = branding?.logoUri || NeoPowerLogo;
  const brandName = branding?.appName || 'NeoPower';

  const qrContent = `${page.chargePointId}:${page.connectorIndex}`;

  const techParts: string[] = [];
  if (page.model) techParts.push(page.model);
  if (page.vendor) techParts.push(page.vendor);
  if (page.powerKw) techParts.push(`${page.powerKw} kW`);
  if (page.connectorType) techParts.push(page.connectorType);

  return (
    <div
      style={{
        width: '794px',
        height: '1123px',
        backgroundColor: '#111114',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Inter', 'Space Grotesk', sans-serif",
      }}
    >
      {/* Top accent line */}
      <div style={{ height: '3px', background: `linear-gradient(90deg, ${primaryColor}, ${primaryColor}88, transparent)` }} />

      {/* Header */}
      <div style={{ padding: '40px 48px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img src={logo} alt="Logo" style={{ height: '40px', objectFit: 'contain' }} />
          <span style={{ color: '#ffffff', fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>{brandName}</span>
        </div>
        <div
          style={{
            backgroundColor: primaryColor,
            color: '#000000',
            padding: '6px 16px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 800,
            letterSpacing: '1px',
          }}
        >
          CONECTOR {page.connectorIndex}
        </div>
      </div>

      {/* Subtitle */}
      <div style={{ padding: '12px 48px 0' }}>
        <span style={{ color: '#666', fontSize: '14px', fontWeight: 500 }}>Estação de Recarga para Veículos Elétricos</span>
      </div>

      {/* Divider */}
      <div style={{ margin: '24px 48px 0', height: '1px', backgroundColor: '#222' }} />

      {/* Charger Info */}
      <div style={{ textAlign: 'center', padding: '32px 48px 0' }}>
        {page.description && (
          <div style={{ color: '#ffffff', fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>
            {page.description}
          </div>
        )}
        <div style={{ color: '#555', fontSize: '13px', fontWeight: 500 }}>
          ID: {page.chargePointId}
        </div>
      </div>

      {/* CTA */}
      <div style={{ textAlign: 'center', padding: '32px 0 0' }}>
        <span style={{ color: primaryColor, fontSize: '20px', fontWeight: 700 }}>
          ⚡ Escaneie para Iniciar a Recarga
        </span>
      </div>

      {/* QR Code Box */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0 0' }}>
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: `0 0 60px ${primaryColor}15, 0 20px 40px rgba(0,0,0,0.4)`,
          }}
        >
          <QRCodeSVG
            value={qrContent}
            size={280}
            level="H"
            fgColor="#111114"
            bgColor="#ffffff"
          />
        </div>
      </div>

      {/* Code reference */}
      <div style={{ textAlign: 'center', padding: '20px 0 0' }}>
        <span
          style={{
            color: '#444',
            fontSize: '12px',
            fontWeight: 600,
            letterSpacing: '2px',
            textTransform: 'uppercase',
          }}
        >
          CÓDIGO: {qrContent}
        </span>
      </div>

      {/* Tech details */}
      {techParts.length > 0 && (
        <div style={{ textAlign: 'center', padding: '8px 0 0' }}>
          <span style={{ color: '#333', fontSize: '11px', fontWeight: 500 }}>
            {techParts.join('  •  ')}
          </span>
        </div>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Footer divider */}
      <div style={{ margin: '0 48px', height: '1px', backgroundColor: '#222' }} />

      {/* Footer */}
      <div style={{ padding: '20px 48px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: '#444', fontSize: '10px', fontWeight: 600 }}>
            {brandName} — Gestão Inteligente de Recarga
          </div>
          <div style={{ color: '#333', fontSize: '10px', marginTop: '4px' }}>
            Gerado em {new Date().toLocaleString('pt-BR')}
          </div>
        </div>
        <div style={{ color: '#555', fontSize: '11px', fontWeight: 700 }}>
          {page.connectorIndex} / {page.totalConnectors}
        </div>
      </div>

      {/* Bottom accent line */}
      <div style={{ height: '3px', background: `linear-gradient(90deg, transparent, ${primaryColor}88, ${primaryColor})` }} />
    </div>
  );
}

export const QrCodeTemplate: React.FC<QrCodeTemplateProps> = ({ pages }) => {
  return (
    <div id="qrcode-report-root">
      {pages.map((page, i) => (
        <QrCodePage key={i} page={page} />
      ))}
    </div>
  );
};
