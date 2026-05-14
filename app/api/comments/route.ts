import { NextRequest, NextResponse } from "next/server";
import { assertCooldown, getSupabaseAdmin, hashIp, hasForbiddenWord } from "@/lib/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const postId = new URL(request.url).searchParams.get("postId");

    if (!postId) {
      return NextResponse.json({ comments: [] });
    }

    const { data, error } = await supabase
      .from("comments")
      .select("id, post_id, body, author_hash, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ comments: data ?? [] });
  } catch {
    return NextResponse.json({ message: "Syntax Error: comment query failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const postId = String(payload.postId ?? "");
    const body = String(payload.body ?? "").trim().slice(0, 1200);
    const authorHash = String(payload.authorHash ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 128);
    const ipHash = hashIp(request);

    if (!postId || !body || !authorHash) {
      return NextResponse.json({ message: "Syntax Error: comment/fingerprint required" }, { status: 400 });
    }

    if (hasForbiddenWord(body)) {
      return NextResponse.json({ message: "Syntax Error: forbidden token detected" }, { status: 400 });
    }

    const cooldown = await assertCooldown({ table: "comments", authorHash, ipHash });
    if (!cooldown.ok) {
      return NextResponse.json({ message: cooldown.message }, { status: 429 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("comments")
      .insert({ post_id: postId, body, author_hash: authorHash, ip_hash: ipHash })
      .select("id, post_id, body, author_hash, created_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ message: "Comment committed", comment: data }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Syntax Error: comment commit failed" }, { status: 500 });
  }
}
