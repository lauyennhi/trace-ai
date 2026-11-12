import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Send, Bot, Check, Lock, Clock, Highlighter, Trash2, PenLine, Sparkles, MessageSquareText, ListChecks, Upload,
  CheckCircle2, AlertTriangle, Award, ChevronRight, Languages, BookOpenText, Save,
} from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { api } from "../lib/api";
import { L2_ERROR_LABEL, wordCount, type L2Highlight, type L2Work } from "../lib/l2";
import { Assignment, ChatMessage, ChatSession, Submission } from "../types";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { Avatar, Bar, Modal, fmtDate, relTime, useToast } from "./ui";

interface Props {
  assignment: Assignment;
  courseName?: string;
  userName: string;
  userAvatar?: string;
  submission: Submission | null;
  chatSession: ChatSession | null;
  l2Feedback?: any;
  onChanged: () => void;
}

type Phase = "prompt" | "critique";
const STEPS = [
  { n: 1, title: "Prompt", hint: "Lập dàn ý với AI", icon: MessageSquareText },
  { n: 2, title: "Phản biện", hint: "Tìm lỗi trong văn bản AI", icon: Highlighter },
  { n: 3, title: "Chỉnh sửa", hint: "Sửa thành bản của bạn", icon: PenLine },
] as const;

/* ---------- small chat box used by step 1 (prompt) and step 2 (Socratic hints) ---------- */
const ChatBox: React.FC<{
  messages: ChatMessage[]; userName: string; userAvatar?: string; disabled: boolean;
  placeholder: string; empty: string; onSend: (text: string) => Promise<void>; compact?: boolean;
}> = ({ messages, userName, userAvatar, disabled, placeholder, empty, onSend, compact }) => {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length, sending]);
  const send = async () => {
    const t = input.trim();
    if (!t || sending || disabled) return;
    setSending(true); setInput("");
    try { await onSend(t); } catch { setInput(t); } finally { setSending(false); }
  };
  return (
    <div className="flex flex-col">
      <div className={`overflow-y-auto space-y-4 p-4 bg-surface-2/40 ${compact ? "max-h-64 min-h-[8rem]" : "max-h-[22rem] min-h-[12rem]"}`}>
        {messages.length === 0 && <p className="text-sm text-mute text-center py-6">{empty}</p>}
        {messages.map((m, i) => {
          const mine = m.role === "user";
          return (
            <div key={m.id || i} className={`flex gap-2.5 ${mine ? "flex-row-reverse" : ""}`}>
              {mine ? <Avatar name={userName} src={userAvatar} size={28} /> : <div className="w-7 h-7 rounded-full bg-brand text-on-brand flex items-center justify-center shrink-0"><Bot className="w-3.5 h-3.5" /></div>}
              <div className={`max-w-[88%] px-3.5 py-2.5 rounded-2xl ${mine ? "bg-brand text-on-brand rounded-tr-md" : "bg-surface border border-line rounded-tl-md"}`}>
                <MarkdownRenderer content={m.content} className={mine ? "!text-white [&_*]:!text-white" : ""} />
              </div>
            </div>
          );
        })}
        {sending && <div className="flex gap-2.5"><div className="w-7 h-7 rounded-full bg-brand text-on-brand flex items-center justify-center"><Bot className="w-3.5 h-3.5" /></div><div className="px-4 py-3 rounded-2xl rounded-tl-md bg-surface border border-line flex gap-1.5"><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></div></div>}
        <div ref={end} />
      </div>
      <div className="p-3 border-t border-line flex items-end gap-2 bg-surface">
        <textarea rows={1} className="input resize-none max-h-32 min-h-[44px]" style={{ fieldSizing: "content" } as React.CSSProperties} value={input} disabled={disabled || sending}
          onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={placeholder} />
        <button className="btn btn-primary btn-icon h-11 w-11 shrink-0" disabled={!input.trim() || sending || disabled} onClick={send} aria-label="Gửi"><Send className="w-5 h-5" /></button>
      </div>
    </div>
  );
};

