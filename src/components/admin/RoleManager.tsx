import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Loader2, Shield, Crown, User as UserIcon, X, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { logAdminActivity } from "@/lib/admin-log";
import { fuzzyTextScore, normalizeSearchText } from "@/lib/search-utils";

type AppRole = "owner" | "admin" | "premium" | "user";

interface UserRow {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  subscription_status: string | null;
  plan_type: string | null;
  roles: AppRole[];
}

const ROLE_BADGE: Record<AppRole, string> = {
  owner: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  admin: "bg-primary/20 text-primary border-primary/40",
  premium: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  user: "bg-secondary text-muted-foreground border-border",
};

export default function RoleManager() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("user_id, username, display_name, avatar_url, subscription_status, plan_type").order("created_at", { ascending: false }).limit(500),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const rolesMap = new Map<string, AppRole[]>();
    (roles || []).forEach((r: any) => {
      const arr = rolesMap.get(r.user_id) || [];
      arr.push(r.role);
      rolesMap.set(r.user_id, arr);
    });
    const combined: UserRow[] = (profiles || []).map((p: any) => ({
      user_id: p.user_id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      subscription_status: p.subscription_status,
      plan_type: p.plan_type,
      roles: rolesMap.get(p.user_id) || ["user"],
    }));
    setUsers(combined);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleRole = async (userId: string, role: AppRole, currentlyHas: boolean) => {
    if (role === "owner") {
      toast.error("No puedes asignar el rol owner desde aquí");
      return;
    }
    setBusyId(userId);
    try {
      const target = users.find((u) => u.user_id === userId);
      const targetName = target?.display_name || target?.username || userId;
      if (currentlyHas) {
        await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
        await logAdminActivity({ area: "roles", action: "delete", summary: `Removió rol ${role} a ${targetName}`, target_type: "user", target_id: userId });
        toast.success(`Rol ${role} removido`);
      } else {
        await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
        await logAdminActivity({ area: "roles", action: "create", summary: `Asignó rol ${role} a ${targetName}`, target_type: "user", target_id: userId });
        toast.success(`Rol ${role} asignado`);
      }
      // Refrescar sólo este usuario
      const { data: updatedRoles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      setUsers((prev) => prev.map((u) =>
        u.user_id === userId
          ? { ...u, roles: (updatedRoles?.map((r: any) => r.role) || ["user"]) as AppRole[] }
          : u
      ));
    } catch (e: any) {
      toast.error("Error: " + (e.message || "no se pudo actualizar"));
    }
    setBusyId(null);
  };

  const filtered = users.filter((u) => {
    const q = normalizeSearchText(search);
    if (!q) return true;
    return fuzzyTextScore(q, [u.username, u.display_name, u.user_id]) >= 1.1;
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-1">
          <Shield className="w-4 h-4 text-primary" /> Gestor de Roles
        </h3>
        <p className="text-[10px] text-muted-foreground">
          Asigna o revoca roles a tus colaboradores. Solo el owner puede ver esta sección.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por username, nombre o ID..."
          className="pl-10 h-10 bg-secondary border-primary/30 rounded-xl"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Sin resultados</p>
      ) : (
        <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
          {filtered.map((u) => {
            const isOwner = u.roles.includes("owner");
            const isAdmin = u.roles.includes("admin");
            const isPremium = u.roles.includes("premium");
            const isSubscribed = u.subscription_status === "active" && !!u.plan_type;
            const busy = busyId === u.user_id;
            return (
              <div key={u.user_id} className="bg-secondary rounded-xl p-3 border border-border">
                <div className="flex items-center gap-3">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
                      {(u.display_name || u.username || "?")[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">
                      {u.display_name || u.username}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">@{u.username}</p>
                  </div>
                  <div className="flex flex-wrap gap-1 max-w-[40%] justify-end">
                    {u.roles.map((r) => (
                      <span key={r} className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${ROLE_BADGE[r]}`}>
                        {r}
                      </span>
                    ))}
                    {isSubscribed && !isPremium && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-purple-500/20 text-purple-300 border-purple-500/40">
                        premium · {u.plan_type}
                      </span>
                    )}
                  </div>
                </div>

                {!isOwner && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                    <button
                      onClick={() => toggleRole(u.user_id, "admin", isAdmin)}
                      disabled={busy}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 disabled:opacity-50 ${
                        isAdmin
                          ? "bg-primary/20 text-primary border border-primary/40 hover:bg-destructive/20 hover:text-destructive hover:border-destructive/40"
                          : "bg-secondary border border-border text-muted-foreground hover:bg-primary hover:text-primary-foreground"
                      }`}
                    >
                      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : isAdmin ? <X className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                      {isAdmin ? "Quitar admin" : "Hacer admin"}
                    </button>
                    <button
                      onClick={() => toggleRole(u.user_id, "premium", isPremium)}
                      disabled={busy}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 disabled:opacity-50 ${
                        isPremium
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-destructive/20 hover:text-destructive hover:border-destructive/40"
                          : "bg-secondary border border-border text-muted-foreground hover:bg-purple-500 hover:text-white"
                      }`}
                    >
                      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : isPremium ? <X className="w-3 h-3" /> : <Crown className="w-3 h-3" />}
                      {isPremium ? "Quitar premium" : "Hacer premium"}
                    </button>
                  </div>
                )}
                {isOwner && (
                  <p className="text-[10px] text-yellow-400 mt-2 flex items-center gap-1">
                    <Crown className="w-3 h-3" /> Owner protegido — no editable
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
