import { brl, pct } from '../../lib/energia';
import type { AbaProps } from './tipos';
import { TabelaConexoes } from './TabelaConexoes';
import { Aviso, Botao, KPI, Painel } from './ui';

export function VisaoGeral({ painel, irPara }: AbaProps) {
  const { kpis } = painel;
  const ativas = painel.conexoes.filter(c => c.status !== 'cancelado');
  const semUsina = kpis.pontosTotal - kpis.pontosComEnergia;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <KPI
          icone="solar_power"
          rotulo="Usinas conectadas"
          valor={String(kpis.usinasOperando)}
          detalhe={
            kpis.usinasEmHomologacao
              ? `+${kpis.usinasEmHomologacao} em homologação`
              : 'todas operando'
          }
        />
        <KPI
          icone="ev_station"
          rotulo="Pontos com energia"
          valor={`${kpis.pontosComEnergia} / ${kpis.pontosTotal}`}
          detalhe={semUsina ? `${semUsina} ainda sem usina` : 'todos com usina'}
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

      <Painel
        titulo="Conexões ativas"
        detalhe={`${ativas.length} conexões · ${painel.usinas.length} usinas`}
      >
        <TabelaConexoes painel={painel} lista={ativas} />
      </Painel>
    </div>
  );
}
