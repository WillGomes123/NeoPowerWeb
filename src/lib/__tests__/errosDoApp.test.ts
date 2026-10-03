import { describe, it, expect } from 'vitest';
import {
  DIA_MS,
  FILTROS_PADRAO,
  POR_PAGINA,
  atrasoDaChegada,
  codigoDoRelato,
  compararVersoes,
  consultaDosErros,
  ehFatal,
  faixaDaPagina,
  infoDoTipo,
  jsEmUso,
  lerFiltros,
  mensagemDaFalha,
  mensagemDeErro,
  normalizarPagina,
  normalizarResumo,
  paramsDosFiltros,
  temFiltroAtivo,
  textoDoRelato,
  versaoComBuild,
  versoesDoFiltro,
  type RelatoDeErro,
} from '../errosDoApp';

const relato = (over: Partial<RelatoDeErro> = {}): RelatoDeErro => ({
  id: 7,
  criadoEm: '2026-10-02T12:00:00.000Z',
  ocorridoEm: '2026-10-02T11:59:30.000Z',
  tipo: 'js_fatal',
  mensagem: "TypeError: Cannot read property 'id' of undefined",
  pilha: 'at ChargingInProgressScreen (index.bundle:1:2345)',
  fatal: true,
  tela: 'ChargingInProgress',
  clientId: 'vipenergy',
  appVersao: '1.0.6',
  appBuild: '12',
  updateId: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789',
  canal: 'production',
  runtime: '1.0.6',
  plataforma: 'ios',
  osVersao: '18.1',
  modelo: 'iPhone 13',
  appId: 'com.vipenergy.app',
  embutida: false,
  emergencia: false,
  userId: 42,
  contexto: { codigo: 'E-1A2B3C', execucao: 'lx1-abc' },
  ...over,
});

describe('consultaDosErros', () => {
  const agora = Date.parse('2026-10-02T12:00:00.000Z');

  it('manda só os filtros preenchidos, com a página e o tamanho dela', () => {
    const q = new URLSearchParams(consultaDosErros(FILTROS_PADRAO, 1, agora));
    expect(q.has('clientId')).toBe(false);
    expect(q.has('versao')).toBe(false);
    expect(q.has('tipo')).toBe(false);
    expect(q.get('pagina')).toBe('1');
    expect(q.get('porPagina')).toBe(String(POR_PAGINA));
  });

  it('converte o período no desde (ISO) contado a partir de agora', () => {
    const q = new URLSearchParams(
      consultaDosErros({ ...FILTROS_PADRAO, periodo: '24h' }, 1, agora)
    );
    expect(q.get('desde')).toBe(new Date(agora - DIA_MS).toISOString());
    const q30 = new URLSearchParams(
      consultaDosErros({ ...FILTROS_PADRAO, periodo: '30d' }, 1, agora)
    );
    expect(q30.get('desde')).toBe(new Date(agora - 30 * DIA_MS).toISOString());
  });

  it('usa os nomes de parâmetro do contrato da API', () => {
    const q = new URLSearchParams(
      consultaDosErros(
        { marca: 'vipenergy', versao: '1.0.6', tipo: 'encerramento_abrupto', periodo: '7d' },
        3,
        agora
      )
    );
    expect(q.get('clientId')).toBe('vipenergy');
    expect(q.get('versao')).toBe('1.0.6');
    expect(q.get('tipo')).toBe('encerramento_abrupto');
    expect(q.get('pagina')).toBe('3');
  });
});

