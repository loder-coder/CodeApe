"use client";

import { useEffect, useMemo, useState } from "react";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { BoardExplorer } from "@/components/BoardExplorer";
import { EditorTabs } from "@/components/EditorTabs";
import { CodeEditor } from "@/components/CodeEditor";
import { TerminalPanel } from "@/components/TerminalPanel";
import { StatusBar } from "@/components/StatusBar";
import { Board, Comment, Notification, Post } from "@/lib/types";

const boards: Board[] = [
  { id: "all", name: "ALL", path: "src/boards", ext: "js" },
  { id: "notice", name: "Notice", path: "src/boards/notice", ext: "md" },
  { id: "general", name: "General", path: "src/boards/general", ext: "js" },
  { id: "humor", name: "Humor", path: "src/boards/humor", ext: "js" },
  { id: "c", name: "C", path: "src/boards/c", ext: "c" },
  { id: "java", name: "Java", path: "src/boards/java", ext: "java" },
  { id: "python", name: "Python", path: "src/boards/python", ext: "py" }
];

export default function Home() {
  const [activeBoard, setActiveBoard] = useState<Board>(boards[0]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [openTabs, setOpenTabs] = useState<Post[]>([]);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [visitorId, setVisitorId] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Booting anonymous workspace...");
  const [loading, setLoading] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Comment | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    "PS workspace> ready",
    "Output: waiting for commits"
  ]);

  const activePost = useMemo(
    () => openTabs.find((post) => post.id === activePostId) ?? null,
    [activePostId, openTabs]
  );
  const drafts = useMemo(() => openTabs.filter((post) => post.isDraft), [openTabs]);

  useEffect(() => {
    FingerprintJS.load()
      .then((fp) => fp.get())
      .then((result) => setVisitorId(result.visitorId))
      .catch(() => setVisitorId(crypto.randomUUID()));
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    loadPosts(activeBoard.id, query);
  }, [activeBoard.id, query]);

  useEffect(() => {
    if (!activePost) {
      setComments([]);
      return;
    }
    if (activePost.isDraft) {
      setComments([]);
      return;
    }
    fetch(`/api/comments?postId=${activePost.id}`)
      .then((res) => res.json())
      .then((data) => setComments(data.comments ?? []))
      .catch(() => setStatus("Terminal: comment stream failed"));
  }, [activePost]);

  useEffect(() => {
    if (!visitorId) return;
    const loadNotifications = async () => {
      const res = await fetch(`/api/notifications?authorHash=${visitorId}`);
      const data = await res.json();
      setNotifications(data.notifications ?? []);
    };
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 5000);
    return () => window.clearInterval(timer);
  }, [visitorId]);

  async function loadPosts(board: string, search = "") {
    setLoading(true);
    const params = new URLSearchParams({ board });
    if (search.trim()) params.set("q", search.trim());

    try {
      const res = await fetch(`/api/posts?${params.toString()}`);
      const data = await res.json();
      setPosts(data.posts ?? []);
      setStatus(`Explorer: ${data.posts?.length ?? 0} modules indexed`);
    } catch {
      setStatus("Syntax Error: failed to load workspace");
    } finally {
      setLoading(false);
    }
  }

  function openPost(post: Post) {
    setOpenTabs((current) => (current.some((tab) => tab.id === post.id) ? current : [...current, post]));
    setActivePostId(post.id);
  }

  function createDraft() {
    const targetBoard = activeBoard.id === "all" ? boards[2] : activeBoard;
    const draft: Post = {
      id: `draft:${Date.now()}`,
      board: targetBoard.id,
      title: "",
      body: "",
      file_ext: targetBoard.ext,
      author_hash: visitorId || "pending",
      report_count: 0,
      is_deleted: false,
      created_at: new Date().toISOString(),
      isDraft: true
    };

    setOpenTabs((current) => [...current, draft]);
    setActivePostId(draft.id);
    pushTerminal(`PS ${targetBoard.path}> New-Item <rename-required>`);
  }

  function renameDraft(postId: string, filename: string) {
    const clean = filename.trim();
    const title = clean.replace(/\.[a-z0-9]+$/i, "");
    setOpenTabs((current) =>
      current.map((tab) =>
        tab.id === postId
          ? { ...tab, title, file_ext: clean.includes(".") ? clean.split(".").pop() || tab.file_ext : tab.file_ext }
          : tab
      )
    );
  }

  function updateDraftBody(body: string) {
    if (!activePost?.isDraft) return;
    setOpenTabs((current) => current.map((tab) => (tab.id === activePost.id ? { ...tab, body } : tab)));
  }

  function closeTab(postId: string) {
    setOpenTabs((current) => {
      const next = current.filter((tab) => tab.id !== postId);
      if (activePostId === postId) {
        setActivePostId(next.at(-1)?.id ?? null);
      }
      return next;
    });
  }

  function pushTerminal(line: string) {
    setTerminalLogs((current) => [...current.slice(-80), line]);
  }

  async function commitPost() {
    if (!visitorId) return setStatus("Build pending: fingerprint not ready");
    if (!activePost?.isDraft) return setStatus("Open a New File draft before Commit");
    if (!activePost.title.trim()) return setStatus("Syntax Error: empty file name");
    if (!activePost.body.trim()) return setStatus("Syntax Error: empty file body");

    pushTerminal(`PS ${activeBoard.path}> git add ${activePost.title}.${activePost.file_ext}`);
    pushTerminal(`PS ${activeBoard.path}> git commit -m "add ${activePost.title}.${activePost.file_ext}"`);

    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        board: activePost.board,
        title: activePost.title,
        body: activePost.body,
        fileExt: activePost.file_ext,
        authorHash: visitorId
      })
    });
    const data = await res.json();
    setStatus(data.message ?? (res.ok ? "Commit accepted" : "Syntax Error"));
    pushTerminal(res.ok ? "Output: Commit accepted, remote DB updated" : `Output: ${data.message ?? "Commit failed"}`);
    if (!res.ok) return;
    await loadPosts(activeBoard.id, query);
    setOpenTabs((current) => current.map((tab) => (tab.id === activePost.id ? data.post : tab)));
    setActivePostId(data.post.id);
  }

  async function commitComment(body: string) {
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
    setComments((current) => [...current, data.comment]);
    setReplyTarget(null);
  }

  async function clearNotifications() {
    const ids = notifications.map((item) => item.id);
    setNotifications([]);
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids })
    });
  }

  async function debugPost(post: Post) {
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
    setPosts((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setOpenTabs((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  return (
    <main className="flex h-dvh min-h-[620px] flex-col overflow-hidden bg-editor-bg text-editor-text">
      <div className="flex min-h-0 flex-1">
        <BoardExplorer
          boards={boards}
          activeBoard={activeBoard}
          posts={posts}
          drafts={drafts}
          loading={loading}
          onSelectBoard={setActiveBoard}
          onOpenPost={openPost}
          onNewFile={createDraft}
          onRenameDraft={renameDraft}
        />
        <section className="flex min-w-0 flex-1 flex-col border-l border-editor-border">
          <EditorTabs tabs={openTabs} activePostId={activePostId} onActivate={setActivePostId} onClose={closeTab} />
          <CodeEditor
            board={activeBoard}
            post={activePost}
            comments={comments}
            onDebug={debugPost}
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
      <StatusBar status={status} visitorId={visitorId} />
    </main>
  );
}
