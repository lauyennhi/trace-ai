import React, { useEffect, useRef } from "react";

/**
 * Hero figure: a translucent blue glass head with a glowing red brain inside, drawn as a lattice of dots,
 * turning on its own in a slow full circle (a turntable). Palette: pastel lavender background, blue glass, red brain.
 * Draw order gives the "glass" depth: back of the shell, then the brain, then the front of the shell on top.
 * Canvas 2D only, no assets. Paused off screen; a single still frame under prefers-reduced-motion.
 */
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const LV = 10;

interface Cloud { n: number; X: Float32Array; Y: Float32Array; Z: Float32Array; NX: Float32Array; NY: Float32Array; NZ: Float32Array; S: Float32Array }

function lattice(rings: number, fn: (dx: number, dy: number, dz: number, push: (x: number, y: number, z: number, nx: number, ny: number, nz: number, s: number) => void) => void): Cloud {
  const a: number[][] = [[], [], [], [], [], [], [], []];
  const push = (x: number, y: number, z: number, nx: number, ny: number, nz: number, s: number) => {
    const l = Math.hypot(nx, ny, nz) || 1;
    a[0].push(x); a[1].push(y); a[2].push(z); a[3].push(nx / l); a[4].push(ny / l); a[5].push(nz / l); a[6].push(s);
  };
  for (let i = 0; i < rings; i++) {
    const phi = (Math.PI * (i + 0.5)) / rings, sp = Math.sin(phi), cp = Math.cos(phi);
    const count = Math.max(6, Math.round(2 * rings * sp)), off = (i % 2) * 0.5;
    for (let j = 0; j < count; j++) { const th = ((j + off) / count) * Math.PI * 2; fn(sp * Math.sin(th), cp, sp * Math.cos(th), push); }
  }
  return { n: a[0].length, X: Float32Array.from(a[0]), Y: Float32Array.from(a[1]), Z: Float32Array.from(a[2]), NX: Float32Array.from(a[3]), NY: Float32Array.from(a[4]), NZ: Float32Array.from(a[5]), S: Float32Array.from(a[6]) };
}
const merge = (list: Cloud[]): Cloud => {
  const n = list.reduce((s, c) => s + c.n, 0), out: Cloud = { n, X: new Float32Array(n), Y: new Float32Array(n), Z: new Float32Array(n), NX: new Float32Array(n), NY: new Float32Array(n), NZ: new Float32Array(n), S: new Float32Array(n) };
  let o = 0;
  for (const c of list) { (["X", "Y", "Z", "NX", "NY", "NZ", "S"] as const).forEach((k) => out[k].set(c[k], o)); o += c.n; }
  return out;
};

function buildShell(rings: number): Cloud {
  const head = lattice(rings, (dx, dy, dz, push) => {
    let rx = 0.52, ry = 0.68, rz = 0.6;
    if (dy < 0) { const t = -dy; rx *= 1 - 0.36 * Math.pow(t, 1.4); rz *= 1 - 0.16 * t; }
    if (dz > 0) rz *= 1 - 0.08 * dz;
    const x = dx * rx, y = dy * ry + 0.1; let z = dz * rz;
    if (dz > 0.15) {
      z += 0.14 * Math.exp(-((x / 0.075) ** 2 + (y / 0.17) ** 2)) * dz;                       // nose
      z += 0.035 * Math.exp(-(((y - 0.2) / 0.05) ** 2)) * Math.max(0, 1 - Math.abs(x) / 0.45); // brow
      for (const s of [-1, 1]) z -= 0.05 * Math.exp(-(((x - 0.2 * s) / 0.085) ** 2 + ((y - 0.15) / 0.045) ** 2)); // eye sockets
      z += 0.03 * Math.exp(-((x / 0.11) ** 2 + ((y + 0.33) / 0.03) ** 2));                     // lips
      if (dy < -0.5) z += 0.04 * ((-dy - 0.5) / 0.5) * dz;                                      // chin
    }
    push(x, y, z, dx / rx, dy / ry, dz / rz, 1);
  });
  const ears = [-1, 1].map((s) => lattice(Math.max(10, Math.round(rings * 0.12)), (dx, dy, dz, push) => push(s * 0.535 + dx * 0.045, 0.06 + dy * 0.11, -0.03 + dz * 0.07, dx, dy, dz, 1)));
  const neckRows = Math.round(rings * 0.34), nx: number[][] = [[], [], [], [], [], [], []];
  for (let j = 0; j < neckRows; j++) {
    const y = -0.5 - (j / neckRows) * 0.8, cnt = Math.round(rings * 0.55);
    for (let k = 0; k < cnt; k++) { const a = ((k + (j % 2) * 0.5) / cnt) * Math.PI * 2; [0.23 * Math.cos(a), y, 0.21 * Math.sin(a) + 0.02, Math.cos(a), 0, Math.sin(a), 1].forEach((v, i) => nx[i].push(v)); }
  }
  const neck: Cloud = { n: nx[0].length, X: Float32Array.from(nx[0]), Y: Float32Array.from(nx[1]), Z: Float32Array.from(nx[2]), NX: Float32Array.from(nx[3]), NY: Float32Array.from(nx[4]), NZ: Float32Array.from(nx[5]), S: Float32Array.from(nx[6]) };
  const tr = Math.round(rings * 0.62);
  const torso = lattice(tr, (dx, dy, dz, push) => { if (dy < -0.05) return; push(dx * 1.28, -1.25 - (1 - dy) * 1.5, dz * 0.56, dx / 1.28, dy * 0.6, dz / 0.56, 0.6); });
  return merge([head, ...ears, neck, torso]);
}

