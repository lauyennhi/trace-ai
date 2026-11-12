import React, { useEffect, useState } from "react";
import { BookPlus, Pencil } from "lucide-react";
import { Course } from "../types";
import { Modal } from "./ui";

interface Props {
  isOpen: boolean;
  course?: Course | null; // when provided => edit mode
  onClose: () => void;
  onSubmit: (data: { name: string; code: string; semester: string; description: string }) => Promise<void>;
}

export const CourseFormModal: React.FC<Props> = ({ isOpen, course, onClose, onSubmit }) => {
  const empty = { name: "", code: "", semester: "Học kỳ I (2025-2026)", description: "" };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setForm(course ? { name: course.name, code: course.code, semester: course.semester, description: course.description } : empty);
    }
  }, [isOpen, course]);

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) return setError("Vui lòng nhập tên môn và mã môn.");
    setBusy(true); setError(null);
    try { await onSubmit(form); onClose(); } catch (err: any) { setError(err.message || "Không thể lưu môn học."); } finally { setBusy(false); }
  };

  return (
    <Modal open={isOpen} onClose={onClose} title={course ? "Chỉnh sửa môn học" : "Tạo môn học mới"}
      subtitle={course ? "Cập nhật thông tin hiển thị với sinh viên" : "Hệ thống sẽ tự tạo mã mời để sinh viên tham gia"}
      icon={course ? <Pencil className="w-5 h-5" /> : <BookPlus className="w-5 h-5" />}>
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="chip chip-rose w-full rounded-xl px-3 py-2.5 text-sm">{error}</div>}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="label">Tên môn học *</label>
            <input className="input" autoFocus value={form.name} onChange={set("name")} placeholder="VD: Lập trình & Tư duy AI" />
          </div>
          <div>
            <label className="label">Mã môn *</label>
            <input className="input font-mono uppercase" value={form.code} onChange={set("code")} placeholder="CS101" maxLength={12} />
          </div>
        </div>
        <div>
          <label className="label">Học kỳ</label>
          <input className="input" value={form.semester} onChange={set("semester")} />
        </div>
        <div>
          <label className="label">Mô tả</label>
          <textarea className="input resize-none" rows={3} value={form.description} onChange={set("description")} placeholder="Giới thiệu ngắn về môn học…" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Đang lưu…" : course ? "Lưu thay đổi" : "Tạo môn học"}</button>
        </div>
      </form>
    </Modal>
  );
};
