import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import type { Modalidade, Usina } from '../../lib/energia';
import { brl, kwh, pct } from '../../lib/energia';
import type { AbaProps } from './tipos';
import { Campo, Escolha, Marcar, Numero, Texto } from './campos';
import { Botao, Medidor, Painel, Selo, Sigla, Sub, Tabela, Td } from './ui';

const STATUS_USINA = {
  operando: 'operando',
  homologacao: 'em homologação',
  desativada: 'desativada',
} as const;

type Form = {
  nome: string;
  dono: string;
  uc: string;
  distribuidora: 'AM' | 'RR';
  grupo: 'A' | 'B';
  potenciaKwp: number | '';
  potenciaKwac: number | '';
  geracaoMensalKwh: number | '';
  creditoAcumuladoKwh: number | '';
  custoFixoMensal: number | '';
  custoFixoDescricao: string;
  modalidades: Modalidade[];
  status: Usina['status'];
};

const vazio: Form = {
  nome: '',
  dono: '',
  uc: '',
  distribuidora: 'AM',
  grupo: 'B',
  potenciaKwp: '',
  potenciaKwac: '',
  geracaoMensalKwh: '',
  creditoAcumuladoKwh: 0,
  custoFixoMensal: 0,
  custoFixoDescricao: '',
  modalidades: ['cons'],
  status: 'homologacao',
};

export function Usinas({ painel, podeEditar, mudar }: AbaProps) {
  const [editando, setEditando] = useState<Usina | 'nova' | null>(null);

  return (
    <div className="space-y-6">
      <Painel
        titulo="Usinas"
        detalhe="Ligadas à rede NeoPower"
        acao={
          podeEditar && (
            <Botao primario onClick={() => setEditando('nova')}>
              <span className="material-symbols-outlined text-base">add</span>Cadastrar usina
            </Botao>
          )
        }
      >
        <Tabela
          vazio={
            painel.usinas.length
              ? undefined
              : 'Nenhuma usina cadastrada ainda.' +
                (podeEditar ? ' Use “Cadastrar usina” para começar.' : '')
          }
          cabecalho={[
            'Usina',
            'Dono',
            'UC',
            { t: 'Geração/mês', n: true },
            'Ocupação',
            { t: 'Acumulado', n: true },
            { t: 'Custo fixo', n: true },
            'Modalidades',
            'Status',
            ...(podeEditar ? [''] : []),
          ]}
        >
          {painel.usinas.map(u => (
            <tr key={u.id}>
              <Td>
                <b>{u.nome}</b>
                <Sub>
                  Grupo {u.grupo} · {u.potenciaKwac} kW / {u.potenciaKwp} kWp
                </Sub>
              </Td>
              <Td>{u.dono}</Td>
              <Td>
                {u.uc}
                <Sub>{painel.distribuidoras[u.distribuidora]}</Sub>
              </Td>
              <Td n>{kwh(u.geracaoMensalKwh)}</Td>
              <Td>
                <Medidor valor={u.ocupacao} alerta={u.status === 'operando' && u.ocupacao < 0.5} />
                <Sub>
                  {pct(u.ocupacao)} · livre {kwh(u.livreKwh)}
                </Sub>
              </Td>
              <Td n>
                {u.creditoAcumuladoKwh ? (
                  <Selo tom="aviso">{kwh(u.creditoAcumuladoKwh)}</Selo>
                ) : (
                  '0'
                )}
              </Td>
              <Td n>
                {brl(u.custoFixoMensal)}
                <Sub>{u.custoFixoDescricao || '—'}</Sub>
              </Td>
              <Td>
                <span className="flex flex-wrap gap-1">
                  {u.modalidades.map(m => (
                    <Sigla key={m}>{painel.modalidades[m].sigla}</Sigla>
                  ))}
                </span>
              </Td>
              <Td>
                <Selo tom={u.status === 'operando' ? 'ok' : 'neutro'}>
                  {STATUS_USINA[u.status]}
                </Selo>
              </Td>
              {podeEditar && (
                <Td>
                  <Botao pequeno onClick={() => setEditando(u)}>
                    Editar
                  </Botao>
                </Td>
              )}
            </tr>
          ))}
        </Tabela>
        <p className="px-6 py-4 text-xs text-on-surface-variant border-t border-outline-variant/10">
          O custo fixo da UC da usina (demanda, consumo mínimo) é rateado entre as cotas antes de
          calcular o benefício.
          {painel.usinas
            .filter(u => u.custoFixoPorKwh > 0.02)
            .map(u => ` Na ${u.nome}, ele pesa ${brl(u.custoFixoPorKwh)} por kWh.`)}
        </p>
      </Painel>

      {editando && (
        <UsinaDialog
          usina={editando === 'nova' ? null : editando}
          painel={painel}
          onFechar={() => setEditando(null)}
          onSalvar={async (f, id) => {
            const ok = await mudar(
              id ? 'put' : 'post',
              id ? `/energia/usinas/${id}` : '/energia/usinas',
              f,
              id ? 'Usina atualizada.' : 'Usina cadastrada.'
            );
            if (ok) setEditando(null);
          }}
        />
      )}
    </div>
  );
}