/** Two hemispheres with folded surfaces, a cerebellum and a stem, sitting in the upper back of the skull. */
function buildBrain(rings: number): Cloud {
  const folds = (x: number, y: number, z: number) => 0.085 * Math.sin(x * 21 + y * 5) * Math.sin(y * 19 + z * 6) * Math.sin(z * 17 + x * 4) + 0.04 * Math.sin(x * 38 + z * 23) * Math.sin(y * 33);
  const hemi = lattice(rings, (dx, dy, dz, push) => {
    const rx = 0.4, ry = 0.3, rz = 0.45;
    let px = dx * rx, py = dy * ry + 0.3, pz = dz * rz - 0.05;
    const gyri = folds(px, py, pz), fissure = 1 - 0.2 * Math.exp(-((px / 0.025) ** 2));
    const k = (1 + gyri) * fissure;
    px *= k; py = (py - 0.3) * k + 0.3; pz = (pz + 0.05) * k - 0.05;
    push(px, py, pz, dx / rx + gyri * 2, dy / ry + gyri * 2, dz / rz, 0.55 + gyri * 4);
  });
  const cere = lattice(Math.round(rings * 0.5), (dx, dy, dz, push) => push(dx * 0.2, 0.0 + dy * 0.11, -0.3 + dz * 0.14, dx, dy, dz, 0.4 + 0.15 * Math.sin(dy * 40)));
  const stem: number[][] = [[], [], [], [], [], [], []];
  for (let j = 0; j < 14; j++) for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2, y = -0.03 - j * 0.03; [0.06 * Math.cos(a), y, -0.2 + 0.05 * Math.sin(a) - j * 0.004, Math.cos(a), 0, Math.sin(a), 0.5].forEach((v, i) => stem[i].push(v)); }
  const st: Cloud = { n: stem[0].length, X: Float32Array.from(stem[0]), Y: Float32Array.from(stem[1]), Z: Float32Array.from(stem[2]), NX: Float32Array.from(stem[3]), NY: Float32Array.from(stem[4]), NZ: Float32Array.from(stem[5]), S: Float32Array.from(stem[6]) };
  return merge([hemi, cere, st]);
}

