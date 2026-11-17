import React, { useEffect, useRef } from "react";
import { ArrowRight, Lock } from "lucide-react";

/**
 * The landing page's centrepiece: one huge twisting ribbon, the "thinking trace", that runs across a sticky stage.
 * Scrolling pulls the camera along the ribbon; the line climbs when the thinking is independent and dives when it is
 * copied or delegated. Each stop on the way is a real Trace strength, shown on a card beside its node.
 * Canvas 2D (no assets); one rAF loop that only runs while the stage is on screen.
 */
type Tone = "up" | "down" | "flat";
interface Chapter { id: string; tone: Tone; y: number; eyebrow: string; title: string; text: string; bullets: string[]; visual: React.ReactNode }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const TONE: Record<Tone, string> = { up: "#34d399", flat: "#a78bfa", down: "#f43f5e" };
const STOPS: [number, [number, number, number]][] = [[0, [79, 140, 255]], [0.38, [124, 77, 255]], [0.72, [236, 72, 153]], [1, [52, 211, 153]]];
const colorAt = (f: number): [number, number, number] => {
  const x = clamp(f, 0, 1);
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [a, ca] = STOPS[i], [b, cb] = STOPS[i + 1];
    if (x <= b) { const t = (x - a) / (b - a); return [ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t]; }
  }
  return STOPS[STOPS.length - 1][1];
};

