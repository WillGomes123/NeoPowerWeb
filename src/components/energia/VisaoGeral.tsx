import { brl, pct } from '../../lib/energia';
import type { AbaProps } from './tipos';
import { TabelaConexoes } from './TabelaConexoes';
import { Aviso, Botao, KPI, Painel } from './ui';

/** Módulo recém-aberto: diz por onde começar, em vez de mostrar tudo zerado. */
function Comecar({ painel, podeEditar, irPara }: AbaProps) {
  const passos = [
    {
      feito: painel.usinas.length > 0,
      texto: 'Cadastre as usinas: dono, UC, geração prevista e custo fixo.',
      aba: 'usinas' as const,
      botao: 'Ir para Usinas',
    },
    {
      feito: painel.pontos.length > 0,
      texto: 'Cadastre os pontos consumidores: titular, UC e consumo do mês.',
      aba: 'pontos' as const,
      botao: 'Ir para Pontos',
    },
    {
      feito: painel.conexoes.length > 0,
      texto: 'Ligue cada ponto a uma usina, com a cota e a regra de preço.',
      aba: 'conexoes' as const,
      botao: 'Ir para Conexões',
    },
  ];
  return (
    <Painel titulo="Comece por aqui" detalhe="O módulo ainda não tem usinas, pontos ou conexões.">
      <ol className="p-5 space-y-3">
        {passos.map((p, i) => (
          <li key={p.aba} className="flex flex-wrap items-center gap-3">
            <span
              className={`material-symbols-outlined text-xl ${p.feito ? 'text-primary' : 'text-on-surface-variant'}`}
            >
              {p.feito ? 'check_circle' : 'radio_button_unchecked'}
            </span>
            <span className="flex-1 min-w-[200px] text-sm text-on-surface">
              <b>{i + 1}.</b> {p.texto}
            </span>
            {!p.feito && (
              <Botao pequeno onClick={() => irPara(p.aba)}>
                {p.botao}
              </Botao>
            )}
          </li>
        ))}
      </ol>
      {!podeEditar && (
        <p className="px-5 pb-5 text-xs text-on-surface-variant">
          Os cadastros são feitos por um administrador.
        </p>
      )}
    </Painel>
  );
}

export function VisaoGeral(props: AbaProps) {
  const { painel, irPara } = props;
  const { kpis } = painel;
  const ativas = painel.conexoes.filter(c => c.status !== 'cancelado');
  const semUsina = kpis.pontosTotal - kpis.pontosComEnergia;
  const montado =
    painel.usinas.length > 0 && painel.pontos.length > 0 && painel.conexoes.length > 0;

  return (
    <div className="space-y-6">
      {!montado && <Comecar {...props} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <KPI
          icone="solar_power"
          rotulo="Usinas conectadas"
          valor={String(kpis.usinasOperando)}
          detalhe={
            kpis.usinasEmHomologacao
              ? `+${kpis.usinasEmHomologacao} em homologação`
              : painel.usinas.length
                ? 'todas operando'
                : 'nenhuma cadastrada'
          }
        />
        <KPI
          icone="ev_station"
          rotulo="Pontos com energia"
          valor={`${kpis.pontosComEnergia} / ${kpis.pontosTotal}`}
          detalhe={
            !kpis.pontosTotal
              ? 'nenhum cadastrado'
              : semUsina
                ? `${semUsina} ainda sem usina`
                : 'todos com usina'
          }
        />
        <KPI
          icone="bolt"
          rotulo="kWh compensados / mês"
          valor={kpis.compensadoKwh.toLocaleString('pt-BR')}
          detalhe={`de ${kpis.geradoKwh.toLocaleString('pt-BR')} gerados`}
        />
        <KPI
          icone="savings"
          rotulo="Economia dos pontos"
          valor={brl(kpis.economia)}
          detalhe="por mês"
          destaque
        />
        <KPI
          icone="payments"
          rotulo="Repasse às usinas"
          valor={brl(kpis.repasseUsinas)}
          detalhe={`NeoPower ${brl(kpis.neopower)} (${pct(painel.parametros.taxaNeopower)})`}
        />
      </div>

      {montado && (
        <Painel
          titulo="Alertas"
          detalhe={painel.alertas.length ? 'O que precisa de ação hoje' : undefined}
        >
          <div className="p-5 space-y-2.5">
            {painel.alertas.length === 0 && (
              <Aviso tom="ok">
                Nada pendente: todas as usinas com rateio em dia e todos os pontos com energia.
              </Aviso>
            )}
            {painel.alertas.map((a, i) => (
              <Aviso
                key={i}
                tom={a.nivel === 'erro' ? 'erro' : 'aviso'}
                acao={
                  a.aba ? (
                    <Botao pequeno onClick={() => irPara(a.aba!)}>
                      {a.aba === 'rateio' ? 'Abrir rateio' : 'Conectar'}
                    </Botao>
                  ) : undefined
                }
              >
                {a.texto}
              </Aviso>
            ))}
          </div>
        </Painel>
      )}

      {/* Antes da primeira conexão, os alertas de "ponto sem usina" seriam só ruído. */}
      {!montado && painel.alertas.some(a => a.nivel === 'erro') && (
        <div className="space-y-2.5">
          {painel.alertas
            .filter(a => a.nivel === 'erro')
            .map((a, i) => (
              <Aviso key={i} tom="erro">
                {a.texto}
              </Aviso>
            ))}
        </div>
      )}

      {ativas.length > 0 && (
        <Painel
          titulo="Conexões ativas"
          detalhe={`${ativas.length} conexões · ${painel.usinas.length} usinas`}
        >
          <TabelaConexoes painel={painel} lista={ativas} />
        </Painel>
      )}
    </div>
  );
}
