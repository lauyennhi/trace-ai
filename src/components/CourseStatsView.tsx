import React, { useState } from "react";
import { motion } from "motion/react";
import { Award, Users, CheckCircle2, BarChart3, Sparkles, AlertTriangle, TrendingUp, Star, PenLine, ClipboardPaste, Gauge } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, CartesianGrid } from "recharts";
import { ClassStats } from "../types";
import { L2_ERROR_LABEL } from "../lib/l2";
import { AnimatedNumber, Avatar, Bar as ProgressBar, EmptyState, riseItem, staggerParent } from "./ui";

// One palette across the app: evidence green / cobalt / violet for good, amber / rose for concern
const COLORS = ["#10b981", "#0b57d0", "#7c4dff", "#f59e0b", "#f43f5e"];
const tip = { backgroundColor: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 12, color: "var(--ink)", boxShadow: "var(--shadow-card)" };


const HEAT_TONE = ["16,185,129", "11,87,208", "124,77,255", "245,158,11", "244,63,94"]; // emerald, indigo, amber, amber, rose

const Heatmap: React.FC<{ h: NonNullable<ClassStats["heatmap"]> }> = ({ h }) => {
  if (!h.enough) return <p className="text-sm text-mute py-10 text-center">Cần ít nhất {h.min} bài đã được AI chấm để vẽ bản đồ nhiệt (hiện có {h.evaluated}). Ngưỡng này giúp số liệu không lộ từng bạn trong lớp nhỏ.</p>;
  const max = Math.max(1, ...h.cells!.flat());
  return (
    <div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `5.5rem repeat(${h.cols!.length}, minmax(0, 1fr))` }} data-testid="class-heatmap">
        {h.rows!.map((r, ri) => (
          <React.Fragment key={r}>
            <div className="text-[11px] text-mute flex items-center justify-end pr-2 font-medium">{r}</div>
            {h.cells![ri].map((c, ci) => (
              <motion.div key={ci} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: (ri + ci) * 0.04 }}
                title={`${c} bài · điểm ${r} · ${h.cols![ci]}`}
                className="h-14 rounded-xl flex items-center justify-center text-sm font-bold border border-line"
                style={{ background: c ? `rgba(${HEAT_TONE[ri]}, ${0.12 + 0.55 * (c / max)})` : "var(--surface-2)", color: c ? "var(--ink)" : "var(--mute)" }}>{c || ""}</motion.div>
            ))}
          </React.Fragment>
        ))}
        <div />
        {h.cols!.map((c) => <div key={c} className="text-[11px] text-mute text-center pt-1 font-medium">{c}</div>)}
      </div>
      <div className="flex justify-between text-[11px] text-mute mt-2"><span>↑ Điểm quá trình (AI)</span><span>Số lượt trao đổi →</span></div>
      <div className="flex flex-wrap gap-2 mt-3">
        <span className="chip chip-green">{h.share!.high}% từ 80 điểm trở lên</span>
        <span className="chip chip-brand">{h.share!.mid}% từ 40 đến 79</span>
        <span className="chip chip-amber">{h.share!.low}% dưới 40</span>
      </div>
    </div>
  );
};

const Sparkline: React.FC<{ values?: number[] }> = ({ values }) => {
  if (!values || values.length === 0) return <span className="text-mute">—</span>;
  const w = 84, h = 28, pad = 4;
  const pts = values.map((v, i) => [values.length === 1 ? w / 2 : pad + (i * (w - pad * 2)) / (values.length - 1), h - pad - (Math.max(0, Math.min(100, v)) / 100) * (h - pad * 2)]);
  const d = pts.map((p, i) => `${i ? "L" : "M"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Điểm quá trình qua ${values.length} bài: ${values.join(", ")}`}>
      <defs><linearGradient id="spark" gradientUnits="userSpaceOnUse" x1="0" x2={w}><stop offset="0" stopColor="#0b57d0" /><stop offset="0.6" stopColor="#7c4dff" /><stop offset="1" stopColor="#ec4899" /></linearGradient></defs>
      {values.length > 1 && <path d={d} fill="none" stroke="url(#spark)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={3} fill="#7c4dff" />
    </svg>
  );
};

