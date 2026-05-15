import { NextRequest, NextResponse } from "next/server";
import { assertAdmin, getErrorMessage, getSupabaseAdmin, hashIp, sanitizeTitle, writeAdminEvent } from "@/lib/server";

export async function POST(request: NextRequest) {
  if (!assertAdmin(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const title = sanitizeTitle(String(payload.title ?? "notice"));
    const body = String(payload.body ?? "").trim().slice(0, 5000);
    const ipHash = hashIp(request);

    if (!title || !body) {
      return NextResponse.json({ message: "Notice title/body required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("posts")
      .insert({
        board: "notice",
        title,
        body,
        file_ext: "md",
        author_hash: "admin",
        ip_hash: ipHash
      })
      .select("id, board, title, body, file_ext, author_hash, ip_hash, report_count, star_count, is_deleted, is_hidden, created_at")
      .single();

    if (error) throw error;
    await writeAdminEvent({
      eventType: "admin_notice_created",
      message: `Notice created: ${title}.md`,
      postId: data.id,
      authorHash: "admin",
      ipHash
    });
    return NextResponse.json({ post: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: `Notice commit failed (${getErrorMessage(error)})` },
      { status: 500 }
    );
  }
}
