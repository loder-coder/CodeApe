import { Board, Post } from "@/lib/types";
import { shortHash } from "@/lib/ui";

type Props = {
  boards: Board[];
  activeBoard: Board;
  posts: Post[];
  drafts: Post[];
  loading: boolean;
  page: number;
  totalPages: number;
  onSelectBoard: (board: Board) => void;
  onOpenPost: (post: Post) => void;
  onNewFile: () => void;
  onRenameDraft: (postId: string, filename: string) => void;
  onPageChange: (page: number) => void;
};

export function BoardExplorer({
  boards,
  activeBoard,
  posts,
  drafts,
  loading,
  page,
  totalPages,
  onSelectBoard,
  onOpenPost,
  onNewFile,
  onRenameDraft,
  onPageChange
}: Props) {
  return (
    <aside className="flex w-[318px] shrink-0 bg-editor-panel max-md:w-[268px]">
      <div className="flex w-12 flex-col items-center border-r border-editor-border bg-editor-rail py-3 text-editor-muted">
        <button className="mb-3 h-8 w-8 border-l-2 border-editor-text text-editor-text" title="Explorer">
          <span
            aria-hidden="true"
            className="mx-auto block h-5 w-5 bg-[url('/icons/explorer.svg')] bg-contain bg-center bg-no-repeat"
          />
          <span className="sr-only">Explorer</span>
        </button>
      </div>
      <div className="min-w-0 flex-1 text-[13px]">
        <div className="flex h-9 items-center px-4 text-[11px] uppercase tracking-[0.08em] text-editor-text">
          Explorer
        </div>
        <div className="border-y border-editor-border bg-[#2a2d2e] px-3 py-1 text-[12px] font-semibold uppercase">
          <span>Workspace</span>
        </div>
        <div className="px-2 py-2">
          <div className="mb-1 text-editor-muted">v src</div>
          <div className="ml-4 space-y-1">
            {boards
              .filter((board) => board.id === "notice" || board.id === "stared")
              .map((board) => (
                <button
                  key={board.id}
                  onClick={() => onSelectBoard(board)}
                  className={`block w-full truncate px-1 py-0.5 text-left ${
                    activeBoard.id === board.id ? "bg-[#37373d] text-editor-text" : "text-editor-muted hover:bg-[#2a2d2e]"
                  }`}
                >
                  {activeBoard.id === board.id ? "v" : ">"} {board.name}
                </button>
              ))}
          </div>
          <div className="ml-4 mb-1 mt-1 text-editor-muted">v boards</div>
          <div className="ml-8 space-y-1">
            {boards.filter((board) => board.id !== "notice" && board.id !== "stared").map((board) => (
              <button
                key={board.id}
                onClick={() => onSelectBoard(board)}
                className={`block w-full truncate px-1 py-0.5 text-left ${
                  activeBoard.id === board.id ? "bg-[#37373d] text-editor-text" : "text-editor-muted hover:bg-[#2a2d2e]"
                }`}
              >
                {activeBoard.id === board.id ? "v" : ">"} {board.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between border-y border-editor-border bg-[#2a2d2e] px-3 py-1 text-[12px] font-semibold uppercase">
          <span className="truncate">{activeBoard.path}</span>
          {activeBoard.id === "notice" || activeBoard.id === "stared" ? (
            <span className="ml-2 text-editor-muted">read-only</span>
          ) : (
            <button onClick={onNewFile} className="ml-2 text-editor-muted hover:text-editor-text" title="New File">
              + New File
            </button>
          )}
        </div>
        <div className="scrollbar-thin max-h-[calc(100dvh-320px)] overflow-auto px-2 py-2">
          {loading ? <div className="px-2 text-editor-muted">indexing...</div> : null}
          {!loading && posts.length === 0 ? <div className="px-2 text-editor-muted">no modules</div> : null}
          {drafts.map((post) => (
            <div key={post.id} className="px-2 py-1">
              <input
                autoFocus={!post.filename}
                value={post.filename ?? ""}
                onChange={(event) => onRenameDraft(post.id, event.target.value)}
                onFocus={() => onOpenPost(post)}
                placeholder="type_file_name.js"
                className="w-full border border-editor-blue bg-editor-bg px-1 text-editor-text outline-none placeholder:text-editor-muted"
              />
            </div>
          ))}
          {posts.map((post) => (
            <button
              key={post.id}
              onClick={() => onOpenPost(post)}
              className="group block w-full truncate px-2 py-1 text-left hover:bg-[#2a2d2e]"
              title={post.title}
            >
              <span className={post.is_deleted ? "text-editor-muted opacity-40" : "text-editor-orange"}>
                {post.title || "untitled"}.{post.file_ext}
              </span>
              {(post.star_count ?? 0) > 0 ? <span className="ml-2 text-editor-yellow">Star({post.star_count})</span> : null}
              <span className="ml-2 text-editor-muted">anon({shortHash(post.author_hash)})</span>
            </button>
          ))}
        </div>
        <div className="flex h-8 items-center justify-between border-t border-editor-border px-3 text-[12px] text-editor-muted">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="hover:text-editor-text disabled:opacity-30"
          >
            Prev
          </button>
          <span>
            {page}/{totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="hover:text-editor-text disabled:opacity-30"
          >
            Next
          </button>
        </div>
      </div>
    </aside>
  );
}
