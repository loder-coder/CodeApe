import { NextRequest, NextResponse } from "next/server";
import { assertCooldown, getSupabaseAdmin, hashIp, hasForbiddenWord, sanitizeTitle } from "@/lib/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const board = searchParams.get("board") ?? "general";
    const q = searchParams
      .get("q")
      ?.replace(/[%,()]/g, " ")
      .trim()
      .slice(0, 80);

    let query = supabase
      .from("posts")
      .select("id, board, title, body, file_ext, author_hash, report_count, is_deleted, created_at")
      .eq("board", board)
      .order("created_at", { ascending: false })
      .limit(80);

    if (q) {
      query = query.or(`title.ilike.%${q}%,body.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ posts: data ?? [] });
  } catch (error) {
    return NextResponse.json({ message: "Syntax Error: workspace query failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const title = sanitizeTitle(String(payload.title ?? ""));
    const body = String(payload.body ?? "").trim().slice(0, 5000);
    const board = String(payload.board ?? "general").slice(0, 32);
    const fileExt = String(payload.fileExt ?? "js").replace(/[^a-z0-9]/gi, "").slice(0, 6) || "js";
    const authorHash = String(payload.authorHash ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 128);
    const ipHash = hashIp(request);

    if (!title || !body || !authorHash) {
      return NextResponse.json({ message: "Syntax Error: title/body/fingerprint required" }, { status: 400 });
    }

    if (hasForbiddenWord(`${title}\n${body}`)) {
      return NextResponse.json({ message: "Syntax Error: forbidden token detected" }, { status: 400 });
    }

    const cooldown = await assertCooldown({ table: "posts", authorHash, ipHash });
    if (!cooldown.ok) {
      return NextResponse.json({ message: cooldown.message }, { status: 429 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("posts")
      .insert({ board, title, body, file_ext: fileExt, author_hash: authorHash, ip_hash: ipHash })
      .select("id, board, title, body, file_ext, author_hash, report_count, is_deleted, created_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ message: "Commit accepted", post: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "Syntax Error: commit failed" }, { status: 500 });
  }
}
