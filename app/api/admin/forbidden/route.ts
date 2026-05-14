import { NextRequest, NextResponse } from "next/server";
import { assertAdmin, getSupabaseAdmin, writeAdminEvent } from "@/lib/server";

export async function POST(request: NextRequest) {
  if (!assertAdmin(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const term = String(payload.term ?? "").trim().toLowerCase();

    if (!term) {
      return NextResponse.json({ message: "Forbidden term required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("forbidden_words")
      .upsert({ term, is_active: true }, { onConflict: "term" })
      .select("*")
      .single();

    if (error) throw error;
    await writeAdminEvent({ eventType: "admin_forbidden_add", message: `Forbidden word added: ${term}` });
    return NextResponse.json({ word: data });
  } catch {
    return NextResponse.json({ message: "Forbidden word mutation failed" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!assertAdmin(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const id = String(payload.id ?? "");
    const isActive = Boolean(payload.is_active);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("forbidden_words")
      .update({ is_active: isActive })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    await writeAdminEvent({
      eventType: "admin_forbidden_toggle",
      message: `${data.term} is now ${data.is_active ? "active" : "inactive"}`
    });
    return NextResponse.json({ word: data });
  } catch {
    return NextResponse.json({ message: "Forbidden word update failed" }, { status: 500 });
  }
}
