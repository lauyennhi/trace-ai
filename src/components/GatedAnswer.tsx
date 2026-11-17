import React, { useState } from "react";
import { motion } from "motion/react";
import { Lock, Unlock, Lightbulb, Compass, AlertTriangle, Sparkles } from "lucide-react";
import { ChatMessage } from "../types";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { GATE_MIN_ANSWERS, GATE_MIN_CHARS, type AnswerGate } from "../lib/gate";

// Decoration only: the hidden text itself never reaches the browser, so this filler is not the real answer.
const FILLER = ["thông tin", "phân tích", "dữ liệu", "kết luận", "lập luận", "ví dụ", "bằng chứng", "đánh giá", "nguyên nhân", "giải pháp", "so sánh", "tác động"];
const fillerText = (chars: number) => {
  const lines = Math.max(4, Math.min(11, Math.ceil(chars / 80)));
  return Array.from({ length: lines }, (_, l) => Array.from({ length: 11 }, (_, i) => FILLER[(l * 5 + i * 3) % FILLER.length]).join(" ")).join("\n");
};

interface Props {
  message: ChatMessage;
  gate: Exclude<AnswerGate, "none">;
  busy: boolean;
  /** true when this is the newest message, i.e. the one the student must open before asking again */
  onUnlock: (data: { answers?: string[]; skip?: boolean }) => Promise<void>;
}

export const GatedAnswer: React.FC<Props> = ({ message, gate, busy, onUnlock }) => {
  const g = message.gate!;
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<string[]>(["", "", ""]);
  const need = Math.min(GATE_MIN_ANSWERS, g.questions.length);
  const filled = answers.slice(0, g.questions.length).filter((a) => a.trim()).length;
  const chars = answers.reduce((n, a) => n + a.trim().length, 0);
  const ok = filled >= need && chars >= GATE_MIN_CHARS;

  if (g.state === "locked") {
    return (
      <div data-testid="gated-locked">
        <MarkdownRenderer content={message.content} />
        <div className="relative mt-3 rounded-xl overflow-hidden">
          <p aria-hidden className="text-sm leading-relaxed text-ink-2 whitespace-pre-line select-none pointer-events-none" style={{ filter: "blur(7px)", opacity: 0.8 }}>{fillerText(g.hidden_chars || 400)}</p>
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-transparent via-surface/60 to-surface">
            <button type="button" onClick={() => setOpen(true)} disabled={busy} className="chip chip-brand shadow-sm text-[13px] px-4 py-2 hover:brightness-95 transition"><Lock className="w-3.5 h-3.5" />Nói ý của em để đọc tiếp</button>
          </div>
        </div>
        {!open ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(true)} disabled={busy}><Unlock className="w-4 h-4" />Mở khóa bằng ý của em</button>
            <span className="text-xs text-mute">AI sẽ viết tiếp dựa trên chính ý em nói.</span>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-xl border border-brand/25 bg-brand-soft/30 p-3 space-y-3" data-testid="unlock-form">
            <div className="text-xs font-bold text-brand flex items-center gap-1.5"><Lightbulb className="w-3.5 h-3.5" />Nói ý của em ({need} câu trở lên) để đọc tiếp</div>
            {g.questions.map((q, i) => (
              <div key={i}>
                <label className="label">{q}</label>
                <textarea rows={2} className="input resize-none" disabled={busy} value={answers[i] || ""} onChange={(e) => setAnswers(answers.map((x, k) => (k === i ? e.target.value : x)))} />
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-mute">{ok ? "Đủ ý để mở khóa." : `Viết ít nhất ${need} ô, tổng tối thiểu ${GATE_MIN_CHARS} ký tự.`}</span>
              <div className="flex gap-2">
                {gate === "optional" && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onUnlock({ skip: true })}>Xem luôn (sẽ được ghi nhận)</button>}
                <button type="button" className="btn btn-primary btn-sm" disabled={!ok || busy} onClick={() => onUnlock({ answers })}>{busy ? "AI đang viết theo ý của em…" : "Gửi ý và mở khóa"}</button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    );
  }

  const hasHints = !!((g.used_ideas && g.used_ideas.length) || g.correction || (g.alternatives && g.alternatives.length));
  return (
    <div data-testid="gated-unlocked">
      {g.skipped && <div className="mb-2"><span className="chip chip-gray">Đã xem luôn, không nói ý của mình</span></div>}
      {hasHints && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3" data-testid="gate-hints">
          <div className="text-sm font-bold flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-violet-500" />Gợi ý từ AI dựa trên ý của em</div>
          {g.used_ideas && g.used_ideas.length > 0 && (
            <div className="rounded-xl bg-[#e7f8ef] dark:bg-[#0e2a1f] p-3">
              <div className="text-xs font-bold text-[#0f8a55] dark:text-[#4ade9a] flex items-center gap-1.5 mb-1.5"><Sparkles className="w-3.5 h-3.5" />Ý của em đã được dùng</div>
              <ul className="text-xs text-ink-2 list-disc pl-4 space-y-0.5">{g.used_ideas.map((u, i) => <li key={i}>{u}</li>)}</ul>
            </div>
          )}
          {g.correction && (
            <div className="rounded-xl bg-[#fff4de] dark:bg-[#33260c] p-3 text-xs text-[#8a5300] dark:text-[#fbbf4a] flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /><span><strong>Cần lưu ý: </strong>{g.correction}</span></div>
          )}
          {g.alternatives && g.alternatives.length > 0 && (
            <div>
              <div className="text-xs font-bold text-violet-600 dark:text-violet-300 flex items-center gap-1.5 mb-1.5"><Compass className="w-3.5 h-3.5" />Hướng khác em có thể cân nhắc</div>
              <div className="grid sm:grid-cols-2 gap-2">{g.alternatives.map((a, i) => <div key={i} className="rounded-xl border border-line bg-surface-2/60 p-3 text-xs text-ink-2">{a}</div>)}</div>
            </div>
          )}
        </motion.div>
      )}
      <div className={hasHints ? "mt-5 pt-4 border-t border-dashed border-line" : ""} data-testid="gate-final">
        {hasHints && <div className="text-xs font-bold tracking-wider uppercase text-brand mb-2 flex items-center gap-1.5"><Unlock className="w-3.5 h-3.5" />Đáp án hoàn chỉnh</div>}
        <motion.div initial={{ filter: "blur(8px)", opacity: 0.4 }} animate={{ filter: "blur(0px)", opacity: 1 }} transition={{ duration: 0.8 }}>
          <MarkdownRenderer content={message.content} />
        </motion.div>
      </div>
    </div>
  );
};
