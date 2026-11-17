import React, { useEffect, useRef } from "react";

/** The thinking trace as one huge twisting ribbon. Scrolling moves the camera along it: it climbs when thinking is independent and dives when it is pasted or delegated. */
interface Chapter { id: string; color: string; eyebrow: string; name: string; en: string; status: string[]; desc: string; core: string }

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
  { id: "goc-nhin", color: "#4f8cff", eyebrow: "01", name: "Hmm… Góc nhìn khác thì sao?", en: "Lăng kính Đối lập", status: ["Sắp có"], desc: "Bôi đen một đoạn trên bất kỳ trang nào, nhận ngay góc nhìn đối lập để thoát khỏi buồng âm vang.", core: "Bắt đầu từ việc nghi ngờ điều mình vừa đọc." },
  { id: "think-first", color: "#7c4dff", eyebrow: "02", name: "Hmm… Think first.", en: "Ma sát Nhận thức", status: ["Đã có"], desc: "AI khóa 70% câu trả lời. Bạn viết ra ý của mình thì phần còn lại mới mở.", core: "Lực cản có chủ đích để không thể copy-paste một cách vô thức." },
  { id: "are-you-sure", color: "#ec4899", eyebrow: "03", name: "Hmm… Are you sure?", en: "Kiểm định Socratic", status: ["Đã có", "Quét nguồn: sắp có"], desc: "AI đóng vai người chất vấn: bạn chứng minh luận điểm này thế nào, nguồn nào chống lưng?", core: "Biến AI từ người làm thuê thành người rèn luyện tư duy." },
  { id: "aha", color: "#34d399", eyebrow: "04", name: "Hmm… Aha!", en: "Hồ sơ Minh bạch", status: ["Đã có"], desc: "Quá trình nghĩ của bạn được ghi lại thành hồ sơ 5 chiều: bằng chứng bạn thực sự hiểu.", core: "Trả lại giá trị cho sự trung thực học thuật." },
];
// the line: height = how independently the student is thinking at that moment (low = pasted / asked to do it for them)
const POINTS: { y: number; c?: number }[] = [{ y: 0.76 }, { y: 0.26, c: 0 }, { y: 0.86 }, { y: 0.42, c: 1 }, { y: 0.84 }, { y: 0.22, c: 2 }, { y: 0.12, c: 3 }, { y: 0.3 }];

