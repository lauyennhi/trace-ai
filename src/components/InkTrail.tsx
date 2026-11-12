import React, { useEffect, useRef } from "react";

/**
 * "Ink bleed" cursor effect: soft coloured blobs spawn along the pointer, then keep growing
 * while they fade, so they spread and merge like ink on wet paper.
 * Attaches to its parent element; never blocks clicks; off for prefers-reduced-motion.
 */
const COLORS = ["11,87,208", "124,77,255", "236,72,153", "56,189,248", "16,185,129"];

export const InkTrail: React.FC<{ className?: string; strength?: number; blur?: number }> = ({ className = "", strength = 1, blur = 12 }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0, raf = 0, running = false;
    const resize = () => {
      const r = parent.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);

    type P = { x: number; y: number; r: number; grow: number; a: number; fade: number; c: string };
    const ps: P[] = [];
    let last: { x: number; y: number } | null = null;
    let ci = Math.floor(Math.random() * COLORS.length);

    const spawn = (x: number, y: number) => {
      ps.push({
        x: x + (Math.random() - 0.5) * 14, y: y + (Math.random() - 0.5) * 14,
        r: 10 + Math.random() * 14, grow: 0.6 + Math.random() * 1.1,
        a: (0.42 + Math.random() * 0.2) * strength, fade: 0.962 + Math.random() * 0.015,
        c: COLORS[ci % COLORS.length],
      });
      if (ps.length > 360) ps.shift();
    };

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.r += p.grow; p.grow *= 0.992; p.a *= p.fade;
        if (p.a < 0.012) { ps.splice(i, 1); continue; }
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, `rgba(${p.c},${p.a})`);
        g.addColorStop(0.55, `rgba(${p.c},${p.a * 0.55})`);
        g.addColorStop(1, `rgba(${p.c},0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      if (ps.length > 0) raf = requestAnimationFrame(tick); else running = false;
    };
    const start = () => { if (!running) { running = true; raf = requestAnimationFrame(tick); } };

    const onMove = (e: PointerEvent) => {
      const r = parent.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (last) {
        const d = Math.hypot(x - last.x, y - last.y);
        const steps = Math.min(10, Math.max(1, Math.ceil(d / 9)));
        for (let i = 1; i <= steps; i++) spawn(last.x + ((x - last.x) * i) / steps, last.y + ((y - last.y) * i) / steps);
        if (d > 40) ci++; // change colour as the cursor travels
      } else spawn(x, y);
      last = { x, y };
      start();
    };
    const onLeave = () => { last = null; };

    parent.addEventListener("pointermove", onMove);
    parent.addEventListener("pointerleave", onLeave);
    return () => {
      parent.removeEventListener("pointermove", onMove);
      parent.removeEventListener("pointerleave", onLeave);
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [strength]);

  return <canvas ref={ref} aria-hidden className={`absolute inset-0 w-full h-full pointer-events-none ${className}`} style={{ filter: `blur(${blur}px) saturate(1.1)` }} />;
};
