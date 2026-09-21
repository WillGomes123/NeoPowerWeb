import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import type { Apuracao, Cobranca, Conexao, Modalidade, RegraPreco } from '../../lib/energia';
import { brl, kwh, pct, tarifa } from '../../lib/energia';
import type { AbaProps } from './tipos';
import { Campo, Escolha, Numero } from './campos';
import { TabelaConexoes } from './TabelaConexoes';
import { Aviso, Botao, Formula, Painel } from './ui';

type Previa = { erros: string[]; avisos: string[]; previa: Apuracao | null };

export function Conexoes({ painel, podeEditar, mudar, irPara }: AbaProps) {
  // Abre na usina com mais capacidade livre: é onde uma conexão nova tem chance de caber.
  const [usinaId, setUsinaId] = useState(() => {
    const candidatas = painel.usinas.filter(u => u.status !== 'desativada');
    const melhor = [...candidatas].sort((x, y) => y.livreKwh - x.livreKwh)[0];
    return String(melhor?.id ?? painel.usinas[0]?.id ?? '');
  });
  const [pontoId, setPontoId] = useState(
    String(painel.pontos.find(p => !p.conexao)?.id ?? painel.pontos[0]?.id ?? '')
  );
  const [modalidade, setModalidade] = useState<Modalidade>('cons');
  const [cota, setCota] = useState<number | ''>(2000);
  const [regra, setRegra] = useState<RegraPreco>('desconto');
  const [valorPct, setValorPct] = useState<number | ''>(20);
  const [cobranca, setCobranca] = useState<Cobranca>('split');
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [criando, setCriando] = useState(false);
  const pedido = useRef(0);

  const corpo = {
    usinaId: Number(usinaId),
    pontoId: Number(pontoId),
    modalidade,
    cotaKwh: Number(cota) || 0,
    regra,
    valor: (Number(valorPct) || 0) / 100,
    cobranca,
  };
  const chave = JSON.stringify(corpo);

  // A regra mora na API: a cada mudança, pergunta a ela (com uma pausa curta
  // para não disparar a cada tecla) e mostra o que ela respondeu.
  useEffect(() => {
    if (!corpo.usinaId || !corpo.pontoId || !corpo.cotaKwh) {
      setPrevia(null);
      return;
    }
    const meu = ++pedido.current;
    const perguntar = async () => {
      try {
        const r = await api.post('/energia/conexoes/validar', corpo);
        const d = await r.json();
        if (meu === pedido.current && r.ok) setPrevia(d as Previa);
      } catch {
        /* a prévia é ajuda; sem ela o botão fica desligado */
      }
    };
    const t = setTimeout(() => void perguntar(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, painel]);

  const u = painel.usinas.find(x => x.id === corpo.usinaId);
  const p = painel.pontos.find(x => x.id === corpo.pontoId);
  const podeCriar = podeEditar && !!previa && previa.erros.length === 0 && !criando;

  const criar = async () => {
    setCriando(true);
    const cons = modalidade === 'cons' || modalidade === 'coop';
    await mudar(
      'post',
      '/energia/conexoes',
      corpo,
      cons ? 'Conexão criada. Rateio marcado para envio.' : 'Conexão criada.'
    );
    setCriando(false);
  };

  const encerrar = async (c: Conexao) => {
    const rateio = c.modalidade === 'cons' || c.modalidade === 'coop';
    if (
      !window.confirm(
        `Encerrar a conexão de ${c.pontoNome} com a ${c.usinaNome}? A cota de ${kwh(c.cotaKwh)} volta a ficar livre na usina.${rateio ? ' O rateio da usina vai precisar ser reenviado.' : ''}`
      )
    )
      return;
    await mudar(
      'post',
      `/energia/conexoes/${c.id}/encerrar`,
      undefined,
      rateio ? 'Conexão encerrada. Rateio marcado para reenvio.' : 'Conexão encerrada.'
    );
  };

  if (!painel.usinas.length || !painel.pontos.length) {
    const falta = [
      !painel.usinas.length && { t: 'uma usina', aba: 'usinas' as const },
      !painel.pontos.length && { t: 'um ponto consumidor', aba: 'pontos' as const },
    ].filter(Boolean) as { t: string; aba: 'usinas' | 'pontos' }[];
    return (
      <Painel titulo="Nova conexão" detalhe="Liga uma usina a um ponto.">
        <div className="p-5 space-y-3">
          <Aviso tom="aviso">
            Para criar uma conexão, cadastre antes {falta.map(f => f.t).join(' e ')}.
          </Aviso>
          <div className="flex gap-2">
            {falta.map(f => (
              <Botao key={f.aba} pequeno onClick={() => irPara(f.aba)}>
                {f.aba === 'usinas' ? 'Ir para Usinas' : 'Ir para Pontos'}
              </Botao>
            ))}
          </div>
        </div>
      </Painel>
    );
  }

  return (
    <div className="space-y-6">
      <Painel
        titulo="Nova conexão"
        detalhe="Liga uma usina a um ponto. As regras da modalidade são conferidas enquanto você preenche."
      >
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Campo rotulo="Usina">
              <Escolha
                valor={usinaId}
                onChange={setUsinaId}
                opcoes={painel.usinas.map(x => ({
                  v: String(x.id),
                  t: `${x.nome} · livre ${kwh(x.livreKwh)}`,
                }))}
              />
            </Campo>
            <Campo rotulo="Ponto consumidor">
              <Escolha
                valor={pontoId}
                onChange={setPontoId}
                opcoes={painel.pontos.map(x => ({
                  v: String(x.id),
                  t: `${x.nome} · ${kwh(x.consumoMensalKwh)}`,
                }))}
              />
            </Campo>
            <Campo rotulo="Modalidade">
              <Escolha
                valor={modalidade}
                onChange={setModalidade}
                opcoes={(Object.keys(painel.modalidades) as Modalidade[]).map(m => ({
                  v: m,
                  t: painel.modalidades[m].nome,
                }))}
              />
            </Campo>
            <Campo rotulo="Cota (kWh/mês)">
              <Numero valor={cota} onChange={setCota} step={100} />
            </Campo>
            <Campo rotulo="Regra de preço">
              <Escolha
                valor={regra}
                onChange={setRegra}
                opcoes={[
                  { v: 'desconto', t: 'Desconto ao ponto' },
                  { v: 'percentual_usina', t: '% do benefício à usina' },
                ]}
              />
            </Campo>
            <Campo
              rotulo={regra === 'desconto' ? 'Desconto ao ponto (%)' : '% do benefício à usina'}
            >
              <Numero valor={valorPct} onChange={setValorPct} step={1} />
            </Campo>
            <Campo rotulo="Cobrança">
              <Escolha
                valor={cobranca}
                onChange={setCobranca}
                opcoes={[
                  { v: 'split', t: 'Split da recarga' },
                  { v: 'saldo', t: 'Saldo da carteira' },
                  { v: 'boleto', t: 'Boleto' },
                ]}
              />
            </Campo>
            <div className="flex items-end">
              <Botao primario disabled={!podeCriar} onClick={() => void criar()}>
                <span className="material-symbols-outlined text-base">cable</span>
                {criando ? 'Criando…' : 'Criar conexão'}
              </Botao>
            </div>
          </div>

          {!podeEditar && (
            <Aviso tom="aviso">Você pode simular a conexão, mas só um administrador cria.</Aviso>
          )}

          {previa && (
            <div className="space-y-2">
              {previa.erros.map(e => (
                <Aviso key={e} tom="erro">
                  {e}
                </Aviso>
              ))}
              {previa.avisos.map(e => (
                <Aviso key={e} tom="aviso">
                  {e}
                </Aviso>
              ))}
              {previa.erros.length === 0 && previa.avisos.length === 0 && (
                <Aviso tom="ok">Regras da modalidade atendidas.</Aviso>
              )}
            </div>
          )}

          {previa?.previa && u && p && (
            <Formula>
              Prévia do mês · {p.nome} ← {u.nome}
              <br />
              compensado {previa.previa.compensadoKwh.toLocaleString('pt-BR')} kWh ×{' '}
              {tarifa(previa.previa.tarifa).replace('/kWh', '')} = {brl(previa.previa.bruto)}{' '}
              (bruto)
              <br />− Fio B {pct(painel.parametros.fioBEscalonamento)} ×{' '}
              {pct(painel.parametros.fioBParticipacao)} = {brl(previa.previa.fioB)}
              {'   '}− custo fixo da usina (cota) {brl(previa.previa.custoFixo)}
              <br />= benefício líquido {brl(previa.previa.liquido)}
              <br />
              ponto economiza <b className="text-primary">{brl(previa.previa.economia)}</b> ·
              cobrado no split {brl(previa.previa.cobrado)} → usina {brl(previa.previa.usina)} ·
              NeoPower {brl(previa.previa.neopower)}
            </Formula>
          )}
        </div>
      </Painel>

      <Painel
        titulo="Conexões"
        detalhe={`${painel.conexoes.length} no total, incluindo as encerradas`}
      >
        <TabelaConexoes
          painel={painel}
          lista={painel.conexoes}
          onEncerrar={podeEditar ? c => void encerrar(c) : undefined}
        />
      </Painel>
    </div>
  );
}
