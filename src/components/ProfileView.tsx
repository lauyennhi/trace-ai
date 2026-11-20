import React from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { Quote, TrendingDown, TrendingUp } from "lucide-react";
import { CRITERIA, criterionLabel, type LearningProfile } from "../lib/coach";

export interface ProfileData { profile: LearningProfile; quotes: { text: string; reason: string }[]; recent?: { title: string; score: number; at?: string }[] }

const Spark: React.FC<{ values: number[] }> = ({ values }) => {
  if (values.length < 2) return null;
  const w = 220, h = 56, pad = 6, lo = Math.min(...values, 40), hi = Math.max(...values, 90);
  const pts = values.map((v, i) => [pad + (i * (w - pad * 2)) / (values.length - 1), h - pad - ((v - lo) / (hi - lo || 1)) * (h - pad * 2)] as const);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[260px]" role="img" aria-label={`Điểm quá trình qua ${values.length} bài: ${values.join(", ")}`}>
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 4.5 : 3} fill="var(--brand)" />)}
    </svg>
  );
};

/** Radar of the five criteria, strongest and weakest, trend across assignments and (optionally) a few of the student's own best moments. */
export const ProfileView: React.FC<{ data: ProfileData }> = ({ data }) => {
  const { profile: p, quotes, recent } = data;
  const radar = CRITERIA.map((c) => ({ subject: c.label, v: p.avg[c.key] }));
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <div className="h-64"><ResponsiveContainer width="100%" height="100%"><RadarChart outerRadius="68%" data={radar}><PolarGrid stroke="var(--line)" /><PolarAngleAxis dataKey="subject" tick={{ fill: "var(--ink-2)", fontSize: 12 }} /><PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} /><Radar dataKey="v" stroke="var(--brand)" fill="var(--brand)" fillOpacity={0.25} strokeWidth={2} /></RadarChart></ResponsiveContainer></div>
        <p className="text-center text-xs text-mute">Trung bình {p.evaluated} bài đã được chấm</p>
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="tonal p-4"><div className="text-xs text-mute">Mạnh nhất</div><div className="mt-1 text-lg font-semibold">{p.strongest ? criterionLabel(p.strongest) : "-"}</div>{p.strongest && <div className="text-xs text-ink-2">{p.avg[p.strongest]}/100</div>}</div>
          <div className="tonal p-4"><div className="text-xs text-mute">Cần luyện thêm</div><div className="mt-1 text-lg font-semibold">{p.weakest ? criterionLabel(p.weakest) : "-"}</div>{p.weakest && <div className="text-xs text-ink-2">{p.avg[p.weakest]}/100</div>}</div>
        </div>
        {p.delta !== null && <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${p.delta >= 0 ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}>{p.delta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}Bài gần nhất {p.delta >= 0 ? "+" : ""}{p.delta} điểm so với trung bình các bài trước</div>}
        <div><div className="mb-1 text-xs text-mute">Điểm quá trình theo bài</div><Spark values={p.trend} /></div>
        {recent && recent.length > 0 && <ul className="space-y-1 text-sm">{recent.map((r, i) => <li key={i} className="flex justify-between gap-3"><span className="truncate text-ink-2">{r.title}</span><span className="font-semibold tabular-nums">{r.score}</span></li>)}</ul>}
      </div>
      {quotes.length > 0 && (
        <div className="md:col-span-2">
          <div className="mb-2 text-sm font-semibold">Những khoảnh khắc tư duy tốt</div>
          <div className="grid gap-3 md:grid-cols-3">{quotes.map((q, i) => <div key={i} className="tonal p-4 text-sm"><Quote className="mb-2 h-4 w-4 text-brand" /><p className="italic">“{q.text}”</p>{q.reason && <p className="mt-2 text-xs text-mute">{q.reason}</p>}</div>)}</div>
        </div>
      )}
    </div>
  );
};
