import type { ReactNode } from "react";
import { Board, Comment, Post } from "@/lib/types";
import { formatDate, shortHash } from "@/lib/ui";

type Props = {
  board: Board;
  post: Post | null;
  comments: Comment[];
  onDebug: (post: Post) => void;
};

export function CodeEditor({ board, post, comments, onDebug }: Props) {
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

  const bodyClass = post.is_deleted ? "opacity-10" : "opacity-100";

  return (
    <div className="scrollbar-thin flex-1 overflow-auto bg-editor-bg text-[14px] leading-6">
      <div className="min-w-[760px] p-6">
        <div className="mb-4 flex items-center justify-between border-b border-editor-border pb-3">
          <div className="text-editor-muted">
            src/boards/{post.board}/{post.title}.{post.file_ext}
          </div>
          <button
            onClick={() => onDebug(post)}
            className="border border-editor-border px-3 py-1 text-editor-muted hover:border-editor-red hover:text-editor-red"
          >
            Debug({post.report_count})
          </button>
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
        <Line n={5}>{"};"}</Line>
        <Line n={6}>&nbsp;</Line>
        <Line n={7}>
          <span className="text-editor-green">/*</span>
        </Line>
        {(post.is_deleted ? [`${post.body}`] : post.body.split("\n")).map((line, index) => (
          <Line key={`${post.id}-${index}`} n={8 + index}>
            <span className={`whitespace-pre-wrap text-editor-green ${bodyClass}`}> {line}</span>
          </Line>
        ))}
        <Line n={8 + post.body.split("\n").length}>
          <span className="text-editor-green">*/</span>
        </Line>
        <Line n={10 + post.body.split("\n").length}>&nbsp;</Line>
        <Line n={11 + post.body.split("\n").length}>
          <span className="text-editor-muted">// comments.log</span>
        </Line>
        {comments.map((comment, index) => (
          <Line key={comment.id} n={12 + post.body.split("\n").length + index}>
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
