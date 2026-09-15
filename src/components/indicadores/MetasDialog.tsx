import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  mesPorExtenso,
  STATUS_META,
  type ItemMeta,
  type MetaNumerica,
  type StatusMeta,
} from './tipos';

const CAMPOS: Array<{ chave: MetaNumerica['chave']; rotulo: string; dica: string; passo: string }> =
  [
    {
      chave: 'faturamento',
      rotulo: 'Faturamento em recarga (R$)',
      dica: 'Ex.: 75000',
      passo: '100',
    },
    { chave: 'operacoes', rotulo: 'Transações no mês', dica: 'Ex.: 3000', passo: '1' },
    { chave: 'energiaKwh', rotulo: 'Energia fornecida (kWh)', dica: 'Ex.: 60000', passo: '100' },
    { chave: 'novosUsuarios', rotulo: 'Novos usuários', dica: 'Ex.: 250', passo: '1' },
    {
      chave: 'baseUsuarios',
      rotulo: 'Usuários na plataforma (acum.)',
      dica: 'Ex.: 1100',
      passo: '1',
    },
    { chave: 'baseAtivaPct', rotulo: 'Base ativa no mês (%)', dica: 'Ex.: 40', passo: '0.5' },
  ];

const AREAS_SUGERIDAS = [
  'Produto & Rede',
  'Financeiro & Marketing',
  'Comercial',
  'Jurídico',
  'Engenharia',
  'Diretoria',
];

const STATUS_EDITAVEIS: StatusMeta[] = [
  'pendente',
  'em_andamento',
  'bateu',
  'quase',
  'nao_bateu',
  'dispensada',
];

interface Props {
  aberto: boolean;
  onFechar: () => void;
  mes: string;
  numericas: MetaNumerica[];
  itens: ItemMeta[];
  onSalvo: () => void;
}

export function MetasDialog({ aberto, onFechar, mes, numericas, itens, onSalvo }: Props) {
  const [valores, setValores] = useState<Record<string, string>>({});
  const [lista, setLista] = useState<ItemMeta[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setValores(
      Object.fromEntries(
        numericas.map(n => [n.chave, n.meta === null || n.meta === undefined ? '' : String(n.meta)])
      )
    );
    setLista(itens.length ? itens.map(i => ({ ...i })) : []);
  }, [aberto, numericas, itens]);

  const atualizarItem = (idx: number, patch: Partial<ItemMeta>) =>
    setLista(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const salvar = async () => {
    setSalvando(true);
    try {
      const corpo: Record<string, unknown> = { itens: lista.filter(i => i.descricao.trim()) };
      for (const c of CAMPOS)
        corpo[c.chave] = valores[c.chave] === '' ? null : Number(valores[c.chave]);
      const resp = await api.put(`/indicators/metas/${mes}`, corpo);
      if (!resp.ok) {
        const erro = await resp.json().catch(() => null);
        throw new Error(erro?.error || 'Não foi possível salvar as metas');
      }
      toast.success('Metas salvas');
      onSalvo();
      onFechar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={o => !o && onFechar()}>
      <DialogContent className="bg-surface-container border-outline-variant/20 sm:max-w-[760px] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-on-surface font-headline flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">flag</span>
            Metas de {mesPorExtenso(mes)}
          </DialogTitle>
          <DialogDescription className="text-on-surface-variant">
            As metas numéricas são comparadas automaticamente com o resultado do mês. As metas por
            área são acompanhadas manualmente: escreva o resultado e marque a situação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section>
            <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">
              Indicadores numéricos
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CAMPOS.map(c => (
                <div key={c.chave} className="space-y-1.5">
                  <Label className="text-on-surface-variant text-xs">{c.rotulo}</Label>
                  <Input
                    type="number"
                    min={0}
                    step={c.passo}
                    inputMode="decimal"
                    placeholder={c.dica}
                    value={valores[c.chave] ?? ''}
                    onChange={e => setValores(v => ({ ...v, [c.chave]: e.target.value }))}
                    className="bg-surface-container-high border-outline-variant/20 text-on-surface"
                  />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-on-surface-variant mt-2">
              Deixe em branco o que não tiver meta.
            </p>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Metas por área
              </h4>
              <button
                type="button"
                onClick={() =>
                  setLista(prev => [
                    ...prev,
                    {
                      area: prev[prev.length - 1]?.area || AREAS_SUGERIDAS[0],
                      descricao: '',
                      resultado: '',
                      status: 'pendente',
                    },
                  ])
                }
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <span className="material-symbols-outlined text-base">add</span>
                Adicionar meta
              </button>
            </div>

            {lista.length === 0 && (
              <p className="text-sm text-on-surface-variant border border-dashed border-outline-variant/30 rounded-lg p-4 text-center">
                Nenhuma meta por área. Use para entregas que não saem das transações (inaugurações,
                contratos, vídeos…).
              </p>
            )}

            <datalist id="areas-metas">
              {AREAS_SUGERIDAS.map(a => (
                <option key={a} value={a} />
              ))}
            </datalist>

            <div className="space-y-3">
              {lista.map((it, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-outline-variant/20 bg-surface-container-high/50 p-3 space-y-2"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr_auto] gap-2">
                    <Input
                      list="areas-metas"
                      value={it.area}
                      onChange={e => atualizarItem(idx, { area: e.target.value })}
                      placeholder="Área"
                      className="bg-surface-container-high border-outline-variant/20 text-on-surface"
                    />
                    <Input
                      value={it.descricao}
                      onChange={e => atualizarItem(idx, { descricao: e.target.value })}
                      placeholder="Meta (ex.: 3 novos postos inaugurados)"
                      className="bg-surface-container-high border-outline-variant/20 text-on-surface"
                    />
                    <button
                      type="button"
                      aria-label="Remover meta"
                      onClick={() => setLista(prev => prev.filter((_, i) => i !== idx))}
                      className="h-9 w-9 inline-flex items-center justify-center rounded-md text-on-surface-variant hover:text-error hover:bg-error/10"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-2">
                    <Input
                      value={it.resultado}
                      onChange={e => atualizarItem(idx, { resultado: e.target.value })}
                      placeholder="Resultado (ex.: 1 inaugurado, 2 em obra)"
                      className="bg-surface-container-high border-outline-variant/20 text-on-surface"
                    />
                    <select
                      value={it.status}
                      onChange={e => atualizarItem(idx, { status: e.target.value as StatusMeta })}
                      className="h-9 rounded-md border border-outline-variant/20 bg-surface-container-high px-2 text-sm text-on-surface"
                    >
                      {STATUS_EDITAVEIS.map(s => (
                        <option key={s} value={s}>
                          {STATUS_META[s].rotulo}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={onFechar}
            className="px-4 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:bg-surface-container-highest"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-on-primary disabled:opacity-60"
          >
            {salvando ? 'Salvando…' : 'Salvar metas'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
