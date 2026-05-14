import { createHash } from "crypto";
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

export function hasForbiddenWord(input: string) {
  const configured = process.env.FORBIDDEN_WORDS ?? "금칙어,blocked-token";
  const words = configured
    .split(",")
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean);
  const lowered = input.toLowerCase();
  return words.some((word) => lowered.includes(word));
}

export function sanitizeTitle(title: string) {
  return title
    .trim()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-zA-Z0-9가-힣_-]/g, "_")
    .slice(0, 48);
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
      message: "Build Timeout: 동일 IP/해시는 3분 뒤 다시 Commit 할 수 있습니다."
    };
  }

  return { ok: true, message: "" };
}
