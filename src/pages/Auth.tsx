import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { markFreshLogin } from "@/lib/devices";
import logoUrl from "@/assets/zetanime-apk-logo.png";

/* ---------------- Google Button ---------------- */
function GoogleButton({ label = "Continuar con Google" }: { label?: string }) {
  const [loading, setLoading] = useState(false);
  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.redirected) return;
    if (result.error) {
      setLoading(false);
      toast.error(result.error.message || "No se pudo iniciar con Google");
      return;
    }
    markFreshLogin();
    toast.success("¡Bienvenido!");
    window.location.href = "/";
  };
  return (
    <button
      type="button"
      onClick={handleGoogle}
      disabled={loading}
      className="w-full py-3 px-4 flex items-center justify-center gap-3 bg-black/40 border border-orange-500/30 text-white text-sm font-semibold uppercase tracking-[0.2em] hover:bg-black/60 hover:border-orange-400 hover:shadow-[0_0_20px_rgba(255,140,40,0.2)] transition-all disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.5 14.7 2.5 12 2.5 6.7 2.5 2.5 6.7 2.5 12s4.2 9.5 9.5 9.5c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z"/>
          <path fill="#FBBC05" d="M2.5 12c0-1.5.4-2.9 1.1-4.1L6.9 10c-.3.6-.4 1.3-.4 2s.1 1.4.4 2L3.6 16.1C2.9 14.9 2.5 13.5 2.5 12z"/>
          <path fill="#34A853" d="M12 21.5c2.7 0 4.9-.9 6.5-2.4l-3.2-2.6c-.9.6-2 .9-3.3.9-2.6 0-4.7-1.7-5.5-4l-3.3 2.5c1.6 3.2 4.8 5.6 8.8 5.6z"/>
          <path fill="#4285F4" d="M21.4 12.2c0-.6-.1-1.1-.2-1.6H12v3.9h5.5c-.3 1.2-1 2.2-2.2 2.9l3.2 2.6c1.9-1.7 2.9-4.3 2.9-7.8z"/>
        </svg>
      )}
      {label}
    </button>
  );
}