/* ---------- AI text with selectable / highlighted ranges ---------- */
const MarkedText: React.FC<{
  text: string; highlights: L2Highlight[]; onSelect?: (r: { start: number; end: number } | null) => void; pending?: { start: number; end: number } | null;
}> = ({ text, highlights, onSelect, pending }) => {
  const ref = useRef<HTMLDivElement>(null);
  const parts = useMemo(() => {
    const out: { s: number; e: number; hl?: number }[] = [];
    let pos = 0;
    [...highlights].sort((a, b) => a.start - b.start).forEach((h, i) => {
      if (h.start > pos) out.push({ s: pos, e: h.start });
      out.push({ s: h.start, e: h.end, hl: i + 1 });
      pos = h.end;
    });
    if (pos < text.length) out.push({ s: pos, e: text.length });
    return out;
  }, [text, highlights]);

  const offsetOf = (node: Node, offset: number): number | null => {
    const root = ref.current;
    if (!root) return null;
    if (node === root) {
      const child = root.childNodes[offset] as HTMLElement | undefined;
      return child?.dataset?.s !== undefined ? Number(child.dataset.s) : text.length;
    }
    const el = (node.nodeType === 3 ? node.parentElement : (node as Element))?.closest?.("[data-s]") as HTMLElement | null;
    if (!el || !root.contains(el)) return null;
    const base = Number(el.dataset.s);
    return node.nodeType === 3 ? base + offset : offset > 0 ? base + (el.textContent?.length || 0) : base;
  };

  const handle = () => {
    if (!onSelect) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return onSelect(null);
    const r = sel.getRangeAt(0);
    let a = offsetOf(r.startContainer, r.startOffset), b = offsetOf(r.endContainer, r.endOffset);
    if (a === null || b === null) return onSelect(null);
    if (a > b) [a, b] = [b, a];
    while (a < b && /\s/.test(text[a])) a++;
    while (b > a && /\s/.test(text[b - 1])) b--;
    onSelect(b > a ? { start: a, end: b } : null);
  };

  return (
    <div ref={ref} onMouseUp={handle} onTouchEnd={() => setTimeout(handle, 50)} onKeyUp={handle}
      className="whitespace-pre-wrap leading-8 text-[1.02rem] select-text cursor-text" data-testid="ai-text">
      {parts.map((p) => p.hl
        ? <mark key={p.s} data-s={p.s} className="bg-amber-200/80 dark:bg-amber-500/30 text-ink rounded px-0.5 border-b-2 border-amber-500" title={`Đánh dấu ${p.hl}`}>{text.slice(p.s, p.e)}</mark>
        : <span key={p.s} data-s={p.s}>{text.slice(p.s, p.e)}</span>)}
      {pending && null}
    </div>
  );
};

