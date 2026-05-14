import { useEffect, useRef, useState } from "react";
import { Loader2, KeyRound, ArrowLeft } from "lucide-react";
import { hashProfilePin, markProfilePin, type AccountProfile } from "@/lib/account-profiles";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  profile: AccountProfile;
  onSuccess: () => void;
  onCancel?: () => void;
}

export default function PinPrompt({ profile, onSuccess, onCancel }: Props) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);

  const handleVerify = async (value: string) => {
    if (value.length !== 4) return;
    setBusy(true);
    try {
      const ok = await verifyProfilePin(profile, value);
      if (ok) {
        markProfilePin(profile.id);
        onSuccess();
      } else {
        toast.error("PIN incorrecto");
        setShake(true);
        setTimeout(() => setShake(false), 400);
        setPin("");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-background/95 backdrop-blur-2xl flex items-center justify-center p-4 animate-fade-in">
      <div className="max-w-sm w-full text-center">
        {/* Avatar del perfil */}
        <div
          className="w-28 h-28 mx-auto mb-5 rounded-3xl overflow-hidden ring-4 ring-primary/40 shadow-2xl"
          style={{ background: profile.accent_color || "hsl(var(--muted))" }}
        >
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl font-black text-white">
              {profile.name[0]?.toUpperCase()}
            </div>
          )}
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 mb-2">
          <KeyRound className="w-3 h-3 text-primary" />
          <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Perfil protegido</span>
        </div>
        <h2 className="text-2xl font-black mb-1">{profile.name}</h2>
        <p className="text-xs text-muted-foreground mb-6">Introduce el PIN de 4 dígitos</p>

        <input
          type="password"
          inputMode="numeric"
          pattern="\d*"
          autoFocus
          maxLength={4}
          value={pin}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 4);
            setPin(v);
            if (v.length === 4) handleVerify(v);
          }}
          className={`w-full text-center text-3xl tracking-[1em] font-black px-4 py-4 rounded-xl bg-background border-2 border-input focus:border-primary outline-none transition-all ${
            shake ? "animate-[wiggle_0.4s] border-destructive" : ""
          }`}
          placeholder="••••"
        />

        {busy && <Loader2 className="w-5 h-5 text-primary animate-spin mx-auto mt-4" />}

        {onCancel && (
          <button
            onClick={onCancel}
            className="mt-6 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="w-3 h-3" /> Elegir otro perfil
          </button>
        )}
      </div>

      <style>{`
        @keyframes wiggle {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}
