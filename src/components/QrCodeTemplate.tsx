import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import NeoPowerIcone from '../assets/neoicon.png';
import { useAuth } from '../lib/auth';
import { linkDePagamento } from '../lib/pagueECarregue';
import { pilhaDeFontes } from '../lib/fonteDaMarca';

/** Marca impressa no adesivo: a do operador dono do carregador. */
export interface MarcaDoAdesivo {
  companyName?: string | null;
  /** Ícone da marca: vai ao lado do nome. */
  logoUri?: string | null;
  /** Logo horizontal de fundo escuro, que já traz o nome: tem a vez e dispensa o nome em texto. */
  logoUriDark?: string | null;
  primaryColor?: string | null;
  // Marca completa (opcionais; sem eles o adesivo é o de sempre).
  /** Faixas, selo e chamada; sem ele, a cor da marca clareada. */
  accentColor?: string | null;
  /** Texto do selo, que fica sobre o destaque. */
  accentTextColor?: string | null;
  /** Fundo do adesivo; sem ele, o grafite de sempre. */
  headerColor?: string | null;
  /** Família do Google Fonts; quem gera o PDF carrega antes (carregarFonteDaMarca). */
  fontFamily?: string | null;
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
const FUNDO_PADRAO = '#111114';
const FONTES_PADRAO = "'Inter', 'Segoe UI', Arial, sans-serif";

/** Cor #RRGGBB válida, ou null. */
function corHex(cor: string | null | undefined): string | null {
  return cor && /^#[0-9a-f]{6}$/i.test(cor.trim()) ? cor.trim() : null;
}

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

/** Cinzas do adesivo de sempre, pensados para o fundo grafite. */
const CINZAS = {
  texto: '#FFFFFF',
  apoio: '#8A8A93', // subtítulo, dicas e rodapés dos QRs
  caixa: '#A6A6B0', // texto da caixa do Pix
  discreto: '#6E6E78', // ID do carregador e rodapé
  tecnico: '#55555E',
  data: '#4A4A52',
  linha: '#26262C',
};

/**
 * Sobre o fundo colorido da marca os cinzas fixos somem: os textos de apoio
 * viram branco com opacidade (ou preto, se o fundo for claro).
 */
function tintasSobre(fundo: string): typeof CINZAS {
  const claro = luminancia(fundo) > 0.45;
  const a = (opacidade: number) => `rgba(${claro ? '0, 0, 0' : '255, 255, 255'}, ${opacidade})`;
  return {
    texto: claro ? FUNDO_PADRAO : '#FFFFFF',
    apoio: a(0.75),
    caixa: a(0.85),
    discreto: a(0.65),
    tecnico: a(0.55),
    data: a(0.5),
    linha: a(0.22),
  };
}

/**
 * Cores, logo e fonte do adesivo. Sem os campos da marca completa sai
 * exatamente o adesivo de sempre: fundo grafite, cinzas fixos e a cor da marca
 * clareada como destaque.
 */
export function visualDoAdesivo(marca: MarcaDoAdesivo | null) {
  const nome = marca?.companyName || 'NeoPower';
  const fundoDaMarca = corHex(marca?.headerColor);
  const destaque = corHex(marca?.accentColor) || corLegivel(marca?.primaryColor || VERDE_NEOPOWER);
  const logoHorizontal = marca?.logoUriDark || null;
  const logo = logoHorizontal || marca?.logoUri || null;
  return {
    nome,
    fundo: fundoDaMarca || FUNDO_PADRAO,
    tintas: fundoDaMarca ? tintasSobre(fundoDaMarca) : CINZAS,
    destaque,
    tintaDoSelo:
      corHex(marca?.accentTextColor) || (luminancia(destaque) > 0.45 ? '#000000' : '#FFFFFF'),
    logo,
    // O ícone da NeoPower só entra no adesivo da NeoPower; outra marca sem
    // logo fica só com o nome.
    imagem: logo || (nome === 'NeoPower' ? NeoPowerIcone : null),
    // O logo horizontal já escreve o nome da marca.
    mostrarNome: !logoHorizontal,
    fontes: pilhaDeFontes(marca?.fontFamily, FONTES_PADRAO),
  };
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
  const { nome, fundo, tintas, destaque, tintaDoSelo, logo, imagem, mostrarNome, fontes } =
    visualDoAdesivo(marca);

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
        backgroundColor: fundo,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: fontes,
        color: tintas.texto,
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
          {imagem && (
            <img
              src={imagem}
              alt=""
              crossOrigin="anonymous"
              style={{ ...base, display: 'block', height: logo ? '56px' : '44px', width: 'auto' }}
            />
          )}
          {mostrarNome && (
            <span
              data-testid="nome-da-marca"
              style={texto(26, 32, { fontWeight: 800, whiteSpace: 'nowrap' })}
            >
              {nome}
            </span>
          )}
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

      <p style={texto(14, 20, { margin: '14px 48px 0', color: tintas.apoio })}>
        Estação de recarga para veículos elétricos
      </p>

      <div
        style={{ ...base, margin: '22px 48px 0', height: '1px', backgroundColor: tintas.linha }}
      />

      {/* Carregador */}
      <div style={{ ...base, textAlign: 'center', marginTop: '30px' }}>
        {page.description && <p style={texto(26, 32, { fontWeight: 800 })}>{page.description}</p>}
        <p style={texto(13, 18, { marginTop: '6px', color: tintas.discreto })}>
          ID {page.chargePointId}
        </p>
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
            <p style={texto(13, 18, { marginTop: '4px', color: tintas.apoio })}>{q.dica}</p>
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
                color: tintas.apoio,
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
          border: `1px solid ${tintas.linha}`,
          borderRadius: '14px',
          textAlign: 'center',
        }}
      >
        <p style={texto(13, 20, { color: tintas.caixa })}>
          <span style={{ color: tintas.texto, fontWeight: 700 }}>Com Pix:</span> encaixe o cabo,
          escolha o valor e pague. A recarga começa sozinha e para quando o valor acaba. O que
          sobrar volta por Pix.
        </p>
      </div>

      {tecnico.length > 0 && (
        <p style={texto(11, 16, { marginTop: '16px', textAlign: 'center', color: tintas.tecnico })}>
          {tecnico.join('  •  ')}
        </p>
      )}

      <div style={{ ...base, flex: 1 }} />

      <div style={{ ...base, margin: '0 48px', height: '1px', backgroundColor: tintas.linha }} />
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
          <p style={texto(10, 14, { color: tintas.discreto, fontWeight: 600 })}>{nome}</p>
          <p style={texto(10, 14, { marginTop: '2px', color: tintas.data })}>
            Gerado em {new Date().toLocaleString('pt-BR')}
          </p>
        </div>
        <p style={texto(11, 14, { color: tintas.discreto, fontWeight: 700 })}>
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
