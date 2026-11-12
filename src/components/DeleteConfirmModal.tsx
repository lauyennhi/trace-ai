import React, { useState } from "react";
import { Trash2, TriangleAlert } from "lucide-react";
import { Modal } from "./ui";

interface Props {
  isOpen: boolean; title: string; itemName: string; itemType: string;
  warning?: string; confirmLabel?: string;
  onClose: () => void; onConfirm: () => Promise<void>;
}

export const DeleteConfirmModal: React.FC<Props> = ({ isOpen, title, itemName, itemType, warning, confirmLabel = "Xóa vĩnh viễn", onClose, onConfirm }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setError(null);
    try { await onConfirm(); onClose(); } catch (e: any) { setError(e.message || "Không thể thực hiện."); } finally { setBusy(false); }
  };
  return (
    <Modal open={isOpen} onClose={onClose} title={title} icon={<TriangleAlert className="w-5 h-5 text-rose-500" />} maxWidth="max-w-md">
      <div className="space-y-4">
        {error && <div className="chip chip-rose w-full rounded-xl px-3 py-2.5 text-sm">{error}</div>}
        <p className="text-sm text-ink-2">
          Bạn sắp {confirmLabel.toLowerCase()} {itemType} <strong className="text-ink">“{itemName}”</strong>.
        </p>
        <div className="rounded-xl bg-[#fff4de] dark:bg-[#33260c] text-[#8a5300] dark:text-[#fbbf4a] p-3 text-sm">
          {warning || "Toàn bộ dữ liệu liên quan (bài tập, bài nộp, nhật ký chat) sẽ bị xóa và không thể khôi phục."}
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn bg-rose-600 text-white hover:bg-rose-700" onClick={go} disabled={busy}><Trash2 className="w-4 h-4" />{busy ? "Đang xử lý…" : confirmLabel}</button>
        </div>
      </div>
    </Modal>
  );
};
