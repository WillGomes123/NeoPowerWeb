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
 * Contato de atendimento por marca (chave = clientId), mostrado em /<tenant>/suporte.
 * A App Store exige meio de contato na URL de suporte. O branding ainda não tem
 * campo de contato; quando tiver, isto passa a vir de lá.
 */
export const CONTATO_SUPORTE: Record<string, { email: string; whatsapp?: string }> = {
  vipenergy: { email: 'vipenergyeletroposto@gmail.com' },
};
