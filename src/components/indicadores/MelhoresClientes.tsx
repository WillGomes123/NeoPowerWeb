import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { exportToCSV } from '../../lib/export';
import { DateRangePicker } from '../ui/date-range-picker';
import { BlocoDeIcone, classeDaPilula, classeDoCartao } from '../painel/Pagina';
import { classeDoBotaoContorno, classeDoCabecalhoDaTabela } from '../painel/Pecas';
import { fmtBRL, fmtInt, fmtNum } from './tipos';

/**
 * Melhores clientes do período (pedido do dono, 19/11/2026): quem mais gastou,
 * carregou ou voltou, para premiar o melhor cliente. Os números vêm de
 * GET /indicators/clientes, com a receita do Relatório Financeiro (o cobrado
 * menos o estorno). Visitantes e contas da equipe ficam fora.
 *
 * Não está no Figma da Lauriane: fica na aba Motoristas do relatório mensal
 * (no mês escolhido) e, para quem não vê o relatório mensal, abaixo da
 * evolução diária, com período próprio.
 */

type Ordem = 'consumido' | 'kwh' | 'recargas';

interface Cliente {
  posicao: number;
  userId: number;
  nome: string;
  celular: string | null;
  recargas: number;
  kwh: number;
  consumido: number;
  ticketMedio: number;
  ultimaRecarga: string;
}

interface Ranking {
  periodo: { inicio: string; fim: string };
  ordem: Ordem;
  clientes: Cliente[];
  totais: { clientes: number; recargas: number; kwh: number; consumido: number };
}

const ORDENS: Array<{ id: Ordem; rotulo: string }> = [
  { id: 'consumido', rotulo: 'Quem mais gastou' },
  { id: 'kwh', rotulo: 'Quem mais carregou (kWh)' },
  { id: 'recargas', rotulo: 'Quem mais recarregou' },
];

const POUCOS = 10;
const MUITOS = 50;

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const trintaDiasAtras = () => {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return iso(d);
};

const dataCurta = (texto: string) =>
  new Date(texto).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });

/** 1º, 2º e 3º em destaque (ouro, prata, bronze); os outros, só o número. */
function Posicao({ n }: { n: number }) {
  const cor =
    n === 1
      ? 'bg-tom-amarelo text-tom-amarelo-icone'
      : n === 2
        ? 'bg-tom-cinza text-foreground'
        : n === 3
          ? 'bg-estado-problema text-estado-problema-forte'
          : 'text-muted-foreground';
  return (
    <span
      className={`inline-flex items-center justify-center min-w-8 h-8 px-2 rounded-[25px] text-sm font-semibold tabular-nums ${cor}`}
    >
      {n <= 3 && (
        <span aria-hidden="true" className="material-symbols-outlined text-[16px] mr-0.5">
          emoji_events
        </span>
      )}
      {n}º
    </span>
  );
}

