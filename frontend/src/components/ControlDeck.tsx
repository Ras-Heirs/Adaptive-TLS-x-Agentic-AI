import React, { useEffect, useRef, useState } from 'react';
import { downloadCsv, fmtClock } from '../utils/csv';
import { titleCase, toEnglishReason } from '../utils/translate';
import type {
  AgentMessageRecord, AuditLogRecord, AxisId, SignalAxisState,
  SpawnDirOption, VehicleType,
} from '../types/simulator';

// Tampilan saja. Semua aksi tetap memanggil handler yang sama dari App.

const COLOR: Record<string, { text: string; cls: string; hex: string }> = {
  GREEN: { text: 'Green', cls: 'c-green', hex: '#6fe0a8' },
  YELLOW: { text: 'Yellow', cls: 'c-yellow', hex: '#f4cc78' },
  RED: { text: 'Red', cls: 'c-red', hex: '#ff8170' },
};

const AXIS: Record<AxisId, { route: string; options: { value: SpawnDirOption; label: string }[] }> = {
  A: {
    route: 'North — South',
    options: [
      { value: 'BOTH', label: 'North & South' },
      { value: 'N', label: 'From North' },
      { value: 'S', label: 'From South' },
    ],
  },
  B: {
    route: 'West — East',
    options: [
      { value: 'BOTH', label: 'West & East' },
      { value: 'W', label: 'From West' },
      { value: 'E', label: 'From East' },
    ],
  },
};

const secs = (ms: number) => Math.max(0, Math.floor(ms / 1000));

/** Detak 1 detik untuk teks waktu berjalan (tampilan saja). */
function useSecondTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);
}

// ── kartu simpang A / B ───────────────────────────────────────────────
interface IntersectionCardProps {
  axis: AxisId;
  state: SignalAxisState;
  inView: number;
}

export const IntersectionCard: React.FC<IntersectionCardProps> = ({ axis, state, inView }) => {
  useSecondTick();
  const since = useRef({ color: state.color, at: Date.now() });
  if (since.current.color !== state.color) since.current = { color: state.color, at: Date.now() };
  const elapsed = secs(Date.now() - since.current.at);
  const col = COLOR[state.color] ?? { text: state.color, cls: '', hex: '#999' };
  const isGreen = state.color === 'GREEN';
  const progress = isGreen ? Math.min(1, elapsed / Math.max(1, state.duration)) : Math.min(1, elapsed / 60);
  const R = 46;
  const C = 2 * Math.PI * R;

  return (
    <section className="surface ix" data-signal={state.color} aria-label={`Intersection ${axis}`}>
      <div className="ix-text">
        <span className="eyebrow">Intersection {axis}</span>
        <h3>{AXIS[axis].route}</h3>
        <div className="ix-state">
          <span className="gems" aria-hidden>
            <i className={state.color === 'RED' ? 'on-r' : ''} />
            <i className={state.color === 'YELLOW' ? 'on-y' : ''} />
            <i className={state.color === 'GREEN' ? 'on-g' : ''} />
          </span>
          <b className={col.cls}>{col.text}</b>
          <span>· {isGreen ? `${elapsed} of ${state.duration} s` : `${elapsed} s`}</span>
        </div>
        <p className="ix-reason" title={toEnglishReason(state.reason)}>
          <span className="ix-src">{isGreen ? `Green ${state.duration} s` : `Next Green ${state.duration} s`} · {titleCase(state.source)}</span>
          {toEnglishReason(state.reason)}
        </p>
      </div>
      <div className="ring" aria-label={`${inView} vehicles in camera view`}>
        <svg viewBox="0 0 104 104" aria-hidden>
          <circle cx="52" cy="52" r={R} className="ring-track" />
          <circle
            cx="52" cy="52" r={R} className="ring-value"
            style={{ stroke: col.hex, strokeDasharray: `${Math.max(2, progress * C)} ${C}` }}
            transform="rotate(-90 52 52)"
          />
        </svg>
        <div className="ring-c"><b>{inView}</b><span>In View</span></div>
      </div>
    </section>
  );
};

// ── injeksi kendaraan & sensor ────────────────────────────────────────
interface InjectionCardProps {
  camCounts: Record<AxisId, number>;
  onInjectVehicle: (axis: AxisId, dirOption: SpawnDirOption, type: VehicleType) => void;
  onInjectBurst: (axis: AxisId, dirOption: SpawnDirOption, count: number) => void;
  onSyncCamera: (axis: AxisId) => void;
  onSendGlitch: (axis: AxisId) => void;
  onClearVehicles: () => void;
  syncLocked?: boolean;
}

