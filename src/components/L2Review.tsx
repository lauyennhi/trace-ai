import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Loader2, RefreshCw, Save, Sparkles, AlertTriangle, MessageSquareText, Highlighter, PenLine, ListChecks, Bot, CheckCircle2, XCircle } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Assignment, ChatSession, Submission } from "../types";
import { L2_ERROR_LABEL, wordCount, type L2Error } from "../lib/l2";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { Bar, fmtDate, riseItem, useToast } from "./ui";

interface Props {
  submission: Submission;
  assignment: Assignment;
  chatSession: ChatSession | null;
  onReevaluate: () => Promise<void>;
  onScores: (scores: Record<string, number>) => Promise<void>;
}

const EV = {
  xanh: "bg-[#e7f8ef] dark:bg-[#0e2a1f] border-emerald-400/40",
  vang: "bg-[#fff4de] dark:bg-[#33260c] border-amber-400/40",
  do: "bg-[#ffe9ec] dark:bg-[#3a1320] border-rose-400/40",
} as const;

type Tab = "prompt" | "critique" | "revision" | "errors";
const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "prompt", label: "Prompt", icon: MessageSquareText },
  { id: "critique", label: "Phản biện", icon: Highlighter },
  { id: "revision", label: "Bản sửa", icon: PenLine },
  { id: "errors", label: "Lỗi đã bắt / bỏ sót", icon: ListChecks },
];

