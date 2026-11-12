import React, { useState } from "react";
import { motion } from "motion/react";
import { Award, FileText, Paperclip, Bot, Mail, ExternalLink, Loader2, RefreshCw, Save, AlertTriangle, Sparkles, CheckCircle2, Clock, Download } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { Submission, Assignment, ChatSession, ProcessScoreResult } from "../types";
import { googleSignIn, getAccessToken, exportReportToDocs, sendResultEmailViaGmail } from "../lib/workspace";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { Avatar, Bar, Modal, fmtDate, riseItem, staggerParent, useToast } from "./ui";

interface Props {
  submission: Submission;
  assignment: Assignment;
  chatSession: ChatSession | null;
  onGrade: (grade: number, feedback: string) => Promise<void>;
  onReevaluate: () => Promise<void>;
}

const HL = {
  xanh: { cls: "bg-[#e7f8ef] dark:bg-[#0e2a1f] border-emerald-400/40", label: "Tư duy độc lập & phản biện", dot: "bg-emerald-500" },
  vang: { cls: "bg-[#fff4de] dark:bg-[#33260c] border-amber-400/40", label: "Tò mò / cần làm rõ", dot: "bg-amber-500" },
  do: { cls: "bg-[#ffe9ec] dark:bg-[#3a1320] border-rose-400/40", label: "Nhờ AI làm hộ / sao chép", dot: "bg-rose-500" },
} as const;