export function MelhoresClientes({
  inicio,
  fim,
  rotuloDoPeriodo,
  atualizacao = 0,
}: {
  /** Período fixo (o mês do relatório mensal), AAAA-MM-DD. Sem ele, o cartão tem o seu. */
  inicio?: string;
  fim?: string;
  rotuloDoPeriodo?: string;
  /** Muda quando a página pede para atualizar. */
  atualizacao?: number;
}) {
  const periodoFixo = !!(inicio && fim);
  const [inicioProprio, setInicioProprio] = useState(trintaDiasAtras());
  const [fimProprio, setFimProprio] = useState(iso(new Date()));
  const de = periodoFixo ? inicio! : inicioProprio;
  const ate = periodoFixo ? fim! : fimProprio;

  const [ordem, setOrdem] = useState<Ordem>('consumido');
  const [limite, setLimite] = useState(POUCOS);
  const [dados, setDados] = useState<Ranking | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Só a resposta do pedido mais recente entra na tela (troca rápida de ordem ou de mês).
  const pedidoNaTela = useRef('');

  useEffect(() => {
    if (!de || !ate || de > ate) return;
    const busca = new URLSearchParams({
      startDate: de,
      endDate: ate,
      ordem,
      limite: String(limite),
    });
    const chave = busca.toString();
    pedidoNaTela.current = chave;
    setCarregando(true);
    setErro(null);
    void (async () => {
      try {
        const resp = await api.get(`/indicators/clientes?${chave}`);
        if (pedidoNaTela.current !== chave) return;
        if (!resp.ok) throw new Error('Não foi possível carregar o ranking de clientes.');
        setDados(await resp.json());
      } catch (e) {
        if (pedidoNaTela.current !== chave) return;
        setErro(e instanceof Error ? e.message : 'Erro ao carregar o ranking de clientes.');
      } finally {
        if (pedidoNaTela.current === chave) setCarregando(false);
      }
    })();
  }, [de, ate, ordem, limite, atualizacao]);

  const clientes = dados?.clientes ?? [];
  const totais = dados?.totais;

  const exportar = () => {
    if (!dados) return;
    exportToCSV({
      filename: `melhores_clientes_${dados.periodo.inicio}_a_${dados.periodo.fim}`,
      columns: [
        { key: 'posicao', header: 'Posição' },
        { key: 'nome', header: 'Cliente' },
        { key: 'celular', header: 'Celular' },
        { key: 'recargas', header: 'Recargas' },
        { key: 'kwh', header: 'Energia (kWh)' },
        { key: 'consumido', header: 'Gastou (R$)' },
        { key: 'ticketMedio', header: 'Por recarga (R$)' },
        { key: 'ultima', header: 'Última recarga' },
      ],
      data: clientes.map(c => ({
        posicao: c.posicao,
        nome: c.nome,
        celular: c.celular ?? '',
        recargas: c.recargas,
        kwh: fmtNum(c.kwh, 2),
        consumido: fmtNum(c.consumido, 2),
        ticketMedio: fmtNum(c.ticketMedio, 2),
        ultima: dataCurta(c.ultimaRecarga),
      })),
      rodape: [
        `Ordem: ${ORDENS.find(o => o.id === dados.ordem)?.rotulo ?? dados.ordem}`,
        'Visitantes e contas da equipe ficam fora do ranking.',
      ],
    });
  };

  return (
    <section
      className={`${classeDoCartao} p-[22px] 3xl:p-[26px] print-avoid`}
      aria-label="Melhores clientes"
    >
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3 mb-5">
        <div className="flex items-start gap-[18px] min-w-0">
          <BlocoDeIcone tom="amarelo">
            <span aria-hidden="true" className="material-symbols-outlined text-[22px]">
              emoji_events
            </span>
          </BlocoDeIcone>
          <div className="min-w-0">
            <h3 className="text-[20px] leading-tight font-semibold text-foreground">
              Melhores clientes
            </h3>
            <p className="text-sm font-medium text-muted-foreground mt-1">
              Quem mais gastou, carregou e recarregou
              {periodoFixo && rotuloDoPeriodo ? ` em ${rotuloDoPeriodo}` : ' no período'}. Para
              premiar quem mais movimenta a rede.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 no-print">
          {!periodoFixo && (
            <DateRangePicker
              startDate={inicioProprio}
              endDate={fimProprio}
              onStartDateChange={setInicioProprio}
              onEndDateChange={setFimProprio}
              onClear={() => {
                setInicioProprio(trintaDiasAtras());
                setFimProprio(iso(new Date()));
              }}
              className={`${classeDaPilula} justify-start`}
            />
          )}
          <button
            type="button"
            onClick={exportar}
            disabled={!clientes.length}
            className={`${classeDoBotaoContorno} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-base">
              download
            </span>
            Exportar
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4" role="group" aria-label="Ordenar o ranking">
        {ORDENS.map(o => (
          <button
            key={o.id}
            type="button"
            onClick={() => setOrdem(o.id)}
            aria-pressed={ordem === o.id}
            className={`h-8 px-3.5 rounded-[25px] text-[13px] font-medium transition-colors ${
              ordem === o.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground hover:bg-muted/70'
            }`}
          >
            {o.rotulo}
          </button>
        ))}
      </div>

      {erro ? (
        <p className="text-sm text-destructive py-6 text-center">{erro}</p>
      ) : carregando && !dados ? (
        <div className="h-40 flex items-center justify-center">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary" />
        </div>
      ) : !clientes.length ? (
        <div className="h-40 flex flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-border text-muted-foreground">
          <span aria-hidden="true" className="material-symbols-outlined text-4xl">
            emoji_events
          </span>
          <p className="text-sm">Nenhum cliente com recarga neste período.</p>
        </div>
      ) : (
        <div className={`space-y-3 ${carregando ? 'opacity-60' : ''}`}>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm min-w-[760px]">
              <thead className={classeDoCabecalhoDaTabela}>
                <tr>
                  <th className="px-3 py-2.5 text-left w-16">Posição</th>
                  <th className="px-3 py-2.5 text-left">Cliente</th>
                  <th className="px-3 py-2.5 text-right">Recargas</th>
                  <th className="px-3 py-2.5 text-right">Energia</th>
                  <th className="px-3 py-2.5 text-right">Gastou</th>
                  <th className="px-3 py-2.5 text-right">Por recarga</th>
                  <th className="px-3 py-2.5 text-right">Última recarga</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map(c => (
                  <tr key={c.userId} className="border-b border-border hover:bg-muted/60">
                    <td className="px-3 py-3">
                      <Posicao n={c.posicao} />
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-foreground">{c.nome}</p>
                      <p className="text-xs text-muted-foreground">{c.celular ?? 'sem celular'}</p>
                    </td>
                    <td
                      className={`px-3 py-3 text-right tabular-nums ${ordem === 'recargas' ? 'font-semibold text-foreground' : 'text-foreground'}`}
                    >
                      {fmtInt(c.recargas)}
                    </td>
                    <td
                      className={`px-3 py-3 text-right tabular-nums ${ordem === 'kwh' ? 'font-semibold text-foreground' : 'text-foreground'}`}
                    >
                      {fmtNum(c.kwh, 1)} kWh
                    </td>
                    <td
                      className={`px-3 py-3 text-right tabular-nums ${ordem === 'consumido' ? 'font-semibold text-primary-strong' : 'text-foreground'}`}
                    >
                      {fmtBRL(c.consumido, 2)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {fmtBRL(c.ticketMedio, 2)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {dataCurta(c.ultimaRecarga)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            {totais && (
              <p className="text-xs text-muted-foreground">
                {fmtInt(totais.clientes)} {totais.clientes === 1 ? 'cliente' : 'clientes'} no
                período · {fmtInt(totais.recargas)} recargas · {fmtNum(totais.kwh, 1)} kWh ·{' '}
                {fmtBRL(totais.consumido, 2)}. Visitantes e contas da equipe ficam fora.
              </p>
            )}
            {totais && totais.clientes > POUCOS && (
              <button
                type="button"
                onClick={() => setLimite(l => (l === POUCOS ? MUITOS : POUCOS))}
                className="text-sm font-medium text-primary-strong hover:underline no-print self-start sm:self-auto"
              >
                {limite === POUCOS
                  ? `Ver os ${Math.min(MUITOS, totais.clientes)} primeiros`
                  : `Ver só os ${POUCOS} primeiros`}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
