import { useEffect, useRef } from "react";

/**
 * Animated deep-space backdrop: three parallax star layers drifting slowly,
 * twinkling, the occasional shooting star, breathing nebula clouds and a
 * gentle mouse parallax. Falls back to a static field for reduced motion.
 */

type Star = { x: number; y: number; r: number; base: number; speed: number; phase: number; hue: number; sat: number };
type Shooter = { x: number; y: number; vx: number; vy: number; life: number; max: number };

const LAYERS = [
  { count: 110, size: [0.3, 0.9], drift: 0.004, parallax: 6 },
  { count: 55, size: [0.7, 1.4], drift: 0.009, parallax: 14 },
  { count: 18, size: [1.2, 2.1], drift: 0.016, parallax: 26 },
] as const;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

const StarField = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, dpr = 1, raf = 0, last = performance.now();
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const shooters: Shooter[] = [];
    let nextShooter = performance.now() + rand(2500, 6000);

    const layers: Star[][] = LAYERS.map((l) =>
      Array.from({ length: l.count }, () => {
        const pick = Math.random();
        return {
          x: Math.random(),
          y: Math.random(),
          r: rand(l.size[0], l.size[1]),
          base: rand(0.25, 0.85),
          speed: rand(0.6, 1.8),
          phase: Math.random() * Math.PI * 2,
          hue: pick > 0.75 ? 42 : pick > 0.45 ? 220 : 0,
          sat: pick > 0.75 ? 70 : pick > 0.45 ? 40 : 0,
        };
      }),
    );

    const resize = () => {
      if (reduced) requestAnimationFrame((n) => draw(n));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const onMove = (e: PointerEvent) => {
      mouse.tx = (e.clientX / w - 0.5) * 2;
      mouse.ty = (e.clientY / h - 0.5) * 2;
    };

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      mouse.x += (mouse.tx - mouse.x) * 0.04;
      mouse.y += (mouse.ty - mouse.y) * 0.04;

      ctx.clearRect(0, 0, w, h);
      const t = now / 1000;

      layers.forEach((stars, li) => {
        const L = LAYERS[li];
        const ox = -mouse.x * L.parallax;
        const oy = -mouse.y * L.parallax;
        for (const s of stars) {
          if (!reduced) {
            s.x -= L.drift * dt * 0.25;
            if (s.x < -0.01) s.x += 1.02;
          }
          const tw = reduced ? 1 : 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);
          const a = s.base * tw;
          const px = s.x * w + ox;
          const py = s.y * h + oy;
          ctx.beginPath();
          ctx.fillStyle = `hsla(${s.hue} ${s.sat}% 88% / ${a})`;
          ctx.arc(px, py, s.r, 0, Math.PI * 2);
          ctx.fill();
          if (li === 2 && a > 0.5) {
            // soft glow + cross flare on the brightest, closest stars
            const g = ctx.createRadialGradient(px, py, 0, px, py, s.r * 6);
            g.addColorStop(0, `hsla(${s.hue} ${s.sat}% 85% / ${a * 0.35})`);
            g.addColorStop(1, "hsla(0 0% 100% / 0)");
            ctx.fillStyle = g;
            ctx.fillRect(px - s.r * 6, py - s.r * 6, s.r * 12, s.r * 12);
            ctx.strokeStyle = `hsla(${s.hue} ${s.sat}% 90% / ${a * 0.25})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(px - s.r * 5, py);
            ctx.lineTo(px + s.r * 5, py);
            ctx.moveTo(px, py - s.r * 5);
            ctx.lineTo(px, py + s.r * 5);
            ctx.stroke();
          }
        }
      });

      if (!reduced) {
        if (now > nextShooter) {
          const fromLeft = Math.random() > 0.5;
          const speed = rand(700, 1100);
          const angle = rand(0.25, 0.55);
          shooters.push({
            x: fromLeft ? rand(-0.1, 0.5) * w : rand(0.5, 1.1) * w,
            y: rand(-0.05, 0.35) * h,
            vx: (fromLeft ? 1 : -1) * Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0,
            max: rand(0.7, 1.2),
          });
          nextShooter = now + rand(4000, 9000);
        }
        for (let i = shooters.length - 1; i >= 0; i--) {
          const s = shooters[i];
          s.life += dt;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          const p = s.life / s.max;
          if (p >= 1) {
            shooters.splice(i, 1);
            continue;
          }
          const fade = Math.sin(p * Math.PI);
          const tail = 0.12;
          const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * tail, s.y - s.vy * tail);
          grad.addColorStop(0, `hsla(42 90% 80% / ${0.9 * fade})`);
          grad.addColorStop(1, "hsla(42 90% 80% / 0)");
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.4;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x - s.vx * tail, s.y - s.vy * tail);
          ctx.stroke();
        }
      }

      if (!reduced && !document.hidden) raf = requestAnimationFrame(draw);
    };

    const onVisibility = () => {
      if (!document.hidden && !reduced) {
        last = performance.now();
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(draw);
      }
    };

    resize();
    draw(performance.now());
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="nebula nebula-a" />
      <div className="nebula nebula-b" />
      <div className="nebula nebula-c" />
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
};

export default StarField;
