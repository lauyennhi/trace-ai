import React, { useState } from "react";
import { X, Code2, ArrowRight, CheckCircle2 } from "lucide-react";

interface JoinCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (inviteCode: string) => Promise<void>;
}

export const JoinCourseModal: React.FC<JoinCourseModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [inviteCode, setInviteCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      setError("Vui lòng nhập mã mời.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(inviteCode.trim().toUpperCase());
      setInviteCode("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Không tìm thấy lớp học phù hợp với mã mời này.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 text-zinc-900 dark:text-zinc-100">
        {/* Header */}
        <div className="px-6 py-4 bg-zinc-900 dark:bg-zinc-950 text-white flex items-center justify-between border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-zinc-800 text-zinc-100 font-bold border border-zinc-700">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold">Tham gia môn học</h3>
              <p className="text-[11px] text-zinc-400">Nhập mã lớp do Giảng viên cung cấp</p>
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
            <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2">
              Mã tham gia lớp
            </label>
            <input
              type="text"
              required
              maxLength={10}
              placeholder="ví dụ: AI2025"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-zinc-400 text-center font-mono font-bold text-xl uppercase tracking-widest text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-950"
            />
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2 text-center">
              Mã mẫu demo: <strong className="text-zinc-900 dark:text-zinc-200 font-mono">AI2025</strong>, <strong className="text-zinc-900 dark:text-zinc-200 font-mono">WEB999</strong>, <strong className="text-zinc-900 dark:text-zinc-200 font-mono">TRIET1</strong>
            </p>
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
                <span>Đang kiểm tra mã...</span>
              ) : (
                <>
                  <span>Vào lớp học</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
