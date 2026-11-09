import React, { useState } from 'react';
import type {
  AgentMessageRecord, AuditLogRecord, AxisId, SignalAxisState,
  SpawnDirOption, VehicleType,
} from '../types/simulator';

interface ControlDeckProps {
  axisState: Record<AxisId, SignalAxisState>;
  camCounts: Record<AxisId, number>;
  agentMessages: AgentMessageRecord[];
  auditLogs: AuditLogRecord[];
  onInjectVehicle: (axis: AxisId, dirOption: SpawnDirOption, type: VehicleType) => void;
  onInjectBurst: (axis: AxisId, dirOption: SpawnDirOption, count: number) => void;
  onSyncCamera: (axis: AxisId) => void;
  onSendGlitch: (axis: AxisId) => void;
  onClearVehicles: () => void;
}

export const ControlDeck: React.FC<ControlDeckProps> = ({
  axisState, camCounts, agentMessages, auditLogs,
  onInjectVehicle, onInjectBurst, onSyncCamera, onSendGlitch, onClearVehicles,
}) => {
  const [dirA, setDirA] = useState<SpawnDirOption>('BOTH');
  const [dirB, setDirB] = useState<SpawnDirOption>('BOTH');

  const getBadgeStyle = (color: string) => {
    if (color === 'GREEN') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    if (color === 'YELLOW') return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  };

  const renderAxisPanel = (axis: AxisId) => {
    const isA = axis === 'A';
    const direction = isA ? dirA : dirB;
    const setDirection = isA ? setDirA : setDirB;
    const state = axisState[axis];
    const directions = isA
      ? [{ value: 'BOTH', label: 'Utara & Selatan (Acak)' }, { value: 'N', label: 'Dari Utara (Menuju Selatan)' }, { value: 'S', label: 'Dari Selatan (Menuju Utara)' }]
      : [{ value: 'BOTH', label: 'Barat & Timur (Acak)' }, { value: 'W', label: 'Dari Barat (Menuju Timur)' }, { value: 'E', label: 'Dari Timur (Menuju Barat)' }];

    return (
      <div className="neon-card rounded-xl p-4 flex flex-col gap-2.5">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2 gap-2">
          <div>
            <h2 className="text-sm md:text-base font-bold text-white">🛣️ Poros Simpang {axis} ({isA ? 'Utara & Selatan' : 'Barat & Timur'})</h2>
            <p className="text-[11px] font-mono text-slate-400">
              Total Deteksi Kamera {axis}: <span className="text-sky-400 font-bold">{camCounts[axis]}</span> mobil
              (<span>{camCounts[axis] * 5}</span> beban sensor)
            </p>
          </div>
          <div className="text-right font-mono shrink-0">
            <span className={`px-2.5 py-1 rounded text-xs font-bold border ${getBadgeStyle(state.color)}`}>{state.color}</span>
            <p className="text-xs text-slate-400 mt-1">Durasi: <span className="text-white font-bold">{state.duration}s</span> (<span className="text-sky-400">{state.source}</span>)</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="text-slate-400">Arah Muncul:</span>
          <select value={direction} onChange={(e) => setDirection(e.target.value as SpawnDirOption)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs">
            {directions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
          <button onClick={() => onInjectVehicle(axis, direction, 'CAR')} className="bg-slate-800 hover:bg-slate-700 border border-slate-600 py-2 rounded text-white">🚗 +1 Mobil</button>
          <button onClick={() => onInjectBurst(axis, direction, 8)} className="bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/50 py-2 rounded text-sky-300 font-bold">🚙 +8 Macet</button>
          <button onClick={() => onInjectVehicle(axis, direction, 'AMBULANCE')} className="bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500 py-2 rounded text-rose-200 font-bold">🚨 Ambulans</button>
          <button onClick={() => onInjectVehicle(axis, direction, 'DAMKAR')} className="bg-orange-600/30 hover:bg-orange-600/50 border border-orange-500 py-2 rounded text-orange-200 font-bold">🚒 Damkar</button>
        </div>

        <div className="flex gap-2">
          <button onClick={() => onSyncCamera(axis)} className="flex-1 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold py-1.5 rounded text-xs font-mono">📡 Evaluasi Kamera {axis} ke Agent</button>
          <button onClick={() => onSendGlitch(axis)} className="bg-rose-950 hover:bg-rose-900 border border-rose-700 text-rose-300 px-3 py-1.5 rounded text-xs font-mono">⚠️ Sensor Error (-99)</button>
        </div>
        <p className="text-[11px] font-mono text-slate-300 bg-slate-950 p-2 rounded border border-slate-800">{state.reason}</p>
      </div>
    );
  };

  return (
    <div className="xl:col-span-5 flex flex-col gap-3.5">
      {renderAxisPanel('A')}
      {renderAxisPanel('B')}

      <div className="neon-card rounded-xl p-3.5 flex flex-col gap-2">
        <div className="flex justify-between items-center gap-2">
          <h3 className="text-xs font-bold font-mono text-emerald-400">📡 MULTI-AGENT MESSAGES & AUDIT LOG (NEON DB)</h3>
          <button onClick={onClearVehicles} className="text-[11px] font-mono text-rose-300 hover:text-white underline whitespace-nowrap">🗑️ Kosongkan Jalan</button>
        </div>
        <div className="max-h-28 overflow-y-auto font-mono text-[11px] space-y-1 border-b border-slate-800 pb-1.5">
          {agentMessages.length === 0 ? <p className="text-slate-500">Belum ada pesan koordinasi.</p> : agentMessages.slice(0, 5).map((message) => (
            <div key={message.id} className="flex justify-between gap-2 bg-slate-950 px-2 py-1 rounded border border-slate-800">
              <span><b className="text-sky-400">{message.senderId} ➡️ {message.receiverId}</b> ({message.messageType})</span>
              <span className={message.status === 'PENDING' ? 'text-amber-400' : 'text-emerald-400'}>{message.status}</span>
            </div>
          ))}
        </div>
        <div className="max-h-28 overflow-y-auto font-mono text-[11px] space-y-1">
          {auditLogs.length === 0 && <p className="text-slate-500">Belum ada audit log.</p>}
          {auditLogs.slice(0, 6).map((log) => (
            <div key={log.id} className="bg-slate-950 px-2 py-1 rounded border border-slate-800 flex justify-between gap-2">
              <span><b className="text-emerald-400">[{log.action}]</b> Simpang {log.entityId}</span>
              <span className="text-slate-500">{new Date(log.createdAt).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
