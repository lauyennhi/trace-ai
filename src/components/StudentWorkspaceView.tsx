import { PasteGuard } from "./PasteGuard";
import { CoachChip } from "./CoachChip";
import { StageBar, AysView } from "./StageViews";
import { computeStages, submitBlocker, coThinkTurns, stageConfig, type StageId } from "../lib/stages";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Send, Bot, Sparkles, Paperclip, CheckCircle2, Lock, FileText, Upload, ChevronDown, Award, Clock,
  PartyPopper, Save, BookOpenText, ListChecks, AlertTriangle, MessageSquareText, PenLine,
} from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { Assignment, Submission, ChatSession, ProcessScoreResult } from "../types";
import { FileUploadZone, UploadedFileItem } from "./FileUploadZone";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ThinkingTrace } from "./ThinkingTrace";
import { HmmLoader } from "./HmmBrand";
import { StudentResultSection } from "./StudentResultSection";
import { GatedAnswer } from "./GatedAnswer";
import { Avatar, Modal, Bar, fmtDate, relTime, useToast } from "./ui";

interface Props {
  assignment: Assignment;
  courseName?: string;
  userName: string;
  userAvatar?: string;
  submission: Submission | null;
  chatSession: ChatSession | null;
  onSubmitAssignment: (data: { assignment_id: string; submitted_files: any[]; submitted_text: string; notes?: string }) => Promise<Submission>;
  onSaveDraft: (data: { assignment_id: string; submitted_files: any[]; submitted_text: string }) => Promise<void>;
  onSendMessage: (data: { assignment_id: string; message_content: string; pasted_chars?: number; paste_attempts?: number }) => Promise<{ chat_session: ChatSession }>;
  onUnlock: (data: { assignment_id: string; message_id: string; answers?: string[]; skip?: boolean }) => Promise<{ chat_session: ChatSession }>;
  onSubmitIntent: (data: { assignment_id: string; answers?: string[]; skip?: boolean; pasted_chars?: number; paste_attempts?: number }) => Promise<{ chat_session: ChatSession }>;
}

const MIN_TURNS = 3;

