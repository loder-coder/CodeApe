"use client";

import { useEffect, useMemo, useState } from "react";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { BoardExplorer } from "@/components/BoardExplorer";
import { EditorTabs } from "@/components/EditorTabs";
import { CodeEditor } from "@/components/CodeEditor";
import { TerminalPanel } from "@/components/TerminalPanel";
import { StatusBar } from "@/components/StatusBar";
import { Board, Comment, Post } from "@/lib/types";

const boards: Board[] = [
  { id: "general", name: "general", path: "src/boards/general", ext: "js" },
  { id: "worklog", name: "worklog", path: "src/boards/worklog", ext: "py" },
  { id: "random", name: "random", path: "src/boards/random", ext: "ts" },
  { id: "help", name: "help", path: "src/boards/help", ext: "md" }
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

  const activePost = useMemo(
    () => openTabs.find((post) => post.id === activePostId) ?? null,
    [activePostId, openTabs]
  );

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
    fetch(`/api/comments?postId=${activePost.id}`)
      .then((res) => res.json())
      .then((data) => setComments(data.comments ?? []))
      .catch(() => setStatus("Terminal: comment stream failed"));
  }, [activePost]);

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

  function closeTab(postId: string) {
    setOpenTabs((current) => {
      const next = current.filter((tab) => tab.id !== postId);
      if (activePostId === postId) {
        setActivePostId(next.at(-1)?.id ?? null);
      }
      return next;
    });
  }

  async function commitPost(title: string, body: string) {
    if (!visitorId) return setStatus("Build pending: fingerprint not ready");

    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        board: activeBoard.id,
        title,
        body,
        fileExt: activeBoard.ext,
        authorHash: visitorId
      })
    });
    const data = await res.json();
    setStatus(data.message ?? (res.ok ? "Commit accepted" : "Syntax Error"));
    if (!res.ok) return;
    await loadPosts(activeBoard.id, query);
    openPost(data.post);
  }

  async function commitComment(body: string) {
    if (!activePost || !visitorId) return;

    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: activePost.id, body, authorHash: visitorId })
    });
    const data = await res.json();
    setStatus(data.message ?? (res.ok ? "Comment committed" : "Syntax Error"));
    if (!res.ok) return;
    setComments((current) => [...current, data.comment]);
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
          loading={loading}
          onSelectBoard={setActiveBoard}
          onOpenPost={openPost}
        />
        <section className="flex min-w-0 flex-1 flex-col border-l border-editor-border">
          <EditorTabs tabs={openTabs} activePostId={activePostId} onActivate={setActivePostId} onClose={closeTab} />
          <CodeEditor board={activeBoard} post={activePost} comments={comments} onDebug={debugPost} />
        </section>
      </div>
      <TerminalPanel
        activeBoard={activeBoard}
        activePost={activePost}
        query={query}
        onSearch={setQuery}
        onCommitPost={commitPost}
        onCommitComment={commitComment}
      />
      <StatusBar status={status} visitorId={visitorId} />
    </main>
  );
}