export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full bg-[#0a0a0f] text-foreground relative overflow-hidden">
      {/* Split screen layout */}
      <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
        {/* LEFT PANEL - Ambient scene */}
        <div className="relative hidden lg:flex items-center justify-center overflow-hidden border-r border-orange-500/20">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-40"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1601513237763-10aaaa60fbcf?w=1600&q=80')",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0f] via-transparent to-[#0a0a0f]/90" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-transparent" />
          {/* Cyan glow blobs */}
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-orange-500/20 blur-[120px]" />
          <div className="absolute bottom-32 right-16 w-96 h-96 rounded-full bg-orange-500/10 blur-[140px]" />

          <div className="relative z-10 max-w-md px-10 text-center">
            <p className="text-[10px] tracking-[0.5em] uppercase text-orange-400/80 font-semibold mb-4">
              ZetAnime · Universo
            </p>
            <h2
              className="text-5xl xl:text-6xl font-black leading-[0.95] text-white"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Entra al mundo <span className="text-orange-400">anime</span> sin límites.
            </h2>
            <p className="mt-6 text-sm text-white/60 leading-relaxed">
              Miles de series, doblaje latino, transmisión sin cortes y una comunidad que vive el anime como tú.
            </p>
          </div>
        </div>

        {/* RIGHT PANEL - Auth form */}
        <div className="relative flex items-center justify-center px-4 sm:px-8 py-10 lg:py-6">
          {/* Ambient background on mobile */}
          <div className="absolute inset-0 lg:hidden">
            <div className="absolute top-10 right-10 w-64 h-64 rounded-full bg-orange-500/15 blur-[100px]" />
            <div className="absolute bottom-20 left-10 w-64 h-64 rounded-full bg-orange-500/10 blur-[100px]" />
          </div>

          <div className="relative w-full max-w-md">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-[11px] tracking-[0.2em] uppercase text-orange-400/70 hover:text-orange-300 transition-colors mb-6"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Volver al inicio
            </Link>

            {/* Login container with sharp corners + cyan glow */}
            <div
              className="relative bg-[#12121a]/90 backdrop-blur-xl border border-orange-500/30 p-7 sm:p-9"
              style={{
                clipPath:
                  "polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)",
                boxShadow:
                  "0 0 0 1px rgba(255,140,40,0.08), 0 0 30px rgba(255,140,40,0.15), 0 0 80px rgba(255,140,40,0.08), inset 0 0 30px rgba(255,140,40,0.03)",
              }}
            >
              {/* Corner accents */}
              <div className="absolute top-0 right-0 w-6 h-[1px] bg-orange-400/60" />
              <div className="absolute top-0 right-0 w-[1px] h-6 bg-orange-400/60" />
              <div className="absolute bottom-0 left-0 w-6 h-[1px] bg-orange-400/60" />
              <div className="absolute bottom-0 left-0 w-[1px] h-6 bg-orange-400/60" />

              <div className="text-center mb-7">
                <div className="w-20 h-20 mx-auto mb-4 relative">
                  <div className="absolute inset-0 rounded-full bg-orange-500/20 blur-xl" />
                  <img
                    src={logoUrl}
                    alt="ZetAnime"
                    className="relative w-20 h-20 object-contain drop-shadow-[0_0_12px_rgba(255,140,40,0.5)]"
                  />
                </div>
                <h1
                  className="text-3xl font-black text-white tracking-tight"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                  {mode === "login"
                    ? "Iniciar Sesión"
                    : mode === "register"
                    ? "Crear Cuenta"
                    : "Recuperar Acceso"}
                </h1>
                <p className="text-[11px] tracking-[0.3em] uppercase text-orange-400/70 mt-2">
                  {mode === "login"
                    ? "Bienvenido de vuelta"
                    : mode === "register"
                    ? "Únete a la comunidad"
                    : "Te enviaremos un enlace"}
                </p>
              </div>

              {mode === "login" && <LoginForm onSwitch={setMode} onSuccess={() => navigate("/")} />}
              {mode === "register" && <RegisterForm onSwitch={setMode} onSuccess={() => navigate("/")} />}
              {mode === "forgot" && <ForgotForm onSwitch={setMode} />}
            </div>

            <p className="mt-6 text-center text-[10px] tracking-[0.25em] uppercase text-white/30">
              ZetAnime © · Streaming sin límites
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Shared styles ---------------- */
const inputCls =
  "h-11 bg-black/40 border border-orange-500/25 rounded-none text-white placeholder:text-white/30 " +
  "focus:border-orange-400 focus-visible:ring-0 focus-visible:ring-offset-0 " +
  "focus:shadow-[0_0_0_1px_rgba(255,140,40,0.6),0_0_20px_rgba(255,140,40,0.25)] transition-all";

const labelCls =
  "text-[10px] tracking-[0.3em] uppercase text-orange-400/70 font-semibold mb-2 block";

const primaryBtn =
  "w-full py-3 font-bold text-sm text-white uppercase tracking-[0.25em] " +
  "bg-gradient-to-r from-[#FF6A13] to-[#FF4F00] " +
  "shadow-[0_0_20px_rgba(255,106,19,0.4),0_0_40px_rgba(255,79,0,0.2)] " +
  "hover:shadow-[0_0_30px_rgba(255,106,19,0.6),0_0_60px_rgba(255,79,0,0.3)] " +
  "hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2";

/* ---------------- Login ---------------- */
function LoginForm({
  onSwitch,
  onSuccess,
}: {
  onSwitch: (m: "login" | "register" | "forgot") => void;
  onSuccess: () => void;
}) {
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
    markFreshLogin();
    toast.success("¡Bienvenido de vuelta!");
    onSuccess();
  };

  return (
    <div className="space-y-5">
      <GoogleButton label="Iniciar sesión con Google" />
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-orange-500/20" />
        <span className="text-[10px] tracking-[0.3em] uppercase text-orange-400/50">o con correo</span>
        <div className="flex-1 h-px bg-orange-500/20" />
      </div>
    <form onSubmit={handleLogin} className="space-y-5">
      <div>
        <label className={labelCls}>Correo electrónico</label>
        <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="tu@correo.com" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Contraseña</label>
        <div className="relative">
          <Input value={password} onChange={(e) => setPassword(e.target.value)} type={showPw ? "text" : "password"} placeholder="••••••••" className={`${inputCls} pr-10`} />
          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-400/60 hover:text-orange-300">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <button type="button" onClick={() => onSwitch("forgot")} className="text-[11px] tracking-[0.2em] uppercase text-orange-400/70 hover:text-orange-300 transition-colors">
        ¿Olvidaste tu contraseña?
      </button>
      <button type="submit" disabled={loading} className={primaryBtn}>
        {loading && <Loader2 className="w-4 h-4 animate-spin" />} Iniciar Sesión
      </button>
      <p className="text-center text-xs text-white/50">
        ¿No tienes cuenta?{" "}
        <button type="button" onClick={() => onSwitch("register")} className="text-orange-400 font-bold hover:text-orange-300 hover:underline">
          Regístrate
        </button>
      </p>
    </form>
  );
}

