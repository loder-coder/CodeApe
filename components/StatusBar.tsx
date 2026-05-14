import { shortHash } from "@/lib/ui";

export function StatusBar({ status, visitorId }: { status: string; visitorId: string }) {
  return (
    <footer className="flex h-6 shrink-0 items-center justify-between bg-editor-blue px-3 text-[12px] text-white">
      <div>main* | anonymous({visitorId ? shortHash(visitorId) : "...."})</div>
      <div className="truncate pl-4">{status}</div>
    </footer>
  );
}
