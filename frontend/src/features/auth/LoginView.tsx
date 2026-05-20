import { type FormEvent, useState, useEffect } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Alert } from '../../components/ui/alert';
import { Lock, User, Eye, EyeOff, Building2, Sparkles } from 'lucide-react';

type LoginViewProps = {
  login: string;
  password: string;
  status: string;
  onLoginChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  logoUrl?: string | null;
};

export function LoginView({
  login,
  onLoginChange,
  onPasswordChange,
  onSubmit,
  password,
  status,
  logoUrl,
}: LoginViewProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (status.includes('Demasiados intentos') || status.includes('bloqueado temporalmente')) {
      setCountdown(60);
    }
  }, [status]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown]);


  return (
    <main className="relative flex min-h-screen items-center justify-center p-4 sm:p-6 overflow-hidden bg-slate-900 text-slate-100">
      {/* Decorative premium background elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-teal-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[60%] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-md relative z-10">
        <Card className="w-full border border-slate-800 bg-slate-950/70 backdrop-blur-xl shadow-2xl transition-all duration-300">
          <CardHeader className="text-center pb-4 pt-8">
            {logoUrl ? (
              <div className="flex justify-center mb-5 transform transition-transform hover:scale-105 duration-300">
                <img
                  src={logoUrl}
                  alt="Logo institucional"
                  className="max-h-20 object-contain rounded-lg p-2 bg-slate-900 border border-slate-800 shadow-inner"
                />
              </div>
            ) : (
              <div className="flex justify-center mb-5">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-teal-600 dark:bg-teal-500 text-white font-bold text-2xl shadow-lg shadow-teal-500/20 transform transition-transform hover:scale-105 duration-300">
                  <Building2 className="h-7 w-7" />
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Sparkles className="h-3.5 w-3.5 text-teal-400" />
              <CardDescription className="text-xs uppercase tracking-widest font-bold text-teal-400">
                SISTEMA OPERATIVO DE CAJA
              </CardDescription>
            </div>
            
            <CardTitle className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-1">
              S_Hospital Billing OS
            </CardTitle>
            <p className="text-sm text-slate-400 mt-1 max-w-[280px] mx-auto">
              Ingrese sus credenciales de caja para iniciar operaciones locales en red LAN.
            </p>
          </CardHeader>
          
          <CardContent className="px-6 pb-8">
            <form onSubmit={onSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="login-input" className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Usuario o Email
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    <User className="h-4 w-4" />
                  </span>
                  <Input
                    id="login-input"
                    value={login}
                    placeholder="ej. cajero_01"
                    autoComplete="username"
                    onChange={(event) => onLoginChange(event.target.value)}
                    className="pl-10 h-11 border-slate-800 bg-slate-900/50 text-slate-100 placeholder:text-slate-600 focus:border-teal-500 focus:ring-teal-500/20"
                  />
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <Label htmlFor="password-input" className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Contraseña
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    <Lock className="h-4 w-4" />
                  </span>
                  <Input
                    id="password-input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    onChange={(event) => onPasswordChange(event.target.value)}
                    className="pl-10 pr-10 h-11 border-slate-800 bg-slate-900/50 text-slate-100 placeholder:text-slate-600 focus:border-teal-500 focus:ring-teal-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 focus:outline-none"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              <Button 
                type="submit" 
                disabled={countdown > 0}
                className="h-11 mt-2 text-sm font-semibold bg-teal-600 hover:bg-teal-500 text-white transition-colors duration-150 shadow-lg shadow-teal-600/10 focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-800"
              >
                {countdown > 0 ? `Bloqueado (${countdown}s)` : 'Iniciar Sesión'}
              </Button>
            </form>
            
            {status && (
              <div className="mt-5 animate-fade-in text-xs font-semibold">
                <Alert
                  variant={
                    status.includes('error') || status.includes('No se pudo') || status.includes('incorrecta') || status.includes('Demasiados')
                      ? 'destructive'
                      : 'success'
                  }
                >
                  {status}
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>
        
        <div className="text-center mt-6 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} S_Hospital. Todos los derechos reservados.</p>
          <p className="mt-1">Modo Local LAN Offline (Servidor Integrado)</p>
        </div>
      </div>
    </main>
  );
}
