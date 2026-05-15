import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage, getSupabaseAdmin } from "@/lib/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authorHash = new URL(request.url).searchParams.get("authorHash")?.replace(/[^a-z0-9]/gi, "").slice(0, 128);
    const supabase = getSupabaseAdmin();

    const [{ data, error }, commentsResult] = await Promise.all([
      supabase
      .from("posts")
      .select("id, board, title, body, file_ext, author_hash, report_count, star_count, is_deleted, is_hidden, created_at")
      .eq("id", id)
      .single(),
      supabase
        .from("comments")
        .select("id, post_id, parent_id, body, author_hash, created_at")
        .eq("post_id", id)
        .order("created_at", { ascending: true })
    ]);

    if (error) throw error;
    if (commentsResult.error) throw commentsResult.error;

    let hasStarred = false;
    if (authorHash) {
      const { data: star } = await supabase
        .from("stars")
        .select("id")
        .eq("post_id", id)
        .eq("author_hash", authorHash)
        .maybeSingle();
      hasStarred = Boolean(star);
    }

    return NextResponse.json({ post: { ...data, has_starred: hasStarred }, comments: commentsResult.data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { message: `Syntax Error: post query failed (${getErrorMessage(error)})` },
      { status: 500 }
    );
  }
}
