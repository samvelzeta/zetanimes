import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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

        // 1) PKCE flow (default Supabase v2)
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) return finish(true);
          // Fallback: a veces el correo trae `code` pero el PKCE verifier se perdió
          // (otro navegador). Intentamos como token_hash de recovery.
          const { error: otpErr } = await supabase.auth.verifyOtp({
            type: "recovery",
            token_hash: code,
          });
          if (!otpErr) return finish(true);
        }

        // 2) OTP / token_hash flow
        if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            type,
            token_hash: tokenHash,
          });
          if (!error) return finish(true);
        }

        // 3) Implicit flow (older)
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!error) return finish(true);
        }

        // 4) Fallback: maybe Supabase already restored session
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
    if (password !== confirm) return toast.error("Las contraseñas no coinciden");
    if (password.length < 6) return toast.error("Mínimo 6 caracteres");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Contraseña actualizada");
    navigate("/");
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-black text-foreground mb-6 text-center">Nueva Contraseña</h1>
        <form onSubmit={handleReset} className="space-y-4">
          <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Nueva contraseña" className="h-11 bg-secondary border-border rounded-xl" />
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" placeholder="Confirmar contraseña" className="h-11 bg-secondary border-border rounded-xl" />
          <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Actualizar Contraseña
          </button>
        </form>
      </div>
    </div>
  );
}
