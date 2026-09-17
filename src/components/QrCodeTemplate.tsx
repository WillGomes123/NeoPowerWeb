import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import NeoPowerIcone from '../assets/neoicon.png';
import { useAuth } from '../lib/auth';
import { linkDePagamento } from '../lib/pagueECarregue';

/** Marca impressa no adesivo: a do operador dono do carregador. */
export interface MarcaDoAdesivo {
  companyName?: string | null;
  logoUri?: string | null;
  primaryColor?: string | null;
}

interface QrCodePageProps {
  chargePointId: string;
  connectorIndex: number;
  totalConnectors: number;
  description?: string;
  model?: string;
  vendor?: string;
  powerKw?: number;
  connectorType?: string;
  /** Sem marca, usa a do usuário logado (e, na falta, a NeoPower). */
  marca?: MarcaDoAdesivo | null;
}

interface QrCodeTemplateProps {
  pages: QrCodePageProps[];
}

const VERDE_NEOPOWER = '#00FF66';

/** Luminância relativa (0 a 1) de uma cor #rrggbb. */
function luminancia(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  const canal = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}

/** Clareia a cor da marca até ficar legível sobre o fundo escuro do adesivo. */
function corLegivel(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return VERDE_NEOPOWER;
  let cor = parseInt(m[1], 16);
  for (let i = 0; i < 6 && luminancia(`#${cor.toString(16).padStart(6, '0')}`) < 0.25; i++) {
    const r = (cor >> 16) & 255;
    const g = (cor >> 8) & 255;
    const b = cor & 255;
    const clarear = (c: number) => Math.round(c + (255 - c) * 0.3);
    cor = (clarear(r) << 16) | (clarear(g) << 8) | clarear(b);
  }
  return `#${cor.toString(16).padStart(6, '0')}`;
}

// O PDF é gerado pelo html2canvas, que ignora parte do CSS (object-fit, altura
// de linha "normal") e herda o box-sizing do Tailwind. Por isso tudo aqui tem
// medida explícita: largura com borda, altura de linha em px e caixas fixas.
const base: React.CSSProperties = { boxSizing: 'border-box', margin: 0 };
const texto = (
  tamanho: number,
  altura: number,
  extra: React.CSSProperties = {}
): React.CSSProperties => ({
  ...base,
  fontSize: `${tamanho}px`,
  lineHeight: `${altura}px`,
  ...extra,
});

