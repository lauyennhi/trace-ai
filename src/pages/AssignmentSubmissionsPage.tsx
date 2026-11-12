import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Download, FileSpreadsheet, Loader2, ExternalLink, Search, Sparkles, ChevronRight, Clock, Pencil } from "lucide-react";
import { Assignment, Submission } from "../types";
import { Avatar, Bar, fmtDate, relTime, riseItem, staggerParent } from "../components/ui";

interface Props {
  assignment: Assignment; submissions: Submission[];
  onOpen: (s: Submission) => void; onEdit: () => void;
  onCsv: () => void; onSheets: () => void; exporting: boolean; sheetsUrl: string | null;
}

const FILTERS = [
  { id: "all", label: "Tất cả" }, { id: "ungraded", label: "Chờ chấm" }, { id: "graded", label: "Đã chấm" }, { id: "missing", label: "Chưa nộp" },
] as const;

export const AssignmentSubmissionsPage: React.FC<Props> = ({ assignment, submissions, onOpen, onEdit, onCsv, onSheets, exporting, sheetsUrl }) => {
  const [q, setQ] = useState("");
  const [f, setF] = useState<(typeof FILTERS)[number]["id"]>("all");
  const done = (s: Submission) => s.status === "submitted" || s.status === "late";
  const counts = useMemo(() => ({
    all: submissions.length, ungraded: submissions.filter((s) => done(s) && s.grade === undefined).length,
    graded: submissions.filter((s) => s.grade !== undefined).length, missing: submissions.filter((s) => !done(s)).length,
  }), [submissions]);
  const rows = submissions.filter((s) => {
    if (q && !(s.student_name + s.student_email).toLowerCase().includes(q.toLowerCase())) return false;
    return f === "all" || (f === "ungraded" && done(s) && s.grade === undefined) || (f === "graded" && s.grade !== undefined) || (f === "missing" && !done(s));
  });
  const submittedPct = submissions.length ? Math.round(((submissions.length - counts.missing) / submissions.length) * 100) : 0;

  return (
    <motion.div variants={staggerParent} initial="initial" animate="animate" className="space-y-5">
      <motion.div variants={riseItem} className="card p-5 flex flex-wrap items-center gap-5">
        <div className="flex-1 min-w-[16rem]">
          <div className="text-xs font-semibold text-brand">Bài nộp của sinh viên</div>
          <h2 className="text-xl font-medium">{assignment.title}</h2>
          <p className="text-xs text-mute mt-1 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Hạn {fmtDate(assignment.due_date)} · {relTime(assignment.due_date)}</p>
        </div>
        <div className="w-56"><div className="flex justify-between text-xs mb-1.5"><span className="text-ink-2 font-medium">Đã nộp</span><strong>{submissions.length - counts.missing}/{submissions.length}</strong></div><Bar value={submittedPct} /></div>
        <button className="btn btn-ghost btn-sm" onClick={onEdit}><Pencil className="w-4 h-4" />Sửa bài</button>
      </motion.div>

      <motion.div variants={riseItem} className="card overflow-hidden">
        <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-line">
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((x) => (
              <button key={x.id} onClick={() => setF(x.id)} className={`chip !text-xs !py-1.5 !px-3 transition-colors ${f === x.id ? "chip-brand !border-brand/30" : "chip-gray hover:border-brand/40"}`}>{x.label} <span className="opacity-60">{counts[x.id]}</span></button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative"><Search className="w-4 h-4 text-mute absolute left-3 top-1/2 -translate-y-1/2" /><input className="input !py-2 !pl-9 w-48" placeholder="Tìm sinh viên…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <button className="btn btn-ghost btn-sm" onClick={onCsv}><Download className="w-4 h-4" />CSV</button>
            <button className="btn btn-soft btn-sm" onClick={onSheets} disabled={exporting}>{exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}Google Sheets</button>
            {sheetsUrl && <a href={sheetsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">Mở Sheet <ExternalLink className="w-3.5 h-3.5" /></a>}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-mute bg-surface-2 border-b border-line"><th className="py-3 px-5 font-semibold">Sinh viên</th><th className="px-3 font-semibold">Trạng thái</th><th className="px-3 font-semibold">Nộp lúc</th><th className="px-3 font-semibold">Tư duy (AI)</th><th className="px-3 font-semibold">Điểm</th><th className="px-5" /></tr></thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-mute">Không có sinh viên phù hợp.</td></tr>}
              {rows.map((s) => {
                const ok = done(s);
                return (
                  <tr key={s.id} onClick={() => ok && onOpen(s)} className={`transition-colors ${ok ? "cursor-pointer hover:bg-brand-soft/40" : "opacity-70"}`}>
                    <td className="py-3 px-5"><div className="flex items-center gap-3"><Avatar name={s.student_name} src={s.student_avatar} size={34} /><div><div className="font-semibold">{s.student_name}</div><div className="text-xs text-mute">{s.student_email}</div></div></div></td>
                    <td className="px-3">{s.status === "submitted" ? <span className="chip chip-green">Đã nộp</span> : s.status === "late" ? <span className="chip chip-amber">Nộp trễ</span> : s.status === "not_submitted" ? <span className="chip chip-rose">Chưa nộp</span> : <span className="chip chip-gray">Chưa nộp</span>}</td>
                    <td className="px-3 text-ink-2">{s.submitted_at ? fmtDate(s.submitted_at) : "—"}</td>
                    <td className="px-3">{s.process_score_result ? <span className="chip chip-brand"><Sparkles className="w-3 h-3" />{s.process_score_result.process_score}/100</span> : s.eval_status === "failed" ? <span className="chip chip-amber">AI lỗi</span> : <span className="text-mute">—</span>}</td>
                    <td className="px-3">{s.grade !== undefined ? <span className="font-bold">{s.grade}<span className="text-mute font-normal">/10</span></span> : ok ? <span className="chip chip-rose">Chờ chấm</span> : <span className="text-mute">—</span>}</td>
                    <td className="px-5 text-right">{ok && <span className="inline-flex items-center gap-1 text-brand text-xs font-semibold">Chấm bài<ChevronRight className="w-4 h-4" /></span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
};
