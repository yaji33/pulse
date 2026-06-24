"use client";

import { useEffect, useRef } from "react";

const N = 2800;
const TWO_PI = Math.PI * 2;
const CLUSTER_POINTS = 200;
const CLUSTER_CONE = 0.44; // ~25 degrees

type Particle = {
  a: number; // azimuth
  p: number; // polar angle from +Y
  rFactor: number; // off-shell displacement (slightly in/out of surface)
  baseSize: number;
  opacityMod: number;
  driftA: number;
  driftP: number;
};

function makeParticle(a: number, p: number): Particle {
  // Push each point slightly off the perfect sphere so the shell isn't crisp.
  const noiseFactor = 0.04 + Math.random() * 0.08;
  return {
    a,
    p,
    rFactor: 1 - noiseFactor + Math.random() * noiseFactor * 2,
    baseSize: 0.3 + Math.random() * 1.4,
    opacityMod: 0.4 + Math.random() * 0.6,
    driftA: (Math.random() - 0.5) * 0.0004,
    driftP: (Math.random() - 0.5) * 0.0003,
  };
}

function buildParticles(): Particle[] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const particles: Particle[] = [];

  for (let i = 0; i < N; i++) {
    if (Math.random() < 0.18) continue; 
    const y = 1 - (i / (N - 1)) * 2;
    particles.push(makeParticle(goldenAngle * i, Math.acos(y)));
  }

  
  const centers = 1 + Math.floor(Math.random() * 2); 
  for (let c = 0; c <= centers; c++) {
    const ca = Math.random() * TWO_PI;
    const cp = Math.acos(1 - Math.random() * 2);
    const count = Math.floor(CLUSTER_POINTS / (centers + 1));
    for (let k = 0; k < count; k++) {
      particles.push(
        makeParticle(
          ca + (Math.random() - 0.5) * CLUSTER_CONE,
          cp + (Math.random() - 0.5) * CLUSTER_CONE,
        ),
      );
    }
  }

  return particles;
}

export default function GlobeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const el: HTMLCanvasElement = canvas;
    const ctx: CanvasRenderingContext2D = context;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const particles = buildParticles();
    let size = 0;
    let angle = reduce ? 0.6 : 0;
    let raf = 0;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      size = el.getBoundingClientRect().width;
      el.width = Math.round(size * dpr);
      el.height = Math.round(size * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    function draw(now: number) {
      const cx = size / 2;
      const cy = size / 2;
      // Subliminal breathing: 98.8%–101.2% scale.
      const breathe = 1 + Math.sin(now * 0.0004) * 0.012;
      const R = size * 0.48 * breathe;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      ctx.clearRect(0, 0, size, size);

      const frame: { sx: number; sy: number; z: number; size: number; op: number }[] =
        [];

      for (const pt of particles) {
        if (!reduce) {
          pt.a += pt.driftA;
          pt.p += pt.driftP;
        }
        const sp = Math.sin(pt.p);
        const ux = sp * Math.cos(pt.a);
        const uy = Math.cos(pt.p);
        const uz = sp * Math.sin(pt.a);

        // Rotate around Y (unit space keeps depth normalized).
        const ruz = ux * sin + uz * cos;
        const rux = ux * cos - uz * sin;

        const scl = R * pt.rFactor;
        const rx = rux * scl;
        const ry = uy * scl;
        const depth = (ruz + 1) / 2; // 0 far .. 1 near

        let dotRadius = pt.baseSize * (0.5 + depth * 0.9);
        let opacity = (0.08 + depth * 0.55) * pt.opacityMod;

        // Edge densification: brighten + enlarge dots near the silhouette.
        const edgeDist = R - Math.hypot(rx, ry);
        if (edgeDist < 0.15 * R) {
          opacity *= 1.4;
          dotRadius *= 1.2;
        }

        frame.push({
          sx: cx + rx,
          sy: cy + ry,
          z: ruz,
          size: dotRadius,
          op: opacity > 1 ? 1 : opacity,
        });
      }

      // Near-side dots draw on top of far-side ones.
      frame.sort((m, n) => m.z - n.z);

      for (const d of frame) {
        ctx.beginPath();
        ctx.arc(d.sx, d.sy, d.size, 0, TWO_PI);
        ctx.fillStyle = `rgba(255,255,255,${d.op})`;
        ctx.fill();
      }
    }

    if (reduce) {
      draw(0);
    } else {
      const loop = (now: number) => {
        angle += 0.0003;
        draw(now);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="globe-fade"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
