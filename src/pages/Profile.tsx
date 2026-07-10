import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Settings,
  LogOut,
  Crown,
  Shield,
  MessageSquare,
  ExternalLink,
  Camera,
  Share2,
  Smartphone,
  Users,
  Library,
  FileDown,
  Loader2,
  BadgeCheck,
  MonitorSmartphone,
  X,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { compressAvatar } from "@/lib/image-compress";
import { exportUserHistoryToPDF } from "@/lib/export-history-pdf";
import { getAccentColor } from "@/lib/accent";
import ProfileManagementSection from "@/components/profiles/ProfileManagementSection";
import { useProfiles } from "@/contexts/ProfilesContext";
import ProfileSelector from "@/components/profiles/ProfileSelector";
import PremiumScreen from "@/components/profiles/PremiumScreen";
import { setActiveProfileId } from "@/lib/account-profiles";
import { usePlanPermissions } from "@/hooks/usePlanPermissions";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ProfileBanner from "@/components/premium/ProfileBanner";
import UserName from "@/components/premium/UserName";
import XPBar from "@/components/premium/XPBar";
import CosmeticsPicker from "@/components/premium/CosmeticsPicker";
import { useUserCosmetics } from "@/hooks/useUserCosmetics";

type PanelId = null | "manage" | "contact";

