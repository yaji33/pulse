"use client";

import { useEffect, useRef } from "react";

const N = 2000;
const TWO_PI = Math.PI * 2;

type Vec3 = { x: number; y: number; z: number };

// Fibonacci (golden-angle) sphere: even point distribution with no clustering
// at the poles. Points are unit-length; the draw loop scales them to canvas.
function fibonacciSphere(): Vec3[] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const points: Vec3[] = [];
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = goldenAngle * i;
    points.push({
      x: Math.cos(theta) * radius,
      y,
      z: Math.sin(theta) * radius,
    });
  }
  return points;
}

export default function GlobeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const points = fibonacciSphere();
    let size = 0;
    let angle = reduce ? 0.6 : 0;
    let raf = 0;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      size = canvas.getBoundingClientRect().width;
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); 
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function draw() {
      const cx = size / 2;
      const cy = size / 2;
      const r = size * 0.48;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      ctx.clearRect(0, 0, size, size);

      // Rotate around Y, then project orthographically. Collect depth (z) so
      // we can sort near-side dots on top of far-side ones.
      const frame = points.map((p) => {
        const rz = p.x * sin + p.z * cos;
        return {
          sx: cx + (p.x * cos - p.z * sin) * r,
          sy: cy + p.y * r,
          z: rz, // unit range -1..1
        };
      });
      frame.sort((a, b) => a.z - b.z);

      for (const d of frame) {
        const depth = (d.z + 1) / 2; // 0 (far) .. 1 (near)
        const opacity = 0.08 + depth * 0.55;
        const dotRadius = 0.6 + depth * 0.9;
        ctx.beginPath();
        ctx.arc(d.sx, d.sy, dotRadius, 0, TWO_PI);
        ctx.fillStyle = `rgba(255,255,255,${opacity})`;
        ctx.fill();
      }
    }

    if (reduce) {
      draw();
    } else {
      const loop = () => {
        angle += 0.0003; 
        draw();
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
