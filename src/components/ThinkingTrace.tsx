import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { ChatMessage, HighlightSegment } from "../types";

/**
 * "Dấu vết tư duy": one node per student turn, joined by a line that rises when the turn shows
 * independent thinking and falls when it was copied or delegated. Everything is derived from data
 * we already have (the chat log + the AI's highlighted excerpts), so it costs no extra AI call.
 */

type Mau = "xanh" | "vang" | "do";
interface Step {
  idx: number;
  text: string;
  mau: Mau | null;
  intent: boolean;
  paste: boolean;
  pastedChars: number;
  len: number;
  reason?: string;
}

const COLOR: Record<Mau, string> = { xanh: "#10b981", vang: "#f59e0b", do: "#f43f5e" };
const LABEL: Record<Mau, string> = { xanh: "Tư duy độc lập, phản biện", vang: "Tò mò, cần làm rõ", do: "Nhờ AI làm hộ hoặc sao chép" };
const PASTE_HEAVY = 200;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export function buildSteps(messages: ChatMessage[], highlights: HighlightSegment[] = []): Step[] {
  const hl = highlights.map((h) => ({ ...h, n: norm(h.doan_van_ban) })).filter((h) => h.n.length >= 6);
  const out: Step[] = [];
  for (const m of messages) {
    if (m.role !== "user") continue;
    const n = norm(m.content);
    // A highlight belongs to a turn when the quoted excerpt appears in it (or the turn is contained in the excerpt)
    const hit = hl.find((h) => n.includes(h.n) || (n.length >= 12 && h.n.includes(n)));
    const pastedChars = m.pasted_chars || 0;
    out.push({
      idx: out.length + 1,
      text: m.content,
      mau: hit ? (hit.mau as Mau) : null,
      intent: m.kind === "intent",
      paste: pastedChars >= PASTE_HEAVY || (pastedChars > 0 && pastedChars / Math.max(1, m.content.length) >= 0.6),
      pastedChars,
      len: m.content.length,
      reason: hit?.ly_do,
    });
  }
  return out;
}

const yOf = (s: Step, live = false, plain = false) => live ? 34 : plain ? 80 : (s.mau === "xanh" ? 34 : s.mau === "do" ? 126 : 80);

