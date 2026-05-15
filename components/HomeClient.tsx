"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [posts, setPosts] = useState<Post[]>(initial.posts);
  const [openTabs, setOpenTabs] = useState<Post[]>([]);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [visitorId, setVisitorId] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(initial.totalPages);
  const [status, setStatus] = useState(
    initial.fromCache ? `Explorer: ${initial.posts.length} cached modules` : "Explorer: ready"
  );
  const [loading, setLoading] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Comment | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    "PS workspace> ready",
    "Output: waiting for commits"
  ]);
  const postsCacheRef = useRef(new Map<string, { posts: Post[]; totalPages: number; hasNextPage: boolean }>());
  const postsInFlightRef = useRef(new Map<string, Promise<{ posts: Post[]; totalPages: number; hasNextPage: boolean }>>());
  const commentsCacheRef = useRef(new Map<string, Comment[]>());
  const commentsInFlightRef = useRef(new Map<string, Promise<Comment[]>>());
  const supabase = useMemo(() => getSupabaseBrowser(), []);

  const activePost = useMemo(
    () => openTabs.find((post) => post.id === activePostId) ?? null,
    [activePostId, openTabs]
  );
  const drafts = useMemo(() => openTabs.filter((post) => post.isDraft), [openTabs]);

  useEffect(() => {
    if (initialPosts.length === 0) return;
    postsCacheRef.current.set("board=all&page=1&pageSize=10", {
      posts: initial.posts,
      totalPages: initial.totalPages,
      hasNextPage: initial.totalPages > 1
    });
  }, [initial, initialPosts.length]);

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

  useEffect(() => {
    loadPosts(activeBoard.id, debouncedQuery, page);
  }, [activeBoard.id, debouncedQuery, page]);

  useEffect(() => {
    if (!activePost) {
      setComments([]);
      return;
    }
    if (activePost.isDraft) {
      setComments([]);
      return;
    }
    const cached = commentsCacheRef.current.get(activePost.id);
    if (cached) {
      setComments(cached);
      return;
    }
    loadComments(activePost.id)
      .then((nextComments) => setComments(nextComments))
      .catch(() => setStatus("Terminal: comment stream failed"));
  }, [activePost?.id, activePost?.isDraft]);

  useEffect(() => {
    if (!visitorId) return;
    const loadNotifications = async () => {
      if (document.visibilityState !== "visible") return;
      const res = await fetch(`/api/notifications?authorHash=${visitorId}`);
      const data = await res.json();
      setNotifications(data.notifications ?? []);
    };
    const initial = window.setTimeout(loadNotifications, 2500);
    const timer = window.setInterval(loadNotifications, 15000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [visitorId]);

  const loadPosts = useCallback(async (board: string, search = "", nextPage = page) => {
    setLoading(true);
    const params = new URLSearchParams({ board, page: String(nextPage), pageSize: "10" });
    if (search.trim()) params.set("q", search.trim());
    const cacheKey = params.toString();

    try {
      const cached = postsCacheRef.current.get(cacheKey);
      if (cached && cached.posts.length > 0) {
        setPosts(cached.posts);
        setTotalPages(cached.totalPages);
        setStatus(`Explorer: ${cached.posts.length} modules indexed`);
        return;
      }

      let request = postsInFlightRef.current.get(cacheKey);
      if (!request) {
        request = fetchPostsDirect(board, search, nextPage, supabase)
          .finally(() => postsInFlightRef.current.delete(cacheKey));
        postsInFlightRef.current.set(cacheKey, request);
      }

      const data = await request;
      postsCacheRef.current.set(cacheKey, data);
      if (cacheKey === "board=all&page=1&pageSize=10") {
        window.localStorage.setItem(
          FIRST_PAGE_CACHE_KEY,
          JSON.stringify({ posts: data.posts, totalPages: data.totalPages, savedAt: Date.now() })
        );
      }
      setPosts(data.posts ?? []);
      setTotalPages(data.totalPages ?? 1);
      setStatus(`Explorer: ${data.posts.length} modules indexed`);
    } catch {
      setStatus("Syntax Error: failed to load workspace");
    } finally {
      setLoading(false);
    }
  }, [page]);

  const loadComments = useCallback(async (postId: string) => {
    const cached = commentsCacheRef.current.get(postId);
    if (cached) return cached;

    let request = commentsInFlightRef.current.get(postId);
    if (!request) {
      request = fetchCommentsDirect(postId, supabase)
        .finally(() => commentsInFlightRef.current.delete(postId));
      commentsInFlightRef.current.set(postId, request);
    }

    const nextComments = await request;
    commentsCacheRef.current.set(postId, nextComments);
    return nextComments;
  }, []);

  const openPost = useCallback(async (post: Post) => {
    setOpenTabs((current) => (current.some((tab) => tab.id === post.id) ? current : [...current, post]));
    setActivePostId(post.id);
    if (post.isDraft || post.body) return;

    try {
      const detail = await fetchPostDetailDirect(post.id, visitorId, supabase);
      if (!detail) return;
      commentsCacheRef.current.set(post.id, detail.comments);
      setOpenTabs((current) => current.map((tab) => (tab.id === post.id ? detail.post : tab)));
      setComments(detail.comments);
    } catch {
      setStatus("Syntax Error: failed to open module");
    }
  }, [supabase, visitorId]);

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
    const targetBoard = activeBoard.id === "all" ? boards[3] : activeBoard;
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
  }, [activeBoard, visitorId]);

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
    postsCacheRef.current.clear();
    await loadPosts(activeBoard.id, debouncedQuery, page);
    setOpenTabs((current) => current.map((tab) => (tab.id === activePost.id ? data.post : tab)));
    setActivePostId(data.post.id);
  }, [activeBoard.id, activeBoard.path, activePost, debouncedQuery, loadPosts, page, pushTerminal, visitorId]);

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
    commentsCacheRef.current.delete(activePost.id);
    setComments((current) => [...current, data.comment]);
    setReplyTarget(null);
  }, [activePost, pushTerminal, replyTarget?.id, visitorId]);

  const clearNotifications = useCallback(async () => {
    const ids = notifications.map((item) => item.id);
    setNotifications([]);
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids })
    });
  }, [notifications]);

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
    postsCacheRef.current.clear();
    setPosts((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setOpenTabs((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }, [visitorId]);

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
    postsCacheRef.current.clear();
    setPosts((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated, body: item.body } : item)));
    setOpenTabs((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }, [visitorId]);

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
          drafts={drafts}
          loading={loading}
          page={page}
          totalPages={totalPages}
          onSelectBoard={setActiveBoard}
          onOpenPost={openPost}
          onNewFile={createDraft}
          onRenameDraft={renameDraft}
          onPageChange={(nextPage) => setPage(Math.min(totalPages, Math.max(1, nextPage)))}
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
  supabase: ReturnType<typeof getSupabaseBrowser>
) {
  if (!supabase) {
    const params = new URLSearchParams({ board, page: String(page), pageSize: "10" });
    if (search.trim()) params.set("q", search.trim());
    const res = await fetch(`/api/posts?${params.toString()}`);
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
    .select("id, board, title, file_ext, author_hash, report_count, star_count, is_deleted, created_at")
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

  const { data, error } = await query.order("created_at", { ascending: false }).range(from, to);
  if (error) throw error;

  const rows = data ?? [];
  const hasNextPage = rows.length > pageSize;
  return {
    posts: hasNextPage ? rows.slice(0, pageSize) : rows,
    totalPages: hasNextPage ? page + 1 : page,
    hasNextPage
  };
}

async function fetchPostDetailDirect(
  postId: string,
  visitorId: string,
  supabase: ReturnType<typeof getSupabaseBrowser>
) {
  if (!supabase) {
    const res = await fetch(`/api/posts/${postId}${visitorId ? `?authorHash=${visitorId}` : ""}`);
    const data = await res.json();
    return data.post ? { post: data.post as Post, comments: (data.comments ?? []) as Comment[] } : null;
  }

  const [postResult, commentsResult, starResult] = await Promise.all([
    supabase
      .from("posts")
      .select("id, board, title, body, file_ext, author_hash, report_count, star_count, is_deleted, created_at")
      .eq("id", postId)
      .eq("is_hidden", false)
      .single(),
    supabase
      .from("comments")
      .select("id, post_id, parent_id, body, author_hash, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true }),
    visitorId
      ? supabase.from("stars").select("id").eq("post_id", postId).eq("author_hash", visitorId).maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);

  if (postResult.error) throw postResult.error;
  if (commentsResult.error) throw commentsResult.error;

  return {
    post: { ...postResult.data, has_starred: Boolean(starResult.data) } as Post,
    comments: (commentsResult.data ?? []) as Comment[]
  };
}

async function fetchCommentsDirect(postId: string, supabase: ReturnType<typeof getSupabaseBrowser>) {
  if (!supabase) {
    const res = await fetch(`/api/comments?postId=${postId}`);
    const data = await res.json();
    return (data.comments ?? []) as Comment[];
  }

  const { data, error } = await supabase
    .from("comments")
    .select("id, post_id, parent_id, body, author_hash, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Comment[];
}
