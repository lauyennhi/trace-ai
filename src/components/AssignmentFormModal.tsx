import React, { useEffect, useRef, useState } from "react";
import { ClipboardPlus, Pencil, FileText, Bot, Layers, Sparkles, MessageCircle, PenLine, Trash2, Highlighter, AlertTriangle, RotateCcw } from "lucide-react";
import { Assignment, SubmissionMode, AISubmode, AssignmentAttachment } from "../types";
import { FileUploadZone, UploadedFileItem } from "./FileUploadZone";
import { Modal } from "./ui";
import { DEFAULT_L2_DIMENSIONS, L2_ERROR_LABEL, L2_ERROR_TYPES, findPhraseRange, type L2Dimension, type L2ErrorType } from "../lib/l2";

export interface L2FormError { id: string; type: L2ErrorType; text: string; answer: string }
export interface L2FormData { ai_text: string; errors: L2FormError[]; dimensions: L2Dimension[]; prompt_language: "en" | "bilingual" }

export interface AssignmentFormData {
  title: string; description: string; rubric: string; due_date: string;
  attachments: AssignmentAttachment[]; submission_mode: SubmissionMode; ai_submode: AISubmode; allow_late: boolean;
  l2?: L2FormData;
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
  const [l2Text, setL2Text] = useState("");
  const [l2Errors, setL2Errors] = useState<L2FormError[]>([]);
  const [l2Dims, setL2Dims] = useState<L2Dimension[]>(DEFAULT_L2_DIMENSIONS);
  const [l2Lang, setL2Lang] = useState<"en" | "bilingual">("en");
  const aiTextRef = useRef<HTMLTextAreaElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setTitle(assignment?.title || ""); setDescription(assignment?.description || ""); setRubric(assignment?.rubric || "");
    setDueDate(toLocalInput(assignment?.due_date)); setMode(assignment?.submission_mode || "both");
    setAiMode(assignment?.ai_submode || "socratic"); setAllowLate(assignment?.allow_late !== false);
    setL2Text(assignment?.l2?.ai_text || ""); setL2Lang(assignment?.l2?.prompt_language || "en");
    setL2Errors((assignment?.l2?.errors || []).map((e) => ({ id: e.id, type: e.type, text: e.text, answer: e.answer })));
    setL2Dims(assignment?.l2?.dimensions?.length === 5 ? assignment.l2.dimensions : DEFAULT_L2_DIMENSIONS);
    setFiles((assignment?.attachments || []).map((a) => ({ id: a.id, name: a.name, size: a.size || "", type: a.type || "file", url: a.url })));
  }, [isOpen, assignment]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) return setError("Vui lòng nhập tiêu đề và hạn nộp.");
    if (mode === "writing_l2") {
      if (l2Text.trim().length < 20) return setError("Hãy dán văn bản AI (có cài lỗi) vào ô văn bản, tối thiểu 20 ký tự.");
      if (l2Errors.length === 0) return setError("Hãy bôi đen và đánh dấu ít nhất một lỗi cài sẵn trong văn bản AI.");
      const bad = l2Errors.find((e) => !findPhraseRange(l2Text, e.text));
      if (bad) return setError(`Đoạn lỗi “${bad.text.slice(0, 40)}” không còn trong văn bản AI. Hãy xóa hoặc đánh dấu lại.`);
    }
    setBusy(true); setError(null);
    try {
      await onSubmit({
        title: title.trim(), description, rubric, due_date: new Date(dueDate).toISOString(),
        attachments: files.map((f) => ({ id: f.id, name: f.name, url: f.url, size: f.size, type: f.type })),
        submission_mode: mode, ai_submode: aiMode, allow_late: allowLate,
        ...(mode === "writing_l2" ? { l2: { ai_text: l2Text, errors: l2Errors, dimensions: l2Dims, prompt_language: l2Lang } } : {}),
      });
      onClose();
    } catch (err: any) { setError(err.message || "Không thể lưu bài tập."); } finally { setBusy(false); }
  };

  const modes: { id: SubmissionMode; icon: React.ReactNode; label: string; hint: string }[] = [
    { id: "both", icon: <Layers className="w-4 h-4" />, label: "AI Chat + File", hint: "Khuyến nghị" },
    { id: "ai_chat_only", icon: <Bot className="w-4 h-4" />, label: "Chỉ AI Chat", hint: "Chấm quá trình" },
    { id: "file_only", icon: <FileText className="w-4 h-4" />, label: "Chỉ nộp file", hint: "Không dùng AI" },
    { id: "writing_l2", icon: <PenLine className="w-4 h-4" />, label: "Viết L2", hint: "Prompt, phản biện, sửa" },
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
          <label className="label">{mode === "writing_l2" ? "Đề bài viết (VD: đoạn lập luận 150 từ, người đọc là sinh viên năm nhất)" : "Đề bài (hỗ trợ Markdown & công thức LaTeX)"}</label>
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
        {mode !== "file_only" && mode !== "writing_l2" && (
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
        {mode === "writing_l2" && (
          <div className="rounded-2xl border border-brand/30 bg-brand-soft/30 p-4 space-y-5">
            <div className="flex items-start gap-3">
              <PenLine className="w-5 h-5 text-brand mt-0.5 shrink-0" />
              <p className="text-sm text-ink-2">Sinh viên làm 3 bước tuần tự: <strong className="text-ink">(1)</strong> viết prompt với AI (chỉ lập dàn ý), <strong className="text-ink">(2)</strong> phản biện văn bản AI bên dưới, <strong className="text-ink">(3)</strong> chỉnh sửa. AI chấm theo 5 chiều và đối chiếu với các lỗi bạn đánh dấu.</p>
            </div>

            <div>
              <label className="label">Ngôn ngữ prompt</label>
              <div className="grid grid-cols-2 gap-2">
                {([["en", "Chỉ tiếng Anh", "Ép luyện viết prompt bằng ngoại ngữ"], ["bilingual", "Song ngữ", "Anh hoặc Việt: điểm prompt không lẫn với trình độ ngoại ngữ"]] as const).map(([id, l, h]) => (
                  <button key={id} type="button" onClick={() => setL2Lang(id)} className={`rounded-xl border p-3 text-left ${l2Lang === id ? "border-brand bg-surface ring-4 ring-brand/10" : "border-line bg-surface hover:border-brand/40"}`}>
                    <div className="text-sm font-semibold">{l}</div><div className="text-[11px] text-mute">{h}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Văn bản AI chuẩn hóa (đã cài lỗi)</label>
              <textarea ref={aiTextRef} className="input resize-y font-mono text-sm" rows={6} value={l2Text} onChange={(e) => setL2Text(e.target.value)} placeholder="Dán đoạn văn do AI tạo (hoặc bạn tự soạn) đã cài sẵn lỗi ngôn ngữ, lỗi logic, ảo giác…" />
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <button type="button" className="btn btn-soft btn-sm" onClick={() => {
                  const el = aiTextRef.current; if (!el) return;
                  const a = el.selectionStart, b = el.selectionEnd;
                  if (b <= a) return setError("Hãy bôi đen một đoạn trong ô văn bản trước, rồi bấm nút này.");
                  const phrase = l2Text.slice(a, b);
                  if (!phrase.trim()) return setError("Đoạn bôi đen đang trống.");
                  if (l2Errors.some((e) => e.text === phrase)) return setError("Đoạn này đã được đánh dấu.");
                  setError(null);
                  setL2Errors([...l2Errors, { id: "err_" + Date.now(), type: "language", text: phrase, answer: "" }]);
                }}><Highlighter className="w-4 h-4" />Đánh dấu đoạn bôi đen là lỗi</button>
                <span className="text-xs text-mute">{l2Text.trim() ? l2Text.trim().split(/\s+/).length : 0} từ · {l2Errors.length} lỗi đã đánh dấu</span>
              </div>
            </div>

            {l2Errors.length > 0 && (
              <div className="space-y-2">
                <label className="label !mb-0">Danh sách lỗi cài sẵn và đáp án</label>
                {l2Errors.map((e, i) => {
                  const found = !!findPhraseRange(l2Text, e.text);
                  return (
                    <div key={e.id} className={`rounded-xl border bg-surface p-3 space-y-2 ${found ? "border-line" : "border-rose-400"}`}>
                      <div className="flex items-start gap-2">
                        <span className="chip chip-gray shrink-0">{i + 1}</span>
                        <p className="flex-1 text-sm font-mono bg-surface-2 rounded-lg px-2.5 py-1.5 break-words">{e.text}</p>
                        <button type="button" className="p-1.5 rounded-lg text-mute hover:text-rose-500" aria-label="Xóa lỗi" onClick={() => setL2Errors(l2Errors.filter((x) => x.id !== e.id))}><Trash2 className="w-4 h-4" /></button>
                      </div>
                      {!found && <p className="text-xs text-rose-500 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />Đoạn này không còn trong văn bản AI.</p>}
                      <div className="grid sm:grid-cols-[11rem_1fr] gap-2">
                        <select className="input !py-2" value={e.type} onChange={(ev) => setL2Errors(l2Errors.map((x) => (x.id === e.id ? { ...x, type: ev.target.value as L2ErrorType } : x)))}>
                          {L2_ERROR_TYPES.map((t) => <option key={t} value={t}>{L2_ERROR_LABEL[t]}</option>)}
                        </select>
                        <input className="input !py-2" placeholder="Đáp án: vì sao sai và cách sửa đúng" value={e.answer} onChange={(ev) => setL2Errors(l2Errors.map((x) => (x.id === e.id ? { ...x, answer: ev.target.value } : x)))} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <details className="rounded-xl border border-line bg-surface">
              <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold">Bảng tiêu chí 5 chiều (có sẵn, bạn có thể chỉnh)</summary>
              <div className="p-4 pt-1 space-y-4">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setL2Dims(DEFAULT_L2_DIMENSIONS)}><RotateCcw className="w-4 h-4" />Đặt lại mặc định</button>
                {l2Dims.map((d, di) => (
                  <div key={d.key} className="rounded-xl bg-surface-2 p-3 space-y-2">
                    <input className="input !py-2 font-semibold" value={d.name} onChange={(e) => setL2Dims(l2Dims.map((x, i) => (i === di ? { ...x, name: e.target.value } : x)))} aria-label={`Tên chiều ${di + 1}`} />
                    <textarea className="input !py-2 text-sm resize-y" rows={2} value={d.description} onChange={(e) => setL2Dims(l2Dims.map((x, i) => (i === di ? { ...x, description: e.target.value } : x)))} aria-label={`Mô tả chiều ${di + 1}`} />
                    {d.levels.map((lv, li) => (
                      <div key={li} className="flex gap-2 items-start">
                        <span className="chip chip-brand shrink-0 mt-1.5">{li + 1}</span>
                        <textarea className="input !py-1.5 text-sm resize-y" rows={2} value={lv} onChange={(e) => setL2Dims(l2Dims.map((x, i) => (i === di ? { ...x, levels: x.levels.map((l, k) => (k === li ? e.target.value : l)) } : x)))} aria-label={`Mức ${li + 1} của chiều ${di + 1}`} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </details>
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
