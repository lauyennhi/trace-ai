import React, { useEffect, useState } from "react";
import { FlaskConical, Info } from "lucide-react";
import { useToast } from "./ui";
import { api } from "../lib/api";
import type { AgreementStats } from "../lib/coach";

type Data = { overall: AgreementStats; by_course: (AgreementStats & { course: string })[]; demo: boolean; min_recommended: number };
const pct = (v: number | null) => (v === null ? "-" : `${Math.round(v * 100)}%`);

/** Does the AI's process score agree with the teacher's grade? Plain numbers, with the sample size and a warning when it is too small or demo data. */
export const ReliabilityCard: React.FC = () => {
  const toast = useToast();
  const [d, setD] = useState<Data | null>(null);
  const [retest, setRetest] = useState<any>(null), [busy, setBusy] = useState(false);
  useEffect(() => { api("/api/analytics/ai-reliability").then(setD).catch(() => setD(null)); }, []);
  if (!d) return null;
  const o = d.overall;
  const runRetest = async () => {
    setBusy(true);
    try {
      const subs: string[] = await api("/api/analytics/ai-reliability/sample");
      setRetest(await api("/api/analytics/ai-retest", { method: "POST", body: { submission_ids: subs, runs: 3 } }));
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="card p-6 space-y-4" data-testid="reliability-card">
      <div className="flex items-start justify-between gap-3">
        <div><h3 className="flex items-center gap-2 text-lg font-semibold"><FlaskConical className="h-5 w-5 text-brand" />Điểm AI có đáng tin không?</h3><p className="text-sm text-ink-2">So điểm quá trình do AI chấm (0-100) với điểm giảng viên đã chấm (0-10) trên cùng bài nộp.</p></div>
        {d.demo && <span className="chip chip-amber shrink-0">Dữ liệu demo</span>}
      </div>
      {o.n === 0 ? <p className="text-sm text-mute">Chưa có bài nào vừa được AI chấm vừa được giảng viên chấm. Số liệu sẽ hiện khi bạn chấm bài.</p> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[["Số bài so sánh", String(o.n)], ["Lệch trung bình", `${o.mae} điểm`], ["Trong ±1 điểm", pct(o.within1)], ["Tương quan", o.pearson === null ? "-" : String(o.pearson)]].map(([k, v]) => <div key={k} className="tonal p-4"><div className="text-xs text-mute">{k}</div><div className="mt-1 text-xl font-semibold tabular-nums">{v}</div></div>)}
          </div>
          <p className="text-sm text-ink-2">{o.bias! > 0.3 ? `AI có xu hướng chấm cao hơn giảng viên ${o.bias} điểm.` : o.bias! < -0.3 ? `AI có xu hướng chấm thấp hơn giảng viên ${Math.abs(o.bias!)} điểm.` : "AI không lệch rõ về phía cao hay thấp so với giảng viên."}</p>
          {(d.demo || o.n < d.min_recommended) && <p className="flex gap-2 rounded-xl bg-amber-500/10 p-3 text-sm text-ink-2"><Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />{d.demo ? "Đây là dữ liệu mẫu do hệ thống sinh ra, không phải kết quả thật. " : ""}{o.n < d.min_recommended ? `Cần ít nhất ${d.min_recommended} bài đã chấm cả hai phía mới đủ để kết luận; hiện có ${o.n}.` : ""}</p>}
        </>
      )}
      <div className="border-t border-line pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-sm font-semibold">Độ ổn định</div><p className="text-xs text-mute">Chấm lại cùng một bài 3 lần (không lưu) để xem điểm dao động bao nhiêu. Tốn khoảng 6 lượt gọi AI.</p></div><button className="btn btn-ghost btn-sm" disabled={busy} onClick={runRetest}>{busy ? "Đang chấm…" : "Chạy kiểm tra"}</button></div>
        {retest && (retest.results.length ? <ul className="mt-3 space-y-1.5 text-sm">{retest.results.map((r: any) => <li key={r.submission_id} className="flex flex-wrap justify-between gap-2"><span className="truncate text-ink-2">{r.title}</span><span className="tabular-nums">{r.scores.join(" · ")} <span className="text-mute">(độ lệch chuẩn {r.sd ?? "-"})</span></span></li>)}</ul> : <p className="mt-3 text-sm text-mute">Không chấm được bài nào. Kiểm tra khóa AI trên máy chủ.</p>)}
      </div>
    </div>
  );
};
