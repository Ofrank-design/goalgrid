import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { log } from "@/lib/logging/logger";

export const NOTIFICATION_TYPES = ["prediction","match","simulation","challenge","community","follow","like","comment","system","security"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

type Input = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  href?: string | null;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
  dedupeKey?: string | null;
};

/** Security notifications are always retained in-app. Other categories obey the user's in-app preference. */
export async function createNotification(input: Input) {
  const db = supabaseAdmin();
  const { data: prefRow } = await db
    .from("notification_preferences")
    .select("*")
    .eq("user_id", input.userId)
    .maybeSingle();
  const prefs = prefRow as Record<string, unknown> | null;

  if (input.type !== "security" && (prefs?.in_app === false || prefs?.[input.type] === false)) return null;

  const payload = {
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    href: input.href ?? null,
    actor_id: input.actorId ?? null,
    metadata: input.metadata ?? {},
    ...(input.dedupeKey ? { dedupe_key: input.dedupeKey } : {}),
  };

  if (input.dedupeKey) {
    const { data, error } = await db
      .from("notifications")
      .upsert(payload, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true })
      .select("id")
      .maybeSingle();
    if (data?.id) return data.id as string;
    if (error && !/duplicate|unique/i.test(error.message)) { log.warn("notification upsert failed", { type: input.type, message: error.message }); return null; }
    const { data: existing } = await db.from("notifications").select("id").eq("user_id", input.userId).eq("dedupe_key", input.dedupeKey).maybeSingle();
    return (existing?.id as string | null) ?? null;
  }

  const { data, error } = await db.from("notifications").insert(payload).select("id").single();
  if (error) { log.warn("notification insert failed", { type: input.type, message: error.message }); return null; }
  return data?.id as string | null;
}

export async function createNotifications(inputs: Input[]) {
  const out: string[] = [];
  for (const input of inputs) {
    const id = await createNotification(input);
    if (id) out.push(id);
  }
  return out;
}

export async function ensurePreferences(userId: string) {
  const db = supabaseAdmin();
  await db.from("notification_preferences").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  const { data } = await db.from("notification_preferences").select("*").eq("user_id", userId).maybeSingle();
  return data;
}