/* ---------------- Register ---------------- */
function RegisterForm({
  onSwitch,
  onSuccess,
}: {
  onSwitch: (m: "login" | "register" | "forgot") => void;
  onSuccess: () => void;
}) {
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
        <label className={labelCls}>Nombre de usuario</label>
        <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="mi_usuario" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Correo electrónico</label>
        <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="tu@correo.com" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Contraseña</label>
        <div className="relative">
          <Input value={password} onChange={(e) => setPassword(e.target.value)} type={showPw ? "text" : "password"} placeholder="••••••••" className={`${inputCls} pr-10`} />
          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-400/60 hover:text-orange-300">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div>
        <label className={labelCls}>Confirmar contraseña</label>
        <Input value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} type={showPw ? "text" : "password"} placeholder="••••••••" className={inputCls} />
      </div>
      <label className="flex items-start gap-2 text-xs text-white/60 cursor-pointer">
        <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5 accent-orange-400" />
        <span>
          Acepto las <Link to="/terms" className="text-orange-400 hover:underline">Políticas de Privacidad</Link> y{" "}
          <Link to="/terms" className="text-orange-400 hover:underline">Términos y Condiciones</Link>
        </span>
      </label>
      <button type="submit" disabled={loading} className={primaryBtn}>
        {loading && <Loader2 className="w-4 h-4 animate-spin" />} Crear Cuenta
      </button>
      <p className="text-center text-xs text-white/50">
        ¿Ya tienes cuenta?{" "}
        <button type="button" onClick={() => onSwitch("login")} className="text-orange-400 font-bold hover:text-orange-300 hover:underline">
          Inicia sesión
        </button>
      </p>
    </form>
  );
}

/* ---------------- Forgot ---------------- */
function ForgotForm({ onSwitch }: { onSwitch: (m: "login" | "register" | "forgot") => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return toast.error("Ingresa tu correo");

    // Anti-spam: 2 minutos entre solicitudes por correo
    const key = `zet:pwreset:${email.trim().toLowerCase()}`;
    const last = Number(localStorage.getItem(key) || 0);
    const elapsed = Date.now() - last;
    const cooldown = 2 * 60 * 1000;
    if (last && elapsed < cooldown) {
      const secs = Math.ceil((cooldown - elapsed) / 1000);
      const mm = Math.floor(secs / 60);
      const ss = secs % 60;
      return toast.error(
        `Espera ${mm > 0 ? `${mm}m ` : ""}${ss}s antes de solicitar otro enlace.`
      );
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    localStorage.setItem(key, String(Date.now()));
    setSent(true);
    toast.success("Correo enviado. Revisa tu bandeja.");
  };

  if (sent) {
    return (
      <div className="text-center space-y-4">
        <p className="text-sm text-white/80">📧 Revisa tu correo electrónico para restablecer tu contraseña.</p>
        <button onClick={() => onSwitch("login")} className="text-orange-400 text-sm font-bold hover:text-orange-300 hover:underline">
          Volver al login
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleReset} className="space-y-5">
      <div>
        <label className={labelCls}>Correo electrónico</label>
        <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="tu@correo.com" className={inputCls} />
      </div>
      <button type="submit" disabled={loading} className={primaryBtn}>
        {loading && <Loader2 className="w-4 h-4 animate-spin" />} Enviar enlace
      </button>
      <button type="button" onClick={() => onSwitch("login")} className="text-[11px] tracking-[0.2em] uppercase text-orange-400/70 hover:text-orange-300 transition-colors block mx-auto">
        Volver al login
      </button>
    </form>
  );
}