export const InjectionCard: React.FC<InjectionCardProps> = ({
  camCounts, onInjectVehicle, onInjectBurst, onSyncCamera, onSendGlitch, onClearVehicles, syncLocked = false,
}) => {
  const [dirs, setDirs] = useState<Record<AxisId, SpawnDirOption>>({ A: 'BOTH', B: 'BOTH' });
  return (
    <section className="surface card" aria-label="Traffic Injection">
      <div className="card-k">
        <b>Traffic Injection</b>
        <button className="link" onClick={onClearVehicles}>Clear Roads</button>
      </div>
      <div className="inject">
        {(['A', 'B'] as AxisId[]).map((axis) => (
          <div className="inject-row" key={axis}>
            <span className="axis-badge">{axis}</span>
            <select
              className="select" value={dirs[axis]} aria-label={`Spawn direction for Intersection ${axis}`}
              onChange={(e) => setDirs((d) => ({ ...d, [axis]: e.target.value as SpawnDirOption }))}
            >
              {AXIS[axis].options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button className="btn btn-soft" onClick={() => onInjectVehicle(axis, dirs[axis], 'CAR')} title="Add one car">+1 Car</button>
            <button className="btn btn-soft" onClick={() => onInjectBurst(axis, dirs[axis], 8)} title="Add eight vehicles at once">+8 Jam</button>
            <button className="btn btn-alert" onClick={() => onInjectVehicle(axis, dirs[axis], 'AMBULANCE')}>Ambulance</button>
            <button className="btn btn-alert" onClick={() => onInjectVehicle(axis, dirs[axis], 'DAMKAR')}>Fire Truck</button>
          </div>
        ))}
        <div className="inject-sync">
          {(['A', 'B'] as AxisId[]).map((axis) => (
            <button
              key={axis} className="btn btn-outline" disabled={syncLocked}
              title={syncLocked ? 'Paused while manual control is active' : `Send ${camCounts[axis]} detected vehicles to Agent ${axis}`}
              onClick={() => onSyncCamera(axis)}
            >Send to Agent {axis}</button>
          ))}
          {(['A', 'B'] as AxisId[]).map((axis) => (
            <button
              key={`g${axis}`} className="btn btn-ghost" disabled={syncLocked}
              title="Send an invalid sensor value (−99) to test the SafetyGuard"
              onClick={() => onSendGlitch(axis)}
            >Sensor Fault {axis}</button>
          ))}
        </div>
        {syncLocked && <p className="note-inline">Manual control is active — camera data is not being sent to the agents.</p>}
      </div>
    </section>
  );
};

// ── log sistem ────────────────────────────────────────────────────────
interface LogCardProps {
  agentMessages: AgentMessageRecord[];
  auditLogs: AuditLogRecord[];
}

export const LogCard: React.FC<LogCardProps> = ({ agentMessages, auditLogs }) => {
  const [tab, setTab] = useState<'messages' | 'audit'>('messages');
  const exportLogs = () => downloadCsv('atls_log', [
    {
      title: 'Agent Messages',
      header: ['time', 'sender', 'receiver', 'type', 'status'],
      rows: agentMessages.map((m) => [fmtClock(m.createdAt), m.senderId, m.receiverId, m.messageType, m.status]),
    },
    {
      title: 'Audit Log',
      header: ['time', 'action', 'entity_type', 'entity_id'],
      rows: auditLogs.map((l) => [fmtClock(l.createdAt), l.action, l.entityType, l.entityId]),
    },
  ]);
  return (
    <section className="surface card log-card" aria-label="System Log">
      <div className="card-k">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'messages'} onClick={() => setTab('messages')}>
            Agent Messages <span>{agentMessages.length}</span>
          </button>
          <button role="tab" aria-selected={tab === 'audit'} onClick={() => setTab('audit')}>
            Audit Log <span>{auditLogs.length}</span>
          </button>
        </div>
        <button className="link" onClick={exportLogs} disabled={!agentMessages.length && !auditLogs.length}>Export CSV</button>
      </div>
      <div className="feed">
        {tab === 'messages' ? (
          agentMessages.length === 0 ? <p className="empty">No coordination messages yet.</p> : (
            agentMessages.slice(0, 40).map((m) => (
              <div key={m.id} className="feed-row">
                <span className="t">{fmtClock(m.createdAt)}</span>
                <span><b>{m.senderId}</b> → {m.receiverId} <em>{m.messageType}</em></span>
                <span className={`pill ${m.status === 'PENDING' ? 'pill-wait' : 'pill-ok'}`}>{m.status}</span>
              </div>
            ))
          )
        ) : (
          auditLogs.length === 0 ? <p className="empty">No audit entries yet.</p> : (
            auditLogs.slice(0, 40).map((l) => (
              <div key={l.id} className="feed-row">
                <span className="t">{fmtClock(l.createdAt)}</span>
                <span><b>{l.action}</b> · Intersection {l.entityId}</span>
                <span className="pill">{l.entityType}</span>
              </div>
            ))
          )
        )}
      </div>
    </section>
  );
};
