import { useEffect, useState } from "react";
import { listAllTickets, respondTicket, updateTicketStatus, deleteTicket, getSupportImageSignedUrl, type SupportTicket, type TicketStatus } from "@/lib/support";
import { Loader2, Crown, Send, Trash2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const STATUSES: { value: TicketStatus; label: string }[] = [
  { value: "pending", label: "Pendiente" },
  { value: "in_progress", label: "En proceso" },
  { value: "answered", label: "Respondido" },
  { value: "solved", label: "Resuelto" },
  { value: "closed", label: "Cerrado" },
];

export default function SupportTicketsAdmin() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "vip" | "standard">("all");

  const reload = async () => {
    setLoading(true);
    setTickets(await listAllTickets());
    setLoading(false);
  };

  useEffect(() => {
    reload();
    const ch = supabase
      .channel("support_admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = tickets.filter((t) => filter === "all" ? true : t.priority === filter);
  const vipList = filtered.filter((t) => t.priority === "vip");
  const stdList = filtered.filter((t) => t.priority === "standard");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["all", "vip", "standard"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
            {f === "all" ? "Todos" : f.toUpperCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Sin tickets</p>
      ) : (
        <>
          {vipList.length > 0 && (
            <section className="space-y-2">
              <h4 className="text-xs font-black text-primary flex items-center gap-1.5"><Crown className="w-3.5 h-3.5" /> VIP ({vipList.length})</h4>
              {vipList.map((t) => <AdminTicketCard key={t.id} ticket={t} adminId={user?.id || ""} onChange={reload} />)}
            </section>
          )}
          {stdList.length > 0 && (
            <section className="space-y-2 pt-2">
              <h4 className="text-xs font-black text-muted-foreground flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> Estándar ({stdList.length})</h4>
              {stdList.map((t) => <AdminTicketCard key={t.id} ticket={t} adminId={user?.id || ""} onChange={reload} />)}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function AdminTicketCard({ ticket, adminId, onChange }: { ticket: SupportTicket; adminId: string; onChange: () => void }) {
  const [response, setResponse] = useState(ticket.admin_response || "");
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [userInfo, setUserInfo] = useState<{ username?: string; email?: string } | null>(null);

  useEffect(() => {
    if (ticket.image_url) getSupportImageSignedUrl(ticket.image_url).then(setImgUrl);
    supabase.from("profiles").select("username,display_name").eq("user_id", ticket.user_id).maybeSingle()
      .then(({ data }) => setUserInfo({ username: (data as any)?.username }));
  }, [ticket.id]);

  const send = async () => {
    if (!response.trim()) return toast.error("Escribe una respuesta");
    setBusy(true);
    try { await respondTicket(ticket.id, adminId, response, status === "pending" ? "answered" : status); toast.success("Respuesta enviada"); onChange(); }
    catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  const changeStatus = async (s: TicketStatus) => { setStatus(s); await updateTicketStatus(ticket.id, s); onChange(); };

  const del = async () => {
    if (!confirm("¿Eliminar este ticket?")) return;
    await deleteTicket(ticket.id, ticket.image_url);
    onChange();
  };

  return (
    <div className="rounded-xl border-2 border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-2">
          <span className="font-bold text-foreground">{userInfo?.username || ticket.user_id.slice(0, 8)}</span>
          <span className="text-muted-foreground">· Plan: {ticket.plan_slug || "free"}</span>
          {ticket.priority === "vip" && <Crown className="w-3 h-3 text-primary" />}
        </div>
        <span className="text-muted-foreground">{new Date(ticket.created_at).toLocaleString("es")}</span>
      </div>

      <div className="rounded-lg bg-secondary/60 p-3">
        <p className="text-xs text-foreground whitespace-pre-wrap break-words">{ticket.message}</p>
        {imgUrl && <img src={imgUrl} alt="" className="mt-2 max-h-48 rounded-lg" />}
      </div>

      {ticket.admin_response && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-[10px] font-black text-primary mb-1">Tu respuesta anterior</p>
          <p className="text-xs text-foreground whitespace-pre-wrap">{ticket.admin_response}</p>
        </div>
      )}

      <textarea value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Responder..."
        className="w-full h-16 bg-secondary border border-border rounded-lg p-2 text-xs resize-none" />

      <div className="flex items-center gap-2 flex-wrap">
        <select value={status} onChange={(e) => changeStatus(e.target.value as TicketStatus)}
          className="h-8 bg-secondary border border-border rounded-lg px-2 text-xs">
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button onClick={send} disabled={busy} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-black flex items-center gap-1">
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Enviar
        </button>
        <button onClick={del} className="ml-auto p-1.5 rounded-lg text-destructive hover:bg-destructive/10">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
