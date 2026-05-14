import { NextRequest, NextResponse } from "next/server";
import { assertAdmin, getSupabaseAdmin } from "@/lib/server";

export async function GET(request: NextRequest) {
  if (!assertAdmin(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const [posts, events, blocks, words, commentsCount, reportsCount, dbSize] = await Promise.all([
      supabase
        .from("posts")
        .select("id, board, title, body, file_ext, author_hash, ip_hash, report_count, is_deleted, is_hidden, created_at")
        .order("created_at", { ascending: false })
        .limit(120),
      supabase.from("admin_events").select("*").order("created_at", { ascending: false }).limit(80),
      supabase.from("blocked_identities").select("*").order("created_at", { ascending: false }),
      supabase.from("forbidden_words").select("*").order("created_at", { ascending: false }),
      supabase.from("comments").select("id", { count: "exact", head: true }),
      supabase.from("reports").select("id", { count: "exact", head: true }),
      supabase.rpc("get_database_size")
    ]);

    if (posts.error) throw posts.error;
    if (events.error) throw events.error;
    if (blocks.error) throw blocks.error;
    if (words.error) throw words.error;
    if (commentsCount.error) throw commentsCount.error;
    if (reportsCount.error) throw reportsCount.error;

    return NextResponse.json({
      posts: posts.data ?? [],
      events: events.data ?? [],
      blocks: blocks.data ?? [],
      words: words.data ?? [],
      status: {
        posts: posts.data?.length ?? 0,
        comments: commentsCount.count ?? 0,
        reports: reportsCount.count ?? 0,
        runtime: process.env.VERCEL ? "vercel" : "local",
        db: dbSize.error ? "supabase connected" : `supabase ${dbSize.data}`
      }
    });
  } catch {
    return NextResponse.json({ message: "Admin query failed" }, { status: 500 });
  }
}
