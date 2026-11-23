import React, { useEffect, useState } from "react";
import { Copy, Download, Link2, Link2Off, Trash2, UserRound } from "lucide-react";
import { useToast } from "../components/ui";
import { api } from "../lib/api";
import { ProfileView, type ProfileData } from "../components/ProfileView";
import { EmptyState, Skeleton } from "../components/ui";

type Share = { token: string; include_quotes: boolean; created_at: string } | null;

export const ProfilePage: React.FC = () => {
  const toast = useToast();
  const [data, setData] = useState<(ProfileData & { share: Share }) | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => api("/api/me/profile").then(setData).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);
  if (!data) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-72 rounded-3xl" /></div>;
  const link = data.share ? `${window.location.origin}/#/p/${data.share.token}` : "";
  const share = async (include: boolean) => { setBusy(true); try { await api("/api/me/profile/share", { method: "POST", body: { include_quotes: include } }); await load(); } catch (e: any) { toast.error(e.message); } finally { setBusy(false); } };
  const revoke = async () => { setBusy(true); try { await api("/api/me/profile/share", { method: "DELETE" }); await load(); toast.success("Đã thu hồi liên kết."); } catch (e: any) { toast.error(e.message); } finally { setBusy(false); } };
  const exportData = async () => {
    try {
      const d = await api("/api/me/export");
      const url = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = "traceedu-du-lieu-cua-toi.json"; a.click(); URL.revokeObjectURL(url);
    } catch (e: any) { toast.error(e.message); }
  };
  const deleteData = async () => {
    const word = window.prompt("Thao tác này xóa toàn bộ cuộc chat, bài nộp và hồ sơ tư duy của bạn trong TraceEdu, và không hoàn tác được. Điểm giảng viên đã chấm cũng sẽ mất. Tài khoản vẫn còn.\n\nGõ XOA để xác nhận:");
    if (word !== "XOA") return;
    setBusy(true);
    try { const r: any = await api("/api/me/delete-data", { method: "POST", body: { confirm: "XOA" } }); toast.success(`Đã xóa ${r.deleted_chats} cuộc chat và ${r.deleted_submissions} bài nộp.`); await load(); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const empty = data.profile.evaluated === 0;
  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl tracking-tight">Hồ sơ tư duy của bạn</h1><p className="mt-1 text-ink-2">Tổng hợp 5 tiêu chí qua mọi bài đã được chấm. Trợ lý AI cũng dựa vào đây để nhắc đúng chỗ bạn hay bỏ sót.</p></div>
      {empty ? <EmptyState icon={<UserRound className="h-8 w-8" />} title="Chưa có bài nào được chấm" text="Nộp một bài làm cùng trợ lý AI, hồ sơ sẽ xuất hiện ở đây." /> : (
        <>
          <div className="card p-6"><ProfileView data={data} /></div>
          <div className="card p-6 space-y-4">
            <div><h2 className="text-lg font-semibold">Chia sẻ hồ sơ</h2><p className="text-sm text-ink-2">Tạo một liên kết chỉ-xem để gửi nhà tuyển dụng hoặc hội đồng học bổng. Liên kết không chứa email, điểm học phần hay nhật ký chat, và bạn thu hồi được bất cứ lúc nào.</p></div>
            <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={data.share?.include_quotes ?? false} disabled={busy} onChange={(e) => share(e.target.checked)} /><span>Kèm tối đa 3 trích đoạn tư duy tốt của tôi (lấy từ câu tôi đã viết)</span></label>
            {!data.share ? <button className="btn btn-primary" disabled={busy} onClick={() => share(false)}><Link2 className="h-4 w-4" />Tạo liên kết chia sẻ</button> : (
              <div className="flex flex-wrap items-center gap-2">
                <input readOnly className="input flex-1 min-w-[220px] font-mono text-xs" value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Liên kết chia sẻ" />
                <button className="btn btn-ghost" onClick={() => { navigator.clipboard?.writeText(link); toast.success("Đã sao chép liên kết."); }}><Copy className="h-4 w-4" />Sao chép</button>
                <button className="btn btn-ghost text-red-600" disabled={busy} onClick={revoke}><Link2Off className="h-4 w-4" />Thu hồi</button>
              </div>
            )}
          </div>
        </>
      )}
      <div className="card p-6 space-y-3" data-testid="my-data">
        <div><h2 className="text-lg font-semibold">Dữ liệu của tôi</h2><p className="text-sm text-ink-2">Bạn quyết định dữ liệu học tập của mình. Tải về để giữ một bản, hoặc xóa khi bạn không muốn TraceEdu lưu nữa.</p></div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost" onClick={exportData} data-testid="export-data"><Download className="h-4 w-4" />Tải dữ liệu của tôi (.json)</button>
          <button className="btn btn-ghost text-red-600" disabled={busy} onClick={deleteData} data-testid="delete-data"><Trash2 className="h-4 w-4" />Xóa dữ liệu học tập của tôi</button>
        </div>
      </div>
    </div>
  );
};
