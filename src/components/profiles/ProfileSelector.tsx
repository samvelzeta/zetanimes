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
  // Un ÚNICO botón "Añadir perfil" (no una casilla por cada slot disponible)
  const showAddButton = canCreate;
  const totalCards = visibleProfiles.length + (showAddButton ? 1 : 0);

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

  const handleDelete = async (p: AccountProfile) => {
    if (profiles.length <= 1) {
      toast.error("Debes tener al menos un perfil");
      return;
    }
    if (!confirm(`¿Eliminar el perfil "${p.name}"? El historial asociado se desvinculará.`)) return;
    try {
      await deleteProfile(p.id);
      // Si borramos el default, promovemos otro para que la cuenta siempre tenga uno
      if (p.is_default) {
        const remaining = profiles.filter((x) => x.id !== p.id);
        if (remaining[0]) {
          try { await updateProfile(remaining[0].id, { is_default: true } as any); } catch {}
        }
      }
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

  // Zen dropdown (menú de acciones minimalista arriba-derecha)
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center overflow-y-auto animate-fade-in"
      style={{
        // Fondo "terciopelo oscuro" con textura sutil de fibra de carbono
        backgroundColor: "#050505",
        backgroundImage:
          "repeating-linear-gradient(45deg, rgba(255,255,255,0.012) 0 1px, transparent 1px 3px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.008) 0 1px, transparent 1px 3px), radial-gradient(ellipse at center, rgba(255,255,255,0.02) 0%, transparent 65%)",
      }}
    >
      {/* Zen menu — engranaje arriba a la derecha */}
      {isSelectionMode && (
        <div className="absolute top-5 right-5 z-10">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-500 hover:text-neutral-200 transition-colors"
            aria-label="Opciones"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <circle cx="12" cy="12" r="2.5" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.16.38.48.66.85.83.24.12.5.18.78.18H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.03Z" />
            </svg>
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0" onClick={() => setMenuOpen(false)} />
              <div
                className="absolute right-0 mt-2 w-52 rounded-xl overflow-hidden animate-fade-in"
                style={{
                  backgroundColor: "#0a0a0a",
                  border: "1px solid rgba(255,255,255,0.06)",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
                }}
              >
                {(allowManageToggle || manageMode) && (
                  <button
                    onClick={() => { setMenuOpen(false); setManage(!manage); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.03] transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" strokeWidth={1.4} />
                    {manage ? "Listo" : "Gestionar"}
                  </button>
                )}
                {onClose && (
                  <button
                    onClick={() => { setMenuOpen(false); onClose(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.03] transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.4} />
                    Volver
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <div className="relative max-w-5xl w-full min-h-screen flex flex-col justify-center px-4 py-8 md:py-16">
        <div className="text-center mb-16 md:mb-20">
          <h1
            className="font-serif font-light text-neutral-300"
            style={{
              fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
              letterSpacing: "0.18em",
              fontWeight: 300,
            }}
          >
            {selfEditOnly ? "Editar perfil" : manage ? "Gestionar perfiles" : "¿Quién está viendo?"}
          </h1>
          {/* Detalle "X de Y" solo cuando estamos gestionando; en la selección se elimina para reducir ruido */}
          {manage && !selfEditOnly && (
            <p className="mt-4 text-[10px] uppercase tracking-[0.35em] text-neutral-600 font-light">
              {profiles.length} / {maxProfiles}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-10 md:gap-14 max-w-3xl mx-auto justify-items-center place-content-center">
          {visibleProfiles.map((p, idx) => {
            // Aura: jade para el perfil principal, ámbar para PIN, primary para el resto
            const auraColor = p.is_default
              ? "rgba(52, 211, 153, 0.55)"      // jade
              : p.pin_enabled
              ? "rgba(245, 158, 11, 0.55)"      // ámbar
              : "hsl(var(--primary) / 0.55)";
            return (
              <div
                key={p.id}
                className={`flex flex-col items-center gap-5 animate-fade-in ${totalCards === 3 && idx === 2 ? "col-span-2 md:col-span-1" : ""}`}
                style={{ animationDelay: `${idx * 80}ms`, animationFillMode: "backwards" }}
              >
                <button
                  onClick={() => handlePick(p)}
                  className="group relative w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden transition-all duration-500 hover:-translate-y-1 hover:scale-[1.04]"
                  style={{
                    background: p.accent_color || "#0f0f0f",
                    // Aura permanente muy sutil + intensificada en hover vía CSS variables
                    ["--aura" as any]: auraColor,
                    boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 20px 40px -20px ${auraColor}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = `0 0 0 1px rgba(255,255,255,0.06), 0 0 45px 4px ${auraColor}, 0 25px 50px -15px ${auraColor}`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = `0 0 0 1px rgba(255,255,255,0.04), 0 20px 40px -20px ${auraColor}`;
                  }}
                >
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl font-light text-white/90">
                      {p.name[0]?.toUpperCase()}
                    </div>
                  )}
                </button>
                <span
                  className="text-[11px] uppercase text-neutral-400 font-light truncate max-w-full"
                  style={{ letterSpacing: "0.28em" }}
                >
                  {p.name}
                </span>
                {manage && (
                  <div className="flex gap-2 -mt-2">
                    <button
                      onClick={() => setEditing(p)}
                      className="p-2 rounded-full text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.04] transition"
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" strokeWidth={1.4} />
                    </button>
                    {!selfEditOnly && profiles.length > 1 && (
                      <button
                        onClick={() => handleDelete(p)}
                        className="p-2 rounded-full text-neutral-500 hover:text-destructive hover:bg-white/[0.04] transition"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.4} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {showAddButton && (() => {
            const idx = visibleProfiles.length;
            return (
              <div
                key="add-btn"
                className={`flex flex-col items-center gap-5 animate-fade-in ${totalCards === 3 && idx === 2 ? "col-span-2 md:col-span-1" : ""}`}
                style={{ animationDelay: `${idx * 80}ms`, animationFillMode: "backwards" }}
              >
                <button
                  onClick={() => setCreating(true)}
                  className="w-36 h-36 sm:w-44 sm:h-44 rounded-2xl flex items-center justify-center group transition-all duration-500 hover:-translate-y-1 hover:scale-[1.04]"
                  style={{
                    border: "1px dashed rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.015)",
                  }}
                  title={`Añadir perfil (${profiles.length}/${maxProfiles})`}
                >
                  <Plus className="w-8 h-8 text-neutral-600 group-hover:text-neutral-300 transition" strokeWidth={1.2} />
                </button>
                <span
                  className="text-[11px] uppercase text-neutral-500 font-light"
                  style={{ letterSpacing: "0.28em" }}
                >
                  Añadir
                </span>
              </div>
            );
          })()}
        </div>

        {/* En modo gestión mantenemos los botones inferiores; en selección los ocultamos (van al Zen menu) */}
        {manage && (
          <div className="mt-16 flex justify-center gap-3">
            {profiles.length > 0 && (manageMode || allowManageToggle) && (
              <button
                onClick={() => setManage(!manage)}
                className="px-6 py-2.5 rounded-full text-[11px] uppercase tracking-[0.25em] font-light text-neutral-400 hover:text-neutral-100 border border-white/10 hover:border-white/25 transition"
              >
                {manage ? "Listo" : "Gestionar"}
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-full text-[11px] uppercase tracking-[0.25em] font-light text-neutral-400 hover:text-neutral-100 border border-white/10 hover:border-white/25 flex items-center gap-2 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.4} /> Volver
              </button>
            )}
          </div>
        )}
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
