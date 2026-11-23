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

/* ------------------------------------------------------------------------------------------ Perspective Lab */
const MODE_LABEL: Record<string, string> = { tranh_luan: "Đoạn có thể tranh luận", su_kien: "Đoạn khẳng định sự kiện", khong_ro: "Chưa rõ nghĩa" };

export const LabView: React.FC<{ assignment: any; lab: any; locked: boolean; onLab: (lab: any) => void }> = ({ assignment, lab, locked, onLab }) => {
  const toast = useToast();
  const [draft, setDraft] = useState(""), [draftPasted, setDraftPasted] = useState(0);
  const [sel, setSel] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [stance, setStance] = useState(""), [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const cfg = stageConfig(assignment);
  const events: any[] = lab?.events || [];
  const done = events.some((e) => e.rewrite || e.action === "skip");

  const call = async (path: string, body: any, ok?: (d: any) => void) => {
    setBusy(true);
    try { const d = await api(path, { method: "POST", body: { assignment_id: assignment.id, ...body } }); if (d.lab) onLab(d.lab); ok?.(d); return d; }
    catch (e: any) { toast.error(e.message); return null; } finally { setBusy(false); }
  };
  const readSel = (el: HTMLTextAreaElement) => setSel({ start: el.selectionStart, end: el.selectionEnd });
  const selLen = lab?.text ? lab.text.slice(sel.start, sel.end).trim().length : 0;
  const canAsk = !locked && !busy && selLen >= LAB_LIMITS.minSel && selLen <= LAB_LIMITS.maxSel && stance.trim().length >= LAB_LIMITS.minStance;

  if (!lab?.text) {
    return (
      <div className="card p-5 space-y-4" data-testid="lab-start">
        <h3 className="flex items-center gap-2 font-bold"><FlaskConical className="h-5 w-5 text-brand" />Góc nhìn khác</h3>
        <p className="text-sm text-ink-2">Dán hoặc tải lên bản nháp của <b>chính bạn</b> (ít nhất {LAB_LIMITS.minText} ký tự). Sau đó bạn bôi đen một đoạn, nói ý của mình trước, rồi mới xem góc nhìn khác và sửa lại đoạn đó.</p>
        <textarea data-paste-ok className="input min-h-[200px] resize-y" placeholder="Dán bản nháp của bạn vào đây…" value={draft} disabled={locked}
          onPaste={(e) => setDraftPasted((n) => n + e.clipboardData.getData("text").length)} onChange={(e) => setDraft(e.target.value)} aria-label="Bản nháp" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <input ref={file} type="file" accept=".txt,.md,.markdown" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setDraft(await f.text()); setDraftPasted(0); } }} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => file.current?.click()}><Upload className="h-4 w-4" />Chọn file .txt / .md</button>
            <span className="ml-3 text-xs text-mute">{draft.trim().length.toLocaleString("vi-VN")} / {LAB_LIMITS.maxText.toLocaleString("vi-VN")} ký tự</span>
          </div>
          <button className="btn btn-primary" disabled={locked || busy || draft.trim().length < LAB_LIMITS.minText} onClick={() => call("/api/lab/start", { text: draft, pasted_chars: draftPasted })}>Bắt đầu <ArrowRight className="h-4 w-4" /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="lab-main">
      <div className="card p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-bold"><FlaskConical className="h-5 w-5 text-brand" />Góc nhìn khác</h3>
          {done ? <span className="chip chip-green"><Check className="h-3.5 w-3.5" />Đã hoàn thành chặng, bạn có thể làm thêm đoạn khác</span> : <span className="chip chip-gray">{cfg.perspective_lab.required ? "Bắt buộc" : "Tùy chọn"}</span>}
        </div>
        <p className="text-sm text-ink-2">Bước 1: bôi đen một đoạn trong văn bản ({LAB_LIMITS.minSel}–{LAB_LIMITS.maxSel.toLocaleString("vi-VN")} ký tự). Bước 2: viết ý của bạn. Bước 3: xem góc nhìn khác và sửa lại.</p>
        <textarea readOnly aria-label="Văn bản của bạn" data-testid="lab-text" className="input min-h-[180px] resize-y bg-surface-2 font-serif leading-7" value={lab.text}
          onSelect={(e) => readSel(e.currentTarget)} onMouseUp={(e) => readSel(e.currentTarget)} onKeyUp={(e) => readSel(e.currentTarget)} />
        <div className={`text-xs ${selLen > LAB_LIMITS.maxSel || (selLen > 0 && selLen < LAB_LIMITS.minSel) ? "text-red-600" : "text-mute"}`}>
          {selLen === 0 ? "Chưa bôi đen đoạn nào." : `Đã chọn ${selLen.toLocaleString("vi-VN")} ký tự${selLen < LAB_LIMITS.minSel ? `, cần ít nhất ${LAB_LIMITS.minSel}` : selLen > LAB_LIMITS.maxSel ? `, tối đa ${LAB_LIMITS.maxSel}` : ""}.`}
        </div>
        {selLen >= LAB_LIMITS.minSel && selLen <= LAB_LIMITS.maxSel && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 rounded-2xl border border-brand/30 bg-surface p-4">
            <label className="label flex items-center gap-2"><PenLine className="h-4 w-4 text-brand" />Hmm… Bạn nghĩ gì về đoạn này? <span className="font-normal text-mute">(ít nhất {LAB_LIMITS.minStance} ký tự, viết trước khi xem góc nhìn khác)</span></label>
            <textarea className="input min-h-[90px] resize-y" value={stance} disabled={locked} onChange={(e) => setStance(e.target.value)} aria-label="Ý của bạn về đoạn đã chọn" data-testid="lab-stance" />
            <div className="flex justify-end">
              <button className="btn btn-primary" disabled={!canAsk} data-testid="lab-ask"
                onClick={() => call("/api/lab/stance", { selection: sel, stance_text: stance }, () => { setStance(""); })}>
                {busy ? <HmmLoader label="Đang tìm góc nhìn khác" /> : <><Search className="h-4 w-4" />Xem góc nhìn khác</>}
              </button>
            </div>
          </motion.div>
        )}
      </div>
      {[...events].reverse().map((e) => <LabEvent key={e.id} ev={e} assignment={assignment} locked={locked} busy={busy} call={call} />)}
    </div>
  );
};

