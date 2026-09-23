import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

/**
 * Split payment por marca: o cliente conecta a conta dele no Mercado Pago e
 * passa a receber os pagamentos direto, com a comissão da NeoPower separada
 * automaticamente pelo Mercado Pago (application_fee). Sem conta conectada,
 * tudo cai na conta da NeoPower.
 */

interface Credencial {
  clientId: string;
  ativo: boolean;
  ambiente: string;
  modo: string;
  accessToken: string | null;
  comissaoPercent: number | null;
  comissaoEfetivaPercent: number;
  padraoPlataformaPercent: number;
  oauthUserId: string | null;
  oauthExpiraEm: string | null;
  oauthExpirada: boolean;
  atualizadoEm: string | null;
}

const dataCurta = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

export function PagamentosDaMarca({ clientId }: { clientId: string }) {
  const [cred, setCred] = useState<Credencial | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [comissao, setComissao] = useState('');
  const [link, setLink] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!clientId) return;
    setCarregando(true);
    try {
      const resp = await api.get(`/admin/payment-credentials/${encodeURIComponent(clientId)}`);
      if (resp.ok) {
        const dados = (await resp.json()) as Credencial;
        setCred(dados);
        setComissao(dados.comissaoPercent != null ? String(dados.comissaoPercent) : '');
      } else {
        setCred(null); // 404: marca ainda sem conta conectada
        setComissao('');
      }
    } catch {
      setCred(null);
    } finally {
      setCarregando(false);
    }
  }, [clientId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const gerarLink = async () => {
    setSalvando(true);
    try {
      const resp = await api.get(
        `/admin/payment-credentials/${encodeURIComponent(clientId)}/oauth/url`
      );
      const corpo = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(corpo?.error || 'Não foi possível gerar o link');
      setLink(corpo.url as string);
      toast.success('Link gerado. Envie para o cliente autorizar.');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const salvarComissao = async () => {
    setSalvando(true);
    try {
      const valor = comissao.trim() === '' ? null : Number(comissao.replace(',', '.'));
      if (valor !== null && (!Number.isFinite(valor) || valor < 0 || valor >= 100)) {
        toast.error('Informe um percentual entre 0 e 99,99 (ou deixe vazio para o padrão).');
        return;
      }
      const resp = await api.put(`/admin/payment-credentials/${encodeURIComponent(clientId)}`, {
        comissaoPercent: valor,
      });
      const corpo = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(corpo?.error || 'Não foi possível salvar a comissão');
      toast.success('Comissão salva');
      await carregar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const desconectar = async () => {
    if (
      !window.confirm(
        'Desconectar a conta desta marca? Os pagamentos voltam a cair na conta da NeoPower.'
      )
    )
      return;
    setSalvando(true);
    try {
      const resp = await api.delete(`/admin/payment-credentials/${encodeURIComponent(clientId)}`);
      if (!resp.ok) throw new Error('Não foi possível desconectar');
      toast.success('Conta desconectada');
      setLink(null);
      await carregar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  if (!clientId) {
    return (
      <p className="text-sm text-on-surface-variant">
        Salve a marca primeiro para configurar o recebimento.
      </p>
    );
  }

  const conectada = !!cred?.ativo && cred.modo === 'oauth' && !cred.oauthExpirada;
  const contaPropria = !!cred?.ativo && cred.modo !== 'oauth';

  return (
    <div className="space-y-5">
      <p className="text-on-surface-variant text-xs uppercase tracking-widest font-bold">
        Recebimento dos pagamentos
      </p>

      {carregando ? (
        <p className="text-sm text-on-surface-variant">Carregando…</p>
      ) : (
        <div
          className={`rounded-xl border p-4 ${
            conectada
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : cred?.oauthExpirada
                ? 'border-amber-500/30 bg-amber-500/5'
                : 'border-outline-variant/20 bg-surface-container-high/40'
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`material-symbols-outlined text-xl ${conectada ? 'text-emerald-500' : 'text-on-surface-variant'}`}
            >
              {conectada ? 'verified' : cred?.oauthExpirada ? 'warning' : 'account_balance'}
            </span>
            <div className="text-sm">
              {conectada && (
                <>
                  <p className="font-semibold text-on-surface">Recebendo na conta do cliente</p>
                  <p className="text-on-surface-variant mt-0.5">
                    Conta Mercado Pago {cred?.oauthUserId} · autorização válida até{' '}
                    {dataCurta(cred?.oauthExpiraEm ?? null)}. A cada pagamento, a comissão da
                    NeoPower é separada automaticamente.
                  </p>
                </>
              )}
              {cred?.oauthExpirada && (
                <>
                  <p className="font-semibold text-on-surface">Autorização expirada</p>
                  <p className="text-on-surface-variant mt-0.5">
                    Gere um novo link para o cliente autorizar de novo. Até lá, os pagamentos caem
                    na conta da NeoPower.
                  </p>
                </>
              )}
              {contaPropria && (
                <>
                  <p className="font-semibold text-on-surface">Conta própria (sem split)</p>
                  <p className="text-on-surface-variant mt-0.5">
                    Esta marca usa um token cadastrado à mão: o valor vai 100% para o cliente e a
                    comissão precisa ser cobrada à parte. Para separar a comissão automaticamente,
                    conecte pelo Mercado Pago abaixo.
                  </p>
                </>
              )}
              {!cred && (
                <>
                  <p className="font-semibold text-on-surface">Caindo na conta da NeoPower</p>
                  <p className="text-on-surface-variant mt-0.5">
                    Enquanto o cliente não conectar a conta dele, todo o dinheiro entra na conta da
                    NeoPower e o repasse fica manual.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => void gerarLink()}
          disabled={salvando}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-lg">link</span>
          {conectada ? 'Gerar novo link de autorização' : 'Gerar link para o cliente conectar'}
        </button>
        <p className="text-xs text-on-surface-variant max-w-[520px] leading-relaxed">
          O cliente abre o link, entra na conta dele no Mercado Pago e autoriza uma única vez. Não
          precisa enviar token nem senha para a gente. O link vale por 1 hora.
        </p>
        {link && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-container-high p-3">
            <code className="text-xs text-on-surface break-all flex-1 min-w-[240px]">{link}</code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(link);
                toast.success('Link copiado');
              }}
              className="rounded-md bg-surface-container-highest px-3 py-1.5 text-xs font-semibold text-on-surface"
            >
              Copiar
            </button>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-surface-container-highest px-3 py-1.5 text-xs font-semibold text-primary"
            >
              Abrir
            </a>
          </div>
        )}
      </div>

      <div className="space-y-1.5 max-w-[320px]">
        <Label className="text-on-surface-variant text-xs uppercase tracking-widest">
          Comissão da NeoPower (%)
        </Label>
        <div className="flex gap-2">
          <Input
            inputMode="decimal"
            placeholder={`padrão: ${cred?.padraoPlataformaPercent ?? 30}%`}
            value={comissao}
            onChange={e => setComissao(e.target.value)}
            className="bg-surface-container-low border-outline-variant/20 text-on-surface h-10 text-sm"
          />
          <button
            type="button"
            onClick={() => void salvarComissao()}
            disabled={salvando || !cred}
            className="rounded-lg bg-surface-container-highest px-4 text-sm font-semibold text-on-surface disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
        <p className="text-on-surface-variant text-xs leading-relaxed">
          Fica retida em cada pagamento. Hoje está em {cred?.comissaoEfetivaPercent ?? '—'}%. Deixe
          vazio para usar o padrão da plataforma ({cred?.padraoPlataformaPercent ?? 30}%). Só vale
          depois que o cliente conectar a conta.
        </p>
      </div>

      {cred && (
        <button
          type="button"
          onClick={() => void desconectar()}
          disabled={salvando}
          className="text-xs font-semibold text-error hover:underline"
        >
          Desconectar conta desta marca
        </button>
      )}
    </div>
  );
}