function UsinaDialog({
  usina,
  painel,
  onFechar,
  onSalvar,
}: {
  usina: Usina | null;
  painel: AbaProps['painel'];
  onFechar: () => void;
  onSalvar: (f: Form, id?: number) => Promise<void>;
}) {
  const [f, setF] = useState<Form>(() =>
    usina
      ? {
          nome: usina.nome,
          dono: usina.dono,
          uc: usina.uc,
          distribuidora: usina.distribuidora,
          grupo: usina.grupo,
          potenciaKwp: usina.potenciaKwp,
          potenciaKwac: usina.potenciaKwac,
          geracaoMensalKwh: usina.geracaoMensalKwh,
          creditoAcumuladoKwh: usina.creditoAcumuladoKwh,
          custoFixoMensal: usina.custoFixoMensal,
          custoFixoDescricao: usina.custoFixoDescricao || '',
          modalidades: usina.modalidades,
          status: usina.status,
        }
      : vazio
  );
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    if (!completo) return;
    setSalvando(true);
    await onSalvar(f, usina?.id);
    setSalvando(false);
  };
  const set =
    <K extends keyof Form>(k: K) =>
    (v: Form[K]) =>
      setF(o => ({ ...o, [k]: v }));
  const alternar = (m: Modalidade, on: boolean) =>
    set('modalidades')(on ? [...f.modalidades, m] : f.modalidades.filter(x => x !== m));
  const completo =
    f.nome &&
    f.dono &&
    f.uc &&
    f.potenciaKwp !== '' &&
    f.potenciaKwac !== '' &&
    f.geracaoMensalKwh !== '' &&
    f.custoFixoMensal !== '' &&
    f.creditoAcumuladoKwh !== '' &&
    f.modalidades.length > 0;

  return (
    <Dialog open onOpenChange={o => !o && onFechar()}>
      <DialogContent className="bg-surface-container border-outline-variant/20 sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-on-surface font-headline flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">solar_power</span>
            {usina ? `Editar ${usina.nome}` : 'Cadastrar usina'}
          </DialogTitle>
          <DialogDescription className="text-on-surface-variant">
            A geração prevista define quanto dá para distribuir em cotas. O custo fixo da UC entra
            na conta de cada ponto, proporcional à cota.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2"
          onSubmit={e => {
            e.preventDefault();
            void salvar();
          }}
        >
          <Campo rotulo="Nome">
            <Texto
              valor={f.nome}
              onChange={set('nome')}
              placeholder="Ex.: Ecofin Iranduba 3"
              max={120}
            />
          </Campo>
          <Campo rotulo="Dono">
            <Texto valor={f.dono} onChange={set('dono')} placeholder="Razão social" max={160} />
          </Campo>
          <Campo rotulo="UC da usina">
            <Texto valor={f.uc} onChange={set('uc')} placeholder="Número da UC" max={40} />
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
          <Campo rotulo="Potência (kWp)">
            <Numero valor={f.potenciaKwp} onChange={set('potenciaKwp')} step={0.01} />
          </Campo>
          <Campo rotulo="Potência (kW AC)">
            <Numero valor={f.potenciaKwac} onChange={set('potenciaKwac')} step={0.01} />
          </Campo>
          <Campo rotulo="Geração prevista (kWh/mês)">
            <Numero valor={f.geracaoMensalKwh} onChange={set('geracaoMensalKwh')} step={100} />
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
          <Campo rotulo="Custo fixo da UC (R$/mês)" dica="Demanda contratada ou consumo mínimo">
            <Numero valor={f.custoFixoMensal} onChange={set('custoFixoMensal')} step={0.01} />
          </Campo>
          <Campo rotulo="O que é o custo fixo">
            <Texto
              valor={f.custoFixoDescricao}
              onChange={set('custoFixoDescricao')}
              placeholder="Ex.: demanda 30 kW"
              max={80}
            />
          </Campo>
          <Campo rotulo="Crédito acumulado (kWh)" dica="Saldo parado na UC, da última fatura">
            <Numero valor={f.creditoAcumuladoKwh} onChange={set('creditoAcumuladoKwh')} step={1} />
          </Campo>
          <Campo rotulo="Status">
            <Escolha
              valor={f.status}
              onChange={set('status')}
              opcoes={[
                { v: 'homologacao', t: 'Em homologação' },
                { v: 'operando', t: 'Operando' },
                { v: 'desativada', t: 'Desativada' },
              ]}
            />
          </Campo>
          <div className="sm:col-span-2 flex flex-col gap-2">
            <span className="text-on-surface-variant text-[11px] uppercase tracking-widest font-bold">
              Modalidades que a usina aceita
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(painel.modalidades) as Modalidade[]).map(m => (
                <Marcar
                  key={m}
                  marcado={f.modalidades.includes(m)}
                  onChange={on => alternar(m, on)}
                >
                  {painel.modalidades[m].nome}
                </Marcar>
              ))}
            </div>
          </div>
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
