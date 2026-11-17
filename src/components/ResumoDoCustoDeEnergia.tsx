import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  brl,
  RespostaDaApuracao,
  sobraDepoisDaEnergia,
  textoPorCusto,
} from '@/lib/custoDeEnergia';
import { BlocoDeIcone, classeDoCartao } from '@/components/painel/Pagina';
import { NumeroMiudo } from '@/components/financeiro/Pecas';

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

  // Redesenho (nov/2026): cartão branco com bloco de ícone e os números no
  // bloco "Agora" da Visão geral.
  return (
    <section aria-label="Custo de energia" className={`${classeDoCartao} p-5 3xl:p-[22px] space-y-4`}>
      <div className="flex items-start gap-4">
        <BlocoDeIcone tom="amarelo">
          <span aria-hidden="true" className="material-symbols-outlined text-[22px]">
            bolt
          </span>
        </BlocoDeIcone>
        <div className="min-w-0">
          <h3 className="text-[20px] leading-tight font-semibold text-foreground">Custo de energia</h3>
          <p className="text-[15px] font-medium text-muted-foreground mt-0.5">
            O que as recargas do período custaram na conta de luz. Só a gestão da marca vê; não muda o
            preço cobrado do cliente.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <NumeroMiudo rotulo="Conta de luz" valor={brl(total.custo)} detalhe={textoPorCusto(total.porCusto)} />
        {repasse != null && (
          <>
            <NumeroMiudo rotulo="Repasse" valor={brl(repasse)} detalhe="Depois da comissão" />
            <NumeroMiudo
              rotulo="Sobra depois da energia"
              valor={brl(sobraDepoisDaEnergia(repasse, total.custo))}
              detalhe="Repasse menos a conta de luz"
              destaque
            />
          </>
        )}
      </div>

      {total.semCusto.recargas > 0 && (
        <p className="text-sm text-estado-problema-forte">
          {total.semCusto.recargas} recarga(s) e{' '}
          {total.semCusto.energiaKwh.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kWh ficaram
          fora da conta, por não terem custo cadastrado na data delas
          {semCustoNenhum.length > 0 ? `. Locais sem custo: ${semCustoNenhum.join(', ')}.` : '.'}
        </p>
      )}
      {total.pelaProporcaoDoTempo > 0 && (
        <p className="text-sm text-muted-foreground">
          {total.pelaProporcaoDoTempo} recarga(s) sem leitura do medidor tiveram a ponta estimada pelo
          horário de início e fim.
        </p>
      )}
    </section>
  );
}

export default ResumoDoCustoDeEnergia;
