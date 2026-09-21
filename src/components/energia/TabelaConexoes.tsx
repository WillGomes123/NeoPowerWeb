import type { Conexao, PainelEnergia } from '../../lib/energia';
import { brl, kwh, COBRANCA_LABEL, REGRA_LABEL, STATUS_CONEXAO } from '../../lib/energia';
import { Botao, Selo, Sigla, Tabela, Td } from './ui';

export function TabelaConexoes({
  painel,
  lista,
  onEncerrar,
}: {
  painel: PainelEnergia;
  lista: Conexao[];
  onEncerrar?: (c: Conexao) => void;
}) {
  const cab: (string | { t: string; n?: boolean })[] = [
    'Ponto',
    'Usina',
    'Modalidade',
    { t: 'Cota', n: true },
    'Regra de preço',
    'Cobrança',
    { t: 'Economia/mês', n: true },
    'Status',
  ];
  if (onEncerrar) cab.push('');
  return (
    <Tabela cabecalho={cab} vazio={lista.length ? undefined : 'Nenhuma conexão.'}>
      {lista.map(c => {
        const st = STATUS_CONEXAO[c.status];
        const m = painel.modalidades[c.modalidade];
        return (
          <tr key={c.id} className={c.status === 'cancelado' ? 'opacity-50' : ''}>
            <Td>
              <b>{c.pontoNome}</b>
            </Td>
            <Td>{c.usinaNome}</Td>
            <Td>
              <span className="whitespace-nowrap">
                <Sigla>{m.sigla}</Sigla> {m.nome}
              </span>
            </Td>
            <Td n>{kwh(c.cotaKwh)}</Td>
            <Td>{REGRA_LABEL(c)}</Td>
            <Td>{COBRANCA_LABEL[c.cobranca]}</Td>
            <Td n className="font-bold text-primary">
              {c.status === 'cancelado' ? '—' : brl(c.apuracao.economia)}
            </Td>
            <Td>
              <Selo tom={st.tom}>{st.label}</Selo>
            </Td>
            {onEncerrar && (
              <Td>
                <Botao pequeno disabled={c.status === 'cancelado'} onClick={() => onEncerrar(c)}>
                  Encerrar
                </Botao>
              </Td>
            )}
          </tr>
        );
      })}
    </Tabela>
  );
}
