import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import logoUrl from "@/assets/zetanime-apk-logo.png";

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

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const finish = (ok: boolean) => {
      if (cancelled) return;
      if (ok) setReady(true);
      else {
        toast.error("Enlace inválido o expirado");
        navigate("/auth");
      }
    };

    (async () => {
      try {
        const url = new URL(window.location.href);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const code = url.searchParams.get("code");
        const tokenHash = url.searchParams.get("token_hash") || hashParams.get("token_hash");
        const type = (url.searchParams.get("type") || hashParams.get("type") || "recovery") as any;
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const errorDesc = url.searchParams.get("error_description") || hashParams.get("error_description");

        if (errorDesc) return finish(false);

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) return finish(true);
          const { error: otpErr } = await supabase.auth.verifyOtp({
            type: "recovery",
            token_hash: code,
          });
          if (!otpErr) return finish(true);
        }

        if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            type,
            token_hash: tokenHash,
          });
          if (!error) return finish(true);
        }

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!error) return finish(true);
        }

        const { data } = await supabase.auth.getSession();
        finish(!!data.session);
      } catch {
        finish(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Mínimo 6 caracteres");
    if (password !== confirm) return toast.error("Las contraseñas no coinciden");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Contraseña actualizada");
    // Limpiamos cooldowns de solicitud
    Object.keys(localStorage)
      .filter((k) => k.startsWith("zet:pwreset:"))
      .forEach((k) => localStorage.removeItem(k));
    navigate("/");
  };

  if (!ready) {
    return (
      <div className="min-h-screen w-full bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
          <p className="text-[11px] tracking-[0.3em] uppercase text-orange-400/70">
            Validando enlace
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#0a0a0f] text-foreground relative overflow-hidden">
      <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
        {/* LEFT PANEL */}
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
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-orange-500/20 blur-[120px]" />
          <div className="absolute bottom-32 right-16 w-96 h-96 rounded-full bg-orange-500/10 blur-[140px]" />

          <div className="relative z-10 max-w-md px-10 text-center">
            <p className="text-[10px] tracking-[0.5em] uppercase text-orange-400/80 font-semibold mb-4">
              ZetAnime · Seguridad
            </p>
            <h2
              className="text-5xl xl:text-6xl font-black leading-[0.95] text-white"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Recupera <span className="text-orange-400">el control</span> de tu cuenta.
            </h2>
            <p className="mt-6 text-sm text-white/60 leading-relaxed">
              Elige una nueva contraseña segura. Este enlace es de un solo uso y expira automáticamente.
            </p>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="relative flex items-center justify-center px-4 sm:px-8 py-10 lg:py-6">
          <div className="absolute inset-0 lg:hidden">
            <div className="absolute top-10 right-10 w-64 h-64 rounded-full bg-orange-500/15 blur-[100px]" />
            <div className="absolute bottom-20 left-10 w-64 h-64 rounded-full bg-orange-500/10 blur-[100px]" />
          </div>

          <div className="relative w-full max-w-md">
            <div
              className="relative bg-[#12121a]/90 backdrop-blur-xl border border-orange-500/30 p-7 sm:p-9"
              style={{
                clipPath:
                  "polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)",
                boxShadow:
                  "0 0 0 1px rgba(255,140,40,0.08), 0 0 30px rgba(255,140,40,0.15), 0 0 80px rgba(255,140,40,0.08), inset 0 0 30px rgba(255,140,40,0.03)",
              }}
            >
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
                  Nueva Contraseña
                </h1>
                <p className="text-[11px] tracking-[0.3em] uppercase text-orange-400/70 mt-2 flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> Enlace verificado
                </p>
              </div>

              <form onSubmit={handleReset} className="space-y-5">
                <div>
                  <label className={labelCls}>Nueva contraseña</label>
                  <div className="relative">
                    <Input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type={showPw ? "text" : "password"}
                      placeholder="••••••••"
                      className={`${inputCls} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-400/60 hover:text-orange-300"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Confirmar contraseña</label>
                  <Input
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    type={showPw ? "text" : "password"}
                    placeholder="••••••••"
                    className={inputCls}
                  />
                </div>
                <button type="submit" disabled={loading} className={primaryBtn}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />} Actualizar contraseña
                </button>
              </form>
            </div>

            <p className="mt-6 text-center text-[10px] tracking-[0.25em] uppercase text-white/30">
              ZetAnime © · Enlace de un solo uso
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
