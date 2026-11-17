import React, { useEffect, useRef } from "react";

/**
 * Hero figure: a bust built from a lattice of light dots (a "scan"), in the Trace palette.
 * - The head turns toward the cursor and the dots part around it.
 * - A green scan line sweeps down the figure ("Trace is recording").
 * - zoomRef (0..1, driven by page scroll) flies the camera into the face until the lattice reads as large pixels.
 * Canvas 2D only, no assets. Paused off screen; a single still frame under prefers-reduced-motion.
 */
const LAVENDER: [number, number, number] = [214, 204, 255];
const TINTS: [number, number, number][] = [LAVENDER, [79, 140, 255], [236, 72, 153], [52, 211, 153]]; // none, cobalt rim, magenta rim, scan green
const LEVELS = 10;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface Fig { n: number; X: Float32Array; Y: Float32Array; Z: Float32Array; NX: Float32Array; NY: Float32Array; NZ: Float32Array; AO: Float32Array; W: Float32Array }

function build(rings: number): Fig {
  const xs: number[] = [], ys: number[] = [], zs: number[] = [], nxs: number[] = [], nys: number[] = [], nzs: number[] = [], aos: number[] = [], ws: number[] = [];
  const push = (x: number, y: number, z: number, nx: number, ny: number, nz: number, ao: number, w: number) => {
    const l = Math.hypot(nx, ny, nz) || 1;
    xs.push(x); ys.push(y); zs.push(z); nxs.push(nx / l); nys.push(ny / l); nzs.push(nz / l); aos.push(ao); ws.push(w);
  };
  // equal-area lattice on a unit sphere: ring count by latitude keeps the dot spacing even
  const sphere = (r: number, fn: (dx: number, dy: number, dz: number) => void) => {
    for (let i = 0; i < r; i++) {
      const phi = (Math.PI * (i + 0.5)) / r, sp = Math.sin(phi), cp = Math.cos(phi);
      const count = Math.max(6, Math.round(2 * r * sp));
      const off = (i % 2) * 0.5;
      for (let j = 0; j < count; j++) { const th = ((j + off) / count) * Math.PI * 2; fn(sp * Math.sin(th), cp, sp * Math.cos(th)); }
    }
  };
  // head
  sphere(rings, (dx, dy, dz) => {
    let rx = 0.52, ry = 0.68, rz = 0.6;
    if (dy < 0) { const t = -dy; rx *= 1 - 0.36 * Math.pow(t, 1.4); rz *= 1 - 0.16 * t; }
    if (dz > 0) rz *= 1 - 0.08 * dz;
    const x = dx * rx, y = dy * ry + 0.1;
    let z = dz * rz, ao = 1;
    if (dz > 0.15) {
      const nose = Math.exp(-((x / 0.075) ** 2 + (y / 0.17) ** 2)); z += 0.14 * nose * dz;
      const brow = Math.exp(-(((y - 0.2) / 0.05) ** 2)) * Math.max(0, 1 - Math.abs(x) / 0.45); z += 0.035 * brow; ao -= 0.25 * brow;
      for (const s of [-1, 1]) { const e = Math.exp(-(((x - 0.2 * s) / 0.085) ** 2 + ((y - 0.15) / 0.045) ** 2)); z -= 0.05 * e; ao -= 0.6 * e; }
      const lip = Math.exp(-((x / 0.11) ** 2 + ((y + 0.33) / 0.03) ** 2)); z += 0.03 * lip; ao -= 0.35 * lip;
      if (dy < -0.5) z += 0.04 * ((-dy - 0.5) / 0.5) * dz;
    }
    push(x, y, z, dx / rx, dy / ry, dz / rz, Math.max(0.25, ao), 1);
  });
  // ears
  for (const s of [-1, 1]) sphere(Math.max(10, Math.round(rings * 0.12)), (dx, dy, dz) => push(s * 0.535 + dx * 0.045, 0.06 + dy * 0.11, -0.03 + dz * 0.07, dx, dy, dz, 0.7, 1));
  // neck
  const nr = Math.round(rings * 0.34);
  for (let j = 0; j < nr; j++) {
    const y = -0.5 - (j / nr) * 0.8, cnt = Math.round(rings * 0.55);
    for (let k = 0; k < cnt; k++) { const a = ((k + (j % 2) * 0.5) / cnt) * Math.PI * 2; push(0.23 * Math.cos(a), y, 0.21 * Math.sin(a) + 0.02, Math.cos(a), 0, Math.sin(a), y > -0.75 ? 0.45 : 0.75, 0.6); }
  }
  // shoulders and chest
  const tr = Math.round(rings * 0.62);
  for (let i = 0; i < tr; i++) {
    const phi = (Math.PI * 0.62 * (i + 0.5)) / tr + 0.0, sp = Math.sin(phi), cp = Math.cos(phi);
    const count = Math.max(8, Math.round(2.6 * tr * sp));
    for (let j = 0; j < count; j++) {
      const th = ((j + (i % 2) * 0.5) / count) * Math.PI * 2, dx = sp * Math.sin(th), dz = sp * Math.cos(th);
      push(dx * 1.28, -1.25 - (1 - cp) * 1.6, dz * 0.56, dx / 1.28, cp * 0.6, dz / 0.56, 0.85, 0.2);
    }
  }
  const n = xs.length;
  return { n, X: Float32Array.from(xs), Y: Float32Array.from(ys), Z: Float32Array.from(zs), NX: Float32Array.from(nxs), NY: Float32Array.from(nys), NZ: Float32Array.from(nzs), AO: Float32Array.from(aos), W: Float32Array.from(ws) };
}