const Line: React.FC<{ w: string }> = ({ w }) => <div className={`h-2 rounded-full bg-white/15 ${w}`} />;
const V = {
  intent: <div className="space-y-2"><Line w="w-5/6" /><Line w="w-3/5" /><div className="flex items-center gap-1.5 pt-1">{[1, 2, 3, 4, 5].map((n) => <span key={n} className={`h-6 w-6 rounded-md text-[10px] flex items-center justify-center ${n === 4 ? "bg-[#7c4dff] text-white" : "bg-white/10 text-white/55"}`}>{n}</span>)}<span className="text-[10px] text-white/50 ml-1">mức tự tin</span></div></div>,
  paste: <div className="flex items-center gap-3"><span className="h-5 w-5 rotate-45 rounded-[3px] bg-[#f43f5e]" /><div><div className="text-[11px] text-white/80">Dán 412 ký tự</div><div className="text-[10px] text-white/45">lượt 3 · đường đi xuống</div></div></div>,
  blur: <div className="space-y-1.5"><Line w="w-full" /><Line w="w-11/12" /><Line w="w-4/5" /><div className="space-y-1.5 blur-[3px] opacity-70 pt-1"><Line w="w-full" /><Line w="w-5/6" /><Line w="w-2/3" /></div><span className="inline-block mt-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] text-white/80">Nói ý của em để đọc tiếp</span></div>,
  chat: <div className="space-y-1.5 text-[10.5px]"><div className="ml-auto w-fit max-w-[85%] rounded-xl rounded-tr-sm bg-[#7c4dff]/40 px-2.5 py-1.5 text-white/90">Em nghĩ AI đang ngầm định…</div><div className="w-fit max-w-[85%] rounded-xl rounded-tl-sm bg-white/10 px-2.5 py-1.5 text-white/75">Giả định đó dựa trên dữ liệu nào?</div></div>,
  bars: <div className="space-y-1.5">{[["Phản biện", 82, "#4f8cff"], ["Đào sâu", 70, "#7c4dff"], ["Kiểm chứng", 64, "#f59e0b"], ["Nội hóa", 75, "#34d399"], ["Chủ động", 79, "#ec4899"]].map(([l, v, c]) => <div key={l as string} className="flex items-center gap-2 text-[10px] text-white/60"><span className="w-14 shrink-0">{l}</span><div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${v}%`, background: c as string }} /></div></div>)}</div>,
  l2: <div className="flex items-center gap-1.5 text-[10.5px]">{["1 Prompt", "2 Phản biện", "3 Chỉnh sửa"].map((s, i) => <React.Fragment key={s}>{i > 0 && <span className="text-white/30">→</span>}<span className="rounded-full bg-white/10 px-2.5 py-1 text-white/80">{s}</span></React.Fragment>)}</div>,
  heat: <div className="grid grid-cols-4 gap-1">{[0, 1, 3, 2, 1, 3, 4, 2, 1, 2, 2, 0].map((c, i) => <span key={i} className="h-5 rounded-md" style={{ background: c ? `rgba(${i < 4 ? "52,211,153" : i < 8 ? "124,77,255" : "236,72,153"},${0.15 + c * 0.17})` : "rgba(255,255,255,0.06)" }} />)}</div>,
  lock: <div className="space-y-1.5 text-[10.5px]">{[["Sinh viên", "dấu vết của mình", true], ["Giảng viên", "bài và chat của lớp mình", true], ["Quản trị viên", "không đọc được chat", false]].map(([r, d, ok]) => <div key={r as string} className="flex items-center justify-between gap-2"><span className="text-white/80">{r}</span><span className={`flex items-center gap-1 ${ok ? "text-white/50" : "text-[#fda4af]"}`}>{!ok && <Lock className="h-3 w-3" />}{d}</span></div>)}</div>,
};

const CHAPTERS: Chapter[] = [
  { id: "nghi-truoc", tone: "up", y: 0.3, eyebrow: "01 · Nghĩ trước, hỏi sau", title: "Sinh viên ghi ý của mình trước khi hỏi AI.", text: "Luận điểm và mức tự tin được ghi lại trước mỗi câu hỏi. Ý riêng đã nằm trong nhật ký, nên không cần đoán ai nghĩ ra nó.", bullets: ["3 mức: không có, nhắc nhẹ, bắt buộc", "Máy chủ khóa khung chat tới khi sinh viên ghi ý", "AI nâng cấp chính ý của em, không viết thay"], visual: V.intent },
  { id: "dan", tone: "down", y: 0.74, eyebrow: "02 · Cám dỗ dán và nhờ làm hộ", title: "Trace không đoán. Trace ghi lại.", text: "Mỗi lần dán nhiều chữ hay xin đáp án là một điểm đi xuống trên đường tư duy. Giảng viên đọc được từng lượt thay vì tin vào một con số.", bullets: ["Đếm lượng chữ dán theo từng tin nhắn", "Chỉ báo hành vi ẩn danh cho cả lớp", "Không gắn nhãn \"lười\" lên một cá nhân"], visual: V.paste },
  { id: "che-mo", tone: "up", y: 0.36, eyebrow: "03 · Che mờ, mở bằng ý của mình", title: "AI hé lộ vài dòng đầu. Phần còn lại chờ ý của em.", text: "AI soạn đáp án đầy đủ nhưng chỉ cho xem 3-4 dòng. Sinh viên nói ý của mình, AI viết lại theo ý đó, vẫn đúng kiến thức, kèm các hướng khác.", bullets: ["Phần bị che nằm ở máy chủ, không gửi về trình duyệt", "Cho phép xem luôn (có ghi nhận) hoặc bắt buộc", "Giảng viên xem được bản nháp gốc và ý của sinh viên"], visual: V.blur },
  { id: "phan-bien", tone: "up", y: 0.2, eyebrow: "04 · Phản biện cùng AI", title: "Trợ lý Socratic hỏi ngược, không đưa đáp án ngay.", text: "Phải trao đổi ít nhất 3 lượt mới nộp được. Mỗi lượt là một điểm trên dấu vết, tô màu theo bằng chứng: xanh độc lập, vàng tò mò, đỏ nhờ làm hộ.", bullets: ["Nhật ký trao đổi được lưu đầy đủ", "Giới hạn tốc độ để chống lạm dụng", "Giảng viên chọn Socratic hoặc trợ lý thường theo bài"], visual: V.chat },
  { id: "diem", tone: "up", y: 0.3, eyebrow: "05 · Điểm tư duy có bằng chứng", title: "5 tiêu chí, mỗi điểm đi kèm trích đoạn.", text: "Phản biện, đào sâu, kiểm chứng, nội hóa, chủ động. Nếu AI lỗi thì không có điểm giả: bài vẫn nộp, giảng viên chấm lại. Điểm chính thức luôn do giảng viên.", bullets: ["Trích nguyên văn từ chính lời sinh viên", "Chấm lại bằng AI khi cần", "Điểm AI chỉ là gợi ý tham khảo"], visual: V.bars },
  { id: "l2", tone: "flat", y: 0.62, eyebrow: "06 · Viết L2", title: "Viết prompt, bắt lỗi cài sẵn, rồi chỉnh sửa.", text: "Ba bước tuần tự do máy chủ kiểm tra. Lỗi được đối chiếu tự động, không phải AI phán xét. Chấm theo 5 chiều.", bullets: ["Đáp án lỗi không gửi về sinh viên", "Lỗi bỏ sót chỉ hiện sau hạn nộp", "Giảng viên chỉnh được điểm từng chiều"], visual: V.l2 },
  { id: "lop", tone: "up", y: 0.28, eyebrow: "07 · Cả lớp trong một cái nhìn", title: "Thấy lớp đang nghĩ sâu hay đang dựa vào AI.", text: "Bản đồ nhiệt số lượt × điểm tư duy, gợi ý sư phạm từ số liệu thật, chỉ báo hành vi. Chỉ hiện khi có từ 5 sinh viên để không lộ từng em.", bullets: ["Tổng hợp ẩn danh, không hiện tên", "Gợi ý ra đề từ điểm trung bình từng bài", "Xuất bảng điểm CSV và Google Sheets"], visual: V.heat },
  { id: "rieng-tu", tone: "flat", y: 0.4, eyebrow: "08 · Công bằng và riêng tư", title: "Giảng viên quyết định. Quản trị viên không đọc chat.", text: "AI chỉ đưa bằng chứng. Quyền được kiểm tra ở máy chủ, không chỉ ẩn nút trên giao diện.", bullets: ["Quản trị viên không đọc được bài nộp và chat", "Khóa tài khoản có hiệu lực ngay", "Nhật ký thao tác quản trị minh bạch"], visual: V.lock },
];

interface Props { onStart: () => void; onMethods: () => void }

export const TraceJourney: React.FC<Props> = ({ onStart, onMethods }) => {
  const wrap = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const hero = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const hud = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const orbLabel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cv = canvas.current!, ctx = cv.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const n = CHAPTERS.length;
    let vw = 0, vh = 0, dpr = 1, spacing = 1000, marker = 400, small = false;
    let nodes: { x: number; y: number }[] = [];
    let raf = 0, visible = true, ps = 0, lastLabel = "", lastHud = -1;

    const layout = () => {
      const r = cv.getBoundingClientRect();
      vw = Math.max(1, r.width); vh = Math.max(1, r.height); dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      small = vw < 700;
      spacing = small ? vw * 1.1 : clamp(vw * 0.92, 800, 1500);
      marker = small ? vw * 0.5 : vw * 0.36;
      nodes = [{ x: 0, y: vh * 0.6 }, ...CHAPTERS.map((c, i) => ({ x: (i + 1) * spacing, y: vh * c.y })), { x: (n + 1) * spacing, y: vh * 0.42 }];
      CHAPTERS.forEach((c, i) => {
        const el = cards.current[i]; if (!el) return;
        const up = c.y < 0.5;
        el.style.top = `${nodes[i + 1].y + (up ? 56 : -56)}px`;
        (el.firstElementChild as HTMLElement).style.transform = up ? "translate(-50%,0)" : "translate(-50%,-100%)";
      });
    };

    // smooth curve through the nodes (cubic Hermite, Catmull-Rom tangents)
    const curve = (x: number) => {
      let i = 0; while (i < nodes.length - 2 && x > nodes[i + 1].x) i++;
      const p0 = nodes[Math.max(0, i - 1)], p1 = nodes[i], p2 = nodes[i + 1], p3 = nodes[Math.min(nodes.length - 1, i + 2)];
      const h = p2.x - p1.x, t = clamp((x - p1.x) / h, 0, 1);
      const m1 = ((p2.y - p0.y) / (p2.x - p0.x)) * h, m2 = ((p3.y - p1.y) / (p3.x - p1.x)) * h;
      const t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * p1.y + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2.y + (t3 - t2) * m2;
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      const rect = wrap.current!.getBoundingClientRect();
      const p = clamp(-rect.top / Math.max(1, rect.height - vh), 0, 1);
      ps = reduced.matches ? p : ps + (p - ps) * 0.13;
      const xLast = nodes[nodes.length - 1].x;
      const camX = ps * (xLast - marker - spacing * 0.9);
      const phase = reduced.matches ? 0 : now / 1300;
      const markerX = camX + marker;

      ctx.clearRect(0, 0, vw, vh);
      // faint reading guides
      ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1; ctx.setLineDash([3, 8]);
      for (const f of [0.2, 0.5, 0.8]) { ctx.beginPath(); ctx.moveTo(0, vh * f); ctx.lineTo(vw, vh * f); ctx.stroke(); }
      ctx.setLineDash([]);

      const BASE = clamp(vh * 0.075, 34, 70), STEP = 4;
      const x0 = camX - 40, x1 = camX + vw + 40;
      // soft glow behind the part of the ribbon already travelled
      ctx.globalCompositeOperation = "lighter";
      for (const [lw, al] of [[88, 0.05], [46, 0.08]] as const) {
        ctx.beginPath(); let started = false;
        for (let x = x0; x <= Math.min(x1, markerX); x += 12) { const y = curve(x); if (!started) { ctx.moveTo(x - camX, y); started = true; } else ctx.lineTo(x - camX, y); }
        ctx.strokeStyle = `rgba(124,77,255,${al})`; ctx.lineWidth = lw; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";

      // the ribbon: a strip whose width follows a twist angle, front face bright, back face dark
      let pa: [number, number] | null = null, pb: [number, number] | null = null;
      const edgeA: [number, number][] = [], edgeB: [number, number][] = [];
      for (let x = x0; x <= x1; x += STEP) {
        const y = curve(x), y2 = curve(x + STEP), len = Math.hypot(STEP, y2 - y) || 1;
        const nx = -(y2 - y) / len, ny = STEP / len;
        const c = Math.cos(x / 125 + phase), a = Math.abs(c), hw = BASE * (0.12 + 0.88 * a);
        const A: [number, number] = [x - camX + nx * hw, y + ny * hw], B: [number, number] = [x - camX - nx * hw, y - ny * hw];
        if (pa && pb) {
          const [r, g, b] = colorAt(x / xLast), front = c > 0, k = front ? 0.62 + 0.38 * Math.sqrt(a) : 0.3 + 0.28 * a;
          const done = x <= markerX, al = done ? 1 : 0.6;
          // soft contact shadow underneath, for depth
          ctx.fillStyle = "rgba(0,0,10,0.2)";
          ctx.beginPath(); ctx.moveTo(pa[0], pa[1] + 26); ctx.lineTo(A[0], A[1] + 26); ctx.lineTo(B[0], B[1] + 26); ctx.lineTo(pb[0], pb[1] + 26); ctx.closePath(); ctx.fill();
          ctx.fillStyle = `rgba(${(r * k) | 0},${(g * k) | 0},${(b * k) | 0},${al})`;
          ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.lineTo(pb[0], pb[1]); ctx.closePath(); ctx.fill();
          if (front) { // bright sheen along the middle of the front face
            const mx0 = (pa[0] + pb[0]) / 2, my0 = (pa[1] + pb[1]) / 2, mx1 = (A[0] + B[0]) / 2, my1 = (A[1] + B[1]) / 2;
            ctx.strokeStyle = `rgba(255,255,255,${0.22 * a * al})`; ctx.lineWidth = Math.max(1, hw * 0.35);
            ctx.beginPath(); ctx.moveTo(mx0, my0); ctx.lineTo(mx1, my1); ctx.stroke();
          }
          if (front && a > 0.55 && done) { edgeA.push(A); edgeB.push(B); }
        }
        pa = A; pb = B;
      }
      // glossy edge light on the front-facing parts
      ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1.2;
      for (const e of [edgeA, edgeB]) { ctx.beginPath(); e.forEach((pt, i) => (i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1]))); ctx.stroke(); }

      // light motes drifting along the ribbon
      if (!reduced.matches) {
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < 70; i++) {
          const wx = camX - 80 + ((i * 197 + now * (0.03 + (i % 5) * 0.012)) % (vw + 160)), wy = curve(wx) + Math.sin(i * 12.9898 + now / 900) * BASE * 0.9;
          const [r, g, b] = colorAt(wx / xLast);
          ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${0.35 + 0.35 * ((i % 3) / 2)})`;
          ctx.beginPath(); ctx.arc(wx - camX, wy, 1.4 + (i % 4) * 0.5, 0, 6.283); ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
      }
      // chapter nodes
      let active = -1, best = Infinity;
      nodes.forEach((nd, i) => {
        if (i === 0 || i > n) return;
        const sx = nd.x - camX; if (sx < -60 || sx > vw + 60) return;
        const d = Math.abs(sx - marker), near = 1 - smooth(0, spacing * 0.35, d), col = TONE[CHAPTERS[i - 1].tone];
        if (d < best) { best = d; active = i - 1; }
        ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.setLineDash([2, 6]); ctx.beginPath(); ctx.moveTo(sx, nd.y); ctx.lineTo(sx, CHAPTERS[i - 1].y < 0.5 ? vh : 0); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = col; ctx.globalAlpha = 0.25 + 0.2 * near; ctx.beginPath(); ctx.arc(sx, nd.y, 20 + 14 * near, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = col; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, nd.y, 8 + 4 * near, 0, 6.283); ctx.fill(); ctx.stroke();
      });

      // the orb that rides the line: its height is the "thinking level" at this point of the story
      const oy = curve(markerX);
      const grad = ctx.createRadialGradient(marker, oy, 0, marker, oy, 44);
      grad.addColorStop(0, "rgba(255,255,255,0.95)"); grad.addColorStop(0.25, "rgba(196,181,253,0.55)"); grad.addColorStop(1, "rgba(124,77,255,0)");
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(marker, oy, 44, 0, 6.283); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(marker, oy, 8, 0, 6.283); ctx.fill();
      const lvl = oy / vh, label = lvl < 0.42 ? "Tư duy độc lập" : lvl > 0.56 ? "Nhờ làm hộ, dán" : "Đang suy nghĩ", lcol = lvl < 0.42 ? TONE.up : lvl > 0.56 ? TONE.down : TONE.flat;
      const ol = orbLabel.current; if (ol) {
        ol.style.transform = `translate3d(${marker + 22}px,${oy - 38}px,0)`;
        if (label !== lastLabel) { lastLabel = label; ol.textContent = label; ol.style.color = lcol; ol.style.borderColor = lcol + "88"; }
      }

      // cards ride along with their nodes and fade in around the marker
      CHAPTERS.forEach((_, i) => {
        const el = cards.current[i]; if (!el) return;
        const sx = nodes[i + 1].x - camX, d = Math.abs(sx - marker), v = 1 - smooth(spacing * 0.1, spacing * 0.36, d);
        el.style.transform = `translate3d(${small ? marker : sx}px,0,0)`;   // on phones the card stays centred and just fades
        (el.firstElementChild as HTMLElement).style.opacity = String(v);
        el.style.visibility = v < 0.01 ? "hidden" : "visible";
      });
      if (hero.current) { const o = 1 - smooth(0, 0.045, ps); hero.current.style.opacity = String(o); hero.current.style.pointerEvents = o < 0.2 ? "none" : "auto"; }
      if (bar.current) bar.current.style.width = `${ps * 100}%`;
      if (hud.current && active !== lastHud) { lastHud = active; hud.current.textContent = ps < 0.02 ? "" : active >= 0 ? `${String(active + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}` : ""; }
    };

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 });
    const ro = new ResizeObserver(layout);
    io.observe(wrap.current!); ro.observe(cv);
    layout(); raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); };
  }, []);

  return (
    <section ref={wrap} className="relative bg-[#060914] text-white" style={{ height: `${100 + CHAPTERS.length * 95}svh`, fontFamily: "Inter, 'Be Vietnam Pro', system-ui, sans-serif" }} aria-label="Hành trình tư duy của Trace">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <div className="absolute -top-40 -left-32 w-[42rem] h-[42rem] rounded-full bg-[#0b57d0] opacity-[0.22] blur-[130px]" />
        <div className="absolute top-1/4 -right-40 w-[38rem] h-[38rem] rounded-full bg-[#7c4dff] opacity-[0.2] blur-[130px]" />
        <div className="absolute -bottom-52 left-1/4 w-[40rem] h-[28rem] rounded-full bg-[#ec4899] opacity-[0.13] blur-[130px]" />
        <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-hidden="true" />

        <div className="absolute right-4 md:right-8 top-[9%] text-[10px] tracking-[0.16em] uppercase text-white/35 pointer-events-none">Tư duy sâu ↑</div>
        <div className="absolute right-4 md:right-8 bottom-[11%] text-[10px] tracking-[0.16em] uppercase text-white/35 pointer-events-none">Nhờ làm hộ ↓</div>
        <div ref={orbLabel} className="absolute left-0 top-0 rounded-full border px-3 py-1 text-[11px] font-medium bg-[#0b0f1c]/70 backdrop-blur pointer-events-none whitespace-nowrap will-change-transform" />

        {/* hero copy: fades out as the line starts to move */}
        <div ref={hero} className="absolute inset-0 z-10 flex flex-col justify-end px-5 pb-14 md:pb-16 sm:px-8 md:px-16 lg:px-20 pt-28 pointer-events-auto">
          <div className="max-w-3xl">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0b0f1c]/60 backdrop-blur px-3.5 py-1.5 text-[12px] text-white/75"><span className="h-1.5 w-1.5 rounded-full bg-[#34d399]" />Nền tảng đánh giá quá trình tư duy với AI</span>
            <h1 className="font-semibold tracking-[-0.045em] leading-[0.95] text-[clamp(3rem,9vw,8.6rem)]">Less <span className="relative inline-block text-white/40">paste<span className="absolute left-[-2%] right-[-2%] top-[56%] h-[0.07em] rounded-full bg-[#f43f5e]" /></span>,<br />more <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(90deg,#4f8cff,#7c4dff,#ec4899)" }}>Trace.</span></h1>
            <p className="mt-5 max-w-xl text-[15px] md:text-[17px] leading-relaxed text-white/70">Mỗi câu hỏi, mỗi lần phản biện, mỗi lần dán đều là một điểm trên đường tư duy. Trace vẽ ra đường đó cho giảng viên đọc, và cho sinh viên thấy mình đang đi lên hay đi xuống.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button onClick={onStart} className="rounded-full px-6 py-3 text-[14px] font-semibold text-white inline-flex items-center gap-2 transition-[filter] hover:brightness-110" style={{ background: "linear-gradient(90deg,#4f8cff,#7c4dff,#ec4899)" }}>Bắt đầu với Trace <ArrowRight className="h-4 w-4" /></button>
              <button onClick={onMethods} className="rounded-full border border-white/15 bg-[#0b0f1c]/60 backdrop-blur px-6 py-3 text-[14px] font-medium text-white/90 hover:bg-white/10 transition-colors">Xem phương pháp</button>
            </div>
          </div>
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-1.5 text-[11px] text-white/45">Cuộn để đi theo dấu vết<span className="h-6 w-px bg-gradient-to-b from-white/50 to-transparent" /></div>
        </div>

        {/* chapter cards */}
        {CHAPTERS.map((c, i) => (
          <div key={c.id} ref={(el) => { cards.current[i] = el; }} className="absolute left-0 z-10 pointer-events-none invisible will-change-transform">
            <div className="w-[min(420px,calc(100vw-2rem))] rounded-3xl border border-white/12 bg-[#0b0f1c]/78 backdrop-blur-xl p-5 sm:p-6 shadow-[0_20px_60px_-20px_rgba(124,77,255,0.5)]">
              <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide" style={{ color: TONE[c.tone] }}><span className="h-2 w-2 rounded-full" style={{ background: TONE[c.tone] }} />{c.eyebrow}</div>
              <h2 className="mt-2 text-[20px] sm:text-[24px] font-medium leading-[1.15] tracking-[-0.02em]">{c.title}</h2>
              <p className="mt-2 text-[12.5px] sm:text-[13.5px] leading-relaxed text-white/65">{c.text}</p>
              <div className="mt-3 hidden sm:block rounded-2xl bg-white/[0.04] border border-white/8 p-3">{c.visual}</div>
              <ul className="mt-3 space-y-1.5">{c.bullets.map((b) => <li key={b} className="flex gap-2 text-[11.5px] sm:text-[12px] text-white/70"><span className="mt-1.5 h-1 w-1 rounded-full shrink-0" style={{ background: TONE[c.tone] }} />{b}</li>)}</ul>
            </div>
          </div>
        ))}

        <div ref={hud} className="absolute left-5 md:left-16 top-24 text-[11px] tabular-nums tracking-[0.2em] text-white/45 pointer-events-none" />
        <div className="absolute left-0 right-0 bottom-0 h-[3px] bg-white/10"><div ref={bar} className="h-full" style={{ width: 0, background: "linear-gradient(90deg,#4f8cff,#7c4dff,#ec4899)" }} /></div>
      </div>
    </section>
  );
};