function QrCodePage({ page }: { page: QrCodePageProps }) {
  const { user } = useAuth();
  const marca = page.marca ?? user?.branding ?? null;
  const logo = marca?.logoUri || null;
  const nome = marca?.companyName || 'NeoPower';
  const destaque = corLegivel(marca?.primaryColor || VERDE_NEOPOWER);
  const tintaDoSelo = luminancia(destaque) > 0.45 ? '#000000' : '#FFFFFF';

  // Dois QRs: o do app (texto ID:conector, lido pelo leitor do app) e o do
  // Pix (link da página pague e carregue, aberto pela câmera do celular).
  const qrApp = `${page.chargePointId}:${page.connectorIndex}`;
  const qrPix = linkDePagamento(page.chargePointId, page.connectorIndex);

  const tecnico = [
    page.model,
    page.vendor,
    page.powerKw ? `${page.powerKw} kW` : null,
    page.connectorType,
  ].filter(Boolean);

  const codigos = [
    {
      titulo: `Pelo app ${nome}`,
      dica: 'Abra o app e toque em Escanear',
      valor: qrApp,
      rodape: `Código ${qrApp}`,
    },
    {
      titulo: 'Sem app, com Pix',
      dica: 'Aponte a câmera do celular',
      valor: qrPix,
      rodape: 'Pague e carregue, sem cadastro',
    },
  ];

  return (
    <div
      style={{
        ...base,
        width: '794px',
        height: '1123px',
        backgroundColor: '#111114',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
        color: '#FFFFFF',
      }}
    >
      <div style={{ ...base, height: '4px', backgroundColor: destaque }} />

      {/* Cabeçalho: marca e conector */}
      <div
        style={{
          ...base,
          height: '56px',
          margin: '40px 48px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{ ...base, display: 'flex', alignItems: 'center', gap: '14px', height: '56px' }}
        >
          <img
            src={logo || NeoPowerIcone}
            alt=""
            crossOrigin="anonymous"
            style={{ ...base, display: 'block', height: logo ? '56px' : '44px', width: 'auto' }}
          />
          <span style={texto(26, 32, { fontWeight: 800, whiteSpace: 'nowrap' })}>{nome}</span>
        </div>
        <div
          style={texto(13, 32, {
            height: '32px',
            padding: '0 18px',
            borderRadius: '16px',
            backgroundColor: destaque,
            color: tintaDoSelo,
            fontWeight: 800,
            letterSpacing: '1px',
            whiteSpace: 'nowrap',
          })}
        >
          CONECTOR {page.connectorIndex}
        </div>
      </div>

      <p style={texto(14, 20, { margin: '14px 48px 0', color: '#8A8A93' })}>
        Estação de recarga para veículos elétricos
      </p>

      <div style={{ ...base, margin: '22px 48px 0', height: '1px', backgroundColor: '#26262C' }} />

      {/* Carregador */}
      <div style={{ ...base, textAlign: 'center', marginTop: '30px' }}>
        {page.description && <p style={texto(26, 32, { fontWeight: 800 })}>{page.description}</p>}
        <p style={texto(13, 18, { marginTop: '6px', color: '#6E6E78' })}>ID {page.chargePointId}</p>
      </div>

      <p
        style={texto(24, 30, {
          marginTop: '28px',
          textAlign: 'center',
          color: destaque,
          fontWeight: 800,
        })}
      >
        Escaneie para carregar
      </p>

      {/* QR codes */}
      <div
        style={{
          ...base,
          display: 'flex',
          justifyContent: 'center',
          gap: '28px',
          marginTop: '22px',
        }}
      >
        {codigos.map(q => (
          <div key={q.titulo} style={{ ...base, width: '335px', textAlign: 'center' }}>
            <p style={texto(19, 24, { fontWeight: 800 })}>{q.titulo}</p>
            <p style={texto(13, 18, { marginTop: '4px', color: '#8A8A93' })}>{q.dica}</p>
            <div
              style={{
                ...base,
                width: '320px',
                height: '320px',
                margin: '14px auto 0',
                padding: '20px',
                backgroundColor: '#FFFFFF',
                borderRadius: '18px',
              }}
            >
              <QRCodeSVG
                value={q.valor}
                size={280}
                level="H"
                fgColor="#111114"
                bgColor="#FFFFFF"
                style={{ display: 'block', width: '280px', height: '280px' }}
              />
            </div>
            <p
              style={texto(11, 16, {
                marginTop: '12px',
                color: '#8A8A93',
                fontWeight: 700,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
              })}
            >
              {q.rodape}
            </p>
          </div>
        ))}
      </div>

      {/* Como funciona o Pix */}
      <div
        style={{
          ...base,
          margin: '30px 48px 0',
          padding: '16px 24px',
          border: '1px solid #26262C',
          borderRadius: '14px',
          textAlign: 'center',
        }}
      >
        <p style={texto(13, 20, { color: '#A6A6B0' })}>
          <span style={{ color: '#FFFFFF', fontWeight: 700 }}>Com Pix:</span> encaixe o cabo,
          escolha o valor e pague. A recarga começa sozinha e para quando o valor acaba. O que
          sobrar volta por Pix.
        </p>
      </div>

      {tecnico.length > 0 && (
        <p style={texto(11, 16, { marginTop: '16px', textAlign: 'center', color: '#55555E' })}>
          {tecnico.join('  •  ')}
        </p>
      )}

      <div style={{ ...base, flex: 1 }} />

      <div style={{ ...base, margin: '0 48px', height: '1px', backgroundColor: '#26262C' }} />
      <div
        style={{
          ...base,
          height: '64px',
          padding: '0 48px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <p style={texto(10, 14, { color: '#6E6E78', fontWeight: 600 })}>{nome}</p>
          <p style={texto(10, 14, { marginTop: '2px', color: '#4A4A52' })}>
            Gerado em {new Date().toLocaleString('pt-BR')}
          </p>
        </div>
        <p style={texto(11, 14, { color: '#6E6E78', fontWeight: 700 })}>
          {page.connectorIndex} / {page.totalConnectors}
        </p>
      </div>
      <div style={{ ...base, height: '4px', backgroundColor: destaque }} />
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
