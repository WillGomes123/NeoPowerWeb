import { useState } from 'react';
import { pct, tarifa } from '../../lib/energia';
import type { AbaProps } from './tipos';
import { Campo, Numero } from './campos';
import { Botao, Painel } from './ui';

/**
 * Tarifas e percentuais que entram em toda conta da apuração. Mudam fora do
 * sistema — reajuste da distribuidora, escalonamento anual do Fio B (Lei
 * 14.300: 60% em 2026, 75% em 2027, 90% em 2028) —, então ficam editáveis aqui.
 */
export function Parametros({ painel, podeEditar, mudar }: AbaProps) {
  const P = painel.parametros;
  const [editando, setEditando] = useState(false);
  // Na tela, percentuais em % (28); na API, frações (0,28).
  const doPainel = () => ({
    tarifaB: P.tarifaB as number | '',
    tarifaA: P.tarifaA as number | '',
    fioBParticipacao: +(P.fioBParticipacao * 100).toFixed(2) as number | '',
    fioBEscalonamento: +(P.fioBEscalonamento * 100).toFixed(2) as number | '',
    taxaNeopower: +(P.taxaNeopower * 100).toFixed(2) as number | '',
  });
  const [f, setF] = useState(doPainel);
  const [salvando, setSalvando] = useState(false);
  const set = (k: keyof typeof f) => (v: number | '') => setF(o => ({ ...o, [k]: v }));
  const completo = Object.values(f).every(v => v !== '');

  const salvar = async () => {
    if (!completo) return;
    setSalvando(true);
    const ok = await mudar(
      'put',
      '/energia/parametros',
      {
        tarifaB: Number(f.tarifaB),
        tarifaA: Number(f.tarifaA),
        fioBParticipacao: Number(f.fioBParticipacao) / 100,
        fioBEscalonamento: Number(f.fioBEscalonamento) / 100,
        taxaNeopower: Number(f.taxaNeopower) / 100,
      },
      'Parâmetros atualizados. A apuração foi recalculada.'
    );
    setSalvando(false);
    if (ok) setEditando(false);
  };

  return (
    <Painel
      titulo="Parâmetros da apuração"
      detalhe="Tarifas da fatura e percentuais usados em todas as conexões"
      acao={
        podeEditar &&
        !editando && (
          <Botao
            pequeno
            onClick={() => {
              setF(doPainel()); // abre sempre com o que está salvo
              setEditando(true);
            }}
          >
            Editar
          </Botao>
        )
      }
    >
      {!editando ? (
        <dl className="p-5 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          {[
            ['Tarifa grupo B', tarifa(P.tarifaB)],
            ['Tarifa grupo A', tarifa(P.tarifaA)],
            ['Fio B na tarifa', pct(P.fioBParticipacao)],
            ['Fio B cobrado no ano', pct(P.fioBEscalonamento)],
            ['Taxa NeoPower', pct(P.taxaNeopower)],
          ].map(([r, v]) => (
            <div key={r}>
              <dt className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
                {r}
              </dt>
              <dd className="mt-1 font-headline font-bold text-on-surface tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <form
          className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
          onSubmit={e => {
            e.preventDefault();
            void salvar();
          }}
        >
          <Campo rotulo="Tarifa grupo B (R$/kWh)">
            <Numero valor={f.tarifaB} onChange={set('tarifaB')} step={0.0001} />
          </Campo>
          <Campo rotulo="Tarifa grupo A (R$/kWh)">
            <Numero valor={f.tarifaA} onChange={set('tarifaA')} step={0.0001} />
          </Campo>
          <Campo rotulo="Fio B na tarifa (%)">
            <Numero valor={f.fioBParticipacao} onChange={set('fioBParticipacao')} step={0.1} />
          </Campo>
          <Campo rotulo="Fio B cobrado no ano (%)" dica="2026: 60% · 2027: 75% · 2028: 90%">
            <Numero valor={f.fioBEscalonamento} onChange={set('fioBEscalonamento')} step={1} />
          </Campo>
          <Campo rotulo="Taxa NeoPower (%)">
            <Numero valor={f.taxaNeopower} onChange={set('taxaNeopower')} step={0.5} />
          </Campo>
          <div className="sm:col-span-2 lg:col-span-5 flex justify-end gap-2">
            <Botao onClick={() => setEditando(false)}>Cancelar</Botao>
            <Botao primario type="submit" disabled={!completo || salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </Botao>
          </div>
        </form>
      )}
    </Painel>
  );
}
