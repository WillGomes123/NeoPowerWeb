import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Profiles } from './Profiles';
import { useAuth } from '../lib/auth';
import { BadgeCheck, CirclePlus, Tag } from 'lucide-react';
import {
  AbasDaPagina,
  BlocoDeIcone,
  BotaoAtualizar,
  CabecalhoDaPagina,
  classeDaPilula,
  classeDoCartao,
} from '../components/painel/Pagina';
import {
  BarraDeFiltros,
  CampoDeBusca,
  classeDoBotaoContorno,
  classeDoBotaoPrincipal,
} from '../components/painel/Pecas';
import {
  classeDaCelula,
  classeDaTabela,
  classeDoTh,
  fundoDaLinha,
} from '../components/financeiro/Pecas';

interface Tariff {
  id: number;
  price_per_kwh: number;
  min_price?: number;
  /** Taxa de destrava (R$ por recarga). */
  connection_fee?: number | null;
  /** Saldo mínimo na carteira para INICIAR (R$); não muda o que é cobrado. */
  saldo_minimo_inicio?: number | null;
  location_address: string | null;
  location_id?: number | null;
  charge_point_id?: string | null;
  profileId?: number | null;
  profileName?: string | null;
  /** Preço por horário (sub-rotina): faixas no fuso do local. */
  faixas_horarias?: FaixaHoraria[] | null;
  /** Preço por faixa de energia: por trecho da recarga. */
  faixas_energia?: FaixaDeEnergia[] | null;
  created_at: string;
  is_current: boolean;
}

/** Faixa de preço por horário, no fuso do local. O fim conta o minuto inteiro. */
interface FaixaHoraria {
  inicio: string;
  fim: string;
  preco: number;
  /** 0 = domingo … 6 = sábado; ausente = todos os dias. */
  dias?: number[];
  rotulo?: string | null;
}

/** Faixa de preço por energia da recarga; ateKwh null = última, sem limite. */
interface FaixaDeEnergia {
  ateKwh: number | null;
  preco: number;
}

/** Faixa de energia em edição, como digitada; a última não tem limite. */
interface FaixaDeEnergiaEmEdicao {
  ateKwh: string;
  preco: string;
}

/** Faixa em edição: o preço fica em texto, como digitado; dias [] = todos. */
interface FaixaEmEdicao {
  inicio: string;
  fim: string;
  preco: string;
  dias: number[];
}

const DIAS_DA_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const rotuloDosDias = (dias?: number[]) =>
  !dias || dias.length === 0 || dias.length === 7 ? '' : ` · ${dias.map(d => DIAS_DA_SEMANA[d]).join(', ')}`;

/** Liga/desliga um dia da faixa. [] = todos; nunca fica sem dia nenhum. */
function alternarDia(dias: number[], dia: number): number[] {
  const atual = dias.length === 0 ? [0, 1, 2, 3, 4, 5, 6] : dias;
  const nova = atual.includes(dia) ? atual.filter(d => d !== dia) : [...atual, dia].sort((a, b) => a - b);
  if (nova.length === 0) return dias;
  return nova.length === 7 ? [] : nova;
}

interface Location {
  id: number;
  nomeDoLocal: string;
  endereco: string;
  numero?: string | null;
}

interface ProfileOption {
  id: number;
  name: string;
  color?: string | null;
}

type FilterType = 'all' | 'global' | 'profile' | 'local' | 'charger';

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

const formatarDataCurta = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

const formatarDataCompleta = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

/** Tarifa de local "pura": de um local, sem perfil e sem carregador. */
const ehDeLocal = (t: Tariff) =>
  !t.profileId && !t.charge_point_id && (t.location_id != null || !!t.location_address);

/** Global: sem local, sem endereço, sem perfil e sem carregador. */
const ehGlobal = (t: Tariff) =>
  !t.location_address && t.location_id == null && !t.profileId && !t.charge_point_id;

/** Escopo da tarifa editada — o mesmo que ela já tinha. */
interface EscopoDaEdicao {
  locationId?: number | null;
  locationAddress?: string | null;
  profileId?: number | null;
  chargePointId?: string | null;
}

/**
 * Cor de cada tipo de preço. O dono acha a tarifa pela cor (15/10/2026): local
 * em ciano, carregador em violeta, perfil na cor secundária, global na cor da
 * marca. A tela de Tarifas não tem desenho da Lauriane, então vale o pedido do
 * dono; do redesenho vem só o formato (bloco de ícone de 41×38, cantos de 5 px).
 */
type Destaque = 'global' | 'local' | 'carregador' | 'perfil';
const BLOCO_DO_TIPO: Record<Destaque, string> = {
  global: 'bg-primary-soft text-primary-strong',
  local: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300',
  carregador: 'bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300',
  perfil: 'bg-secondary/30 text-secondary-foreground dark:bg-secondary/15 dark:text-secondary',
};
/** O mesmo tom, só no ícone (histórico e títulos dos grupos). */
const COR_DO_ICONE: Record<Destaque, string> = {
  global: 'text-primary-strong',
  local: 'text-cyan-700 dark:text-cyan-300',
  carregador: 'text-violet-700 dark:text-violet-300',
  perfil: 'text-secondary-foreground dark:text-secondary',
};

/** Selo dos cartões: pílula com ícone e texto, nos tons de estado do Figma. */
const SELO = 'inline-flex items-center gap-1 h-7 px-3 rounded-[25px] text-xs font-semibold whitespace-nowrap';

/** Mínimo, destrava, saldo para iniciar e faixas de preço, nos selos coloridos (só o que existe). */
const SelosDaTarifa = ({
  minimo,
  destrava,
  saldoInicio,
  faixas,
  faixasEnergia,
}: {
  minimo?: number | null;
  destrava?: number | null;
  saldoInicio?: number | null;
  faixas?: FaixaHoraria[] | null;
  faixasEnergia?: FaixaDeEnergia[] | null;
}) => {
  const temMinimo = minimo != null && Number(minimo) > 0;
  const temDestrava = destrava != null && Number(destrava) > 0;
  const temSaldoInicio = saldoInicio != null && Number(saldoInicio) > 0;
  const comFaixas = faixas ?? [];
  const porEnergia = faixasEnergia ?? [];
  if (!temMinimo && !temDestrava && !temSaldoInicio && comFaixas.length === 0 && porEnergia.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {porEnergia.map((f, i) => (
        <span
          key={f.ateKwh ?? 'acima'}
          className={`${SELO} bg-tom-amarelo text-estado-problema-forte`}
          title="Preço por energia: cada trecho da recarga paga o preço da sua faixa"
        >
          <span className="material-symbols-outlined text-[13px]">battery_charging_full</span>
          {f.ateKwh != null ? `até ${f.ateKwh} kWh` : `acima de ${porEnergia[i - 1]?.ateKwh ?? 0} kWh`} ·{' '}
          {formatarMoeda(Number(f.preco))}
        </span>
      ))}
      {comFaixas.map(f => (
        <span
          key={`${f.inicio}-${f.fim}-${(f.dias ?? []).join('')}`}
          className={`${SELO} bg-tom-azul text-estado-uso-forte`}
          title="Preço por horário: no horário do local, o fim conta o minuto inteiro"
        >
          <span className="material-symbols-outlined text-[13px]">schedule</span>
          {f.inicio}–{f.fim} · {formatarMoeda(Number(f.preco))}
          {rotuloDosDias(f.dias)}
        </span>
      ))}
      {temMinimo && (
        <span
          className={`${SELO} bg-tom-cinza text-tom-cinza-icone`}
          title="Mínimo cobrado por recarga com energia"
        >
          <span className="material-symbols-outlined text-[13px]">bolt</span>
          mín. {formatarMoeda(Number(minimo))}
        </span>
      )}
      {temDestrava && (
        <span className={`${SELO} bg-tom-azul text-estado-uso-forte`}>
          <span className="material-symbols-outlined text-[13px]">lock_open</span>
          destrava {formatarMoeda(Number(destrava))}
        </span>
      )}
      {temSaldoInicio && (
        <span
          className={`${SELO} bg-estado-livre text-estado-livre-forte`}
          title="Saldo que o cliente precisa ter na carteira para começar; não muda o que é cobrado"
        >
          <span className="material-symbols-outlined text-[13px]">account_balance_wallet</span>
          saldo p/ iniciar {formatarMoeda(Number(saldoInicio))}
        </span>
      )}
    </div>
  );
};

interface EdicaoDePreco {
  editPrice: string;
  setEditPrice: (v: string) => void;
  editMinPrice: string;
  setEditMinPrice: (v: string) => void;
  /** Taxa de destrava em edição (vazio = sem). */
  editDestrava: string;
  setEditDestrava: (v: string) => void;
  /** Saldo mínimo para iniciar em edição (vazio = sem). */
  editSaldoInicio: string;
  setEditSaldoInicio: (v: string) => void;
  /** Faixas de preço por horário em edição. */
  faixasEmEdicao: FaixaEmEdicao[];
  setFaixasEmEdicao: (f: FaixaEmEdicao[]) => void;
  /** Faixas de preço por energia em edição. */
  faixasDeEnergiaEmEdicao: FaixaDeEnergiaEmEdicao[];
  setFaixasDeEnergiaEmEdicao: (f: FaixaDeEnergiaEmEdicao[]) => void;
  onCancelar: () => void;
  onSalvar: () => Promise<void>;
  salvando: boolean;
}

