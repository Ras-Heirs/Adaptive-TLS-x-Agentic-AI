import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { FC } from 'react';
import { createPortal } from 'react-dom';
import { getConnectionState, subscribeConnection } from '../services/connectionStatus';

const fmtAgo = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s ago`;
  return `${Math.floor(s / 60)} min ago`;
};

// Lencana status backend di bilah atas + notifikasi saat koneksi putus/pulih.
export const ConnectionBadge: FC = () => {
  const conn = useSyncExternalStore(subscribeConnection, getConnectionState);
  const [, setTick] = useState(0);
  const [toast, setToast] = useState<{ kind: 'down' | 'up'; text: string } | null>(null);
  const prevPhase = useRef(conn.phase);

  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const prev = prevPhase.current;
    prevPhase.current = conn.phase;
    if (conn.phase === prev) return;
    if (conn.phase === 'offline') {
      setToast({ kind: 'down', text: 'The backend is not responding. Make sure "npm run dev" is running in the project root (port 3000).' });
    } else if (conn.phase === 'online' && prev === 'offline') {
      setToast({ kind: 'up', text: 'Backend connection restored.' });
    }
  }, [conn.phase]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), toast.kind === 'down' ? 7000 : 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const label = conn.phase === 'online' ? 'Connected' : conn.phase === 'offline' ? 'Disconnected' : 'Connecting…';
  const detail = conn.phase === 'online'
    ? `${conn.latencyMs ?? '–'} ms`
    : conn.phase === 'offline' && conn.lastOkAt
      ? `Last OK ${fmtAgo(Date.now() - conn.lastOkAt)}`
      : '';
  const title = [
    conn.lastError ? `Last error: ${conn.lastError}` : 'No errors so far',
    conn.lastOkAt ? `Last successful response: ${new Date(conn.lastOkAt).toLocaleTimeString('en-GB')}` : '',
  ].filter(Boolean).join('\n');

  return (
    <>
      <span className={`conn conn-${conn.phase}`} title={title} role="status">
        <i aria-hidden />
        {label}
        {detail && <span className="conn-detail">· {detail}</span>}
      </span>
      {toast && createPortal(
        <div className={`toast toast-${toast.kind}`} role="alert" onClick={() => setToast(null)}>
          <i aria-hidden />
          {toast.text}
        </div>,
        document.body,
      )}
    </>
  );
};
