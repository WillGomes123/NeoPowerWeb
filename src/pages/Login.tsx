import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Zap, Clock, Chrome } from 'lucide-react';
import { toast } from 'sonner';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Verificar se a sessão expirou baseado nos searchParams
  const sessionExpired = searchParams.get('expired') === 'true';

  // Limpar o parâmetro da URL após renderizar
  useEffect(() => {
    if (sessionExpired) {
      window.history.replaceState({}, '', '/login');
    }
  }, [sessionExpired]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const success = await login(email, password);
    if (success) {
      toast.success('Login realizado com sucesso!');
      navigate('/');
    } else {
      toast.error('Email ou senha incorretos');
    }
  };

  return (
    <div className="min-h-screen login-page flex items-center justify-center p-4">
      <Card className="w-full max-w-md login-card">
        <CardHeader className="space-y-1 flex flex-col items-center">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-2 login-accent">
            <Zap className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl login-title">NeoPower</CardTitle>
          <CardDescription className="login-muted">
            Entre com suas credenciais para acessar o dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessionExpired && (
            <Alert className="mb-4 border-amber-500/50 bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-amber-200">
                Sua sessão expirou por inatividade. Por favor, faça login novamente.
              </AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="login-label">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="login-input"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="login-label">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="login-input"
                required
              />
            </div>
            <Button type="submit" className="w-full login-button">
              Entrar
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-zinc-700" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="login-card px-2 text-zinc-500">ou continue com</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              onClick={() => {
                const apiUrl = import.meta.env?.VITE_API_URL ?? '/api';
                window.location.href = `${apiUrl}/auth/google`;
              }}
            >
              <Chrome className="mr-2 h-4 w-4" />
              Google
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
