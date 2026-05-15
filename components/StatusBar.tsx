import { memo } from "react";
import { shortHash } from "@/lib/ui";

export const StatusBar = memo(function StatusBar({ status, visitorId }: { status: string; visitorId: string }) {
  return (
    <footer className="flex h-6 shrink-0 items-center justify-between bg-editor-blue px-3 text-[12px] text-white">
      <div>main* | anonymous({visitorId ? shortHash(visitorId) : "...."})</div>
      <div className="truncate pl-4">
        <a href="/me" className="mr-4 underline-offset-2 hover:underline">
          My Page
        </a>
        {status}
      </div>
    </footer>
  );
});