const palette = (() => {
  const out: string[] = [];
  for (let l = 0; l < LEVELS; l++) for (let t = 0; t < 4; t++) {
    const b = 0.2 + 0.95 * (l / (LEVELS - 1)), base = LAVENDER.map((c) => c * b), tint = TINTS[t];
    const m = t === 0 ? 0 : 0.6, c = base.map((v, i) => lerp(v, tint[i] * (0.55 + 0.45 * b), m));
    out.push(`rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`);
  }
  return out;
})();
const RIBBON = ["#4f8cff", "#6a74ff", "#7c4dff", "#a24cf0", "#d04bc4", "#ec4899"];

export const TraceHead: React.FC<{ className?: string; zoomRef: React.MutableRefObject<number> }> = ({ className = "", zoomRef }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const small = window.matchMedia("(max-width: 700px)");
    const fig = build(small.matches ? 70 : 118);
    const n = fig.n;
    const SX = new Float32Array(n), SY = new Float32Array(n), DX = new Float32Array(n), DY = new Float32Array(n);
    const KEY = new Uint8Array(n), ORDER = new Uint32Array(n);
    const ribbon = Array.from({ length: small.matches ? 260 : 700 }, (_, i) => ({ u: (i * 0.618034) % 1, a: ((i * 7919) % 1000) / 1000 - 0.5, b: ((i * 104729) % 1000) / 1000 - 0.5 }));
    let w = 0, h = 0, dpr = 1, raf = 0, visible = true, last = 0, t = 2, zs = 0;
    const mouse = { px: -9999, py: -9999, x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (time: number) => {
      mouse.x = lerp(mouse.x, mouse.tx, 0.07); mouse.y = lerp(mouse.y, mouse.ty, 0.07);
      zs = lerp(zs, clamp(zoomRef.current, 0, 1), 0.09);
      const e = ease(clamp((zs - 0.12) / 0.8, 0, 1));
      const sm = small.matches;
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, w, h);

      const base = (sm ? h * 0.27 : h * 0.345), unit = base * (1 + (sm ? 1.7 : 2.7) * e);
      const cx = lerp(sm ? w * 0.5 : w * 0.62, sm ? w * 0.34 : w * 0.22, e);
      const cyFace = lerp(sm ? h * 0.36 : h * 0.47, sm ? h * 0.42 : h * 0.5, e);
      const F = 4.6;
      const yaw = (mouse.x - 0.5) * 1.35 + Math.sin(time * 0.45) * 0.09, pitch = (mouse.y - 0.5) * 0.42 + Math.sin(time * 0.33) * 0.03;
      const cyw = Math.cos(yaw), syw = Math.sin(yaw), cpt = Math.cos(pitch), spt = Math.sin(pitch);
      const pivotY = -0.7;
      const Lx = -0.42, Ly = 0.5, Lz = 0.76;
      const scanY = 1.0 - ((time * 0.2) % 1.3) * 3.4;

      // the trace ribbon behind the figure
      if (e < 0.9) {
        const baseA = 0.55 * (1 - e);
        for (let k = 0; k < RIBBON.length; k++) {
          ctx.fillStyle = RIBBON[k]; ctx.globalAlpha = baseA;
          for (const r of ribbon) {
            if (Math.min(RIBBON.length - 1, Math.floor(r.u * RIBBON.length)) !== k) continue;
            const wx = (r.u - 0.5) * 7.4 + r.a * 0.5, wy = Math.sin(r.u * 7.2 + time * 0.6) * 0.5 + 0.15 + r.b * 0.45, wz = -1.1 + Math.cos(r.u * 5 + time * 0.4) * 0.5;
            const kk = F / (F - wz);
            const sx = cx + wx * unit * kk, sy = cyFace - (wy - 0.1) * unit * kk;
            if (sx < -4 || sx > w + 4 || sy < -4 || sy > h + 4) continue;
            ctx.fillRect(sx, sy, 1.6, 1.6);
          }
        }
        ctx.globalAlpha = 1;
      }

      const counts = new Uint32Array(LEVELS * 4 + 1);
      for (let i = 0; i < n; i++) {
        const wgt = fig.W[i];
        const yw = yaw * wgt, c1 = Math.cos(yw), s1 = Math.sin(yw);
        let x = fig.X[i], y = fig.Y[i] - pivotY, z = fig.Z[i];
        let nx = fig.NX[i], ny = fig.NY[i], nz = fig.NZ[i];
        let x1 = x * c1 + z * s1, z1 = -x * s1 + z * c1;
        let nx1 = nx * c1 + nz * s1, nz1 = -nx * s1 + nz * c1;
        const pw = pitch * (wgt > 0.5 ? 1 : 0.2), cp = Math.cos(pw), sp = Math.sin(pw);
        const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
        const ny2 = ny * cp - nz1 * sp, nz2 = ny * sp + nz1 * cp;
        void cyw; void syw; void cpt; void spt;
        const wy = y2 + pivotY;
        const k = F / (F - z2);
        let sx = cx + x1 * unit * k, sy = cyFace - (wy - 0.1) * unit * k;
        const idx = i;
        // back side: only a faint sparse scan, so the figure reads as a solid scan with depth
        const back = nz2 < -0.08;
        if (back && (i & 7) !== 0) { KEY[idx] = 255; continue; }
        // part around the cursor, ease back
        const mdx = sx - mouse.px, mdy = sy - mouse.py, d2 = mdx * mdx + mdy * mdy, rad = 110;
        if (d2 < rad * rad) { const d = Math.sqrt(d2) || 1, f = (1 - d / rad) * 7; DX[i] += (mdx / d) * f; DY[i] += (mdy / d) * f; }
        DX[i] *= 0.88; DY[i] *= 0.88;
        sx += DX[i]; sy += DY[i];
        if (sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20) { KEY[idx] = 255; continue; }
        const shade = Math.max(0, nx1 * Lx + ny2 * Ly + nz2 * Lz) * fig.AO[i];
        const rim = Math.pow(1 - Math.max(0, nz2), 2.4);
        let level = Math.round(clamp(0.16 + shade * 0.95 + rim * 0.15, 0, 1) * (LEVELS - 1));
        let tint = rim > 0.5 && !back ? (nx1 > 0 ? 2 : 1) : 0;
        if (Math.abs(wy - scanY) < 0.035) { tint = 3; level = LEVELS - 1; }
        if (back) { level = 0; tint = 0; }
        SX[i] = sx; SY[i] = sy; KEY[idx] = level * 4 + tint;
        counts[KEY[idx]]++;
      }
      // draw by colour bucket (one fillStyle per bucket)
      let acc = 0; const starts = new Uint32Array(LEVELS * 4 + 1);
      for (let k = 0; k < LEVELS * 4; k++) { starts[k] = acc; acc += counts[k]; }
      const fill = new Uint32Array(LEVELS * 4);
      for (let i = 0; i < n; i++) { const k = KEY[i]; if (k === 255) continue; ORDER[starts[k] + fill[k]++] = i; }
      const size = clamp(unit * 0.0078, 1.5, 12);
      for (let k = 0; k < LEVELS * 4; k++) {
        if (!counts[k]) continue;
        ctx.fillStyle = palette[k];
        ctx.globalAlpha = k < 4 ? 0.5 : 1;
        for (let q = starts[k], end = starts[k] + counts[k]; q < end; q++) { const i = ORDER[q]; ctx.fillRect(SX[i] - size / 2, SY[i] - size / 2, size, size); }
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; t += dt; draw(t);
    };
    const start = () => { cancelAnimationFrame(raf); last = 0; if (reduced.matches) draw(2); else raf = requestAnimationFrame(loop); };
    const move = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.px = e.clientX - r.left; mouse.py = e.clientY - r.top;
      mouse.tx = clamp(mouse.px / r.width, 0, 1); mouse.ty = clamp(mouse.py / r.height, 0, 1);
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
  }, [zoomRef]);

  return <canvas ref={ref} className={`block w-full h-full ${className}`} aria-hidden="true" />;
};
