import React, { useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Check, CircleDot, FlaskConical, Lock, MessageSquareText, PenLine, Quote, Search, ShieldQuestion, SkipForward, Upload } from "lucide-react";
import { api } from "../lib/api";
import { AYS_TURNS, LAB_LIMITS, MIN_COTHINK_TURNS, stageConfig, type StageId, type StageView } from "../lib/stages";
import { ISSUE_LABEL, type IssueType } from "../lib/coach";
import { HmmLoader } from "./HmmBrand";
import { useToast } from "./ui";

/* ------------------------------------------------------------------------------------------------ stage bar */
export const StageBar: React.FC<{ stages: StageView[]; active: StageId; onPick: (id: StageId) => void }> = ({ stages, active, onPick }) => (
  <nav aria-label="Các chặng của bài" className="card p-3 mb-4 flex flex-wrap items-stretch gap-2" data-testid="stage-bar">
    {stages.map((s, i) => {
      const on = active === s.id, locked = s.status === "locked";
      return (
        <button key={s.id} type="button" disabled={locked} onClick={() => onPick(s.id)} aria-current={on ? "step" : undefined} title={locked ? s.detail : s.hint} data-testid={`stage-${s.id}`}
          className={`flex min-w-[9rem] flex-1 items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${on ? "border-brand bg-brand-soft ring-4 ring-brand/10" : "border-line hover:border-brand/40"} ${locked ? "opacity-55 cursor-not-allowed" : ""}`}>
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${s.status === "done" ? "bg-green-500 text-white" : on ? "bg-brand text-white dark:text-[#062e6f]" : "border border-line text-mute"}`}>
            {s.status === "done" ? <Check className="h-4 w-4" /> : locked ? <Lock className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <span className="min-w-0"><span className="block truncate text-sm font-semibold">{s.name}</span><span className="block truncate text-[11px] text-mute">{s.detail}{s.enabled && !s.required && s.id !== "co_think" ? " · tùy chọn" : ""}</span></span>
        </button>
      );
    })}
  </nav>
);

/* ------------------------------------------------------------------------------------------ Are you sure? */
export const AysView: React.FC<{ assignment: any; messages: any[]; locked: boolean; onMessages: (m: any[]) => void; attempts: React.MutableRefObject<number> }> = ({ assignment, messages, locked, onMessages, attempts }) => {
  const toast = useToast();
  const [answer, setAnswer] = useState(""), [busy, setBusy] = useState(false), pasted = useRef(0);
  const N = stageConfig(assignment).are_you_sure.turns ?? AYS_TURNS.default;
  const thread = messages.filter((m) => m.stage === "are_you_sure");
  const answered = thread.filter((m) => m.role === "user").length;
  const last = thread[thread.length - 1];
  const pending = last && last.role === "model" ? last : null;
  const closed = answered >= N;

  const turn = async (withAnswer: boolean) => {
    setBusy(true);
    try {
      const body: any = { assignment_id: assignment.id };
      if (withAnswer) { body.answer = answer; body.pasted_chars = pasted.current || undefined; body.paste_attempts = attempts.current || undefined; }
      const d = await api("/api/ays/turn", { method: "POST", body });
      onMessages(d.chat_session.messages); setAnswer(""); pasted.current = 0; attempts.current = 0;
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="card overflow-hidden" data-testid="ays-view">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex items-center gap-2 font-bold"><ShieldQuestion className="h-5 w-5 text-brand" />Bạn chắc chứ?</div>
        <span className="text-xs text-mute">Lượt {Math.min(answered + (pending ? 1 : 0), N)}/{N}</span>
      </div>
      <div className="min-h-[16rem] space-y-4 bg-surface-2/40 p-4 md:p-5">
        {thread.length === 0 && (
          <div className="space-y-3 text-sm text-ink-2">
            <p>AI sẽ chất vấn lập trường của bạn qua <b>{N}</b> lượt. Đây không phải để bắt lỗi: nếu lập luận của bạn vững, AI sẽ nói rõ và hỏi mở rộng. Bạn được <b>giữ vững ý kiến</b> miễn là có lý lẽ.</p>
            <button className="btn btn-primary" disabled={busy || locked} onClick={() => turn(false)} data-testid="ays-start">{busy ? <HmmLoader label="AI đang đọc ý của bạn" /> : <><CircleDot className="h-4 w-4" />Bắt đầu chất vấn</>}</button>
          </div>
        )}
        {thread.map((m) => (
          <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex ${m.role === "user" ? "justify-end" : ""}`}>
            <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm ${m.role === "user" ? "rounded-tr-md bg-brand-soft/60" : "rounded-tl-md border border-line bg-surface"}`}>
              {m.role === "model" && m.ays?.issue_type && <div className="mb-1 text-[11px] font-semibold text-brand">{ISSUE_LABEL[m.ays.issue_type as IssueType]}</div>}
              {m.role === "model" && m.ays?.quote && <div className="mb-1 text-xs italic text-mute">Bạn đã viết: “{m.ays.quote}”</div>}
              {m.content}
            </div>
          </motion.div>
        ))}
        {busy && thread.length > 0 && <div className="text-lg text-ink-2"><HmmLoader label="AI đang nghĩ" /></div>}
        {closed && <div className="chip chip-green py-2"><Check className="h-4 w-4" />Bạn đã hoàn thành chặng này. Có thể nộp bài khi các chặng khác xong.</div>}
      </div>
      {pending && !closed && !locked && (
        <div className="space-y-2 border-t border-line bg-surface p-4">
          <textarea className="input min-h-[90px] resize-y" placeholder="Trả lời bằng lý lẽ của bạn (ít nhất 10 ký tự)…" value={answer} aria-label="Câu trả lời của bạn" data-testid="ays-answer"
            onPaste={(e) => { pasted.current += e.clipboardData.getData("text").length; }} onChange={(e) => setAnswer(e.target.value)} />
          <div className="flex justify-end"><button className="btn btn-primary" disabled={busy || answer.trim().length < 10} onClick={() => turn(true)} data-testid="ays-send">Gửi câu trả lời <ArrowRight className="h-4 w-4" /></button></div>
        </div>
      )}
    </div>
  );
};

export { MIN_COTHINK_TURNS };
