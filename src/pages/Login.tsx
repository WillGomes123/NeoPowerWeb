import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { toast } from 'sonner';
import NeoPowerLogo from '../assets/NeoPower.png';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const sessionExpired = searchParams.get('expired') === 'true';

  useEffect(() => {
    if (sessionExpired) {
      window.history.replaceState({}, '', '/login');
    }
  }, [sessionExpired]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const success = await login(email, password);
    setLoading(false);

    if (success) {
      toast.success('Login realizado com sucesso!');
      navigate('/');
    } else {
      setError('Email ou senha incorretos');
      toast.error('Email ou senha incorretos');
    }
  };

  return (
    <div className="min-h-screen flex flex-col selection:bg-primary selection:text-on-primary">
      {/* Top Header Bar */}
      <header className="fixed top-0 w-full z-50 px-8 py-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 bg-white/95 rounded-lg p-2 shadow-2xl shadow-white/10">
            <img 
              src={NeoPowerLogo} 
              alt="NeoPower" 
              className="h-8 w-auto" 
            />
          </div>
        </div>
      </header>

      {/* Main Content - Cinematic Background */}
      <main
        className="flex-grow flex items-center justify-center relative overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(rgba(14, 14, 14, 0.6), rgba(14, 14, 14, 0.9)), url(https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=1920&q=80)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Ambient Radial Glows */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-primary/10 blur-[120px] rounded-full pointer-events-none" />

        {/* Login Container */}
        <div className="relative z-10 w-full max-w-md px-6">
          <div
            className="rounded-xl p-8 md:p-10 flex flex-col gap-8"
            style={{
              background: 'rgba(22, 22, 22, 0.7)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(142, 255, 113, 0.08)',
              boxShadow: '0 0 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(142, 255, 113, 0.03)',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              borderLeft: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            {/* Header */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Acesso Seguro</span>
              <h2 className="font-headline text-3xl font-bold tracking-tight text-white leading-none">NeoPower</h2>
              <p className="text-on-surface-variant text-sm">Gestão inteligente de recarga para veículos elétricos.</p>
            </div>

            {/* Session Expired Alert */}
            {sessionExpired && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-tertiary/10 border border-tertiary/20">
                <span className="material-symbols-outlined text-tertiary text-lg">schedule</span>
                <p className="text-tertiary text-xs font-medium">Sessão expirada. Faça login novamente.</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-error/10 border border-error/20">
                <span className="material-symbols-outlined text-error text-lg">error</span>
                <p className="text-error text-xs font-medium">{error}</p>
              </div>
            )}

            {/* Form */}
            <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
              {/* Email Input */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-on-surface-variant tracking-wider uppercase px-1" htmlFor="command-id">
                  Usuário
                </label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg group-focus-within:text-primary transition-colors">
                    alternate_email
                  </span>
                  <input
                    id="command-id"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    className="w-full bg-surface-container-highest/50 border-0 border-b-2 border-outline-variant focus:border-primary focus:ring-0 text-white pl-12 pr-4 py-4 rounded-t-lg transition-all placeholder:text-on-surface-variant/40"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-on-surface-variant tracking-wider uppercase px-1" htmlFor="access-cipher">
                 Senha
                </label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg group-focus-within:text-primary transition-colors">
                    lock
                  </span>
                  <input
                    id="access-cipher"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-surface-container-highest/50 border-0 border-b-2 border-outline-variant focus:border-primary focus:ring-0 text-white pl-12 pr-12 py-4 rounded-t-lg transition-all placeholder:text-on-surface-variant/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Options Row */}
              <div className="flex justify-between items-center">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" className="rounded border-outline-variant bg-surface-container-highest text-primary focus:ring-primary focus:ring-offset-background h-4 w-4" />
                  <span className="text-xs text-on-surface-variant group-hover:text-white transition-colors">Manter Sessão Ativa</span>
                </label>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary font-headline font-black py-4 rounded-full flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all duration-300 group disabled:opacity-60 disabled:scale-100"
                style={{ boxShadow: '0 0 25px rgba(142, 255, 113, 0.25)' }}
              >
                {loading ? (
                  <div className="w-5 h-5 animate-spin rounded-full border-2 border-on-primary border-t-transparent" />
                ) : (
                  <>
                    <span className="tracking-widest">ENTRAR</span>
                    <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                  </>
                )}
              </button>
            </form>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-background w-full py-8 border-t border-border/10">
        <div className="flex flex-col md:flex-row justify-between items-center px-8 max-w-7xl mx-auto gap-4">
          <div className="text-sm tracking-wide text-on-surface-variant">
            © 2025 NeoPower Systems. Todos os Direitos Reservados.
          </div>
          <nav className="flex gap-8">
            <span className="text-sm tracking-wide text-on-surface-variant hover:text-primary transition-colors cursor-pointer">Segurança</span>
            <span className="text-sm tracking-wide text-on-surface-variant hover:text-primary transition-colors cursor-pointer">Privacidade</span>
            <span className="text-sm tracking-wide text-on-surface-variant hover:text-primary transition-colors cursor-pointer">Suporte</span>
          </nav>
        </div>
      </footer>
    </div>
  );
};
