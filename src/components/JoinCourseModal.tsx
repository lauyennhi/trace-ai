import React, { useState } from "react";
import { KeyRound, ArrowRight } from "lucide-react";
import { Modal } from "./ui";

interface Props { isOpen: boolean; onClose: () => void; onSubmit: (inviteCode: string) => Promise<void>; }

export const JoinCourseModal: React.FC<Props> = ({ isOpen, onClose, onSubmit }) => {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return setError("Vui lòng nhập mã mời.");
    setBusy(true); setError(null);
    try { await onSubmit(code.trim().toUpperCase()); setCode(""); onClose(); }
    catch (err: any) { setError(err.message || "Không tìm thấy lớp học phù hợp với mã mời này."); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={isOpen} onClose={onClose} title="Tham gia môn học" subtitle="Nhập mã lớp do giảng viên cung cấp" icon={<KeyRound className="w-5 h-5" />} maxWidth="max-w-md">
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="chip chip-rose w-full rounded-xl px-3 py-2.5 text-sm">{error}</div>}
        <input autoFocus className="input text-center font-mono font-bold text-2xl tracking-[0.3em] uppercase py-4" maxLength={10}
          placeholder="AI2025" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <p className="text-xs text-mute text-center">Mã gồm 6 ký tự chữ và số. Hỏi giảng viên nếu bạn chưa có.</p>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Đang kiểm tra…" : <>Vào lớp <ArrowRight className="w-4 h-4" /></>}</button>
        </div>
      </form>
    </Modal>
  );
};