const LabEvent: React.FC<{ ev: any; assignment: any; locked: boolean; busy: boolean; call: (p: string, b: any, ok?: (d: any) => void) => Promise<any> }> = ({ ev, locked, busy, call }) => {
  const [rebut, setRebut] = useState(""), [rebutOpen, setRebutOpen] = useState(false);
  const [after, setAfter] = useState(ev.selection.text);
  const stats = useRef({ typed: 0, deleted: 0, pasted: 0 }), pasteLen = useRef(0), prev = useRef(ev.selection.text.length);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card space-y-4 p-5" data-testid="lab-event">
      <div className="flex flex-wrap items-center gap-2"><span className="chip chip-gray">{MODE_LABEL[ev.mode] || ev.mode}</span>{ev.action && <span className="chip chip-brand">{ev.action === "accept" ? "Đã ghi nhận" : ev.action === "rebut" ? "Đã phản biện lại" : "Đã bỏ qua"}</span>}</div>
      <blockquote className="border-l-4 border-brand/40 pl-3 text-sm italic text-ink-2"><Quote className="mr-1 inline h-3.5 w-3.5" />{ev.selection.text}</blockquote>
      <p className="text-sm"><b>Ý của bạn:</b> {ev.stance_text}</p>

      {ev.counterviews?.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">{ev.counterviews.map((v: any, i: number) => (
          <div key={i} className="tonal space-y-1.5 p-4 text-sm"><div className="font-semibold">{v.stance}</div><p className="text-ink-2">{v.argument}</p>
            {v.source ? <div className="text-xs text-green-600">Nguồn: {v.source.title} (tài liệu của lớp)</div> : <div className="text-xs text-mute">Lập luận do AI soạn, chưa có nguồn</div>}</div>
        ))}</div>
      )}
      {ev.verify && <div className="tonal space-y-1.5 p-4 text-sm"><div className="font-semibold">Điều cần kiểm chứng</div><p>{ev.verify.claim_to_check}</p><ul className="list-disc pl-5 text-ink-2">{ev.verify.how_to_check.map((h: string, i: number) => <li key={i}>{h}</li>)}</ul></div>}
      {ev.clarify && <div className="tonal p-4 text-sm">{ev.clarify}</div>}

      {!ev.action && !locked && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {ev.mode !== "khong_ro" && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => call("/api/lab/action", { event_id: ev.id, action: "accept" })}><Check className="h-4 w-4" />Ghi nhận</button>}
            {ev.mode !== "khong_ro" && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setRebutOpen((v) => !v)}><MessageSquareText className="h-4 w-4" />Phản biện lại</button>}
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => call("/api/lab/action", { event_id: ev.id, action: "skip" })}><SkipForward className="h-4 w-4" />Bỏ qua</button>
          </div>
          {rebutOpen && ev.mode !== "khong_ro" && (
            <div className="space-y-2"><textarea className="input min-h-[80px] resize-y" placeholder={`Phản biện của bạn (ít nhất ${LAB_LIMITS.minRebut} ký tự)…`} value={rebut} onChange={(e) => setRebut(e.target.value)} aria-label="Phản biện của bạn" />
              <button className="btn btn-primary btn-sm" disabled={busy || rebut.trim().length < LAB_LIMITS.minRebut} onClick={() => call("/api/lab/action", { event_id: ev.id, action: "rebut", rebuttal_text: rebut })}>Gửi phản biện</button></div>
          )}
        </div>
      )}
      {ev.rebuttal_text && <p className="text-sm"><b>Phản biện của bạn:</b> {ev.rebuttal_text}</p>}

      {(ev.action === "accept" || ev.action === "rebut") && !ev.rewrite && !locked && (
        <div className="space-y-2" data-testid="lab-rewrite">
          <label className="label">Sửa lại đoạn này sau khi xem góc nhìn khác</label>
          <textarea className="input min-h-[120px] resize-y" value={after} aria-label="Đoạn sau khi sửa"
            onPaste={(e) => { pasteLen.current = e.clipboardData.getData("text").length; }}
            onChange={(e) => {
              const d = e.target.value.length - prev.current; prev.current = e.target.value.length;
              if (d > 0) { if (pasteLen.current) { stats.current.pasted += pasteLen.current; pasteLen.current = 0; } else stats.current.typed += d; } else stats.current.deleted += -d;
              setAfter(e.target.value);
            }} />
          <div className="flex items-center justify-between"><span className="text-xs text-mute">Hệ thống ghi lại bản trước và bản sau của đoạn này.</span>
            <button className="btn btn-primary btn-sm" disabled={busy || after.trim().length < LAB_LIMITS.minAfter || after.trim() === ev.selection.text.trim()} data-testid="lab-save"
              onClick={() => call("/api/lab/rewrite", { event_id: ev.id, after_text: after, ...stats.current })}>Lưu bản sửa</button></div>
        </div>
      )}
      {ev.rewrite && (
        <div className="grid gap-3 md:grid-cols-2 text-sm">
          <div className="tonal p-3"><div className="mb-1 text-xs font-semibold text-mute">Bản trước</div>{ev.rewrite.before}</div>
          <div className="tonal border border-green-500/30 p-3"><div className="mb-1 text-xs font-semibold text-green-600">Bản sau</div>{ev.rewrite.after}</div>
        </div>
      )}
    </motion.div>
  );
};

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
