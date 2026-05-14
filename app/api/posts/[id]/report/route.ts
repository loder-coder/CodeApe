import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, hashIp, isBlockedIdentity, writeAdminEvent } from "@/lib/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const payload = await request.json();
    const reporterHash = String(payload.reporterHash ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 128);
    const ipHash = hashIp(request);

    if (!reporterHash) {
      return NextResponse.json({ message: "Syntax Error: fingerprint required" }, { status: 400 });
    }

    if (await isBlockedIdentity(reporterHash, ipHash)) {
      return NextResponse.json({ message: "Syntax Error: blocked identity" }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { error: insertError } = await supabase
      .from("reports")
      .insert({ post_id: id, reporter_hash: reporterHash, ip_hash: ipHash });

    if (insertError && insertError.code !== "23505") {
      throw insertError;
    }

    const { count, error: countError } = await supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("post_id", id);

    if (countError) throw countError;

    const nextCount = count ?? 0;
    const { data, error: updateError } = await supabase
      .from("posts")
      .update({ report_count: nextCount, is_deleted: nextCount >= 5 })
      .eq("id", id)
      .select("id, board, title, body, file_ext, author_hash, report_count, is_deleted, is_hidden, created_at")
      .single();

    if (updateError) throw updateError;
    await writeAdminEvent({
      eventType: "post_reported",
      message: `Debug report logged: ${nextCount}/5`,
      postId: id,
      authorHash: reporterHash,
      ipHash
    });

    return NextResponse.json({
      message:
        insertError?.code === "23505"
          ? `Debug ignored: already reported (${nextCount}/5)`
          : `Debug logged: ${nextCount}/5`,
      post: data
    });
  } catch {
    return NextResponse.json({ message: "Syntax Error: debug failed" }, { status: 500 });
  }
}
