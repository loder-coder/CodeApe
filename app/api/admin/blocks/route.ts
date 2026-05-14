import { NextRequest, NextResponse } from "next/server";
import { assertAdmin, getSupabaseAdmin, writeAdminEvent } from "@/lib/server";

export async function POST(request: NextRequest) {
  if (!assertAdmin(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const kind = payload.kind === "ip_hash" ? "ip_hash" : "author_hash";
    const value = String(payload.value ?? "").trim();
    const reason = String(payload.reason ?? "manual block").trim();

    if (!value) {
      return NextResponse.json({ message: "Block value required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("blocked_identities")
      .upsert({ kind, value, reason }, { onConflict: "value" })
      .select("*")
      .single();

    if (error) throw error;
    await writeAdminEvent({
      eventType: "admin_block",
      message: `Blocked ${kind}: ${value.slice(0, 12)}`
    });

    return NextResponse.json({ block: data });
  } catch {
    return NextResponse.json({ message: "Block mutation failed" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!assertAdmin(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const id = String(payload.id ?? "");
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("blocked_identities").delete().eq("id", id);

    if (error) throw error;
    await writeAdminEvent({ eventType: "admin_unblock", message: `Unblocked identity ${id}` });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "Block delete failed" }, { status: 500 });
  }
}