export const StudentWorkspaceView: React.FC<Props> = ({ assignment, courseName, userName, userAvatar, submission, chatSession, onSubmitAssignment, onSaveDraft, onSendMessage, onSubmitIntent, onUnlock }) => {
  const toast = useToast();
  const [messages, setMessages] = useState<any[]>(chatSession?.messages || []);
  const [intentDone, setIntentDone] = useState<boolean>(!!chatSession?.intent);
  const [intentData, setIntentData] = useState<ChatSession["intent"]>(chatSession?.intent);
  const [tab, setTab] = useState<"de" | "rubric" | "doc">("de");
  const [ideas, setIdeas] = useState<string[]>(["", "", ""]);
  const [view, setView] = useState<StageId>("co_think");
  const [intentBusy, setIntentBusy] = useState(false);
  const ideasPasted = useRef(0);
  const pastedRef = useRef(0);
  const attemptsRef = useRef(0);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState<UploadedFileItem[]>((submission?.submitted_files || []).map((f) => ({ id: f.id, name: f.name, size: f.size || "Đã đính kèm", url: f.url, type: f.type || "file" })));
  const [text, setText] = useState(submission?.submitted_text || "");
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [current, setCurrent] = useState<Submission | null>(submission);
  const [celebrate, setCelebrate] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [draftState, setDraftState] = useState<"idle" | "saving" | "saved">("idle");
  const endRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  const submitted = current?.status === "submitted" || current?.status === "late";
  const pastDue = new Date(assignment.due_date) < new Date();
  const locked = submitted || (pastDue && assignment.allow_late === false);
  const chatEnabled = assignment.submission_mode !== "file_only";
  const friction = assignment.friction || "none";
  const frictionPrompts = assignment.friction_prompts?.length ? assignment.friction_prompts : ["Luận điểm cốt lõi của em về đề bài này là gì?", "Em định dùng dẫn chứng hoặc ví dụ nào?", "Điểm nào em còn băn khoăn hoặc chưa chắc?"];
  const answerGate = assignment.answer_gate && assignment.answer_gate !== "none" ? assignment.answer_gate : null;
  const lastModel = [...messages].reverse().find((m) => m.role === "model");
  const gateLocked = !!answerGate && lastModel?.gate?.state === "locked";
  const [unlockBusy, setUnlockBusy] = useState(false);
  const unlock = async (messageId: string, data: { answers?: string[]; skip?: boolean }) => {
    setUnlockBusy(true);
    try { const res = await onUnlock({ assignment_id: assignment.id, message_id: messageId, ...data }); setMessages(res.chat_session.messages); }
    catch (err: any) { toast.error(err.message || "Không mở khóa được câu trả lời."); }
    finally { setUnlockBusy(false); }
  };
  const needIntent = chatEnabled && friction !== "none" && !intentDone && !locked;
  const turns = coThinkTurns({ messages });
  const cfg = stageConfig(assignment);
  const chatLike = { messages, intent: intentData };
  const stageViews = computeStages(assignment, chatLike);
  const showStages = chatEnabled && assignment.submission_mode !== "writing_l2" && cfg.are_you_sure.enabled;
  const blocker = chatEnabled ? submitBlocker(assignment, chatLike) : null;
  const coMessages = messages.filter((m) => m.stage !== "are_you_sure");
  const needTurns = chatEnabled ? Math.max(0, MIN_TURNS - turns) : 0;
  const canSubmit = !locked && !sending && !blocker;

  useEffect(() => { if (!needIntent) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, sending, needIntent]);

  // Autosave draft (debounced) when file / text content changes
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (locked) return;
    setDraftState("saving");
    const t = setTimeout(async () => {
      try { await onSaveDraft({ assignment_id: assignment.id, submitted_files: files.map(({ rawFile, textContent, ...f }) => f), submitted_text: text }); setDraftState("saved"); }
      catch { setDraftState("idle"); }
    }, 1200);
    return () => clearTimeout(t);
  }, [files, text]);

  const send = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const userText = input.trim();
    if (!userText || sending || locked) return;
    let content = userText;
    if (files.length > 0 && messages.length === 0) {
      content += files.map((f) => `\n\n[File đính kèm: ${f.name} (${f.size})]${f.textContent ? `\nNội dung file:\n${f.textContent}` : ""}`).join("");
    }
    const tempId = "temp_" + Date.now();
    const pasted = pastedRef.current;
    setInput(""); setSending(true); pastedRef.current = 0;
    setMessages((p) => [...p, { id: tempId, role: "user", content: userText, timestamp: new Date().toISOString() }]);
    try {
      const res = await onSendMessage({ assignment_id: assignment.id, message_content: content, pasted_chars: pasted, paste_attempts: attemptsRef.current || undefined }); attemptsRef.current = 0;
      setMessages(res.chat_session.messages);
    } catch (err: any) {
      setMessages((p) => p.filter((m) => m.id !== tempId));
      setInput(userText); pastedRef.current = pasted;
      toast.error(err.message || "Không gửi được tin nhắn.");
    } finally { setSending(false); }
  }, [input, sending, locked, files, messages.length, assignment.id]);

  const submitIntent = async (skip: boolean) => {
    setIntentBusy(true);
    try {
      const res = await onSubmitIntent(skip
        ? { assignment_id: assignment.id, skip: true }
        : { assignment_id: assignment.id, answers: ideas, pasted_chars: ideasPasted.current, paste_attempts: attemptsRef.current || undefined });
      setMessages(res.chat_session.messages); setIntentDone(true); setIntentData(res.chat_session.intent);
    } catch (err: any) { toast.error(err.message || "Không gửi được ý của bạn."); }
    finally { setIntentBusy(false); }
  };

  const ideaChars = ideas.reduce((n, x) => n + x.trim().length, 0);
  const ideaCount = ideas.slice(0, frictionPrompts.length).filter((x) => x.trim()).length;
  const ideasOk = ideaCount >= Math.min(2, frictionPrompts.length) && ideaChars >= 40;

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      const sub = await onSubmitAssignment({ assignment_id: assignment.id, submitted_files: files.map(({ rawFile, textContent, ...f }) => f), submitted_text: text });
      setCurrent(sub); setConfirmOpen(false); setCelebrate(true);
      toast.success("Nộp bài thành công!");
      setTimeout(() => setCelebrate(false), 3200);
    } catch (err: any) { toast.error(err.message || "Không thể nộp bài."); setConfirmOpen(false); }
    finally { setSubmitting(false); }
  };

  const result: ProcessScoreResult | undefined = current?.process_score_result;
  const radar = result ? [
    { subject: "Phản biện", v: result.tieu_chi.tu_duy_phan_bien }, { subject: "Đào sâu", v: result.tieu_chi.dao_sau_van_de },
    { subject: "Kiểm chứng", v: result.tieu_chi.kiem_chung_thong_tin }, { subject: "Nội hóa", v: result.tieu_chi.noi_hoa_kien_thuc },
    { subject: "Chủ động", v: result.tieu_chi.tinh_chu_dong },
  ] : [];

  const promptPanel = (
    <div className="space-y-5">
      {chatEnabled && assignment.ai_submode === "socratic" && (
        <div className="rounded-2xl p-4 bg-gradient-to-br from-brand-soft to-transparent border border-brand/20">
          <div className="flex items-center gap-2 text-sm font-bold text-brand"><Sparkles className="w-4 h-4" />Chế độ Socratic</div>
          <p className="text-xs text-ink-2 mt-1.5 leading-relaxed">Trợ lý sẽ hỏi gợi mở thay vì đưa đáp án. Hãy phản biện, đào sâu và diễn giải bằng lời của bạn — đó là điều được chấm.</p>
        </div>
      )}
      <div className="flex gap-1.5 p-1 rounded-full bg-surface-2" role="tablist" aria-label="Thông tin bài tập">
        {([["de", "Yêu cầu đề bài", true], ["rubric", "Rubric", !!assignment.rubric], ["doc", "Tài liệu", assignment.attachments?.length > 0]] as const).filter((t) => t[2]).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${tab === id ? "bg-surface text-brand shadow-sm" : "text-ink-2 hover:text-ink"}`}>{label}</button>
        ))}
      </div>
      {tab === "de" && <div className="rounded-2xl bg-surface-2/60 border border-line p-4"><MarkdownRenderer content={assignment.description || "Không có mô tả bổ sung."} /></div>}
      {tab === "rubric" && assignment.rubric && <div className="rounded-2xl bg-surface-2/60 border border-line p-4"><MarkdownRenderer content={assignment.rubric} /></div>}
      {tab === "doc" && assignment.attachments?.length > 0 && (
        <div className="space-y-2">
          {assignment.attachments.map((att) => (
            <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" download={att.name} className="flex items-center justify-between gap-2 p-3 rounded-xl border border-line hover:border-brand/40 hover:bg-brand-soft/50 transition-colors text-sm">
              <span className="flex items-center gap-2 truncate"><FileText className="w-4 h-4 text-brand shrink-0" /><span className="truncate font-medium">{att.name}</span></span>
              <span className="text-xs text-mute shrink-0">{att.size}</span>
            </a>
          ))}
        </div>
      )}
      {intentDone && intentData && (
        <div className="rounded-2xl border border-emerald-400/30 bg-[#e7f8ef] dark:bg-[#0e2a1f] p-4" data-testid="ritual-card">
          <div className="flex items-center gap-2 text-xs font-bold text-[#0f8a55] dark:text-[#4ade9a]"><CheckCircle2 className="w-4 h-4" />{intentData.skipped ? "Đã bỏ qua bước ghi ý đầu vào" : "Đã ghi ý riêng trước khi hỏi AI"}</div>
          {!intentData.skipped && intentData.answers[0] && <p className="text-xs italic text-ink-2 mt-2 line-clamp-4">“{intentData.answers[0].a}”</p>}
          <div className="flex flex-wrap gap-2 mt-3 text-[11px]">
            {!intentData.skipped && <span className="chip chip-green"><Lock className="w-3 h-3" />Luận điểm đã được ghi lại</span>}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <PasteGuard enabled={assignment.paste_mode === "block"} attempts={attemptsRef} className="relative">
      <AnimatePresence>{celebrate && <Confetti />}</AnimatePresence>

      {/* Status bar */}
      <div className="card p-4 mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-brand">{courseName}</div>
          <h2 className="text-lg font-medium leading-tight truncate">{assignment.title}</h2>
          <div className="text-xs text-mute mt-1 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Hạn {fmtDate(assignment.due_date)} · {relTime(assignment.due_date)}
            {pastDue && !submitted && <span className="chip chip-rose ml-1">Quá hạn</span>}</div>
        </div>
        {chatEnabled && !locked && (
          <div className="min-w-[10rem]" aria-label={`Tiến trình hội thoại ${Math.min(turns, MIN_TURNS)} trên ${MIN_TURNS} lượt`}>
            <div className="text-[11px] font-semibold text-ink-2 mb-1.5">Tiến trình hội thoại</div>
            <div className="flex items-center">
              {Array.from({ length: MIN_TURNS }, (_, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className={`h-0.5 w-8 rounded-full ${turns > i ? "bg-brand" : "bg-line"}`} />}
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${turns > i ? "bg-brand text-white dark:text-[#062e6f]" : "border border-line text-mute"}`}>{i + 1}</span>
                </React.Fragment>
              ))}
              <span className="text-xs text-mute ml-2">{Math.min(turns, MIN_TURNS)}/{MIN_TURNS} lượt</span>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3">
          {!locked && <span className="text-xs text-mute hidden sm:flex items-center gap-1">{draftState === "saving" ? "Đang lưu nháp…" : draftState === "saved" ? <><Save className="w-3.5 h-3.5 text-emerald-500" />Đã lưu nháp</> : ""}</span>}
          {submitted ? <span className="chip chip-green py-1.5 px-3 text-sm"><CheckCircle2 className="w-4 h-4" />Đã nộp {current?.status === "late" ? "(trễ)" : ""}</span>
            : locked ? <span className="chip chip-rose py-1.5 px-3 text-sm"><Lock className="w-4 h-4" />Đã khóa</span>
            : <button className="btn btn-primary" disabled={!canSubmit} onClick={() => setConfirmOpen(true)} title={blocker || ""}><Upload className="w-4 h-4" />{needTurns ? `Còn ${needTurns} lượt để nộp` : blocker ? "Cần xong các chặng" : "Nộp bài"}</button>}
        </div>
      </div>

      {submitted && <div className="mb-5"><StudentResultSection userName={userName} submission={current!} messages={messages} late={current?.status === "late"} /></div>}

      {showStages && !submitted && <StageBar stages={stageViews} active={view} onPick={setView} />}

      <div className="grid lg:grid-cols-12 gap-4 items-start">
        {/* Left: prompt */}
        <aside className="lg:col-span-4 lg:sticky lg:top-20">
          <button onClick={() => setShowPrompt(!showPrompt)} className="lg:hidden btn btn-ghost w-full mb-3 justify-between"><span className="flex items-center gap-2"><BookOpenText className="w-4 h-4" />Đề bài & tài liệu</span><ChevronDown className={`w-4 h-4 transition-transform ${showPrompt ? "rotate-180" : ""}`} /></button>
          <div className={`card p-5 lg:max-h-[calc(100vh-7rem)] overflow-y-auto ${showPrompt ? "block" : "hidden lg:block"}`}>{promptPanel}</div>
        </aside>

        {/* Right: work area */}
        <div className="lg:col-span-8 space-y-4 min-w-0">
          {assignment.submission_mode === "file_only" ? (
            <div className="card p-5 space-y-4">
              <h3 className="font-bold flex items-center gap-2"><FileText className="w-5 h-5 text-brand" />Nộp file bài làm</h3>
              <FileUploadZone files={files} onFilesChange={setFiles} disabled={locked} label="Kéo & thả file bài làm vào đây" sublabel="PDF, Word, TXT, mã nguồn, ZIP, ảnh (tối đa 15MB)" />
              <div><label className="label">Ghi chú gửi giảng viên</label>
                <textarea rows={4} disabled={locked} className="input resize-none" placeholder="Tóm tắt bài nộp hoặc ghi chú…" value={text} onChange={(e) => setText(e.target.value)} /></div>
            </div>
          ) : view === "are_you_sure" && showStages ? (
            <AysView assignment={assignment} messages={messages} locked={locked} onMessages={setMessages} attempts={attemptsRef} />
          ) : (
            <>
            {!locked && turns > 0 && (
              <div className="card p-5" data-testid="live-trace">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold flex items-center gap-2 text-sm"><span className="w-2 h-2 rounded-full bg-brand animate-pulse" />Bản đồ quỹ đạo tư duy</h3>
                  <span className="text-[11px] text-mute">{turns} lượt · đang được ghi lại</span>
                </div>
                <ThinkingTrace live messages={messages} studentLabel="bạn" />
              </div>
            )}
            <div className="card overflow-hidden flex flex-col">
              <div className="px-5 py-3 border-b border-line flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold"><MessageSquareText className="w-5 h-5 text-brand" />Trao đổi với Trợ lý AI</div>
                <span className="text-xs text-mute">{messages.length} tin nhắn</span>
              </div>
              <div className="overflow-y-auto p-4 md:p-5 space-y-5 min-h-[22rem] max-h-[60vh] bg-surface-2/40">
                {needIntent && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} data-testid="intent-panel" className="rounded-2xl border border-brand/30 bg-surface p-4 md:p-5 space-y-4">
                    <div>
                      <div className="flex items-center gap-2 font-bold text-brand"><PenLine className="w-4 h-4" />Trước khi hỏi trợ lý, hãy ghi ý riêng của em</div>
                      <p className="text-xs text-ink-2 mt-1">Chỉ cần vài dòng, chưa cần hoàn chỉnh. Trợ lý sẽ dùng chính ý của em để giúp em nâng cấp lập luận, thay vì viết thay.{friction === "required" ? " Bài này yêu cầu ghi ý trước." : ""}</p>
                    </div>
                    {frictionPrompts.map((q, i) => (
                      <div key={i}>
                        <label className="label">{q}</label>
                        <textarea rows={2} className="input resize-none" value={ideas[i] || ""} disabled={intentBusy}
                          onPaste={(e) => { ideasPasted.current += e.clipboardData.getData("text").length; }}
                          onChange={(e) => setIdeas(ideas.map((x, k) => (k === i ? e.target.value : x)))} />
                      </div>
                    ))}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-mute">{ideasOk ? "Đủ ý để mở trợ lý." : `Viết ít nhất ${Math.min(2, frictionPrompts.length)} ô, tổng tối thiểu 40 ký tự.`}</span>
                      <div className="flex gap-2">
                        {friction === "nudge" && <button type="button" className="btn btn-ghost btn-sm" disabled={intentBusy} onClick={() => submitIntent(true)}>Bỏ qua (sẽ được ghi nhận)</button>}
                        <button type="button" className="btn btn-primary" disabled={!ideasOk || intentBusy} onClick={() => submitIntent(false)}>{intentBusy ? "Trợ lý đang đọc ý của em…" : "Gửi ý và mở trợ lý"}</button>
                      </div>
                    </div>
                  </motion.div>
                )}
                {messages.length === 0 && !needIntent && (
                  <div className="h-72 flex flex-col items-center justify-center text-center gap-3">
                    <motion.div animate={{ y: [0, -8, 0], rotate: [0, 4, -4, 0] }} transition={{ repeat: Infinity, duration: 4 }} className="w-16 h-16 rounded-3xl bg-gradient-to-br bg-brand text-white flex items-center justify-center shadow-xl shadow-brand/30"><Sparkles className="w-8 h-8" /></motion.div>
                    <h4 className="font-bold">Bắt đầu cuộc trao đổi</h4>
                    <p className="text-sm text-ink-2 max-w-sm">{assignment.ai_submode === "socratic" ? "Đặt câu hỏi về đề bài — trợ lý sẽ gợi mở từng bước để bạn tự xây dựng lời giải." : "Hỏi bất cứ điều gì liên quan đến bài tập."}</p>
                  </div>
                )}
                <AnimatePresence initial={false}>
                  {coMessages.map((m, i) => {
                    const mine = m.role === "user";
                    return (
                      <motion.div key={m.id || i} initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 26 }} className={`flex gap-3 ${mine ? "flex-row-reverse" : ""}`}>
                        {mine ? <Avatar name={userName} src={userAvatar} size={32} /> : <div className="w-8 h-8 rounded-full bg-gradient-to-br bg-brand text-white flex items-center justify-center shrink-0"><Bot className="w-4 h-4" /></div>}
                        <div className={`max-w-[88%] ${mine ? "items-end" : ""} flex flex-col gap-1`}>
                          <span className="text-[11px] text-mute px-1 font-medium">{mine ? (m.kind === "intent" ? `${userName} · ý riêng ghi trước` : userName) : (assignment.ai_submode === "socratic" ? "Trợ lý Socratic" : "Trợ lý AI")} · {new Date(m.timestamp || Date.now()).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
                          <div className={`px-4 py-3 rounded-2xl ${mine ? `bg-brand-soft/60 text-ink rounded-tr-md ${m.kind === "intent" ? "ring-1 ring-dashed ring-brand/40 border border-dashed border-brand/50" : ""}` : "bg-surface border border-line rounded-tl-md"}`}>
                            {m.gate && answerGate ? <GatedAnswer message={m} gate={answerGate} busy={unlockBusy} onUnlock={(d) => unlock(m.id, d)} /> : <MarkdownRenderer content={m.content} />}
                          </div>
                          {mine && m.coach && <CoachChip coach={m.coach} />}
                        </div>
                      </motion.div>
                    );
                  })}
                  {sending && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br bg-brand text-white flex items-center justify-center"><Bot className="w-4 h-4" /></div>
                      <div className="px-4 py-3 rounded-2xl rounded-tl-md bg-surface border border-line text-ink-2 text-lg"><HmmLoader label="AI đang nghĩ" /></div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div ref={endRef} />
              </div>

              {assignment.submission_mode === "both" && !locked && (
                <div className="p-4 border-t border-line"><FileUploadZone files={files} onFilesChange={setFiles} disabled={locked} label="Đính kèm file bài làm (tùy chọn)" sublabel="Nộp cùng với nhật ký trao đổi AI" /></div>
              )}

              <div className="p-3 md:p-4 border-t border-line bg-surface">
                {locked ? (
                  <div className="rounded-xl bg-surface-2 text-center text-sm font-medium text-mute py-3 flex items-center justify-center gap-2"><Lock className="w-4 h-4" />{submitted ? "Đã nộp bài. Toàn bộ hội thoại được lưu trong nhật ký quá trình." : "Bài tập đã khóa sau hạn nộp."}</div>
                ) : (
                  <form onSubmit={send} className="flex items-end gap-2">
                    <textarea rows={1} value={input} onChange={(e) => setInput(e.target.value)} disabled={sending || needIntent || gateLocked}
                      onPaste={(e) => { pastedRef.current += e.clipboardData.getData("text").length; }}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                      placeholder={gateLocked ? "Hãy mở khóa câu trả lời phía trên trước khi hỏi tiếp…" : needIntent ? "Hãy ghi ý riêng của em ở phía trên trước…" : assignment.ai_submode === "socratic" ? "Hỏi hoặc phản biện lại trợ lý… (Enter để gửi, Shift+Enter xuống dòng)" : "Nhập tin nhắn… (Enter để gửi)"}
                      className="input resize-none max-h-40 min-h-[48px]" style={{ fieldSizing: "content" } as React.CSSProperties} />
                    <span className="hidden sm:block text-[11px] text-mute self-center w-16 text-right tabular-nums">{input.length ? `${input.length} ký tự` : ""}</span>
                    <motion.button whileTap={{ scale: 0.9 }} type="submit" disabled={!input.trim() || sending || needIntent || gateLocked} className="btn btn-primary btn-icon h-12 w-12 shrink-0" aria-label="Gửi"><Send className="w-5 h-5" /></motion.button>
                  </form>
                )}
              </div>
            </div>
            </>
          )}
        </div>
      </div>

      <Modal open={confirmOpen} onClose={() => !submitting && setConfirmOpen(false)} title="Xác nhận nộp bài" icon={<Upload className="w-5 h-5" />} maxWidth="max-w-md">
        <p className="text-sm text-ink-2">Sau khi nộp, bạn <strong className="text-ink">không thể chỉnh sửa hay nộp lại</strong>. {chatEnabled && "Hệ thống sẽ dùng AI phân tích quá trình trao đổi của bạn (có thể mất vài giây)."}</p>
        {pastDue && <p className="text-sm text-amber-600 mt-2">Bài sẽ được ghi nhận là nộp trễ.</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn btn-ghost" onClick={() => setConfirmOpen(false)} disabled={submitting}>Xem lại</button>
          <button className="btn btn-primary" onClick={doSubmit} disabled={submitting}>{submitting ? "Đang chấm quá trình…" : "Nộp bài"}</button>
        </div>
      </Modal>
    </PasteGuard>
  );
};

