import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';

/**
 * Quem investiu neste carregador, e quanto de cada recarga é dele.
 *
 * Até aqui o único "dono" do sistema era a marca inteira (client_id). Esta é a
 * tela que preenche `charger_owners` — sem ela o investidor não consegue ser
 * cadastrado por ninguém da operação, e o aplicativo dele fica vazio.
 *
 * O vínculo é por e-mail porque quem cadastra é o operador da marca, e a
 * listagem de usuários é restrita ao admin da plataforma.
 */

interface Dono {
  id: number;
  userId: number;
  nome: string | null;
  email: string | null;
  participacaoPercent: number;
  valorInvestido: number | null;
  investidoEm: string | null;
  ativo: boolean;
  observacao: string | null;
}

const dinheiro = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function DonosDoCarregador({ chargePointId }: { chargePointId: string }) {
  const [donos, setDonos] = useState<Dono[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [abrindoForm, setAbrindoForm] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [email, setEmail] = useState('');
  const [participacao, setParticipacao] = useState('100');
  const [valor, setValor] = useState('');
  const [data, setData] = useState('');

  const buscar = async () => {
    setCarregando(true);
    try {
      const r = await api.get(`/chargers/${encodeURIComponent(chargePointId)}/donos`);
      if (!r.ok) return; // carregador sem dono cadastrado ou sem permissão: some a seção
      const d = await r.json();
      setDonos(d.data ?? d ?? []);
    } catch {
      /* informação complementar: falhar aqui não pode derrubar o diálogo */
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (chargePointId) void buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargePointId]);

  const ativos = donos.filter(d => d.ativo);
  const soma = ativos.reduce((s, d) => s + Number(d.participacaoPercent || 0), 0);

  const limparForm = () => {
    setEmail('');
    setParticipacao('100');
    setValor('');
    setData('');
    setAbrindoForm(false);
  };

  const adicionar = async () => {
    const p = Number(participacao);
    if (!email.trim()) return toast.error('Informe o e-mail do investidor.');
    if (!Number.isFinite(p) || p <= 0 || p > 100) {
      return toast.error('A participação deve ser maior que 0 e no máximo 100.');
    }

    setSalvando(true);
    try {
      const r = await api.post(`/chargers/${encodeURIComponent(chargePointId)}/donos`, {
        email: email.trim(),
        participacaoPercent: p,
        valorInvestido: valor ? Number(valor) : null,
        investidoEm: data || null,
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        return toast.error(d?.message || 'Não foi possível vincular o investidor.');
      }
      if (d?.data?.aviso) toast.warning(d.data.aviso);
      else toast.success('Investidor vinculado.');
      limparForm();
      void buscar();
    } catch {
      toast.error('Não foi possível vincular o investidor.');
    } finally {
      setSalvando(false);
    }
  };

  const alterar = async (dono: Dono, mudanca: Partial<Dono>) => {
    try {
      const r = await api.put(
        `/chargers/${encodeURIComponent(chargePointId)}/donos/${dono.userId}`,
        mudanca
      );
      const d = await r.json().catch(() => null);
      if (!r.ok) return toast.error(d?.message || 'Não foi possível salvar.');
      if (d?.data?.aviso) toast.warning(d.data.aviso);
      void buscar();
    } catch {
      toast.error('Não foi possível salvar.');
    }
  };

  const encerrar = async (dono: Dono) => {
    if (!confirm(`Encerrar o vínculo de ${dono.nome || dono.email}?`)) return;
    try {
      const r = await api.delete(
        `/chargers/${encodeURIComponent(chargePointId)}/donos/${dono.userId}`
      );
      if (!r.ok) return toast.error('Não foi possível encerrar o vínculo.');
      toast.success('Vínculo encerrado.');
      void buscar();
    } catch {
      toast.error('Não foi possível encerrar o vínculo.');
    }
  };

  const entrada =
    'w-full bg-surface-container border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none';

  return (
    <div className="space-y-3">
      {carregando && donos.length === 0 ? (
        <p className="text-xs text-on-surface-variant">Carregando...</p>
      ) : ativos.length === 0 ? (
        <p className="text-xs text-on-surface-variant">
          Nenhum investidor vinculado. A receita deste ponto é toda da marca.
        </p>
      ) : (
        <div className="space-y-2">
          {ativos.map(d => (
            <div
              key={d.id}
              className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-surface-container-low border border-outline-variant/10"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-on-surface truncate">
                  {d.nome || d.email || `Usuário ${d.userId}`}
                </p>
                <p className="text-[11px] text-on-surface-variant truncate">
                  {d.email}
                  {d.valorInvestido != null && ` · investiu ${dinheiro(d.valorInvestido)}`}
                  {d.investidoEm &&
                    ` em ${new Date(d.investidoEm).toLocaleDateString('pt-BR')}`}
                </p>
              </div>

              <label className="flex items-center gap-1.5 text-[11px] text-on-surface-variant">
                <input
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  defaultValue={d.participacaoPercent}
                  onBlur={e => {
                    const novo = Number(e.target.value);
                    if (novo !== Number(d.participacaoPercent)) {
                      void alterar(d, { participacaoPercent: novo });
                    }
                  }}
                  className={`${entrada} w-20 text-right`}
                />
                %
              </label>

              <button
                type="button"
                onClick={() => void encerrar(d)}
                title="Encerrar vínculo"
                className="p-2 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
              >
                <span className="material-symbols-outlined text-base">link_off</span>
              </button>
            </div>
          ))}

          {/* A soma passar de 100% não é bloqueada (uma troca de sócio passa por
              esse estado), mas não pode passar despercebida. */}
          {soma > 100 && (
            <p className="text-xs text-amber-500 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">warning</span>
              As participações somam {soma.toLocaleString('pt-BR')}% — mais do que o ponto rende.
            </p>
          )}
        </div>
      )}

      {abrindoForm ? (
        <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/10 space-y-2.5">
          <div>
            <label className="text-[11px] text-on-surface-variant block mb-1">
              E-mail do investidor
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="investidor@email.com"
              className={entrada}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[11px] text-on-surface-variant block mb-1">Participação</label>
              <input
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                value={participacao}
                onChange={e => setParticipacao(e.target.value)}
                className={entrada}
              />
            </div>
            <div>
              <label className="text-[11px] text-on-surface-variant block mb-1">
                Valor investido
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={valor}
                onChange={e => setValor(e.target.value)}
                placeholder="opcional"
                className={entrada}
              />
            </div>
            <div>
              <label className="text-[11px] text-on-surface-variant block mb-1">Quando</label>
              <input
                type="date"
                value={data}
                onChange={e => setData(e.target.value)}
                className={entrada}
              />
            </div>
          </div>
          <p className="text-[11px] text-on-surface-variant">
            Sem o valor investido, o aplicativo do investidor mostra o ganho dele, mas não o
            retorno.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void adicionar()}
              disabled={salvando}
              className="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold disabled:opacity-60"
            >
              {salvando ? 'Vinculando...' : 'Vincular'}
            </button>
            <button
              type="button"
              onClick={limparForm}
              className="px-4 py-2 rounded-lg border border-outline-variant/20 text-on-surface-variant text-xs font-bold"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAbrindoForm(true)}
          className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-sm">person_add</span>
          Vincular investidor
        </button>
      )}
    </div>
  );
}

export default DonosDoCarregador;
