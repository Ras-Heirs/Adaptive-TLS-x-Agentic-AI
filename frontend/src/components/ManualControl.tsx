import { useEffect, useState } from 'react';
import type { FC } from 'react';
import type { AxisId, SignalAxisState } from '../types/simulator';

export interface ManualSession {
  axis: AxisId;
  duration: number;
  reason: string;
  startedAt: number;
  until: number;
}

interface ManualControlProps {
  axisState: Record<AxisId, SignalAxisState>;
  session: ManualSession | null;
  busy: boolean;
  error: string | null;
  onApply: (axis: AxisId, duration: number, reason: string) => void;
  onRelease: () => void;
}

const MIN = 15; // batas SafetyGuard di backend
const MAX = 90;
const PRESETS = [15, 30, 45, 60, 90];
const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// Panel operator: paksa hijau A/B lewat endpoint override yang sudah ada.
export const ManualControl: FC<ManualControlProps> = ({ session, busy, error, onApply, onRelease }) => {
  const [duration, setDuration] = useState(30);
  const [reason, setReason] = useState('Manual Operator Adjustment');
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!session) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 250);
    return () => window.clearInterval(t);
  }, [session]);

  const remaining = session ? session.until - Date.now() : 0;
  const progress = session ? Math.min(1, Math.max(0, remaining / (session.until - session.startedAt))) : 0;
  const reasonOk = reason.trim().length >= 3;

  return (
    <section className={`surface op${session ? ' is-manual' : ''}`} aria-label="Manual Control">
      <div className="op-head">
        <span className="eyebrow">Manual Control</span>
        {session
          ? <span className="mode mode-manual">Manual · {mmss(remaining)}</span>
          : <span className="mode mode-auto"><i />Automatic</span>}
      </div>
      <h4>{session ? `Green Forced to ${session.axis}` : 'Force Green Light'}</h4>

      {session && (
        <div className="op-progress" aria-label="Time remaining">
          <i style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      <div className="durs" role="group" aria-label="Green duration in seconds">
        {PRESETS.map((v) => (
          <button key={v} aria-pressed={duration === v} onClick={() => setDuration(v)}>{v}</button>
        ))}
      </div>

      <label className="op-reason">
        <span>Reason</span>
        <input
          value={reason} maxLength={120} onChange={(e) => setReason(e.target.value)}
          placeholder="Recorded in the audit log" aria-label="Reason (recorded in the audit log)"
        />
      </label>

      <div className="op-btns">
        {(['A', 'B'] as AxisId[]).map((axis, i) => (
          <button
            key={axis}
            className={`btn ${i === 0 ? 'btn-gold' : 'btn-outline-gold'}${session?.axis === axis ? ' is-on' : ''}`}
            disabled={busy || !reasonOk}
            onClick={() => onApply(axis, duration, reason.trim())}
          >
            {session?.axis === axis ? `Reapply ${axis}` : `Force Green ${axis}`}
          </button>
        ))}
      </div>

      {!reasonOk && <p className="op-hint">Reason must be at least 3 characters.</p>}
      {error && <p className="op-error" role="alert">{error}</p>}
      <div className="op-foot">
        <span className="op-hint">{MIN}–{MAX} s, limited by the SafetyGuard. The other intersection turns red.</span>
        {session && <button className="link" onClick={onRelease}>Return to Agent</button>}
      </div>
    </section>
  );
};
