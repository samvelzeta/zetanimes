import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/contexts/ProfilesContext";
import {
  Plus, Pencil, Trash2, ArrowLeft, Loader2, Search, Sparkles, KeyRound, ShieldOff, Crown, Check,
} from "lucide-react";
import {
  createProfile, deleteProfile, updateProfile, setProfilePin,
  getMaxProfiles, type AccountProfile,
} from "@/lib/account-profiles";
import { fetchAvatarOptions, searchAvatars, type AvatarOption } from "@/lib/anilist-avatars";
import { toast } from "sonner";
import { usePlanPermissions } from "@/hooks/usePlanPermissions";

interface Props {
  manageMode?: boolean;
  onClose?: () => void;
  /** Cuando se activa solo crea/edita (sin selección) */
  onPick?: (profile: AccountProfile) => void;
  allowManageToggle?: boolean;
  editableProfileId?: string | null;
}

const PRESET_COLORS = [
  "#FF4500", "#3B82F6", "#10B981", "#F59E0B", "#EC4899", "#8B5CF6", "#EF4444", "#06B6D4",
];

export default function ProfileSelector({ manageMode = false, onClose, onPick, allowManageToggle = false, editableProfileId = null }: Props) {
  const navigate = useNavigate();
  const { user, isPremium, isOwner } = useAuth();
  const { profiles, refresh, selectProfile } = useProfiles();
  const { permissions } = usePlanPermissions();

  const [editing, setEditing] = useState<AccountProfile | null>(null);
  const [creating, setCreating] = useState(false);
  const [manage, setManage] = useState(manageMode);
  const isSelectionMode = !manage && !manageMode;

  const maxProfiles = getMaxProfiles(isPremium || isOwner, permissions.max_profiles);
  const selfEditOnly = Boolean(editableProfileId);
  const visibleProfiles = selfEditOnly ? profiles.filter((p) => p.id === editableProfileId) : profiles;
  const canCreate = manage && !selfEditOnly && profiles.length < maxProfiles;
  const emptySlots = canCreate ? Array.from({ length: maxProfiles - profiles.length }) : [];
  const totalCards = visibleProfiles.length + emptySlots.length;

  useEffect(() => { if (manageMode) refresh(); }, [refresh, manageMode]);

  // Si es la primera vez (sin perfiles), abrir creación automáticamente
  useEffect(() => {
    if (!profiles.length && manageMode) setCreating(true);
  }, [profiles.length, manageMode]);

  const handlePick = (p: AccountProfile) => {
    if (manage) return;
    if (onPick) {
      onPick(p);
      return;
    }
    selectProfile(p.id);
    onClose?.();
    navigate("/", { replace: true });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este perfil? El historial asociado se desvinculará.")) return;
    try {
      await deleteProfile(id);
      toast.success("Perfil eliminado");
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Error");
    }
  };

  // ---- Editor / creador ----
  if (creating || editing) {
    return (
      <ProfileEditor
        existing={editing || undefined}
        userId={user!.id}
        onCancel={() => { setCreating(false); setEditing(null); }}
        onSaved={async () => {
          setCreating(false);
          setEditing(null);
          await refresh();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center overflow-y-auto animate-fade-in">
      {/* Vignette de fondo */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(var(--background))_70%)] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent pointer-events-none" />

      <div className={`relative max-w-5xl w-full ${isSelectionMode ? "min-h-screen flex flex-col justify-center px-4 py-8 md:py-12" : "min-h-screen flex flex-col justify-center px-4 py-8 md:py-12"}`}>
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 mb-4">
            <Sparkles className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
              {isPremium || isOwner ? <><Crown className="w-3 h-3 inline mr-1" />Premium</> : "Gratis"}
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-3">
            {selfEditOnly ? "Editar perfil" : manage ? "Gestionar perfiles" : "¿Quién está viendo?"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {selfEditOnly ? "Solo puedes personalizar este perfil" : `${profiles.length} de ${maxProfiles} perfiles ${isPremium || isOwner ? "(Premium)" : "(Gratis)"}`}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-8 max-w-3xl mx-auto justify-items-center place-content-center">
          {visibleProfiles.map((p, idx) => (
            <div
              key={p.id}
              className={`flex flex-col items-center gap-3 animate-fade-in ${totalCards === 3 && idx === 2 ? "col-span-2 md:col-span-1" : ""}`}
              style={{ animationDelay: `${idx * 80}ms`, animationFillMode: "backwards" }}
            >
              <button
                onClick={() => handlePick(p)}
                className="group relative w-32 h-32 sm:w-36 sm:h-36 rounded-lg overflow-hidden ring-2 ring-border hover:ring-4 hover:ring-primary transition-all duration-300 hover:scale-110 hover:shadow-[0_0_40px_hsl(var(--primary)/0.5)]"
                style={{ background: p.accent_color || "hsl(var(--muted))" }}
              >
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl font-black text-white">
                    {p.name[0]?.toUpperCase()}
                  </div>
                )}
                {p.pin_enabled && (
                  <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/80 backdrop-blur-md flex items-center justify-center ring-1 ring-primary/40">
                    <KeyRound className="w-3.5 h-3.5 text-primary" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              <span className="text-base font-bold truncate max-w-full">{p.name}</span>
              {manage && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing(p)}
                    className="p-2 rounded-lg bg-secondary hover:bg-muted transition"
                    title="Editar"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {!selfEditOnly && !p.is_default && (
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-2 rounded-lg bg-destructive/20 text-destructive hover:bg-destructive/30 transition"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {emptySlots.map((_, slotIdx) => {
            const idx = visibleProfiles.length + slotIdx;
            return (
            <div
              key={`empty-${slotIdx}`}
              className={`flex flex-col items-center gap-3 animate-fade-in ${totalCards === 3 && idx === 2 ? "col-span-2 md:col-span-1" : ""}`}
              style={{ animationDelay: `${idx * 80}ms`, animationFillMode: "backwards" }}
            >
              <button
                onClick={() => setCreating(true)}
                className="w-32 h-32 sm:w-36 sm:h-36 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all hover:scale-110 flex items-center justify-center group"
              >
                <Plus className="w-12 h-12 text-muted-foreground group-hover:text-primary transition" />
              </button>
              <span className="text-base font-bold text-muted-foreground">Añadir perfil</span>
            </div>
            );
          })}
        </div>

        <div className="mt-12 flex justify-center gap-3">
          {profiles.length > 0 && (manageMode || allowManageToggle) && (
            <button
              onClick={() => setManage(!manage)}
              className="px-5 py-2.5 rounded-lg border border-border hover:border-primary text-sm font-bold transition"
            >
              {manage ? "Listo" : "Gestionar perfiles"}
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg bg-card border border-border text-sm font-bold flex items-center gap-2 hover:bg-secondary transition"
            >
              <ArrowLeft className="w-4 h-4" /> Volver
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ====================== EDITOR ======================
function ProfileEditor({
  existing,
  userId,
  onCancel,
  onSaved,
}: {
  existing?: AccountProfile;
  userId: string;
  onCancel: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [name, setName] = useState(existing?.name || "");
  const [color, setColor] = useState(existing?.accent_color || PRESET_COLORS[0]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(existing?.avatar_url || null);
  const [pin, setPin] = useState("");
  const [enablePinFlag, setEnablePinFlag] = useState(existing?.pin_enabled || false);
  const [busy, setBusy] = useState(false);

  // Galería
  const [avatars, setAvatars] = useState<AvatarOption[]>([]);
  const [loadingAvatars, setLoadingAvatars] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchAvatarOptions(1, 36).then((opts) => {
      setAvatars(opts);
      setLoadingAvatars(false);
    });
  }, []);

  const handleSearch = async (term: string) => {
    setSearchTerm(term);
    if (!term.trim()) {
      setSearching(false);
      const opts = await fetchAvatarOptions(1, 36);
      setAvatars(opts);
      return;
    }
    setSearching(true);
    const results = await searchAvatars(term);
    setAvatars(results);
    setSearching(false);
  };

  const handleSave = async () => {
    if (!name.trim()) return toast.error("Nombre requerido");
    if (enablePinFlag && !existing && !/^\d{4}$/.test(pin)) {
      return toast.error("PIN debe ser 4 dígitos");
    }
    setBusy(true);
    try {
      if (existing) {
        await updateProfile(existing.id, {
          name: name.trim().slice(0, 20),
          accent_color: color,
          avatar_url: avatarUrl,
        });
        // PIN
        if (enablePinFlag && /^\d{4}$/.test(pin)) {
          await setProfilePin(existing.id, pin);
        } else if (!enablePinFlag && existing.pin_enabled) {
          await setProfilePin(existing.id, null);
        }
        toast.success("Perfil actualizado");
      } else {
        await createProfile(userId, {
          name: name.trim().slice(0, 20),
          accent_color: color,
          avatar_url: avatarUrl,
          pin: enablePinFlag ? pin : null,
        });
        toast.success("Perfil creado");
      }
      await onSaved();
    } catch (e: any) {
      toast.error(e.message || "Error al guardar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background overflow-y-auto animate-fade-in">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08)_0%,transparent_60%)] pointer-events-none" />
      <div className="relative max-w-4xl mx-auto px-4 py-8 md:py-12">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground mb-6 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Cancelar
        </button>

        <h1 className="text-3xl md:text-4xl font-black mb-2">
          {existing ? "Editar perfil" : "Crear perfil"}
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          {existing
            ? "Cambia el avatar, nombre, color o PIN del perfil."
            : "Personaliza tu perfil con un avatar de AniList y un PIN opcional."}
        </p>

        <div className="grid md:grid-cols-[200px_1fr] gap-8">
          {/* Preview */}
          <div className="flex flex-col items-center md:items-start gap-3">
            <div
              className="w-40 h-40 rounded-3xl overflow-hidden ring-4 ring-primary/30 shadow-2xl"
              style={{ background: color }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl font-black text-white">
                  {name[0]?.toUpperCase() || "?"}
                </div>
              )}
            </div>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre"
              maxLength={20}
              className="w-full px-3 py-2 text-base font-bold text-center rounded-lg bg-secondary border border-border focus:border-primary outline-none"
            />
            <div className="flex flex-wrap gap-2 justify-center">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ background: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>

          {/* Galería + PIN */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-muted-foreground">
                  Avatares · AniList
                </h3>
                {avatarUrl && (
                  <button
                    onClick={() => setAvatarUrl(null)}
                    className="text-[10px] font-bold text-muted-foreground hover:text-destructive uppercase"
                  >
                    Quitar avatar
                  </button>
                )}
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Buscar personaje (Naruto, Luffy, Mikasa...)"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-secondary border border-border focus:border-primary outline-none"
                />
              </div>

              {loadingAvatars || searching ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : avatars.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-8">
                  Sin resultados. Prueba otro nombre.
                </p>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-[420px] overflow-y-auto p-1">
                  {avatars.map((a) => {
                    const selected = avatarUrl === a.image;
                    return (
                      <button
                        key={a.id}
                        onClick={() => setAvatarUrl(a.image)}
                        title={`${a.name} — ${a.source}`}
                        className={`relative aspect-square rounded-xl overflow-hidden transition-all hover:scale-105 ${
                          selected ? "ring-4 ring-primary scale-105" : "ring-1 ring-border hover:ring-primary/50"
                        }`}
                      >
                        <img src={a.image} alt={a.name} loading="lazy" className="w-full h-full object-cover" />
                        {selected && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                              <Check className="w-4 h-4 text-primary-foreground" />
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* PIN */}
            <div className="rounded-xl border border-border p-4 bg-card/50">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1">
                  <h3 className="text-sm font-black flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-primary" /> PIN del perfil
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Si lo activas, se pedirá un PIN de 4 dígitos al entrar en este perfil.
                  </p>
                </div>
                <button
                  onClick={() => setEnablePinFlag(!enablePinFlag)}
                  className={`relative w-11 h-6 rounded-full transition ${enablePinFlag ? "bg-primary" : "bg-secondary"}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-background transition-transform ${enablePinFlag ? "translate-x-5" : ""}`}
                  />
                </button>
              </div>

              {enablePinFlag && (
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder={existing?.pin_enabled ? "Cambiar PIN (4 dígitos)" : "Nuevo PIN (4 dígitos)"}
                  className="w-full text-center text-2xl tracking-[0.5em] font-black px-3 py-2 rounded-lg bg-background border-2 border-input focus:border-primary outline-none"
                />
              )}

              {existing?.pin_enabled && !enablePinFlag && (
                <div className="text-[11px] text-yellow-300 flex items-center gap-1.5 mt-2">
                  <ShieldOff className="w-3 h-3" /> El PIN se desactivará al guardar.
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={onCancel}
                className="px-5 py-2.5 rounded-lg bg-secondary hover:bg-muted text-sm font-bold transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={busy}
                className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-bold flex items-center gap-2 disabled:opacity-50 transition"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {existing ? "Guardar cambios" : "Crear perfil"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
