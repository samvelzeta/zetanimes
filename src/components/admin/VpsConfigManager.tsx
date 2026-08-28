import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Save, Server, Activity, CheckCircle2, XCircle } from "lucide-react";
import { logAdminActivity } from "@/lib/admin-log";

const SETTING_KEY = "vps_extractor_url";

type ProbeState = { status: "idle" | "testing" | "ok" | "fail"; detail?: string };

export default function VpsConfigManager() {
  const [url, setUrl] = useState("");
  const [initial, setInitial] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [probe, setProbe] = useState<ProbeState>({ status: "idle" });

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", SETTING_KEY)
        .maybeSingle();
      if (error) console.warn("[vps-config] load", error);
      const v = ((data as any)?.value as string) || "";
      setUrl(v);
      setInitial(v);
      setLoading(false);
    })();
  }, []);

  const normalized = url.trim().replace(/\/+$/, "");
  const valid = /^https?:\/\/[^\s]+$/i.test(normalized);
  const dirty = normalized !== initial.trim().replace(/\/+$/, "");

  async function handleSave() {
    if (!valid) {
      toast.error("La URL debe empezar por http:// o https://");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert(
          {
            key: SETTING_KEY,
            value: normalized,
            description: "URL base del extractor VPS usado por resolve-stream",
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "key" },
        );
      if (error) throw error;
      setInitial(normalized);
      toast.success("URL de la VPS actualizada");
      await logAdminActivity({
        area: "sistema",
        action: "update_vps_url",
        summary: `URL de VPS actualizada a ${normalized}`,
        target_type: "setting",
        target_id: SETTING_KEY,
      });
    } catch (e: any) {
      toast.error(`No se pudo guardar: ${e?.message || "error"}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleProbe() {
    if (!valid) {
      toast.error("Escribe primero una URL válida");
      return;
    }
    setProbe({ status: "testing" });
    const target = normalized.endsWith("/extraer") ? normalized : `${normalized}/extraer`;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(target, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com", ep: 1, latest_only: true }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.status >= 500) {
        setProbe({ status: "fail", detail: `El servidor respondió ${res.status}. El extractor no está corriendo.` });
      } else {
        setProbe({ status: "ok", detail: `Respondió ${res.status}. El túnel y el extractor están activos.` });
      }
    } catch (e: any) {
      setProbe({
        status: "fail",
        detail:
          e?.name === "AbortError"
            ? "Tiempo de espera agotado (12s). La VPS no respondió."
            : "No se pudo conectar (DNS caído, CORS o servicio apagado).",
      });
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Server className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-black text-foreground">Servidor VPS extractor</h2>
            <p className="text-xs text-muted-foreground">
              Dirección base del extractor que resuelve los episodios Seeke. Cuando tu túnel cambie de
              dominio, actualízalo aquí — el reproductor lo tomará al instante sin tocar código.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-6">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando configuración…
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                URL base de la VPS
              </label>
              <Input
                value={url}
                onChange={(e) => { setUrl(e.target.value); setProbe({ status: "idle" }); }}
                placeholder="https://tu-tunel.ejemplo.link"
                className="font-mono text-xs h-10"
                spellCheck={false}
              />
              <p className="text-[10px] text-muted-foreground">
                No incluyas <code className="text-primary">/extraer</code> — se añade automáticamente.
                {normalized && valid && (
                  <> Endpoint final: <span className="text-foreground font-mono">{normalized.endsWith("/extraer") ? normalized : `${normalized}/extraer`}</span></>
                )}
              </p>
              {!valid && url.trim().length > 0 && (
                <p className="text-[10px] text-destructive">La URL debe empezar por http:// o https://</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleSave}
                disabled={saving || !valid || !dirty}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground flex items-center gap-2 disabled:opacity-40 hover:opacity-90 transition"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {saving ? "Guardando…" : "Guardar URL"}
              </button>
              <button
                onClick={handleProbe}
                disabled={probe.status === "testing" || !valid}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-secondary text-foreground border border-border flex items-center gap-2 disabled:opacity-40 hover:bg-secondary/80 transition"
              >
                {probe.status === "testing" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                {probe.status === "testing" ? "Probando…" : "Probar conexión"}
              </button>
              {dirty && <span className="text-[10px] text-yellow-400 font-bold">Cambios sin guardar</span>}
            </div>

            {probe.status === "ok" && (
              <div className="flex items-start gap-2 rounded-xl border border-green-500/30 bg-green-500/10 p-3">
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                <p className="text-xs text-foreground">{probe.detail}</p>
              </div>
            )}
            {probe.status === "fail" && (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3">
                <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div className="text-xs text-foreground">
                  <p>{probe.detail}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Nota: la prueba se hace desde tu navegador, así que un bloqueo de CORS puede dar
                    falso negativo. Si el reproductor funciona, ignora este aviso.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-bold text-foreground mb-2">Cómo funciona</h3>
        <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
          <li>El reproductor pide el episodio al backend, nunca directamente a la VPS.</li>
          <li>El backend busca el enlace madre Seeke del anime en la base de datos.</li>
          <li>Envía ese enlace a <code className="text-primary">{"{VPS}/extraer"}</code> y recibe el embed final.</li>
          <li>La URL configurada aquí se relee cada minuto, así que el cambio aplica casi al instante.</li>
        </ol>
      </div>
    </div>
  );
}