// colour tables: [shell front, shell back, brain]
const shellFront = Array.from({ length: LV }, (_, l) => { const t = l / (LV - 1); const c = [lerp(84, 238, t), lerp(128, 246, t), lerp(240, 255, t)]; return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${lerp(0.55, 0.95, t)})`; });
const shellBack = Array.from({ length: LV }, (_, l) => { const t = l / (LV - 1); const c = [lerp(110, 190, t), lerp(140, 205, t), lerp(235, 255, t)]; return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},0.3)`; });
const brainCol = Array.from({ length: LV }, (_, l) => { const t = l / (LV - 1); const c = [lerp(150, 255, t), lerp(10, 120, t * t), lerp(40, 140, t)]; return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},0.97)`; });

export const GlassHead: React.FC<{ className?: string }> = ({ className = "" }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const small = window.matchMedia("(max-width: 700px)");
    const shell = buildShell(small.matches ? 70 : 112), brain = buildBrain(small.matches ? 46 : 78);
    const all = merge([shell, brain]), nS = shell.n, n = all.n;
    const SX = new Float32Array(n), SY = new Float32Array(n), DX = new Float32Array(n), DY = new Float32Array(n);
    const KEY = new Uint8Array(n), ORDER = new Uint32Array(n);
    let w = 0, h = 0, dpr = 1, raf = 0, visible = true, last = 0, t = 1;
    const mouse = { px: -9999, py: -9999, ty: 0.5, y: 0.5 };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (time: number) => {
      mouse.y = lerp(mouse.y, mouse.ty, 0.06);
      ctx.clearRect(0, 0, w, h);
      const sm = small.matches;
      const unit = sm ? h * 0.3 : h * 0.43;
      const cx = sm ? w * 0.52 : w * 0.64, cyFace = sm ? h * 0.52 : h * 0.43;
      const F = 4.8, pivotY = -0.7;
      const yaw = time * 0.42;                                  // one full turn about every 15 s
      const pitch = (mouse.y - 0.5) * 0.25 + Math.sin(time * 0.5) * 0.04;
      const c1 = Math.cos(yaw), s1 = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const Lx = -0.45, Ly = 0.55, Lz = 0.7;
      const counts = new Uint32Array(LV * 3);
      for (let i = 0; i < n; i++) {
        const x = all.X[i], y = all.Y[i] - pivotY, z = all.Z[i];
        const x1 = x * c1 + z * s1, z1 = -x * s1 + z * c1;
        const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
        const nx1 = all.NX[i] * c1 + all.NZ[i] * s1, nz1 = -all.NX[i] * s1 + all.NZ[i] * c1;
        const ny2 = all.NY[i] * cp - nz1 * sp, nz2 = all.NY[i] * sp + nz1 * cp;
        const k = F / (F - z2);
        let sx = cx + x1 * unit * k, sy = cyFace - (y2 + pivotY - 0.1) * unit * k;
        const mdx = sx - mouse.px, mdy = sy - mouse.py, d2 = mdx * mdx + mdy * mdy, rad = 100;
        if (d2 < rad * rad) { const d = Math.sqrt(d2) || 1, f = (1 - d / rad) * 6; DX[i] += (mdx / d) * f; DY[i] += (mdy / d) * f; }
        DX[i] *= 0.88; DY[i] *= 0.88; sx += DX[i]; sy += DY[i];
        if (sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20) { KEY[i] = 255; continue; }
        const lit = Math.max(0, nx1 * Lx + ny2 * Ly + nz2 * Lz);
        const rim = Math.pow(1 - Math.abs(nz2), 2.2);
        const front = nz2 > -0.05;
        if (i < nS) {
          const level = Math.round(clamp(0.08 + lit * 0.78 + rim * 0.45, 0, 1) * (LV - 1));
          if (!front && (i & 3) !== 0) { KEY[i] = 255; continue; }
          KEY[i] = front ? level : LV + level;
        } else {
          const level = Math.round(clamp(0.1 + lit * 0.7 + all.S[i] * 0.35, 0, 1) * (LV - 1));
          KEY[i] = LV * 2 + level;
        }
        SX[i] = sx; SY[i] = sy; counts[KEY[i]]++;
      }
      const starts = new Uint32Array(LV * 3), fill = new Uint32Array(LV * 3);
      let acc = 0; for (let k = 0; k < LV * 3; k++) { starts[k] = acc; acc += counts[k]; }
      for (let i = 0; i < n; i++) { const k = KEY[i]; if (k !== 255) ORDER[starts[k] + fill[k]++] = i; }
      const size = clamp(unit * 0.0092, 1.6, 4), bsize = size * 0.8;
      // glass depth: back of the shell, then the brain, then the front of the shell
      const pass = (from: number, to: number, table: string[], base: number, s: number) => {
        for (let k = from; k < to; k++) {
          if (!counts[k]) continue;
          ctx.fillStyle = table[k - base];
          for (let q = starts[k], end = starts[k] + counts[k]; q < end; q++) { const i = ORDER[q]; ctx.fillRect(SX[i] - s / 2, SY[i] - s / 2, s, s); }
        }
      };
      pass(LV, LV * 2, shellBack, LV, size);
      pass(LV * 2, LV * 3, brainCol, LV * 2, bsize);
      pass(0, LV, shellFront, 0, size);
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; t += dt; draw(t);
    };
    const start = () => { cancelAnimationFrame(raf); last = 0; if (reduced.matches) draw(1.2); else raf = requestAnimationFrame(loop); };
    const move = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.px = e.clientX - r.left; mouse.py = e.clientY - r.top; mouse.ty = clamp(mouse.py / r.height, 0, 1);
    };
    const leave = () => { mouse.px = mouse.py = -9999; };
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0 });
    const ro = new ResizeObserver(() => { resize(); if (reduced.matches) draw(1.2); });
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
