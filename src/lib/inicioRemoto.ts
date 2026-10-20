/**
 * Início remoto pelo painel (Operações → Remote Start Transaction).
 *
 * Quem cobra a recarga é o cliente. O painel aceita o e-mail do cadastro, que é
 * o que o atendimento conhece; a API troca pela tag do cliente (USER_<id>) e
 * devolve em nome de quem a recarga foi iniciada. Uma tag que não é de cliente
 * (um cartão RFID, por exemplo) inicia uma recarga que ninguém paga.
 */

/** O que foi digitado identifica um cliente (e-mail ou USER_<id>)? */
export function ehTagDeCliente(digitado: string | undefined | null): boolean {
  const tag = (digitado ?? '').trim();
  return tag.includes('@') || /^USER_\d+$/i.test(tag);
}

/**
 * Texto do resultado de um início remoto, a partir da resposta da API
 * (`{ status, idTag, cliente }`). Devolve null quando a resposta não é a de um
 * início (outros comandos, ou API antiga), e o painel mostra o texto padrão.
 */
export function mensagemDoInicioRemoto(dados: unknown): string | null {
  if (!dados || typeof dados !== 'object' || !('cliente' in dados)) return null;
  const { cliente, idTag } = dados as {
    cliente: { id: number; nome: string | null } | null;
    idTag?: string;
  };
  if (cliente) {
    const quem = cliente.nome?.trim() || `cliente ${cliente.id}`;
    return `Iniciado em nome de ${quem} (${idTag ?? `USER_${cliente.id}`}). A recarga será cobrada na carteira do cliente.`;
  }
  return `Iniciado com a tag ${idTag ?? 'informada'}, sem cliente: esta recarga não será cobrada.`;
}
