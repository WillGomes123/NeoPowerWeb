/**
 * Constantes compartilhadas pelas páginas legais públicas.
 *
 * LEGAL_LAST_UPDATED: atualize sempre que o texto de qualquer página mudar —
 * é a data exibida no topo de todas elas (e o que a loja/usuário consulta).
 */
export const LEGAL_LAST_UPDATED = '27 de outubro de 2026';

/** Nome da plataforma (desenvolvedora). Coincide com o companyName do tenant padrão. */
export const PLATFORM_NAME = 'NeoPower';

/**
 * WhatsApp de suporte da NeoPower (a plataforma). É o atendimento da marca
 * NeoPower e de toda marca sem contato próprio. O número fica só aqui; o app
 * usa o mesmo (NeoPower/src/config/linksDaMarca.ts).
 */
export const WHATSAPP_SUPORTE_NEOPOWER = '+55 11 92578-5044';

export interface ContatoDeSuporte {
  email?: string;
  whatsapp?: string;
}

/**
 * Contato próprio de atendimento por marca (chave = clientId), de antes de o
 * branding ter os campos de suporte. Vale só para a marca que ainda não
 * preencheu supportWhatsapp/supportEmail no White Label.
 */
export const CONTATO_SUPORTE: Record<string, ContatoDeSuporte> = {
  vipenergy: { email: 'vipenergyeletroposto@gmail.com' },
};

/** Campos de suporte do branding da marca (GET /branding/:clientId). */
export interface SuporteDaMarca {
  supportWhatsapp?: string | null;
  supportEmail?: string | null;
}

/** WhatsApp em dígitos com DDI (5592999999999) → "+55 92 99999-9999". */
export function formatarWhatsapp(digitos: string): string {
  const br = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(digitos);
  return br ? `+55 ${br[1]} ${br[2]}-${br[3]}` : `+${digitos}`;
}

/**
 * Contato mostrado em /<tenant>/suporte: o cadastrado no branding da marca;
 * sem ele, o do mapa acima; e, sem nenhum, o WhatsApp de suporte da NeoPower.
 * A App Store exige meio de contato na URL de suporte, então toda marca tem um.
 */
export function contatoDeSuporte(
  clientId: string,
  marca?: SuporteDaMarca | null
): ContatoDeSuporte {
  const whatsapp = (marca?.supportWhatsapp || '').replace(/\D/g, '');
  const email = (marca?.supportEmail || '').trim();
  if (whatsapp || email) {
    return {
      ...(email ? { email } : {}),
      ...(whatsapp ? { whatsapp: formatarWhatsapp(whatsapp) } : {}),
    };
  }
  return CONTATO_SUPORTE[clientId.toLowerCase()] ?? { whatsapp: WHATSAPP_SUPORTE_NEOPOWER };
}

/** Troca de página para o documento da marca (separado para o teste observar). */
export const navegacao = {
  substituir: (url: string) => window.location.replace(url),
};

/**
 * Documento próprio da marca (termsUrl/privacyUrl do branding), se for um
 * endereço https válido. O endereço vem do cadastro da marca; nada de
 * javascript: ou http: na página pública.
 */
export function documentoDaMarca(url: unknown): string | null {
  if (typeof url !== 'string' || !url.trim()) return null;
  try {
    const endereco = new URL(url.trim());
    return endereco.protocol === 'https:' ? endereco.toString() : null;
  } catch {
    return null;
  }
}
