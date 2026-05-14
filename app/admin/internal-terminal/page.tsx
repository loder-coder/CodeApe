"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AdminEvent, BlockedIdentity, ForbiddenWord, Post } from "@/lib/types";
import { formatDate, shortHash } from "@/lib/ui";

type Overview = {
  posts: Post[];
  events: AdminEvent[];
  blocks: BlockedIdentity[];
  words: ForbiddenWord[];
  status: {
    posts: number;
    comments: number;
    reports: number;
    runtime: string;
    db: string;
  };
};

const emptyOverview: Overview = {
  posts: [],
  events: [],
  blocks: [],
  words: [],
  status: {
    posts: 0,
    comments: 0,
    reports: 0,
    runtime: "unknown",
    db: "disconnected"
  }
};

export default function InternalTerminalPage() {
  const [secret, setSecret] = useState("");
  const [overview, setOverview] = useState<Overview>(emptyOverview);
  const [message, setMessage] = useState("Admin terminal locked");
  const [blockValue, setBlockValue] = useState("");
  const [blockKind, setBlockKind] = useState<"author_hash" | "ip_hash">("author_hash");
  const [word, setWord] = useState("");

  const headers = useMemo(() => ({ "Content-Type": "application/json", "x-admin-secret": secret }), [secret]);

  useEffect(() => {
    const saved = window.localStorage.getItem("admin-secret") ?? "";
    setSecret(saved);
  }, []);

  useEffect(() => {
    if (!secret) return;
    window.localStorage.setItem("admin-secret", secret);
    loadOverview();
    const timer = window.setInterval(loadOverview, 3500);
    return () => window.clearInterval(timer);
  }, [secret]);

  async function loadOverview() {
    const res = await fetch("/api/admin/overview", { headers });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.message ?? "Unauthorized");
      return;
    }
    setOverview(data);
    setMessage("Output stream connected");
  }

  async function mutatePost(postId: string, action: "soft-delete" | "hide" | "restore") {
    const res = await fetch(`/api/admin/posts/${postId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ action })
    });
    const data = await res.json();
    setMessage(res.ok ? `Applied ${action}` : data.message);
    await loadOverview();
  }

  async function addBlock(event: FormEvent) {
    event.preventDefault();
    const res = await fetch("/api/admin/blocks", {
      method: "POST",
      headers,
      body: JSON.stringify({ kind: blockKind, value: blockValue, reason: "manual admin block" })
    });
    const data = await res.json();
    setMessage(res.ok ? "Block added" : data.message);
    if (res.ok) setBlockValue("");
    await loadOverview();
  }

  async function removeBlock(id: string) {
    const res = await fetch("/api/admin/blocks", {
      method: "DELETE",
      headers,
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    setMessage(res.ok ? "Block removed" : data.message);
    await loadOverview();
  }

  async function addWord(event: FormEvent) {
    event.preventDefault();
    const res = await fetch("/api/admin/forbidden", {
      method: "POST",
      headers,
      body: JSON.stringify({ term: word })
    });
    const data = await res.json();
    setMessage(res.ok ? "Forbidden word added" : data.message);
    if (res.ok) setWord("");
    await loadOverview();
  }

  async function toggleWord(item: ForbiddenWord) {
    const res = await fetch("/api/admin/forbidden", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ id: item.id, is_active: !item.is_active })
    });
    const data = await res.json();
    setMessage(res.ok ? "Forbidden word updated" : data.message);
    await loadOverview();
  }

  return (
    <main className="flex h-dvh min-h-[720px] flex-col bg-editor-bg font-mono text-[13px] text-editor-text">
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-editor-border bg-editor-tab px-4">
        <span>admin/internal-terminal</span>
        <label className="flex items-center gap-2 text-editor-muted">
          Admin Secret Key
          <input
            type="password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            className="w-[260px] border border-editor-border bg-editor-bg px-2 py-1 text-editor-text outline-none"
          />
        </label>
      </header>

      <section className="grid min-h-0 flex-1 grid-cols-[1.35fr_0.85fr] max-lg:grid-cols-1">
        <div className="min-w-0 border-r border-editor-border max-lg:border-r-0">
          <div className="border-b border-editor-border bg-[#2a2d2e] px-3 py-1 uppercase">Posts</div>
          <div className="scrollbar-thin h-[calc(100dvh-302px)] overflow-auto">
            {overview.posts.map((post) => (
              <div key={post.id} className="grid grid-cols-[1fr_88px_260px] gap-3 border-b border-editor-border px-3 py-2">
                <div className="min-w-0">
                  <div className={post.is_hidden ? "truncate text-editor-muted opacity-40" : "truncate text-editor-orange"}>
                    {post.title}.{post.file_ext}
                  </div>
                  <div className="truncate text-editor-muted">
                    {post.board} | anon({shortHash(post.author_hash)}) | ip({shortHash(post.ip_hash ?? "")}) |{" "}
                    {formatDate(post.created_at)}
                  </div>
                </div>
                <div className="text-editor-red">Debug {post.report_count}</div>
                <div className="flex gap-2">
                  <button onClick={() => mutatePost(post.id, "soft-delete")} className="border border-editor-border px-2 hover:border-editor-red">
                    /* */
                  </button>
                  <button onClick={() => mutatePost(post.id, "hide")} className="border border-editor-border px-2 hover:border-editor-red">
                    Hide DB
                  </button>
                  <button onClick={() => mutatePost(post.id, "restore")} className="border border-editor-border px-2 hover:border-editor-blue">
                    Restore
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-y border-editor-border bg-[#2a2d2e] px-3 py-1 uppercase">Output</div>
          <div className="scrollbar-thin h-[206px] overflow-auto bg-[#181818] px-3 py-2 leading-6">
            <div className="text-editor-green">PS admin&gt; {message}</div>
            {overview.events.map((event) => (
              <div key={event.id}>
                <span className="text-editor-muted">{formatDate(event.created_at)}</span>{" "}
                <span className="text-editor-blue">{event.event_type}</span> {event.message}
              </div>
            ))}
          </div>
        </div>

        <aside className="min-w-0">
          <div className="border-b border-editor-border bg-[#2a2d2e] px-3 py-1 uppercase">Server Status</div>
          <div className="grid grid-cols-2 gap-2 p-3">
            <Metric label="Posts" value={overview.status.posts} />
            <Metric label="Comments" value={overview.status.comments} />
            <Metric label="Reports" value={overview.status.reports} />
            <Metric label="Runtime" value={overview.status.runtime} />
            <Metric label="Supabase DB" value={overview.status.db} wide />
            <Metric label="Vercel Traffic" value={overview.status.runtime === "vercel" ? "check analytics" : "local preview"} wide />
          </div>

          <div className="border-y border-editor-border bg-[#2a2d2e] px-3 py-1 uppercase">IP/Hash Blocklist</div>
          <form onSubmit={addBlock} className="grid grid-cols-[120px_1fr_70px] gap-2 p-3">
            <select
              value={blockKind}
              onChange={(event) => setBlockKind(event.target.value as "author_hash" | "ip_hash")}
              className="border border-editor-border bg-editor-bg px-2 outline-none"
            >
              <option value="author_hash">hash</option>
              <option value="ip_hash">ip</option>
            </select>
            <input
              value={blockValue}
              onChange={(event) => setBlockValue(event.target.value)}
              placeholder="fingerprint or ip hash"
              className="border border-editor-border bg-editor-bg px-2 py-2 outline-none"
            />
            <button className="border border-editor-border hover:border-editor-red">Block</button>
          </form>
          <div className="scrollbar-thin max-h-[150px] overflow-auto px-3 pb-3">
            {overview.blocks.map((block) => (
              <div key={block.id} className="flex items-center justify-between border-b border-editor-border py-1">
                <span className="truncate">
                  {block.kind}: {block.value}
                </span>
                <button onClick={() => removeBlock(block.id)} className="ml-2 text-editor-muted hover:text-editor-red">
                  unblock
                </button>
              </div>
            ))}
          </div>

          <div className="border-y border-editor-border bg-[#2a2d2e] px-3 py-1 uppercase">Syntax Error Library</div>
          <form onSubmit={addWord} className="grid grid-cols-[1fr_70px] gap-2 p-3">
            <input
              value={word}
              onChange={(event) => setWord(event.target.value)}
              placeholder="forbidden keyword"
              className="border border-editor-border bg-editor-bg px-2 py-2 outline-none"
            />
            <button className="border border-editor-border hover:border-editor-blue">Add</button>
          </form>
          <div className="scrollbar-thin max-h-[180px] overflow-auto px-3 pb-3">
            {overview.words.map((item) => (
              <button
                key={item.id}
                onClick={() => toggleWord(item)}
                className={`mb-1 mr-1 border px-2 py-1 ${
                  item.is_active ? "border-editor-red text-editor-red" : "border-editor-border text-editor-muted"
                }`}
              >
                {item.term}
              </button>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}

function Metric({ label, value, wide = false }: { label: string; value: string | number; wide?: boolean }) {
  return (
    <div className={`border border-editor-border bg-[#181818] p-3 ${wide ? "col-span-2" : ""}`}>
      <div className="text-editor-muted">{label}</div>
      <div className="mt-1 truncate text-[18px] text-editor-green">{value}</div>
    </div>
  );
}