// O seletor de hora nativo segue o tema (antes ficava escuro também no claro).
const CAMPO_DA_FAIXA =
  'bg-background border border-border text-foreground rounded-[5px] px-1.5 py-1 text-xs tabular-nums focus:outline-none focus:border-primary dark:[color-scheme:dark]';

/** Campo de valor do editor de preço do cartão. */
const CAMPO_DO_PRECO =
  'w-24 bg-background border border-border text-foreground rounded-[5px] px-2 py-1.5 tabular-nums focus:outline-none focus:border-primary';

/**
 * Preço por horário — a "sub-rotina" da tarifa que o operador programa: em
 * cada faixa, um preço próprio (ex.: ponta das 18:00 às 20:59 a R$ 2,99). A
 * recarga paga o preço do horário em que a energia entrou.
 */
const EditorDeFaixas = ({
  faixasEmEdicao: faixas,
  setFaixasEmEdicao: setFaixas,
}: Pick<EdicaoDePreco, 'faixasEmEdicao' | 'setFaixasEmEdicao'>) => {
  const mudar = (i: number, parcial: Partial<FaixaEmEdicao>) =>
    setFaixas(faixas.map((f, j) => (j === i ? { ...f, ...parcial } : f)));
  return (
    <div className="space-y-2 rounded-[10px] bg-muted/60 dark:bg-muted/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground">
          <span aria-hidden="true" className="material-symbols-outlined text-[14px] text-estado-uso-forte">schedule</span>
          Preço por horário
        </span>
        <button
          type="button"
          onClick={() => setFaixas([...faixas, { inicio: '18:00', fim: '20:59', preco: '', dias: [] }])}
          className="text-xs font-semibold text-primary-strong hover:underline"
        >
          + faixa
        </button>
      </div>
      {faixas.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem faixas: o preço acima vale o dia todo.</p>
      ) : (
        faixas.map((f, i) => (
          <div key={i} className="space-y-1.5 border-t border-border pt-2 first:border-t-0 first:pt-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="time"
                aria-label="Início da faixa"
                value={f.inicio}
                onChange={e => mudar(i, { inicio: e.target.value })}
                className={CAMPO_DA_FAIXA}
              />
              <span className="text-xs text-muted-foreground">até</span>
              <input
                type="time"
                aria-label="Fim da faixa"
                value={f.fim}
                onChange={e => mudar(i, { fim: e.target.value })}
                className={CAMPO_DA_FAIXA}
              />
              <span className="text-xs font-semibold text-foreground">R$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                aria-label="Preço da faixa por kWh"
                placeholder="0,00"
                value={f.preco}
                onChange={e => mudar(i, { preco: e.target.value })}
                className={`w-20 ${CAMPO_DA_FAIXA}`}
              />
              <button
                type="button"
                aria-label="Remover faixa"
                onClick={() => setFaixas(faixas.filter((_, j) => j !== i))}
                className="material-symbols-outlined text-[16px] text-muted-foreground hover:text-destructive"
              >
                delete
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {DIAS_DA_SEMANA.map((dia, n) => {
                const ativo = f.dias.length === 0 || f.dias.includes(n);
                return (
                  <button
                    key={dia}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => mudar(i, { dias: alternarDia(f.dias, n) })}
                    className={`px-2 py-0.5 rounded-[25px] text-[11px] font-semibold transition-colors ${ativo ? 'bg-primary-soft text-primary-strong' : 'bg-card text-muted-foreground'}`}
                  >
                    {dia}
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
      <p className="text-[11px] text-muted-foreground">
        Horário do local; o fim conta o minuto inteiro (20:59 vai até 20:59:59). Fora das faixas vale o
        preço acima.
      </p>
    </div>
  );
};

/**
 * Preço por energia: o kWh muda conforme a recarga avança, por trecho (os
 * primeiros 10 kWh a R$ 1,29, até 15 kWh a R$ 1,19 e o resto a R$ 0,99). A última
 * faixa não tem limite. O preço por kWh da tarifa passa a ser o da primeira faixa.
 */
const EditorDeFaixasDeEnergia = ({
  faixasDeEnergiaEmEdicao: faixas,
  setFaixasDeEnergiaEmEdicao: setFaixas,
}: Pick<EdicaoDePreco, 'faixasDeEnergiaEmEdicao' | 'setFaixasDeEnergiaEmEdicao'>) => {
  const mudar = (i: number, parcial: Partial<FaixaDeEnergiaEmEdicao>) =>
    setFaixas(faixas.map((f, j) => (j === i ? { ...f, ...parcial } : f)));
  const adicionar = () =>
    setFaixas(
      faixas.length === 0
        ? [
            { ateKwh: '10', preco: '' },
            { ateKwh: '', preco: '' },
          ]
        : [...faixas.slice(0, -1), { ateKwh: '', preco: '' }, faixas[faixas.length - 1]]
    );
  return (
    <div className="space-y-2 rounded-[10px] bg-muted/60 dark:bg-muted/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground">
          <span aria-hidden="true" className="material-symbols-outlined text-[14px] text-estado-problema-forte">battery_charging_full</span>
          Preço por energia
        </span>
        <button type="button" onClick={adicionar} className="text-xs font-semibold text-primary-strong hover:underline">
          + faixa
        </button>
      </div>
      {faixas.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem faixas: o mesmo preço vale para toda a recarga.</p>
      ) : (
        faixas.map((f, i) => {
          const ultima = i === faixas.length - 1;
          return (
            <div key={i} className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {ultima ? (
                <span>acima de {faixas[i - 1]?.ateKwh || '…'} kWh</span>
              ) : (
                <label className="flex items-center gap-1.5">
                  até
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    inputMode="decimal"
                    aria-label="Limite da faixa em kWh"
                    value={f.ateKwh}
                    onChange={e => mudar(i, { ateKwh: e.target.value })}
                    className={`w-16 ${CAMPO_DA_FAIXA}`}
                  />
                  kWh
                </label>
              )}
              <label className="flex items-center gap-1.5">
                a R$
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  aria-label="Preço da faixa por kWh"
                  value={f.preco}
                  onChange={e => mudar(i, { preco: e.target.value })}
                  className={`w-20 ${CAMPO_DA_FAIXA}`}
                />
              </label>
              <button
                type="button"
                aria-label="Remover faixa"
                onClick={() => {
                  const resto = faixas.filter((_, j) => j !== i);
                  setFaixas(resto.length < 2 ? [] : resto);
                }}
                className="text-muted-foreground hover:text-destructive"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          );
        })
      )}
      <p className="text-[11px] text-muted-foreground">
        Por trecho: quem passa de uma faixa paga o preço dela só no que passou. Com faixas, o preço por kWh da
        tarifa é o da primeira, e o preço por horário fica desligado.
      </p>
    </div>
  );
};

/** Campos de preço, mínimo, destrava, saldo para iniciar e faixas de preço, com Salvar e Cancelar. */
const EditorDePreco = ({
  editPrice,
  setEditPrice,
  editMinPrice,
  setEditMinPrice,
  editDestrava,
  setEditDestrava,
  editSaldoInicio,
  setEditSaldoInicio,
  faixasEmEdicao,
  setFaixasEmEdicao,
  faixasDeEnergiaEmEdicao,
  setFaixasDeEnergiaEmEdicao,
  onCancelar,
  onSalvar,
  salvando,
}: EdicaoDePreco) => (
  <div className="space-y-2.5">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <label className="flex items-center gap-1.5">
        <span className="text-sm font-semibold text-foreground">R$</span>
        <input
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          aria-label="Preço por kWh"
          value={faixasDeEnergiaEmEdicao[0]?.preco ?? editPrice}
          onChange={e => setEditPrice(e.target.value)}
          disabled={faixasDeEnergiaEmEdicao.length > 0}
          autoFocus
          className={`${CAMPO_DO_PRECO} text-base font-semibold`}
        />
        <span className="text-xs text-muted-foreground">/kWh</span>
      </label>
      <label className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">mín.</span>
        <input
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          aria-label="Mínimo por recarga"
          placeholder="opcional"
          value={editMinPrice}
          onChange={e => setEditMinPrice(e.target.value)}
          className={`${CAMPO_DO_PRECO} text-xs`}
        />
      </label>
      <label
        className="flex items-center gap-1.5"
        title="Valor fixo cobrado em cada recarga, somado à energia assim que a recarga entrega energia"
      >
        <span className="text-xs text-muted-foreground">destrava</span>
        <input
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          aria-label="Taxa de destrava"
          placeholder="opcional"
          value={editDestrava}
          onChange={e => setEditDestrava(e.target.value)}
          className={`${CAMPO_DO_PRECO} text-xs`}
        />
      </label>
      <label
        className="flex items-center gap-1.5"
        title="Saldo que o cliente precisa ter na carteira para começar; não muda o que é cobrado"
      >
        <span className="text-xs text-muted-foreground">saldo p/ iniciar</span>
        <input
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          aria-label="Saldo mínimo para iniciar"
          placeholder="opcional"
          value={editSaldoInicio}
          onChange={e => setEditSaldoInicio(e.target.value)}
          className={`${CAMPO_DO_PRECO} text-xs`}
        />
      </label>
    </div>
    {faixasDeEnergiaEmEdicao.length === 0 && (
      <EditorDeFaixas faixasEmEdicao={faixasEmEdicao} setFaixasEmEdicao={setFaixasEmEdicao} />
    )}
    {faixasEmEdicao.length === 0 && (
      <EditorDeFaixasDeEnergia
        faixasDeEnergiaEmEdicao={faixasDeEnergiaEmEdicao}
        setFaixasDeEnergiaEmEdicao={setFaixasDeEnergiaEmEdicao}
      />
    )}
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => void onSalvar()}
        disabled={salvando}
        className="flex-1 h-9 px-4 rounded-[25px] bg-primary text-primary-foreground font-medium text-sm hover:brightness-105 active:scale-[0.98] transition disabled:opacity-50"
      >
        {salvando ? 'Salvando...' : 'Salvar'}
      </button>
      <button
        type="button"
        onClick={onCancelar}
        className="flex-1 h-9 px-4 rounded-[25px] bg-[#d9d9d9] dark:bg-muted text-foreground font-medium text-sm hover:brightness-95 transition"
      >
        Cancelar
      </button>
    </div>
  </div>
);

interface CartaoDePrecoProps extends EdicaoDePreco {
  destaque: Destaque;
  icone: string;
  titulo: string;
  subtitulo?: string | null;
  preco: number;
  minimo?: number | null;
  destrava?: number | null;
  saldoInicio?: number | null;
  faixas?: FaixaHoraria[] | null;
  faixasEnergia?: FaixaDeEnergia[] | null;
  atualizadoEm?: string | null;
  editando: boolean;
  onEditar: () => void;
}

/**
 * Cartão de um preço próprio, no cartão branco do Figma: bloco de ícone na cor
 * do tipo, nome legível e endereço, o preço grande, os selos (mínimo, destrava,
 * faixas) e, no rodapé, a data e o Alterar. Sem a hora e sem o "% vs global"
 * dos cartões antigos: era o excesso de números que escondia o preço.
 */
const CartaoDePreco = ({
  destaque,
  icone,
  titulo,
  subtitulo,
  preco,
  minimo,
  destrava,
  saldoInicio,
  faixas,
  faixasEnergia,
  atualizadoEm,
  editando,
  onEditar,
  ...edicao
}: CartaoDePrecoProps) => (
  <article className={`${classeDoCartao} p-5 3xl:p-[22px] flex flex-col gap-4 min-h-[190px]`}>
    <div className="flex items-start gap-4">
      <span
        aria-hidden="true"
        className={`${BLOCO_DO_TIPO[destaque]} w-[41px] h-[38px] rounded-[5px] flex items-center justify-center shrink-0`}
      >
        <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
          {icone}
        </span>
      </span>
      <div className="min-w-0">
        <h3 className="text-[18px] leading-tight font-semibold text-foreground line-clamp-2" title={titulo}>
          {titulo}
        </h3>
        {subtitulo && (
          <p className="text-sm font-medium text-muted-foreground truncate mt-0.5" title={subtitulo}>
            {subtitulo}
          </p>
        )}
      </div>
    </div>

    <div className="flex-1 flex flex-col justify-end gap-3">
      {editando ? (
        <EditorDePreco {...edicao} />
      ) : (
        <>
          <p className="flex items-baseline gap-1.5">
            <span className="text-[32px] leading-none font-semibold tabular-nums text-foreground">
              {formatarMoeda(preco)}
            </span>
            <span className="text-[15px] font-medium text-muted-foreground">/kWh</span>
          </p>
          <SelosDaTarifa
            minimo={minimo}
            destrava={destrava}
            saldoInicio={saldoInicio}
            faixas={faixas}
            faixasEnergia={faixasEnergia}
          />
        </>
      )}
    </div>

    {!editando && (
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border">
        <span
          className="text-sm text-muted-foreground whitespace-nowrap"
          title={atualizadoEm ? formatarDataCompleta(atualizadoEm) : undefined}
        >
          {atualizadoEm ? `Atualizado em ${formatarDataCurta(atualizadoEm)}` : ''}
        </span>
        <button type="button" onClick={onEditar} className={classeDoBotaoContorno}>
          <span aria-hidden="true" className="material-symbols-outlined text-base">edit</span>
          Alterar
        </button>
      </div>
    )}
  </article>
);

/** Título de um grupo de cartões, com o ícone na cor do tipo e a quantidade. */
const TituloDoGrupo = ({
  destaque,
  icone,
  titulo,
  quantidade,
  dica,
}: {
  destaque: Destaque;
  icone: string;
  titulo: string;
  quantidade: number;
  dica?: string;
}) => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4">
    <span
      aria-hidden="true"
      className={`material-symbols-outlined text-[22px] ${COR_DO_ICONE[destaque]}`}
      style={{ fontVariationSettings: "'FILL' 1" }}
    >
      {icone}
    </span>
    <h2 className="text-[20px] leading-tight font-semibold text-foreground">{titulo}</h2>
    <span className="min-w-6 h-6 px-1.5 rounded-full bg-primary-soft text-primary-strong text-xs font-bold inline-flex items-center justify-center">
      {quantidade}
    </span>
    {dica && <span className="text-[15px] font-medium text-muted-foreground">· {dica}</span>}
  </div>
);

/** Grade dos cartões: 1 coluna no celular, 3 em 1366 px, 4 em tela larga. */
const GRADE = 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4 gap-[25px]';

/**
 * Local que usa a tarifa global: só o nome e "Definir preço". O preço é o da
 * global (está no topo), então não se repete em cada um.
 */
const LocalNaGlobal = ({
  titulo,
  subtitulo,
  editando,
  onEditar,
  ...edicao
}: EdicaoDePreco & { titulo: string; subtitulo?: string | null; editando: boolean; onEditar: () => void }) => (
  <div
    className={`rounded-[10px] px-4 py-3 transition-colors ${editando ? 'bg-card ring-2 ring-tom-azul-icone/40' : 'bg-muted/60 dark:bg-muted/40'}`}
  >
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[15px] font-medium text-foreground truncate" title={titulo}>
          {titulo}
        </p>
        {subtitulo && (
          <p className="text-xs text-muted-foreground truncate" title={subtitulo}>
            {subtitulo}
          </p>
        )}
      </div>
      {!editando && (
        <button type="button" onClick={onEditar} className={`${classeDoBotaoContorno} shrink-0`}>
          <span aria-hidden="true" className="material-symbols-outlined text-base">add</span>
          Definir preço
        </button>
      )}
    </div>
    {editando && (
      <div className="mt-3">
        <EditorDePreco {...edicao} />
      </div>
    )}
  </div>
);

export const Tariffs = () => {
  // Quem não é admin da plataforma (admin da marca, operador) só precifica os
  // PRÓPRIOS locais — a tarifa global da rede é da plataforma, e a API recusa.
  // Pra ele, a box já vem com o local selecionado e sem "Toda a rede".
  const { user } = useAuth();
  const isOperator = !(user?.role === 'admin' && !user?.clientId);
  const [allTariffs, setAllTariffs] = useState<Tariff[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [newMinPrice, setNewMinPrice] = useState('');
  const [newFloorKwh, setNewFloorKwh] = useState('');
  const [newMaxPrice, setNewMaxPrice] = useState('');
  const [newConnectionFee, setNewConnectionFee] = useState('');
  const [newSaldoInicio, setNewSaldoInicio] = useState('');
  // Copiar o preço de uma tarifa já existente (reaproveitar em vez de redigitar).
  const [copyFromId, setCopyFromId] = useState<string>('');
  // Local e Perfil são independentes e combináveis. 'all' = sem filtro
  // (toda a rede / todos os perfis). Os dois juntos = tarifa de (local × perfil).
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [selectedProfile, setSelectedProfile] = useState<string>('all');
  const [selectedCharger, setSelectedCharger] = useState<string>('all');
  const [chargers, setChargers] = useState<{ charge_point_id: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pageTab, setPageTab] = useState<'tarifas' | 'perfis'>('tarifas');
  const [filter, setFilter] = useState<FilterType>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Linha em edição na lista de preços. `chave` identifica a linha (dois locais
  // na mesma rua têm chaves diferentes); `escopo` é o que vai no POST, o mesmo
  // da tarifa editada.
  const [editando, setEditando] = useState<{ chave: string; escopo: EscopoDaEdicao } | null>(null);
  const [busca, setBusca] = useState('');
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [mostrarGlobais, setMostrarGlobais] = useState(false);
  const [editPrice, setEditPrice] = useState('');
  const [editMinPrice, setEditMinPrice] = useState('');
  const [editDestrava, setEditDestrava] = useState('');
  const [editSaldoInicio, setEditSaldoInicio] = useState('');
  const [editFaixas, setEditFaixas] = useState<FaixaEmEdicao[]>([]);
  const [editFaixasDeEnergia, setEditFaixasDeEnergia] = useState<FaixaDeEnergiaEmEdicao[]>([]);
  const [inlineSubmitting, setInlineSubmitting] = useState(false);
  // Botão Atualizar: hora da última busca boa e se a última falhou (os preços
  // na tela ficam, com o aviso no botão).
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  // `semCarregando`: o Atualizar — busca sem trocar a tela pelo carregando.
  const fetchData = async ({ semCarregando = false }: { semCarregando?: boolean } = {}) => {
    if (semCarregando) setAtualizando(true);
    else setLoading(true);
    try {
      // Carrega locais
      const locationsRes = await api.get('/locations/all');
      let loadedLocations: Location[] = [];
      if (locationsRes.ok) {
        const locationsData = await locationsRes.json();
        loadedLocations = locationsData.locations || locationsData || [];
        setLocations(loadedLocations);
      }

      // Carrega perfis de cliente (para tarifa por perfil)
      try {
        const profilesRes = await api.get('/profiles');
        if (profilesRes.ok) setProfiles(await profilesRes.json());
      } catch { /* perfis são opcionais */ }

      // Carrega carregadores (para tarifa por carregador)
      try {
        const chRes = await api.get('/chargers');
        if (chRes.ok) {
          const d = await chRes.json();
          const lista = (d?.data ?? d) as { charge_point_id: string }[];
          if (Array.isArray(lista)) setChargers(lista);
        }
      } catch { /* carregadores são opcionais */ }

      // Tenta endpoint novo (retorna todas de uma vez)
      let usedNewEndpoint = false;
      try {
        const allRes = await api.get('/tariffs/all');
        if (allRes.ok) {
          const tariffData = await allRes.json();
          if (Array.isArray(tariffData) && tariffData.length > 0) {
            // price_per_kwh/min_price vêm como string (decimal do TypeORM). Sem
            // Number() a comparação price > globalPrice seria lexicográfica
            // ("10.0" < "9.0") e a seta ↑/↓ apontaria errado.
            setAllTariffs(
              tariffData.map((t: Tariff) => ({
                ...t,
                price_per_kwh: Number(t.price_per_kwh),
                min_price: t.min_price != null ? Number(t.min_price) : t.min_price,
                connection_fee: t.connection_fee != null ? Number(t.connection_fee) : t.connection_fee,
                saldo_minimo_inicio:
                  t.saldo_minimo_inicio != null ? Number(t.saldo_minimo_inicio) : t.saldo_minimo_inicio,
              })),
            );
            usedNewEndpoint = true;
          }
        }
      } catch { /* endpoint não existe ainda */ }

      if (!usedNewEndpoint) {
        // Fallback: busca global + cada local via /tariffs/current
        const allFetched: Tariff[] = [];
        const seenIds = new Set<number>();

        const parseTariffResponse = (data: any): Tariff[] => {
          const result: Tariff[] = [];
          const history = data.history || [];
          const tariff = data.tariff || data;
          if (history.length > 0) {
            for (const h of history) {
              if (!seenIds.has(h.id)) {
                seenIds.add(h.id);
                result.push({
                  id: h.id,
                  price_per_kwh: h.price_per_kwh,
                  min_price: h.min_price,
                  location_address: h.address ?? null,
                  created_at: h.created_at,
                  is_current: h.is_current ?? (h.id === tariff?.id),
                });
              }
            }
          } else if (tariff?.price_per_kwh && !seenIds.has(tariff.id)) {
            seenIds.add(tariff.id);
            result.push({
              id: tariff.id ?? 0,
              price_per_kwh: tariff.price_per_kwh,
              location_address: tariff.address ?? null,
              created_at: tariff.created_at,
              is_current: true,
            });
          }
          return result;
        };

        // Global
        try {
          const globalRes = await api.get('/tariffs/current');
          if (globalRes.ok) allFetched.push(...parseTariffResponse(await globalRes.json()));
        } catch { /* ignore */ }

        // Por local
        for (const loc of loadedLocations) {
          try {
            const locRes = await api.get(`/tariffs/current?locationAddress=${encodeURIComponent(loc.endereco)}`);
            if (locRes.ok) {
              const items = parseTariffResponse(await locRes.json());
              // Só adiciona se tem tarifa específica do local (address != null)
              allFetched.push(...items.filter(t => t.location_address));
            }
          } catch { /* ignore */ }
        }

        setAllTariffs(allFetched.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      }
      setAtualizadoEm(new Date());
      setFalhou(false);
    } catch {
      toast.error('Erro ao carregar dados de tarifas');
      setFalhou(true);
    } finally {
      setLoading(false);
      setAtualizando(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  // Operador: quando os locais carregam, já seleciona o primeiro — ele não
  // define a tarifa "global da rede", então o padrão dele é um local.
  useEffect(() => {
    if (isOperator && locations.length > 0 && selectedLocation === 'all') {
      setSelectedLocation(String(locations[0].id));
    }
  }, [isOperator, locations, selectedLocation]);

  const handleSubmit = async () => {
    if (!newPrice || parseFloat(newPrice) <= 0) {
      toast.error('Informe um preço válido');
      return;
    }

    setSubmitting(true);
    try {
      type TariffPayload = {
        newPrice: number;
        minPrice?: number;
        floorPerKwh?: number;
        maxPrice?: number;
        connectionFee?: number;
        saldoMinimoInicio?: number;
        locationAddress?: string;
        locationId?: number;
        chargePointId?: string;
        profileId?: number;
      };
      const base: TariffPayload = { newPrice: parseFloat(newPrice) };
      // Mínimo e saldo para iniciar aceitam 0 explícito (para tirar); vazio =
      // herda o atual. Antes só ia mínimo > 0: não dava para tirar um mínimo.
      if (newMinPrice.trim() !== '' && parseFloat(newMinPrice) >= 0) base.minPrice = parseFloat(newMinPrice);
      if (newSaldoInicio.trim() !== '' && parseFloat(newSaldoInicio) >= 0) {
        base.saldoMinimoInicio = parseFloat(newSaldoInicio);
      }
      if (newFloorKwh && parseFloat(newFloorKwh) > 0) base.floorPerKwh = parseFloat(newFloorKwh);
      if (newMaxPrice && parseFloat(newMaxPrice) > 0) base.maxPrice = parseFloat(newMaxPrice);
      // Taxa aceita 0 explícito (para tirar a taxa); vazio = herda a atual.
      if (newConnectionFee.trim() !== '' && parseFloat(newConnectionFee) >= 0) {
        base.connectionFee = parseFloat(newConnectionFee);
      }
      const prof = selectedProfile !== 'all' ? parseInt(selectedProfile) : undefined;
      const withProf = (p: TariffPayload): TariffPayload => (prof ? { ...p, profileId: prof } : p);

      // Uma requisição por escopo. "__all_mine__" aplica o MESMO preço a TODOS
      // os locais visíveis de uma vez — operador com vários locais no mesmo valor.
      const payloads: TariffPayload[] = [];
      if (selectedCharger !== 'all') {
        payloads.push(withProf({ ...base, chargePointId: selectedCharger }));
      } else if (selectedLocation === '__all_mine__') {
        for (const loc of locations) payloads.push(withProf({ ...base, locationId: loc.id }));
      } else if (selectedLocation !== 'all') {
        const location = locations.find(l => l.id.toString() === selectedLocation);
        payloads.push(withProf(location ? { ...base, locationId: location.id } : base));
      } else {
        payloads.push(withProf(base));
      }

      if (payloads.length === 0) {
        toast.error('Selecione onde aplicar a tarifa.');
        setSubmitting(false);
        return;
      }

      const results = await Promise.all(payloads.map(p => api.post('/tariffs', p)));
      const okCount = results.filter(r => r.ok).length;

      if (okCount === payloads.length) {
        toast.success(
          payloads.length > 1 ? `Tarifa aplicada em ${okCount} locais!` : 'Tarifa atualizada com sucesso!'
        );
        setIsDialogOpen(false);
        setNewPrice('');
        setNewMinPrice('');
        setNewFloorKwh('');
        setNewMaxPrice('');
        setNewConnectionFee('');
        setNewSaldoInicio('');
        setCopyFromId('');
        setSelectedLocation('all');
        setSelectedProfile('all');
        setSelectedCharger('all');
        void fetchData();
      } else {
        const failed = results.find(r => !r.ok);
        const errData = failed ? await failed.json().catch(() => null) : null;
        toast.error(
          okCount > 0
            ? `Aplicada em ${okCount} de ${payloads.length} locais. ${errData?.error || ''}`.trim()
            : errData?.error || 'Erro ao atualizar tarifa'
        );
        if (okCount > 0) void fetchData();
      }
    } catch {
      toast.error('Erro ao atualizar tarifa');
    } finally {
      setSubmitting(false);
    }
  };

  const editar = (
    chave: string,
    escopo: EscopoDaEdicao,
    preco: number | null,
    minimo: number | null,
    faixas?: FaixaHoraria[] | null,
    saldoInicio?: number | null,
    destrava?: number | null,
    faixasEnergia?: FaixaDeEnergia[] | null
  ) => {
    setEditando({ chave, escopo });
    setEditPrice(preco != null ? String(preco) : '');
    setEditMinPrice(minimo ? String(minimo) : '');
    setEditDestrava(destrava ? String(destrava) : '');
    setEditSaldoInicio(saldoInicio ? String(saldoInicio) : '');
    setEditFaixas(
      (faixas ?? []).map(f => ({ inicio: f.inicio, fim: f.fim, preco: String(f.preco), dias: f.dias ?? [] }))
    );
    setEditFaixasDeEnergia(
      (faixasEnergia ?? []).map(f => ({ ateKwh: f.ateKwh != null ? String(f.ateKwh) : '', preco: String(f.preco) }))
    );
  };

  const cancelarEdicao = () => {
    setEditando(null);
    setEditPrice('');
    setEditMinPrice('');
    setEditDestrava('');
    setEditSaldoInicio('');
    setEditFaixas([]);
    setEditFaixasDeEnergia([]);
  };

  /** Salva a linha em edição no MESMO escopo da tarifa (global, local, perfil, carregador). */
  const handleSaveInline = async () => {
    if (!editando) return;
    // Faixas de energia: vão sempre, como estão no editor (lista vazia apaga). O
    // preço da tarifa é o da primeira, e a última não tem limite.
    const faixasEnergia: FaixaDeEnergia[] = [];
    for (const [i, f] of editFaixasDeEnergia.entries()) {
      const preco = Math.round(parseFloat(f.preco.replace(',', '.')) * 100) / 100;
      const ultima = i === editFaixasDeEnergia.length - 1;
      const ateKwh = ultima ? null : parseFloat(f.ateKwh.replace(',', '.'));
      if (!(preco > 0) || (ateKwh !== null && !(ateKwh > 0))) {
        toast.error('Preencha o limite de kWh e o preço de cada faixa de energia.');
        return;
      }
      const anterior = faixasEnergia[i - 1]?.ateKwh;
      if (ateKwh !== null && anterior != null && ateKwh <= anterior) {
        toast.error('Os limites das faixas de energia precisam ser crescentes.');
        return;
      }
      faixasEnergia.push({ ateKwh, preco });
    }
    const precoDaTarifa = faixasEnergia[0]?.preco ?? parseFloat(editPrice);
    if (!(precoDaTarifa > 0)) {
      toast.error('Informe um preço válido');
      return;
    }
    // Faixas de horário: vão sempre, como estão no editor (lista vazia apaga).
    const faixasHorarias: FaixaHoraria[] = [];
    for (const f of editFaixas) {
      const preco = Math.round(parseFloat(f.preco.replace(',', '.')) * 100) / 100;
      if (!/^\d{2}:\d{2}$/.test(f.inicio) || !/^\d{2}:\d{2}$/.test(f.fim) || !(preco > 0)) {
        toast.error('Preencha início, fim e preço de cada faixa de horário.');
        return;
      }
      faixasHorarias.push({ inicio: f.inicio, fim: f.fim, preco, ...(f.dias.length ? { dias: f.dias } : {}) });
    }

    setInlineSubmitting(true);
    try {
      const { escopo } = editando;
      const payload: {
        newPrice: number;
        minPrice: number;
        connectionFee: number;
        saldoMinimoInicio: number;
        locationAddress?: string;
        locationId?: number;
        profileId?: number;
        chargePointId?: string;
        faixasHorarias: FaixaHoraria[];
        faixasEnergia: FaixaDeEnergia[];
      } = {
        newPrice: precoDaTarifa,
        // O editor já abre com os valores atuais: o que está no campo é o que
        // vale, e campo vazio tira (antes vazio herdava e não dava para tirar
        // o mínimo).
        minPrice: Math.max(0, parseFloat(editMinPrice) || 0),
        connectionFee: Math.max(0, parseFloat(editDestrava) || 0),
        saldoMinimoInicio: Math.max(0, parseFloat(editSaldoInicio) || 0),
        faixasHorarias,
        faixasEnergia,
      };

      if (escopo.chargePointId) payload.chargePointId = escopo.chargePointId;
      // Preferimos o id do local (distingue locais de mesma rua); o endereço
      // só como legado.
      else if (escopo.locationId != null) payload.locationId = escopo.locationId;
      else if (escopo.locationAddress) payload.locationAddress = escopo.locationAddress;
      if (escopo.profileId) payload.profileId = escopo.profileId;

      const response = await api.post('/tariffs', payload);

      if (response.ok) {
        toast.success('Tarifa atualizada com sucesso!');
        cancelarEdicao();
        void fetchData();
      } else {
        const errData = await response.json();
        toast.error(errData.error || 'Erro ao atualizar tarifa');
      }
    } catch {
      toast.error('Erro ao atualizar tarifa');
    } finally {
      setInlineSubmitting(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  /* ── Dados derivados ── */
  const currentTariffs = useMemo(() => allTariffs.filter(t => t.is_current), [allTariffs]);

  // Rótulo do escopo de uma tarifa (seletor "copiar de existente" e histórico).
  // Com location_id, mostra o NOME do local — senão dois locais de mesmo
  // endereço ficariam com rótulo idêntico.
  const tariffScopeLabel = (t: Tariff) => {
    if (t.charge_point_id) {
      const perfil = t.profileId ? ` · ${t.profileName || `Perfil #${t.profileId}`}` : '';
      return `Carregador ${t.charge_point_id}${perfil}`;
    }
    if (t.location_id != null) {
      const loc = locations.find(l => l.id === t.location_id);
      return loc?.nomeDoLocal || t.location_address || `Local #${t.location_id}`;
    }
    return t.location_address
      ? t.location_address
      : t.profileId
        ? t.profileName || `Perfil #${t.profileId}`
        : 'Global (rede)';
  };
  // Tarifa de carregador também não tem endereço: sem excluí-la, a mais recente
  // delas virava a "global" (ver ehGlobal).
  const globalTariff = currentTariffs.find(ehGlobal);

  const filtered = useMemo(() => {
    if (filter === 'global') return allTariffs.filter(ehGlobal);
    if (filter === 'profile') return allTariffs.filter(t => !!t.profileId);
    if (filter === 'local') return allTariffs.filter(ehDeLocal);
    if (filter === 'charger') return allTariffs.filter(t => !!t.charge_point_id);
    return allTariffs;
  }, [allTariffs, filter]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const current = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Uma linha por LOCAL — todos, inclusive os que usam a global — em ordem
  // alfabética, para achar o local pelo nome. Cada local resolve a tarifa
  // atual primeiro por `location_id` (distingue dois locais na mesma rua) e,
  // se não houver, pelo `endereco` (tarifas antigas, ainda não migradas). Só
  // tarifa de local: a de perfil ou de carregador naquele local tem lista própria.
  const linhasDeLocal = useMemo(
    () =>
      locations
        .map(loc => ({
          loc,
          tariff:
            currentTariffs.find(t => ehDeLocal(t) && t.location_id === loc.id) ??
            currentTariffs.find(
              t => ehDeLocal(t) && t.location_id == null && t.location_address === loc.endereco
            ) ??
            null,
        }))
        .sort((a, b) =>
          (a.loc.nomeDoLocal || a.loc.endereco || '').localeCompare(
            b.loc.nomeDoLocal || b.loc.endereco || '',
            'pt-BR'
          )
        ),
    [locations, currentTariffs]
  );
  const tarifasDeCarregador = useMemo(
    () =>
      currentTariffs
        .filter(t => !!t.charge_point_id)
        .sort((a, b) => (a.charge_point_id || '').localeCompare(b.charge_point_id || '', 'pt-BR')),
    [currentTariffs]
  );
  const tarifasDePerfil = useMemo(
    () => currentTariffs.filter(t => !!t.profileId && !t.charge_point_id),
    [currentTariffs]
  );

  // Busca por nome, endereço, carregador ou perfil, sem diferenciar acento.
  const normalizar = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const termo = normalizar(busca.trim());
  const casaBusca = (...textos: Array<string | null | undefined>) =>
    !termo || textos.some(t => !!t && normalizar(t).includes(termo));
  const carregadoresVisiveis = tarifasDeCarregador.filter(t => casaBusca(t.charge_point_id, t.profileName));
  const perfisVisiveis = tarifasDePerfil.filter(t => casaBusca(t.profileName, tariffScopeLabel(t)));
  const localDaTarifa = (t: Tariff) =>
    (t.location_id != null ? locations.find(l => l.id === t.location_id)?.nomeDoLocal : null) ||
    t.location_address;

  // Cartões só para quem tem preço próprio; os demais pagam a global e ficam
  // recolhidos (eram 30 linhas iguais repetindo o mesmo preço).
  const locaisComPreco = linhasDeLocal.filter(
    (r): r is { loc: Location; tariff: Tariff } => !!r.tariff
  );
  const locaisNaGlobal = linhasDeLocal.filter(r => !r.tariff);
  const locaisComPrecoVisiveis = locaisComPreco.filter(r => casaBusca(r.loc.nomeDoLocal, r.loc.endereco));
  const locaisNaGlobalVisiveis = locaisNaGlobal.filter(r => casaBusca(r.loc.nomeDoLocal, r.loc.endereco));
  // Buscando, o que foi achado entre os locais na global não fica escondido.
  const abrirGlobais = mostrarGlobais || !!termo;
  const edicaoComum = {
    editPrice,
    setEditPrice,
    editMinPrice,
    setEditMinPrice,
    editDestrava,
    setEditDestrava,
    editSaldoInicio,
    setEditSaldoInicio,
    faixasEmEdicao: editFaixas,
    setFaixasEmEdicao: setEditFaixas,
    faixasDeEnergiaEmEdicao: editFaixasDeEnergia,
    setFaixasDeEnergiaEmEdicao: setEditFaixasDeEnergia,
    onCancelar: cancelarEdicao,
    onSalvar: handleSaveInline,
    salvando: inlineSubmitting,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-[25px] pb-12">
      <CabecalhoDaPagina
        titulo="Tarifas"
        subtitulo="Gerencie os preços por kWh da rede"
        acoes={
          pageTab === 'tarifas' && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-4 3xl:gap-8">
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <button type="button" className={`${classeDoBotaoPrincipal} sm:w-[201px]`}>
                    <CirclePlus aria-hidden="true" className="w-5 h-5" />
                    Nova Tarifa
                  </button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border rounded-[15px] sm:max-w-[480px] max-h-[88vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-[20px] font-semibold text-foreground flex items-center gap-2">
                      <span aria-hidden="true" className="material-symbols-outlined text-primary-strong">sell</span>
                      Definir Nova Tarifa
                    </DialogTitle>
                    <DialogDescription className="text-on-surface-variant">
                      Configure o preço por kWh por local, por perfil de cliente, ou os dois combinados.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-5 py-4">
                    {/* Copiar de uma tarifa existente — reaproveita o preço */}
                    {currentTariffs.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-on-surface-variant text-xs uppercase tracking-widest flex items-center gap-1">
                          Copiar de uma tarifa existente
                          <span className="normal-case tracking-normal text-outline font-normal">opcional</span>
                        </Label>
                        <Select
                          value={copyFromId}
                          onValueChange={v => {
                            setCopyFromId(v);
                            const t = currentTariffs.find(x => String(x.id) === v);
                            if (t) {
                              setNewPrice(String(t.price_per_kwh));
                              setNewMinPrice(t.min_price != null && Number(t.min_price) > 0 ? String(t.min_price) : '');
                              setNewConnectionFee(t.connection_fee != null && Number(t.connection_fee) > 0 ? String(t.connection_fee) : '');
                              setNewSaldoInicio(
                                t.saldo_minimo_inicio != null && Number(t.saldo_minimo_inicio) > 0 ? String(t.saldo_minimo_inicio) : ''
                              );
                            }
                          }}
                        >
                          <SelectTrigger className="bg-surface-container-low border-outline-variant/20 text-on-surface">
                            <SelectValue placeholder="Escolha uma tarifa para reaproveitar o preço" />
                          </SelectTrigger>
                          <SelectContent className="bg-surface-container border-outline-variant/20">
                            {currentTariffs.map(t => (
                              <SelectItem key={`copy-${t.id}`} value={String(t.id)} className="text-on-surface focus:bg-surface-container-highest">
                                {tariffScopeLabel(t)} — {formatCurrency(t.price_per_kwh)}/kWh
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-on-surface-variant">Preenche o preço abaixo. Depois é só escolher onde aplicar.</p>
                      </div>
                    )}

                    {/* Preço — o principal, em destaque */}
                    <div className="space-y-2">
                      <Label className="text-on-surface-variant text-xs uppercase tracking-widest">
                        Preço por kWh
                      </Label>
                      <div className="flex items-center gap-2 bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 focus-within:border-primary transition-colors">
                        <span className="text-2xl font-headline font-bold text-on-surface">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          value={newPrice}
                          onChange={e => setNewPrice(e.target.value)}
                          autoFocus
                          className="flex-1 w-0 min-w-0 bg-transparent text-3xl font-headline font-bold text-on-surface focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0"
                        />
                        <span className="text-sm text-on-surface-variant whitespace-nowrap">/kWh</span>
                      </div>
                    </div>

                    {/* Onde aplicar (Local) — visível e simples */}
                    <div className="space-y-2">
                      <Label className="text-on-surface-variant text-xs uppercase tracking-widest">Onde aplicar</Label>
                      <Select value={selectedLocation} onValueChange={setSelectedLocation} disabled={selectedCharger !== 'all'}>
                        <SelectTrigger className="bg-surface-container-low border-outline-variant/20 text-on-surface">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent className="bg-surface-container border-outline-variant/20">
                          {!isOperator && (
                            <SelectItem value="all" className="text-on-surface focus:bg-surface-container-highest">Toda a rede (preço padrão)</SelectItem>
                          )}
                          {locations.length > 1 && (
                            <SelectItem value="__all_mine__" className="text-on-surface focus:bg-surface-container-highest">
                              {isOperator ? '⭐ Todos os meus locais (mesmo preço)' : '⭐ Todos os locais (mesmo preço)'}
                            </SelectItem>
                          )}
                          {locations.map(location => (
                            <SelectItem key={`l-${location.id}`} value={location.id.toString()} className="text-on-surface focus:bg-surface-container-highest">
                              {location.nomeDoLocal}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-on-surface-variant">
                        {isOperator
                          ? 'Escolha um local — ou "Todos os meus locais" para aplicar o mesmo preço em todos de uma vez.'
                          : 'Deixe em "Toda a rede" para o preço geral, ou escolha um local (ou "Todos os locais").'}
                      </p>
                    </div>

                    {/* Toggle de opções avançadas */}
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(v => !v)}
                      className="flex items-center gap-1.5 text-xs font-bold text-primary-strong hover:underline justify-self-start text-left"
                    >
                      <span className="material-symbols-outlined text-base">{showAdvanced ? 'expand_less' : 'tune'}</span>
                      {showAdvanced ? 'Ocultar opções avançadas' : 'Opções avançadas (mínimo, saldo para iniciar, teto, taxa de destrava, carregador, perfil)'}
                    </button>

                    <div className={showAdvanced ? 'space-y-4 rounded-xl border border-outline-variant/10 bg-surface-container-low/40 p-4' : 'hidden'}>
                      <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-on-surface-variant text-xs uppercase tracking-widest flex items-center gap-1">
                          Mínimo por sessão (R$)
                          <span className="normal-case tracking-normal text-outline font-normal">opcional</span>
                        </Label>
                        <Input
                          id="minPrice"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={newMinPrice}
                          onChange={e => setNewMinPrice(e.target.value)}
                          className="bg-surface-container-low border-outline-variant/20 text-on-surface"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-on-surface-variant text-xs uppercase tracking-widest flex items-center gap-1">
                          Piso por kWh (custo)
                          <span className="normal-case tracking-normal text-outline font-normal">opcional</span>
                        </Label>
                        <Input
                          id="floorKwh"
                          type="number"
                          step="0.0001"
                          min="0"
                          placeholder="0.0000"
                          value={newFloorKwh}
                          onChange={e => setNewFloorKwh(e.target.value)}
                          className="bg-surface-container-low border-outline-variant/20 text-on-surface"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-on-surface-variant text-xs uppercase tracking-widest flex items-center gap-1">
                          Teto por sessão (R$)
                          <span className="normal-case tracking-normal text-outline font-normal">opcional</span>
                        </Label>
                        <Input
                          id="maxPrice"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={newMaxPrice}
                          onChange={e => setNewMaxPrice(e.target.value)}
                          className="bg-surface-container-low border-outline-variant/20 text-on-surface"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-on-surface-variant text-xs uppercase tracking-widest flex items-center gap-1">
                          Taxa de destrava (R$)
                          <span className="normal-case tracking-normal text-outline font-normal">opcional</span>
                        </Label>
                        <Input
                          id="connectionFee"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={newConnectionFee}
                          onChange={e => setNewConnectionFee(e.target.value)}
                          className="bg-surface-container-low border-outline-variant/20 text-on-surface"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-on-surface-variant text-xs uppercase tracking-widest flex items-center gap-1">
                          Saldo mínimo para iniciar (R$)
                          <span className="normal-case tracking-normal text-outline font-normal">opcional</span>
                        </Label>
                        <Input
                          id="saldoMinimoInicio"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={newSaldoInicio}
                          onChange={e => setNewSaldoInicio(e.target.value)}
                          className="bg-surface-container-low border-outline-variant/20 text-on-surface"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed -mt-2">
                      <b>Mínimo por sessão</b>: nenhuma recarga com energia custa menos que isso — cobre o custo de conexão de sessões curtas (sessão de 0 kWh não é cobrada). Vazio mantém o atual; 0 remove.<br />
                      <b>Saldo mínimo para iniciar</b>: o cliente só começa a recarga com pelo menos esse saldo na carteira. Não muda o que é cobrado (para cobrar um mínimo, use o mínimo por sessão). Vazio mantém o atual; 0 remove.<br />
                      <b>Piso por kWh</b>: a cobrança nunca fica abaixo desse custo por kWh — protege de vender energia no prejuízo. Normalmente vem preenchido pela aba <b>Conta de Energia</b> do local.<br />
                      <b>Teto por sessão</b>: nenhuma recarga custa mais que isso — sanidade contra sessão disparada (0 ou vazio = sem teto).<br />
                      <b>Taxa de destrava</b>: valor fixo por recarga, somado à energia assim que a recarga entrega energia (o mínimo vale sobre a soma). Vazio mantém a taxa atual; 0 remove.
                    </p>

                    <div className="space-y-2">
                      <Label className="text-on-surface-variant text-xs uppercase tracking-widest flex items-center gap-1">
                        Carregador
                        <span className="normal-case tracking-normal text-outline font-normal">mais específico que o local</span>
                      </Label>
                      <Select value={selectedCharger} onValueChange={setSelectedCharger}>
                        <SelectTrigger className="bg-surface-container-low border-outline-variant/20 text-on-surface">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent className="bg-surface-container border-outline-variant/20">
                          <SelectItem value="all" className="text-on-surface focus:bg-surface-container-highest">
                            Nenhum (usar Local abaixo)
                          </SelectItem>
                          {chargers.map(cp => (
                            <SelectItem
                              key={`c-${cp.charge_point_id}`}
                              value={cp.charge_point_id}
                              className="text-on-surface focus:bg-surface-container-highest"
                            >
                              {cp.charge_point_id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedCharger !== 'all' && (
                        <p className="text-[11px] text-on-surface-variant leading-relaxed">
                          A tarifa vale só para este carregador e vence a do local. O campo Local abaixo é ignorado.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-on-surface-variant text-xs uppercase tracking-widest">
                        Perfil de cliente
                      </Label>
                      <Select value={selectedProfile} onValueChange={setSelectedProfile}>
                        <SelectTrigger className="bg-surface-container-low border-outline-variant/20 text-on-surface">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent className="bg-surface-container border-outline-variant/20">
                          <SelectItem value="all" className="text-on-surface focus:bg-surface-container-highest">
                            Padrão (todos os perfis)
                          </SelectItem>
                          {profiles.map(profile => (
                            <SelectItem
                              key={`p-${profile.id}`}
                              value={profile.id.toString()}
                              className="text-on-surface focus:bg-surface-container-highest"
                            >
                              {profile.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">
                        Combine Local/Carregador + Perfil para um preço específico — ex.: um local exclusivo para o perfil "Uber". Deixe no padrão para valer a todos.
                      </p>
                    </div>
                  </div>
                  <DialogFooter className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsDialogOpen(false)}
                      className={classeDoBotaoContorno}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="h-10 px-5 rounded-[25px] bg-primary text-primary-foreground text-sm font-medium inline-flex items-center justify-center gap-2 hover:brightness-105 active:scale-[0.98] transition disabled:opacity-50"
                    >
                      {submitting ? 'Salvando...' : 'Salvar Tarifa'}
                    </button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <BotaoAtualizar
                aoAtualizar={() => void fetchData({ semCarregando: true })}
                carregando={atualizando}
                atualizadoEm={atualizadoEm}
                falhou={falhou}
              />
            </div>
          )
        }
      />

      {/* Sub-abas: Tarifas | Perfis */}
      <AbasDaPagina
        rotulo="Seções de Tarifas"
        abas={[
          { id: 'tarifas' as const, rotulo: 'Tarifas', icone: <Tag aria-hidden="true" className="w-6 h-6" /> },
          { id: 'perfis' as const, rotulo: 'Perfis', icone: <BadgeCheck aria-hidden="true" className="w-6 h-6" /> },
        ]}
        ativa={pageTab}
        aoMudar={setPageTab}
      />

      {pageTab === 'perfis' && <Profiles embedded />}

      {pageTab === 'tarifas' && (
      <>
      {/* Tarifas em cartões coloridos por tipo, com busca. */}
      <div className="space-y-[25px]">
        {/* Tarifa global em destaque — oculta para operador (tenant): é da REDE. */}
        {!isOperator &&
          (globalTariff ? (
            <section aria-label="Tarifa global da rede" className={`${classeDoCartao} p-5 3xl:p-[30px]`}>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div className="flex items-start gap-4 3xl:gap-[18px]">
                  <BlocoDeIcone tom="marca" grande>
                    <span aria-hidden="true" className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      public
                    </span>
                  </BlocoDeIcone>
                  <div>
                    <h2 className="text-[20px] leading-tight font-semibold text-foreground">Tarifa global da rede</h2>
                    <p className="text-[15px] font-medium text-muted-foreground mt-0.5">
                      Vale para {locaisNaGlobal.length} {locaisNaGlobal.length === 1 ? 'local' : 'locais'} sem preço
                      próprio · atualizada em {formatarDataCurta(globalTariff.created_at)}
                    </p>
                    <p className="flex items-baseline gap-1.5 mt-3">
                      <span className="text-[40px] leading-none font-semibold tabular-nums text-foreground">
                        {formatCurrency(globalTariff.price_per_kwh)}
                      </span>
                      <span className="text-[15px] font-medium text-muted-foreground">/kWh</span>
                    </p>
                  </div>
                </div>
                <div className="lg:min-w-[280px]">
                  {editando?.chave === 'global' ? (
                    <EditorDePreco {...edicaoComum} />
                  ) : (
                    <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                      <SelosDaTarifa
                        minimo={globalTariff.min_price}
                        destrava={globalTariff.connection_fee}
                        saldoInicio={globalTariff.saldo_minimo_inicio}
                        faixas={globalTariff.faixas_horarias}
                        faixasEnergia={globalTariff.faixas_energia}
                      />
                      <button
                        type="button"
                        onClick={() => editar('global', {}, globalTariff.price_per_kwh, globalTariff.min_price ?? null, globalTariff.faixas_horarias, globalTariff.saldo_minimo_inicio, globalTariff.connection_fee, globalTariff.faixas_energia)}
                        className={classeDoBotaoContorno}
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-base">edit</span>
                        Alterar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </section>
          ) : (
            <section className={`${classeDoCartao} p-5 text-[15px] text-muted-foreground`}>
              Nenhuma tarifa global configurada
            </section>
          ))}

        <BarraDeFiltros>
          <CampoDeBusca
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar local, carregador ou perfil"
            aria-label="Buscar tarifa"
          />
        </BarraDeFiltros>

        <section>
          <TituloDoGrupo
            destaque="local"
            icone="location_on"
            titulo="Locais com preço próprio"
            quantidade={locaisComPrecoVisiveis.length}
          />
          {locaisComPrecoVisiveis.length > 0 ? (
            <div className={GRADE}>
              {locaisComPrecoVisiveis.map(({ loc, tariff }) => {
                const chave = `loc:${loc.id}`;
                return (
                  <CartaoDePreco
                    key={loc.id}
                    destaque="local"
                    icone="location_on"
                    titulo={loc.nomeDoLocal || loc.endereco}
                    subtitulo={[loc.endereco, loc.numero].filter(Boolean).join(', ')}
                    preco={tariff.price_per_kwh}
                    minimo={tariff.min_price}
                    destrava={tariff.connection_fee}
                    saldoInicio={tariff.saldo_minimo_inicio}
                    faixas={tariff.faixas_horarias}
                    faixasEnergia={tariff.faixas_energia}
                    atualizadoEm={tariff.created_at}
                    editando={editando?.chave === chave}
                    onEditar={() =>
                      editar(
                        chave,
                        { locationId: loc.id, locationAddress: loc.endereco },
                        tariff.price_per_kwh,
                        tariff.min_price ?? null,
                        tariff.faixas_horarias,
                        tariff.saldo_minimo_inicio,
                        tariff.connection_fee,
                        tariff.faixas_energia
                      )
                    }
                    {...edicaoComum}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-[15px] text-muted-foreground">
              {termo ? 'Nenhum local com preço próprio encontrado.' : 'Nenhum local com preço próprio ainda.'}
            </p>
          )}
        </section>
        {carregadoresVisiveis.length > 0 && (
          <section>
            <TituloDoGrupo
              destaque="carregador"
              icone="ev_station"
              titulo="Carregadores com preço próprio"
              quantidade={carregadoresVisiveis.length}
              dica="passam na frente do preço do local"
            />
            <div className={GRADE}>
              {carregadoresVisiveis.map(t => {
                const chave = `cp:${t.charge_point_id}:${t.profileId ?? ''}`;
                return (
                  <CartaoDePreco
                    key={t.id}
                    destaque="carregador"
                    icone="ev_station"
                    titulo={t.charge_point_id || ''}
                    subtitulo={t.profileId ? `perfil ${t.profileName || `#${t.profileId}`}` : 'só neste carregador'}
                    preco={t.price_per_kwh}
                    minimo={t.min_price}
                    destrava={t.connection_fee}
                    saldoInicio={t.saldo_minimo_inicio}
                    faixas={t.faixas_horarias}
                    faixasEnergia={t.faixas_energia}
                    atualizadoEm={t.created_at}
                    editando={editando?.chave === chave}
                    onEditar={() =>
                      editar(
                        chave,
                        { chargePointId: t.charge_point_id, profileId: t.profileId },
                        t.price_per_kwh,
                        t.min_price ?? null,
                        t.faixas_horarias,
                        t.saldo_minimo_inicio,
                        t.connection_fee,
                        t.faixas_energia
                      )
                    }
                    {...edicaoComum}
                  />
                );
              })}
            </div>
          </section>
        )}

        {perfisVisiveis.length > 0 && (
          <section>
            <TituloDoGrupo
              destaque="perfil"
              icone="badge"
              titulo="Perfis de cliente"
              quantidade={perfisVisiveis.length}
              dica="preço para os clientes do perfil"
            />
            <div className={GRADE}>
              {perfisVisiveis.map(t => {
                const chave = `perfil:${t.id}`;
                const local = localDaTarifa(t);
                return (
                  <CartaoDePreco
                    key={t.id}
                    destaque="perfil"
                    icone="badge"
                    titulo={t.profileName || `Perfil #${t.profileId}`}
                    subtitulo={local ? `em ${local}` : 'em toda a rede'}
                    preco={t.price_per_kwh}
                    minimo={t.min_price}
                    destrava={t.connection_fee}
                    saldoInicio={t.saldo_minimo_inicio}
                    faixas={t.faixas_horarias}
                    faixasEnergia={t.faixas_energia}
                    atualizadoEm={t.created_at}
                    editando={editando?.chave === chave}
                    onEditar={() =>
                      editar(
                        chave,
                        { profileId: t.profileId, locationId: t.location_id, locationAddress: t.location_address },
                        t.price_per_kwh,
                        t.min_price ?? null,
                        t.faixas_horarias,
                        t.saldo_minimo_inicio,
                        t.connection_fee,
                        t.faixas_energia
                      )
                    }
                    {...edicaoComum}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* Locais sem preço próprio: recolhidos, só o nome e "Definir preço". */}
        {locaisNaGlobalVisiveis.length > 0 && (
          <section aria-label="Locais na tarifa global" className={classeDoCartao}>
            <button
              type="button"
              onClick={() => setMostrarGlobais(v => !v)}
              aria-expanded={abrirGlobais}
              className="w-full flex items-center justify-between gap-3 px-5 3xl:px-[22px] py-5 text-left"
            >
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span aria-hidden="true" className={`material-symbols-outlined text-[22px] ${COR_DO_ICONE.global}`}>public</span>
                <span className="text-[20px] leading-tight font-semibold text-foreground">Locais na tarifa global</span>
                <span className="min-w-6 h-6 px-1.5 rounded-full bg-primary-soft text-primary-strong text-xs font-bold inline-flex items-center justify-center">
                  {locaisNaGlobalVisiveis.length}
                </span>
                {globalTariff && (
                  <span className="text-[15px] font-medium text-muted-foreground">
                    · pagam {formatCurrency(globalTariff.price_per_kwh)}/kWh
                  </span>
                )}
              </span>
              <span aria-hidden="true" className="material-symbols-outlined text-muted-foreground">
                {abrirGlobais ? 'expand_less' : 'expand_more'}
              </span>
            </button>
            {abrirGlobais && (
              <div className="px-5 3xl:px-[22px] pb-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4 gap-3">
                {locaisNaGlobalVisiveis.map(({ loc }) => {
                  const chave = `loc:${loc.id}`;
                  return (
                    <LocalNaGlobal
                      key={loc.id}
                      titulo={loc.nomeDoLocal || loc.endereco}
                      subtitulo={[loc.endereco, loc.numero].filter(Boolean).join(', ')}
                      editando={editando?.chave === chave}
                      onEditar={() =>
                        editar(
                          chave,
                          { locationId: loc.id, locationAddress: loc.endereco },
                          globalTariff?.price_per_kwh ?? null,
                          null
                        )
                      }
                      {...edicaoComum}
                    />
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Histórico de alterações — recolhido: a lista acima já mostra o preço atual. */}
      <section aria-label="Histórico de alterações" className={`${classeDoCartao} overflow-hidden`}>
        <div
          className={`px-5 3xl:px-[22px] py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 ${mostrarHistorico ? 'border-b border-border' : ''}`}
        >
          <button
            type="button"
            onClick={() => setMostrarHistorico(v => !v)}
            aria-expanded={mostrarHistorico}
            className="flex items-center gap-4 text-left"
          >
            <BlocoDeIcone tom="cinza">
              <span aria-hidden="true" className="material-symbols-outlined text-[22px]">history</span>
            </BlocoDeIcone>
            <h3 className="text-[20px] leading-tight font-semibold text-foreground">Histórico de alterações</h3>
            <span aria-hidden="true" className="material-symbols-outlined text-muted-foreground">
              {mostrarHistorico ? 'expand_less' : 'expand_more'}
            </span>
          </button>
          {mostrarHistorico && (
          <div className="flex flex-wrap items-center gap-3">
            <Select value={filter} onValueChange={(v: FilterType) => { setFilter(v); setCurrentPage(1); }}>
              <SelectTrigger
                className={`${classeDaPilula} h-[43px] data-[size=default]:h-[43px] sm:w-[200px]`}
                aria-label="Filtrar escopo"
              >
                <SelectValue placeholder="Filtrar escopo" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="global">Global</SelectItem>
                <SelectItem value="profile">Por Perfil</SelectItem>
                <SelectItem value="local">Por Local</SelectItem>
                <SelectItem value="charger">Por Carregador</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">{filtered.length} registros</span>
          </div>
          )}
        </div>
        {!mostrarHistorico ? null : filtered.length > 0 ? (
          <>
            <div className="overflow-x-auto px-4 pb-2">
              <table className={classeDaTabela}>
                <thead>
                  <tr>
                    <th className={`${classeDoTh} pt-3 text-left`}>Data</th>
                    <th className={`${classeDoTh} pt-3 text-left`}>Preço/kWh</th>
                    <th className={`${classeDoTh} pt-3 text-left`}>Escopo</th>
                    <th className={`${classeDoTh} pt-3 text-left`}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {current.map(tariff => (
                    <tr key={tariff.id}>
                      <td className={`${classeDaCelula} ${fundoDaLinha}`}>
                        <div className="flex items-center gap-2">
                          <span aria-hidden="true" className="material-symbols-outlined text-sm text-muted-foreground">schedule</span>
                          <span className="text-muted-foreground">{formatDate(tariff.created_at)}</span>
                        </div>
                      </td>
                      <td className={`${classeDaCelula} ${fundoDaLinha} font-semibold tabular-nums text-foreground`}>
                        {formatCurrency(tariff.price_per_kwh)}
                      </td>
                      <td className={`${classeDaCelula} ${fundoDaLinha}`}>
                        {/* Carregador antes de tudo: sem endereço, a tarifa de
                            carregador aparecia aqui como "Global". */}
                        {tariff.charge_point_id ? (
                          <span className="inline-flex items-center gap-1.5 text-foreground">
                            <span aria-hidden="true" className={`material-symbols-outlined text-sm ${COR_DO_ICONE.carregador}`}>ev_station</span>
                            {tariffScopeLabel(tariff)}
                          </span>
                        ) : tariff.profileId ? (
                          <span className="inline-flex items-center gap-1.5 text-foreground">
                            <span aria-hidden="true" className={`material-symbols-outlined text-sm ${COR_DO_ICONE.perfil}`}>badge</span>
                            {tariff.profileName || `Perfil #${tariff.profileId}`}
                          </span>
                        ) : tariff.location_address || tariff.location_id != null ? (
                          <span className="inline-flex items-center gap-1.5 text-foreground">
                            <span aria-hidden="true" className={`material-symbols-outlined text-sm ${COR_DO_ICONE.local}`}>location_on</span>
                            {tariffScopeLabel(tariff)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-foreground">
                            <span aria-hidden="true" className={`material-symbols-outlined text-sm ${COR_DO_ICONE.global}`}>public</span>
                            Global
                          </span>
                        )}
                      </td>
                      <td className={`${classeDaCelula} ${fundoDaLinha}`}>
                        {tariff.is_current ? (
                          <span className={`${SELO} bg-estado-livre text-estado-livre-forte`}>
                            <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-estado-livre-forte" />
                            Atual
                          </span>
                        ) : (
                          <span className={`${SELO} bg-muted text-muted-foreground`}>
                            <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                            Anterior
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-border flex flex-wrap gap-3 justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Página <span className="font-semibold text-foreground">{currentPage}</span> de <span className="font-semibold text-foreground">{totalPages || 1}</span>
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={classeDoBotaoContorno}
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-base">chevron_left</span>
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className={classeDoBotaoContorno}
                >
                  Próxima
                  <span aria-hidden="true" className="material-symbols-outlined text-base">chevron_right</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="m-5 py-10 flex flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-border text-center px-6">
            <p className="text-[15px] font-semibold text-foreground">Nenhum histórico disponível</p>
          </div>
        )}
      </section>
      </>
      )}
    </div>
  );
};

export default Tariffs;