/** Word-level diff (LCS) of two texts -> tokens flagged as kept / removed / added. */
function wordDiff(a: string, b: string) {
  const x = a.split(/(\s+)/).filter(Boolean), y = b.split(/(\s+)/).filter(Boolean);
  const X = x.slice(0, 700), Y = y.slice(0, 700);
  const dp: number[][] = Array.from({ length: X.length + 1 }, () => new Array(Y.length + 1).fill(0));
  for (let i = X.length - 1; i >= 0; i--) for (let j = Y.length - 1; j >= 0; j--) dp[i][j] = X[i] === Y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const left: { t: string; k: "same" | "del" }[] = [], right: { t: string; k: "same" | "add" }[] = [];
  let i = 0, j = 0;
  while (i < X.length && j < Y.length) {
    if (X[i] === Y[j]) { left.push({ t: X[i], k: "same" }); right.push({ t: Y[j], k: "same" }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) left.push({ t: X[i++], k: "del" });
    else right.push({ t: Y[j++], k: "add" });
  }
  while (i < X.length) left.push({ t: X[i++], k: "del" });
  while (j < Y.length) right.push({ t: Y[j++], k: "add" });
  return { left, right };
}

export const L2Review: React.FC<Props> = ({ submission, assignment, chatSession, onReevaluate, onScores }) => {
  const toast = useToast();
  const l2 = assignment.l2!;
  const work = submission.l2_work;
  const report = submission.l2_report;
  const result = submission.l2_result;
  const [tab, setTab] = useState<Tab>("prompt");
  const [reeval, setReeval] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scores, setScores] = useState<Record<string, number | "">>(() => Object.fromEntries(l2.dimensions.map((d) => [d.key, submission.l2_teacher_scores?.[d.key] ?? ""])));

  const aiScore = (key: string) => result?.dimensions.find((d) => d.key === key)?.score;
  const effective = (key: string) => (scores[key] === "" || scores[key] === undefined ? aiScore(key) : Number(scores[key])) || 0;
  const radar = l2.dimensions.map((d) => ({ subject: d.name, v: effective(d.key) }));
  const mean = l2.dimensions.reduce((s, d) => s + effective(d.key), 0) / 5;
  const dirty = l2.dimensions.some((d) => (scores[d.key] === "" ? undefined : Number(scores[d.key])) !== submission.l2_teacher_scores?.[d.key]);

  const reevaluate = async () => {
    setReeval(true);
    try { await onReevaluate(); toast.success("Đã chấm lại bằng AI."); } catch (e: any) { toast.error(e.message); } finally { setReeval(false); }
  };
  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, number> = {};
      for (const d of l2.dimensions) if (scores[d.key] !== "") payload[d.key] = Number(scores[d.key]);
      await onScores(payload); toast.success("Đã lưu điểm từng chiều.");
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const errById = useMemo(() => new Map(l2.errors.map((e) => [e.id, e])), [l2.errors]);
  const caughtById = useMemo(() => new Map((report?.caught || []).map((c) => [c.error_id, c])), [report]);
  const diff = useMemo(() => (work?.revision ? wordDiff(l2.ai_text, work.revision.text) : null), [work?.revision?.text, l2.ai_text]);
  const msgs = (phase: string) => (chatSession?.messages || []).filter((m) => m.phase === phase);

  /* AI text with both the planted errors and the student's highlights */
  const segments = useMemo(() => {
    const cuts = new Set<number>([0, l2.ai_text.length]);
    l2.errors.forEach((e) => { cuts.add(e.start); cuts.add(e.end); });
    (work?.highlights || []).forEach((h) => { cuts.add(h.start); cuts.add(h.end); });
    const pts = [...cuts].sort((a, b) => a - b);
    return pts.slice(0, -1).map((s, i) => {
      const e = pts[i + 1];
      return { s, e, err: l2.errors.find((x) => x.start <= s && x.end >= e), hl: (work?.highlights || []).find((h) => h.start <= s && h.end >= e) };
    });
  }, [l2, work?.highlights]);

  return (
    <>
      {/* 5-dimension assessment */}
      <motion.div variants={riseItem} className="card p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-bold flex items-center gap-2"><Sparkles className="w-5 h-5 text-brand" />Đánh giá 5 chiều (AI + giảng viên)</h3>
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={reevaluate} disabled={reeval}>{reeval ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}Chấm lại bằng AI</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !dirty}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Lưu điểm từng chiều</button>
          </div>
        </div>

        {!result && !submission.l2_teacher_scores ? (
          <div className="mt-4 rounded-2xl bg-surface-2 border border-dashed border-line p-6 text-center text-sm text-ink-2">
            <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto mb-2" />AI chưa chấm được bài này{submission.eval_error ? `: ${submission.eval_error}` : "."}<br />Bấm “Chấm lại bằng AI”, hoặc tự nhập điểm từng chiều bên dưới. Kết quả đối chiếu lỗi (tab bên dưới) vẫn dùng được.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-6 mt-4 items-center">
            <div className="h-64"><ResponsiveContainer width="100%" height="100%"><RadarChart outerRadius="68%" data={radar}><PolarGrid stroke="var(--line)" /><PolarAngleAxis dataKey="subject" tick={{ fill: "var(--ink-2)", fontSize: 11 }} /><PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} /><Radar dataKey="v" stroke="#5b5bf0" fill="#5b5bf0" fillOpacity={0.3} animationDuration={900} /></RadarChart></ResponsiveContainer></div>
            <div className="text-center sm:text-left"><div className="text-xs text-mute">Trung bình 5 chiều</div><div className="text-5xl font-medium gradient-text">{mean.toFixed(1)}<span className="text-lg text-mute">/5</span></div>
              {result?.overall_comment && <p className="text-sm text-ink-2 mt-2">{result.overall_comment}</p>}</div>
          </div>
        )}

        <div className="mt-5 space-y-4">
          {l2.dimensions.map((d) => {
            const r = result?.dimensions.find((x) => x.key === d.key);
            const sc = effective(d.key);
            return (
              <div key={d.key} className="rounded-2xl border border-line p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="font-semibold">{d.name}</div>
                  <div className="flex items-center gap-2 text-sm">
                    {r && <span className="chip chip-brand">AI: {r.score}/5</span>}
                    <label className="flex items-center gap-1.5 text-xs text-mute">Điểm của bạn
                      <select className="input !py-1 !px-2 !w-20 text-sm" value={scores[d.key] ?? ""} onChange={(e) => setScores({ ...scores, [d.key]: e.target.value === "" ? "" : Number(e.target.value) })} aria-label={`Điểm ${d.name}`}>
                        <option value="">—</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select></label>
                  </div>
                </div>
                <div className="mt-2"><Bar value={(sc / 5) * 100} /></div>
                {sc > 0 && <p className="text-[11px] text-mute mt-1.5">Mức {sc}: {d.levels[sc - 1]}</p>}
                {r?.comment && <p className="text-sm text-ink-2 mt-2">{r.comment}</p>}
                {r && r.evidence.length > 0 && (
                  <div className="mt-2 grid gap-2">{r.evidence.map((ev, i) => (
                    <div key={i} className={`rounded-xl border p-2.5 text-sm ${EV[ev.mau] || EV.vang}`}><p className="italic break-words">“{ev.quote}”</p><p className="text-xs text-ink-2 mt-1">{ev.ly_do}</p></div>
                  ))}</div>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* tabs */}
      <motion.div variants={riseItem} className="card p-6">
        <div className="flex gap-1 overflow-x-auto border-b border-line -mx-2 px-2 pb-0" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`px-3.5 py-2.5 text-sm font-semibold flex items-center gap-2 whitespace-nowrap border-b-2 -mb-px transition-colors ${tab === t.id ? "border-brand text-brand" : "border-transparent text-ink-2 hover:text-ink"}`}><t.icon className="w-4 h-4" />{t.label}</button>
          ))}
        </div>

        <div className="pt-5 space-y-4">
          {tab === "prompt" && (
            <>
              <div className="rounded-2xl bg-brand-soft/40 border border-brand/20 p-4"><div className="text-xs font-bold text-brand mb-1">Prompt cuối cùng đã chốt</div><p className="text-sm break-words">{work?.final_prompt || "—"}</p></div>
              <div><div className="text-xs font-bold text-mute mb-2">Các lần prompt ({work?.prompt_history?.length || 0})</div>
                <ol className="space-y-2">{(work?.prompt_history || []).map((p, i) => <li key={i} className="flex gap-3 text-sm"><span className="chip chip-gray shrink-0 h-fit">{i + 1}</span><div className="min-w-0"><p className="break-words">{p.text}</p><p className="text-[11px] text-mute">{fmtDate(p.at)}</p></div></li>)}</ol></div>
              <Transcript title="Hội thoại bước 1 (AI chỉ lập dàn ý)" messages={msgs("prompt")} student={submission.student_name} />
            </>
          )}

          {tab === "critique" && (
            <>
              <div className="flex flex-wrap gap-3 text-xs text-ink-2">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-300" />Sinh viên đánh dấu</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0 border-b-2 border-dashed border-rose-500" />Lỗi cài sẵn (đáp án)</span>
              </div>
              <div className="rounded-2xl border border-line bg-surface-2/50 p-5 whitespace-pre-wrap leading-8">
                {segments.map((sg) => {
                  const cls = [sg.hl ? "bg-amber-200/80 dark:bg-amber-500/30 rounded px-0.5" : "", sg.err ? "underline decoration-dashed decoration-rose-500 decoration-2 underline-offset-4" : ""].join(" ");
                  return <span key={sg.s} className={cls} title={sg.err ? `${L2_ERROR_LABEL[sg.err.type]}: ${sg.err.answer}` : undefined}>{l2.ai_text.slice(sg.s, sg.e)}</span>;
                })}
              </div>
              <div><div className="text-xs font-bold text-mute mb-2">Ghi chú của sinh viên ({work?.highlights.length || 0})</div>
                <ol className="space-y-2">{(work?.highlights || []).map((h, i) => <li key={h.id} className="rounded-xl border border-line p-3 text-sm"><span className="chip chip-brand mr-2">{i + 1}</span>“{h.text}”<p className="text-ink-2 mt-1">{h.note}</p></li>)}</ol></div>
              <Transcript title="Hỏi AI gợi ý (Socratic)" messages={msgs("critique")} student={submission.student_name} />
            </>
          )}

          {tab === "revision" && work && diff && (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="chip chip-gray">Giống bản gốc: {Math.round((report?.similarity_to_original ?? 0) * 100)}%</span>
                <span className="chip chip-gray">{wordCount(l2.ai_text)} → {wordCount(work.revision.text)} từ</span>
                <span className="chip chip-gray">Gõ {work.revision.stats.typed} · Xóa {work.revision.stats.deleted} · Dán {work.revision.stats.pasted} ký tự</span>
                {report?.rewritten_from_scratch && <span className="chip chip-rose"><AlertTriangle className="w-3 h-3" />Có dấu hiệu viết lại từ đầu</span>}
                {work.revision.stats.pasted > 0 && <span className="chip chip-amber">Có dán văn bản vào ô chỉnh sửa</span>}
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div><div className="text-xs font-bold text-mute mb-1.5">Bản AI gốc</div><div className="rounded-2xl border border-line p-4 text-sm leading-7 whitespace-pre-wrap">{diff.left.map((t, i) => <span key={i} className={t.k === "del" ? "bg-rose-200/70 dark:bg-rose-500/25 line-through decoration-rose-500" : ""}>{t.t}</span>)}</div></div>
                <div><div className="text-xs font-bold text-mute mb-1.5">Bản sinh viên chỉnh sửa</div><div className="rounded-2xl border border-line p-4 text-sm leading-7 whitespace-pre-wrap">{diff.right.map((t, i) => <span key={i} className={t.k === "add" ? "bg-emerald-200/70 dark:bg-emerald-500/25" : ""}>{t.t}</span>)}</div></div>
              </div>
              {report && report.timeline.length > 1 && (
                <div><div className="text-xs font-bold text-mute mb-1">Mức giống bản gốc theo thời gian (giảm dần = sửa nhiều)</div>
                  <div className="h-44"><ResponsiveContainer width="100%" height="100%"><LineChart data={report.timeline.map((p, i) => ({ n: i + 1, sim: Math.round(p.sim * 100) }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--line)" /><XAxis dataKey="n" tick={{ fontSize: 11, fill: "var(--mute)" }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--mute)" }} axisLine={false} tickLine={false} unit="%" /><Tooltip contentStyle={{ backgroundColor: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 12 }} formatter={(v: any) => [`${v}%`, "Giống bản gốc"]} labelFormatter={(n) => `Lần lưu ${n}`} /><Line type="monotone" dataKey="sim" stroke="#5b5bf0" strokeWidth={2.5} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div></div>
              )}
            </>
          )}

          {tab === "errors" && report && (
            <>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="chip chip-green">Bắt được {report.caught.length}/{report.total}</span>
                <span className="chip chip-rose">Bỏ sót {report.missed.length}</span>
                <span className="chip chip-amber">Đánh dấu nhầm {report.false_positives.length}</span>
                <span className="chip chip-gray">Recall {Math.round(report.recall * 100)}% · Precision {Math.round(report.precision * 100)}%</span>
              </div>
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-mute bg-surface-2"><th className="py-2.5 px-3 font-medium">Lỗi cài sẵn</th><th className="px-3 font-medium">Loại</th><th className="px-3 font-medium">Kết quả</th><th className="px-3 font-medium">Trong bản cuối</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {l2.errors.map((e: L2Error) => {
                    const c = caughtById.get(e.id);
                    return (
                      <tr key={e.id} className="align-top">
                        <td className="py-3 px-3 max-w-[18rem]"><p className="italic break-words">“{e.text}”</p>{e.answer && <p className="text-xs text-mute mt-1"><strong>Đáp án:</strong> {e.answer}</p>}{c?.note && <p className="text-xs text-ink-2 mt-1"><strong>Ghi chú SV:</strong> {c.note}</p>}</td>
                        <td className="px-3"><span className="chip chip-gray">{L2_ERROR_LABEL[e.type]}</span></td>
                        <td className="px-3">{c ? <span className="chip chip-green"><CheckCircle2 className="w-3 h-3" />Đã bắt</span> : <span className="chip chip-rose"><XCircle className="w-3 h-3" />Bỏ sót</span>}</td>
                        <td className="px-3">{report.remained.includes(e.id) ? <span className="chip chip-rose">Còn nguyên</span> : <span className="chip chip-green">Đã thay đổi</span>}</td>
                      </tr>
                    );
                  })}
                </tbody></table></div>
              {report.false_positives.length > 0 && (
                <div><div className="text-xs font-bold text-mute mb-2">Đánh dấu không trùng lỗi nào</div>
                  <ul className="space-y-1.5">{report.false_positives.map((id) => { const h = work?.highlights.find((x) => x.id === id); return h ? <li key={id} className="text-sm rounded-xl border border-amber-400/40 bg-[#fff4de] dark:bg-[#33260c] p-2.5">“{h.text}” <span className="text-ink-2">— {h.note}</span></li> : null; })}</ul></div>
              )}
              <p className="text-[11px] text-mute">Đối chiếu này là tự động và khách quan (không do AI phán xét): một đánh dấu tính là bắt được lỗi khi phủ ≥40% đoạn lỗi cài sẵn.</p>
            </>
          )}
          {tab === "errors" && !report && <p className="text-sm text-mute">Chưa có kết quả đối chiếu.</p>}
        </div>
      </motion.div>
    </>
  );
};

const Transcript: React.FC<{ title: string; messages: any[]; student: string }> = ({ title, messages, student }) => (
  <div>
    <div className="text-xs font-bold text-mute mb-2 flex items-center gap-1.5"><Bot className="w-3.5 h-3.5" />{title} ({messages.length} tin nhắn)</div>
    {messages.length === 0 ? <p className="text-sm text-mute">Không có hội thoại.</p> : (
      <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
        {messages.map((m) => { const mine = m.role === "user"; return (
          <div key={m.id} className={`flex ${mine ? "justify-end" : ""}`}>
            <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${mine ? "bg-brand-soft rounded-tr-md" : "bg-surface-2 border border-line rounded-tl-md"}`}>
              <div className="text-[11px] font-bold text-mute mb-1">{mine ? student : "Trợ lý AI"} · {new Date(m.timestamp).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</div>
              <MarkdownRenderer content={m.content} />
            </div>
          </div>); })}
      </div>
    )}
  </div>
);
