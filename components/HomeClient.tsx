"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { BoardExplorer } from "@/components/BoardExplorer";
import { EditorTabs } from "@/components/EditorTabs";
import { CodeEditor } from "@/components/CodeEditor";
import { TerminalPanel } from "@/components/TerminalPanel";
import { StatusBar } from "@/components/StatusBar";
import { InstallPwaButton } from "@/components/InstallPwaButton";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { Board, Comment, Notification, Post } from "@/lib/types";

const boards: Board[] = [
  { id: "all", name: "ALL", path: "src/boards", ext: "js" },
  { id: "notice", name: "Notice", path: "src/notice", ext: "md" },
  { id: "stared", name: "Stared", path: "src/stared", ext: "js" },
  { id: "general", name: "General", path: "src/boards/general", ext: "js" },
  { id: "humor", name: "Humor", path: "src/boards/humor", ext: "js" },
  { id: "c", name: "C", path: "src/boards/c", ext: "c" },
  { id: "java", name: "Java", path: "src/boards/java", ext: "java" },
  { id: "python", name: "Python", path: "src/boards/python", ext: "py" }
];

type Props = {
  initialPosts: Post[];
  initialTotalPages: number;
};

type CachedPosts = {
  posts: Post[];
  totalPages: number;
  savedAt: number;
};

const FIRST_PAGE_CACHE_KEY = "posts:board=all&page=1&pageSize=10";

function readCachedInitialPosts(initialPosts: Post[], initialTotalPages: number) {
  if (typeof window === "undefined") {
    return { posts: initialPosts, totalPages: initialTotalPages, fromCache: false };
  }

  try {
    const raw = window.localStorage.getItem(FIRST_PAGE_CACHE_KEY);
    if (!raw) return { posts: initialPosts, totalPages: initialTotalPages, fromCache: false };
    const cached = JSON.parse(raw) as CachedPosts;
    return {
      posts: cached.posts ?? initialPosts,
      totalPages: cached.totalPages ?? initialTotalPages,
      fromCache: Boolean(cached.posts?.length)
    };
  } catch {
    return { posts: initialPosts, totalPages: initialTotalPages, fromCache: false };
  }
}

