import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export interface ConfettiHandle { burst(x: number, y: number, colors: string[], count?: number): void }

interface P { x: number; y: number; vx: number; vy: number; r: number; vr: number; c: string; life: number; w: number; h: number }

export const Confetti = forwardRef<ConfettiHandle>(function Confetti(_, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const parts = useRef<P[]>([]);
  const raf = useRef(0);

  const loop = () => {
    const cv = canvas.current;
    if (!cv) return;
    const g = cv.getContext('2d')!;
    g.clearRect(0, 0, cv.width, cv.height);
    const dpr = window.devicePixelRatio || 1;
    parts.current = parts.current.filter((p) => p.life > 0 && p.y < cv.height / dpr + 40);
    for (const p of parts.current) {
      p.vy += 0.25; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= 1;
      g.save();
      g.setTransform(dpr, 0, 0, dpr, p.x * dpr, p.y * dpr);
      g.rotate(p.r);
      g.globalAlpha = Math.min(1, p.life / 40);
      g.fillStyle = p.c;
      g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
      g.restore();
    }
    raf.current = parts.current.length ? requestAnimationFrame(loop) : 0;
  };

  useImperativeHandle(ref, () => ({
    burst(x, y, colors, count = 90) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 9;
        parts.current.push({
          x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
          c: colors[i % colors.length], life: 90 + Math.random() * 60, w: 6 + Math.random() * 6, h: 8 + Math.random() * 8,
        });
      }
      if (!raf.current) raf.current = requestAnimationFrame(loop);
    },
  }));

  useEffect(() => {
    const size = () => {
      const cv = canvas.current!; const dpr = window.devicePixelRatio || 1;
      cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    };
    size();
    addEventListener('resize', size);
    return () => { removeEventListener('resize', size); cancelAnimationFrame(raf.current); };
  }, []);

  return <canvas ref={canvas} className="confetti" />;
});
