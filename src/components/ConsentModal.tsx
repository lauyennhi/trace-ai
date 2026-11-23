import React, { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import type { User } from "../types";
import { useToast } from "./ui";

/** Shown once to a student before anything of theirs is stored or sent to the AI. The server also refuses chat, Lab and Are-you-sure calls until consent is recorded. */
export const ConsentModal: React.FC<{ onAccepted: (u: User) => void; onDecline: () => void }> = ({ onAccepted, onDecline }) => {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const accept = async () => {
    setBusy(true);
    try { onAccepted(await api<User>("/api/me/consent", { method: "POST", body: { accept: true } })); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="consent-title" data-testid="consent-modal" className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[92svh] w-full max-w-lg overflow-y-auto rounded-3xl bg-surface p-6 shadow-2xl sm:p-8">
        <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft text-brand"><ShieldCheck className="h-6 w-6" /></span><h2 id="consent-title" className="text-xl font-semibold">Dữ liệu học tập của bạn</h2></div>
        <div className="mt-5 space-y-4 text-sm text-ink-2">
          <p>TraceEdu ghi lại <b>quá trình bạn làm bài</b> để giảng viên thấy bạn đã nghĩ như thế nào, không chỉ bài nộp cuối.</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li><b>Lưu gì:</b> các tin nhắn với trợ lý AI, ý bạn ghi trước, đoạn văn bạn chọn và sửa, câu trả lời khi bị chất vấn, số ký tự dán, bài nộp và điểm.</li>
            <li><b>Ai xem được:</b> giảng viên của môn học. Giảng viên chỉ thấy thống kê cả lớp ở dạng ẩn danh (từ 5 sinh viên trở lên). Người khác chỉ xem được hồ sơ tư duy khi <b>bạn tự tạo liên kết chia sẻ</b>, và bạn thu hồi được.</li>
            <li><b>AI xử lý:</b> nội dung bạn viết được gửi tới dịch vụ Google Gemini để tạo câu trả lời và chấm gợi ý. Tên, email và số điện thoại được lược bỏ trước khi gửi, nhưng hãy tránh viết thông tin cá nhân vào bài.</li>
            <li><b>Điểm AI chỉ là đề xuất.</b> Giảng viên là người quyết định điểm cuối.</li>
            <li><b>Quyền của bạn:</b> tải toàn bộ dữ liệu hoặc xóa dữ liệu học tập bất cứ lúc nào ở mục <i>Hồ sơ tư duy → Dữ liệu của tôi</i>. Nhà trường có thể đặt thời hạn tự xóa nhật ký chat.</li>
          </ul>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button className="btn btn-ghost" onClick={onDecline} data-testid="consent-decline">Không đồng ý, đăng xuất</button>
          <button className="btn btn-primary" disabled={busy} onClick={accept} data-testid="consent-accept">Tôi đồng ý</button>
        </div>
      </div>
    </div>
  );
};