export const ThinkingTrace: React.FC<{ messages: ChatMessage[]; highlights?: HighlightSegment[]; studentLabel?: string; live?: boolean }> = ({ messages, highlights, studentLabel = "bạn", live = false }) => {
  const steps = useMemo(() => buildSteps(messages, highlights), [messages, highlights]);
  // No AI judgement yet (live view, or the AI could not score): show neutral brand-coloured nodes, no good/bad axis
  const plain = live || !steps.some((s) => s.mau);
  const [active, setActive] = useState<number | null>(null);
  if (steps.length === 0) return null;

  const gap = 74, padX = 44, W = Math.max(560, padX * 2 + (steps.length - 1) * gap), H = live ? 80 : 160;
  const pts = steps.map((s, i) => ({ x: padX + i * gap, y: yOf(s, live, plain) + (plain && i % 2 ? (live ? 12 : 22) : 0), s }));
  const d = pts.map((p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const q = pts[i - 1], cx = (q.x + p.x) / 2;
    return `C ${cx} ${q.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
  }).join(" ");
  const counts = { xanh: steps.filter((s) => s.mau === "xanh").length, do: steps.filter((s) => s.mau === "do").length };
  const own = steps.filter((s) => s.intent).length;
  const pastes = steps.filter((s) => s.paste).length;
  const cur = active != null ? steps[active] : null;

  return (
    <div data-testid="thinking-trace">
      {!live && <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
        <span className="chip chip-gray">{steps.length} lượt của {studentLabel}</span>
        {own > 0 && <span className="chip chip-brand">Có ghi ý riêng trước khi hỏi AI</span>}
        {counts.xanh > 0 && <span className="chip chip-green">{counts.xanh} lượt tư duy độc lập</span>}
        {counts.do > 0 && <span className="chip chip-rose">{counts.do} lượt nhờ làm hộ / sao chép</span>}
        {pastes > 0 && <span className="chip chip-amber">{pastes} lần dán nhiều chữ</span>}
      </div>}

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface-2/60">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block min-w-full" role="img" aria-label="Dấu vết tư duy theo từng lượt">
          <defs>
            <linearGradient id="tt-line" x1="0" x2="1"><stop offset="0" stopColor="#5b5bf0" /><stop offset="1" stopColor="#8b5cf6" /></linearGradient>
          </defs>
          {(plain ? [] : [34, 80, 126]).map((y) => <line key={y} x1={12} x2={W - 12} y1={y} y2={y} stroke="var(--line)" strokeDasharray="3 6" />)}
          {!plain && <text x={12} y={16} fontSize="10" fill="var(--mute)">Tư duy sâu</text>}
          {!plain && <text x={12} y={H - 6} fontSize="10" fill="var(--mute)">Nhờ làm hộ / sao chép</text>}
          <motion.path d={d} fill="none" stroke="url(#tt-line)" strokeWidth={3} strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0.4 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 1.1, ease: "easeInOut" }} />
          {pts.map((p, i) => {
            const r = 6 + Math.min(6, p.s.len / 220);
            const fill = plain ? "#5b5bf0" : p.s.mau ? COLOR[p.s.mau] : "var(--mute)";
            return (
              <motion.g key={i} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.25 + i * 0.08, type: "spring", stiffness: 320, damping: 18 }}
                style={{ transformOrigin: `${p.x}px ${p.y}px`, cursor: "pointer" }} tabIndex={0} role="button" aria-label={`Lượt ${p.s.idx}`}
                onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onMouseLeave={() => setActive(null)} onBlur={() => setActive(null)}>
                <rect x={p.x - gap / 2} y={0} width={gap} height={H} fill="transparent" />
                {p.s.intent && <circle cx={p.x} cy={p.y} r={r + 6} fill="none" stroke="#5b5bf0" strokeWidth={2} strokeDasharray="3 3" />}
                {p.s.paste ? <rect x={p.x - r} y={p.y - r} width={r * 2} height={r * 2} rx={3} transform={`rotate(45 ${p.x} ${p.y})`} fill={fill} stroke="var(--surface)" strokeWidth={2} />
                  : <circle cx={p.x} cy={p.y} r={r} fill={fill} stroke="var(--surface)" strokeWidth={2} opacity={plain || p.s.mau ? 1 : 0.55} />}
                <text x={p.x} y={live ? H - 6 : H - 22} textAnchor="middle" fontSize="10" fill={active === i ? "var(--ink)" : "var(--mute)"}>{p.s.idx}</text>
              </motion.g>
            );
          })}
        </svg>
      </div>

      {!live && <div className="mt-3 min-h-[4.5rem] rounded-2xl border border-line p-3 text-sm" aria-live="polite">
        {cur ? (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold mb-1">
              <span>Lượt {cur.idx}</span>
              {cur.intent && <span className="text-brand">Ý riêng trước khi hỏi AI</span>}
              {cur.mau && <span style={{ color: COLOR[cur.mau] }}>{LABEL[cur.mau]}</span>}
              {cur.paste && <span className="text-amber-600">Dán {cur.pastedChars} ký tự</span>}
            </div>
            <p className="text-ink-2 line-clamp-3 break-words">{cur.text.replace(/\*\*/g, "")}</p>
            {cur.reason && <p className="text-xs text-mute mt-1">Lý do (AI): {cur.reason}</p>}
          </>
        ) : <p className="text-xs text-mute">Rê chuột hoặc chạm vào một điểm để xem nội dung lượt đó.</p>}
      </div>}

      {!live && <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-mute">
        {!plain && (Object.keys(COLOR) as Mau[]).map((k) => <span key={k} className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: COLOR[k] }} />{LABEL[k]}</span>)}
        {!plain && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[var(--mute)] opacity-60" />Chưa có nhận định</span>}
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rotate-45 bg-[var(--mute)]" />Dán nhiều chữ</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full border border-dashed border-brand" />Ý riêng ghi trước</span>
      </div>}
      {!live && <p className="text-[11px] text-mute mt-2">{plain ? "Chưa có nhận định của AI cho các lượt này, nên chưa tô màu. Dấu vết vẫn ghi lại thứ tự, ý riêng ghi trước và các lần dán." : "Màu lấy từ nhận định của AI trên các đoạn được trích; chỉ mang tính tham khảo, giảng viên là người quyết định."}</p>}
    </div>
  );
};
