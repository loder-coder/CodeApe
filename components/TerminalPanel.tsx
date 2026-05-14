import { FormEvent, useState } from "react";
import { Board, Post } from "@/lib/types";

type Props = {
  activeBoard: Board;
  activePost: Post | null;
  query: string;
  logs: string[];
  onSearch: (query: string) => void;
  onCommitPost: () => Promise<void> | void;
  onCommitComment: (body: string) => Promise<void> | void;
};

export function TerminalPanel({ activeBoard, activePost, query, logs, onSearch, onCommitPost, onCommitComment }: Props) {
  const [comment, setComment] = useState("");

  async function submitPost(event?: FormEvent) {
    event?.preventDefault();
    await onCommitPost();
  }

  async function submitComment(event?: FormEvent) {
    event?.preventDefault();
    if (!comment.trim() || !activePost || activePost.isDraft) return;
    await onCommitComment(comment.trim());
    setComment("");
  }

  return (
    <section className="h-[214px] shrink-0 border-t border-editor-border bg-[#181818] text-[13px]">
      <div className="flex h-8 items-center gap-5 border-b border-editor-border px-4 uppercase text-editor-muted">
        <span className="border-b border-editor-text pb-1 text-editor-text">Terminal</span>
        <span>Problems</span>
        <span>Output</span>
        <span>Debug Console</span>
      </div>
      <div className="grid h-[calc(100%-32px)] grid-cols-[1fr_1fr] gap-0 max-md:grid-cols-1">
        <form onSubmit={submitPost} className="min-w-0 border-r border-editor-border p-3 max-md:border-r-0">
          <div className="mb-2 flex items-center gap-2 text-editor-muted">
            <span>PS {activeBoard.path}&gt;</span>
            <input
              value={query}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="grep --search"
              className="min-w-0 flex-1 bg-transparent text-editor-text outline-none placeholder:text-editor-muted"
            />
          </div>
          <div className="grid grid-cols-[1fr_92px] gap-2">
            <div className="scrollbar-thin h-[104px] overflow-auto border border-editor-border bg-editor-bg px-2 py-2 text-editor-muted">
              {logs.map((line, index) => (
                <div key={`${line}-${index}`} className={line.startsWith("Output") ? "text-editor-green" : ""}>
                  {line}
                </div>
              ))}
            </div>
            <button className="h-[104px] border border-editor-blue bg-[#0e639c] text-white hover:bg-editor-blue">
              Commit
            </button>
          </div>
        </form>
        <form onSubmit={submitComment} className="min-w-0 p-3">
          <div className="mb-2 truncate text-editor-muted">
            PS comments&gt; {activePost && !activePost.isDraft ? `append ${activePost.title}.${activePost.file_ext}` : "open committed thread first"}
          </div>
          <div className="grid grid-cols-[1fr_92px] gap-2">
            <textarea
              value={comment}
              disabled={!activePost || activePost.isDraft}
              onChange={(event) => setComment(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") submitComment();
              }}
              placeholder="// comment"
              className="h-[104px] resize-none border border-editor-border bg-editor-bg px-2 py-2 outline-none placeholder:text-editor-muted disabled:opacity-40"
            />
            <button disabled={!activePost || activePost.isDraft} className="h-[104px] border border-editor-border hover:border-editor-blue disabled:opacity-40">
              Commit
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
