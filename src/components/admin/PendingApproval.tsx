import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRecentlyUpdated, getRecentReleasedMovies, getMovies, getUpcomingMovies } from "@/lib/anilist";
import { getApprovedAnimeIds, approveAnime, unapproveAnime, onApprovedChange } from "@/lib/approved-animes";
import { saveCachedVideo, getCachedVideo } from "@/lib/video-cache";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Check, X, Link2, Search, ShieldCheck, Play, Settings2, Save, GitBranch } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import LazyImage from "@/components/LazyImage";
import { logAdminActivity } from "@/lib/admin-log";
import { getPrequelChain, getAnimeIdsWithSeekeMaster, type PrequelNode } from "@/lib/anime-prequels";


type AiringItem = {
  id: number;
  title: { romaji?: string; english?: string | null };
  coverImage?: { large?: string; extraLarge?: string };
  status: string;
  episodes?: number | null;
  averageScore?: number | null;
};

function titleOf(a: AiringItem) {
  return a.title?.english || a.title?.romaji || `Anime #${a.id}`;
}

function slugFromTitle(t: string) {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

export default function PendingApproval() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [showApproved, setShowApproved] = useState(false);

  // 3 páginas de RELEASING para tener suficiente pool
  const { data: p1, isLoading: l1 } = useQuery({
    queryKey: ["airing-page", 1],
    queryFn: () => getRecentlyUpdated(1, 50),
    staleTime: 1000 * 60 * 15,
  });
  const { data: p2, isLoading: l2 } = useQuery({
    queryKey: ["airing-page", 2],
    queryFn: () => getRecentlyUpdated(2, 50),
    staleTime: 1000 * 60 * 15,
  });
  const { data: p3, isLoading: l3 } = useQuery({
    queryKey: ["airing-page", 3],
    queryFn: () => getRecentlyUpdated(3, 50),
    staleTime: 1000 * 60 * 15,
  });

  // Películas recientemente estrenadas (AniList) — también entran a pendientes
  // para que el admin las revise cuando ya "salieron".
  const { data: movies, isLoading: lm } = useQuery({
    queryKey: ["recent-released-movies", 1],
    queryFn: () => getRecentReleasedMovies(1, 30),
    staleTime: 1000 * 60 * 30,
  });

  // También traemos las películas que se muestran en Directorio (populares + próximas)
  // para que TODA película sin enlace madre Seeke aparezca aquí.
  const { data: dirMovies, isLoading: lm2 } = useQuery({
    queryKey: ["directory-movies-pending", 1],
    queryFn: () => getMovies(1, 30, null),
    staleTime: 1000 * 60 * 30,
  });
  const { data: dirUpcoming, isLoading: lm3 } = useQuery({
    queryKey: ["directory-upcoming-movies-pending", 1],
    queryFn: () => getUpcomingMovies(1, 20),
    staleTime: 1000 * 60 * 60,
  });


  const { data: approvedArr, refetch: refetchApproved } = useQuery({
    queryKey: ["approved-anime-ids"],
    queryFn: async () => Array.from(await getApprovedAnimeIds(true)),
    staleTime: 1000 * 60 * 5,
  });
  const approvedSet = useMemo(() => new Set<number>(approvedArr || []), [approvedArr]);
  

  // ¿Qué animes ya tienen enlace madre Seeke (episode=0)? Este set es el que
  // determina si una temporada puede considerarse "lista" para aprobarse sola.
  const { data: seekeMasterSet, refetch: refetchSeeke } = useQuery({
    queryKey: ["approval-seeke-master-ids"],
    queryFn: async () => getAnimeIdsWithSeekeMaster(),
    staleTime: 1000 * 60 * 2,
  });

  // Cualquier fila en video_cache (para badge "con enlace" general)
  const { data: withVideo } = useQuery({
    queryKey: ["approval-videocache-ids"],
    queryFn: async () => {
      const { data } = await supabase
        .from("video_cache")
        .select("anilist_id")
        .not("anilist_id", "is", null)
        .limit(2000);
      return new Set<number>((data || []).map((r: any) => r.anilist_id as number));
    },
    staleTime: 1000 * 60 * 2,
  });

  const airingItems = useMemo<AiringItem[]>(() => {
    const map = new Map<number, AiringItem>();
    for (const p of [p1, p2, p3, movies, dirMovies, dirUpcoming]) {
      for (const m of (p?.media || []) as AiringItem[]) {
        if (!map.has(m.id)) map.set(m.id, m);
      }
    }
    return Array.from(map.values());
  }, [p1, p2, p3, movies, dirMovies, dirUpcoming]);

  // Cadena de precuelas por cada item (cacheada en IDB dentro del helper).
  const { data: prequelMap } = useQuery({
    queryKey: ["approval-prequel-chains", airingItems.map((a) => a.id).join(",")],
    enabled: airingItems.length > 0,
    queryFn: async () => {
      const out = new Map<number, PrequelNode[]>();
      // Concurrencia limitada para no saturar AniList (5 en paralelo).
      const ids = airingItems.map((a) => a.id);
      const CONC = 5;
      for (let i = 0; i < ids.length; i += CONC) {
        const slice = ids.slice(i, i + CONC);
        const results = await Promise.all(slice.map((id) => getPrequelChain(id).catch(() => [])));
        slice.forEach((id, idx) => out.set(id, results[idx] || []));
      }
      return out;
    },
    staleTime: 1000 * 60 * 30,
  });

  // Inyecta las precuelas SIN enlace madre Seeke como items adicionales de pendientes.
  const all = useMemo<AiringItem[]>(() => {
    if (!prequelMap || !seekeMasterSet) return airingItems;
    const merged = new Map<number, AiringItem>();
    airingItems.forEach((a) => merged.set(a.id, a));
    for (const [, chain] of prequelMap) {
      for (const p of chain) {
        if (seekeMasterSet.has(p.id)) continue;
        if (merged.has(p.id)) continue;
        merged.set(p.id, {
          id: p.id,
          title: { english: p.title, romaji: p.title },
          coverImage: { large: p.cover, extraLarge: p.cover },
          status: p.status || "FINISHED",
          episodes: p.episodes ?? null,
          averageScore: null,
        });
      }
    }
    return Array.from(merged.values());
  }, [airingItems, prequelMap, seekeMasterSet]);

  // Auto-aprobar: si el item TIENE enlace madre Seeke y TODAS sus precuelas
  // también → lo mandamos directo a "aprobados" sin que el admin toque nada.
  const autoApproveRunRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!seekeMasterSet || !prequelMap) return;
    const runOnce = autoApproveRunRef.current;
    (async () => {
      for (const item of airingItems) {
        if (runOnce.has(item.id)) continue;
        if (approvedSet.has(item.id)) continue;
        if (!seekeMasterSet.has(item.id)) continue;
        const chain = prequelMap.get(item.id) || [];
        const allPrequelsReady = chain.every((p) => seekeMasterSet.has(p.id));
        if (!allPrequelsReady) continue;
        runOnce.add(item.id);
        try {
          const res = await approveAnime(item.id);
          if (res.success) {
            await supabase.from("anime_download_tracker").upsert({
              anilist_id: item.id,
              title: titleOf(item),
              cover_image: item.coverImage?.large || null,
              total_episodes: item.episodes || 0,
              status: "completed",
              airing_status: item.status || null,
              updated_at: new Date().toISOString(),
            } as any, { onConflict: "anilist_id" });
            await logAdminActivity({
              area: "videos",
              action: "auto_approve_anime",
              summary: `Auto-aprobado (tenía Seeke + precuelas listas): ${titleOf(item)}`,
              target_type: "anime",
              target_id: String(item.id),
              anilist_id: item.id,
              anime_title: titleOf(item),
            });
          }
        } catch (e) {
          console.warn("[auto-approve] failed", item.id, e);
        }
      }
    })();
  }, [airingItems, seekeMasterSet, prequelMap, approvedSet]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((a) => {
      const isApproved = approvedSet.has(a.id);
      if (showApproved ? !isApproved : isApproved) return false;
      if (!q) return true;
      return titleOf(a).toLowerCase().includes(q) || String(a.id).includes(q);
    });
  }, [all, query, approvedSet, showApproved]);

  useEffect(() => onApprovedChange(() => { refetchApproved(); refetchSeeke(); }), [refetchApproved, refetchSeeke]);

  const loading = l1 || l2 || l3 || lm || lm2 || lm3;

  const pendingCount = all.filter((a) => !approvedSet.has(a.id)).length;
  const approvedCount = all.filter((a) => approvedSet.has(a.id)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-black text-foreground">Pendientes de Aprobación</h2>
            <p className="text-xs text-muted-foreground">
              Los animes en emisión detectados desde AniList aparecen aquí ocultos del Home hasta que
              agregues un enlace Seeke y los apruebes.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowApproved(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              !showApproved ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            Pendientes ({pendingCount})
          </button>
          <button
            onClick={() => setShowApproved(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              showApproved ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            Aprobados ({approvedCount})
          </button>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por título o ID…"
              className="pl-8 h-9 text-xs"
            />
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando animes en emisión…
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {showApproved ? "Aún no has aprobado ningún anime." : "🎉 No hay animes pendientes."}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((a) => (
          <PendingCard
            key={a.id}
            anime={a}
            approved={approvedSet.has(a.id)}
            hasVideo={withVideo?.has(a.id) ?? false}
            onChanged={() => {
              refetchApproved();
              qc.invalidateQueries({ queryKey: ["approved-anime-ids"] });
              qc.invalidateQueries({ queryKey: ["approval-videocache-ids"] });
            }}
          />
        ))}
      </div>
    </div>
  );
}

function PendingCard({
  anime,
  approved,
  hasVideo,
  onChanged,
}: {
  anime: AiringItem;
  approved: boolean;
  hasVideo: boolean;
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const [lang, setLang] = useState<"sub" | "latino">("sub");
  const [seekeUrl, setSeekeUrl] = useState("");
  const [existingUrl, setExistingUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const title = titleOf(anime);
  const cover = anime.coverImage?.large || anime.coverImage?.extraLarge;
  const slug = slugFromTitle(anime.title?.romaji || title);

  // Al cambiar de idioma, precarga el enlace Seeke ya guardado para ese idioma (si existe)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await getCachedVideo(slug, 0, lang, anime.id);
      if (cancelled) return;
      const url = cached?.sources?.seeke?.[0] || null;
      setExistingUrl(url);
      setSeekeUrl(url || "");
    })();
    return () => { cancelled = true; };
  }, [lang, anime.id, slug]);

  const openAdvanced = () => {
    try {
      sessionStorage.setItem("admin:preselect-anime", JSON.stringify({
        id: anime.id,
        title,
        cover: cover || "",
        episodes: anime.episodes || 24,
        lang,
      }));
    } catch {}
    navigate("/admin?tab=videos");
  };

  const persistLink = async (url: string) => {
    if (url && url !== existingUrl) {
      const save = await saveCachedVideo({
        slug,
        episode: 0,
        lang,
        sources: { seeke: [url] },
        anilist_id: anime.id,
        anime_title: title,
      });
      if (!save.success) throw new Error(save.error || "No se pudo guardar el enlace");
      setExistingUrl(url);
    }
  };

  const handleSaveOnly = async () => {
    const url = seekeUrl.trim();
    if (!url) {
      toast.error(`Pega el enlace Seeke (${lang}) antes de guardar`);
      return;
    }
    if (url === existingUrl) {
      toast.info("Ese enlace ya está guardado");
      return;
    }
    setBusy(true);
    try {
      await persistLink(url);
      await logAdminActivity({
        area: "videos",
        action: "save_anime_link",
        summary: `Enlace ${lang} guardado (sin aprobar): ${title}`,
        target_type: "anime",
        target_id: String(anime.id),
        anilist_id: anime.id,
        anime_title: title,
        metadata: { seeke: url, lang, approved: false },
      });
      toast.success(`Enlace ${lang} guardado (pendiente de aprobar)`);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar");
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async () => {
    const url = seekeUrl.trim();
    // Se puede aprobar sin nuevo URL si ya hay uno existente para este idioma
    if (!url && !existingUrl) {
      toast.error(`Pega el enlace Seeke (${lang}) antes de aprobar`);
      return;
    }
    setBusy(true);
    try {
      await persistLink(url);
      if (!approved) {
        const res = await approveAnime(anime.id, url || null as any);
        if (!res.success) throw new Error(res.error || "No se pudo aprobar");
        // Registrar automáticamente en el tracker de descargas como "completed"
        try {
          await supabase.from("anime_download_tracker").upsert({
            anilist_id: anime.id,
            title,
            cover_image: cover || null,
            total_episodes: anime.episodes || 0,
            status: "completed",
            airing_status: anime.status || null,
            updated_at: new Date().toISOString(),
          } as any, { onConflict: "anilist_id" });
        } catch (err) {
          console.warn("[approve] tracker upsert failed", err);
        }
      }
      await logAdminActivity({
        area: "videos",
        action: approved ? "update_anime_link" : "approve_anime",
        summary: approved ? `Enlace ${lang} actualizado: ${title}` : `Aprobado: ${title}`,
        target_type: "anime",
        target_id: String(anime.id),
        anilist_id: anime.id,
        anime_title: title,
        metadata: { seeke: url || null, lang },
      });
      toast.success(approved ? `Enlace ${lang} actualizado` : `Aprobado: ${title}`);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Error al aprobar");
    } finally {
      setBusy(false);
    }
  };

  const handleUnapprove = async () => {
    setBusy(true);
    try {
      const res = await unapproveAnime(anime.id);
      if (!res.success) throw new Error(res.error);
      await logAdminActivity({
        area: "videos",
        action: "unapprove_anime",
        summary: `Aprobación retirada: ${title}`,
        target_type: "anime",
        target_id: String(anime.id),
        anilist_id: anime.id,
        anime_title: title,
      });
      toast.success("Quitado de la whitelist");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden flex">
      <div className="w-24 h-36 shrink-0 bg-secondary">
        {cover && <LazyImage src={cover} alt={title} className="w-full h-full object-cover" />}
      </div>
      <div className="flex-1 min-w-0 p-3 flex flex-col gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground line-clamp-2">{title}</h3>
          <p className="text-[10px] text-muted-foreground">
            ID {anime.id} · {anime.episodes ? `${anime.episodes} eps` : "eps ?"} ·{" "}
            {anime.averageScore ? `${anime.averageScore}%` : "sin score"}
          </p>
          <div className="flex flex-wrap gap-1 mt-1">
            {approved && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-500">
                APROBADO
              </span>
            )}
            {hasVideo && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary flex items-center gap-1">
                <Play className="w-2.5 h-2.5" /> con enlace
              </span>
            )}
            {existingUrl && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                {lang} guardado
              </span>
            )}
          </div>
        </div>

        {/* Switcher de idioma */}
        <div className="flex gap-1">
          {(["sub", "latino"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              disabled={busy}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${
                lang === l ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {l === "sub" ? "🇯🇵 Sub" : "🌎 Latino"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <Input
            value={seekeUrl}
            onChange={(e) => setSeekeUrl(e.target.value)}
            placeholder={`URL Seeke ${lang} (sobrescribe el anterior)`}
            className="h-8 text-[11px]"
            disabled={busy}
          />
        </div>

        <div className="flex gap-2 mt-auto">
          <button
            onClick={handleApprove}
            disabled={busy || (!seekeUrl.trim() && !existingUrl)}
            className="flex-1 h-8 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {approved ? "Actualizar" : "Aprobar"}
          </button>
          {!approved && (
            <button
              onClick={handleSaveOnly}
              disabled={busy || !seekeUrl.trim() || seekeUrl.trim() === existingUrl}
              title="Guarda el enlace del idioma sin aprobar (útil para esperar el segundo idioma)"
              className="h-8 px-2 rounded-lg bg-secondary text-foreground text-xs font-bold flex items-center justify-center gap-1 hover:bg-muted disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              Guardar
            </button>
          )}
          <button
            onClick={openAdvanced}
            disabled={busy}
            title="Abrir en Videos con este anime preseleccionado"
            className="h-8 px-2 rounded-lg bg-secondary text-foreground text-xs font-bold flex items-center justify-center gap-1 hover:bg-muted disabled:opacity-50"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Avanzado
          </button>
          {approved && (
            <button
              onClick={handleUnapprove}
              disabled={busy}
              title="Quitar de la whitelist"
              className="h-8 px-2 rounded-lg bg-secondary text-foreground text-xs font-bold flex items-center justify-center hover:bg-destructive/15 hover:text-destructive disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

