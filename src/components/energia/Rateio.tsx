import { toast } from 'sonner';
import { api } from '../../lib/api';
import type { Usina } from '../../lib/energia';
import { kwh, pct, STATUS_CONEXAO } from '../../lib/energia';
import type { AbaProps } from './tipos';
import { TabelaConexoes } from './TabelaConexoes';
import { Aviso, Botao, Painel, Selo, Sub, Tabela, Td } from './ui';

async function baixarArquivo(u: Usina) {
  try {
    const r = await api.get(`/energia/usinas/${u.id}/rateio.csv`);
    if (!r.ok) throw new Error();
    const blob = await r.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rateio-${u.nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    toast.error('Não foi possível baixar o arquivo de rateio.');
  }
}

export function Rateio({ painel, podeEditar, mudar }: AbaProps) {
  const comRateio = painel.usinas.filter(
    u => u.status !== 'desativada' && u.modalidades.some(m => m === 'cons' || m === 'coop')
  );
  const autoconsumo = painel.conexoes.filter(
    c => c.modalidade === 'auto' && c.status !== 'cancelado'
  );

  return (
    <div className="space-y-6">
      {comRateio.length === 0 && (
        <Painel titulo="Rateio" detalhe="Consórcio e cooperativa">
          <p className="p-5 text-sm text-on-surface-variant">
            Nenhuma usina em consórcio ou cooperativa ainda. O rateio de cada uma aparece aqui assim
            que ela for cadastrada aceitando essas modalidades.
          </p>
        </Painel>
      )}
      {comRateio.map(u => {
        const cs = painel.conexoes.filter(
          c =>
            c.usinaId === u.id &&
            c.status !== 'cancelado' &&
            (c.modalidade === 'cons' || c.modalidade === 'coop')
        );
        const alocado = cs.reduce((t, c) => t + c.cotaKwh, 0);
        const aEnviar = cs.filter(c => c.status === 'pendente').length;
        const dist = painel.distribuidoras[u.distribuidora];
        const pontoDe = (id: number) => painel.pontos.find(p => p.id === id);
        const enviadoEm = u.rateioEnviadoEm
          ? new Date(u.rateioEnviadoEm).toLocaleDateString('pt-BR')
          : null;

        return (
          <Painel
            key={u.id}
            titulo={`${u.nome} · rateio`}
            detalhe={`${cs.length} participantes · ${pct(alocado / Math.max(u.geracaoMensalKwh, 1))} da geração alocada`}
            acao={
              <div className="flex flex-wrap items-center gap-2">
                {u.rateioStatus === 'aprovado' && <Selo tom="ok">aprovado</Selo>}
                {u.rateioStatus === 'enviado' && (
                  <Selo tom="aviso">
                    em análise na {dist}
                    {enviadoEm ? ` desde ${enviadoEm}` : ''}
                  </Selo>
                )}
                {u.rateioStatus === 'pendente' && <Selo tom="aviso">alterações a enviar</Selo>}
                <Botao pequeno onClick={() => void baixarArquivo(u)}>
                  <span className="material-symbols-outlined text-sm">download</span>Arquivo de
                  rateio
                </Botao>
                {podeEditar && u.rateioStatus === 'pendente' && (
                  <Botao
                    pequeno
                    primario
                    onClick={() =>
                      void mudar(
                        'post',
                        `/energia/usinas/${u.id}/rateio/enviado`,
                        undefined,
                        `Rateio marcado como enviado à ${dist}.`
                      )
                    }
                  >
                    Marcar como enviado
                  </Botao>
                )}
                {podeEditar && u.rateioStatus === 'enviado' && (
                  <Botao
                    pequeno
                    primario
                    onClick={() => {
                      if (
                        window.confirm(
                          `O crédito já aparece na fatura dos participantes da ${u.nome}? Aprovar ativa todos eles.`
                        )
                      ) {
                        void mudar(
                          'post',
                          `/energia/usinas/${u.id}/rateio/aprovado`,
                          undefined,
                          'Rateio aprovado: créditos ativos para os participantes.'
                        );
                      }
                    }}
                  >
                    Marcar como aprovado
                  </Botao>
                )}
              </div>
            }
          >
            {u.rateioStatus === 'pendente' && aEnviar > 0 && (
              <div className="px-5 pt-4">
                <Aviso tom="aviso">
                  {aEnviar} participante(s) entraram ou saíram desde o último envio. Baixe o arquivo
                  e envie à {dist}; depois marque como enviado.
                </Aviso>
              </div>
            )}
            <Tabela
              cabecalho={[
                'Participante',
                'Titular / UC',
                { t: 'Cota kWh', n: true },
                { t: '% no rateio', n: true },
                'Status',
              ]}
            >
              {cs.map(c => {
                const p = pontoDe(c.pontoId);
                const st = STATUS_CONEXAO[c.status];
                return (
                  <tr key={c.id}>
                    <Td>
                      <b>{c.pontoNome}</b>
                    </Td>
                    <Td>
                      {p?.titular}
                      <Sub>
                        {p?.ucPropria
                          ? p.uc || 'UC própria (número não cadastrado)'
                          : 'UC do prédio'}
                      </Sub>
                    </Td>
                    <Td n>{kwh(c.cotaKwh)}</Td>
                    <Td n>{pct(c.cotaKwh / Math.max(u.geracaoMensalKwh, 1))}</Td>
                    <Td>
                      <Selo tom={st.tom}>{st.label}</Selo>
                    </Td>
                  </tr>
                );
              })}
              <tr>
                <Td>
                  <b>Livre</b>
                </Td>
                <td className="px-4 py-3" />
                <Td n>{kwh(Math.max(0, u.geracaoMensalKwh - alocado))}</Td>
                <Td n>{pct(Math.max(0, 1 - alocado / Math.max(u.geracaoMensalKwh, 1)))}</Td>
                <Td>
                  <Selo tom="neutro">sem uso</Selo>
                </Td>
              </tr>
            </Tabela>
            <p className="px-6 py-4 text-xs text-on-surface-variant border-t border-outline-variant/10">
              O arquivo segue o formato de rateio da distribuidora (percentual por UC). O
              processamento na {dist} leva em média de 30 a 60 dias. Marque como aprovado quando o
              crédito aparecer na fatura dos participantes.
            </p>
          </Painel>
        );
      })}

      <Painel
        titulo="Autoconsumo remoto"
        detalhe="Não usa rateio: a usina está na titularidade do ponto"
      >
        <TabelaConexoes painel={painel} lista={autoconsumo} />
      </Painel>
    </div>
  );
}
