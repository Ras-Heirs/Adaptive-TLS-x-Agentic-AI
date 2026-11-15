import { useEffect, useState } from 'react';
import type { FC } from 'react';

// Jam real-time (WIB) untuk header — tampilan saja.
export const Clock: FC = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Jakarta',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const date = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta',
  }).formatToParts(now);
  const d = (type: string) => date.find((p) => p.type === type)?.value ?? '';

  return (
    <div className="clock" role="timer" aria-label={`${get('hour')}:${get('minute')}:${get('second')} WIB`}>
      <b>{get('hour')}<em>:</em>{get('minute')}<small>{get('second')}</small></b>
      <span>{d('weekday')} · {d('day')} {d('month')} · WIB</span>
    </div>
  );
};
