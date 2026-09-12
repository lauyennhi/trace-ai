import React, { useState, useEffect } from "react";
import { X, BookOpen, Check, Edit3 } from "lucide-react";
import { Course } from "../types";

interface EditCourseModalProps {
  isOpen: boolean;
  course: Course | null;
  onClose: () => void;
  onSubmit: (data: { name: string; code: string; semester: string; description: string }) => Promise<void>;
}

export const EditCourseModal: React.FC<EditCourseModalProps> = ({
  isOpen,
  course,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [semester, setSemester] = useState("Học kỳ I (2025-2026)");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (course) {
      setName(course.name || "");
      setCode(course.code || "");
      setSemester(course.semester || "Học kỳ I (2025-2026)");
      setDescription(course.description || "");
      setError(null);
    }
  }, [course, isOpen]);

  if (!isOpen || !course) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      setError("Vui lòng nhập đầy đủ Tên môn học và Mã môn.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        semester,
        description: description.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Có lỗi xảy ra khi cập nhật môn học.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 text-zinc-900 dark:text-zinc-100">
        {/* Header */}
        <div className="px-6 py-4 bg-zinc-900 dark:bg-zinc-950 text-white flex items-center justify-between border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-zinc-800 text-zinc-100 font-bold border border-zinc-700">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold">Chỉnh sửa thông tin môn học</h3>
              <p className="text-[11px] text-zinc-400">Mã mời: {course.invite_code}</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs font-medium bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
              Tên môn học <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="ví dụ: Nhập môn Trí tuệ Nhân tạo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-zinc-400 text-xs text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-950"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Mã môn học <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="ví dụ: CS301"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-zinc-400 text-xs uppercase font-mono font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-950"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Học kỳ
              </label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-zinc-400 text-xs text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-950"
              >
                <option value="Học kỳ I (2025-2026)">Học kỳ I (2025-2026)</option>
                <option value="Học kỳ II (2025-2026)">Học kỳ II (2025-2026)</option>
                <option value="Học kỳ Hè 2026">Học kỳ Hè 2026</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
              Mô tả môn học & Mục tiêu
            </label>
            <textarea
              rows={3}
              placeholder="Tóm tắt chương trình môn học, nội dung chính..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-zinc-400 text-xs text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-950"
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
                <span>Đang lưu...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Lưu thay đổi</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
