import { Post } from "@/lib/types";

type Props = {
  tabs: Post[];
  activePostId: string | null;
  onActivate: (postId: string) => void;
  onClose: (postId: string) => void;
};

export function EditorTabs({ tabs, activePostId, onActivate, onClose }: Props) {
  return (
    <div className="flex h-9 shrink-0 overflow-x-auto border-b border-editor-border bg-editor-tab text-[13px]">
      {tabs.length === 0 ? (
        <div className="flex items-center px-4 text-editor-muted">README.md</div>
      ) : (
        tabs.map((tab) => (
          <div
            key={tab.id}
            className={`flex min-w-[164px] items-center border-r border-editor-border ${
              activePostId === tab.id ? "bg-editor-active text-editor-text" : "bg-editor-tab text-editor-muted"
            }`}
          >
            <button onClick={() => onActivate(tab.id)} className="min-w-0 flex-1 truncate px-3 text-left">
              {tab.title || "rename_required"}.{tab.file_ext}
            </button>
            <button onClick={() => onClose(tab.id)} className="h-8 w-8 text-editor-muted hover:text-editor-text">
              x
            </button>
          </div>
        ))
      )}
    </div>
  );
}
