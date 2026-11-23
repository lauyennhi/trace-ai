import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, BookOpen, Check, FlaskConical, Lock, PenLine, Quote, Search, Shield, Sparkles, Trash2, X } from "lucide-react";
import { api } from "../lib/api";
import { LAB_LIMITS } from "../lib/stages";
import { HmmLoader } from "./HmmBrand";
import { Avatar, EmptyState, fmtDate, useToast } from "./ui";

/* Perspective Lab ("Góc nhìn khác"): a separate mode, not a stage of an assignment.
   1 Canvas  2 Highlight -> "Hmm... góc nhìn khác thì sao?"  3 Counter-lens in a side panel  4 Friction: defend or adjust. */

const KIND_LABEL: Record<string, string> = { phan_bien: "Góc nhìn phản biện", he_qua_dai_han: "Hệ quả dài hạn", gia_dinh_ngam: "Giả định ngầm bị bỏ sót" };
const SRC_LABEL: Record<string, string> = { sample: "Bài luận mẫu", ai: "Đoạn AI viết", own: "Bài nháp của tôi" };

interface LabEvent {
  id: string; selection: { start: number; end: number; text: string }; mode: "tranh_luan" | "su_kien"; reason?: string;
  counterviews: { kind: string; stance: string; argument: string; source: { title: string; verified: boolean } | null }[];
  verify?: { claim_to_check: string; how_to_check: string[] };
  action?: "defend" | "adjust"; defense?: { text: string };
  rewrite?: { before: string; after: string; similarity: number; rewritten_from_scratch: boolean };
}
export interface LabSession { id: string; student_id: string; course_id: string; title: string; kind: "sample" | "ai" | "own"; text: string; pasted_chars: number; events: LabEvent[]; created_at: string; student_name?: string }

/* ------------------------------------------------------------------------------------------ canvas */
type Seg = { type: "plain"; start: number; text: string } | { type: "event"; ev: LabEvent };
function segments(text: string, events: LabEvent[]): Seg[] {
  const evs = [...events].sort((a, b) => a.selection.start - b.selection.start), out: Seg[] = [];
  let pos = 0;
  for (const ev of evs) {
    if (ev.selection.start > pos) out.push({ type: "plain", start: pos, text: text.slice(pos, ev.selection.start) });
    out.push({ type: "event", ev }); pos = ev.selection.end;
  }
  if (pos < text.length) out.push({ type: "plain", start: pos, text: text.slice(pos) });
  return out;
}
/** Maps a DOM selection boundary back to an offset in the original text. Returns null if it is not inside plain (not yet challenged) text. */
function resolve(node: Node, off: number, end: boolean): number | null {
  let n: Node | null = node, o = off;
  if (n.nodeType !== 3) {   // element boundary (e.g. triple click): descend to the nearest text node
    const kids = n.childNodes;
    let child: Node | null = kids[Math.min(o, kids.length - 1)] || null;
    if (!child) return null;
    if (end && o > 0 && o <= kids.length) child = kids[o - 1];
    while (child && child.nodeType !== 3 && child.childNodes.length) child = end ? child.childNodes[child.childNodes.length - 1] : child.childNodes[0];
    if (!child || child.nodeType !== 3) return null;
    n = child; o = end ? (child.textContent || "").length : 0;
  }
  const holder = (n.parentElement as HTMLElement | null)?.closest("[data-start]") as HTMLElement | null;
  if (!holder) return null;
  return Number(holder.dataset.start) + o;
}

