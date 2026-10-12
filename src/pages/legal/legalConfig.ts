/**
 * Constantes compartilhadas pelas páginas legais públicas.
 *
 * LEGAL_LAST_UPDATED: atualize sempre que o texto de qualquer página mudar —
 * é a data exibida no topo de todas elas (e o que a loja/usuário consulta).
 */
export const LEGAL_LAST_UPDATED = '1 de setembro de 2026';

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
 * Contato próprio de atendimento por marca (chave = clientId). O branding ainda
 * não tem campo de contato; quando tiver, isto passa a vir de lá.
 */
export const CONTATO_SUPORTE: Record<string, ContatoDeSuporte> = {
  vipenergy: { email: 'vipenergyeletroposto@gmail.com' },
};

/**
 * Contato mostrado em /<tenant>/suporte: o da própria marca ou, sem um, o
 * WhatsApp de suporte da NeoPower. A App Store exige meio de contato na URL de
 * suporte, então toda marca tem um.
 */
export function contatoDeSuporte(clientId: string): ContatoDeSuporte {
  return CONTATO_SUPORTE[clientId.toLowerCase()] ?? { whatsapp: WHATSAPP_SUPORTE_NEOPOWER };
}
