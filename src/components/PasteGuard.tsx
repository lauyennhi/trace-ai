import React, { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";

/** Wraps a whole assignment screen. When enabled it blocks paste, drop, copy, cut and drag inside it and counts the attempts. */
export const PasteGuard: React.FC<{ enabled: boolean; attempts: React.MutableRefObject<number>; className?: string; children: React.ReactNode }> = ({ enabled, attempts, className = "", children }) => {
  const [note, setNote] = useState(false);
  const timer = useRef<number>(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  if (!enabled) return <div className={className}>{children}</div>;
  const stop = (e: React.SyntheticEvent) => {
    if ((e.target as HTMLElement)?.closest?.("[data-paste-ok]")) return;   // e.g. the student's own draft in Perspective Lab (the amount is still recorded)
    e.preventDefault(); e.stopPropagation();
    attempts.current += 1; setNote(true);
    window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setNote(false), 2600);
  };
  return (
    <div className={`${className} [&_textarea]:select-text [&_input]:select-text`} onPasteCapture={stop} onDropCapture={stop} onCopyCapture={stop} onCutCapture={stop} onDragStartCapture={(e) => e.preventDefault()} data-paste-lock="true">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink-2"><Lock className="h-3.5 w-3.5 text-brand" />Giảng viên đã khóa dán và sao chép trong bài này</div>
      <div className="select-none">{children}</div>
      {note && <div role="status" className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-bg shadow-xl">Bài này khóa dán và sao chép. Hãy tự viết bằng lời của bạn.</div>}
    </div>
  );
};
