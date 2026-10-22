/**
 * Origem do Socket.IO da API a partir da `VITE_API_URL`: a URL sem o "/api" do
 * FINAL. O `replace('/api', '')` de antes trocava a PRIMEIRA ocorrência; com a
 * API num domínio que começa por "api" (ambiente de teste, 22/10/2026:
 * "https://api-production-c0b8…/api") sobrava "https:/-production…" e o socket
 * tentava "wss://https/". Sem URL absoluta, vale a própria origem do painel.
 */
export function enderecoDoSocket(apiUrl: string | undefined | null, origem: string): string {
  const url = (apiUrl ?? '').trim();
  if (!/^https?:\/\//i.test(url)) return origem;
  return url.replace(/\/+$/, '').replace(/\/api$/i, '');
}
