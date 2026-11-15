import { useEffect, useRef, useState } from 'react';
import type { FC } from 'react';
import type { LightColor } from '../types/simulator';

export interface QueueSample { t: number; a: number; b: number; ca: LightColor; cb: LightColor }

interface QueueChartProps { samples: QueueSample[]; spanMs: number }

const SERIES = { A: '#a9c2ec', B: '#dcc7a1' };
const LAMP: Record<string, string> = { GREEN: '#6fe0a8', YELLOW: '#f4cc78', RED: '#ff8170' };
const LAMP_TEXT: Record<string, string> = { GREEN: 'Green', YELLOW: 'Yellow', RED: 'Red' };
const FONT = '"Inter", "Segoe UI", system-ui, sans-serif';
const MONO = '"Inter", "Segoe UI", system-ui, sans-serif';

const niceMax = (v: number) => {
  const steps = [4, 6, 8, 10, 12, 16, 20, 30, 40, 50, 60, 80, 100];
  return steps.find((s) => s >= v) ?? Math.ceil(v / 50) * 50;
};

// Grafik antrean di zona kamera A vs B + pita warna lampu (satu sumbu y).
export const QueueChart: FC<QueueChartProps> = ({ samples, spanMs }) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<{ x: number; s: QueueSample } | null>(null);
  const height = 210;
  const pad = { l: 34, r: 46, t: 14, b: 58 };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const now = samples.length ? samples[samples.length - 1].t : Date.now();
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const xOf = (t: number) => pad.l + plotW - ((now - t) / spanMs) * plotW;
  const maxV = niceMax(Math.max(4, ...samples.map((s) => Math.max(s.a, s.b))));
  const yOf = (v: number) => pad.t + plotH - (v / maxV) * plotH;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // grid & sumbu y
    ctx.font = `500 10.5px ${MONO}`;
    ctx.textAlign = 'right';
    [0, maxV / 2, maxV].forEach((v) => {
      const y = Math.round(yOf(v)) + 0.5;
      ctx.strokeStyle = v === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + plotW, y); ctx.stroke();
      ctx.fillStyle = 'rgba(244,239,230,0.45)';
      ctx.fillText(String(Math.round(v)), pad.l - 8, y + 3.5);
    });

    // pita warna lampu A & B
    const stripY = { A: pad.t + plotH + 12, B: pad.t + plotH + 24 };
    (['A', 'B'] as const).forEach((axis) => {
      ctx.fillStyle = 'rgba(244,239,230,0.45)';
      ctx.font = `600 10px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(axis, pad.l - 8, stripY[axis] + 7);
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(pad.l, stripY[axis], plotW, 8);
      for (let i = 0; i < samples.length; i++) {
        const s = samples[i];
        const x0 = Math.max(pad.l, xOf(s.t));
        const x1 = i + 1 < samples.length ? xOf(samples[i + 1].t) : pad.l + plotW;
        if (x1 <= pad.l) continue;
        ctx.fillStyle = LAMP[axis === 'A' ? s.ca : s.cb] ?? '#444';
        ctx.globalAlpha = 0.85;
        ctx.fillRect(x0, stripY[axis], Math.max(0, x1 - x0 - 0.5), 8);
        ctx.globalAlpha = 1;
      }
    });

    // label sumbu x
    ctx.fillStyle = 'rgba(244,239,230,0.45)';
    ctx.font = `500 10.5px ${FONT}`;
    const ticks = [spanMs, spanMs / 2, 0];
    ticks.forEach((ago, i) => {
      ctx.textAlign = i === 0 ? 'left' : i === ticks.length - 1 ? 'right' : 'center';
      const label = ago === 0 ? 'Now' : `−${Math.round(ago / 60000 * 10) / 10} Min`;
      ctx.fillText(label, xOf(now - ago), height - 10);
    });

    // garis A & B (B putus-putus sebagai pembeda selain warna)
    const visible = samples.filter((s) => xOf(s.t) >= pad.l - 1);
    (['A', 'B'] as const).forEach((axis) => {
      if (visible.length < 2) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(pad.l, 0, plotW, height); ctx.clip();
      // isian gradien lembut di bawah garis
      const base = yOf(0);
      const grad = ctx.createLinearGradient(0, pad.t, 0, base);
      grad.addColorStop(0, axis === 'A' ? 'rgba(169,194,236,0.24)' : 'rgba(220,199,161,0.16)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      visible.forEach((s, i) => {
        const x = xOf(s.t); const y = yOf(axis === 'A' ? s.a : s.b);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.lineTo(xOf(visible[visible.length - 1].t), base);
      ctx.lineTo(xOf(visible[0].t), base);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = SERIES[axis];
      ctx.lineWidth = 1.6; ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.setLineDash(axis === 'B' ? [6, 4] : []);
      ctx.beginPath();
      visible.forEach((s, i) => {
        const x = xOf(s.t); const y = yOf(axis === 'A' ? s.a : s.b);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    });

    // label langsung di ujung garis
    if (visible.length) {
      const last = visible[visible.length - 1];
      let ya = yOf(last.a); let yb = yOf(last.b);
      if (Math.abs(ya - yb) < 13) { const mid = (ya + yb) / 2; if (last.a >= last.b) { ya = mid - 7; yb = mid + 7; } else { ya = mid + 7; yb = mid - 7; } }
      ctx.textAlign = 'left';
      ctx.font = `600 11px ${FONT}`;
      ctx.fillStyle = '#f4efe6';
      ctx.fillText(`A ${last.a}`, pad.l + plotW + 7, ya + 4);
      ctx.fillText(`B ${last.b}`, pad.l + plotW + 7, yb + 4);
      ctx.fillStyle = SERIES.A; ctx.fillRect(pad.l + plotW + 1, ya - 1, 4, 2);
      ctx.fillStyle = SERIES.B; ctx.fillRect(pad.l + plotW + 1, yb - 1, 4, 2);
    }

    // crosshair
    if (hover) {
      const x = Math.round(xOf(hover.s.t)) + 0.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + plotH + 32); ctx.stroke();
      (['A', 'B'] as const).forEach((axis) => {
        const y = yOf(axis === 'A' ? hover.s.a : hover.s.b);
        ctx.fillStyle = '#141312';
        ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = SERIES[axis];
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
      });
    }
  }, [samples, width, hover, maxV, now, spanMs]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!samples.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    let best: QueueSample | null = null; let bestD = Infinity;
    samples.forEach((s) => { const d = Math.abs(xOf(s.t) - mx); if (d < bestD && xOf(s.t) >= pad.l) { bestD = d; best = s; } });
    if (best && bestD < 24) setHover({ x: mx, s: best }); else setHover(null);
  };

  const tipLeft = hover ? Math.min(Math.max(xOf(hover.s.t) + 12, 8), width - 190) : 0;

  return (
    <div className="chart" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        aria-label="Vehicles in camera view for Intersections A and B over the last 2 minutes"
      />
      {hover && (
        <div className="chart-tip" style={{ left: tipLeft, top: 10 }}>
          <div className="chart-tip-time">{new Date(hover.s.t).toLocaleTimeString('en-GB', { hour12: false })}</div>
          <div><span className="key" style={{ background: SERIES.A }} />Intersection A <b>{hover.s.a}</b><em style={{ color: LAMP[hover.s.ca] }}>{LAMP_TEXT[hover.s.ca]}</em></div>
          <div><span className="key key-dash" style={{ borderColor: SERIES.B }} />Intersection B <b>{hover.s.b}</b><em style={{ color: LAMP[hover.s.cb] }}>{LAMP_TEXT[hover.s.cb]}</em></div>
        </div>
      )}
      {samples.length < 2 && <div className="chart-empty">Collecting data…</div>}
    </div>
  );
};

export const SERIES_COLORS = SERIES;
