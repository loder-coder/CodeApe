import type { ReactNode } from "react";
import { Board, Comment, Post } from "@/lib/types";
import { formatDate, shortHash } from "@/lib/ui";

type Props = {
  board: Board;
  post: Post | null;
  comments: Comment[];
  onDebug: (post: Post) => void;
  onStar: (post: Post) => void;
  onReply: (comment: Comment) => void;
  onDraftBodyChange: (body: string) => void;
};

export function CodeEditor({ board, post, comments, onDebug, onStar, onReply, onDraftBodyChange }: Props) {
  if (!post) {
    return (
      <div className="scrollbar-thin flex-1 overflow-auto bg-editor-bg p-6 text-[14px] leading-6">
        <Line n={1}>
          <span className="text-editor-green">/*</span>
        </Line>
        <Line n={2}>
          <span className="text-editor-green"> Open a file from src/boards/{board.name} to inspect a thread.</span>
        </Line>
        <Line n={3}>
          <span className="text-editor-green"> Everything here is text-only and stored as anonymous commits.</span>
        </Line>
        <Line n={4}>
          <span className="text-editor-green">*/</span>
        </Line>
      </div>
    );
  }

  const body = post.body ?? "";
  const bodyClass = post.is_deleted ? "opacity-10" : "opacity-100";
  const bodyLines = body.split("\n");
  const displayPath =
    post.board === "notice"
      ? `src/notice/${post.title || "rename_required"}.${post.file_ext}`
      : post.board === "stared"
        ? `src/stared/${post.title || "rename_required"}.${post.file_ext}`
        : `src/boards/${post.board}/${post.title || "rename_required"}.${post.file_ext}`;

  return (
    <div className="scrollbar-thin flex-1 overflow-auto bg-editor-bg text-[14px] leading-6">
      <div className="min-w-[760px] p-6">
        <div className="mb-4 flex items-center justify-between border-b border-editor-border pb-3">
          <div className="text-editor-muted">
            {displayPath}
          </div>
          {post.isDraft ? (
            <span className="border border-editor-blue px-3 py-1 text-editor-blue">New File</span>
          ) : (
            <button
              onClick={() => onDebug(post)}
              className="border border-editor-border px-3 py-1 text-editor-muted hover:border-editor-red hover:text-editor-red"
            >
              Debug({post.report_count})
            </button>
          )}
        </div>
        <Line n={1}>
          <span className="text-editor-purple">const</span> thread = {"{"}
        </Line>
        <Line n={2}>
          {"  "}author: <span className="text-editor-orange">"anonymous({shortHash(post.author_hash)})"</span>,
        </Line>
        <Line n={3}>
          {"  "}createdAt: <span className="text-editor-orange">"{formatDate(post.created_at)}"</span>,
        </Line>
        <Line n={4}>
          {"  "}board: <span className="text-editor-orange">"{post.board}"</span>
        </Line>
        <Line n={5}>
          {"  "}stars: <span className="text-editor-yellow">{post.star_count ?? 0}</span>
        </Line>
        <Line n={6}>{"};"}</Line>
        <Line n={7}>
          <span className="text-editor-muted">// Star</span>{" "}
          {post.isDraft ? (
            <span className="text-editor-muted">disabled for draft</span>
          ) : (
            <button
              onClick={() => onStar(post)}
              disabled={post.has_starred}
              className="border border-editor-border px-2 py-0.5 text-editor-yellow hover:border-editor-yellow disabled:opacity-40"
            >
              {post.has_starred ? "Starred" : "Star"}({post.star_count ?? 0})
            </button>
          )}
        </Line>
        <Line n={8}>&nbsp;</Line>
        <Line n={9}>
          <span className="text-editor-green">/*</span>
        </Line>
        {post.isDraft ? (
          <div className="grid grid-cols-[48px_1fr]">
            <span className="select-none pr-4 text-right text-editor-muted">10</span>
            <textarea
              value={body}
              onChange={(event) => onDraftBodyChange(event.target.value)}
              placeholder="Write inside this comment block, then Commit from Terminal."
              className="h-[260px] w-full resize-none border border-editor-border bg-transparent p-2 text-editor-green outline-none placeholder:text-editor-muted"
            />
          </div>
        ) : (
          (post.is_deleted ? [`${body}`] : bodyLines).map((line, index) => (
            <Line key={`${post.id}-${index}`} n={10 + index}>
              <span className={`whitespace-pre-wrap text-editor-green ${bodyClass}`}> {line}</span>
            </Line>
          ))
        )}
        <Line n={10 + bodyLines.length}>
          <span className="text-editor-green">*/</span>
        </Line>
        <Line n={12 + bodyLines.length}>&nbsp;</Line>
        <Line n={13 + bodyLines.length}>
          <span className="text-editor-muted">// comments.log</span>
        </Line>
        {comments.map((comment, index) => (
          <Line key={comment.id} n={14 + bodyLines.length + index}>
            <button onClick={() => onReply(comment)} className="mr-2 text-editor-muted hover:text-editor-blue">
              reply
            </button>
            {comment.parent_id ? <span className="text-editor-muted">-&gt; </span> : null}
            <span className="text-editor-blue">console</span>.log(
            <span className="text-editor-orange">
              "{shortHash(comment.author_hash)}: {comment.body.replaceAll('"', "'")}"
            </span>
            );
          </Line>
        ))}
      </div>
    </div>
  );
}

function Line({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[48px_1fr]">
      <span className="select-none pr-4 text-right text-editor-muted">{n}</span>
      <span>{children}</span>
    </div>
  );
}
