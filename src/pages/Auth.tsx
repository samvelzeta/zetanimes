import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pb-24">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Volver al inicio
        </Link>

        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-black text-white">Z</span>
          </div>
          <h1 className="text-2xl font-black text-foreground">
            {mode === "login" ? "Iniciar Sesión" : mode === "register" ? "Crear Cuenta" : "Recuperar Contraseña"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "login" ? "Accede a tu cuenta ZetAnime" : mode === "register" ? "Únete a la comunidad" : "Te enviaremos un enlace de recuperación"}
          </p>
        </div>

        {mode === "login" && <LoginForm onSwitch={setMode} onSuccess={() => navigate("/")} />}
        {mode === "register" && <RegisterForm onSwitch={setMode} onSuccess={() => navigate("/")} />}
        {mode === "forgot" && <ForgotForm onSwitch={setMode} />}
      </div>
    </div>
  );
}

function LoginForm({ onSwitch, onSuccess }: { onSwitch: (m: "login" | "register" | "forgot") => void; onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error("Completa todos los campos");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("¡Bienvenido de vuelta!");
    onSuccess();
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Correo electrónico</label>
        <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="tu@correo.com" className="h-11 bg-secondary border-border rounded-xl" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Contraseña</label>
        <div className="relative">
          <Input value={password} onChange={(e) => setPassword(e.target.value)} type={showPw ? "text" : "password"} placeholder="••••••••" className="h-11 bg-secondary border-border rounded-xl pr-10" />
          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <button type="button" onClick={() => onSwitch("forgot")} className="text-xs text-primary hover:underline">¿Olvidaste tu contraseña?</button>
      <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
        {loading && <Loader2 className="w-4 h-4 animate-spin" />} Iniciar Sesión
      </button>
      <p className="text-center text-xs text-muted-foreground">
        ¿No tienes cuenta? <button type="button" onClick={() => onSwitch("register")} className="text-primary font-bold hover:underline">Regístrate</button>
      </p>
    </form>
  );
}

function RegisterForm({ onSwitch, onSuccess }: { onSwitch: (m: "login" | "register" | "forgot") => void; onSuccess: () => void }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !email || !password || !confirmPw) return toast.error("Completa todos los campos");
    if (password !== confirmPw) return toast.error("Las contraseñas no coinciden");
    if (password.length < 6) return toast.error("La contraseña debe tener al menos 6 caracteres");
    if (!acceptTerms) return toast.error("Debes aceptar los términos y condiciones");

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, display_name: username },
        emailRedirectTo: `${window.location.origin}/verified`,
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("¡Cuenta creada! Revisa tu correo para verificarla.");
    onSuccess();
  };

  return (
    <form onSubmit={handleRegister} className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Nombre de usuario</label>
        <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="mi_usuario" className="h-11 bg-secondary border-border rounded-xl" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Correo electrónico</label>
        <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="tu@correo.com" className="h-11 bg-secondary border-border rounded-xl" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Contraseña</label>
        <div className="relative">
          <Input value={password} onChange={(e) => setPassword(e.target.value)} type={showPw ? "text" : "password"} placeholder="••••••••" className="h-11 bg-secondary border-border rounded-xl pr-10" />
          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Confirmar contraseña</label>
        <Input value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} type={showPw ? "text" : "password"} placeholder="••••••••" className="h-11 bg-secondary border-border rounded-xl" />
      </div>
      <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
        <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5 accent-primary" />
        <span>Acepto las <Link to="/terms" className="text-primary hover:underline">Políticas de Privacidad</Link> y <Link to="/terms" className="text-primary hover:underline">Términos y Condiciones</Link></span>
      </label>
      <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
        {loading && <Loader2 className="w-4 h-4 animate-spin" />} Crear Cuenta
      </button>
      <p className="text-center text-xs text-muted-foreground">
        ¿Ya tienes cuenta? <button type="button" onClick={() => onSwitch("login")} className="text-primary font-bold hover:underline">Inicia sesión</button>
      </p>
    </form>
  );
}

function ForgotForm({ onSwitch }: { onSwitch: (m: "login" | "register" | "forgot") => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return toast.error("Ingresa tu correo");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success("Correo enviado. Revisa tu bandeja.");
  };

  if (sent) {
    return (
      <div className="text-center space-y-4">
        <p className="text-sm text-foreground">📧 Revisa tu correo electrónico para restablecer tu contraseña.</p>
        <button onClick={() => onSwitch("login")} className="text-primary text-sm font-bold hover:underline">Volver al login</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleReset} className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Correo electrónico</label>
        <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="tu@correo.com" className="h-11 bg-secondary border-border rounded-xl" />
      </div>
      <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
        {loading && <Loader2 className="w-4 h-4 animate-spin" />} Enviar enlace
      </button>
      <button type="button" onClick={() => onSwitch("login")} className="text-xs text-primary hover:underline block mx-auto">Volver al login</button>
    </form>
  );
}
