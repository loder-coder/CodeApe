import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage, getSupabaseAdmin } from "@/lib/server";

export async function GET(request: NextRequest) {
  try {
    const authorHash = new URL(request.url).searchParams.get("authorHash")?.replace(/[^a-z0-9]/gi, "").slice(0, 128);

    if (!authorHash) {
      return NextResponse.json({ posts: [] });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("posts")
      .select("id, board, title, body, file_ext, author_hash, report_count, star_count, is_deleted, created_at")
      .eq("author_hash", authorHash)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    return NextResponse.json({ posts: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { message: `Syntax Error: my page query failed (${getErrorMessage(error)})` },
      { status: 500 }
    );
  }
}
