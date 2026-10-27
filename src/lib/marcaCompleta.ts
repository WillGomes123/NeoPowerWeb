/**
 * Campos da "marca completa" no White Label: paleta (destaque, texto sobre o
 * destaque, cabeçalho e selos de status), símbolo, fonte, suporte e
 * documentos. Todos opcionais: vazio vai como null e a marca segue com o
 * padrão de antes (a cor primária em tudo, o contato e os textos da
 * plataforma).
 */
import type { CoresDeStatus } from '../types';

export interface CamposDaMarcaCompleta {
  accentColor: string | null;
  accentTextColor: string | null;
  headerColor: string | null;
  statusColors: CoresDeStatus | null;
  symbolUri: string | null;
  fontFamily: string | null;
  supportWhatsapp: string | null;
  supportEmail: string | null;
  termsUrl: string | null;
  privacyUrl: string | null;
}

/** Selos de status do app, na ordem em que aparecem no formulário. */
export const STATUS_DA_MARCA = [
  { chave: 'available', rotulo: 'Disponível' },
  { chave: 'charging', rotulo: 'Carregando' },
  { chave: 'busy', rotulo: 'Ocupado' },
  { chave: 'offline', rotulo: 'Offline' },
] as const;

// Mesmos formatos que a API aceita.
export const COR_HEX = /^#[0-9A-Fa-f]{6}$/;
const FAMILIA = /^[A-Za-z0-9 ]{2,40}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const texto = (valor: unknown) => (typeof valor === 'string' ? valor.trim() : '');

function urlHttps(valor: string): boolean {
  try {
    return new URL(valor).protocol === 'https:';
  } catch {
    return false;
  }
}

type Formulario = Partial<Record<keyof CamposDaMarcaCompleta, unknown>>;

/**
 * Normaliza os campos para o salvar e confere o formato. O erro volta como
 * mensagem para o toast, em vez de o operador receber o 400 da API.
 */
export function camposDaMarcaCompleta(form: Formulario): {
  campos: CamposDaMarcaCompleta;
  erro: string | null;
} {
  const erros: string[] = [];

  const cor = (valor: unknown, rotulo: string) => {
    const v = texto(valor);
    if (!v) return null;
    if (!COR_HEX.test(v)) erros.push(`${rotulo}: use o formato #RRGGBB`);
    return v;
  };

  const status = (form.statusColors ?? {}) as Record<string, unknown>;
  const statusColors: CoresDeStatus = {};
  for (const { chave, rotulo } of STATUS_DA_MARCA) {
    const v = cor(status[chave], `Status ${rotulo}`);
    if (v) statusColors[chave] = v;
  }

  const fontFamily = texto(form.fontFamily) || null;
  if (fontFamily && !FAMILIA.test(fontFamily)) {
    erros.push('Fonte: só letras, números e espaço (ex.: Rubik)');
  }

  // Aceita colado com +, espaço, parênteses ou traço; vai só com os dígitos.
  const supportWhatsapp = texto(form.supportWhatsapp).replace(/\D/g, '') || null;
  if (supportWhatsapp && (supportWhatsapp.length < 10 || supportWhatsapp.length > 15)) {
    erros.push('WhatsApp de suporte: número com DDI e DDD (ex.: 5592999999999)');
  }

  const supportEmail = texto(form.supportEmail) || null;
  if (supportEmail && !EMAIL.test(supportEmail)) erros.push('E-mail de suporte inválido');

  const termsUrl = texto(form.termsUrl) || null;
  if (termsUrl && !urlHttps(termsUrl)) erros.push('Termos de uso: endereço https://');

  const privacyUrl = texto(form.privacyUrl) || null;
  if (privacyUrl && !urlHttps(privacyUrl)) erros.push('Política de privacidade: endereço https://');

  return {
    campos: {
      accentColor: cor(form.accentColor, 'Cor de destaque'),
      accentTextColor: cor(form.accentTextColor, 'Texto sobre o destaque'),
      headerColor: cor(form.headerColor, 'Cabeçalho'),
      statusColors: Object.keys(statusColors).length > 0 ? statusColors : null,
      symbolUri: texto(form.symbolUri) || null,
      fontFamily,
      supportWhatsapp,
      supportEmail,
      termsUrl,
      privacyUrl,
    },
    erro: erros[0] ?? null,
  };
}