export const JourneyHmm: React.FC = () => {
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
    const nodeOf = CHAPTERS.map((_, c) => POINTS.findIndex((pt) => pt.c === c));
    let raf = 0, visible = true, ps = 0, lastLabel = "", lastHud = -1;

    const layout = () => {
      const r = cv.getBoundingClientRect();
      vw = Math.max(1, r.width); vh = Math.max(1, r.height); dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      small = vw < 700;
      spacing = small ? vw * 1.1 : clamp(vw * 0.92, 800, 1500);
      marker = small ? vw * 0.5 : vw * 0.36;
      nodes = POINTS.map((pt, i) => ({ x: i * spacing, y: vh * pt.y }));
      CHAPTERS.forEach((_, i) => {
        const el = cards.current[i]; if (!el) return;
        el.style.top = `${nodes[nodeOf[i]].y + 52}px`;
        (el.firstElementChild as HTMLElement).style.transform = "translate(-50%,0)";
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
        const ci = POINTS[i].c; if (ci === undefined) return;
        const sx = nd.x - camX; if (sx < -60 || sx > vw + 60) return;
        const d = Math.abs(sx - marker), near = 1 - smooth(0, spacing * 0.35, d), col = CHAPTERS[ci].color;
        if (d < best) { best = d; active = ci; }
        ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.setLineDash([2, 6]); ctx.beginPath(); ctx.moveTo(sx, nd.y); ctx.lineTo(sx, POINTS[i].y < 0.5 ? vh : 0); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = col; ctx.globalAlpha = 0.25 + 0.2 * near; ctx.beginPath(); ctx.arc(sx, nd.y, 20 + 14 * near, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = col; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, nd.y, 8 + 4 * near, 0, 6.283); ctx.fill(); ctx.stroke();
      });

      // the orb that rides the line: its height is the "thinking level" at this point of the story
      const oy = curve(markerX);
      const grad = ctx.createRadialGradient(marker, oy, 0, marker, oy, 44);
      grad.addColorStop(0, "rgba(255,255,255,0.95)"); grad.addColorStop(0.25, "rgba(196,181,253,0.55)"); grad.addColorStop(1, "rgba(124,77,255,0)");
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(marker, oy, 44, 0, 6.283); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(marker, oy, 8, 0, 6.283); ctx.fill();
      const lvl = oy / vh, label = lvl < 0.4 ? "Tư duy độc lập" : lvl > 0.6 ? "Dán / nhờ làm hộ" : "Đang suy nghĩ", lcol = lvl < 0.4 ? UP : lvl > 0.6 ? DOWN : MID;
      const ol = orbLabel.current; if (ol) {
        ol.style.transform = `translate3d(${marker + 22}px,${oy - 38}px,0)`;
        if (label !== lastLabel) { lastLabel = label; ol.textContent = label; ol.style.color = lcol; ol.style.borderColor = lcol + "88"; }
      }

      // cards ride along with their nodes and fade in around the marker
      CHAPTERS.forEach((_, i) => {
        const el = cards.current[i]; if (!el) return;
        const sx = nodes[nodeOf[i]].x - camX, d = Math.abs(sx - marker), v = 1 - smooth(spacing * 0.1, spacing * 0.36, d);
        el.style.transform = `translate3d(${small ? marker : sx}px,0,0)`;   // on phones the card stays centred and just fades
        (el.firstElementChild as HTMLElement).style.opacity = String(v);
        el.style.visibility = v < 0.01 ? "hidden" : "visible";
      });
      if (hero.current) hero.current.style.opacity = String(1 - smooth(0, 0.05, ps));
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
    <section ref={wrap} className="relative bg-[#060914] text-white" style={{ height: `${100 + (POINTS.length - 1) * 90}svh`, fontFamily: "Inter, 'Be Vietnam Pro', system-ui, sans-serif" }} aria-label="Hành trình tư duy">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <div className="absolute -top-40 -left-32 w-[42rem] h-[42rem] rounded-full bg-[#0b57d0] opacity-[0.22] blur-[130px]" />
        <div className="absolute top-1/4 -right-40 w-[38rem] h-[38rem] rounded-full bg-[#7c4dff] opacity-[0.2] blur-[130px]" />
        <div className="absolute -bottom-52 left-1/4 w-[40rem] h-[28rem] rounded-full bg-[#ec4899] opacity-[0.13] blur-[130px]" />
        <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-hidden="true" />

        <div className="absolute right-4 md:right-8 top-[9%] text-[10px] tracking-[0.16em] uppercase text-white/35 pointer-events-none">Tư duy sâu ↑</div>
        <div className="absolute right-4 md:right-8 bottom-[11%] text-[10px] tracking-[0.16em] uppercase text-white/35 pointer-events-none">Nhờ làm hộ ↓</div>
        <div ref={orbLabel} className="absolute left-0 top-0 rounded-full border px-3 py-1 text-[11px] font-medium bg-[#0b0f1c]/70 backdrop-blur pointer-events-none whitespace-nowrap will-change-transform" />

        <div ref={hero} className="absolute bottom-6 inset-x-0 z-10 flex flex-col items-center gap-1.5 text-[11px] tracking-[0.18em] uppercase text-white/45 pointer-events-none">Cuộn để đi theo dấu vết<span className="h-6 w-px bg-gradient-to-b from-white/50 to-transparent" /></div>

        {/* chapter cards */}
        {CHAPTERS.map((c, i) => (
          <div key={c.id} ref={(el) => { cards.current[i] = el; }} className="absolute left-0 z-10 pointer-events-none invisible will-change-transform">
            <div className="w-[min(400px,calc(100vw-2rem))] rounded-3xl border border-white/12 bg-[#0b0f1c]/78 backdrop-blur-xl p-6 sm:p-8 shadow-[0_20px_60px_-20px_rgba(124,77,255,0.5)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide" style={{ color: c.color }}><span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.eyebrow}</div>
                <div className="flex gap-1.5">{c.status.map((st) => <span key={st} className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${st === "Đã có" ? "bg-[#34d399]/15 text-[#6ee7b7]" : "bg-white/10 text-white/60"}`}>{st}</span>)}</div>
              </div>
              <h2 className="mt-4 text-[24px] sm:text-[30px] font-semibold leading-[1.1] tracking-[-0.03em]">{c.name}</h2>
              <div className="mt-1 text-[12px] italic text-white/40">{c.en}</div>
              <p className="mt-4 text-[13px] sm:text-[14.5px] leading-relaxed text-white/70">{c.desc}</p>
              <div className="mt-4 pt-3 border-t border-white/10 hidden sm:block">
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
