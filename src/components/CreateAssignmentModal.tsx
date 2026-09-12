import React, { useState } from "react";
import { X, Plus, FileText, Bot, Sparkles, Paperclip, Calendar, HelpCircle } from "lucide-react";
import { SubmissionMode, AISubmode, AssignmentAttachment } from "../types";
import { FileUploadZone, UploadedFileItem } from "./FileUploadZone";

interface CreateAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description: string;
    rubric: string;
    due_date: string;
    attachments: AssignmentAttachment[];
    submission_mode: SubmissionMode;
    ai_submode: AISubmode;
  }) => Promise<void>;
}

export const CreateAssignmentModal: React.FC<CreateAssignmentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rubric, setRubric] = useState("");
  const defaultDueDate = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 16);
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [submissionMode, setSubmissionMode] = useState<SubmissionMode>("both");
  const [aiSubmode, setAiSubmode] = useState<AISubmode>("socratic");
  const [attachments, setAttachments] = useState<AssignmentAttachment[]>([]);
  const [newFileName, setNewFileName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddAttachment = () => {
    if (!newFileName.trim()) return;
    setAttachments([
      ...attachments,
      {
        id: "att_" + Date.now(),
        name: newFileName.trim(),
        url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        size: "1.5 MB",
        type: "pdf",
      },
    ]);
    setNewFileName("");
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(attachments.filter((a) => a.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) {
      setError("Vui lòng nhập Tiêu đề và Hạn nộp bài.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        rubric: rubric.trim(),
        due_date: new Date(dueDate).toISOString(),
        attachments,
        submission_mode: submissionMode,
        ai_submode: aiSubmode,
      });
      setTitle("");
      setDescription("");
      setRubric("");
      setAttachments([]);
      onClose();
    } catch (err: any) {
      setError(err.message || "Có lỗi xảy ra khi tạo bài tập.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-2xl overflow-hidden my-8 animate-in fade-in zoom-in duration-200 text-zinc-900 dark:text-zinc-100">
        {/* Header */}
        <div className="px-6 py-4 bg-zinc-900 dark:bg-zinc-950 text-white flex items-center justify-between border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-zinc-800 text-zinc-100 font-bold border border-zinc-700">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold">Tạo bài tập mới</h3>
              <p className="text-[11px] text-zinc-400">Thiết lập đề bài, hình thức nộp và cấu hình Trợ lý AI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 text-xs font-medium bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
              Tiêu đề bài tập <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="ví dụ: Phân tích Đạo đức AI trong Quyết định Tuyển dụng"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-zinc-400 text-xs text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-950 font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
              Mô tả đề bài chi tiết
            </label>
            <textarea
              rows={4}
              placeholder="Nhập các câu hỏi, yêu cầu thực hiện, hướng dẫn nộp bài..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-zinc-400 text-xs text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-950 font-normal leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
              Tiêu chí chấm điểm (Rubric)
            </label>
            <textarea
              rows={3}
              placeholder="Ghi rõ trọng số %, các mức tiêu chí đánh giá cho sinh viên nắm rõ..."
              value={rubric}
              onChange={(e) => setRubric(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-zinc-400 text-xs text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-950 font-normal"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Hạn nộp bài <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-zinc-400 text-xs text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-950"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Hình thức nộp bài
              </label>
              <select
                value={submissionMode}
                onChange={(e) => setSubmissionMode(e.target.value as SubmissionMode)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-zinc-400 text-xs font-semibold text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-950"
              >
                <option value="both">Cả hai (AI Chat + Upload File)</option>
                <option value="ai_chat_only">Làm qua AI Chat (Nộp trực tiếp)</option>
                <option value="file_only">Chỉ nộp file (Truyền thống)</option>
              </select>
            </div>
          </div>

          {/* AI Submode Config Card - if AI enabled */}
          {submissionMode !== "file_only" && (
            <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                    Cấu hình Trợ lý AI cho Bài tập
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200">
                  Ghi nhật ký Process Score
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAiSubmode("socratic")}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    aiSubmode === "socratic"
                      ? "bg-white dark:bg-zinc-900 border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 shadow-xs"
                      : "bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-900"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs mb-1 text-zinc-900 dark:text-zinc-100">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Chế độ Socratic (Khuyên dùng)
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
                    AI không cho đáp án ngay, mà đặt câu hỏi gợi mở để kích thích sinh viên tự suy nghĩ.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setAiSubmode("normal")}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    aiSubmode === "normal"
                      ? "bg-white dark:bg-zinc-900 border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 shadow-xs"
                      : "bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-900"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs mb-1 text-zinc-900 dark:text-zinc-100">
                    <Bot className="w-3.5 h-3.5 text-zinc-500" />
                    Chế độ Thường
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
                    AI đóng vai trợ lý giải đáp thắc mắc và cung cấp thông tin bài học trực tiếp.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Attachments Section */}
          <div>
            <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
              Tài liệu đính kèm (File đề bài, tài liệu tham khảo)
            </label>
            <FileUploadZone
              files={attachments.map((a) => ({
                id: a.id,
                name: a.name,
                size: a.size,
                type: a.type,
                url: a.url,
              }))}
              onFilesChange={(newFiles) => {
                setAttachments(
                  newFiles.map((f) => ({
                    id: f.id,
                    name: f.name,
                    size: f.size,
                    type: f.type,
                    url: f.url,
                  }))
                );
              }}
              label="Kéo & thả file đề bài/tài liệu môn học vào đây"
              sublabel="Hỗ trợ PDF, Word, PowerPoint, TXT, mã nguồn, ZIP..."
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-950 font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Đang đăng bài tập...</span>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Giao bài tập</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
