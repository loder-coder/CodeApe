import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage, getSupabaseAdmin, hashIp, writeAdminEvent } from "@/lib/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const payload = await request.json();
    const authorHash = String(payload.authorHash ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 128);
    const ipHash = hashIp(request);

    if (!authorHash) {
      return NextResponse.json({ message: "Syntax Error: fingerprint required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error: insertError } = await supabase.from("stars").insert({
      post_id: id,
      author_hash: authorHash,
      ip_hash: ipHash
    });

    if (insertError && insertError.code !== "23505") throw insertError;

    if (!insertError) {
      const { count, error: countError } = await supabase
        .from("stars")
        .select("id", { count: "exact", head: true })
        .eq("post_id", id);

      if (countError) throw countError;

      const { data, error: updateError } = await supabase
        .from("posts")
        .update({ star_count: count ?? 0 })
        .eq("id", id)
        .select("id, board, title, body, file_ext, author_hash, report_count, star_count, is_deleted, is_hidden, created_at")
        .single();

      if (updateError) throw updateError;
      await writeAdminEvent({
        eventType: "post_starred",
        message: `Star added: ${data.title}.${data.file_ext} (${data.star_count})`,
        postId: id,
        authorHash,
        ipHash
      });
      return NextResponse.json({ message: "Star added", post: { ...data, has_starred: true } });
    }

    const { data, error } = await supabase
      .from("posts")
      .select("id, board, title, body, file_ext, author_hash, report_count, star_count, is_deleted, is_hidden, created_at")
      .eq("id", id)
      .single();

    if (error) throw error;
    return NextResponse.json({ message: "Star ignored: already starred", post: { ...data, has_starred: true } });
  } catch (error) {
    return NextResponse.json(
      { message: `Syntax Error: star failed (${getErrorMessage(error)})` },
      { status: 500 }
    );
  }
}
