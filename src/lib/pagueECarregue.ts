/**
 * Link da página "pague e carregue" (visitante paga por Pix, sem app).
 * A página é servida pela API em /pay/<carregador>/<conector>.
 */

/** Origem pública da API de produção, usada quando o build não informa uma. */
const API_PRODUCAO = 'https://ocppapi-production.up.railway.app';

type EnvDePagamento = Partial<Record<'VITE_PAY_URL' | 'VITE_API_URL', string>>;

/**
 * Origem onde a página de pagamento está. `VITE_PAY_URL` tem prioridade;
 * senão, a origem de `VITE_API_URL` quando ela é absoluta. Com `VITE_API_URL`
 * relativa ('/api', atrás de proxy), a página não passa pelo proxy, então
 * usa a API de produção.
 */
export function origemDaPaginaDePagamento(
  env: EnvDePagamento = (import.meta.env ?? {}) as EnvDePagamento
): string {
  const explicita = env.VITE_PAY_URL?.trim();
  if (explicita) return explicita.replace(/\/+$/, '');
  const api = env.VITE_API_URL?.trim() ?? '';
  if (/^https?:\/\//i.test(api)) {
    try {
      return new URL(api).origin;
    } catch {
      // URL malformada: cai no padrão.
    }
  }
  return API_PRODUCAO;
}

export function linkDePagamento(
  chargePointId: string,
  conector: number,
  origem = origemDaPaginaDePagamento()
): string {
  return `${origem}/pay/${encodeURIComponent(chargePointId)}/${conector}`;
}
