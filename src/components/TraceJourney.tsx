import React, { useEffect, useRef } from "react";
import { ArrowRight, Lock } from "lucide-react";

/**
 * The landing page's centrepiece: one huge twisting ribbon, the "thinking trace", that runs across a sticky stage.
 * Scrolling pulls the camera along the ribbon; the line climbs when the thinking is independent and dives when it is
 * copied or delegated. Each stop on the way is a real Trace strength, shown on a card beside its node.
 * Canvas 2D (no assets); one rAF loop that only runs while the stage is on screen.
 */
interface Chapter { id: string; color: string; y: number; eyebrow: string; name: string; en: string; status: string[]; desc: string; core: string }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const UP = "#34d399", DOWN = "#f43f5e", MID = "#a78bfa";
const STOPS: [number, [number, number, number]][] = [[0, [79, 140, 255]], [0.38, [124, 77, 255]], [0.72, [236, 72, 153]], [1, [52, 211, 153]]];
const colorAt = (f: number): [number, number, number] => {
  const x = clamp(f, 0, 1);
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [a, ca] = STOPS[i], [b, cb] = STOPS[i + 1];
    if (x <= b) { const t = (x - a) / (b - a); return [ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t]; }
  }
  return STOPS[STOPS.length - 1][1];
};

const CHAPTERS: Chapter[] = [
  { id: "lang-kinh", color: "#4f8cff", y: 0.34, eyebrow: "01 · Mô-đun Đầu vào", name: "Lăng kính Đối lập", en: "Counter-Perspective Lens", status: ["Sắp có"], desc: "Không chỉ tra cứu. Chủ động bóc tách thiên kiến và đối chiếu góc nhìn từ các nghiên cứu học thuật ngay trên trang web bạn đang đọc.", core: "Đập tan buồng âm vang (echo chamber) ngay từ bước thu thập tài liệu." },
  { id: "ma-sat", color: "#7c4dff", y: 0.47, eyebrow: "02 · Mô-đun Khởi tạo", name: "Ma sát Nhận thức", en: "Cognitive Friction", status: ["Đã có"], desc: "Không để đáp án đến quá dễ. AI bị làm mờ 70% và chỉ mở khóa khi người học tự định hình được khung lập luận sơ bộ của riêng mình.", core: "Giàn giáo nhận thức (Scaffolding): lực cản có chủ đích để không thể copy-paste một cách vô thức." },
  { id: "socratic", color: "#ec4899", y: 0.26, eyebrow: "03 · Mô-đun Thử thách", name: "Kiểm định Socratic", en: "Socratic Validation", status: ["Đã có", "Cổng 3 câu hỏi: sắp có"], desc: "AI không giải sẵn đáp án. AI đóng vai người chất vấn, liên tục đặt câu hỏi để đo độ sâu trong tư duy của người học.", core: "Biến AI từ \"người làm thuê\" thành \"người rèn luyện tư duy\" (Sparring Partner), giúp người học nhận ra giới hạn của chính mình." },
  { id: "kiem-toan", color: "#f59e0b", y: 0.46, eyebrow: "04 · Mô-đun X-Quang", name: "Kiểm toán Lập luận", en: "Argument Auditing", status: ["Sắp có"], desc: "Truy vết nguồn dẫn, vẽ bản đồ logic, phát hiện lập luận đứt gãy và tài liệu \"ma\" do AI bịa ra.", core: "Chống \"Academic Slop\": văn mượt nhưng rỗng tuếch và sai sự thật." },
  { id: "ho-so", color: "#34d399", y: 0.22, eyebrow: "05 · Mô-đun Đầu ra", name: "Hồ sơ Minh bạch", en: "Transparency Portfolio", status: ["Đã có"], desc: "Vượt ra khỏi điểm số khô khan. Đánh giá năng lực qua 5 chiều tư duy và độ minh bạch trong quá trình dùng AI.", core: "Trả lại giá trị cho sự trung thực học thuật: người đọc thấy năng lực thực tế, không phải sản phẩm của máy móc." },
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
      nodes = [{ x: 0, y: vh * 0.68 }, ...CHAPTERS.map((c, i) => ({ x: (i + 1) * spacing, y: vh * c.y })), { x: (n + 1) * spacing, y: vh * 0.3 }];
      CHAPTERS.forEach((c, i) => {
        const el = cards.current[i]; if (!el) return;
        const up = true;   // cards always sit under their node, clear of the top navigation
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
        const d = Math.abs(sx - marker), near = 1 - smooth(0, spacing * 0.35, d), col = CHAPTERS[i - 1].color;
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
      const lvl = oy / vh, label = lvl < 0.42 ? "Tư duy độc lập" : lvl > 0.56 ? "Nhờ làm hộ, dán" : "Đang suy nghĩ", lcol = lvl < 0.42 ? UP : lvl > 0.56 ? DOWN : MID;
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
    <section ref={wrap} className="relative bg-[#060914] text-white" style={{ height: `${100 + CHAPTERS.length * 100}svh`, fontFamily: "Inter, 'Be Vietnam Pro', system-ui, sans-serif" }} aria-label="Hành trình tư duy của Trace">
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
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0b0f1c]/60 backdrop-blur px-3.5 py-1.5 text-[12px] text-white/75"><span className="h-1.5 w-1.5 rounded-full bg-[#34d399]" />Đừng để AI nghĩ thay bạn.</span>
            <h1 className="font-semibold tracking-[-0.045em] leading-[0.95] text-[clamp(3rem,9.4vw,9rem)] pb-[0.08em]">Beyond<br /><span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(90deg,#4f8cff,#7c4dff,#ec4899)" }}>Prompting.</span></h1>
            <p className="mt-6 max-w-xl text-[15px] md:text-[18px] leading-relaxed text-white/65">Khi AI có thể đưa ra mọi đáp án, cách bạn đặt câu hỏi mới là thước đo giáo dục duy nhất.</p>
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
            <div className="w-[min(400px,calc(100vw-2rem))] rounded-3xl border border-white/12 bg-[#0b0f1c]/78 backdrop-blur-xl p-6 sm:p-8 shadow-[0_20px_60px_-20px_rgba(124,77,255,0.5)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide" style={{ color: c.color }}><span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.eyebrow}</div>
                <div className="flex gap-1.5">{c.status.map((st) => <span key={st} className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${st === "Đã có" ? "bg-[#34d399]/15 text-[#6ee7b7]" : "bg-white/10 text-white/60"}`}>{st}</span>)}</div>
              </div>
              <h2 className="mt-4 text-[26px] sm:text-[32px] font-medium leading-[1.08] tracking-[-0.03em]">{c.name}</h2>
              <div className="mt-1 text-[12px] italic text-white/40">{c.en}</div>
              <p className="mt-4 text-[13px] sm:text-[14.5px] leading-relaxed text-white/70">{c.desc}</p>
              <div className="mt-5 pt-4 border-t border-white/10">
                <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-white/40">Giá trị lõi</div>
                <p className="mt-1.5 text-[12.5px] sm:text-[13.5px] leading-relaxed text-white/60">{c.core}</p>
              </div>
            </div>
          </div>
        ))}

        <div ref={hud} className="absolute left-5 md:left-16 top-24 text-[11px] tabular-nums tracking-[0.2em] text-white/45 pointer-events-none" />
        <div className="absolute left-0 right-0 bottom-0 h-[3px] bg-white/10"><div ref={bar} className="h-full" style={{ width: 0, background: "linear-gradient(90deg,#4f8cff,#7c4dff,#ec4899)" }} /></div>
      </div>
    </section>
  );
};