export const StudentL2View: React.FC<Props> = ({ assignment, courseName, userName, userAvatar, submission, chatSession, l2Feedback, onChanged }) => {
  const toast = useToast();
  const l2 = assignment.l2!;
  const [sub, setSub] = useState<Submission | null>(submission);
  const [messages, setMessages] = useState<ChatMessage[]>(chatSession?.messages || []);
  const submitted = sub?.status === "submitted" || sub?.status === "late";
  const work: L2Work | undefined = sub?.l2_work;
  const step = submitted ? 4 : work?.step ?? 1;
  const [view, setView] = useState<number>(step);
  useEffect(() => { setView(step); }, [step]);

  const byPhase = (p: Phase) => messages.filter((m) => m.phase === p);
  const pastDue = new Date(assignment.due_date) < new Date();

  /* ----- step 1 ----- */
  const [finalPrompt, setFinalPrompt] = useState(work?.final_prompt || "");
  const [busy, setBusy] = useState(false);
  const promptTurns = byPhase("prompt").filter((m) => m.role === "user");
  useEffect(() => { if (!finalPrompt && promptTurns.length) setFinalPrompt(promptTurns[promptTurns.length - 1].content); }, [promptTurns.length]);

  const sendChat = useCallback(async (phase: Phase, text: string) => {
    const temp: ChatMessage = { id: "tmp_" + Date.now(), role: "user", content: text, timestamp: new Date().toISOString(), phase };
    setMessages((p) => [...p, temp]);
    try {
      const res: any = await api("/api/chat/message", { method: "POST", body: { assignment_id: assignment.id, message_content: text, phase } });
      setMessages(res.chat_session.messages);
    } catch (e: any) {
      setMessages((p) => p.filter((m) => m.id !== temp.id));
      toast.error(e.message || "Không gửi được tin nhắn.");
      throw e;
    }
  }, [assignment.id]);

  const lockPrompt = async () => {
    setBusy(true);
    try { const s = await api<Submission>(`/api/l2/${assignment.id}/lock-prompt`, { method: "POST", body: { final_prompt: finalPrompt } }); setSub(s); toast.success("Đã chốt prompt. Sang bước 2!"); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  /* ----- step 2 ----- */
  const [highlights, setHighlights] = useState<L2Highlight[]>(work?.highlights || []);
  const [pending, setPending] = useState<{ start: number; end: number } | null>(null);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState<"" | "saving" | "saved">("");
  const critTimer = useRef<number | undefined>(undefined);
  const persistCritique = useCallback(async (list: L2Highlight[]) => {
    setSaved("saving");
    try { await api(`/api/l2/${assignment.id}/critique`, { method: "PUT", body: { highlights: list.map(({ id, start, end, note }) => ({ id, start, end, note })) } }); setSaved("saved"); }
    catch (e: any) { setSaved(""); toast.error(e.message); }
  }, [assignment.id]);
  const scheduleSave = (list: L2Highlight[]) => { window.clearTimeout(critTimer.current); critTimer.current = window.setTimeout(() => persistCritique(list), 700); };
  const updateHighlights = (list: L2Highlight[]) => { setHighlights(list); scheduleSave(list); };

  const addHighlight = () => {
    if (!pending) return;
    const overlaps = highlights.some((h) => pending.start < h.end && pending.end > h.start);
    if (overlaps) return toast.error("Đoạn này chồng lên một đánh dấu có sẵn.");
    if (!note.trim()) return toast.error("Hãy ghi chú lý do bạn nghi ngờ đoạn này.");
    const h: L2Highlight = { id: "hl_" + Date.now() + Math.random().toString(36).slice(2, 6), start: pending.start, end: pending.end, text: l2.ai_text.slice(pending.start, pending.end), note: note.trim() };
    updateHighlights([...highlights, h].sort((a, b) => a.start - b.start));
    setPending(null); setNote(""); window.getSelection()?.removeAllRanges();
  };
  const allNoted = highlights.length > 0 && highlights.every((h) => h.note.trim());
  const finishCritique = async () => {
    setBusy(true);
    try {
      window.clearTimeout(critTimer.current);
      await persistCritique(highlights);
      const s = await api<Submission>(`/api/l2/${assignment.id}/finish-critique`, { method: "POST" });
      setSub(s); setRevision(s.l2_work?.revision.text || ""); toast.success("Sang bước chỉnh sửa!");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  /* ----- step 3 ----- */
  const [revision, setRevision] = useState(work?.revision?.text || l2.ai_text);
  const stats = useRef({ typed: work?.revision?.stats?.typed || 0, deleted: work?.revision?.stats?.deleted || 0, pasted: work?.revision?.stats?.pasted || 0 });
  const snaps = useRef<{ t: string; text: string }[]>(work?.revision?.snapshots || []);
  const revTimer = useRef<number | undefined>(undefined);
  const lastSnap = useRef(work?.revision?.text || l2.ai_text);
  const [revSaved, setRevSaved] = useState<"" | "saving" | "saved">("");
  const saveRevision = useCallback(async (text: string) => {
    setRevSaved("saving");
    try { await api(`/api/l2/${assignment.id}/revision`, { method: "PUT", body: { text, snapshots: snaps.current.slice(-40), stats: stats.current } }); setRevSaved("saved"); }
    catch { setRevSaved(""); }
  }, [assignment.id]);
  const takeSnapshot = (text: string) => { if (text !== lastSnap.current) { snaps.current.push({ t: new Date().toISOString(), text }); lastSnap.current = text; } };
  const onRevisionChange = (next: string) => {
    const diff = next.length - revision.length;
    if (diff > 0) stats.current.typed += diff; else stats.current.deleted += -diff;
    setRevision(next);
    window.clearTimeout(revTimer.current);
    revTimer.current = window.setTimeout(() => { takeSnapshot(next); saveRevision(next); }, 1500);
  };
  const [confirm, setConfirm] = useState(false);
  const submitFinal = async () => {
    setBusy(true);
    try {
      window.clearTimeout(revTimer.current);
      takeSnapshot(revision);
      await api(`/api/l2/${assignment.id}/revision`, { method: "PUT", body: { text: revision, snapshots: snaps.current.slice(-40), stats: stats.current } });
      const s = await api<Submission>("/api/submissions/submit", { method: "POST", body: { assignment_id: assignment.id } });
      setSub(s); setConfirm(false); toast.success("Nộp bài thành công!"); onChanged();
    } catch (e: any) { toast.error(e.message); setConfirm(false); } finally { setBusy(false); }
  };

  /* ----- layout ----- */
  const reading = view < step || submitted;
  const stepDone = (n: number) => (submitted ? true : n < step);

  return (
    <div className="space-y-4">
      {/* header + stepper */}
      <div className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-brand flex items-center gap-1.5"><PenLine className="w-3.5 h-3.5" />Viết L2 · {courseName}</div>
            <h2 className="text-lg font-extrabold leading-tight">{assignment.title}</h2>
            <div className="text-xs text-mute mt-1 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Hạn {fmtDate(assignment.due_date)} · {relTime(assignment.due_date)}{pastDue && !submitted && <span className="chip chip-rose ml-1">Quá hạn</span>}</div>
          </div>
          {submitted ? <span className="chip chip-green py-1.5 px-3 text-sm"><CheckCircle2 className="w-4 h-4" />Đã nộp {sub?.status === "late" ? "(trễ)" : ""}</span>
            : <span className="text-xs text-mute flex items-center gap-1">{view === 2 ? (saved === "saving" ? "Đang lưu…" : saved === "saved" ? <><Save className="w-3.5 h-3.5 text-emerald-500" />Đã lưu</> : "") : view === 3 ? (revSaved === "saving" ? "Đang lưu…" : revSaved === "saved" ? <><Save className="w-3.5 h-3.5 text-emerald-500" />Đã lưu</> : "") : ""}</span>}
        </div>
        <ol className="mt-4 grid grid-cols-3 gap-2" aria-label="Tiến trình 3 bước">
          {STEPS.map((s) => {
            const done = stepDone(s.n), active = !submitted && s.n === step, locked = !submitted && s.n > step, current = view === s.n && !submitted;
            return (
              <li key={s.n}>
                <button disabled={locked} onClick={() => setView(s.n)} aria-current={current ? "step" : undefined}
                  className={`w-full text-left rounded-2xl border p-3 transition-all ${current ? "border-brand bg-brand-soft/50 ring-4 ring-brand/10" : "border-line"} ${locked ? "opacity-50 cursor-not-allowed" : "hover:border-brand/40"}`}>
                  <div className="flex items-center gap-2.5">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${done ? "bg-emerald-500 text-white" : active ? "bg-brand text-on-brand" : "bg-surface-2 text-mute"}`}>{done ? <Check className="w-4 h-4" /> : locked ? <Lock className="w-3.5 h-3.5" /> : s.n}</span>
                    <div className="min-w-0"><div className="text-sm font-semibold leading-tight">{s.title}</div><div className="text-[11px] text-mute truncate hidden sm:block">{s.hint}</div></div>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="grid lg:grid-cols-12 gap-4 items-start">
        {/* task card */}
        <aside className="lg:col-span-4 lg:sticky lg:top-20 space-y-3">
          <div className="card p-5 space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-mute"><BookOpenText className="w-4 h-4" />Đề bài viết</h3>
            <div className="rounded-2xl bg-surface-2 border border-line p-4"><MarkdownRenderer content={assignment.description || "Không có mô tả."} /></div>
            <div className="text-xs text-ink-2 flex items-start gap-2"><Languages className="w-4 h-4 mt-0.5 shrink-0 text-brand" /><span>{l2.prompt_language === "en" ? "Viết prompt bằng tiếng Anh." : "Prompt có thể viết bằng tiếng Anh hoặc tiếng Việt."}</span></div>
            {assignment.rubric && <details className="text-sm"><summary className="cursor-pointer font-semibold flex items-center gap-1.5"><ListChecks className="w-4 h-4 text-brand" />Ghi chú của giảng viên</summary><div className="mt-2"><MarkdownRenderer content={assignment.rubric} /></div></details>}
            <details className="text-sm"><summary className="cursor-pointer font-semibold flex items-center gap-1.5"><Award className="w-4 h-4 text-brand" />Tiêu chí chấm (5 chiều)</summary>
              <ul className="mt-2 space-y-1.5">{l2.dimensions.map((d) => <li key={d.key} className="text-xs text-ink-2"><strong className="text-ink">{d.name}:</strong> {d.description}</li>)}</ul></details>
          </div>
        </aside>

        <div className="lg:col-span-8 space-y-4 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div key={`${view}-${submitted}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">

              {/* ---------------- result ---------------- */}
              {submitted && sub && <L2Result sub={sub} assignment={assignment} feedback={l2Feedback} />}

              {/* ---------------- step 1 ---------------- */}
              {!submitted && view === 1 && (
                <div className="card overflow-hidden">
                  <div className="px-5 py-3 border-b border-line flex items-center justify-between">
                    <div className="font-bold flex items-center gap-2"><MessageSquareText className="w-5 h-5 text-brand" />Bước 1 · Viết prompt cho AI</div>
                    <span className="chip chip-brand"><Sparkles className="w-3 h-3" />Chỉ lập dàn ý</span>
                  </div>
                  <ChatBox messages={byPhase("prompt")} userName={userName} userAvatar={userAvatar} disabled={reading}
                    placeholder={l2.prompt_language === "en" ? "Write your prompt in English… (Enter to send)" : "Viết prompt của bạn… (Enter để gửi)"}
                    empty="Hãy mô tả bài viết bạn cần, người đọc và các ràng buộc. Trợ lý chỉ giúp lập dàn ý, không viết hộ. Mỗi lần bạn sửa prompt đều được lưu lại." onSend={(t) => sendChat("prompt", t)} />
                  {!reading && (
                    <div className="p-4 border-t border-line space-y-3 bg-surface-2/40">
                      <div><label className="label">Prompt cuối cùng của bạn</label>
                        <textarea className="input resize-y" rows={3} value={finalPrompt} onChange={(e) => setFinalPrompt(e.target.value)} placeholder="Khi thấy prompt đã đủ tốt, hãy chốt nó ở đây." /></div>
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <span className="text-xs text-mute">{promptTurns.length} lần prompt đã lưu · sau khi chốt sẽ không sửa lại được</span>
                        <button className="btn btn-primary" disabled={busy || promptTurns.length < 1 || finalPrompt.trim().length < 5} onClick={lockPrompt}>Chốt prompt & sang bước 2<ChevronRight className="w-4 h-4" /></button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {!submitted && view === 1 && step > 1 && work?.final_prompt && <div className="card p-4 text-sm"><div className="text-xs font-bold text-mute mb-1">Prompt đã chốt</div>{work.final_prompt}</div>}

              {/* ---------------- step 2 ---------------- */}
              {!submitted && view === 2 && (
                <>
                  <div className="card p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="font-bold flex items-center gap-2"><Highlighter className="w-5 h-5 text-brand" />Bước 2 · Tìm lỗi trong văn bản AI</div>
                      <span className="text-xs text-mute">{reading ? "Chỉ xem" : "Bôi đen đoạn nghi ngờ, rồi ghi chú lý do"}</span>
                    </div>
                    <p className="text-sm text-ink-2 mb-3">Văn bản dưới đây do AI viết và có thể chứa <strong className="text-ink">lỗi ngôn ngữ, lỗi logic hoặc thông tin bịa</strong>. Hãy đọc kỹ.</p>
                    <div className="rounded-2xl border border-line bg-surface-2/50 p-5">
                      <MarkedText text={l2.ai_text} highlights={highlights} onSelect={reading ? undefined : setPending} />
                    </div>
                    <AnimatePresence>
                      {!reading && pending && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 rounded-2xl border border-brand/40 bg-brand-soft/30 p-4 space-y-2">
                          <div className="text-xs text-mute">Đoạn đang chọn</div>
                          <p className="text-sm font-medium bg-surface rounded-lg px-3 py-2 break-words">“{l2.ai_text.slice(pending.start, pending.end)}”</p>
                          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addHighlight()} placeholder="Vì sao bạn nghi ngờ? (VD: sai mạo từ, số liệu không kiểm chứng được…)" autoFocus />
                          <div className="flex gap-2"><button className="btn btn-primary btn-sm" onClick={addHighlight}><Highlighter className="w-4 h-4" />Đánh dấu đoạn này</button><button className="btn btn-ghost btn-sm" onClick={() => { setPending(null); window.getSelection()?.removeAllRanges(); }}>Bỏ chọn</button></div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="card p-5 space-y-3">
                    <div className="font-bold flex items-center justify-between">Đánh dấu của bạn <span className="chip chip-gray">{highlights.length}</span></div>
                    {highlights.length === 0 && <p className="text-sm text-mute">Chưa có đánh dấu nào. Dùng chuột bôi đen một đoạn trong văn bản ở trên.</p>}
                    {highlights.map((h, i) => (
                      <div key={h.id} className="rounded-xl border border-line p-3 space-y-2">
                        <div className="flex items-start gap-2"><span className="chip chip-brand shrink-0">{i + 1}</span><p className="text-sm flex-1 break-words">“{h.text}”</p>
                          {!reading && <button className="p-1.5 rounded-lg text-mute hover:text-rose-500" aria-label="Xóa đánh dấu" onClick={() => updateHighlights(highlights.filter((x) => x.id !== h.id))}><Trash2 className="w-4 h-4" /></button>}</div>
                        {reading ? <p className="text-sm text-ink-2 pl-8">{h.note}</p>
                          : <input className="input !py-2 text-sm" value={h.note} placeholder="Ghi chú lý do…" onChange={(e) => updateHighlights(highlights.map((x) => (x.id === h.id ? { ...x, note: e.target.value } : x)))} />}
                      </div>
                    ))}
                  </div>

                  {!reading && (
                    <div className="card overflow-hidden">
                      <div className="px-5 py-3 border-b border-line flex items-center justify-between"><div className="font-bold flex items-center gap-2"><Bot className="w-5 h-5 text-brand" />Hỏi AI gợi ý</div><span className="chip chip-brand"><Sparkles className="w-3 h-3" />Socratic: không chỉ lỗi hộ</span></div>
                      <ChatBox compact messages={byPhase("critique")} userName={userName} userAvatar={userAvatar} disabled={false} placeholder="Hỏi cách kiểm tra văn bản…" empty="AI sẽ chỉ hỏi gợi mở và gợi ý cách kiểm tra, không nói lỗi nằm ở đâu." onSend={(t) => sendChat("critique", t)} />
                    </div>
                  )}
                  {!reading && (
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <span className="text-xs text-mute">{!highlights.length ? "Cần ít nhất 1 đánh dấu." : !allNoted ? "Mỗi đánh dấu cần có ghi chú." : "Sau khi hoàn tất, bạn sẽ không quay lại bước này để sửa."}</span>
                      <button className="btn btn-primary" disabled={busy || !allNoted} onClick={finishCritique}>Hoàn tất phản biện & sang bước 3<ChevronRight className="w-4 h-4" /></button>
                    </div>
                  )}
                </>
              )}

              {/* ---------------- step 3 ---------------- */}
              {!submitted && view === 3 && (
                <>
                  <div className="card p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-bold flex items-center gap-2"><PenLine className="w-5 h-5 text-brand" />Bước 3 · Chỉnh sửa văn bản</div>
                      <span className="text-xs text-mute">{wordCount(revision)} từ</span>
                    </div>
                    <p className="text-sm text-ink-2">Sửa trực tiếp văn bản AI thành bản của bạn. Hệ thống lưu lịch sử chỉnh sửa để giảng viên thấy bạn <strong className="text-ink">sửa tại chỗ</strong> hay <strong className="text-ink">xóa viết lại</strong>.</p>
                    <textarea className="input resize-y leading-7 text-[1.02rem]" rows={12} value={revision} onChange={(e) => onRevisionChange(e.target.value)}
                      onPaste={(e) => { stats.current.pasted += e.clipboardData.getData("text").length; }} aria-label="Văn bản cần chỉnh sửa" />
                    <details className="rounded-xl border border-line"><summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold">Ghi chú phản biện của bạn ({highlights.length})</summary>
                      <ul className="px-4 pb-3 space-y-1.5 text-sm">{highlights.map((h, i) => <li key={h.id}><span className="chip chip-brand mr-1.5">{i + 1}</span>“{h.text}” <span className="text-ink-2">— {h.note}</span></li>)}</ul></details>
                  </div>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-xs text-mute">Khi nộp, AI sẽ chấm 5 chiều (có thể mất vài chục giây).</span>
                    <button className="btn btn-primary" disabled={busy || !revision.trim()} onClick={() => setConfirm(true)}><Upload className="w-4 h-4" />Nộp bài</button>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <Modal open={confirm} onClose={() => !busy && setConfirm(false)} title="Xác nhận nộp bài" icon={<Upload className="w-5 h-5" />} maxWidth="max-w-md">
        <p className="text-sm text-ink-2">Sau khi nộp, bạn <strong className="text-ink">không thể sửa hay nộp lại</strong>. Hệ thống sẽ dùng AI chấm 5 chiều dựa trên prompt, đánh dấu và bản sửa của bạn.</p>
        {pastDue && <p className="text-sm text-amber-600 mt-2">Bài sẽ được ghi nhận là nộp trễ.</p>}
        <div className="flex justify-end gap-2 mt-5"><button className="btn btn-ghost" disabled={busy} onClick={() => setConfirm(false)}>Xem lại</button><button className="btn btn-primary" disabled={busy} onClick={submitFinal}>{busy ? "Đang chấm…" : "Nộp bài"}</button></div>
      </Modal>
    </div>
  );
};

/* ---------- result shown to the student after submitting ---------- */
const L2Result: React.FC<{ sub: Submission; assignment: Assignment; feedback?: any }> = ({ sub, assignment, feedback }) => {
  const dims = assignment.l2!.dimensions;
  const scoreOf = (key: string) => sub.l2_teacher_scores?.[key] ?? sub.l2_result?.dimensions.find((d) => d.key === key)?.score;
  const radar = dims.map((d) => ({ subject: d.name.split(" ")[0] + (d.name.split(" ")[1] ? " " + d.name.split(" ")[1] : ""), v: scoreOf(d.key) || 0 }));
  const hasScores = !!sub.l2_result || !!sub.l2_teacher_scores;
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="font-bold flex items-center gap-2 mb-3"><Award className="w-5 h-5 text-amber-500" />Kết quả của bạn</h3>
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="space-y-3">
            <div><div className="text-xs text-mute">Điểm giảng viên</div><div className="text-4xl font-extrabold">{sub.grade !== undefined ? sub.grade : "—"}<span className="text-base text-mute font-semibold">{sub.grade !== undefined ? "/10" : ""}</span></div></div>
            {sub.grade === undefined && <p className="text-xs text-mute">Giảng viên chưa chấm điểm chính thức. Bạn sẽ nhận thông báo khi có kết quả.</p>}
            {sub.feedback && <div className="rounded-xl bg-surface-2 border border-line p-3 text-sm"><div className="text-xs font-bold text-mute mb-1">Nhận xét của giảng viên</div>{sub.feedback}</div>}
            {sub.eval_status === "failed" && <div className="rounded-xl bg-[#fff4de] dark:bg-[#33260c] text-[#8a5300] dark:text-[#fbbf4a] p-3 text-xs flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />Phần AI chấm 5 chiều chưa chạy được. Giảng viên sẽ chạy lại, bài nộp của bạn vẫn được lưu đầy đủ.</div>}
            {sub.l2_result?.overall_comment && <p className="text-sm text-ink-2">{sub.l2_result.overall_comment}</p>}
          </div>
          {hasScores && <div className="h-56"><ResponsiveContainer width="100%" height="100%"><RadarChart outerRadius="68%" data={radar}><PolarGrid stroke="var(--line)" /><PolarAngleAxis dataKey="subject" tick={{ fill: "var(--ink-2)", fontSize: 11 }} /><PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} /><Radar dataKey="v" stroke="#5b5bf0" fill="#5b5bf0" fillOpacity={0.3} animationDuration={900} /></RadarChart></ResponsiveContainer></div>}
        </div>
      </div>

      {hasScores && (
        <div className="card p-5 space-y-4">
          <h3 className="font-bold">Điểm theo từng chiều</h3>
          {dims.map((d) => {
            const r = sub.l2_result?.dimensions.find((x) => x.key === d.key);
            const sc = scoreOf(d.key) || 0;
            return (
              <div key={d.key}>
                <div className="flex justify-between text-sm mb-1"><span className="font-semibold">{d.name}</span><strong>{sc}/5</strong></div>
                <Bar value={(sc / 5) * 100} />
                {r?.comment && <p className="text-xs text-ink-2 mt-1.5">{r.comment}</p>}
              </div>
            );
          })}
        </div>
      )}

      {feedback && (
        <div className="card p-5 space-y-3">
          <h3 className="font-bold">Bạn bắt được {feedback.caught.length}/{feedback.total} lỗi cài sẵn</h3>
          {feedback.caught.map((c: any, i: number) => (
            <div key={i} className="rounded-xl border border-emerald-400/40 bg-[#e7f8ef] dark:bg-[#0e2a1f] p-3 text-sm">
              <div className="text-xs font-bold mb-1">{L2_ERROR_LABEL[c.type as keyof typeof L2_ERROR_LABEL] || "Lỗi"} · đã bắt được</div>
              <p className="italic break-words">“{c.text}”</p>
              {c.answer && <p className="text-xs text-ink-2 mt-1.5"><strong>Đáp án:</strong> {c.answer}</p>}
            </div>
          ))}
          {feedback.missed_count > 0 && (feedback.missed.length > 0
            ? feedback.missed.map((m: any, i: number) => (
              <div key={i} className="rounded-xl border border-rose-400/40 bg-[#ffe9ec] dark:bg-[#3a1320] p-3 text-sm">
                <div className="text-xs font-bold mb-1">{L2_ERROR_LABEL[m.type as keyof typeof L2_ERROR_LABEL] || "Lỗi"} · bạn bỏ sót</div>
                <p className="italic break-words">“{m.text}”</p>{m.answer && <p className="text-xs text-ink-2 mt-1.5"><strong>Đáp án:</strong> {m.answer}</p>}
              </div>))
            : <p className="text-sm text-ink-2">Bạn còn bỏ sót <strong>{feedback.missed_count}</strong> lỗi. Chi tiết sẽ hiện sau hạn nộp của bài.</p>)}
          {feedback.false_positive_count > 0 && <p className="text-xs text-mute">Có {feedback.false_positive_count} đánh dấu không trùng lỗi cài sẵn nào.</p>}
        </div>
      )}
    </div>
  );
};
