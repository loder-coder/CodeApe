import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage, getSupabaseAdmin } from "@/lib/server";

export async function GET(request: NextRequest) {
  try {
    const authorHash = new URL(request.url).searchParams.get("authorHash")?.replace(/[^a-z0-9]/gi, "").slice(0, 128);

    if (!authorHash) {
      return NextResponse.json({ notifications: [] });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_hash", authorHash)
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) throw error;
    return NextResponse.json({ notifications: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { message: `Syntax Error: notification query failed (${getErrorMessage(error)})` },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = await request.json();
    const ids = Array.isArray(payload.ids) ? payload.ids.map(String) : [];

    if (ids.length === 0) {
      return NextResponse.json({ ok: true });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("notifications").update({ is_read: true }).in("id", ids);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: `Syntax Error: notification update failed (${getErrorMessage(error)})` },
      { status: 500 }
    );
  }
}
