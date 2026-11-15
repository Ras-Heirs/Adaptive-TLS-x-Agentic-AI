import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { FC, MutableRefObject } from 'react';
import type { AxisId, SignalAxisState, Vehicle } from '../types/simulator';
import { getConnectionState, subscribeConnection } from '../services/connectionStatus';

// Jam WIB real-time untuk bilah atas (tampilan saja)
export const LiveClock: FC = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const time = now.toLocaleTimeString('id-ID', { hour12: false, timeZone: 'Asia/Jakarta' }).replace(/\./g, ':');
  const date = now.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'Asia/Jakarta' });
  return (
    <span className="clock mono" title="Waktu Indonesia Barat">
      <span className="clock-date">{date}</span>{time} <span className="clock-tz">WIB</span>
    </span>
  );
};

interface StatusBarProps {
  vehiclesRef: MutableRefObject<Vehicle[]>;
  axisState: Record<AxisId, SignalAxisState>;
  camCounts: Record<AxisId, number>;
  scenarioLabel: string;
  autoSync: boolean;
  manualAxis: AxisId | null;
}

const fmtUptime = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};
const COLOR: Record<string, string> = { GREEN: 'c-green', YELLOW: 'c-yellow', RED: 'c-red' };
const COLOR_TEXT: Record<string, string> = { GREEN: 'HIJAU', YELLOW: 'KUNING', RED: 'MERAH' };

// Bilah status di bawah layar, seperti software ruang kendali (hanya membaca data)
export const StatusBar: FC<StatusBarProps> = ({ vehiclesRef, axisState, camCounts, scenarioLabel, autoSync, manualAxis }) => {
  const conn = useSyncExternalStore(subscribeConnection, getConnectionState);
  const startedAt = useRef(Date.now());
  const [stats, setStats] = useState({ total: 0, waiting: 0, uptime: 0 });

  useEffect(() => {
    const t = window.setInterval(() => {
      const list = vehiclesRef.current;
      setStats({
        total: list.length,
        waiting: list.filter((v) => !v.passedStopLine && v.speed < 0.3).length,
        uptime: Date.now() - startedAt.current,
      });
    }, 500);
    return () => window.clearInterval(t);
  }, [vehiclesRef]);

  return (
    <footer className="statusbar mono" role="contentinfo">
      <span className="sb-cell sb-run"><i />SIM {fmtUptime(stats.uptime)}</span>
      <span className="sb-cell">{scenarioLabel}</span>
      <span className="sb-cell">kendaraan {stats.total} · berhenti {stats.waiting}</span>
      <span className="sb-cell">kamera A {camCounts.A} · B {camCounts.B}</span>
      <span className="sb-cell">
        A <b className={COLOR[axisState.A.color]}>{COLOR_TEXT[axisState.A.color] ?? axisState.A.color}</b> · B <b className={COLOR[axisState.B.color]}>{COLOR_TEXT[axisState.B.color] ?? axisState.B.color}</b>
      </span>
      <span className="sb-cell">{manualAxis ? <b className="c-amber">MANUAL → {manualAxis}</b> : <>mode AUTO · sync {autoSync ? 'ON' : 'OFF'}</>}</span>
      <span className="sb-spacer" />
      <span className={`sb-cell ${conn.phase === 'offline' ? 'c-red' : ''}`}>
        api {conn.phase === 'online' ? `${conn.latencyMs ?? '–'} ms` : conn.phase === 'offline' ? 'TERPUTUS' : '…'}
      </span>
      <span className="sb-cell">[?] panduan</span>
    </footer>
  );
};
