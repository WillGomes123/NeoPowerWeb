/**
 * Custo de energia do operador: o que ele paga na conta de luz por kWh. Só a
 * gestão da marca vê; não muda o preço cobrado nem aparece no app.
 */

export interface FaixaDeCusto {
  inicio: string;
  fim: string;
  preco: number;
  dias?: number[];
  rotulo?: string | null;
}

export interface CustoDoLocal {
  id: number;
  custoKwh: number;
  faixas: FaixaDeCusto[];
  vigenteDesde: string;
}

export interface ApuracaoDeEnergia {
  recargas: number;
  energiaKwh: number;
  custo: number;
  porCusto: Array<{ custoKwh: number; kwh: number }>;
  semCusto: { recargas: number; energiaKwh: number };
  pelaProporcaoDoTempo: number;
}

export interface ApuracaoDoLocal extends ApuracaoDeEnergia {
  locationId: number;
  nome: string;
  temCusto: boolean;
}

export interface RespostaDaApuracao {
  locais: ApuracaoDoLocal[];
  total: ApuracaoDeEnergia;
}

export interface FormularioDeCusto {
  custoKwh: string;
  temPonta: boolean;
  custoPonta: string;
  inicioPonta: string;
  fimPonta: string;
  diasPonta: number[];
  vigenteDesde: string;
}

/** Segunda a sexta: a ponta da conta de luz não vale em fim de semana. */
export const DIAS_DA_PONTA_PADRAO = [1, 2, 3, 4, 5];
export const NOMES_DOS_DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

const lerValor = (texto: string): number => Number(texto.trim().replace(',', '.'));

/** Formulário preenchido com o custo que vale hoje, ou vazio. */
export function formularioDoCusto(atual: CustoDoLocal | null, hoje: string): FormularioDeCusto {
  const ponta = atual?.faixas[0];
  return {
    custoKwh: atual ? String(atual.custoKwh).replace('.', ',') : '',
    temPonta: !!ponta,
    custoPonta: ponta ? String(ponta.preco).replace('.', ',') : '',
    inicioPonta: ponta?.inicio ?? '18:00',
    fimPonta: ponta?.fim ?? '20:59',
    diasPonta: ponta?.dias?.length ? ponta.dias : DIAS_DA_PONTA_PADRAO,
    vigenteDesde: hoje,
  };
}

/** Corpo do POST, ou o recado do que falta preencher. */
export function corpoDoCusto(
  f: FormularioDeCusto
):
  | { erro: string }
  | { corpo: { custoKwh: number; faixasHorarias: FaixaDeCusto[]; vigenteDesde: string } } {
  const custoKwh = lerValor(f.custoKwh);
  if (!Number.isFinite(custoKwh) || custoKwh <= 0) return { erro: 'Informe o custo por kWh.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.vigenteDesde)) {
    return { erro: 'Informe a data em que este custo passa a valer.' };
  }
  const faixasHorarias: FaixaDeCusto[] = [];
  if (f.temPonta) {
    const preco = lerValor(f.custoPonta);
    if (!Number.isFinite(preco) || preco <= 0) return { erro: 'Informe o custo na ponta.' };
    if (!HHMM.test(f.inicioPonta) || !HHMM.test(f.fimPonta)) {
      return { erro: 'Informe o horário da ponta.' };
    }
    if (f.diasPonta.length === 0) return { erro: 'Escolha os dias da ponta.' };
    faixasHorarias.push({
      inicio: f.inicioPonta,
      fim: f.fimPonta,
      preco,
      dias: [...f.diasPonta].sort((a, b) => a - b),
      rotulo: 'Ponta',
    });
  }
  return { corpo: { custoKwh, faixasHorarias, vigenteDesde: f.vigenteDesde } };
}

/** Quanto sobra do repasse depois da conta de luz. */
export function sobraDepoisDaEnergia(repasse: number, custo: number): number {
  return Math.round((repasse - custo) * 100) / 100;
}

export const brl = (v: number): string =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** "1.200,5 kWh a R$ 0,45 · 349 kWh a R$ 1,79" */
export function textoPorCusto(porCusto: ApuracaoDeEnergia['porCusto']): string {
  return porCusto
    .map(p => `${p.kwh.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kWh a ${brl(p.custoKwh)}`)
    .join(' · ');
}

/** "R$ 0,45/kWh; ponta R$ 1,79 (18:00 às 20:59, Seg, Ter, Qua, Qui, Sex)" */
export function textoDoCusto(c: CustoDoLocal): string {
  const base = `${brl(c.custoKwh)}/kWh`;
  if (c.faixas.length === 0) return `${base} (tarifa única)`;
  const faixas = c.faixas.map(f => {
    const dias = f.dias?.length ? `, ${f.dias.map(d => NOMES_DOS_DIAS[d]).join(', ')}` : '';
    return `${(f.rotulo ?? 'faixa').toLowerCase()} ${brl(f.preco)} (${f.inicio} às ${f.fim}${dias})`;
  });
  return `${base}; ${faixas.join('; ')}`;
}
