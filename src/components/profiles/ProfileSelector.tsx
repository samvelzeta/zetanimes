import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/contexts/ProfilesContext";
import { Plus, User, Crown, Pencil, Trash2, ArrowLeft, Loader2 } from "lucide-react";
import { createProfile, deleteProfile, updateProfile } from "@/lib/account-profiles";
import { toast } from "sonner";

interface Props {
  /** Si true, también permite crear/editar perfiles */
  manageMode?: boolean;
  onClose?: () => void;
}

const PRESET_COLORS = [
  "#FF4500", "#3B82F6", "#10B981", "#F59E0B", "#EC4899", "#8B5CF6", "#EF4444", "#06B6D4",
];

export default function ProfileSelector({ manageMode = false, onClose }: Props) {
  const navigate = useNavigate();
  const { user, isPremium } = useAuth();
  const { profiles, refresh, selectProfile } = useProfiles();
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [manage, setManage] = useState(manageMode);

  const maxProfiles = 5;
  const canCreate = profiles.length < maxProfiles;

  useEffect(() => { refresh(); }, [refresh]);

  const handlePick = (id: string) => {
    selectProfile(id);
    onClose?.();
    navigate("/", { replace: true });
  };

  const handleCreate = async () => {
    if (!user || !name.trim()) return toast.error("Nombre requerido");
    setBusy(true);
    try {
      await createProfile(user.id, { name: name.trim().slice(0, 20), accent_color: color });
      toast.success("Perfil creado");
      setCreating(false);
      setName("");
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Error al crear");
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async (id: string) => {
    if (!name.trim()) return toast.error("Nombre requerido");
    setBusy(true);
    try {
      await updateProfile(id, { name: name.trim().slice(0, 20), accent_color: color });
      toast.success("Perfil actualizado");
      setEditing(null);
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Error al guardar");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este perfil? El historial asociado se desvinculará.")) return;
    setBusy(true);
    try {
      await deleteProfile(id);
      toast.success("Perfil eliminado");
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 overflow-y-auto">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-2">
            {manage ? "Gestionar perfiles" : "¿Quién está viendo?"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {profiles.length} de {maxProfiles} perfiles · {isPremium ? "Premium" : "Gratis"}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {profiles.map((p) => {
            const isEditing = editing === p.id;
            return (
              <div key={p.id} className="flex flex-col items-center gap-2">
                {isEditing ? (
                  <div className="w-full p-3 rounded-xl bg-card border border-border space-y-2">
                    <input
                      autoFocus
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nombre"
                      className="w-full px-2 py-1 text-sm rounded bg-background border border-input"
                      maxLength={20}
                    />
                    <div className="flex flex-wrap gap-1">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setColor(c)}
                          className={`w-5 h-5 rounded-full border-2 ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                          style={{ background: c }}
                          aria-label={c}
                        />
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleSave(p.id)}
                        disabled={busy}
                        className="flex-1 px-2 py-1 text-xs rounded bg-primary text-primary-foreground font-bold disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="w-3 h-3 mx-auto animate-spin" /> : "Guardar"}
                      </button>
                      <button onClick={() => setEditing(null)} className="px-2 py-1 text-xs rounded bg-secondary">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => (manage ? null : handlePick(p.id))}
                      className="group relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden ring-2 ring-border hover:ring-primary transition-all hover:scale-105"
                      style={{ background: p.accent_color || "hsl(var(--muted))" }}
                    >
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl font-black text-white">
                          {p.name[0]?.toUpperCase()}
                        </div>
                      )}
                    </button>
                    <span className="text-sm font-bold truncate max-w-full">{p.name}</span>
                    {manage && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setEditing(p.id); setName(p.name); setColor(p.accent_color || PRESET_COLORS[0]); }}
                          className="p-1.5 rounded-lg bg-secondary hover:bg-muted"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg bg-destructive/20 text-destructive hover:bg-destructive/30">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}

          {/* Create slot */}
          {canCreate && (
            <div className="flex flex-col items-center gap-2">
              {creating ? (
                <div className="w-full p-3 rounded-xl bg-card border border-border space-y-2">
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nombre"
                    className="w-full px-2 py-1 text-sm rounded bg-background border border-input"
                    maxLength={20}
                  />
                  <div className="flex flex-wrap gap-1">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        className={`w-5 h-5 rounded-full border-2 ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={handleCreate} disabled={busy} className="flex-1 px-2 py-1 text-xs rounded bg-primary text-primary-foreground font-bold disabled:opacity-50">
                      {busy ? <Loader2 className="w-3 h-3 mx-auto animate-spin" /> : "Crear"}
                    </button>
                    <button onClick={() => setCreating(false)} className="px-2 py-1 text-xs rounded bg-secondary">X</button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setCreating(true)}
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition flex items-center justify-center"
                  >
                    <Plus className="w-8 h-8 text-muted-foreground" />
                  </button>
                  <span className="text-sm font-bold text-muted-foreground">Añadir perfil</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-center gap-3">
          <button
            onClick={() => setManage(!manage)}
            className="px-4 py-2 rounded-lg bg-secondary hover:bg-muted text-sm font-bold"
          >
            {manage ? "Listo" : "Gestionar perfiles"}
          </button>
          {onClose && (
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-card border border-border text-sm font-bold flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Volver
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
