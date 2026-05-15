"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoardExplorer } from "@/components/BoardExplorer";
import { EditorTabs } from "@/components/EditorTabs";
import { CodeEditor } from "@/components/CodeEditor";
import { TerminalPanel } from "@/components/TerminalPanel";
import { StatusBar } from "@/components/StatusBar";
import { InstallPwaButton } from "@/components/InstallPwaButton";
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

export function HomeClient({ initialPosts, initialTotalPages }: Props) {
  const [activeBoard, setActiveBoard] = useState<Board>(boards[0]);
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [openTabs, setOpenTabs] = useState<Post[]>([]);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [visitorId, setVisitorId] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [isDragging, setIsDragging] = useState(false);
  const [dragEndTick, setDragEndTick] = useState(0);
  const [status, setStatus] = useState(`Explorer: ${initialPosts.length} modules indexed`);
  const [loading, setLoading] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Comment | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    "PS workspace> ready",
    "Output: waiting for commits"
  ]);
  const postsCacheRef = useRef(new Map<string, { posts: Post[]; totalPages: number; hasNextPage: boolean }>());
  const postsInFlightRef = useRef(new Map<string, Promise<{ posts: Post[]; totalPages: number; hasNextPage: boolean }>>());
  const postDetailCacheRef = useRef(new Map<string, Post>());
  const postDetailInFlightRef = useRef(new Map<string, Promise<Post | null>>());
  const commentsCacheRef = useRef(new Map<string, Comment[]>());
  const commentsInFlightRef = useRef(new Map<string, Promise<Comment[]>>());
  const dragStateRef = useRef({ pointerDown: false, dragging: false, x: 0, y: 0 });

  const activePost = useMemo(
    () => openTabs.find((post) => post.id === activePostId) ?? null,
    [activePostId, openTabs]
  );
  const drafts = useMemo(() => openTabs.filter((post) => post.isDraft), [openTabs]);

  useEffect(() => {
    postsCacheRef.current.set("board=all&page=1&pageSize=10", {
      posts: initialPosts,
      totalPages: initialTotalPages,
      hasNextPage: initialTotalPages > 1
    });
  }, [initialPosts, initialTotalPages]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      dragStateRef.current = {
        pointerDown: true,
        dragging: false,
        x: event.clientX,
        y: event.clientY
      };
    }

    function handlePointerMove(event: PointerEvent) {
      const state = dragStateRef.current;
      if (!state.pointerDown || state.dragging) return;
      const moved = Math.abs(event.clientX - state.x) + Math.abs(event.clientY - state.y);
      if (moved >= 6) {
        state.dragging = true;
        setIsDragging(true);
      }
    }

    function handlePointerUp() {
      const wasDragging = dragStateRef.current.dragging;
      dragStateRef.current = { pointerDown: false, dragging: false, x: 0, y: 0 };
      if (wasDragging) {
        setIsDragging(false);
        setDragEndTick((tick) => tick + 1);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown, { passive: true });
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", handlePointerUp, { passive: true });
    window.addEventListener("pointercancel", handlePointerUp, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, []);

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
    if (isDragging) return;
    loadPosts(activeBoard.id, debouncedQuery, page);
  }, [activeBoard.id, debouncedQuery, page, isDragging, dragEndTick]);

  useEffect(() => {
    if (!activePost) {
      setComments([]);
      return;
    }
    if (activePost.isDraft) {
      setComments([]);
      return;
    }
    if (isDragging) return;
    const cached = commentsCacheRef.current.get(activePost.id);
    if (cached) {
      setComments(cached);
      return;
    }
    loadComments(activePost.id)
      .then((nextComments) => setComments(nextComments))
      .catch(() => setStatus("Terminal: comment stream failed"));
  }, [activePost?.id, activePost?.isDraft, isDragging, dragEndTick]);

  useEffect(() => {
    if (!visitorId) return;
    const loadNotifications = async () => {
      if (isDragging) return;
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
  }, [visitorId, isDragging]);

  const loadPosts = useCallback(async (board: string, search = "", nextPage = page) => {
    if (dragStateRef.current.dragging) return;
    setLoading(true);
    const params = new URLSearchParams({ board, page: String(nextPage), pageSize: "10" });
    if (search.trim()) params.set("q", search.trim());
    const cacheKey = params.toString();

    try {
      const cached = postsCacheRef.current.get(cacheKey);
      if (cached) {
        setPosts(cached.posts);
        setTotalPages(cached.totalPages);
        setStatus(`Explorer: ${cached.posts.length} modules indexed`);
        return;
      }

      let request = postsInFlightRef.current.get(cacheKey);
      if (!request) {
        request = fetch(`/api/posts?${cacheKey}`)
          .then((res) => res.json())
          .then((data) => ({
            posts: data.posts ?? [],
            totalPages: data.totalPages ?? 1,
            hasNextPage: Boolean(data.hasNextPage)
          }))
          .finally(() => postsInFlightRef.current.delete(cacheKey));
        postsInFlightRef.current.set(cacheKey, request);
      }

      const data = await request;
      postsCacheRef.current.set(cacheKey, data);
      setPosts(data.posts ?? []);
      setTotalPages(data.totalPages ?? 1);
      setStatus(`Explorer: ${data.posts.length} modules indexed`);
    } catch {
      setStatus("Syntax Error: failed to load workspace");
    } finally {
      setLoading(false);
    }
  }, [page]);

  const loadPostDetail = useCallback(async (post: Post) => {
    const cacheKey = `${post.id}:${visitorId || "anon"}`;
    const cached = postDetailCacheRef.current.get(cacheKey);
    if (cached) return cached;

    let request = postDetailInFlightRef.current.get(cacheKey);
    if (!request) {
      request = fetch(`/api/posts/${post.id}${visitorId ? `?authorHash=${visitorId}` : ""}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.comments) commentsCacheRef.current.set(post.id, data.comments);
          return data.post ?? null;
        })
        .finally(() => postDetailInFlightRef.current.delete(cacheKey));
      postDetailInFlightRef.current.set(cacheKey, request);
    }

    const detail = await request;
    if (detail) postDetailCacheRef.current.set(cacheKey, detail);
    return detail;
  }, [visitorId]);

  const loadComments = useCallback(async (postId: string) => {
    const cached = commentsCacheRef.current.get(postId);
    if (cached) return cached;

    let request = commentsInFlightRef.current.get(postId);
    if (!request) {
      request = fetch(`/api/comments?postId=${postId}`)
        .then((res) => res.json())
        .then((data) => data.comments ?? [])
        .finally(() => commentsInFlightRef.current.delete(postId));
      commentsInFlightRef.current.set(postId, request);
    }

    const nextComments = await request;
    commentsCacheRef.current.set(postId, nextComments);
    return nextComments;
  }, []);

  const openPost = useCallback(async (post: Post) => {
    if (dragStateRef.current.dragging) return;
    if (!post.isDraft && !post.body) {
      setActivePostId(post.id);
      setOpenTabs((current) => (current.some((tab) => tab.id === post.id) ? current : [...current, post]));
      try {
        const detail = await loadPostDetail(post);
        if (detail) {
          setOpenTabs((current) => current.map((tab) => (tab.id === post.id ? detail : tab)));
        }
      } catch {
        setStatus("Syntax Error: failed to open module");
      }
      return;
    }
    setOpenTabs((current) => (current.some((tab) => tab.id === post.id) ? current : [...current, post]));
    setActivePostId(post.id);
  }, [loadPostDetail]);

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
    postDetailCacheRef.current.clear();
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
    postDetailCacheRef.current.clear();
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
    postDetailCacheRef.current.clear();
    postDetailCacheRef.current.set(`${updated.id}:${visitorId}`, updated);
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
