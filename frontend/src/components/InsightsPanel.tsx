import { useEffect, useMemo, useRef, useState } from 'react';
import type { FC, MutableRefObject } from 'react';
import type { AxisId, Direction, LightColor, SignalAxisState, Vehicle } from '../types/simulator';
import { QueueChart, SERIES_COLORS } from './QueueChart';
import type { QueueSample } from './QueueChart';
import { downloadCsv, fmtClock } from '../utils/csv';
import { toEnglishReason } from '../utils/translate';

// Panel analitik: hanya MEMBACA state yang sudah ada (lampu, hitungan kamera,
// posisi kendaraan). Tidak mengubah kendaraan dan tidak memanggil backend.

interface InsightsPanelProps {
  axisState: Record<AxisId, SignalAxisState>;
  camCounts: Record<AxisId, number>;
  vehiclesRef: MutableRefObject<Vehicle[]>;
}

interface TimelineEntry {
  id: number; t: number; axis: AxisId; color: LightColor;
  duration: number; source: string; reason: string;
}
interface Crossing { t: number; axis: AxisId; dir: Direction; waitMs: number }
interface Tracked { axis: AxisId; dir: Direction; waitMs: number; passed: boolean; seen: number }

const SPAN_MS = 120_000;
const WINDOW_MS = 5 * 60_000;
const COLOR_TEXT: Record<string, string> = { GREEN: 'Green', YELLOW: 'Yellow', RED: 'Red' };
const sec = (ms: number) => (ms / 1000).toFixed(1);

