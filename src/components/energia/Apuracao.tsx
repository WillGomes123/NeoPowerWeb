import { brl, pct, tarifa } from '../../lib/energia';
import type { AbaProps } from './tipos';
import { Parametros } from './Parametros';
import { Aviso, Formula, Painel, Sub, Tabela, Td } from './ui';

export function Apuracao(props: AbaProps) {
  const { painel } = props;
  const ativas = painel.conexoes.filter(c => c.status !== 'cancelado');
  const T = painel.totaisApuracao;
  const P = painel.parametros;
  const mes = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  // Titular que paga o custo fixo da UC da usina no autoconsumo (a Aquaforma, hoje).
  const autoconsumo = ativas.filter(c => c.modalidade === 'auto');

  return (
    <div className="space-y-6">
      <Painel
        titulo={`Apuração · prévia de ${mes}`}
        detalhe="Com a cota de cada conexão e as tarifas das faturas. O valor final sai da leitura das faturas das UCs."
      >
        <Tabela
          denso
          cabecalho={[
            'Ponto',
            { t: 'kWh', n: true },
            { t: 'Bruto', n: true },
            { t: 'Fio B', n: true },
            { t: 'Custo fixo', n: true },
            { t: 'Líquido', n: true },
            { t: 'Economia', n: true },
            { t: 'Cobrado', n: true },
            { t: 'Usina', n: true },
            { t: 'NeoPower', n: true },
          ]}
          vazio={ativas.length ? undefined : 'Nenhuma conexão ativa para apurar.'}
        >
          {ativas.map(c => {
            const a = c.apuracao;
            return (
              <tr key={c.id}>
                <Td>
                  <b>{c.pontoNome}</b>
                  <Sub>
                    {c.usinaNome} · {painel.modalidades[c.modalidade].sigla} ·{' '}
                    {c.regra === 'percentual_usina'
                      ? `${pct(c.valor)} à usina`
                      : `${pct(c.valor)} desc.`}
                  </Sub>
                </Td>
                <Td n>{a.compensadoKwh.toLocaleString('pt-BR')}</Td>
                <Td n>{brl(a.bruto)}</Td>
                <Td n>− {brl(a.fioB)}</Td>
                <Td n>− {brl(a.custoFixo)}</Td>
                <Td n>{brl(a.liquido)}</Td>
                <Td n className="font-bold text-primary">
                  {brl(a.economia)}
                </Td>
                <Td n>{brl(a.cobrado)}</Td>
                <Td n>{brl(a.usina)}</Td>
                <Td n>{brl(a.neopower)}</Td>
              </tr>
            );
          })}
          {ativas.length > 0 && (
            <tr className="font-bold bg-surface-container/40">
              <Td>Total</Td>
              <Td n>{T.compensadoKwh.toLocaleString('pt-BR')}</Td>
              <Td n>{brl(T.bruto)}</Td>
              <Td n>− {brl(T.fioB)}</Td>
              <Td n>− {brl(T.custoFixo)}</Td>
              <Td n>{brl(T.liquido)}</Td>
              <Td n className="text-primary">
                {brl(T.economia)}
              </Td>
              <Td n>{brl(T.cobrado)}</Td>
              <Td n>{brl(T.usina)}</Td>
              <Td n>{brl(T.neopower)}</Td>
            </tr>
          )}
        </Tabela>
        <div className="p-5 space-y-3 border-t border-outline-variant/10">
          <Formula>
            benefício líquido = kWh compensados × tarifa − Fio B ({pct(P.fioBParticipacao)} da
            tarifa × {pct(P.fioBEscalonamento)} cobrado neste ano) − custo fixo da UC da usina
            proporcional à cota
            <br />
            regra “desconto”: o ponto economiza kWh × tarifa × desconto; o resto do líquido é
            cobrado no split
            <br />
            regra “% do benefício”: a usina recebe o percentual do líquido e o ponto fica com o
            restante (modelo do contrato Ecofin)
            <br />
            split: cobrado → {pct(1 - P.taxaNeopower)} usina · {pct(P.taxaNeopower)} NeoPower
            <br />
            tarifas: grupo B {tarifa(P.tarifaB)} · grupo A {tarifa(P.tarifaA)}
          </Formula>
          {autoconsumo.map(c => {
            const u = painel.usinas.find(x => x.id === c.usinaId);
            return (
              <Aviso key={c.id} tom="aviso">
                No autoconsumo, o titular paga a conta da UC da usina: {c.pontoNome} arca com os{' '}
                {brl(u?.custoFixoMensal ?? 0)} de {u?.custoFixoDescricao || 'custo fixo'} da{' '}
                {c.usinaNome}. Usina com demanda alta pesa menos no consórcio, onde o custo se
                divide entre todas as cotas.
              </Aviso>
            );
          })}
        </div>
      </Painel>

      <Parametros {...props} />
    </div>
  );
}
