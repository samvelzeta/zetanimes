// PDF export of user's anime history & stats - premium feature
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import logoUrl from "@/assets/zetanime-apk-logo.png";

interface AnimeListEntry {
  anime_id: number;
  anime_title: string | null;
  anime_cover: string | null;
  list_type: string;
  created_at: string;
}

interface ExportOptions {
  username: string;
  displayName: string;
  accentHex: string; // e.g. "#FF4500"
  profileId?: string | null;
  profileName?: string;
}

const LIST_LABELS: Record<string, string> = {
  favorite: "Favoritos",
  watching: "Viendo",
  completed: "Completados",
  plan_to_watch: "Plan de Ver",
  undecided: "Indecisos",
};

const LIST_ORDER = ["favorite", "watching", "completed", "plan_to_watch", "undecided"];

// Convert hex to RGB tuple
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r, g, b];
}

// Load image as base64 for embedding in PDF
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportUserHistoryToPDF(userId: string, opts: ExportOptions): Promise<void> {
  const [accentR, accentG, accentB] = hexToRgb(opts.accentHex);

  // Fetch all data in parallel - filtra por perfil activo (o por NULL si no hay)
  const profileId = opts.profileId ?? null;
  const scoped = <Q extends { eq: any; is: any }>(q: Q) =>
    profileId ? q.eq("profile_id", profileId) : q.is("profile_id", null);

  const listsQuery = scoped(
    supabase.from("anime_lists").select("*").eq("user_id", userId) as any
  ).order("created_at", { ascending: false });

  const historyQuery = scoped(
    supabase
      .from("watch_history")
      .select("anime_id, anime_title, episode_number, watch_duration_seconds, completed, created_at")
      .eq("user_id", userId) as any
  );

  const [listsRes, historyRes] = await Promise.all([listsQuery, historyQuery]);

  const lists = (listsRes.data || []) as AnimeListEntry[];
  const history = historyRes.data || [];

  // Stats
  const totalSeconds = history.reduce((acc, h) => acc + (h.watch_duration_seconds || 0), 0);
  const totalHours = Math.round((totalSeconds / 3600) * 10) / 10;
  const totalEpisodes = history.filter((h) => h.completed).length;
  const totalAnimes = new Set(history.map((h) => h.anime_id)).size;
  const totalLists = lists.length;

  // Init PDF
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // ===== COVER PAGE =====
  // Background gradient strip
  doc.setFillColor(accentR, accentG, accentB);
  doc.rect(0, 0, pageW, 60, "F");
  // Dark overlay strip
  doc.setFillColor(15, 15, 18);
  doc.rect(0, 60, pageW, pageH - 60, "F");

  // Logo
  const logoBase64 = await loadImageAsBase64(logoUrl);
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "PNG", pageW / 2 - 20, 10, 40, 40);
    } catch {}
  }

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("ZetAnime", pageW / 2, 75, { align: "center" });
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 200, 200);
  doc.text("Tu Historial Personal", pageW / 2, 84, { align: "center" });

  // User name
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(accentR, accentG, accentB);
  doc.text(opts.displayName, pageW / 2, 100, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 180, 180);
  doc.text(`@${opts.username}`, pageW / 2, 107, { align: "center" });

  // Date
  const today = new Date().toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generado el ${today}`, pageW / 2, 115, { align: "center" });

  // Stats cards
  const cardY = 135;
  const cardW = 38;
  const cardH = 35;
  const gap = 6;
  const totalW = cardW * 4 + gap * 3;
  const startX = (pageW - totalW) / 2;

  const stats = [
    { value: totalLists.toString(), label: "En Listas" },
    { value: totalEpisodes.toString(), label: "Episodios" },
    { value: totalHours.toString(), label: "Horas" },
    { value: totalAnimes.toString(), label: "Animes" },
  ];

  stats.forEach((s, i) => {
    const x = startX + i * (cardW + gap);
    // Card bg
    doc.setFillColor(28, 28, 32);
    doc.roundedRect(x, cardY, cardW, cardH, 3, 3, "F");
    // Top border accent
    doc.setFillColor(accentR, accentG, accentB);
    doc.roundedRect(x, cardY, cardW, 2, 1, 1, "F");
    // Value
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(s.value, x + cardW / 2, cardY + 16, { align: "center" });
    // Label
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(160, 160, 160);
    doc.text(s.label, x + cardW / 2, cardY + 24, { align: "center" });
  });

  // Footer cover
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("zetanimes.lovable.app", pageW / 2, pageH - 12, { align: "center" });

  // ===== LISTS PAGES =====
  for (const listType of LIST_ORDER) {
    const items = lists.filter((l) => l.list_type === listType);
    if (items.length === 0) continue;

    doc.addPage();
    // Header bar
    doc.setFillColor(accentR, accentG, accentB);
    doc.rect(0, 0, pageW, 18, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(LIST_LABELS[listType] || listType, 14, 12);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`${items.length} ${items.length === 1 ? "anime" : "animes"}`, pageW - 14, 12, { align: "right" });

    // Table
    autoTable(doc, {
      startY: 24,
      head: [["#", "Título", "Agregado"]],
      body: items.map((it, idx) => [
        (idx + 1).toString(),
        it.anime_title || `Anime #${it.anime_id}`,
        new Date(it.created_at).toLocaleDateString("es-ES"),
      ]),
      theme: "grid",
      headStyles: {
        fillColor: [accentR, accentG, accentB],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [40, 40, 40],
      },
      alternateRowStyles: {
        fillColor: [248, 248, 250],
      },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: "auto" },
        2: { cellWidth: 32, halign: "right" },
      },
      margin: { left: 14, right: 14 },
    });
  }

  // ===== STATS PAGE =====
  doc.addPage();
  doc.setFillColor(accentR, accentG, accentB);
  doc.rect(0, 0, pageW, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Estadísticas Detalladas", 14, 12);

  // Big stats
  const bigStatsY = 32;
  const bigCards = [
    { value: totalHours.toString(), label: "Horas vistas", suffix: "h" },
    { value: totalEpisodes.toString(), label: "Episodios completados", suffix: "" },
    { value: totalAnimes.toString(), label: "Animes en historial", suffix: "" },
    { value: totalLists.toString(), label: "Animes en tus listas", suffix: "" },
  ];

  bigCards.forEach((s, i) => {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const x = 14 + col * 92;
    const y = bigStatsY + row * 38;
    doc.setFillColor(28, 28, 32);
    doc.roundedRect(x, y, 86, 32, 3, 3, "F");
    doc.setFillColor(accentR, accentG, accentB);
    doc.roundedRect(x, y, 3, 32, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(`${s.value}${s.suffix}`, x + 8, y + 15);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(180, 180, 180);
    doc.text(s.label, x + 8, y + 24);
  });

  // Distribution by list
  const distY = bigStatsY + 90;
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Distribución por lista", 14, distY);

  const distData = LIST_ORDER.map((lt) => {
    const count = lists.filter((l) => l.list_type === lt).length;
    return [LIST_LABELS[lt] || lt, count.toString(), totalLists > 0 ? `${Math.round((count / totalLists) * 100)}%` : "0%"];
  });

  autoTable(doc, {
    startY: distY + 4,
    head: [["Lista", "Cantidad", "Porcentaje"]],
    body: distData,
    theme: "grid",
    headStyles: {
      fillColor: [accentR, accentG, accentB],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
    margin: { left: 14, right: 14 },
  });

  // Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `ZetAnime Premium · Página ${p} de ${pageCount}`,
      pageW / 2,
      pageH - 6,
      { align: "center" }
    );
  }

  // Download
  const safeName = opts.username.replace(/[^a-z0-9]/gi, "_");
  doc.save(`zetanime-historial-${safeName}.pdf`);
}
