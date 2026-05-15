import { HomeClient } from "@/components/HomeClient";
import { getSupabaseAdmin } from "@/lib/server";
import { Post } from "@/lib/types";

export const revalidate = 10;

async function getInitialPosts() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("posts")
      .select("id, board, title, file_ext, author_hash, report_count, star_count, is_deleted, is_hidden, created_at")
      .eq("is_hidden", false)
      .order("created_at", { ascending: false })
      .range(0, 10);

    if (error) throw error;

    const rows = data ?? [];
    return {
      posts: (rows.length > 10 ? rows.slice(0, 10) : rows) as Post[],
      totalPages: rows.length > 10 ? 2 : 1
    };
  } catch {
    return {
      posts: [] as Post[],
      totalPages: 1
    };
  }
}

export default async function Home() {
  const initial = await getInitialPosts();
  return <HomeClient initialPosts={initial.posts} initialTotalPages={initial.totalPages} />;
}