const Canvas: React.FC<{ session: LabSession; pending: boolean; onLens: (start: number, end: number) => void; busy: boolean }> = ({ session, pending, onLens, busy }) => {
  const box = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<{ start: number; end: number; top: number; left: number } | null>(null);
  const toast = useToast();
  const segs = useMemo(() => segments(session.text, session.events), [session.text, session.events]);

  const read = useCallback(() => {
    const s = window.getSelection();
    if (!s || s.rangeCount === 0 || s.isCollapsed || !box.current || !box.current.contains(s.anchorNode) || !box.current.contains(s.focusNode)) { setSel(null); return; }
    const r = s.getRangeAt(0);
    let a = resolve(r.startContainer, r.startOffset, false), b = resolve(r.endContainer, r.endOffset, true);
    if (a === null || b === null || a === b) { setSel(null); return; }
    if (a > b) [a, b] = [b, a];
    while (a < b && /\s/.test(session.text[a])) a++;
    while (b > a && /\s/.test(session.text[b - 1])) b--;
    if (b - a < LAB_LIMITS.minSel) { setSel(null); return; }
    const rect = r.getBoundingClientRect(), host = box.current.getBoundingClientRect();
    setSel({ start: a, end: b, top: rect.top - host.top - 46, left: Math.min(Math.max(rect.left - host.left + rect.width / 2, 120), host.width - 120) });
  }, [session.text]);

  useEffect(() => {
    const on = () => { if (!pending && !busy) read(); };
    document.addEventListener("mouseup", on); document.addEventListener("keyup", on);
    return () => { document.removeEventListener("mouseup", on); document.removeEventListener("keyup", on); };
  }, [read, pending, busy]);

  const go = () => {
    if (!sel) return;
    if (sel.end - sel.start > LAB_LIMITS.maxSel) return toast.error(`Hãy chọn đoạn ngắn hơn (tối đa ${LAB_LIMITS.maxSel} ký tự).`);
    if (session.events.some((e) => sel.start < e.selection.end && sel.end > e.selection.start)) return toast.error("Vùng chọn trùng một đoạn bạn đã đối chất. Hãy chọn đoạn khác.");
    onLens(sel.start, sel.end); setSel(null); window.getSelection()?.removeAllRanges();
  };

  return (
    <div ref={box} className="relative" data-testid="lab-canvas">
      <div className="card p-6 md:p-9 text-[17px] leading-[1.9] whitespace-pre-wrap select-text" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
        {segs.map((g, i) => g.type === "plain"
          ? <span key={i} data-start={g.start}>{g.text}</span>
          : <span key={g.ev.id} data-event={g.ev.id}
              className={`rounded px-0.5 ${!g.ev.action ? "bg-[#fff3c4] dark:bg-[#4a3d0a] underline decoration-[#d9a400] decoration-2 underline-offset-4" : g.ev.action === "adjust" ? "bg-[#e1f5ea] dark:bg-[#0e2a1f]" : "bg-brand-soft"}`}
              title={g.ev.action === "adjust" ? `Câu gốc: ${g.ev.selection.text}` : g.ev.action === "defend" ? "Bạn đã bảo vệ đoạn này" : "Đang chờ bạn đối chất"}>
              {g.ev.action === "adjust" && g.ev.rewrite ? g.ev.rewrite.after : g.ev.selection.text}
            </span>)}
      </div>
      <AnimatePresence>
        {sel && !pending && !busy && (
          <motion.button key="hmm" initial={{ opacity: 0, y: 6, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
            onMouseDown={(e) => e.preventDefault()} onClick={go} data-testid="lab-hmm"
            className="absolute z-20 -translate-x-1/2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-lg ring-4 ring-brand/15 dark:text-[#062e6f]" style={{ top: Math.max(sel.top, 4), left: sel.left }}>
            Hmm... góc nhìn khác thì sao?
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ------------------------------------------------------------------------------------------ counter-lens panel */
const LensPanel: React.FC<{ session: LabSession; ev: LabEvent; onDone: (s: LabSession) => void }> = ({ session, ev, onDone }) => {
  const toast = useToast();
  const [mode, setMode] = useState<"defend" | "adjust" | null>(null);
  const [text, setText] = useState(""), [busy, setBusy] = useState(false);
  const stats = useRef({ typed: 0, deleted: 0 });
  useEffect(() => { setMode(null); setText(""); stats.current = { typed: 0, deleted: 0 }; }, [ev.id]);
  const choose = (m: "defend" | "adjust") => { setMode(m); setText(m === "adjust" ? ev.selection.text : ""); stats.current = { typed: 0, deleted: 0 }; };
  const change = (v: string) => {
    const d = v.length - text.length;
    if (d > 0) stats.current.typed += d; else stats.current.deleted += -d;
    setText(v);
  };
  const noPaste = (e: React.ClipboardEvent) => { e.preventDefault(); toast.error("Phần này cần bạn tự gõ bằng lời của mình, không dán."); };
  const ok = mode === "defend" ? text.trim().length >= LAB_LIMITS.minRebut : mode === "adjust" ? text.trim().length >= LAB_LIMITS.minAfter && text.trim() !== ev.selection.text.trim() : false;
  const submit = async () => {
    if (!mode || !ok) return;
    setBusy(true);
    try {
      const r = await api<{ session: LabSession }>(`/api/lab/sessions/${session.id}/respond`, { method: "POST", body: { event_id: ev.id, action: mode, ...(mode === "defend" ? { text } : { after_text: text }), typed: stats.current.typed, deleted: stats.current.deleted, pasted: 0 } });
      toast.success(mode === "defend" ? "Đã ghi nhận phản biện của bạn." : "Đã cập nhật câu của bạn.");
      onDone(r.session);
    } catch (e: any) { toast.error(e?.message || "Chưa gửi được."); }
    setBusy(false);
  };

  return (
    <div className="flex h-full flex-col" data-testid="lab-panel">
      <div className="border-b border-line p-5">
        <div className="flex items-center gap-2 text-xs font-bold text-brand"><FlaskConical className="h-4 w-4" />Lăng kính đối lập</div>
        <blockquote className="mt-3 border-l-4 border-[#d9a400] bg-[#fff8dc] px-3 py-2 text-sm italic text-ink-2 dark:bg-[#3a3008]">“{ev.selection.text}”</blockquote>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {ev.mode === "tranh_luan" && ev.counterviews.map((v, i) => (
          <article key={i} className="rounded-2xl border border-line bg-surface p-4" data-testid="lab-view">
            <div className="chip chip-brand mb-2">{KIND_LABEL[v.kind] || "Góc nhìn khác"}</div>
            <h4 className="text-sm font-semibold">{v.stance}</h4>
            <p className="mt-1 text-sm leading-relaxed text-ink-2">{v.argument}</p>
            <p className="mt-2 text-[11px] text-mute">{v.source ? <span className="inline-flex items-center gap-1"><BookOpen className="h-3 w-3" />Từ tài liệu lớp: {v.source.title}</span> : "Lập luận do AI soạn, chưa có nguồn. Hãy tự kiểm chứng."}</p>
          </article>
        ))}
        {ev.mode === "su_kien" && ev.verify && (
          <article className="rounded-2xl border border-line bg-surface p-4" data-testid="lab-verify">
            <div className="chip chip-gray mb-2"><Search className="h-3 w-3" />Câu này cần kiểm chứng</div>
            <h4 className="text-sm font-semibold">{ev.verify.claim_to_check}</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">{ev.verify.how_to_check.map((h, i) => <li key={i}>{h}</li>)}</ul>
          </article>
        )}

        <div className="rounded-2xl bg-surface-2 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><Lock className="h-4 w-4 text-brand" />Chọn một hành động để tiếp tục</div>
          <p className="mt-1 text-xs text-mute">Chỉ đọc rồi đóng lại thì chưa phải tư duy. Hãy đối chất với góc nhìn này.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {([["defend", Shield, "Bảo vệ luận điểm", "Viết 1–2 câu phản bác góc nhìn trên"], ["adjust", PenLine, "Điều chỉnh câu gốc", "Sửa đoạn vừa bôi đen cho chặt chẽ, đa chiều hơn"]] as const).map(([id, Icon, label, hint]) => (
              <button key={id} type="button" onClick={() => choose(id)} data-testid={`lab-${id}`}
                className={`rounded-xl border p-3 text-left transition ${mode === id ? "border-brand bg-brand-soft ring-4 ring-brand/10" : "border-line bg-surface hover:border-brand/40"}`}>
                <div className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-brand" />{label}</div>
                <div className="mt-0.5 text-[11px] text-mute">{hint}</div>
              </button>
            ))}
          </div>
          {mode && (
            <div className="mt-3 space-y-2">
              <textarea className="input resize-y" rows={mode === "adjust" ? 5 : 3} value={text} onChange={(e) => change(e.target.value)} onPaste={noPaste} onDrop={(e) => e.preventDefault()} data-testid="lab-text" aria-label={mode === "defend" ? "Phản bác của bạn" : "Câu sau khi chỉnh"}
                placeholder={mode === "defend" ? "Vì sao luận điểm của bạn vẫn đứng vững trước góc nhìn trên?" : "Viết lại đoạn này cho chặt chẽ hơn…"} />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-mute">{mode === "defend" ? `Tối thiểu ${LAB_LIMITS.minRebut} ký tự` : "Cần khác câu gốc"} · tự gõ, không dán</span>
                <button type="button" className="btn btn-primary btn-sm" disabled={!ok || busy} onClick={submit} data-testid="lab-submit">{busy ? "Đang gửi…" : <>Ghi nhận <ArrowRight className="h-4 w-4" /></>}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------------------------------ one session */
const SessionView: React.FC<{ session: LabSession; onChange: (s: LabSession) => void; onBack: () => void }> = ({ session, onChange, onBack }) => {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [clarify, setClarify] = useState("");
  const pendingEv = session.events.find((e) => !e.action) || null;
  const done = session.events.filter((e) => e.action);
  const lens = async (start: number, end: number) => {
    setBusy(true); setClarify("");
    try {
      const r = await api<{ event: LabEvent | null; clarify?: string; session: LabSession }>(`/api/lab/sessions/${session.id}/lens`, { method: "POST", body: { start, end } });
      if (r.clarify) setClarify(r.clarify);
      onChange(r.session);
    } catch (e: any) { toast.error(e?.message || "Chưa mở được góc nhìn khác."); }
    setBusy(false);
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><button className="text-xs font-semibold text-brand hover:underline" onClick={onBack}>← Tất cả phiên</button>
          <h2 className="mt-1 text-xl font-medium">{session.title}</h2>
          <p className="text-xs text-mute">{SRC_LABEL[session.kind]} · {done.length} đoạn đã đối chất ({done.filter((e) => e.action === "defend").length} bảo vệ, {done.filter((e) => e.action === "adjust").length} điều chỉnh)</p></div>
        <div className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-2"><Sparkles className="mr-1 inline h-3.5 w-3.5 text-brand" />Bôi đen một câu khẳng định, rồi bấm “Hmm… góc nhìn khác thì sao?”</div>
      </div>
      {clarify && <div className="rounded-xl border border-line bg-surface p-3 text-sm text-ink-2" role="status">{clarify}</div>}
      {busy && <div className="card p-4 text-ink-2"><HmmLoader label="AI đang tìm góc nhìn khác" /></div>}
      <Canvas session={session} pending={!!pendingEv} busy={busy} onLens={lens} />

      <AnimatePresence>
        {pendingEv && (
          <>
            <motion.div key="shade" className="fixed inset-0 z-40 bg-black/20 md:bg-transparent md:pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.aside key="panel" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed bottom-0 right-0 top-16 z-50 w-full border-l border-line bg-bg shadow-2xl sm:w-[28rem]" aria-label="Lăng kính đối lập">
              <LensPanel session={session} ev={pendingEv} onDone={onChange} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ------------------------------------------------------------------------------------------ student page */
export const LabPage: React.FC<{ courses: { id: string; name: string }[]; courseId?: string }> = ({ courses, courseId: fixed }) => {
  const toast = useToast();
  const [picked, setCourseId] = useState("");
  const courseId = fixed || (courses.some((c) => c.id === picked) ? picked : courses[0]?.id) || "";   // follows the course list even if it loads after this page opens
  const [sessions, setSessions] = useState<LabSession[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [samples, setSamples] = useState<{ id: string; title: string; preview: string }[]>([]);
  const [src, setSrc] = useState<"sample" | "ai" | "own">("sample");
  const [sampleId, setSampleId] = useState(""), [topic, setTopic] = useState(""), [own, setOwn] = useState(""), [title, setTitle] = useState("");
  const pasted = useRef(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api("/api/lab/samples").then((d: any) => { setSamples(d); if (d[0]) setSampleId(d[0].id); }).catch(() => {}); }, []);
  useEffect(() => { if (!courseId) return; setSessions(null); setOpenId(null); api<LabSession[]>(`/api/lab/sessions?course_id=${courseId}`).then(setSessions).catch((e) => { setSessions([]); toast.error(e?.message || "Không tải được phiên Lab."); }); }, [courseId]);

  const upsert = (s: LabSession) => setSessions((list) => (list || []).map((x) => (x.id === s.id ? s : x)));
  const create = async () => {
    setBusy(true);
    try {
      const body: any = { course_id: courseId, kind: src, title: title.trim() || undefined };
      if (src === "sample") body.sample_id = sampleId; else if (src === "ai") body.topic = topic; else { body.text = own; body.pasted_chars = pasted.current; }
      const s = await api<LabSession>("/api/lab/sessions", { method: "POST", body });
      setSessions((l) => [s, ...(l || [])]); setOpenId(s.id); setTitle(""); setTopic(""); setOwn(""); pasted.current = 0;
    } catch (e: any) { toast.error(e?.message || "Chưa tạo được phiên."); }
    setBusy(false);
  };
  const remove = async (s: LabSession) => {
    try { await api(`/api/lab/sessions/${s.id}`, { method: "DELETE" }); setSessions((l) => (l || []).filter((x) => x.id !== s.id)); toast.success("Đã xóa phiên."); } catch (e: any) { toast.error(e?.message || "Chưa xóa được."); }
  };
  const open = sessions?.find((s) => s.id === openId) || null;

  if (!courses.length) return <EmptyState icon={<FlaskConical className="h-6 w-6" />} title="Chưa có môn học" text="Hãy tham gia một môn học bằng mã mời để dùng Phòng Lab." />;
  if (open) return <SessionView session={open} onChange={upsert} onBack={() => setOpenId(null)} />;

  const canCreate = src === "sample" ? !!sampleId : src === "ai" ? topic.trim().length >= 5 : own.trim().length >= LAB_LIMITS.minText;
  return (
    <div className="space-y-6" data-testid="lab-home">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><div className="flex items-center gap-2 text-xs font-bold text-brand"><FlaskConical className="h-4 w-4" />Perspective Lab</div>
          <h1 className="mt-1 text-2xl font-medium">Góc nhìn khác</h1>
          <p className="mt-1 max-w-xl text-sm text-ink-2">Mở một văn bản, bôi đen một luận điểm, xem góc nhìn đối lập, rồi bảo vệ hoặc chỉnh lại câu của bạn. Không cần nộp, không chấm điểm.</p></div>
        {!fixed && courses.length > 1 && <select className="input !w-auto" value={courseId} onChange={(e) => setCourseId(e.target.value)} aria-label="Môn học">{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
      </div>

      <section className="card p-5 space-y-4">
        <div className="text-sm font-semibold">Bắt đầu phiên mới: bạn muốn đọc văn bản nào?</div>
        <div className="grid gap-2 sm:grid-cols-3" role="tablist">
          {([["sample", "Bài luận mẫu có thiên kiến"], ["ai", "Đoạn văn AI vừa viết"], ["own", "Bài nháp của chính tôi"]] as const).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={src === id} onClick={() => setSrc(id)} data-testid={`lab-src-${id}`}
              className={`rounded-xl border p-3 text-left text-sm font-semibold transition ${src === id ? "border-brand bg-brand-soft ring-4 ring-brand/10" : "border-line hover:border-brand/40"}`}>{label}</button>
          ))}
        </div>
        {src === "sample" && <div className="grid gap-2">{samples.map((s) => (
          <label key={s.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${sampleId === s.id ? "border-brand bg-brand-soft" : "border-line"}`}><input type="radio" className="mt-1" checked={sampleId === s.id} onChange={() => setSampleId(s.id)} />
            <span><span className="block text-sm font-semibold">{s.title}</span><span className="block text-xs text-mute">{s.preview}</span></span></label>))}</div>}
        {src === "ai" && <div><label className="label">Chủ đề để AI viết một đoạn</label><input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ví dụ: Có nên bỏ bài kiểm tra miệng trong trường học?" data-testid="lab-topic" /></div>}
        {src === "own" && <div><label className="label">Dán hoặc gõ bài nháp của bạn (tối thiểu {LAB_LIMITS.minText} ký tự)</label>
          <textarea className="input resize-y" rows={7} value={own} data-paste-ok data-testid="lab-own" onPaste={(e) => { pasted.current += e.clipboardData.getData("text").length; }} onChange={(e) => setOwn(e.target.value)} placeholder="Bài nháp của chính bạn. Dán được ở đây vì đó là tài liệu của bạn." /></div>}
        <div className="flex flex-wrap items-center gap-3">
          <input className="input !w-64" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tên phiên (tùy chọn)" maxLength={LAB_LIMITS.maxTitle} aria-label="Tên phiên" />
          <button className="btn btn-primary" disabled={!canCreate || busy} onClick={create} data-testid="lab-create">{busy ? <HmmLoader label="Đang chuẩn bị" /> : <>Mở văn bản <ArrowRight className="h-4 w-4" /></>}</button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink-2">Phiên của tôi</h2>
        {sessions === null ? <div className="card p-6 text-sm text-mute">Đang tải…</div>
          : sessions.length === 0 ? <div className="card p-6 text-sm text-mute">Chưa có phiên nào. Hãy mở một văn bản ở trên.</div>
          : <div className="grid gap-3 md:grid-cols-2">{sessions.map((s) => {
            const d = s.events.filter((e) => e.action), p = s.events.find((e) => !e.action);
            return (
              <div key={s.id} className="card flex items-start justify-between gap-3 p-4" data-testid="lab-session-card">
                <button className="min-w-0 flex-1 text-left" onClick={() => setOpenId(s.id)}>
                  <div className="truncate text-sm font-semibold">{s.title}</div>
                  <div className="mt-1 text-xs text-mute">{SRC_LABEL[s.kind]} · {fmtDate(s.created_at)}</div>
                  <div className="mt-2 flex gap-2 text-[11px]"><span className="chip chip-gray">{d.length} đoạn đã đối chất</span>{p && <span className="chip chip-amber">Đang chờ bạn đối chất</span>}</div>
                </button>
                <button className="btn btn-ghost btn-icon !text-[#d93025]" aria-label="Xóa phiên" onClick={() => remove(s)}><Trash2 className="h-4 w-4" /></button>
              </div>);
          })}</div>}
      </section>
    </div>
  );
};

/* ------------------------------------------------------------------------------------------ teacher view */
export const LabTeacherPanel: React.FC<{ courseId: string }> = ({ courseId }) => {
  const [list, setList] = useState<LabSession[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api<LabSession[]>(`/api/courses/${courseId}/lab`).then(setList).catch((e) => { setErr(e?.message || "Không tải được."); setList([]); }); }, [courseId]);
  if (list === null) return <div className="card p-6 text-sm text-mute">Đang tải…</div>;
  if (err) return <div className="card p-6 text-sm text-ink-2">{err}</div>;
  if (!list.length) return <EmptyState icon={<FlaskConical className="h-6 w-6" />} title="Chưa có phiên Góc nhìn khác nào" text="Sinh viên mở Phòng Lab ở thanh bên trái. Mỗi lần bôi đen một luận điểm và đối chất sẽ hiện ở đây." />;
  return (
    <div className="space-y-3" data-testid="lab-teacher">
      <p className="text-xs text-mute">Phòng Lab là chế độ luyện tập của sinh viên, không chấm điểm. Đây là dấu vết tư duy để bạn xem.</p>
      {list.map((s) => (
        <details key={s.id} className="card p-4">
          <summary className="flex cursor-pointer flex-wrap items-center gap-3">
            <Avatar name={s.student_name || "?"} />
            <span className="text-sm font-semibold">{s.student_name}</span><span className="text-sm text-ink-2">{s.title}</span>
            <span className="ml-auto flex gap-2 text-[11px]"><span className="chip chip-gray">{SRC_LABEL[s.kind]}</span><span className="chip chip-brand">{s.events.filter((e) => e.action).length} đoạn</span></span>
          </summary>
          <div className="mt-4 space-y-3">
            {s.events.length === 0 && <p className="text-sm text-mute">Chưa bôi đen đoạn nào.</p>}
            {s.events.map((e) => (
              <div key={e.id} className="rounded-xl border border-line p-3 text-sm">
                <p className="italic text-ink-2">“{e.selection.text}”</p>
                {e.counterviews.map((v, i) => <p key={i} className="mt-2 text-xs text-ink-2"><b>{KIND_LABEL[v.kind] || "Góc nhìn"}:</b> {v.stance}</p>)}
                {e.action === "defend" && <p className="mt-2 rounded-lg bg-brand-soft p-2"><b className="text-brand">Bảo vệ:</b> {e.defense?.text}</p>}
                {e.action === "adjust" && e.rewrite && <p className="mt-2 rounded-lg bg-[#e1f5ea] p-2 dark:bg-[#0e2a1f]"><b>Điều chỉnh:</b> {e.rewrite.after}<span className="ml-2 text-[11px] text-mute">(giống câu gốc {Math.round(e.rewrite.similarity * 100)}%{e.rewrite.rewritten_from_scratch ? ", viết lại từ đầu" : ""})</span></p>}
                {!e.action && <p className="mt-2 text-xs text-amber-600">Chưa đối chất.</p>}
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
};
