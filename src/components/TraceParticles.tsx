import React, { useEffect, useRef } from "react";

/**
 * Hero motion: a ribbon of light particles that stands for "the trace" of a student's thinking.
 * Colour runs cobalt -> violet -> magenta (the Trace palette) and ends in the evidence-green "now" point.
 * Five denser clusters are the turns of a conversation. The cloud turns with the cursor and parts around it.
 * Canvas 2D only; paused when off screen; a single still frame under prefers-reduced-motion.
 */
interface P { u: number; ox: number; oy: number; oz: number; size: number; cl: number; dx: number; dy: number; tw: number }

const STOPS: [number, number, number][] = [[79, 140, 255], [124, 77, 255], [236, 72, 153]];
const NOW: [number, number, number] = [52, 211, 153];
const CLUSTERS = [0.1, 0.3, 0.5, 0.72, 0.92];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function colorAt(u: number): [number, number, number] {
  if (u > 0.9) { const t = Math.min(1, (u - 0.9) / 0.06); const c = STOPS[2]; return [lerp(c[0], NOW[0], t), lerp(c[1], NOW[1], t), lerp(c[2], NOW[2], t)]; }
  const s = u / 0.9 * 2, i = Math.min(1, Math.floor(s)), t = s - i, a = STOPS[i], b = STOPS[i + 1];
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export const TraceParticles: React.FC<{ className?: string }> = ({ className = "" }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const small = window.matchMedia("(max-width: 700px)");
    let w = 0, h = 0, dpr = 1, raf = 0, visible = true, last = 0, t = 2;
    const mouse = { x: 0.5, y: 0.5, px: -9999, py: -9999, tx: 0.5, ty: 0.5 };
    const rand = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; })();
    const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;

    const N = small.matches ? 1600 : 4600;
    const parts: P[] = Array.from({ length: N }, () => {
      const inCluster = rand() < 0.42;
      const cl = inCluster ? Math.floor(rand() * CLUSTERS.length) : -1;
      const u = inCluster ? CLUSTERS[cl] + gauss() * 0.02 : rand();
      const spread = inCluster ? 1 : 0.35 + rand() * 0.5;
      return { u: Math.max(0, Math.min(1, u)), ox: gauss() * spread, oy: gauss() * spread, oz: gauss() * spread, size: 1.3 + rand() * 2.4, cl, dx: 0, dy: 0, tw: rand() * 6.28 };
    });

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (time: number) => {
      mouse.x = lerp(mouse.x, mouse.tx, 0.06); mouse.y = lerp(mouse.y, mouse.ty, 0.06);
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      const A = Math.min(w, h) * (small.matches ? 0.2 : 0.24);
      const span = w * (small.matches ? 1.0 : 0.82), cx = w * (small.matches ? 0.5 : 0.56), cy = h * (small.matches ? 0.3 : 0.46);
      const rotY = (mouse.x - 0.5) * 0.9 + Math.sin(time * 0.15) * 0.12, rotX = (mouse.y - 0.5) * 0.4;
      const cY = Math.cos(rotY), sY = Math.sin(rotY), cX = Math.cos(rotX), sX = Math.sin(rotX);
      const focal = Math.max(w, h) * 1.1;
      // soft glow behind each "turn" of the conversation
      for (const u of CLUSTERS) {
        const a0 = u * Math.PI * 2;
        const gx = (u - 0.5) * span, gy = Math.sin(a0 * 1.15 + time * 0.55) * A + Math.sin(a0 * 3.1 + time * 0.8) * A * 0.32, gz = Math.cos(a0 * 1.15 + time * 0.45) * A * 0.9;
        const gx1 = gx * cY + gz * sY, gz1 = -gx * sY + gz * cY, gy2 = gy * cX - gz1 * sX, gz2 = gy * sX + gz1 * cX;
        const gk = focal / (focal + gz2 + A), px = cx + gx1 * gk, py = cy + gy2 * gk, rr = A * 0.75 * gk;
        const [gr, gg, gb] = colorAt(u);
        const grad = ctx.createRadialGradient(px, py, 0, px, py, rr);
        grad.addColorStop(0, `rgba(${gr | 0},${gg | 0},${gb | 0},0.28)`); grad.addColorStop(1, `rgba(${gr | 0},${gg | 0},${gb | 0},0)`);
        ctx.fillStyle = grad; ctx.fillRect(px - rr, py - rr, rr * 2, rr * 2);
      }
      for (const p of parts) {
        const a = p.u * Math.PI * 2;
        // the trace: a long wave that slowly drifts
        const bx = (p.u - 0.5) * span;
        const by = Math.sin(a * 1.15 + time * 0.55) * A + Math.sin(a * 3.1 + time * 0.8) * A * 0.32;
        const bz = Math.cos(a * 1.15 + time * 0.45) * A * 0.9;
        const taper = p.cl >= 0 ? 0.26 : Math.sin(p.u * Math.PI) * 0.3 + 0.06;
        const R = A * (p.cl >= 0 ? 0.42 : 1) * taper * 2.2;
        let x = bx + p.ox * R, y = by + p.oy * R, z = bz + p.oz * R;
        // turn with the cursor
        const x1 = x * cY + z * sY, z1 = -x * sY + z * cY;
        const y2 = y * cX - z1 * sX, z2 = y * sX + z1 * cX;
        const k = focal / (focal + z2 + A);
        let sx = cx + x1 * k, sy = cy + y2 * k;
        // part around the cursor, then ease back
        const mdx = sx - mouse.px, mdy = sy - mouse.py, d2 = mdx * mdx + mdy * mdy, rad = 130;
        if (d2 < rad * rad) { const d = Math.sqrt(d2) || 1, f = (1 - d / rad) * 26; p.dx += (mdx / d) * f * 0.2; p.dy += (mdy / d) * f * 0.2; }
        p.dx *= 0.9; p.dy *= 0.9;
        sx += p.dx; sy += p.dy;
        if (sx < -10 || sx > w + 10 || sy < -10 || sy > h + 10) continue;
        const [r, g, b] = colorAt(p.u);
        const depth = Math.max(0.25, Math.min(1, 0.55 + z2 / (A * 3)));
        const tw = 0.75 + 0.25 * Math.sin(time * 2 + p.tw);
        const al = Math.min(1, (p.cl >= 0 ? 1.1 : 0.9) * depth * tw);
        ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${al})`;
        const s = p.size * (0.6 + k * 0.7) * (p.cl >= 0 ? 1.15 : 1);
        ctx.fillRect(sx, sy, s, s);
      }
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; t += dt;
      draw(t);
    };
    const start = () => { cancelAnimationFrame(raf); last = 0; if (reduced.matches) draw(2); else raf = requestAnimationFrame(loop); };

    const move = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.px = e.clientX - r.left; mouse.py = e.clientY - r.top;
      mouse.tx = Math.max(0, Math.min(1, mouse.px / r.width)); mouse.ty = Math.max(0, Math.min(1, mouse.py / r.height));
    };
    const leave = () => { mouse.px = mouse.py = -9999; };
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0 });
    const ro = new ResizeObserver(() => { resize(); if (reduced.matches) draw(2); });
    io.observe(canvas); ro.observe(canvas);
    resize(); start();
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerleave", leave);
    reduced.addEventListener("change", start);
    return () => {
      cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerleave", leave);
      reduced.removeEventListener("change", start);
    };
  }, []);

  return <canvas ref={ref} className={`block w-full h-full ${className}`} aria-hidden="true" />;
};
