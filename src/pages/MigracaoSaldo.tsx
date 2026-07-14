import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { Search, Wallet, ArrowRight, CheckCircle } from 'lucide-react';

interface WalletData {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  balance: number;
  currency: string;
}

interface CreditResult {
  userName: string;
  balanceBefore: number;
  balanceAfter: number;
  transactionId: number;
}

export const MigracaoSaldo = () => {
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [filtered, setFiltered] = useState<WalletData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<WalletData | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('Migração de saldo da plataforma anterior');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CreditResult | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/admin/wallets');
        const data: WalletData[] = await res.json();
        setWallets(data);
        setFiltered(data);
      } catch {
        toast.error('Erro ao carregar carteiras');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      wallets.filter(
        w => w.userName.toLowerCase().includes(q) || w.userEmail.toLowerCase().includes(q)
      )
    );
    setShowDropdown(q.length > 0 && !selected);
  }, [search, wallets, selected]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectUser = (w: WalletData) => {
    setSelected(w);
    setSearch(`${w.userName} — ${w.userEmail}`);
    setShowDropdown(false);
    setResult(null);
    setConfirming(false);
  };

  const reset = () => {
    setSelected(null);
    setSearch('');
    setAmount('');
    setDescription('Migração de saldo da plataforma anterior');
    setConfirming(false);
    setResult(null);
  };

  const handleConfirm = async () => {
    if (!selected || !amount) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/admin/wallets/${selected.userId}/credit`, {
        amount: parseFloat(amount),
        description,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string; message?: string };
        throw new Error(err.error || err.message || `Erro ${res.status}`);
      }
      const data = await res.json() as CreditResult;
      setResult(data);
      setConfirming(false);
      toast.success(`Saldo creditado para ${data.userName}`);
      // Atualiza saldo na lista local
      setWallets(prev =>
        prev.map(w => w.userId === selected.userId ? { ...w, balance: data.balanceAfter } : w)
      );
    } catch (err: any) {
      toast.error(err.message || 'Erro ao creditar saldo');
    } finally {
      setSubmitting(false);
    }
  };

  const amountNum = parseFloat(amount) || 0;
  const isValid = selected && amountNum > 0;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Migração de Saldo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Credite saldo na carteira de um usuário mobile para migração de plataforma.
        </p>
      </div>

      {/* Resultado de sucesso */}
      {result && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 flex items-start gap-4">
          <CheckCircle className="text-emerald-500 mt-0.5 shrink-0" size={22} />
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Crédito aplicado com sucesso!</p>
            <p className="text-sm text-muted-foreground">
              Usuário: <span className="text-foreground font-medium">{result.userName}</span>
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                R$ {result.balanceBefore.toFixed(2)}
              </span>
              <ArrowRight size={14} className="text-muted-foreground" />
              <span className="font-semibold text-emerald-500">
                R$ {result.balanceAfter.toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Transação #{result.transactionId}</p>
          </div>
          <button
            onClick={reset}
            className="ml-auto text-sm text-emerald-600 hover:underline shrink-0"
          >
            Nova migração
          </button>
        </div>
      )}

      {!result && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          {/* Busca de usuário */}
          <div className="space-y-1.5" ref={dropdownRef}>
            <label className="text-sm font-medium text-foreground">Usuário</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder={loading ? 'Carregando usuários...' : 'Buscar por nome ou email...'}
                value={search}
                disabled={loading}
                onChange={e => {
                  setSearch(e.target.value);
                  if (selected) setSelected(null);
                }}
                onFocus={() => {
                  if (search && !selected) setShowDropdown(true);
                }}
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              />
              {showDropdown && filtered.length > 0 && (
                <div className="absolute z-20 top-full mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-56 overflow-y-auto">
                  {filtered.slice(0, 20).map(w => (
                    <button
                      key={w.userId}
                      onClick={() => selectUser(w)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted text-left gap-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{w.userName}</p>
                        <p className="text-xs text-muted-foreground">{w.userEmail}</p>
                      </div>
                      <span className="text-xs font-semibold text-emerald-500 shrink-0">
                        R$ {w.balance.toFixed(2)}
                      </span>
                    </button>
                  ))}
                  {filtered.length > 20 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      {filtered.length - 20} mais — refine a busca
                    </p>
                  )}
                </div>
              )}
              {showDropdown && filtered.length === 0 && (
                <div className="absolute z-20 top-full mt-1 w-full bg-card border border-border rounded-lg shadow-lg p-3">
                  <p className="text-sm text-muted-foreground text-center">Nenhum usuário encontrado</p>
                </div>
              )}
            </div>
          </div>

          {/* Saldo atual */}
          {selected && (
            <div className="flex items-center gap-3 bg-muted/40 rounded-lg px-4 py-3">
              <Wallet size={18} className="text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Saldo atual</p>
                <p className="text-lg font-bold text-foreground">
                  R$ {selected.balance.toFixed(2)}
                </p>
              </div>
            </div>
          )}

          {/* Valor a creditar */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Valor a creditar (R$)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                R$
              </span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0,00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            {selected && amountNum > 0 && (
              <p className="text-xs text-muted-foreground">
                Saldo ficará em{' '}
                <span className="font-semibold text-foreground">
                  R$ {(selected.balance + amountNum).toFixed(2)}
                </span>
              </p>
            )}
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Descrição</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Confirmação inline */}
          {confirming && selected && amountNum > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-foreground">Confirmar operação</p>
              <p className="text-sm text-muted-foreground">
                Creditando{' '}
                <span className="font-bold text-foreground">R$ {amountNum.toFixed(2)}</span>{' '}
                para <span className="font-bold text-foreground">{selected.userName}</span>.
                Esta operação é registrada no histórico da carteira.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleConfirm}
                  disabled={submitting}
                  className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Creditando...' : 'Confirmar crédito'}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  disabled={submitting}
                  className="flex-1 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Botão principal */}
          {!confirming && (
            <button
              onClick={() => setConfirming(true)}
              disabled={!isValid}
              className="w-full py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Aplicar crédito
            </button>
          )}
        </div>
      )}
    </div>
  );
};
