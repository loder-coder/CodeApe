import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase environment variables are missing");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export function hashIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip");
  const ip = forwarded || realIp || "local";
  const salt = process.env.SERVER_HASH_SALT || "dev-only-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export function assertAdmin(request: NextRequest) {
  const expected = process.env.ADMIN_SECRET_KEY;
  const provided = request.headers.get("x-admin-secret") || "";
  return Boolean(expected && provided && provided === expected);
}

export async function hasForbiddenWord(input: string) {
  const words = await getForbiddenWords();
  const lowered = input.toLowerCase();
  return words.some((word) => lowered.includes(word));
}

async function getForbiddenWords() {
  const filePath = process.env.FORBIDDEN_WORDS_FILE || join(process.cwd(), "forbidden-words.txt");
  const configured = existsSync(filePath)
    ? readFileSync(filePath, "utf8")
    : process.env.FORBIDDEN_WORDS || "blocked-token";

  const fileWords = configured
    .split(/[\n,]/)
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean);

  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.from("forbidden_words").select("term").eq("is_active", true);
    return [...fileWords, ...((data ?? []).map((item) => item.term.toLowerCase()))];
  } catch {
    return fileWords;
  }
}

export function sanitizeTitle(title: string) {
  return title
    .trim()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[\\/:*?"<>|.]+/g, "_")
    .slice(0, 48);
}

export async function isBlockedIdentity(authorHash: string, ipHash: string) {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("blocked_identities")
      .select("id")
      .or(`value.eq.${authorHash},value.eq.${ipHash}`)
      .limit(1);

    if (error) throw error;
    return Boolean(data?.length);
  } catch {
    return false;
  }
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return "unknown server error";
}

export async function writeAdminEvent(params: {
  eventType: string;
  message: string;
  postId?: string | null;
  authorHash?: string | null;
  ipHash?: string | null;
}) {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("admin_events").insert({
      event_type: params.eventType,
      message: params.message,
      post_id: params.postId ?? null,
      author_hash: params.authorHash ?? null,
      ip_hash: params.ipHash ?? null
    });
  } catch {
    // Logging should never block the user-facing flow.
  }
}

export async function assertCooldown(params: {
  table: "posts" | "comments";
  authorHash: string;
  ipHash: string;
}) {
  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from(params.table)
    .select("id, created_at")
    .or(`author_hash.eq.${params.authorHash},ip_hash.eq.${params.ipHash}`)
    .gte("created_at", since)
    .limit(1);

  if (error) throw error;
  if (data && data.length > 0) {
    return {
      ok: false,
      message: "Build Timeout: same IP/hash can Commit again after 3 minutes."
    };
  }

  return { ok: true, message: "" };
}
