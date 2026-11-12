import React, { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Send, Bot, Sparkles, Paperclip, CheckCircle2, Lock, FileText, Upload, ChevronDown, Award, Clock,
  PartyPopper, Save, BookOpenText, ListChecks, AlertTriangle, MessageSquareText,
} from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { Assignment, Submission, ChatSession, ProcessScoreResult } from "../types";
import { FileUploadZone, UploadedFileItem } from "./FileUploadZone";
import { MarkdownRenderer } from "./MarkdownRenderer";
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
  onSendMessage: (data: { assignment_id: string; message_content: string }) => Promise<{ chat_session: ChatSession }>;
}

const MIN_TURNS = 3;

export const StudentWorkspaceView: React.FC<Props> = ({ assignment, courseName, userName, userAvatar, submission, chatSession, onSubmitAssignment, onSaveDraft, onSendMessage }) => {
  const toast = useToast();
  const [messages, setMessages] = useState<any[]>(chatSession?.messages || []);
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
  const turns = messages.filter((m) => m.role === "user").length;
  const needTurns = chatEnabled ? Math.max(0, MIN_TURNS - turns) : 0;
  const canSubmit = !locked && !sending && needTurns === 0;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, sending]);

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
    setInput(""); setSending(true);
    setMessages((p) => [...p, { id: tempId, role: "user", content: userText, timestamp: new Date().toISOString() }]);
    try {
      const res = await onSendMessage({ assignment_id: assignment.id, message_content: content });
      setMessages(res.chat_session.messages);
    } catch (err: any) {
      setMessages((p) => p.filter((m) => m.id !== tempId));
      setInput(userText);
      toast.error(err.message || "Không gửi được tin nhắn.");
    } finally { setSending(false); }
  }, [input, sending, locked, files, messages.length, assignment.id]);

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
      <section>
        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-mute mb-2"><BookOpenText className="w-4 h-4" />Đề bài</h3>
        <div className="rounded-2xl bg-surface-2 border border-line p-4"><MarkdownRenderer content={assignment.description || "Không có mô tả bổ sung."} /></div>
      </section>
      {assignment.rubric && (
        <section>
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-mute mb-2"><ListChecks className="w-4 h-4" />Rubric</h3>
          <div className="rounded-2xl bg-surface-2 border border-line p-4"><MarkdownRenderer content={assignment.rubric} /></div>
        </section>
      )}
      {assignment.attachments?.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-mute mb-2"><Paperclip className="w-4 h-4" />Tài liệu</h3>
          <div className="space-y-2">
            {assignment.attachments.map((att) => (
              <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" download={att.name} className="flex items-center justify-between gap-2 p-3 rounded-xl border border-line hover:border-brand/40 hover:bg-brand-soft/50 transition-colors text-sm">
                <span className="flex items-center gap-2 truncate"><FileText className="w-4 h-4 text-brand shrink-0" /><span className="truncate font-medium">{att.name}</span></span>
                <span className="text-xs text-mute shrink-0">{att.size}</span>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );

  return (
    <div className="relative">
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
          <div className="w-44">
            <div className="flex justify-between text-xs mb-1.5"><span className="text-ink-2 font-medium">Lượt trao đổi</span><span className="font-bold">{Math.min(turns, MIN_TURNS)}/{MIN_TURNS}</span></div>
            <Bar value={(Math.min(turns, MIN_TURNS) / MIN_TURNS) * 100} from="#10b981" to="#5b5bf0" />
          </div>
        )}
        <div className="flex items-center gap-3">
          {!locked && <span className="text-xs text-mute hidden sm:flex items-center gap-1">{draftState === "saving" ? "Đang lưu nháp…" : draftState === "saved" ? <><Save className="w-3.5 h-3.5 text-emerald-500" />Đã lưu nháp</> : ""}</span>}
          {submitted ? <span className="chip chip-green py-1.5 px-3 text-sm"><CheckCircle2 className="w-4 h-4" />Đã nộp {current?.status === "late" ? "(trễ)" : ""}</span>
            : locked ? <span className="chip chip-rose py-1.5 px-3 text-sm"><Lock className="w-4 h-4" />Đã khóa</span>
            : <button className="btn btn-primary" disabled={!canSubmit} onClick={() => setConfirmOpen(true)} title={needTurns ? `Cần trao đổi thêm ${needTurns} lượt` : ""}><Upload className="w-4 h-4" />{needTurns ? `Còn ${needTurns} lượt để nộp` : "Nộp bài"}</button>}
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-4 items-start">
        {/* Left: prompt */}
        <aside className="lg:col-span-4 lg:sticky lg:top-20">
          <button onClick={() => setShowPrompt(!showPrompt)} className="lg:hidden btn btn-ghost w-full mb-3 justify-between"><span className="flex items-center gap-2"><BookOpenText className="w-4 h-4" />Đề bài & tài liệu</span><ChevronDown className={`w-4 h-4 transition-transform ${showPrompt ? "rotate-180" : ""}`} /></button>
          <div className={`card p-5 lg:max-h-[calc(100vh-7rem)] overflow-y-auto ${showPrompt ? "block" : "hidden lg:block"}`}>{promptPanel}</div>
        </aside>

        {/* Right: work area */}
        <div className="lg:col-span-8 space-y-4 min-w-0">
          {/* Result */}
          {submitted && (current?.grade !== undefined || result || current?.eval_status === "failed") && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-5 overflow-hidden relative">
              <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-brand opacity-10" />
              <h3 className="font-bold flex items-center gap-2 mb-4"><Award className="w-5 h-5 text-amber-500" />Kết quả của bạn</h3>
              <div className="grid sm:grid-cols-2 gap-5">
                <div className="space-y-3">
                  <div className="flex items-end gap-5">
                    <div><div className="text-xs text-mute">Điểm giảng viên</div><div className="text-4xl font-medium gradient-text">{current?.grade !== undefined ? current.grade : "—"}<span className="text-base text-mute font-semibold">{current?.grade !== undefined ? "/10" : ""}</span></div></div>
                    {result && <div><div className="text-xs text-mute">Tư duy (AI)</div><div className="text-2xl font-medium">{result.process_score}<span className="text-sm text-mute">/100</span></div></div>}
                  </div>
                  {current?.grade === undefined && <p className="text-xs text-mute">Giảng viên chưa chấm điểm. Bạn sẽ nhận được thông báo khi có kết quả.</p>}
                  {current?.feedback && <div className="rounded-xl bg-surface-2 border border-line p-3 text-sm"><div className="text-xs font-bold text-mute mb-1">Nhận xét của giảng viên</div>{current.feedback}</div>}
                  {current?.eval_status === "failed" && <div className="rounded-xl bg-[#fff4de] dark:bg-[#33260c] text-[#8a5300] dark:text-[#fbbf4a] p-3 text-xs flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />Phần chấm tư duy bằng AI chưa chạy được. Giảng viên sẽ chạy lại sau, bài nộp của bạn vẫn được lưu đầy đủ.</div>}
                </div>
                {result && (
                  <div>
                    <div className="h-44"><ResponsiveContainer width="100%" height="100%"><RadarChart outerRadius="68%" data={radar}><PolarGrid stroke="var(--line)" /><PolarAngleAxis dataKey="subject" tick={{ fill: "var(--ink-2)", fontSize: 11 }} /><PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} /><Radar dataKey="v" stroke="#5b5bf0" fill="#5b5bf0" fillOpacity={0.3} animationDuration={900} /></RadarChart></ResponsiveContainer></div>
                    <p className="text-xs text-ink-2 leading-relaxed">{result.nhan_xet_ngan}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {assignment.submission_mode === "file_only" ? (
            <div className="card p-5 space-y-4">
              <h3 className="font-bold flex items-center gap-2"><FileText className="w-5 h-5 text-brand" />Nộp file bài làm</h3>
              <FileUploadZone files={files} onFilesChange={setFiles} disabled={locked} label="Kéo & thả file bài làm vào đây" sublabel="PDF, Word, TXT, mã nguồn, ZIP, ảnh (tối đa 15MB)" />
              <div><label className="label">Ghi chú gửi giảng viên</label>
                <textarea rows={4} disabled={locked} className="input resize-none" placeholder="Tóm tắt bài nộp hoặc ghi chú…" value={text} onChange={(e) => setText(e.target.value)} /></div>
            </div>
          ) : (
            <div className="card overflow-hidden flex flex-col">
              <div className="px-5 py-3 border-b border-line flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold"><MessageSquareText className="w-5 h-5 text-brand" />Trao đổi với Trợ lý AI</div>
                <span className="text-xs text-mute">{messages.length} tin nhắn</span>
              </div>
              <div className="overflow-y-auto p-4 md:p-5 space-y-5 min-h-[22rem] max-h-[60vh] bg-surface-2/40">
                {messages.length === 0 && (
                  <div className="h-72 flex flex-col items-center justify-center text-center gap-3">
                    <motion.div animate={{ y: [0, -8, 0], rotate: [0, 4, -4, 0] }} transition={{ repeat: Infinity, duration: 4 }} className="w-16 h-16 rounded-3xl bg-gradient-to-br bg-brand text-white flex items-center justify-center shadow-xl shadow-brand/30"><Sparkles className="w-8 h-8" /></motion.div>
                    <h4 className="font-bold">Bắt đầu cuộc trao đổi</h4>
                    <p className="text-sm text-ink-2 max-w-sm">{assignment.ai_submode === "socratic" ? "Đặt câu hỏi về đề bài — trợ lý sẽ gợi mở từng bước để bạn tự xây dựng lời giải." : "Hỏi bất cứ điều gì liên quan đến bài tập."}</p>
                  </div>
                )}
                <AnimatePresence initial={false}>
                  {messages.map((m, i) => {
                    const mine = m.role === "user";
                    return (
                      <motion.div key={m.id || i} initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 26 }} className={`flex gap-3 ${mine ? "flex-row-reverse" : ""}`}>
                        {mine ? <Avatar name={userName} src={userAvatar} size={32} /> : <div className="w-8 h-8 rounded-full bg-gradient-to-br bg-brand text-white flex items-center justify-center shrink-0"><Bot className="w-4 h-4" /></div>}
                        <div className={`max-w-[85%] ${mine ? "items-end" : ""} flex flex-col gap-1`}>
                          <div className={`px-4 py-3 rounded-2xl ${mine ? "bg-gradient-to-br bg-brand text-white rounded-tr-md" : "bg-surface border border-line rounded-tl-md shadow-sm"}`}>
                            <MarkdownRenderer content={m.content} className={mine ? "!text-white [&_*]:!text-white" : ""} />
                          </div>
                          <span className="text-[11px] text-mute px-1">{new Date(m.timestamp || Date.now()).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </motion.div>
                    );
                  })}
                  {sending && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br bg-brand text-white flex items-center justify-center"><Bot className="w-4 h-4" /></div>
                      <div className="px-4 py-3.5 rounded-2xl rounded-tl-md bg-surface border border-line flex items-center gap-1.5" aria-label="AI đang trả lời"><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div ref={endRef} />
              </div>

              {assignment.submission_mode === "both" && (
                <div className="p-4 border-t border-line"><FileUploadZone files={files} onFilesChange={setFiles} disabled={locked} label="Đính kèm file bài làm (tùy chọn)" sublabel="Nộp cùng với nhật ký trao đổi AI" /></div>
              )}

              <div className="p-3 md:p-4 border-t border-line bg-surface">
                {locked ? (
                  <div className="rounded-xl bg-surface-2 text-center text-sm font-medium text-mute py-3 flex items-center justify-center gap-2"><Lock className="w-4 h-4" />{submitted ? "Đã nộp bài. Toàn bộ hội thoại được lưu trong nhật ký quá trình." : "Bài tập đã khóa sau hạn nộp."}</div>
                ) : (
                  <form onSubmit={send} className="flex items-end gap-2">
                    <textarea rows={1} value={input} onChange={(e) => setInput(e.target.value)} disabled={sending}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                      placeholder={assignment.ai_submode === "socratic" ? "Hỏi hoặc phản biện lại trợ lý… (Enter để gửi, Shift+Enter xuống dòng)" : "Nhập tin nhắn… (Enter để gửi)"}
                      className="input resize-none max-h-40 min-h-[48px]" style={{ fieldSizing: "content" } as React.CSSProperties} />
                    <motion.button whileTap={{ scale: 0.9 }} type="submit" disabled={!input.trim() || sending} className="btn btn-primary btn-icon h-12 w-12 shrink-0" aria-label="Gửi"><Send className="w-5 h-5" /></motion.button>
                  </form>
                )}
              </div>
            </div>
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
    </div>
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
