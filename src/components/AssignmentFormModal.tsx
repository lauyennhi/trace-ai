import React, { useEffect, useState } from "react";
import { ClipboardPlus, Pencil, FileText, Bot, Layers, Sparkles, MessageCircle } from "lucide-react";
import { Assignment, SubmissionMode, AISubmode, AssignmentAttachment } from "../types";
import { FileUploadZone, UploadedFileItem } from "./FileUploadZone";
import { Modal } from "./ui";

export interface AssignmentFormData {
  title: string; description: string; rubric: string; due_date: string;
  attachments: AssignmentAttachment[]; submission_mode: SubmissionMode; ai_submode: AISubmode; allow_late: boolean;
}
interface Props {
  isOpen: boolean;
  assignment?: Assignment | null; // edit mode when set
  onClose: () => void;
  onSubmit: (data: AssignmentFormData) => Promise<void>;
}

const toLocalInput = (iso?: string) => {
  const d = iso ? new Date(iso) : new Date(Date.now() + 7 * 86400000);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
};

export const AssignmentFormModal: React.FC<Props> = ({ isOpen, assignment, onClose, onSubmit }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rubric, setRubric] = useState("");
  const [dueDate, setDueDate] = useState(toLocalInput());
  const [mode, setMode] = useState<SubmissionMode>("both");
  const [aiMode, setAiMode] = useState<AISubmode>("socratic");
  const [allowLate, setAllowLate] = useState(true);
  const [files, setFiles] = useState<UploadedFileItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setTitle(assignment?.title || ""); setDescription(assignment?.description || ""); setRubric(assignment?.rubric || "");
    setDueDate(toLocalInput(assignment?.due_date)); setMode(assignment?.submission_mode || "both");
    setAiMode(assignment?.ai_submode || "socratic"); setAllowLate(assignment?.allow_late !== false);
    setFiles((assignment?.attachments || []).map((a) => ({ id: a.id, name: a.name, size: a.size || "", type: a.type || "file", url: a.url })));
  }, [isOpen, assignment]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) return setError("Vui lòng nhập tiêu đề và hạn nộp.");
    setBusy(true); setError(null);
    try {
      await onSubmit({
        title: title.trim(), description, rubric, due_date: new Date(dueDate).toISOString(),
        attachments: files.map((f) => ({ id: f.id, name: f.name, url: f.url, size: f.size, type: f.type })),
        submission_mode: mode, ai_submode: aiMode, allow_late: allowLate,
      });
      onClose();
    } catch (err: any) { setError(err.message || "Không thể lưu bài tập."); } finally { setBusy(false); }
  };

  const modes: { id: SubmissionMode; icon: React.ReactNode; label: string; hint: string }[] = [
    { id: "both", icon: <Layers className="w-4 h-4" />, label: "AI Chat + File", hint: "Khuyến nghị" },
    { id: "ai_chat_only", icon: <Bot className="w-4 h-4" />, label: "Chỉ AI Chat", hint: "Chấm quá trình" },
    { id: "file_only", icon: <FileText className="w-4 h-4" />, label: "Chỉ nộp file", hint: "Không dùng AI" },
  ];

  return (
    <Modal open={isOpen} onClose={onClose} maxWidth="max-w-2xl"
      title={assignment ? "Chỉnh sửa bài tập" : "Giao bài tập mới"} subtitle="Sinh viên sẽ nhận thông báo ngay khi bài được giao"
      icon={assignment ? <Pencil className="w-5 h-5" /> : <ClipboardPlus className="w-5 h-5" />}>
      <form onSubmit={submit} className="space-y-5">
        {error && <div className="chip chip-rose w-full rounded-xl px-3 py-2.5 text-sm">{error}</div>}
        <div>
          <label className="label">Tiêu đề *</label>
          <input className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Bài tập 1: Phân tích đạo đức AI" />
        </div>
        <div>
          <label className="label">Đề bài (hỗ trợ Markdown & công thức LaTeX)</label>
          <textarea className="input resize-y" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="label">Rubric chấm điểm</label>
          <textarea className="input resize-y" rows={3} value={rubric} onChange={(e) => setRubric(e.target.value)} placeholder="- Tư duy phản biện (30%)…" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Hạn nộp *</label>
            <input type="datetime-local" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Nộp trễ</label>
            <button type="button" onClick={() => setAllowLate(!allowLate)} className="input flex items-center justify-between text-left">
              <span>{allowLate ? "Cho phép nộp trễ (đánh dấu trễ)" : "Khóa bài sau hạn"}</span>
              <span className={`w-10 h-6 rounded-full p-0.5 transition-colors ${allowLate ? "bg-brand" : "bg-line"}`}>
                <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${allowLate ? "translate-x-4" : ""}`} />
              </span>
            </button>
          </div>
        </div>
        <div>
          <label className="label">Hình thức làm bài</label>
          <div className="grid grid-cols-3 gap-2">
            {modes.map((m) => (
              <button key={m.id} type="button" onClick={() => setMode(m.id)}
                className={`rounded-2xl border p-3 text-left transition-all ${mode === m.id ? "border-brand bg-brand-soft ring-4 ring-brand/10" : "border-line hover:border-brand/40"}`}>
                <div className={mode === m.id ? "text-brand" : "text-mute"}>{m.icon}</div>
                <div className="text-sm font-semibold mt-1.5">{m.label}</div>
                <div className="text-[11px] text-mute">{m.hint}</div>
              </button>
            ))}
          </div>
        </div>
        {mode !== "file_only" && (
          <div>
            <label className="label">Phong cách trợ lý AI</label>
            <div className="grid grid-cols-2 gap-2">
              {([["socratic", <Sparkles key="s" className="w-4 h-4" />, "Socratic", "Gợi mở bằng câu hỏi, không đưa đáp án ngay"], ["normal", <MessageCircle key="n" className="w-4 h-4" />, "Thường", "Giải đáp trực tiếp, ngắn gọn"]] as const).map(([id, icon, label, hint]) => (
                <button key={id} type="button" onClick={() => setAiMode(id as AISubmode)}
                  className={`rounded-2xl border p-3 text-left transition-all ${aiMode === id ? "border-brand bg-brand-soft ring-4 ring-brand/10" : "border-line hover:border-brand/40"}`}>
                  <div className={`flex items-center gap-2 text-sm font-semibold ${aiMode === id ? "text-brand" : ""}`}>{icon}{label}</div>
                  <div className="text-[11px] text-mute mt-1">{hint}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <label className="label">Tài liệu đính kèm</label>
          <FileUploadZone files={files} onFilesChange={setFiles} label="Kéo thả tài liệu vào đây" sublabel="PDF, Word, ảnh, mã nguồn… tối đa 15MB" />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-line">
          <button type="button" className="btn btn-ghost mt-4" onClick={onClose}>Hủy</button>
          <button type="submit" className="btn btn-primary mt-4" disabled={busy}>{busy ? "Đang lưu…" : assignment ? "Lưu thay đổi" : "Giao bài tập"}</button>
        </div>
      </form>
    </Modal>
  );
};