export const InsightsPanel: FC<InsightsPanelProps> = ({ axisState, camCounts, vehiclesRef }) => {
  const latest = useRef({ axisState, camCounts });
  latest.current = { axisState, camCounts };

  const [samples, setSamples] = useState<QueueSample[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [, setTick] = useState(0);
  const tracked = useRef(new Map<number, Tracked>());
  const crossings = useRef<Crossing[]>([]);
  const liveLongest = useRef<Record<AxisId, number>>({ A: 0, B: 0 });
  const totals = useRef<Record<AxisId, number>>({ A: 0, B: 0 });
  const startedAt = useRef(Date.now());
  const seq = useRef(0);
  const lastColors = useRef<Record<AxisId, LightColor | null>>({ A: null, B: null });

  // 1) catat setiap pergantian warna lampu
  useEffect(() => {
    const now = Date.now();
    const added: TimelineEntry[] = [];
    (['A', 'B'] as AxisId[]).forEach((axis) => {
      const st = axisState[axis];
      if (lastColors.current[axis] !== st.color) {
        lastColors.current[axis] = st.color;
        added.push({ id: ++seq.current, t: now, axis, color: st.color, duration: st.duration, source: st.source, reason: st.reason });
      }
    });
    if (added.length) setTimeline((prev) => [...prev, ...added].slice(-400));
  }, [axisState]);

  // 2) sampel grafik tiap 1 detik
  useEffect(() => {
    const timer = window.setInterval(() => {
      const { axisState: st, camCounts: cc } = latest.current;
      const now = Date.now();
      setSamples((prev) => [...prev.filter((s) => now - s.t <= SPAN_MS + 2000), { t: now, a: cc.A, b: cc.B, ca: st.A.color, cb: st.B.color }]);
      setTick((n) => n + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // 3) lacak waktu tunggu & kendaraan yang melewati garis henti (baca saja)
  useEffect(() => {
    let last = performance.now();
    const timer = window.setInterval(() => {
      const nowPerf = performance.now();
      const dt = Math.min(1000, nowPerf - last);
      last = nowPerf;
      const now = Date.now();
      const map = tracked.current;
      const longest: Record<AxisId, number> = { A: 0, B: 0 };
      vehiclesRef.current.forEach((v) => {
        let rec = map.get(v.id);
        if (!rec) { rec = { axis: v.axis, dir: v.dir, waitMs: 0, passed: v.passedStopLine, seen: now }; map.set(v.id, rec); }
        rec.seen = now;
        if (!v.passedStopLine) {
          if (v.speed < 0.3) rec.waitMs += dt;
          longest[v.axis] = Math.max(longest[v.axis], rec.waitMs);
        } else if (!rec.passed) {
          rec.passed = true;
          totals.current[rec.axis] += 1;
          crossings.current.push({ t: now, axis: rec.axis, dir: rec.dir, waitMs: rec.waitMs });
          if (crossings.current.length > 5000) crossings.current.splice(0, 1000);
        }
      });
      map.forEach((rec, id) => { if (rec.seen !== now) map.delete(id); });
      liveLongest.current = longest;
    }, 250);
    return () => window.clearInterval(timer);
  }, [vehiclesRef]);

  const now = Date.now();
  const metrics = useMemo(() => {
    const out = {} as Record<AxisId, { perMin: number; avgWait: number; maxWait: number; n: number }>;
    (['A', 'B'] as AxisId[]).forEach((axis) => {
      const lastMin = crossings.current.filter((c) => c.axis === axis && now - c.t <= 60_000).length;
      const recent = crossings.current.filter((c) => c.axis === axis && now - c.t <= WINDOW_MS);
      const avg = recent.length ? recent.reduce((s, c) => s + c.waitMs, 0) / recent.length : 0;
      const max = recent.reduce((m, c) => Math.max(m, c.waitMs), 0);
      out[axis] = { perMin: lastMin, avgWait: avg, maxWait: max, n: recent.length };
    });
    return out;
  }, [now]);
  const elapsedMin = Math.max(1, (now - startedAt.current) / 60_000);
  const greenShare = useMemo(() => {
    const share: Record<AxisId, number> = { A: 0, B: 0 };
    if (!samples.length) return share;
    share.A = samples.filter((s) => s.ca === 'GREEN').length / samples.length;
    share.B = samples.filter((s) => s.cb === 'GREEN').length / samples.length;
    return share;
  }, [samples]);

  // lama tiap fase = selisih ke pergantian berikutnya pada simpang yang sama
  const phaseLength = (entry: TimelineEntry) => {
    const next = timeline.find((e) => e.axis === entry.axis && e.t > entry.t);
    return (next ? next.t : now) - entry.t;
  };

  const exportCsv = () => {
    downloadCsv('atls_analytics', [
      {
        title: 'Phase History',
        header: ['time', 'intersection', 'color', 'agent_green_duration_s', 'actual_phase_length_s', 'source', 'reason'],
        rows: timeline.map((e) => [fmtClock(e.t), e.axis, COLOR_TEXT[e.color] ?? e.color, e.duration, (phaseLength(e) / 1000).toFixed(1), e.source, toEnglishReason(e.reason)]),
      },
      {
        title: 'Performance Summary (Last 5 Minutes)',
        header: ['intersection', 'vehicles_per_minute', 'average_wait_s', 'longest_wait_s', 'total_passed', 'green_share_2min_percent'],
        rows: (['A', 'B'] as AxisId[]).map((axis) => [
          axis, metrics[axis].perMin, (metrics[axis].avgWait / 1000).toFixed(1), (metrics[axis].maxWait / 1000).toFixed(1),
          totals.current[axis], Math.round(greenShare[axis] * 100),
        ]),
      },
      {
        title: 'Vehicles Crossing the Stop Line',
        header: ['time', 'intersection', 'from', 'wait_s'],
        rows: crossings.current.map((c) => [fmtClock(c.t), c.axis, c.dir, (c.waitMs / 1000).toFixed(1)]),
      },
    ]);
  };

  // gabungan A+B untuk angka utama, rincian per simpang di bawahnya
  const allRecent = crossings.current.filter((c) => now - c.t <= WINDOW_MS);
  const avgAll = allRecent.length ? allRecent.reduce((t, c) => t + c.waitMs, 0) / allRecent.length : 0;
  const kpis: { value: string; unit: string; label: string; split: string; hint: string }[] = [
    {
      value: String(metrics.A.perMin + metrics.B.perMin), unit: '', label: 'Vehicles per Minute',
      split: `A ${metrics.A.perMin} · B ${metrics.B.perMin}`, hint: 'Vehicles crossing the stop line in the last 60 s',
    },
    {
      value: sec(avgAll), unit: 's', label: 'Average Wait',
      split: `A ${sec(metrics.A.avgWait)} · B ${sec(metrics.B.avgWait)}`, hint: 'Time stopped before the stop line, last 5 minutes',
    },
    {
      value: sec(Math.max(metrics.A.maxWait, metrics.B.maxWait)), unit: 's', label: 'Longest Wait',
      split: `Waiting Now ${sec(Math.max(liveLongest.current.A, liveLongest.current.B))} s`, hint: 'Longest single wait in the last 5 minutes',
    },
    {
      value: String(Math.round(greenShare.A * 100)), unit: '%', label: 'Green Share A',
      split: `B ${Math.round(greenShare.B * 100)}% · Total ${totals.current.A + totals.current.B} Passed`, hint: 'Share of the last 2 minutes spent green',
    },
  ];

  const shown = [...timeline].reverse().slice(0, 60);
  const DOT: Record<string, string> = { GREEN: 'dot-g', YELLOW: 'dot-y', RED: 'dot-r' };

  return (
    <section className="insights" aria-label="Analytics">
      <div className="surface card chart-card">
        <div className="card-k">
          <b>Queue at Cameras</b>
          <div className="legend-inline">
            <span><i className="key" style={{ background: SERIES_COLORS.A }} />Intersection A</span>
            <span><i className="key key-dash" style={{ borderColor: SERIES_COLORS.B }} />Intersection B</span>
          </div>
        </div>
        <QueueChart samples={samples} spanMs={SPAN_MS} />
      </div>

      <div className="surface card">
        <div className="card-k">
          <b>Performance</b>
          <span className="eyebrow">Last 5 Min · {Math.floor(elapsedMin)} Min Running</span>
        </div>
        <div className="kpis">
          {kpis.map((k) => (
            <div key={k.label} title={k.hint}>
              <b>{k.value}<small>{k.unit}</small></b>
              <span className="kpi-label">{k.label}</span>
              <span className="kpi-split">{k.split}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="surface card history-card">
        <div className="card-k">
          <b>Phase History</b>
          <button className="link" onClick={exportCsv} title="Export phase history, performance and vehicle data as CSV">Export CSV</button>
        </div>
        <div className="history">
          {shown.length === 0 ? <p className="empty">No phase changes yet.</p> : (
            shown.map((e) => (
              <div key={e.id} className="h-row" title={toEnglishReason(e.reason)}>
                <span className="t">{fmtClock(e.t)}</span>
                <i className={`dot ${DOT[e.color] ?? ''}`} />
                <span className="h-main">
                  <b>{e.axis}</b> {COLOR_TEXT[e.color] ?? e.color}
                  <span className="h-meta"> · Agent {e.duration} s · Actual {sec(phaseLength(e))} s</span>
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};