export const TeacherSubmissionView: React.FC<Props> = ({ submission, assignment, chatSession, onGrade, onReevaluate }) => {
  const toast = useToast();
  const result: ProcessScoreResult | undefined = submission.process_score_result;
  const [grade, setGrade] = useState<string>(submission.grade !== undefined ? String(submission.grade) : "");
  const [feedback, setFeedback] = useState(submission.feedback || "");
  const [saving, setSaving] = useState(false);
  const [reeval, setReeval] = useState(false);
  const [docBusy, setDocBusy] = useState(false);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [mailOpen, setMailOpen] = useState(false);
  const [mailBusy, setMailBusy] = useState(false);

  const radar = result ? [
    { subject: "Phản biện", v: result.tieu_chi.tu_duy_phan_bien }, { subject: "Đào sâu", v: result.tieu_chi.dao_sau_van_de },
    { subject: "Kiểm chứng", v: result.tieu_chi.kiem_chung_thong_tin }, { subject: "Nội hóa", v: result.tieu_chi.noi_hoa_kien_thuc },
    { subject: "Chủ động", v: result.tieu_chi.tinh_chu_dong },
  ] : [];
  const criteria = result ? [
    ["Tư duy phản biện", result.tieu_chi.tu_duy_phan_bien], ["Đào sâu vấn đề", result.tieu_chi.dao_sau_van_de],
    ["Kiểm chứng thông tin", result.tieu_chi.kiem_chung_thong_tin], ["Nội hóa kiến thức", result.tieu_chi.noi_hoa_kien_thuc],
    ["Tính chủ động", result.tieu_chi.tinh_chu_dong],
  ] as [string, number][] : [];

  const save = async () => {
    const n = Number(grade.replace(",", "."));
    if (grade.trim() === "" || !Number.isFinite(n) || n < 0 || n > 10) return toast.error("Điểm phải nằm trong khoảng 0 - 10.");
    setSaving(true);
    try { await onGrade(n, feedback); toast.success("Đã lưu điểm và gửi thông báo cho sinh viên."); } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };
  const reevaluate = async () => {
    setReeval(true);
    try { await onReevaluate(); toast.success("Đã chấm lại quá trình bằng AI."); } catch (e: any) { toast.error(e.message); } finally { setReeval(false); }
  };
  const googleToken = async () => {
    let token = await getAccessToken();
    if (!token) token = (await googleSignIn())?.accessToken || null;
    if (!token) throw new Error("Cần đăng nhập Google Workspace để tiếp tục.");
    return token;
  };
  const exportDoc = async () => {
    setDocBusy(true);
    try {
      const r = await exportReportToDocs(await googleToken(), submission.student_name, assignment.title, submission, chatSession?.messages || []);
      setDocUrl(r.documentUrl); toast.success("Đã tạo Google Doc báo cáo.");
    } catch (e: any) { toast.error(e.message || "Không xuất được Google Doc."); } finally { setDocBusy(false); }
  };
  const sendMail = async () => {
    setMailBusy(true);
    try {
      const body = [result?.nhan_xet_ngan, submission.grade !== undefined ? `Điểm giảng viên: ${submission.grade}/10` : "", submission.feedback].filter(Boolean).join("\n\n");
      await sendResultEmailViaGmail(await googleToken(), submission.student_email, submission.student_name, assignment.title, result?.process_score ?? 0, body || "Bài của bạn đã được đánh giá.");
      toast.success(`Đã gửi email tới ${submission.student_email}.`); setMailOpen(false);
    } catch (e: any) { toast.error(e.message || "Không gửi được email."); } finally { setMailBusy(false); }
  };

  return (
    <motion.div variants={staggerParent} initial="initial" animate="animate" className="space-y-5 pb-12">
      {/* Header */}
      <motion.div variants={riseItem} className="card p-5 flex flex-wrap items-center gap-4">
        <Avatar name={submission.student_name} src={submission.student_avatar} size={52} />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-mute">Bài nộp của sinh viên</div>
          <h2 className="text-xl font-extrabold truncate">{submission.student_name}</h2>
          <div className="text-xs text-mute flex items-center gap-1.5 mt-0.5"><Clock className="w-3.5 h-3.5" />Nộp lúc {fmtDate(submission.submitted_at)}
            <span className={`chip ml-1 ${submission.status === "late" ? "chip-amber" : "chip-green"}`}>{submission.status === "late" ? "Nộp trễ" : "Đúng hạn"}</span></div>
        </div>
        {result && <div className="text-right"><div className="text-xs text-mute">Process Score</div><div className="text-4xl font-extrabold gradient-text">{result.process_score}<span className="text-base text-mute">/100</span></div></div>}
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5 min-w-0">
          {/* AI evaluation */}
          <motion.div variants={riseItem} className="card p-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="font-bold flex items-center gap-2"><Sparkles className="w-5 h-5 text-brand" />Đánh giá quá trình tư duy (AI)</h3>
              {chatSession && chatSession.messages.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={reevaluate} disabled={reeval}>{reeval ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}Chấm lại bằng AI</button>
              )}
            </div>
            {!result ? (
              <div className="mt-4 rounded-2xl bg-surface-2 border border-dashed border-line p-6 text-center text-sm text-ink-2">
                {submission.eval_status === "failed" ? (<><AlertTriangle className="w-6 h-6 text-amber-500 mx-auto mb-2" />AI chưa chấm được bài này{submission.eval_error ? `: ${submission.eval_error}` : "."}<br />Hãy bấm “Chấm lại bằng AI”.</>)
                  : <>Bài này không có nhật ký trao đổi AI để chấm quá trình (hình thức nộp file).</>}
              </div>
            ) : (
              <>
                <div className="grid sm:grid-cols-2 gap-6 mt-4 items-center">
                  <div className="h-60"><ResponsiveContainer width="100%" height="100%"><RadarChart outerRadius="70%" data={radar}><PolarGrid stroke="var(--line)" /><PolarAngleAxis dataKey="subject" tick={{ fill: "var(--ink-2)", fontSize: 12 }} /><PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} /><Radar dataKey="v" stroke="#5b5bf0" fill="#5b5bf0" fillOpacity={0.3} animationDuration={900} /></RadarChart></ResponsiveContainer></div>
                  <div className="space-y-3">{criteria.map(([l, v]) => (<div key={l}><div className="flex justify-between text-xs mb-1"><span className="text-ink-2 font-medium">{l}</span><strong>{v}</strong></div><Bar value={v} /></div>))}</div>
                </div>
                <div className="mt-5 rounded-2xl bg-brand-soft/60 border border-brand/15 p-4 text-sm"><div className="text-xs font-bold text-brand mb-1">Nhận xét của AI</div>{result.nhan_xet_ngan}</div>
                {result.noi_dung_ngoai_luong && <div className="mt-3 rounded-2xl bg-[#fff4de] dark:bg-[#33260c] text-[#8a5300] dark:text-[#fbbf4a] p-4 text-sm flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span><strong>Nội dung ngoài luồng: </strong>{result.noi_dung_ngoai_luong}</span></div>}
              </>
            )}
          </motion.div>

          {result && result.highlight_segments.length > 0 && (
            <motion.div variants={riseItem} className="card p-6">
              <h3 className="font-bold mb-1">Điểm nhấn trong cuộc trò chuyện</h3>
              <div className="flex flex-wrap gap-3 text-xs text-ink-2 mb-4">{Object.values(HL).map((h) => <span key={h.label} className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${h.dot}`} />{h.label}</span>)}</div>
              <div className="grid sm:grid-cols-2 gap-3">
                {result.highlight_segments.map((h, i) => { const s = HL[h.mau] || HL.vang; return (
                  <div key={i} className={`rounded-2xl border p-4 ${s.cls}`}><div className="flex items-center gap-1.5 text-xs font-bold mb-1.5"><span className={`w-2 h-2 rounded-full ${s.dot}`} />{s.label}</div><p className="text-sm italic">“{h.doan_van_ban}”</p><p className="text-xs text-ink-2 mt-2"><strong>Lý do:</strong> {h.ly_do}</p></div>
                ); })}
              </div>
            </motion.div>
          )}

          {/* Transcript */}
          <motion.div variants={riseItem} className="card p-6">
            <h3 className="font-bold flex items-center gap-2 mb-4"><Bot className="w-5 h-5 text-brand" />Nhật ký hội thoại AI <span className="text-xs text-mute font-normal">({chatSession?.messages.length || 0} tin nhắn)</span></h3>
            {!chatSession || chatSession.messages.length === 0 ? <p className="text-sm text-mute">Không có hội thoại.</p> : (
              <div className="space-y-3 max-h-[32rem] overflow-y-auto pr-1">
                {chatSession.messages.map((m) => { const mine = m.role === "user"; return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : ""}`}>
                    <div className={`max-w-[88%] rounded-2xl px-4 py-3 ${mine ? "bg-brand-soft rounded-tr-md" : "bg-surface-2 border border-line rounded-tl-md"}`}>
                      <div className="text-[11px] font-bold text-mute mb-1">{mine ? submission.student_name : "Trợ lý AI"} · {new Date(m.timestamp).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</div>
                      <MarkdownRenderer content={m.content} />
                    </div>
                  </div>
                ); })}
              </div>
            )}
          </motion.div>
        </div>

        {/* Right rail: grading + submitted work + export */}
        <div className="space-y-5 lg:sticky lg:top-20 self-start">
          <motion.div variants={riseItem} className="card p-5 border-brand/30 ring-4 ring-brand/5">
            <h3 className="font-bold flex items-center gap-2"><Award className="w-5 h-5 text-amber-500" />Chấm điểm</h3>
            <p className="text-xs text-mute mb-4">Điểm chính thức của giảng viên (thang 10). Sinh viên sẽ nhận thông báo.</p>
            <label className="label">Điểm (0 - 10)</label>
            <input className="input text-2xl font-extrabold text-center py-3" inputMode="decimal" placeholder="0.0" value={grade} onChange={(e) => setGrade(e.target.value)} />
            <div className="flex gap-1.5 mt-2">{[5, 6.5, 8, 9, 10].map((v) => <button key={v} type="button" onClick={() => setGrade(String(v))} className="flex-1 btn btn-ghost btn-sm !px-0">{v}</button>)}</div>
            <label className="label mt-4">Nhận xét</label>
            <textarea className="input resize-none" rows={5} placeholder="Nhận xét cho sinh viên về nội dung và quá trình tư duy…" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
            <button className="btn btn-primary w-full mt-4" onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : submission.grade !== undefined ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}{submission.grade !== undefined ? "Cập nhật điểm" : "Lưu điểm & nhận xét"}</button>
            {submission.graded_at && <p className="text-[11px] text-mute text-center mt-2">Chấm lúc {fmtDate(submission.graded_at)}</p>}
          </motion.div>

          <motion.div variants={riseItem} className="card p-5">
            <h3 className="font-bold flex items-center gap-2 mb-3"><FileText className="w-5 h-5 text-brand" />Bài làm chính thức</h3>
            {submission.submitted_text ? <div className="rounded-xl bg-surface-2 border border-line p-3 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">{submission.submitted_text}</div> : <p className="text-sm text-mute">Không có nội dung văn bản.</p>}
            {submission.submitted_files?.length > 0 && <div className="mt-3 space-y-2">{submission.submitted_files.map((f) => (
              <a key={f.id} href={f.url} download={f.name} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-line hover:border-brand/40 text-sm"><span className="flex items-center gap-2 truncate"><Paperclip className="w-4 h-4 text-mute shrink-0" /><span className="truncate">{f.name}</span></span><Download className="w-4 h-4 text-brand shrink-0" /></a>))}</div>}
          </motion.div>

          <motion.div variants={riseItem} className="card p-5 space-y-2">
            <h3 className="font-bold mb-1">Chia sẻ kết quả</h3>
            <button className="btn btn-ghost w-full justify-start" onClick={exportDoc} disabled={docBusy}>{docBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 text-sky-500" />}Xuất báo cáo Google Doc</button>
            {docUrl && <a href={docUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-semibold text-brand px-1">Mở Google Doc <ExternalLink className="w-3.5 h-3.5" /></a>}
            <button className="btn btn-ghost w-full justify-start" onClick={() => setMailOpen(true)}><Mail className="w-4 h-4 text-emerald-500" />Gửi kết quả qua Gmail</button>
          </motion.div>
        </div>
      </div>

      <Modal open={mailOpen} onClose={() => setMailOpen(false)} title="Gửi kết quả qua Gmail" icon={<Mail className="w-5 h-5" />} maxWidth="max-w-md">
        <p className="text-sm text-ink-2">Email sẽ được gửi từ tài khoản Gmail của bạn tới <strong className="text-ink">{submission.student_email}</strong>.</p>
        <div className="flex justify-end gap-2 mt-5"><button className="btn btn-ghost" onClick={() => setMailOpen(false)}>Hủy</button><button className="btn btn-primary" onClick={sendMail} disabled={mailBusy}>{mailBusy ? "Đang gửi…" : "Gửi email"}</button></div>
      </Modal>
    </motion.div>
  );
};
