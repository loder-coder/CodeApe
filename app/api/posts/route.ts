import { NextRequest, NextResponse } from "next/server";
import {
  assertCooldown,
  getSupabaseAdmin,
  hashIp,
  hasForbiddenWord,
  isBlockedIdentity,
  sanitizeTitle,
  writeAdminEvent,
  getErrorMessage
} from "@/lib/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const board = searchParams.get("board") ?? "all";
    const q = searchParams
      .get("q")
      ?.replace(/[%,()]/g, " ")
      .trim()
      .slice(0, 80);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? "10") || 10));
    const from = (page - 1) * pageSize;
    const to = from + pageSize;

    const selectWithHidden =
      "id, board, title, body, file_ext, author_hash, report_count, star_count, is_deleted, is_hidden, created_at";
    const selectLegacy = "id, board, title, body, file_ext, author_hash, report_count, is_deleted, created_at";

    let query = supabase.from("posts").select(selectWithHidden, { count: "exact" }).eq("is_hidden", false);
    query = applyPostFilters(query, board, q).range(from, to - 1);

    const primary = await query;
    let posts = primary.data;
    let count = primary.count;
    let queryError: unknown = primary.error;

    if (queryError && isMissingHiddenColumn(queryError)) {
      let legacyQuery = supabase.from("posts").select(selectLegacy, { count: "exact" });
      legacyQuery = applyPostFilters(legacyQuery, board, q).range(from, to - 1);
      const legacy = await legacyQuery;
      posts = legacy.data;
      count = legacy.count;
      queryError = legacy.error;
    }

    if (queryError) throw queryError;
    const rows = posts ?? [];
    const totalPages = Math.max(1, Math.ceil((count ?? rows.length) / pageSize));

    return NextResponse.json(
      {
        posts: rows,
        page,
        pageSize,
        hasNextPage: page < totalPages,
        totalPages
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=10, stale-while-revalidate=60"
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      { message: `Syntax Error: workspace query failed (${getErrorMessage(error)})` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const title = sanitizeTitle(String(payload.title ?? ""));
    const body = String(payload.body ?? "").trim().slice(0, 5000);
    const board = String(payload.board ?? "general").slice(0, 32);
    const fileExt = String(payload.fileExt ?? "js").replace(/[^a-z0-9]/gi, "").slice(0, 6) || "js";
    const authorHash = String(payload.authorHash ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 128);
    const ipHash = hashIp(request);

    if (board === "notice") {
      return NextResponse.json({ message: "Syntax Error: notice board is admin-only" }, { status: 403 });
    }

    if (!title || !body || !authorHash) {
      return NextResponse.json({ message: "Syntax Error: title/body/fingerprint required" }, { status: 400 });
    }

    if (await isBlockedIdentity(authorHash, ipHash)) {
      await writeAdminEvent({
        eventType: "blocked_commit",
        message: `Blocked commit rejected from ${authorHash.slice(0, 8)}`,
        authorHash,
        ipHash
      });
      return NextResponse.json({ message: "Syntax Error: blocked identity" }, { status: 403 });
    }

    if (await hasForbiddenWord(`${title}\n${body}`)) {
      return NextResponse.json({ message: "Syntax Error: forbidden token detected" }, { status: 400 });
    }

    const cooldown = await assertCooldown({ table: "posts", authorHash, ipHash });
    if (!cooldown.ok) {
      return NextResponse.json({ message: cooldown.message }, { status: 429 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("posts")
      .insert({ board, title, body, file_ext: fileExt, author_hash: authorHash, ip_hash: ipHash })
      .select("id, board, title, body, file_ext, author_hash, report_count, star_count, is_deleted, created_at")
      .single();

    if (error) throw error;
    await writeAdminEvent({
      eventType: "post_created",
      message: `New post committed: ${title}.${fileExt}`,
      postId: data.id,
      authorHash,
      ipHash
    });
    return NextResponse.json({ message: "Commit accepted", post: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: `Syntax Error: commit failed (${getErrorMessage(error)})` },
      { status: 500 }
    );
  }
}

function applyPostFilters<
  T extends {
    eq: (column: string, value: string | number | boolean) => T;
    gte: (column: string, value: string | number) => T;
    or: (filters: string) => T;
    order: (column: string, options?: { ascending?: boolean }) => T;
  }
>(
  query: T,
  board: string,
  q?: string
) {
  let next = query;
  if (board === "stared") {
    next = next.gte("star_count", 10).order("star_count", { ascending: false });
  } else if (board !== "all") {
    next = next.eq("board", board);
  }
  if (q) {
    next = next.or(`title.ilike.%${q}%,body.ilike.%${q}%`);
  }
  return next.order("created_at", { ascending: false });
}

function isMissingHiddenColumn(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("is_hidden") || message.includes("schema cache");
}
