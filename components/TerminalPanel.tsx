import { FormEvent, useState } from "react";
import { Board, Post } from "@/lib/types";

type Props = {
  activeBoard: Board;
  activePost: Post | null;
  query: string;
  onSearch: (query: string) => void;
  onCommitPost: (title: string, body: string) => Promise<void> | void;
  onCommitComment: (body: string) => Promise<void> | void;
};

export function TerminalPanel({ activeBoard, activePost, query, onSearch, onCommitPost, onCommitComment }: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [comment, setComment] = useState("");

  async function submitPost(event?: FormEvent) {
    event?.preventDefault();
    if (!title.trim() || !body.trim()) return;
    await onCommitPost(title.trim(), body.trim());
    setTitle("");
    setBody("");
  }

  async function submitComment(event?: FormEvent) {
    event?.preventDefault();
    if (!comment.trim() || !activePost) return;
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
          <div className="grid grid-cols-[168px_1fr_92px] gap-2 max-md:grid-cols-[1fr_92px]">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={`new_file.${activeBoard.ext}`}
              className="border border-editor-border bg-editor-bg px-2 py-2 outline-none placeholder:text-editor-muted max-md:col-span-2"
            />
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") submitPost();
              }}
              placeholder="/* commit message body */"
              className="h-[104px] resize-none border border-editor-border bg-editor-bg px-2 py-2 outline-none placeholder:text-editor-muted"
            />
            <button className="h-[104px] border border-editor-blue bg-[#0e639c] text-white hover:bg-editor-blue">
              Commit
            </button>
          </div>
        </form>
        <form onSubmit={submitComment} className="min-w-0 p-3">
          <div className="mb-2 truncate text-editor-muted">
            PS comments&gt; {activePost ? `append ${activePost.title}.${activePost.file_ext}` : "open thread first"}
          </div>
          <div className="grid grid-cols-[1fr_92px] gap-2">
            <textarea
              value={comment}
              disabled={!activePost}
              onChange={(event) => setComment(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") submitComment();
              }}
              placeholder="// comment"
              className="h-[104px] resize-none border border-editor-border bg-editor-bg px-2 py-2 outline-none placeholder:text-editor-muted disabled:opacity-40"
            />
            <button disabled={!activePost} className="h-[104px] border border-editor-border hover:border-editor-blue disabled:opacity-40">
              Commit
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