describe('filtros na URL', () => {
  it('lê e escreve os filtros sem perder nada', () => {
    const filtros = {
      marca: 'vipenergy',
      versao: '1.0.5',
      tipo: 'boundary' as const,
      periodo: '30d' as const,
    };
    const lidos = lerFiltros(new URLSearchParams(paramsDosFiltros(filtros, 4)));
    expect(lidos).toEqual({ filtros, pagina: 4 });
  });

  it('deixa fora da URL o que é padrão', () => {
    expect(paramsDosFiltros(FILTROS_PADRAO, 1)).toEqual({});
    expect(temFiltroAtivo(FILTROS_PADRAO)).toBe(false);
  });

  it('troca a marca neo (só do painel) pelo clientId que o app NeoPower manda', () => {
    expect(lerFiltros(new URLSearchParams('marca=neo')).filtros.marca).toBe('neopower-default');
    expect(lerFiltros(new URLSearchParams('marca=vipenergy')).filtros.marca).toBe('vipenergy');
  });

  it('ignora tipo, período e página que não existem', () => {
    const { filtros, pagina } = lerFiltros(
      new URLSearchParams('tipo=crash&periodo=1ano&pagina=-2&versao=%20')
    );
    expect(filtros).toEqual(FILTROS_PADRAO);
    expect(pagina).toBe(1);
  });
});

describe('versões', () => {
  it('ordena 1.0.10 depois de 1.0.9', () => {
    expect(compararVersoes('1.0.10', '1.0.9')).toBeGreaterThan(0);
    expect(compararVersoes('1.0.3', '1.0.6')).toBeLessThan(0);
    expect(compararVersoes('1.0.6', '1.0.6')).toBe(0);
  });

  it('lista as versões do resumo sem repetir, da mais nova para a mais antiga', () => {
    const resumo = normalizarResumo({
      desde: '2026-09-25T12:00:00.000Z',
      porVersao: [
        { appVersao: '1.0.5', appBuild: '9', plataforma: 'android', total: 3 },
        { appVersao: '1.0.10', appBuild: '20', plataforma: 'ios', total: 1 },
        { appVersao: '1.0.5', appBuild: '9', plataforma: 'ios', total: 2 },
        { appVersao: null, appBuild: null, plataforma: 'web', total: 5 },
      ],
      porTipo: [],
    });
    expect(versoesDoFiltro(resumo, [], null)).toEqual(['1.0.10', '1.0.5']);
    expect(versoesDoFiltro(null, [], null)).toEqual([]);
  });

  it('junta ao filtro as versões da página e a escolhida, que podem ser de antes dos 7 dias', () => {
    const resumo = normalizarResumo({
      porVersao: [{ appVersao: '1.0.6', appBuild: '12', plataforma: 'ios', total: 1 }],
    });
    const itens = [relato({ appVersao: '1.0.3' }), relato({ appVersao: null }), relato()];
    expect(versoesDoFiltro(resumo, itens, '1.0.4')).toEqual(['1.0.6', '1.0.4', '1.0.3']);
    // Sem o resumo (falhou), o filtro ainda tem o que a lista trouxe.
    expect(versoesDoFiltro(null, itens, null)).toEqual(['1.0.6', '1.0.3']);
  });

  it('mostra a versão com o build entre parênteses', () => {
    expect(versaoComBuild('1.0.6', '12')).toBe('1.0.6 (12)');
    expect(versaoComBuild('1.0.6', null)).toBe('1.0.6');
    expect(versaoComBuild(null, null)).toBe('—');
  });
});

