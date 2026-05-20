import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanPermissions } from "@/hooks/usePlanPermissions";
import {
  createTicket,
  listMyTickets,
  validateSupportText,
  getSupportImageSignedUrl,
  type SupportTicket,
} from "@/lib/support";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Paperclip, X, Crown, MessageCircle, CheckCircle2, Clock, Sparkles } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABEL: Record<string, { label: string; color: string; icon: any }> = {
  pending:     { label: "Pendiente",   color: "bg-yellow-500/20 text-yellow-400", icon: Clock },
  in_progress: { label: "En proceso",  color: "bg-blue-500/20 text-blue-400",     icon: Loader2 },
  answered:    { label: "Respondido",  color: "bg-primary/20 text-primary",       icon: MessageCircle },
  solved:      { label: "Resuelto",    color: "bg-green-500/20 text-green-400",   icon: CheckCircle2 },
  closed:      { label: "Cerrado",     color: "bg-secondary text-muted-foreground", icon: X },
};

export default function SupportSection() {
  const { user } = useAuth();
  const { permissions } = usePlanPermissions();
  const isVip = permissions.vip_support;
  const maxLen = isVip ? 1000 : 200;

  const [message, setMessage] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    listMyTickets(user.id).then((t) => { setTickets(t); setLoading(false); });
    const ch = supabase
      .channel(`support_user_${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets", filter: `user_id=eq.${user.id}` }, (payload: any) => {
        if (payload.eventType === "UPDATE") {
          setTickets((cur) => cur.map((t) => (t.id === payload.new.id ? payload.new : t)));
        } else if (payload.eventType === "INSERT") {
          setTickets((cur) => [payload.new, ...cur]);
        } else if (payload.eventType === "DELETE") {
          setTickets((cur) => cur.filter((t) => t.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  if (!user) return null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast.error("Imagen máx. 5MB");
    setImage(f);
    setImagePreview(URL.createObjectURL(f));
  };

  const handleSend = async () => {
    if (!user) return;
    if (!message.trim()) return toast.error("Escribe un mensaje");
    if (message.length > maxLen) return toast.error(`Máximo ${maxLen} caracteres`);
    const v = validateSupportText(message);
    if (!v.ok) return toast.error(v.reason!);

    setSending(true);
    try {
      await createTicket({
        userId: user.id,
        message,
        priority: isVip ? "vip" : "standard",
        planSlug: permissions.slug,
        imageFile: isVip ? image : null,
      });
      setMessage("");
      setImage(null);
      setImagePreview(null);
      toast.success(isVip ? "Ticket VIP enviado · respuesta prioritaria" : "Ticket enviado · en cola");
    } catch (e: any) {
      toast.error(e.message || "Error al enviar");
    }
    setSending(false);
  };

  return (
    <div className="pt-6 space-y-4">
      <div className="flex items-center gap-2 px-1">
        {isVip ? <Crown className="w-3.5 h-3.5 text-primary" /> : <MessageCircle className="w-3.5 h-3.5 text-primary" />}
        <h3 className="text-[11px] font-black text-foreground uppercase tracking-[0.15em]">
          {isVip ? "Soporte VIP" : "Soporte"}
        </h3>
        <div className="flex-1 h-px bg-gradient-to-r from-primary/40 via-primary/10 to-transparent" />
      </div>

      {/* Formulario */}
      <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-secondary/60 to-secondary/30 p-4 space-y-3"
        style={{ boxShadow: "0 0 18px hsl(var(--primary) / 0.15)" }}>
        {isVip ? (
          <p className="text-[11px] text-primary flex items-center gap-1 font-bold">
            <Sparkles className="w-3 h-3" /> Mensaje prioritario · hasta {maxLen} caracteres · 1 imagen opcional
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Soporte estándar · hasta {maxLen} caracteres · ticket en cola. <span className="text-primary font-bold">Disponible al actualizar tu plan: respuesta prioritaria + imagen.</span>
          </p>
        )}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, maxLen))}
          placeholder="Cuéntanos qué necesitas..."
          className="w-full h-24 bg-background border border-border rounded-xl p-3 text-sm resize-none focus:border-primary outline-none"
        />
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{message.length} / {maxLen}</span>
          {isVip && (
            <label className="cursor-pointer flex items-center gap-1 text-primary hover:underline">
              <Paperclip className="w-3 h-3" />
              {image ? image.name.slice(0, 20) : "Adjuntar imagen"}
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </label>
          )}
        </div>
        {imagePreview && (
          <div className="relative inline-block">
            <img src={imagePreview} alt="" className="h-20 rounded-lg border border-border" />
            <button onClick={() => { setImage(null); setImagePreview(null); }}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        <button
          onClick={handleSend}
          disabled={sending || !message.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-black text-sm hover:opacity-90 disabled:opacity-50"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Enviar ticket
        </button>
      </div>

      {/* Lista de mis tickets */}
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : tickets.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No has enviado tickets aún.</p>
      ) : (
        <div className="space-y-2.5">
          {tickets.map((t) => <TicketBubble key={t.id} ticket={t} />)}
        </div>
      )}
    </div>
  );
}

function TicketBubble({ ticket }: { ticket: SupportTicket }) {
  const s = STATUS_LABEL[ticket.status] || STATUS_LABEL.pending;
  const [signed, setSigned] = useState<string | null>(null);
  useEffect(() => {
    if (ticket.image_url) getSupportImageSignedUrl(ticket.image_url).then(setSigned);
  }, [ticket.image_url]);
  return (
    <div className="rounded-2xl border border-border bg-secondary/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-secondary/60 border-b border-border">
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${s.color}`}>
          <s.icon className="w-2.5 h-2.5" /> {s.label}
        </span>
        {ticket.priority === "vip" && (
          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-primary/20 text-primary flex items-center gap-0.5">
            <Crown className="w-2.5 h-2.5" /> VIP
          </span>
        )}
        <span className="text-[9px] text-muted-foreground ml-auto">
          {new Date(ticket.created_at).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      {/* Mensaje del user (burbuja derecha) */}
      <div className="p-3 flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary/15 border border-primary/30 px-3 py-2">
          <p className="text-xs text-foreground whitespace-pre-wrap break-words">{ticket.message}</p>
          {signed && <img src={signed} alt="" className="mt-2 rounded-lg max-h-40 object-contain" />}
        </div>
      </div>

      {/* Respuesta admin (burbuja izquierda) */}
      {ticket.admin_response && (
        <div className="px-3 pb-3 flex justify-start">
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-card border border-border px-3 py-2">
            <p className="text-[10px] font-black text-primary mb-1">Equipo zetAnime</p>
            <p className="text-xs text-foreground whitespace-pre-wrap break-words">{ticket.admin_response}</p>
            {ticket.responded_at && (
              <p className="text-[9px] text-muted-foreground mt-1">
                {new Date(ticket.responded_at).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
