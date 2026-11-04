import { describe, it, expect } from 'vitest';
import {
  corpoDoCusto,
  CustoDoLocal,
  DIAS_DA_PONTA_PADRAO,
  formularioDoCusto,
  sobraDepoisDaEnergia,
  textoDoCusto,
  textoPorCusto,
} from '../custoDeEnergia';

const HOJE = '2026-11-04';
const DIAMOND: CustoDoLocal = {
  id: 1,
  custoKwh: 0.45,
  faixas: [{ inicio: '18:00', fim: '20:59', preco: 1.79, dias: [1, 2, 3, 4, 5], rotulo: 'Ponta' }],
  vigenteDesde: '2026-10-01',
};

describe('formulário do custo de energia', () => {
  it('começa vazio, com a ponta da conta de luz sugerida', () => {
    const f = formularioDoCusto(null, HOJE);
    expect(f).toMatchObject({
      custoKwh: '',
      temPonta: false,
      inicioPonta: '18:00',
      fimPonta: '20:59',
      vigenteDesde: HOJE,
    });
    expect(f.diasPonta).toEqual(DIAS_DA_PONTA_PADRAO);
  });

  it('abre com o custo atual, mas a vigência nova é hoje', () => {
    const f = formularioDoCusto(DIAMOND, HOJE);
    expect(f).toMatchObject({ custoKwh: '0,45', temPonta: true, custoPonta: '1,79', vigenteDesde: HOJE });
  });

  it('tarifa única vai sem faixa', () => {
    const r = corpoDoCusto({ ...formularioDoCusto(null, HOJE), custoKwh: '0,25' });
    expect(r).toEqual({ corpo: { custoKwh: 0.25, faixasHorarias: [], vigenteDesde: HOJE } });
  });

  it('com ponta, vai a faixa com os dias em ordem', () => {
    const r = corpoDoCusto({
      ...formularioDoCusto(null, HOJE),
      custoKwh: '0,45',
      temPonta: true,
      custoPonta: '1,79',
      diasPonta: [5, 1, 3],
    });
    expect(r).toEqual({
      corpo: {
        custoKwh: 0.45,
        vigenteDesde: HOJE,
        faixasHorarias: [{ inicio: '18:00', fim: '20:59', preco: 1.79, dias: [1, 3, 5], rotulo: 'Ponta' }],
      },
    });
  });

  it('avisa o que falta', () => {
    const vazio = formularioDoCusto(null, HOJE);
    expect(corpoDoCusto(vazio)).toEqual({ erro: 'Informe o custo por kWh.' });
    expect(corpoDoCusto({ ...vazio, custoKwh: '0,45', temPonta: true })).toEqual({
      erro: 'Informe o custo na ponta.',
    });
    expect(
      corpoDoCusto({ ...vazio, custoKwh: '0,45', temPonta: true, custoPonta: '1,79', diasPonta: [] })
    ).toEqual({ erro: 'Escolha os dias da ponta.' });
    expect(corpoDoCusto({ ...vazio, custoKwh: '0,45', vigenteDesde: '' })).toEqual({
      erro: 'Informe a data em que este custo passa a valer.',
    });
  });
});

describe('textos e contas', () => {
  it('sobra é o repasse menos a conta de luz', () => {
    expect(sobraDepoisDaEnergia(2166.24, 1000.1)).toBe(1166.14);
  });

  it('descreve o custo e os kWh de cada preço', () => {
    expect(textoDoCusto(DIAMOND)).toContain('ponta');
    expect(textoDoCusto(DIAMOND)).toContain('18:00 às 20:59');
    expect(textoDoCusto({ ...DIAMOND, faixas: [] })).toContain('tarifa única');
    expect(
      textoPorCusto([
        { custoKwh: 0.45, kwh: 10 },
        { custoKwh: 1.79, kwh: 2.5 },
      ])
    ).toContain(' · ');
  });
});
