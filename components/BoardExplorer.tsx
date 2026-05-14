import { Board, Post } from "@/lib/types";
import { shortHash } from "@/lib/ui";

type Props = {
  boards: Board[];
  activeBoard: Board;
  posts: Post[];
  loading: boolean;
  onSelectBoard: (board: Board) => void;
  onOpenPost: (post: Post) => void;
};

export function BoardExplorer({ boards, activeBoard, posts, loading, onSelectBoard, onOpenPost }: Props) {
  return (
    <aside className="flex w-[318px] shrink-0 bg-editor-panel max-md:w-[268px]">
      <div className="flex w-12 flex-col items-center border-r border-editor-border bg-editor-rail py-3 text-editor-muted">
        <button className="mb-3 h-8 w-8 border-l-2 border-editor-text text-editor-text" title="Explorer">
          EX
        </button>
        <button className="h-8 w-8" title="Search">
          SR
        </button>
        <button className="h-8 w-8" title="Source Control">
          SC
        </button>
      </div>
      <div className="min-w-0 flex-1 text-[13px]">
        <div className="flex h-9 items-center px-4 text-[11px] uppercase tracking-[0.08em] text-editor-text">
          Explorer
        </div>
        <div className="border-y border-editor-border bg-[#2a2d2e] px-3 py-1 text-[12px] font-semibold uppercase">
          Workspace
        </div>
        <div className="px-2 py-2">
          <div className="mb-1 text-editor-muted">v src</div>
          <div className="ml-4 mb-1 text-editor-muted">v boards</div>
          <div className="ml-8 space-y-1">
            {boards.map((board) => (
              <button
                key={board.id}
                onClick={() => onSelectBoard(board)}
                className={`block w-full truncate px-1 py-0.5 text-left ${
                  activeBoard.id === board.id ? "bg-[#37373d] text-editor-text" : "text-editor-muted hover:bg-[#2a2d2e]"
                }`}
              >
                v {board.name}
              </button>
            ))}
          </div>
        </div>
        <div className="border-y border-editor-border bg-[#2a2d2e] px-3 py-1 text-[12px] font-semibold uppercase">
          {activeBoard.path}
        </div>
        <div className="scrollbar-thin max-h-[calc(100dvh-320px)] overflow-auto px-2 py-2">
          {loading ? <div className="px-2 text-editor-muted">indexing...</div> : null}
          {!loading && posts.length === 0 ? <div className="px-2 text-editor-muted">no modules</div> : null}
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
              <span className="ml-2 text-editor-muted">anon({shortHash(post.author_hash)})</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
