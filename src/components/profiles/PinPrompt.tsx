import { useState } from "react";
import { Loader2, KeyRound } from "lucide-react";
import { verifyPin } from "@/lib/account-pin";
import { markPinSession } from "@/lib/account-profiles";
import { toast } from "sonner";

interface Props {
  userId: string;
  onSuccess: () => void;
  onCancel?: () => void;
}

export default function PinPrompt({ userId, onSuccess, onCancel }: Props) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const handleVerify = async (value: string) => {
    if (value.length !== 4) return;
    setBusy(true);
    try {
      const ok = await verifyPin(userId, value);
      if (ok) {
        markPinSession();
        onSuccess();
      } else {
        toast.error("PIN incorrecto");
        setPin("");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-background/95 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-card border border-border rounded-2xl p-6 shadow-xl text-center">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <KeyRound className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-black mb-1">Introduce tu PIN</h2>
        <p className="text-xs text-muted-foreground mb-5">PIN de 4 dígitos de la cuenta</p>

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
          className="w-full text-center text-3xl tracking-[1em] font-black px-4 py-3 rounded-lg bg-background border-2 border-input focus:border-primary outline-none"
          placeholder="••••"
        />

        {busy && <Loader2 className="w-5 h-5 text-primary animate-spin mx-auto mt-4" />}

        {onCancel && (
          <button onClick={onCancel} className="mt-4 text-xs text-muted-foreground hover:text-foreground">
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