describe('relato', () => {
  it('diz qual JS estava rodando', () => {
    expect(jsEmUso(relato())).toBe('OTA a1b2c3d4');
    expect(jsEmUso(relato({ embutida: true }))).toBe('JS do binário');
    expect(jsEmUso(relato({ embutida: null, updateId: null }))).toBeNull();
  });

  it('sem o campo fatal, só o js_fatal conta como fatal', () => {
    expect(ehFatal({ tipo: 'js_fatal', fatal: null })).toBe(true);
    expect(ehFatal({ tipo: 'boundary', fatal: null })).toBe(false);
    expect(ehFatal({ tipo: 'updates_log', fatal: true })).toBe(true);
  });

  it('mostra o tipo desconhecido pelo código, sem quebrar', () => {
    expect(infoDoTipo('js_fatal').rotulo).toBe('Erro fatal de JS');
    expect(infoDoTipo('tipo_novo').rotulo).toBe('tipo_novo');
  });

  it('acha o código que a tela de erro mostrou', () => {
    expect(codigoDoRelato(relato())).toBe('E-1A2B3C');
    expect(codigoDoRelato(relato({ contexto: null }))).toBeNull();
    expect(codigoDoRelato(relato({ contexto: { codigo: 12 } }))).toBeNull();
  });

  it('conta o atraso da chegada só quando passa de 2 minutos', () => {
    expect(atrasoDaChegada(relato())).toBeNull();
    expect(atrasoDaChegada(relato({ ocorridoEm: null }))).toBeNull();
    expect(atrasoDaChegada(relato({ ocorridoEm: '2026-10-02T11:45:00.000Z' }))).toBe('15 min');
    expect(atrasoDaChegada(relato({ ocorridoEm: '2026-10-02T09:00:00.000Z' }))).toBe('3 h');
    expect(atrasoDaChegada(relato({ ocorridoEm: '2026-09-29T12:00:00.000Z' }))).toBe('3 dias');
  });

  it('monta o texto para colar com versão, OTA, aparelho, pilha e contexto', () => {
    const texto = textoDoRelato(relato(), 'Vip Energy');
    expect(texto).toContain('Relato #7: Erro fatal de JS (js_fatal), fatal');
    expect(texto).toContain('Marca: Vip Energy (vipenergy)');
    expect(texto).toContain('App: 1.0.6 (12), OTA a1b2c3d4');
    expect(texto).toContain('a1b2c3d4-e5f6-7890-abcd-ef0123456789');
    expect(texto).toContain('Aparelho: iOS 18.1, iPhone 13, com.vipenergy.app');
    expect(texto).toContain('Usuário: #42');
    expect(texto).toContain('Código: E-1A2B3C');
    expect(texto).toContain('at ChargingInProgressScreen');
    expect(texto).toContain('"execucao": "lx1-abc"');
  });
});

describe('respostas da API', () => {
  it('normaliza a página mesmo com campos faltando', () => {
    expect(normalizarPagina(null)).toEqual({
      itens: [],
      total: 0,
      pagina: 1,
      porPagina: POR_PAGINA,
    });
    expect(normalizarPagina({ itens: [relato()], total: 1, pagina: 1, porPagina: 25 }).total).toBe(
      1
    );
  });

  it('normaliza o resumo mesmo com campos faltando', () => {
    expect(normalizarResumo(undefined)).toEqual({ desde: null, porVersao: [], porTipo: [] });
  });

  it('troca o texto do navegador numa falha de rede', () => {
    expect(mensagemDaFalha(new TypeError('Failed to fetch'))).toBe(
      'Falha de rede ao buscar os erros'
    );
    expect(mensagemDaFalha('x')).toBe('Falha de rede ao buscar os erros');
    expect(mensagemDaFalha(new Error('Unauthorized'))).toBe('Unauthorized');
  });

  it('o rodapé conta a página que chegou e não passa do fim', () => {
    const itens = (n: number) => Array.from({ length: n }, (_, i) => relato({ id: i }));
    expect(faixaDaPagina({ itens: itens(5), total: 30, pagina: 2, porPagina: 25 })).toEqual({
      inicio: 26,
      fim: 30,
      pagina: 2,
      totalDePaginas: 2,
      passouDoFim: false,
    });
    // Link de uma página que não existe mais: nada de "51–30 de 30" nem "Página 3 de 2".
    expect(faixaDaPagina({ itens: [], total: 30, pagina: 3, porPagina: 25 })).toEqual({
      inicio: 0,
      fim: 0,
      pagina: 2,
      totalDePaginas: 2,
      passouDoFim: true,
    });
    expect(faixaDaPagina({ itens: [], total: 0, pagina: 1, porPagina: 25 }).passouDoFim).toBe(
      false
    );
  });

  it('extrai a mensagem de erro do envelope da API', () => {
    expect(mensagemDeErro({ success: false, error: 'Só a NeoPower.' }, 403)).toBe('Só a NeoPower.');
    expect(mensagemDeErro({ error: { message: 'Falhou' } }, 500)).toBe('Falhou');
    expect(mensagemDeErro(null, 502)).toBe('Erro 502 ao buscar os erros do app');
  });
});