const Confetti: React.FC = () => {
  const pieces = Array.from({ length: 36 }, (_, i) => i);
  const colors = ["#5b5bf0", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#38bdf8"];
  return (
    <motion.div className="fixed inset-0 z-[90] pointer-events-none overflow-hidden" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {pieces.map((i) => (
        <motion.span key={i} className="absolute top-0 w-2.5 h-4 rounded-sm" style={{ left: `${(i * 97) % 100}%`, background: colors[i % colors.length] }}
          initial={{ y: -40, rotate: 0, opacity: 1 }} animate={{ y: "105vh", rotate: 540 + i * 20, x: [0, (i % 2 ? 40 : -40), 0] }} transition={{ duration: 2.2 + (i % 5) * 0.25, delay: (i % 8) * 0.06, ease: "easeIn" }} />
      ))}
      <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", delay: 0.1 }} className="absolute top-1/3 left-1/2 -translate-x-1/2 card px-6 py-4 flex items-center gap-3 shadow-2xl">
        <PartyPopper className="w-8 h-8 text-amber-500" /><div><div className="font-medium text-lg">Nộp bài thành công!</div><div className="text-xs text-mute">Giảng viên sẽ sớm chấm điểm cho bạn.</div></div>
      </motion.div>
    </motion.div>
  );
};