export default function Profile() {
  const { user, profile, isPremium, isOwner, isAdmin, signOut, refreshProfile } = useAuth();
  const { activeProfile, refresh: refreshProfiles } = useProfiles();
  const profileId = activeProfile?.id ?? null;
  const isMainProfile = !activeProfile || activeProfile.is_default;
  const displayName = activeProfile?.name || profile?.display_name || profile?.username || "Usuario";
  const displayAvatar = activeProfile?.avatar_url || profile?.avatar_url;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [stats, setStats] = useState({ lists: 0, episodes: 0, hours: 0 });
  const [contacts, setContacts] = useState<any[]>([]);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showOwnProfileEditor, setShowOwnProfileEditor] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [panel, setPanel] = useState<PanelId>(null);

  const { permissions } = usePlanPermissions();

  const handleExportPDF = async () => {
    if (!user || !profile) return;
    if (!permissions.pdf_export) {
      toast.error("Disponible al actualizar tu plan", {
        action: { label: "Ver planes", onClick: () => setShowPremiumModal(true) },
      });
      return;
    }
    setExportingPdf(true);
    try {
      await exportUserHistoryToPDF(user.id, {
        username: profile.username,
        displayName: profile.display_name || profile.username,
        accentHex: getAccentColor().hex,
        profileId,
        profileName: activeProfile?.name,
      });
      toast.success("Historial exportado");
    } catch (e) {
      console.error(e);
      toast.error("Error al generar PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  useEffect(() => {
    if (searchParams.get("premium") === "1" && user && !isPremium) {
      setShowPremiumModal(true);
      searchParams.delete("premium");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, user, isPremium, setSearchParams]);

  useEffect(() => {
    if (user) loadStats();
    loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profileId]);

  // Realtime: si el mismo perfil ve un episodio en otro dispositivo, el
  // contador agregado se refresca automáticamente sin recargar la página.
  useEffect(() => {
    if (!user) return;
    const onVisible = () => { if (document.visibilityState === "visible") loadStats(); };
    document.addEventListener("visibilitychange", onVisible);
    const channel = supabase
      .channel(`profile-stats-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profile_stats", filter: `user_id=eq.${user.id}` },
        () => { loadStats(); }
      )
      .subscribe();
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profileId]);

  const loadStats = async () => {
    if (!user) return;
    // Lectura ultra ligera: una sola fila agregada por (user_id, profile_id)
    // en `profile_stats`. Los triggers de la BD mantienen los contadores al
    // día cada vez que se inserta/actualiza watch_history o anime_lists, así
    // que el perfil no vuelve a escanear miles de filas para pintar 3 números.
    let q = supabase
      .from("profile_stats" as any)
      .select("episodes_completed,total_watch_seconds,lists_count")
      .eq("user_id", user.id);
    q = profileId ? q.eq("profile_id", profileId) : q.is("profile_id", null);
    const { data } = await q.maybeSingle();
    const row = (data as any) || { episodes_completed: 0, total_watch_seconds: 0, lists_count: 0 };
    setStats({
      lists: Number(row.lists_count) || 0,
      episodes: Number(row.episodes_completed) || 0,
      hours: Math.round(((Number(row.total_watch_seconds) || 0) / 3600) * 10) / 10,
    });
  };

  const loadContacts = async () => {
    const { data } = await supabase.from("contact_links").select("*").order("sort_order");
    if (data) setContacts(data);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!permissions.custom_avatar_upload) {
      e.target.value = "";
      toast.error("Disponible al actualizar tu plan", {
        action: { label: "Ver planes", onClick: () => setShowPremiumModal(true) },
      });
      return;
    }
    if (!isMainProfile) return toast.error("Solo el perfil principal puede subir foto desde el dispositivo");
    if (!user || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    const compressed = await compressAvatar(file);
    const path = `${user.id}/avatar.webp`;
    const { error } = await supabase.storage.from("avatars").upload(path, compressed, { upsert: true, contentType: "image/webp" });
    if (error) return toast.error("Error al subir imagen");
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("user_id", user.id);
    if (activeProfile) {
      await supabase.from("account_profiles").update({ avatar_url: avatarUrl }).eq("id", activeProfile.id);
      await refreshProfiles();
    }
    await refreshProfile();
    toast.success("Foto actualizada");
  };

  const shareApp = async () => {
    const url = `${window.location.origin}/download`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "zetAnime APK", text: "Descarga zetAnime y mira anime sin límites", url });
        return;
      } catch {}
    }
    await navigator.clipboard.writeText(url);
    toast.success("Enlace copiado");
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background pt-24 px-6 pb-24">
        <div className="max-w-md mx-auto text-center">
          <div className="w-28 h-28 rounded-full overflow-hidden mx-auto mb-8 bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center">
            <span className="text-3xl font-thin text-foreground/60">Z</span>
          </div>
          <h1 className="text-4xl font-thin tracking-tight text-foreground mb-2">Invitado</h1>
          <p className="text-sm text-muted-foreground/70 mb-10 font-light">Inicia sesión para guardar tu progreso</p>
          <Link
            to="/auth"
            className="inline-block px-10 py-3 rounded-full border border-foreground/20 text-sm font-medium text-foreground hover:border-primary hover:text-primary transition-all"
          >
            Iniciar Sesión
          </Link>
        </div>
      </div>
    );
  }

  const managementItems: Array<{ id: string; icon: any; label: string; onClick: () => void; hint?: string }> = [
    { id: "lists", icon: Library, label: "Mis Listas", onClick: () => navigate("/mis-listas"), hint: "Favoritos, viendo, terminados" },
    { id: "manage", icon: MonitorSmartphone, label: "Perfiles y Dispositivos", onClick: () => setPanel("manage"), hint: "Gestiona hasta 5 perfiles" },
    { id: "settings", icon: Settings, label: "Configuración", onClick: () => navigate("/settings"), hint: "Preferencias, tema, PIN" },
  ];
  if (isAdmin) {
    managementItems.push({
      id: "admin",
      icon: Shield,
      label: isOwner ? "Panel Owner" : "Panel Admin",
      onClick: () => navigate("/admin"),
      hint: "Herramientas de administración",
    });
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <button
        onClick={() => navigate("/")}
        aria-label="Volver"
        className="fixed top-6 left-6 z-50 w-10 h-10 rounded-full bg-neutral-900/80 border border-neutral-700 backdrop-blur-sm flex items-center justify-center text-foreground/80 hover:text-primary hover:border-primary/60 hover:bg-neutral-900 transition-all shadow-lg"
      >
        <ChevronLeft className="w-5 h-5" strokeWidth={1.75} />
      </button>
      <div className="max-w-[860px] mx-auto px-5 md:px-8 pt-16 md:pt-20 pb-32">
        <div className="arcane-card arcane-stagger overflow-hidden rounded-3xl border border-neutral-800/70 bg-white/[0.015] flex flex-col gap-8 p-6 md:p-10">
          {/* Ambient Hextech particles — solo premium/owner */}
          {(isPremium || isOwner) && (
          <div className="arcane-particles" aria-hidden>
            {Array.from({ length: 14 }).map((_, i) => {
              const left = (i * 7.3) % 100;
              const dur = 12 + ((i * 3) % 10);
              const delay = (i * 1.4) % 9;
              const size = 2 + (i % 3);
              return (
                <span
                  key={i}
                  style={{
                    left: `${left}%`,
                    width: `${size}px`,
                    height: `${size}px`,
                    animationDuration: `${dur}s`,
                    animationDelay: `-${delay}s`,
                  }}
                />
              );
            })}
          </div>
          )}



          <header className="flex items-start gap-5 md:gap-10">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="relative w-24 h-24 md:w-36 md:h-36" style={{ isolation: "isolate" }}>
                {/* Z-0: Magitech pulse glow */}
                {(profile?.subscription_status === "active" || isOwner) && (
                  <>
                    <span
                      aria-hidden
                      className="magitech-pulse absolute top-1/2 left-1/2 rounded-full pointer-events-none"
                      style={{
                        zIndex: 0,
                        width: "125%",
                        height: "125%",
                        background: "radial-gradient(circle, hsl(var(--primary) / 0.55) 0%, hsl(var(--primary) / 0.15) 45%, transparent 70%)",
                        filter: "blur(14px)",
                      }}
                    />
                    {/* Z-2: rotating dashed rune ring */}
                    <span
                      aria-hidden
                      className="magitech-spin absolute inset-[-6px] rounded-full pointer-events-none"
                      style={{
                        zIndex: 2,
                        border: "1.5px dashed hsl(var(--primary) / 0.75)",
                        boxShadow: "0 0 12px hsl(var(--primary) / 0.35) inset",
                      }}
                    />
                    <span
                      aria-hidden
                      className="magitech-spin-reverse absolute inset-[-12px] rounded-full pointer-events-none"
                      style={{
                        zIndex: 2,
                        border: "1px dotted hsl(var(--primary) / 0.35)",
                      }}
                    />
                  </>
                )}
                {/* Engranaje centrado como marco alrededor del avatar + polvo Minecraft — solo premium/owner */}
                {(isPremium || isOwner) && (
                <div
                  className="gear-emitter"
                  aria-hidden
                  style={{
                    top: "50%",
                    left: "50%",
                    width: "160%",
                    height: "160%",
                    transform: "translate(-50%, -50%)",
                    zIndex: 1,
                  }}
                >
                  <svg className="gear-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.55 }}>
                    <path d="M19.14 12.94a7.97 7.97 0 0 0 0-1.88l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.9 7.9 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.65 8.84a.5.5 0 0 0 .12.64l2.03 1.58a7.97 7.97 0 0 0 0 1.88L2.77 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.39 1.04.7 1.63.94l.36 2.54a.5.5 0 0 0 .5.42h3.84a.5.5 0 0 0 .5-.42l.36-2.54c.59-.24 1.13-.55 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58Z" />
                  </svg>
                  {Array.from({ length: 10 }).map((_, i) => {
                    const angle = i * 36;
                    const delay = (i * 0.35).toFixed(2);
                    const dur = 3.2 + (i % 3) * 0.5;
                    return (
                      <span
                        key={i}
                        className="dust"
                        style={{
                          ["--dust-angle" as any]: `${angle}deg`,
                          animationDelay: `${delay}s`,
                          animationDuration: `${dur}s`,
                        }}
                      />
                    );
                  })}
                </div>
                )}
                {/* Z-1: Photo */}
                <div
                  className="relative w-full h-full rounded-full overflow-hidden"
                  style={{ zIndex: 10, filter: "drop-shadow(0 20px 40px hsl(var(--primary) / 0.35)) drop-shadow(0 8px 16px rgb(0 0 0 / 0.4))" }}
                >
                  {displayAvatar ? (
                    <img src={displayAvatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/40 to-accent/20 flex items-center justify-center">
                      <span className="text-4xl md:text-5xl font-thin text-foreground/70">
                        {displayName[0]?.toUpperCase() || "U"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {isMainProfile && permissions.custom_avatar_upload && (
                <label className="absolute bottom-1 right-1 z-10 w-8 h-8 rounded-full bg-background border border-foreground/15 flex items-center justify-center cursor-pointer hover:border-primary transition">
                  <Camera className="w-3.5 h-3.5 text-foreground/70" />
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                </label>
              )}
            </div>

            <div className="flex-1 min-w-0 pt-1 md:pt-3">
              <h1
                className="text-3xl md:text-5xl tracking-tight text-foreground leading-none truncate"
                style={{ fontWeight: 200, letterSpacing: "-0.02em" }}
              >
                {displayName}
              </h1>
              {isMainProfile && (
                <p className="mt-2 md:mt-3 text-xs md:text-sm text-muted-foreground/60 font-light truncate">
                  {user.email}
                </p>
              )}
              {isMainProfile && (profile?.subscription_status === "active" || isOwner) && (
                <span className="mt-3 inline-flex items-center gap-1.5 text-[10px] md:text-xs font-medium text-primary tracking-widest uppercase px-2.5 py-1 rounded-full border border-primary/30 bg-primary/5">
                  <BadgeCheck className="w-3.5 h-3.5" />
                  <span className="vip-shimmer">VIP</span>
                  {profile?.plan_type && (
                    <span className="opacity-70 normal-case tracking-normal">
                      · {profile.plan_type === "duo" ? "Dúo" : profile.plan_type === "solo" ? "Solo" : "Básico"}
                    </span>
                  )}
                  {isOwner && !profile?.plan_type && <span className="opacity-70 normal-case tracking-normal">· Owner</span>}
                </span>
              )}
            </div>
          </header>

          {/* Insights */}
          <div className="grid grid-cols-3 gap-4 md:gap-12">
            {[
              { value: stats.lists, label: "En listas" },
              { value: stats.episodes, label: "Episodios" },
              { value: stats.hours, label: "Horas" },
            ].map((s) => (
              <div key={s.label} className="group">
                <p
                  className="text-4xl md:text-5xl text-foreground/90 leading-none transition-colors group-hover:text-primary"
                  style={{ fontWeight: 200, letterSpacing: "-0.03em" }}
                >
                  {s.value}
                </p>
                <p className="mt-2 md:mt-3 text-[10px] md:text-xs text-muted-foreground/50 uppercase tracking-[0.2em] font-light">
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          {/* separador sutil */}
          <div className="border-t border-neutral-900/60" />

          {/* ————————————— ZONA DE GESTIÓN ————————————— */}
          <section>
            <h2 className="text-[10px] md:text-xs text-muted-foreground/50 uppercase tracking-[0.25em] font-light mb-5">
              Gestión de Cuenta
            </h2>

            {/* Móvil: grid 2x2. Desktop: fila horizontal tipo toolbar */}
            <div className="grid grid-cols-2 md:flex md:flex-row md:flex-wrap gap-3">
              {managementItems.map((item) => (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className="mgmt-tile group text-left p-4 md:px-5 md:py-4 rounded-2xl md:flex-1 md:min-w-[160px]"
                >
                  <span className="relative inline-block mb-3">
                    <item.icon
                      className="w-5 h-5 md:w-5 md:h-5 text-foreground/60 group-hover:text-primary transition-colors"
                      strokeWidth={1.5}
                    />
                    <svg
                      aria-hidden
                      viewBox="0 0 24 24"
                      className="cog-spin absolute -top-1.5 -right-2 w-3.5 h-3.5 text-primary/70 group-hover:text-primary transition-colors"
                      fill="currentColor"
                    >
                      <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm0 5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
                      <path d="M19.4 12c0-.34-.03-.67-.08-1l1.7-1.32a.5.5 0 0 0 .11-.62l-1.6-2.77a.5.5 0 0 0-.6-.22l-2 .8a7.4 7.4 0 0 0-1.72-1L14.9 3.6a.5.5 0 0 0-.5-.42h-3.2a.5.5 0 0 0-.5.42l-.31 2.27c-.62.24-1.2.58-1.72 1l-2-.8a.5.5 0 0 0-.6.22L4.47 9.06a.5.5 0 0 0 .11.62L6.28 11c-.05.33-.08.66-.08 1s.03.67.08 1l-1.7 1.32a.5.5 0 0 0-.11.62l1.6 2.77a.5.5 0 0 0 .6.22l2-.8c.52.42 1.1.76 1.72 1l.31 2.27a.5.5 0 0 0 .5.42h3.2a.5.5 0 0 0 .5-.42l.31-2.27c.62-.24 1.2-.58 1.72-1l2 .8a.5.5 0 0 0 .6-.22l1.6-2.77a.5.5 0 0 0-.11-.62L19.32 13c.05-.33.08-.66.08-1Z" opacity=".35" />
                    </svg>
                  </span>
                  <p className="text-sm font-light text-foreground tracking-tight">{item.label}</p>
                  {item.hint && (
                    <p className="text-[10px] md:text-xs text-muted-foreground/50 font-light mt-1 line-clamp-1">{item.hint}</p>
                  )}
                </button>
              ))}


              {!isPremium && isMainProfile && (
                <button
                  onClick={() => setShowPremiumModal(true)}
                  className="mgmt-tile group text-left p-4 md:px-5 md:py-4 rounded-2xl col-span-2 md:flex-1 md:min-w-[220px] md:basis-full"
                >
                  <span className="relative inline-block mb-3">
                    <Crown className="w-5 h-5 text-primary" strokeWidth={1.5} />
                    <svg aria-hidden viewBox="0 0 24 24" className="cog-spin absolute -top-1.5 -right-2 w-3.5 h-3.5 text-primary/70" fill="currentColor">
                      <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm0 5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
                    </svg>
                  </span>
                  <p className="text-sm font-light text-foreground tracking-tight">Obtener Premium</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground/60 font-light mt-1">
                    Desbloquea planes Básico, Solo o Dúo
                  </p>
                </button>
              )}

            </div>

            {!isMainProfile && activeProfile && (
              <button
                onClick={() => setShowOwnProfileEditor(true)}
                className="mt-3 w-full text-left p-4 rounded-2xl hover:bg-foreground/5 transition-all flex items-center gap-3"
              >
                <Users className="w-5 h-5 text-foreground/50" strokeWidth={1.5} />
                <span className="text-sm font-light text-foreground">Editar este perfil</span>
              </button>
            )}
          </section>

          {/* separador sutil */}
          <div className="border-t border-neutral-900/60" />

          {/* ————————————— ZONA DE UTILIDADES ————————————— */}
          <section>
            <h2 className="text-[10px] md:text-xs text-muted-foreground/50 uppercase tracking-[0.25em] font-light mb-5">
              Acciones de Cuenta
            </h2>
            <div className="flex flex-wrap gap-2 md:justify-center">
              {isMainProfile && (
                <button
                  onClick={handleExportPDF}
                  disabled={exportingPdf}
                  className="inline-flex items-center gap-2 px-4 md:px-5 py-2.5 rounded-full border border-foreground/15 text-xs md:text-sm font-light text-foreground/80 hover:border-primary hover:text-primary transition-all disabled:opacity-50"
                >
                  {exportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" strokeWidth={1.5} />}
                  Exportar historial
                  {!permissions.pdf_export && (
                    <span className="text-[9px] font-medium tracking-wider text-primary/80">PREMIUM</span>
                  )}
                </button>
              )}
              <button
                onClick={shareApp}
                className="inline-flex items-center gap-2 px-4 md:px-5 py-2.5 rounded-full border border-foreground/15 text-xs md:text-sm font-light text-foreground/80 hover:border-primary hover:text-primary transition-all"
              >
                <Share2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                Compartir app
              </button>
              {contacts.length > 0 && (
                <button
                  onClick={() => setPanel("contact")}
                  className="inline-flex items-center gap-2 px-4 md:px-5 py-2.5 rounded-full border border-foreground/15 text-xs md:text-sm font-light text-foreground/80 hover:border-primary hover:text-primary transition-all"
                >
                  <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Contáctanos
                </button>
              )}
              <Link
                to="/download"
                className="inline-flex items-center gap-2 px-4 md:px-5 py-2.5 rounded-full border border-foreground/15 text-xs md:text-sm font-light text-foreground/80 hover:border-primary hover:text-primary transition-all"
              >
                <Smartphone className="w-3.5 h-3.5" strokeWidth={1.5} />
                Descargar APK
              </Link>
            </div>
          </section>

          {/* separador sutil */}
          <div className="border-t border-neutral-900/60" />

          {/* ————————————— ACCIONES CRÍTICAS ————————————— */}
          <footer className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <button
              onClick={() => {
                setActiveProfileId(null);
                navigate("/");
              }}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-foreground/15 text-sm font-light text-foreground/80 hover:border-foreground hover:text-foreground transition-all"
            >
              <Users className="w-4 h-4" strokeWidth={1.5} />
              Cerrar perfil
            </button>
            <button
              onClick={() => {
                signOut();
                navigate("/");
              }}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-destructive/40 text-sm font-light text-destructive hover:bg-destructive/10 hover:border-destructive transition-all"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.5} />
              Cerrar sesión
            </button>
          </footer>
        </div>
      </div>


      {/* ————————————— PANEL LATERAL: Gestión (Perfiles + Dispositivos + PIN) ————————————— */}
      <Sheet open={panel === "manage"} onOpenChange={(o) => !o && setPanel(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto bg-background border-l border-foreground/10">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-2xl font-thin tracking-tight">Perfiles y Dispositivos</SheetTitle>
          </SheetHeader>
          {isMainProfile ? (
            <ProfileManagementSection />
          ) : (
            <p className="text-sm text-muted-foreground font-light">
              Cambia al perfil principal para gestionar perfiles, dispositivos y PIN.
            </p>
          )}
        </SheetContent>
      </Sheet>

      {/* ————————————— PANEL LATERAL: Contacto ————————————— */}
      <Sheet open={panel === "contact"} onOpenChange={(o) => !o && setPanel(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto bg-background border-l border-foreground/10">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-2xl font-thin tracking-tight">Contáctanos</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-1 gap-2">
            {contacts.map((c) => (
              <a
                key={c.id}
                href={c.url}
                target="_blank"
                rel="noopener"
                className="group flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-foreground/5 transition-all"
              >
                <div className="w-9 h-9 rounded-full bg-foreground/5 flex items-center justify-center flex-shrink-0">
                  {c.icon_url ? (
                    <img src={c.icon_url} alt="" className="w-5 h-5 rounded" />
                  ) : (
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color || "hsl(var(--primary))" }} />
                  )}
                </div>
                <span className="text-sm font-light text-foreground flex-1">{c.name}</span>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-primary transition" />
              </a>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {showPremiumModal && <PremiumScreen onClose={() => setShowPremiumModal(false)} />}
      {showOwnProfileEditor && activeProfile && (
        <ProfileSelector
          manageMode
          editableProfileId={activeProfile.id}
          onClose={() => {
            setShowOwnProfileEditor(false);
            refreshProfiles();
          }}
        />
      )}
    </div>
  );
}