export const CourseStatsView: React.FC<{ stats: ClassStats }> = ({ stats }) => {
  if (stats.total_students === 0 || stats.total_assignments === 0) {
    return <EmptyState icon={<BarChart3 className="w-8 h-8" />} title="Chưa đủ dữ liệu để thống kê"
      text={stats.total_students === 0 ? "Chia sẻ mã mời để sinh viên tham gia lớp." : "Hãy giao bài tập đầu tiên để bắt đầu theo dõi."} />;
  }
  const pie = [
    { name: "Đúng hạn", value: stats.on_time_rate, color: "#10b981" },
    { name: "Trễ hạn", value: stats.late_rate, color: "#f59e0b" },
    { name: "Chưa nộp", value: stats.not_submitted_rate, color: "#f43f5e" },
  ].filter((d) => d.value > 0);
  const hasScores = stats.evaluated_count > 0;
  const [studentFilter, setStudentFilter] = useState<"all" | "attention">("all");
  const attentionCount = stats.students.filter((x) => x.needs_attention).length;
  const weakest = stats.per_assignment.find((a) => a.avg_score !== null && a.avg_score < 75);
  const kpis = [
    { label: "Sinh viên", value: stats.total_students, suffix: "", icon: Users, tone: "from-[#0b57d0] to-[#1a73e8]", hint: `${stats.total_assignments} bài tập đã giao` },
    { label: "Tỷ lệ nộp bài", value: stats.submission_rate, suffix: "%", icon: CheckCircle2, tone: "from-[#10b981] to-[#0f8a55]", hint: `Đúng hạn ${stats.on_time_rate}% · Trễ ${stats.late_rate}%` },
    { label: "Process Score TB", value: stats.average_process_score ?? 0, suffix: "", icon: Award, tone: "from-[#5b5bf0] to-[#7c4dff]", hint: hasScores ? `Từ ${stats.evaluated_count} bài đã chấm` : "Chưa có bài nào được chấm", none: !hasScores },
    { label: "Điểm giảng viên TB", value: stats.average_grade ?? 0, suffix: "", icon: Star, tone: "from-[#7c4dff] to-[#ec4899]", hint: stats.average_grade != null ? "Thang 10, trên các bài đã chấm" : "Chưa có bài nào được chấm điểm", none: stats.average_grade == null },
    { label: "Chưa nộp", value: stats.not_submitted_rate, suffix: "%", icon: AlertTriangle, tone: "from-[#f43f5e] to-[#e11d48]", hint: "Trên tổng số bài được giao" },
  ];
  return (
    <motion.div variants={staggerParent} initial="initial" animate="animate" className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((k) => (
          <motion.div key={k.label} variants={riseItem} className="card p-5 relative overflow-hidden">
            <div className={`absolute -right-5 -top-5 w-20 h-20 rounded-full bg-gradient-to-br ${k.tone} opacity-15`} />
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${k.tone} text-white flex items-center justify-center mb-3 shadow-lg`}><k.icon className="w-5 h-5" /></div>
            <div className="text-3xl font-medium tracking-tight">{k.none ? "—" : <AnimatedNumber value={k.value} suffix={k.suffix} decimals={k.label === "Điểm giảng viên TB" ? 1 : 0} />}</div>
            <div className="text-sm font-semibold mt-0.5">{k.label}</div>
            <div className="text-xs text-mute mt-1">{k.hint}</div>
          </motion.div>
        ))}
      </div>

      {stats.heatmap && (
        <div className="grid lg:grid-cols-3 gap-6">
          <motion.div variants={riseItem} className="card p-6 lg:col-span-2">
            <h3 className="font-bold flex items-center gap-2"><Gauge className="w-4 h-4 text-brand" />Bản đồ nhiệt tư duy cả lớp</h3>
            <p className="text-xs text-mute mb-4">Mỗi ô là số bài nộp theo số lượt trao đổi và điểm quá trình do AI chấm. Số liệu tổng hợp, không hiện tên.</p>
            <Heatmap h={stats.heatmap} />
          </motion.div>
          <motion.div variants={riseItem} className="card p-6 bg-gradient-to-br from-brand-soft/50 to-transparent lg:self-start">
            <h3 className="font-bold flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-500" />Gợi ý sư phạm từ số liệu</h3>
            <p className="text-xs text-mute mb-3">Rút ra từ điểm quá trình của từng bài tập, không dùng thêm AI.</p>
            {weakest ? (
              <div className="space-y-3 text-sm">
                <p><strong>{weakest.title}</strong> đang có điểm quá trình trung bình thấp nhất lớp: <strong>{weakest.avg_score}/100</strong>.</p>
                <p className="text-ink-2">{weakest.recommendation}</p>
              </div>
            ) : <p className="text-sm text-ink-2">{hasScores ? "Chưa có bài tập nào có điểm quá trình trung bình dưới 75. Lớp đang tương tác chủ động." : "Chưa có bài nào được chấm quá trình để đưa ra gợi ý."}</p>}
          </motion.div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div variants={riseItem} className="card p-6 lg:col-span-2">
          <h3 className="font-bold flex items-center gap-2"><BarChart3 className="w-4 h-4 text-brand" />Phân bố Process Score</h3>
          <p className="text-xs text-mute mb-4">Số bài nộp theo dải điểm tư duy (chỉ tính bài đã được AI chấm)</p>
          {hasScores ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.score_distribution} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="range" tick={{ fontSize: 12, fill: "var(--mute)" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--mute)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tip} cursor={{ fill: "var(--surface-2)" }} formatter={(v: any, _n: any, p: any) => [`${v} bài`, p.payload.label]} labelFormatter={(l) => `Điểm ${l}`} />
                  <Bar dataKey="count" radius={[10, 10, 4, 4]} animationDuration={1000}>{stats.score_distribution.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="h-64 flex items-center justify-center text-sm text-mute">Chưa có bài nào được chấm quá trình.</p>}
        </motion.div>

        <motion.div variants={riseItem} className="card p-6">
          <h3 className="font-bold">Tiến độ nộp bài</h3>
          <p className="text-xs text-mute">Toàn bộ bài tập × sinh viên</p>
          <div className="h-44 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={pie} innerRadius={52} outerRadius={74} paddingAngle={4} dataKey="value" cornerRadius={6} animationDuration={1000} stroke="none">{pie.map((d, i) => <Cell key={i} fill={d.color} />)}</Pie><Tooltip contentStyle={tip} formatter={(v: any) => `${v}%`} /></PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><div className="text-2xl font-medium">{stats.submission_rate}%</div><div className="text-[11px] text-mute">đã nộp</div></div>
          </div>
          <div className="space-y-2 text-sm mt-2">
            {[["Đúng hạn", stats.on_time_rate, "#10b981"], ["Trễ hạn", stats.late_rate, "#f59e0b"], ["Chưa nộp", stats.not_submitted_rate, "#f43f5e"]].map(([n, v, c]) => (
              <div key={n as string} className="flex items-center justify-between"><span className="flex items-center gap-2 text-ink-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c as string }} />{n}</span><strong>{v}%</strong></div>
            ))}
          </div>
        </motion.div>
      </div>

      <motion.div variants={riseItem} className="card p-6">
        <h3 className="font-bold flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-500" />Hiệu quả từng bài tập & gợi ý ra đề</h3>
        <p className="text-xs text-mute mb-4">Sắp xếp từ điểm quá trình thấp nhất — những bài này sinh viên có xu hướng xin đáp án</p>
        <div className="space-y-3">
          {stats.per_assignment.map((a) => (
            <div key={a.assignment_id} className="rounded-2xl border border-line p-4 bg-surface-2/50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-sm">{a.title}</span>
                <span className="text-xs text-mute">{a.submitted}/{a.total} đã nộp</span>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <ProgressBar value={a.avg_score ?? 0} className="flex-1" from={a.avg_score !== null && a.avg_score < 75 ? "#f59e0b" : "var(--brand)"} to={a.avg_score !== null && a.avg_score < 75 ? "#f43f5e" : "var(--brand-2)"} />
                <span className="text-sm font-bold w-16 text-right">{a.avg_score === null ? "—" : `${a.avg_score}/100`}</span>
              </div>
              <p className="text-xs text-ink-2 mt-2.5 flex gap-1.5"><TrendingUp className="w-3.5 h-3.5 mt-0.5 shrink-0 text-brand" />{a.recommendation}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {stats.behavior && (
        <motion.div variants={riseItem} className="card p-6 space-y-4" data-testid="behavior-stats">
          <div><h3 className="font-bold flex items-center gap-2"><Sparkles className="w-4 h-4 text-brand" />Chỉ báo hành vi khi làm bài với AI</h3>
            <p className="text-xs text-mute">Số liệu tổng hợp ẩn danh cho cả lớp, không hiện theo từng sinh viên. Chỉ mang tính tham khảo, không dùng để kết luận về một cá nhân.</p></div>
          {!stats.behavior.enough ? (
            <p className="text-sm text-mute">Cần ít nhất {stats.behavior.min_students} sinh viên có dữ liệu chat để hiển thị (hiện có {stats.behavior.students}). Ngưỡng này giúp không lộ hành vi của từng em trong lớp nhỏ.</p>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-line p-4 bg-surface-2/50"><div className="text-xs text-mute flex items-center gap-1.5"><PenLine className="w-3.5 h-3.5" />Tự ghi ý trước khi hỏi AI</div><div className="text-2xl font-medium mt-1">{stats.behavior.wrote_first_rate ?? "—"}{stats.behavior.wrote_first_rate != null && <span className="text-sm text-mute">%</span>}</div><div className="text-[11px] text-mute mt-1">trên {stats.behavior.friction_sessions} lượt làm bài có bật ma sát</div></div>
              <div className="rounded-2xl border border-line p-4 bg-surface-2/50"><div className="text-xs text-mute flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />Bỏ qua bước ghi ý</div><div className="text-2xl font-medium mt-1">{stats.behavior.skipped_rate ?? "—"}{stats.behavior.skipped_rate != null && <span className="text-sm text-mute">%</span>}</div><div className="text-[11px] text-mute mt-1">mức "Nhắc nhẹ" cho phép bỏ qua</div></div>
              <div className="rounded-2xl border border-line p-4 bg-surface-2/50"><div className="text-xs text-mute flex items-center gap-1.5"><ClipboardPaste className="w-3.5 h-3.5" />Tin nhắn dán nhiều chữ</div><div className="text-2xl font-medium mt-1">{stats.behavior.paste_heavy_rate ?? "—"}{stats.behavior.paste_heavy_rate != null && <span className="text-sm text-mute">%</span>}</div><div className="text-[11px] text-mute mt-1">dán từ {stats.behavior.paste_heavy_chars} ký tự trở lên</div></div>
              <div className="rounded-2xl border border-line p-4 bg-surface-2/50"><div className="text-xs text-mute flex items-center gap-1.5"><Gauge className="w-3.5 h-3.5" />Độ tự tin so với tư duy (AI)</div>
                {stats.behavior.calibration ? <div className="text-2xl font-medium mt-1">{stats.behavior.calibration.avg_confidence}<span className="text-sm text-mute"> vs </span>{stats.behavior.calibration.avg_process_score}</div> : <div className="text-sm text-mute mt-2">Chưa đủ dữ liệu</div>}
                <div className="text-[11px] text-mute mt-1">tự tin (quy 0-100) so với điểm quá trình TB</div></div>
            </div>
          )}
        </motion.div>
      )}

      {stats.l2 && (
        <motion.div variants={riseItem} className="card p-6 space-y-5">
          <div><h3 className="font-bold flex items-center gap-2"><Sparkles className="w-4 h-4 text-brand" />Bài Viết L2: phân bố điểm theo từng chiều</h3>
            <p className="text-xs text-mute">{stats.l2.evaluated} bài đã chấm trong {stats.l2.assignments} bài tập · điểm cuối (giảng viên chỉnh nếu có), thang 1-5</p></div>
          {stats.l2.evaluated === 0 ? <p className="text-sm text-mute">Chưa có bài Viết L2 nào được chấm.</p> : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {stats.l2.dimensions.map((d) => (
                <div key={d.key} className="rounded-2xl border border-line p-4">
                  <div className="flex items-center justify-between"><span className="text-sm font-semibold">{d.name}</span><span className="chip chip-brand">TB {d.avg ?? "—"}</span></div>
                  <div className="h-28 mt-2"><ResponsiveContainer width="100%" height="100%"><BarChart data={d.distribution.map((c, i) => ({ s: String(i + 1), c }))} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}><XAxis dataKey="s" tick={{ fontSize: 11, fill: "var(--mute)" }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--mute)" }} axisLine={false} tickLine={false} /><Tooltip contentStyle={tip} cursor={{ fill: "var(--surface-2)" }} formatter={(v: any) => [`${v} bài`, "Số bài"]} labelFormatter={(l) => `Điểm ${l}`} /><Bar dataKey="c" radius={[6, 6, 2, 2]} fill="#5b5bf0" animationDuration={900} /></BarChart></ResponsiveContainer></div>
                </div>
              ))}
            </div>
          )}
          {stats.l2.missed_errors.length > 0 && (
            <div><h4 className="text-sm font-bold mb-2">Lỗi cài sẵn cả lớp hay bỏ sót</h4>
              <div className="space-y-2">{stats.l2.missed_errors.map((m, i) => (
                <div key={i} className="rounded-xl border border-line p-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1"><p className="text-sm italic break-words">“{m.text}”</p><p className="text-xs text-mute">{L2_ERROR_LABEL[m.type as keyof typeof L2_ERROR_LABEL] || m.type} · {m.assignment_title}</p></div>
                  <div className="w-36 shrink-0"><div className="flex justify-between text-xs mb-1"><span className="text-ink-2">Bỏ sót</span><strong>{m.missed}/{m.total}</strong></div><ProgressBar value={(m.missed / m.total) * 100} from="#f59e0b" to="#f43f5e" /></div>
                </div>))}</div></div>
          )}
        </motion.div>
      )}

      <motion.div variants={riseItem} className="card overflow-hidden">
        <div className="p-6 pb-3 flex flex-wrap items-end justify-between gap-3"><div><h3 className="font-bold">Theo dõi từng sinh viên</h3><p className="text-xs text-mute">Đường nhỏ là điểm quá trình qua các bài, từ cũ đến mới. Sinh viên cần chú ý được đánh dấu để bạn hỗ trợ sớm</p></div>
          <div className="flex gap-2" role="tablist" aria-label="Lọc sinh viên">
            <button role="tab" aria-selected={studentFilter === "all"} onClick={() => setStudentFilter("all")} className={`pill ${studentFilter === "all" ? "pill-active" : ""}`}>Tất cả ({stats.students.length})</button>
            <button role="tab" aria-selected={studentFilter === "attention"} onClick={() => setStudentFilter("attention")} className={`pill ${studentFilter === "attention" ? "pill-active" : ""}`}>Cần chú ý ({attentionCount})</button>
          </div></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-mute border-y border-line bg-surface-2"><th className="py-2.5 px-6 font-semibold">Sinh viên</th><th className="px-3 font-semibold">Đã nộp</th><th className="px-3 font-semibold">Trễ</th><th className="px-3 font-semibold">Tư duy TB</th><th className="px-3 font-semibold">Dấu vết qua các bài</th><th className="px-6 font-semibold text-right">Điểm TB</th></tr></thead>
            <tbody className="divide-y divide-line">
              {stats.students.filter((x) => studentFilter === "all" || x.needs_attention).map((s) => (
                <tr key={s.student_id} className="hover:bg-surface-2/60 transition-colors">
                  <td className="py-3 px-6"><div className="flex items-center gap-3"><Avatar name={s.student_name} src={s.student_avatar} size={32} /><div><div className="font-semibold flex items-center gap-2">{s.student_name}{s.needs_attention && <span className="chip chip-rose">Cần chú ý</span>}</div><div className="text-xs text-mute">{s.student_email}</div></div></div></td>
                  <td className="px-3">{s.submitted}/{s.total}</td>
                  <td className="px-3">{s.late || "—"}</td>
                  <td className="px-3">{s.avg_process_score === null ? "—" : <span className="chip chip-brand">{s.avg_process_score}/100</span>}</td>
                  <td className="px-3"><Sparkline values={s.scores} /></td>
                  <td className="px-6 text-right font-semibold">{s.avg_grade === null ? "—" : s.avg_grade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
};
