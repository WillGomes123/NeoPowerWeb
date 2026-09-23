import type { AbaEnergia, PainelEnergia } from '../../lib/energia';

/** O que toda aba do módulo recebe da página. */
export interface AbaProps {
  painel: PainelEnergia;
  /** Só admin muda (cadastro, conexão, rateio); operador da NeoPower consulta. */
  podeEditar: boolean;
  /** Chama a API e, se der certo, troca o painel pelo recalculado que ela devolve. */
  mudar: (
    metodo: 'post' | 'put',
    url: string,
    corpo?: unknown,
    sucesso?: string
  ) => Promise<boolean>;
  irPara: (aba: AbaEnergia) => void;
}
