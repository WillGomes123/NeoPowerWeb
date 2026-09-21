import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import type { Ponto } from '../../lib/energia';
import { kwh, STATUS_CONEXAO } from '../../lib/energia';
import type { AbaProps } from './tipos';
import { Campo, Escolha, Marcar, Numero, Texto } from './campos';
import { Botao, Painel, Selo, Sigla, Sub, Tabela, Td } from './ui';

type Form = {
  nome: string;
  titular: string;
  uc: string;
  distribuidora: 'AM' | 'RR';
  grupo: 'A' | 'B';
  ucPropria: boolean;
  consumoMensalKwh: number | '';
  carregadores: string;
};

const vazio: Form = {
  nome: '',
  titular: '',
  uc: '',
  distribuidora: 'AM',
  grupo: 'B',
  ucPropria: true,
  consumoMensalKwh: '',
  carregadores: '',
};

export function Pontos({ painel, podeEditar, mudar, irPara }: AbaProps) {
  const [editando, setEditando] = useState<Ponto | 'novo' | null>(null);
  const temUsinaNa = (d: string) =>
    painel.usinas.some(u => u.status === 'operando' && u.distribuidora === d);

  return (
    <div className="space-y-6">
      <Painel
        titulo="Pontos consumidores"
        detalhe="Eletropostos e locais da rede que recebem o crédito"
        acao={
          podeEditar && (
            <Botao primario onClick={() => setEditando('novo')}>
              <span className="material-symbols-outlined text-base">add</span>Cadastrar ponto
            </Botao>
          )
        }
      >
        <Tabela
          vazio={
            painel.pontos.length
              ? undefined
              : 'Nenhum ponto cadastrado ainda.' +
                (podeEditar ? ' Use “Cadastrar ponto” para começar.' : '')
          }
          cabecalho={[
            'Ponto',
            'Carregadores',
            'Distribuidora',
            'UC',
            { t: 'Consumo/mês', n: true },
            'Usina',
            'Status',
            ...(podeEditar ? [''] : []),
          ]}
        >
          {painel.pontos.map(p => (
            <tr key={p.id}>
              <Td>
                <b>{p.nome}</b>
                <Sub>
                  Grupo {p.grupo} · titular {p.titular}
                </Sub>
              </Td>
              <Td>{p.carregadores || '—'}</Td>
              <Td>{painel.distribuidoras[p.distribuidora]}</Td>
              <Td>
                {p.ucPropria ? (
                  <>Própria{p.uc && <Sub>{p.uc}</Sub>}</>
                ) : (
                  <Selo tom="aviso">do prédio</Selo>
                )}
              </Td>
              <Td n>{kwh(p.consumoMensalKwh)}</Td>
              <Td>
                {p.conexao ? (
                  <span className="whitespace-nowrap">
                    <Sigla>{painel.modalidades[p.conexao.modalidade].sigla}</Sigla>{' '}
                    {p.conexao.usinaNome}
                  </span>
                ) : (
                  <Selo tom="neutro">sem usina</Selo>
                )}
              </Td>
              <Td>
                {p.conexao ? (
                  <Selo tom={STATUS_CONEXAO[p.conexao.status].tom}>
                    {STATUS_CONEXAO[p.conexao.status].label}
                  </Selo>
                ) : !temUsinaNa(p.distribuidora) ? (
                  <Selo tom="erro">sem usina na região</Selo>
                ) : (
                  <Botao pequeno onClick={() => irPara('conexoes')}>
                    Conectar
                  </Botao>
                )}
              </Td>
              {podeEditar && (
                <Td>
                  <Botao pequeno onClick={() => setEditando(p)}>
                    Editar
                  </Botao>
                </Td>
              )}
            </tr>
          ))}
        </Tabela>
      </Painel>

      {editando && (
        <PontoDialog
          ponto={editando === 'novo' ? null : editando}
          painel={painel}
          onFechar={() => setEditando(null)}
          onSalvar={async (f, id) => {
            const corpo = { ...f, uc: f.uc || null };
            const ok = await mudar(
              id ? 'put' : 'post',
              id ? `/energia/pontos/${id}` : '/energia/pontos',
              corpo,
              id ? 'Ponto atualizado.' : 'Ponto cadastrado.'
            );
            if (ok) setEditando(null);
          }}
        />
      )}
    </div>
  );
}

