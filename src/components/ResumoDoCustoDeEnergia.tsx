import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  brl,
  RespostaDaApuracao,
  sobraDepoisDaEnergia,
  textoPorCusto,
} from '@/lib/custoDeEnergia';

interface Props {
  inicio: string;
  fim: string;
  locationId?: number | null;
  clientId?: string | null;
  /** Repasse do mesmo período, do Relatório Financeiro. */
  repasse?: number | null;
}

/**
 * Quanto as recargas do período custaram na conta de luz do operador. Fica
 * fora do PDF do local e do que a conta comum e o gestor de local veem. Some
 * enquanto nenhum local do recorte tiver custo cadastrado.
 */
export function ResumoDoCustoDeEnergia({ inicio, fim, locationId, clientId, repasse }: Props) {
  const { user } = useAuth();
  const podeVer = user?.role === 'admin' || (user?.role === 'operador' && !!user?.clientId);
  const [dados, setDados] = useState<RespostaDaApuracao | null>(null);

  useEffect(() => {
    if (!podeVer) return;
    let cancelado = false;
    const params = new URLSearchParams();
    if (inicio) params.append('startDate', inicio);
    if (fim) params.append('endDate', fim);
    if (locationId != null) params.append('locationId', String(locationId));
    if (clientId) params.append('clientId', clientId);
    api
      .get(`/custo-energia/apuracao?${params}`)
      .then(async resposta => {
        if (!resposta.ok) throw new Error('apuração indisponível');
        const corpo = await resposta.json();
        const valor = corpo?.data ?? corpo;
        // Este cartão é um extra da página do relatório: resposta estranha só o esconde.
        if (!cancelado) setDados(Array.isArray(valor?.locais) ? valor : null);
      })
      .catch(() => {
        if (!cancelado) setDados(null);
      });
    return () => {
      cancelado = true;
    };
  }, [podeVer, inicio, fim, locationId, clientId]);

  if (!podeVer || !dados || !dados.locais.some(l => l.temCusto)) return null;

  const { total, locais } = dados;
  const semCustoNenhum = locais.filter(l => !l.temCusto).map(l => l.nome);

  return (
    <div className="glass-card rounded-xl p-5 space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">bolt</span>
          <h3 className="text-base font-semibold text-foreground">Custo de energia</h3>
        </div>
        <p className="text-xs text-on-surface-variant mt-1">
          O que as recargas do período custaram na conta de luz. Só a gestão da marca vê; não muda o
          preço cobrado do cliente.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-background/50 border border-outline-variant/15">
          <p className="text-xs text-on-surface-variant font-medium uppercase mb-1">Conta de luz</p>
          <p className="text-2xl font-bold text-foreground">{brl(total.custo)}</p>
          <p className="text-xs text-on-surface-variant mt-1">{textoPorCusto(total.porCusto)}</p>
        </div>
        {repasse != null && (
          <>
            <div className="p-4 rounded-xl bg-background/50 border border-outline-variant/15">
              <p className="text-xs text-on-surface-variant font-medium uppercase mb-1">Repasse</p>
              <p className="text-2xl font-bold text-foreground">{brl(repasse)}</p>
              <p className="text-xs text-on-surface-variant mt-1">Depois da comissão</p>
            </div>
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/30">
              <p className="text-xs text-on-surface-variant font-medium uppercase mb-1">
                Sobra depois da energia
              </p>
              <p className="text-2xl font-bold text-primary">
                {brl(sobraDepoisDaEnergia(repasse, total.custo))}
              </p>
              <p className="text-xs text-on-surface-variant mt-1">Repasse menos a conta de luz</p>
            </div>
          </>
        )}
      </div>

      {total.semCusto.recargas > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {total.semCusto.recargas} recarga(s) e{' '}
          {total.semCusto.energiaKwh.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kWh ficaram
          fora da conta, por não terem custo cadastrado na data delas
          {semCustoNenhum.length > 0 ? `. Locais sem custo: ${semCustoNenhum.join(', ')}.` : '.'}
        </p>
      )}
      {total.pelaProporcaoDoTempo > 0 && (
        <p className="text-xs text-on-surface-variant">
          {total.pelaProporcaoDoTempo} recarga(s) sem leitura do medidor tiveram a ponta estimada pelo
          horário de início e fim.
        </p>
      )}
    </div>
  );
}

export default ResumoDoCustoDeEnergia;
