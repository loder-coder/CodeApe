"use client";

import { useEffect, useState } from "react";
import { Post } from "@/lib/types";
import { formatDate, shortHash } from "@/lib/ui";

export default function MyPage() {
  const [visitorId, setVisitorId] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [status, setStatus] = useState("loading fingerprint...");

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
    if (!visitorId) return;
    fetch(`/api/me/posts?authorHash=${visitorId}`)
      .then((res) => res.json())
      .then((data) => {
        setPosts(data.posts ?? []);
        setStatus(`anonymous(${shortHash(visitorId)})`);
      })
      .catch(() => setStatus("Syntax Error: failed to load my commits"));
  }, [visitorId]);

  return (
    <main className="h-dvh overflow-hidden bg-editor-bg font-mono text-[13px] text-editor-text">
      <div className="flex h-9 items-center gap-4 border-b border-editor-border bg-editor-tab px-4">
        <a href="/" className="text-editor-muted hover:text-editor-text">
          &lt; Back
        </a>
        <span>src/users/me/commits.log</span>
      </div>
      <section className="scrollbar-thin h-[calc(100dvh-36px)] overflow-auto p-6 leading-6">
        <div className="mb-4 text-editor-muted">PS mypage&gt; {status}</div>
        {posts.map((post, index) => (
          <div key={post.id} className="grid grid-cols-[48px_1fr] border-b border-editor-border py-2">
            <span className="select-none pr-4 text-right text-editor-muted">{index + 1}</span>
            <div>
              <div className="text-editor-orange">
                {post.title}.{post.file_ext}
              </div>
              <div className="text-editor-muted">
                board: {post.board} | debug: {post.report_count} | {formatDate(post.created_at)}
              </div>
              <pre className={`mt-2 whitespace-pre-wrap text-editor-green ${post.is_deleted ? "opacity-10" : ""}`}>
                /* {post.body} */
              </pre>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