function PontoDialog({
  ponto,
  painel,
  onFechar,
  onSalvar,
}: {
  ponto: Ponto | null;
  painel: AbaProps['painel'];
  onFechar: () => void;
  onSalvar: (f: Form, id?: number) => Promise<void>;
}) {
  const [f, setF] = useState<Form>(() =>
    ponto
      ? {
          nome: ponto.nome,
          titular: ponto.titular,
          uc: ponto.uc || '',
          distribuidora: ponto.distribuidora,
          grupo: ponto.grupo,
          ucPropria: ponto.ucPropria,
          consumoMensalKwh: ponto.consumoMensalKwh,
          carregadores: ponto.carregadores,
        }
      : vazio
  );
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    if (!completo) return;
    setSalvando(true);
    await onSalvar(f, ponto?.id);
    setSalvando(false);
  };
  const set =
    <K extends keyof Form>(k: K) =>
    (v: Form[K]) =>
      setF(o => ({ ...o, [k]: v }));
  const completo = f.nome && f.titular && f.consumoMensalKwh !== '';

  return (
    <Dialog open onOpenChange={o => !o && onFechar()}>
      <DialogContent className="bg-surface-container border-outline-variant/20 sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-on-surface font-headline flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">ev_station</span>
            {ponto ? `Editar ${ponto.nome}` : 'Cadastrar ponto consumidor'}
          </DialogTitle>
          <DialogDescription className="text-on-surface-variant">
            O titular decide o autoconsumo remoto: só funciona com o mesmo CNPJ da usina. Ponto na
            UC do prédio recebe o crédito na conta do prédio.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2"
          onSubmit={e => {
            e.preventDefault();
            void salvar();
          }}
        >
          <Campo rotulo="Nome do ponto">
            <Texto
              valor={f.nome}
              onChange={set('nome')}
              placeholder="Ex.: Vá de Bike Shop"
              max={120}
            />
          </Campo>
          <Campo rotulo="Titular (CNPJ ou razão social)">
            <Texto valor={f.titular} onChange={set('titular')} max={160} />
          </Campo>
          <Campo rotulo="Distribuidora">
            <Escolha
              valor={f.distribuidora}
              onChange={set('distribuidora')}
              opcoes={Object.entries(painel.distribuidoras).map(([v, t]) => ({
                v: v as 'AM' | 'RR',
                t,
              }))}
            />
          </Campo>
          <Campo rotulo="Grupo tarifário">
            <Escolha
              valor={f.grupo}
              onChange={set('grupo')}
              opcoes={[
                { v: 'B', t: 'Grupo B (baixa tensão)' },
                { v: 'A', t: 'Grupo A (média tensão)' },
              ]}
            />
          </Campo>
          <Campo rotulo="Consumo (kWh/mês)">
            <Numero valor={f.consumoMensalKwh} onChange={set('consumoMensalKwh')} step={100} />
          </Campo>
          <Campo rotulo="Carregadores">
            <Texto
              valor={f.carregadores}
              onChange={set('carregadores')}
              placeholder="Ex.: 2 × 60 kW"
              max={80}
            />
          </Campo>
          <div className="sm:col-span-2">
            <Marcar marcado={f.ucPropria} onChange={set('ucPropria')}>
              O ponto tem UC própria (não usa a do prédio)
            </Marcar>
          </div>
          {f.ucPropria && (
            <Campo rotulo="Número da UC" dica="Vai no arquivo de rateio">
              <Texto valor={f.uc} onChange={set('uc')} max={40} />
            </Campo>
          )}
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <Botao onClick={onFechar}>Cancelar</Botao>
            <Botao primario type="submit" disabled={!completo || salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </Botao>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
