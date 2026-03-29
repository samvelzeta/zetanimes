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
  const navigate = useNavigate();

  useEffect(() => {
    // Check for recovery token in URL
    const hash = window.location.hash;
    if (!hash.includes("type=recovery")) {
      toast.error("Enlace inválido o expirado");
      navigate("/auth");
    }
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