export function HomeClient({ initialPosts, initialTotalPages }: Props) {
  const initial = useMemo(() => readCachedInitialPosts(initialPosts, initialTotalPages), [initialPosts, initialTotalPages]);
  const [activeBoard, setActiveBoard] = useState<Board>(boards[0]);
  const [openTabs, setOpenTabs] = useState<Post[]>([]);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [visitorId, setVisitorId] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(
    initial.fromCache ? `Explorer: ${initial.posts.length} cached modules` : "Explorer: ready"
  );
  const [replyTarget, setReplyTarget] = useState<Comment | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    "PS workspace> ready",
    "Output: waiting for commits"
  ]);
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const queryClient = useQueryClient();

  const activePost = useMemo(
    () => openTabs.find((post) => post.id === activePostId) ?? null,
    [activePostId, openTabs]
  );
  const drafts = useMemo(() => openTabs.filter((post) => post.isDraft), [openTabs]);
  const visibleDrafts = useMemo(
    () =>
      activeBoard.id === "all" || activeBoard.id === "notice" || activeBoard.id === "stared"
        ? []
        : drafts.filter((post) => post.board === activeBoard.id),
    [activeBoard.id, drafts]
  );

  useEffect(() => {
    const cached = window.localStorage.getItem("visitor-id");
    if (cached) {
      setVisitorId(cached);
      return;
    }
    import("@fingerprintjs/fingerprintjs")
      .then((module) => module.default.load())
      .then((fp) => fp.get())
      .then((result) => {
        window.localStorage.setItem("visitor-id", result.visitorId);
        setVisitorId(result.visitorId);
      })
      .catch(() => {
        const fallback = crypto.randomUUID();
        window.localStorage.setItem("visitor-id", fallback);
        setVisitorId(fallback);
      });
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const register = () => navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      const idle = window.setTimeout(register, 2000);
      return () => window.clearTimeout(idle);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [activeBoard.id, debouncedQuery]);

  const postsQuery = useQuery({
    queryKey: ["posts", activeBoard.id, debouncedQuery, page],
    queryFn: ({ signal }) => fetchPostsDirect(activeBoard.id, debouncedQuery, page, supabase, signal),
    initialData:
      activeBoard.id === "all" && page === 1 && !debouncedQuery && initial.posts.length > 0
        ? {
            posts: initial.posts,
            totalPages: initial.totalPages,
            hasNextPage: initial.totalPages > 1
          }
        : undefined,
    placeholderData: keepPreviousData
  });

  const posts = postsQuery.data?.posts ?? [];
  const totalPages = postsQuery.data?.totalPages ?? 1;

  useEffect(() => {
    setStatus(`Explorer: ${posts.length} modules indexed`);
  }, [posts.length]);

  useEffect(() => {
    if (activeBoard.id !== "all" || page !== 1 || debouncedQuery || posts.length === 0) return;
    window.localStorage.setItem(
      FIRST_PAGE_CACHE_KEY,
      JSON.stringify({ posts, totalPages, savedAt: Date.now() })
    );
  }, [activeBoard.id, debouncedQuery, page, posts, totalPages]);

  useEffect(() => {
    if (!activePost) {
      setComments([]);
      return;
    }
    if (activePost.isDraft) {
      setComments([]);
      return;
    }
    const cached = queryClient.getQueryData<Comment[]>(["comments", activePost.id]);
    if (cached) setComments(cached);
  }, [activePost?.id, activePost?.isDraft, queryClient]);

  const commentsQuery = useQuery({
    queryKey: ["comments", activePost?.id],
    queryFn: ({ signal }) => fetchCommentsDirect(activePost?.id ?? "", supabase, signal),
    enabled: Boolean(activePost?.id && !activePost.isDraft),
    placeholderData: keepPreviousData
  });

  useEffect(() => {
    if (commentsQuery.data) setComments(commentsQuery.data);
  }, [commentsQuery.data]);

  const notificationsQuery = useQuery({
    queryKey: ["notifications", visitorId],
    queryFn: ({ signal }) => fetchNotifications(visitorId, signal),
    enabled: Boolean(visitorId),
    refetchInterval: () =>
      typeof document !== "undefined" && document.visibilityState === "visible" ? 15000 : false,
    refetchIntervalInBackground: false
  });

  const notifications = notificationsQuery.data ?? [];

  const openPost = useCallback(async (post: Post) => {
    setOpenTabs((current) => (current.some((tab) => tab.id === post.id) ? current : [...current, post]));
    setActivePostId(post.id);
    if (post.isDraft || post.body) return;

    try {
      const detail = await queryClient.fetchQuery({
        queryKey: ["post", post.id, visitorId],
        queryFn: ({ signal }) => fetchPostDetailDirect(post.id, visitorId, supabase, signal),
        staleTime: 5 * 60 * 1000
      });
      if (!detail) return;
      queryClient.setQueryData(["comments", post.id], detail.comments);
      setOpenTabs((current) => current.map((tab) => (tab.id === post.id ? detail.post : tab)));
      setComments(detail.comments);
    } catch {
      setStatus("Syntax Error: failed to open module");
    }
  }, [queryClient, supabase, visitorId]);

  const pushTerminal = useCallback((line: string) => {
    setTerminalLogs((current) => [...current.slice(-80), line]);
  }, []);

  const createDraft = useCallback(() => {
    if (activeBoard.id === "notice") {
      setStatus("Syntax Error: notice board is admin-only");
      return;
    }
    if (activeBoard.id === "stared") {
      setStatus("Syntax Error: stared board is read-only");
      return;
    }
    if (activeBoard.id === "all") {
      setStatus("Select a board before New File");
      return;
    }
    const targetBoard = activeBoard;
    const draft: Post = {
      id: `draft:${Date.now()}`,
      board: targetBoard.id,
      title: "",
      body: "",
      file_ext: targetBoard.ext,
      filename: "",
      author_hash: visitorId || "pending",
      report_count: 0,
      is_deleted: false,
      created_at: new Date().toISOString(),
      isDraft: true
    };

    setOpenTabs((current) => [...current, draft]);
    setActivePostId(draft.id);
    pushTerminal(`PS ${targetBoard.path}> New-Item <rename-required>`);
  }, [activeBoard, pushTerminal, visitorId]);

  const renameDraft = useCallback((postId: string, filename: string) => {
    const raw = filename.replace(/[\\/:*?"<>|]/g, "_");
    const clean = raw.trim();
    const dotIndex = clean.lastIndexOf(".");
    const hasExtension = dotIndex > 0 && dotIndex < clean.length - 1;
    const title = hasExtension ? clean.slice(0, dotIndex) : clean;
    const extension = hasExtension ? clean.slice(dotIndex + 1).replace(/[^a-z0-9]/gi, "") : "";

    setOpenTabs((current) =>
      current.map((tab) =>
        tab.id === postId
          ? { ...tab, filename: raw, title, file_ext: extension || tab.file_ext }
          : tab
      )
    );
  }, []);

  const updateDraftBody = useCallback((body: string) => {
    if (!activePost?.isDraft) return;
    setOpenTabs((current) => current.map((tab) => (tab.id === activePost.id ? { ...tab, body } : tab)));
  }, [activePost?.id, activePost?.isDraft]);

  const closeTab = useCallback((postId: string) => {
    setOpenTabs((current) => {
      const next = current.filter((tab) => tab.id !== postId);
      if (activePostId === postId) {
        setActivePostId(next.at(-1)?.id ?? null);
      }
      return next;
    });
  }, [activePostId]);

  const commitPost = useCallback(async () => {
    if (!visitorId) return setStatus("Build pending: fingerprint not ready");
    if (!activePost?.isDraft) return setStatus("Open a New File draft before Commit");
    if (!activePost.title.trim()) return setStatus("Syntax Error: empty file name");
    if (!(activePost.body ?? "").trim()) return setStatus("Syntax Error: empty file body");

    const fileName = `${activePost.title}.${activePost.file_ext}`;
    pushTerminal(`PS ${activeBoard.path}> git add ${fileName}`);
    pushTerminal(`PS ${activeBoard.path}> git commit -m "add ${fileName}"`);

    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        board: activePost.board,
        title: activePost.title,
        body: activePost.body ?? "",
        fileExt: activePost.file_ext,
        authorHash: visitorId
      })
    });
    const data = await res.json();
    setStatus(data.message ?? (res.ok ? "Commit accepted" : "Syntax Error"));
    pushTerminal(res.ok ? "Output: Commit accepted, remote DB updated" : `Output: ${data.message ?? "Commit failed"}`);
    if (!res.ok) return;
    await queryClient.invalidateQueries({ queryKey: ["posts"] });
    setOpenTabs((current) => current.map((tab) => (tab.id === activePost.id ? data.post : tab)));
    setActivePostId(data.post.id);
  }, [activeBoard.path, activePost, pushTerminal, queryClient, visitorId]);

  const commitComment = useCallback(async (body: string) => {
    if (!activePost || !visitorId) return;

    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: activePost.id, parentId: replyTarget?.id ?? null, body, authorHash: visitorId })
    });
    const data = await res.json();
    setStatus(data.message ?? (res.ok ? "Comment committed" : "Syntax Error"));
    pushTerminal(res.ok ? "Output: comment object written" : `Output: ${data.message ?? "comment failed"}`);
    if (!res.ok) return;
    queryClient.setQueryData<Comment[]>(["comments", activePost.id], (current = []) => [...current, data.comment]);
    setComments((current) => [...current, data.comment]);
    setReplyTarget(null);
  }, [activePost, pushTerminal, queryClient, replyTarget?.id, visitorId]);

  const clearNotifications = useCallback(async () => {
    const ids = notifications.map((item) => item.id);
    queryClient.setQueryData(["notifications", visitorId], []);
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids })
    });
  }, [notifications, queryClient, visitorId]);

  const debugPost = useCallback(async (post: Post) => {
    if (!visitorId) return;

    const res = await fetch(`/api/posts/${post.id}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reporterHash: visitorId })
    });
    const data = await res.json();
    setStatus(data.message ?? "Debug signal emitted");
    if (!res.ok) return;

    const updated = data.post as Post;
    await queryClient.invalidateQueries({ queryKey: ["posts"] });
    setOpenTabs((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }, [queryClient, visitorId]);

  const starPost = useCallback(async (post: Post) => {
    if (!visitorId || post.isDraft) return;

    const res = await fetch(`/api/posts/${post.id}/star`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorHash: visitorId })
    });
    const data = await res.json();
    setStatus(data.message ?? (res.ok ? "Star added" : "Syntax Error"));
    if (!res.ok || !data.post) return;
    const updated = data.post as Post;
    queryClient.setQueriesData<{ posts: Post[]; totalPages: number; hasNextPage: boolean }>(
      { queryKey: ["posts"] },
      (current) =>
        current
          ? {
              ...current,
              posts: current.posts.map((item) =>
                item.id === updated.id ? { ...item, star_count: updated.star_count, has_starred: true } : item
              )
            }
          : current
    );
    setOpenTabs((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }, [queryClient, visitorId]);

  const handlePageChange = useCallback((nextPage: number) => {
    setPage((current) => {
      const bounded = Math.min(totalPages, Math.max(1, nextPage));
      return bounded === current ? current : bounded;
    });
  }, [totalPages]);

  return (
    <main className="flex h-dvh min-h-[620px] flex-col overflow-hidden bg-editor-bg text-editor-text">
      <div className="flex min-h-0 flex-1">
        <BoardExplorer
          boards={boards}
          activeBoard={activeBoard}
          posts={posts}
          drafts={visibleDrafts}
          loading={postsQuery.isFetching}
          page={page}
          totalPages={totalPages}
          onSelectBoard={setActiveBoard}
          onOpenPost={openPost}
          onNewFile={createDraft}
          onRenameDraft={renameDraft}
          onPageChange={handlePageChange}
        />
        <section className="flex min-w-0 flex-1 flex-col border-l border-editor-border">
          <EditorTabs tabs={openTabs} activePostId={activePostId} onActivate={setActivePostId} onClose={closeTab} />
          <CodeEditor
            board={activeBoard}
            post={activePost}
            comments={comments}
            onDebug={debugPost}
            onStar={starPost}
            onReply={setReplyTarget}
            onDraftBodyChange={updateDraftBody}
          />
        </section>
      </div>
      <TerminalPanel
        activeBoard={activeBoard}
        activePost={activePost}
        replyTarget={replyTarget}
        query={query}
        logs={terminalLogs}
        onSearch={setQuery}
        onCommitPost={commitPost}
        onCommitComment={commitComment}
      />
      {notifications.length > 0 ? (
        <button
          onClick={clearNotifications}
          className="fixed bottom-8 right-4 z-50 max-w-[360px] border border-editor-blue bg-[#252526] px-4 py-3 text-left text-[13px] shadow-2xl"
        >
          <div className="mb-1 text-editor-blue">Visual Studio Code</div>
          <div className="text-editor-text">{notifications[0].message}</div>
          <div className="mt-1 text-editor-muted">reply from anon({notifications[0].actor_hash.slice(0, 4)})</div>
        </button>
      ) : null}
      <InstallPwaButton />
      <StatusBar status={status} visitorId={visitorId} />
    </main>
  );
}

async function fetchPostsDirect(
  board: string,
  search: string,
  page: number,
  supabase: ReturnType<typeof getSupabaseBrowser>,
  signal?: AbortSignal
) {
  if (!supabase) {
    const params = new URLSearchParams({ board, page: String(page), pageSize: "10" });
    if (search.trim()) params.set("q", search.trim());
    const res = await fetch(`/api/posts?${params.toString()}`, { signal });
    const data = await res.json();
    return {
      posts: data.posts ?? [],
      totalPages: data.totalPages ?? 1,
      hasNextPage: Boolean(data.hasNextPage)
    };
  }

  const pageSize = 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize;
  let query = supabase
    .from("posts")
    .select("id, board, title, file_ext, author_hash, report_count, star_count, is_deleted, created_at", {
      count: "exact"
    })
    .eq("is_hidden", false);

  if (board === "stared") {
    query = query.gte("star_count", 10).order("star_count", { ascending: false });
  } else if (board !== "all") {
    query = query.eq("board", board);
  }

  if (search.trim()) {
    const term = `%${search.trim().replace(/[%,()]/g, " ")}%`;
    query = query.or(`title.ilike.${term},body.ilike.${term}`);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to - 1)
    .abortSignal(signal);
  if (error) throw error;

  const rows = data ?? [];
  const totalPages = Math.max(1, Math.ceil((count ?? rows.length) / pageSize));
  return {
    posts: rows,
    totalPages,
    hasNextPage: page < totalPages
  };
}

async function fetchPostDetailDirect(
  postId: string,
  visitorId: string,
  supabase: ReturnType<typeof getSupabaseBrowser>,
  signal?: AbortSignal
) {
  if (!supabase) {
    const res = await fetch(`/api/posts/${postId}${visitorId ? `?authorHash=${visitorId}` : ""}`, { signal });
    const data = await res.json();
    return data.post ? { post: data.post as Post, comments: (data.comments ?? []) as Comment[] } : null;
  }

  const [postResult, commentsResult, starResult] = await Promise.all([
    supabase
      .from("posts")
      .select("id, board, title, body, file_ext, author_hash, report_count, star_count, is_deleted, created_at")
      .eq("id", postId)
      .eq("is_hidden", false)
      .single()
      .abortSignal(signal),
    supabase
      .from("comments")
      .select("id, post_id, parent_id, body, author_hash, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .abortSignal(signal),
    visitorId
      ? supabase
          .from("stars")
          .select("id")
          .eq("post_id", postId)
          .eq("author_hash", visitorId)
          .maybeSingle()
          .abortSignal(signal)
      : Promise.resolve({ data: null, error: null })
  ]);

  if (postResult.error) throw postResult.error;
  if (commentsResult.error) throw commentsResult.error;

  return {
    post: { ...postResult.data, has_starred: Boolean(starResult.data) } as Post,
    comments: (commentsResult.data ?? []) as Comment[]
  };
}

async function fetchCommentsDirect(postId: string, supabase: ReturnType<typeof getSupabaseBrowser>, signal?: AbortSignal) {
  if (!supabase) {
    const res = await fetch(`/api/comments?postId=${postId}`, { signal });
    const data = await res.json();
    return (data.comments ?? []) as Comment[];
  }

  const { data, error } = await supabase
    .from("comments")
    .select("id, post_id, parent_id, body, author_hash, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .abortSignal(signal);

  if (error) throw error;
  return (data ?? []) as Comment[];
}

async function fetchNotifications(visitorId: string, signal?: AbortSignal) {
  const res = await fetch(`/api/notifications?authorHash=${visitorId}`, { signal });
  const data = await res.json();
  return (data.notifications ?? []) as Notification[];
}
