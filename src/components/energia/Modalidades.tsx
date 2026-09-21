import type { Modalidade } from '../../lib/energia';
import type { AbaProps } from './tipos';
import { Formula, Painel, Sigla } from './ui';

/** Como cada modalidade funciona na prática. As regras que o sistema confere estão na fórmula abaixo. */
const DETALHES: Record<Modalidade, string[]> = {
  auto: [
    'Titular: o próprio ponto (troca de titularidade da UC da usina)',
    'Um titular por usina; pode abastecer várias UCs do mesmo CNPJ',
    'O ponto paga as contas da UC da usina',
    'Sem rateio na distribuidora',
    'Uso: cliente grande com usina dedicada (Aquaforma)',
  ],
  cons: [
    'Titular: Consórcio NeoPower Recarga',
    'Vários pontos, rateio em % por UC',
    'Custo fixo da usina rateado pelas cotas',
    'Arquivo de rateio a cada entrada ou saída',
    'Uso: padrão da rede, CPOs white label, usinas de terceiros',
  ],
  coop: [
    'Titular: cooperativa (cooperados com cota)',
    'Mínimo de 20 cooperados, assembleia e conselho',
    'Tratamento tributário próprio',
    'Mesmo rateio do consórcio na distribuidora',
    'Uso: grupo grande ou donos de telhado como cooperados',
  ],
  local: [
    'Titular: o ponto, na mesma UC',
    'Sem rateio, só homologação',
    'Sem Fio B sobre o que é consumido na hora',
    'Compensa só o excedente',
    'Uso: hub de Boa Vista, terreno próprio',
  ],
};

export function Modalidades({ painel }: AbaProps) {
  return (
    <Painel
      titulo="Modalidades de conexão"
      detalhe="A modalidade é da conexão, não da usina. Cada usina diz quais aceita."
    >
      <div className="p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {(Object.keys(DETALHES) as Modalidade[]).map(m => {
            const info = painel.modalidades[m];
            const usinas = painel.usinas.filter(u => u.modalidades.includes(m)).length;
            const conexoes = painel.conexoes.filter(
              c => c.modalidade === m && c.status !== 'cancelado'
            ).length;
            return (
              <div
                key={m}
                className="rounded-xl border border-outline-variant/10 bg-surface-container p-4 flex flex-col gap-2"
              >
                <Sigla>{info.sigla}</Sigla>
                <h4 className="font-headline font-bold text-on-surface">{info.nome}</h4>
                <ul className="list-disc pl-4 text-xs text-on-surface-variant space-y-1 leading-relaxed">
                  {DETALHES[m].map(d => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
                <p className="mt-auto pt-2 text-xs font-bold text-on-surface">
                  {usinas} usina(s) aceitam · {conexoes} conexão(ões)
                </p>
              </div>
            );
          })}
        </div>
        <Formula>
          regra de conexão: usina.distribuidora = ponto.distribuidora E modalidade ∈
          usina.modalidades E cota ≤ capacidade livre da usina
          <br />
          AUTO: mesmo titular da usina E UC própria · COOP: 20 cooperados ou mais · UC do prédio: o
          contrato do local precisa prever o repasse
        </Formula>
      </div>
    </Painel>
  );
}
