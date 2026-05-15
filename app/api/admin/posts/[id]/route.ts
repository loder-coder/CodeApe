import { NextRequest, NextResponse } from "next/server";
import { assertAdmin, getSupabaseAdmin, writeAdminEvent } from "@/lib/server";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!assertAdmin(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const payload = await request.json();
    const action = String(payload.action ?? "soft-delete");
    const supabase = getSupabaseAdmin();

    const patch =
      action === "hide"
        ? { is_hidden: true }
        : action === "restore"
          ? { is_deleted: false, is_hidden: false }
          : { is_deleted: true };

    const { data, error } = await supabase
      .from("posts")
      .update(patch)
      .eq("id", id)
      .select("id, board, title, body, file_ext, author_hash, ip_hash, report_count, star_count, is_deleted, is_hidden, created_at")
      .single();

    if (error) throw error;
    await writeAdminEvent({
      eventType: `admin_${action}`,
      message: `Admin action "${action}" applied to ${data.title}.${data.file_ext}`,
      postId: id,
      authorHash: data.author_hash,
      ipHash: data.ip_hash
    });

    return NextResponse.json({ post: data });
  } catch {
    return NextResponse.json({ message: "Admin post mutation failed" }, { status: 500 });
  }
}
