// Sistema de tickets de soporte (VIP premium + free).
import { supabase } from "@/integrations/supabase/client";
import { compressProof } from "@/lib/image-compress";

export type TicketStatus = "pending" | "in_progress" | "answered" | "solved" | "closed";
export type TicketPriority = "vip" | "standard";

export interface SupportTicket {
  id: string;
  user_id: string;
  plan_slug: string | null;
  priority: TicketPriority;
  subject: string | null;
  message: string;
  image_url: string | null;
  status: TicketStatus;
  admin_response: string | null;
  admin_id: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

// Permitir: letras (con acentos/ñ), números, espacios, saltos de línea y símbolos comunes del teclado español.
// Bloquea emojis y unicode raro.
const ALLOWED_REGEX = /^[\p{L}\p{N}\s#$%&/()=?¡!*+\-_,.:;@"'¿«»¨\\|<>{}\[\]°ºª·€£¥•\n\r\t]*$/u;

export function validateSupportText(text: string): { ok: boolean; reason?: string } {
  if (!text.trim()) return { ok: false, reason: "El mensaje no puede estar vacío" };
  if (!ALLOWED_REGEX.test(text)) {
    return { ok: false, reason: "Solo se permiten letras, números y símbolos comunes (#$%&/()=?¡!*+-_,.:;)" };
  }
  return { ok: true };
}

export async function uploadSupportImage(userId: string, file: File): Promise<string> {
  const compressed = await compressProof(file);
  const path = `${userId}/${Date.now()}.webp`;
  const { error } = await supabase.storage
    .from("support-attachments")
    .upload(path, compressed, { upsert: false, contentType: "image/webp" });
  if (error) throw error;
  return path;
}

export async function getSupportImageSignedUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("support-attachments").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

interface CreateInput {
  userId: string;
  message: string;
  subject?: string;
  imageFile?: File | null;
  priority: TicketPriority;
  planSlug: string | null;
}

export async function createTicket(input: CreateInput): Promise<SupportTicket> {
  const maxLen = input.priority === "vip" ? 1000 : 200;
  if (input.message.length > maxLen) {
    throw new Error(`Máximo ${maxLen} caracteres`);
  }
  const v = validateSupportText(input.message);
  if (!v.ok) throw new Error(v.reason);

  let image_url: string | null = null;
  if (input.priority === "vip" && input.imageFile) {
    image_url = await uploadSupportImage(input.userId, input.imageFile);
  }

  const { data, error } = await supabase
    .from("support_tickets" as any)
    .insert({
      user_id: input.userId,
      message: input.message,
      subject: input.subject ?? null,
      image_url,
      priority: input.priority,
      plan_slug: input.planSlug,
    } as any)
    .select()
    .single();
  if (error) throw error;
  return data as any;
}

export async function listMyTickets(userId: string): Promise<SupportTicket[]> {
  const { data } = await supabase
    .from("support_tickets" as any)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data as any[]) || [];
}

export async function listAllTickets(): Promise<SupportTicket[]> {
  const { data } = await supabase
    .from("support_tickets" as any)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  return (data as any[]) || [];
}

export async function updateTicketStatus(id: string, status: TicketStatus): Promise<void> {
  await supabase.from("support_tickets" as any).update({ status } as any).eq("id", id);
}

export async function respondTicket(id: string, adminId: string, response: string, status: TicketStatus = "answered"): Promise<void> {
  await supabase
    .from("support_tickets" as any)
    .update({
      admin_response: response,
      admin_id: adminId,
      responded_at: new Date().toISOString(),
      status,
    } as any)
    .eq("id", id);
}

export async function deleteTicket(id: string, imagePath?: string | null): Promise<void> {
  if (imagePath) {
    try { await supabase.storage.from("support-attachments").remove([imagePath]); } catch {}
  }
  await supabase.from("support_tickets" as any).delete().eq("id", id);
}
