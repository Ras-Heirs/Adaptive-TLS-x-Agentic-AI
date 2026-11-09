import React, { useState, useRef, useEffect, useCallback } from 'react';
import type {
  AgentMessageRecord, AuditLogRecord, AxisId, Direction, LightColor,
  ScenarioMode, SignalAxisState, SpawnDirOption, Vehicle, VehicleType,
} from './types/simulator';
import { createVehicle } from './utils/laneGeometry';
import { TrafficApi } from './services/trafficApi';
import { GuideModal } from './components/GuideModal';
import { TrafficCanvas } from './components/TrafficCanvas';
import { ControlDeck } from './components/ControlDeck';

export const App: React.FC = () => {
  const [isGuideOpen, setIsGuideOpen] = useState(true);
  const [scenario, setScenario] = useState<ScenarioMode>('NORMAL');
  const [autoCyclePhase, setAutoCyclePhase] = useState(0);
  const [camZoom, setCamZoom] = useState(0.55);
  const [showBBox, setShowBBox] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [emergencyBanner, setEmergencyBanner] = useState<string | null>(null);
  const [camCounts, setCamCounts] = useState<Record<AxisId, number>>({ A: 0, B: 0 });
  const camCountsRef = useRef<Record<AxisId, number>>({ A: 0, B: 0 });

  const [axisState, setAxisState] = useState<Record<AxisId, SignalAxisState>>({
    A: { color: 'GREEN', duration: 30, source: 'AGENT', reason: 'Menunggu evaluasi kamera Simpang A...' },
    B: { color: 'RED', duration: 30, source: 'AGENT', reason: 'Menunggu evaluasi kamera Simpang B...' },
  });
  const lightStateRef = useRef<Record<AxisId, SignalAxisState>>(axisState);
  const isTransitioningRef = useRef(false);
  const [agentMessages, setAgentMessages] = useState<AgentMessageRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const vehiclesRef = useRef<Vehicle[]>([]);
  const vehicleIdSeqRef = useRef(1);
  const camPanRef = useRef({ x: 0, y: 0 });
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const spawnInDirection = useCallback((dir: Direction, type: VehicleType = 'CAR') => {
    const newVehicle = createVehicle(vehicleIdSeqRef.current++, dir, type, vehiclesRef.current);
    if (newVehicle) vehiclesRef.current.push(newVehicle);
  }, []);

  const applyLightStateWithYellowTransition = useCallback((
    newColorA: LightColor, newColorB: LightColor,
    durA: number, durB: number, srcA: string, srcB: string,
    reasonA: string, reasonB: string,
  ) => {
    const currentA = lightStateRef.current.A.color;
    const currentB = lightStateRef.current.B.color;
    if ((newColorA !== currentA || newColorB !== currentB) && !isTransitioningRef.current) {
      isTransitioningRef.current = true;
      const interimState: Record<AxisId, SignalAxisState> = {
        A: { color: currentA === 'GREEN' ? 'YELLOW' : currentA, duration: durA, source: srcA, reason: reasonA },
        B: { color: currentB === 'GREEN' ? 'YELLOW' : currentB, duration: durB, source: srcB, reason: reasonB },
      };
      lightStateRef.current = interimState;
      setAxisState(interimState);
      window.setTimeout(() => {
        const finalState: Record<AxisId, SignalAxisState> = {
          A: { color: newColorA, duration: durA, source: srcA, reason: reasonA },
          B: { color: newColorB, duration: durB, source: srcB, reason: reasonB },
        };
        lightStateRef.current = finalState;
        setAxisState(finalState);
        isTransitioningRef.current = false;
      }, 1800);
    } else if (!isTransitioningRef.current) {
      const nextState: Record<AxisId, SignalAxisState> = {
        A: { color: newColorA, duration: durA, source: srcA, reason: reasonA },
        B: { color: newColorB, duration: durB, source: srcB, reason: reasonB },
      };
      lightStateRef.current = nextState;
      setAxisState(nextState);
    }
  }, []);

  const refreshBackendState = useCallback(async () => {
    try {
      const { intJson, logJson } = await TrafficApi.fetchSystemState();
      if (intJson.success && Array.isArray(intJson.data)) {
        let colA = lightStateRef.current.A.color;
        let colB = lightStateRef.current.B.color;
        let durA = lightStateRef.current.A.duration;
        let durB = lightStateRef.current.B.duration;
        let srcA = lightStateRef.current.A.source;
        let srcB = lightStateRef.current.B.source;
        let reasonA = lightStateRef.current.A.reason;
        let reasonB = lightStateRef.current.B.reason;

        intJson.data.forEach((item: any) => {
          if (item.trafficLightState) {
            if (item.id === 'A') {
              colA = item.trafficLightState.color;
              durA = item.trafficLightState.greenDuration;
            }
            if (item.id === 'B') {
              colB = item.trafficLightState.color;
              durB = item.trafficLightState.greenDuration;
            }
          }
          if (item.decisions?.[0]) {
            if (item.id === 'A') {
              srcA = item.decisions[0].source;
              reasonA = item.decisions[0].reason;
            }
            if (item.id === 'B') {
              srcB = item.decisions[0].source;
              reasonB = item.decisions[0].reason;
            }
          }
        });

        applyLightStateWithYellowTransition(
          colA, colB, durA, durB, srcA, srcB, reasonA, reasonB,
        );
      }
      if (logJson.success) {
        setAgentMessages(logJson.data.agentMessages || []);
        setAuditLogs(logJson.data.auditLogs || []);
      }
    } catch (error) {
      console.error('Gagal mengambil status backend:', error);
    }
  }, [applyLightStateWithYellowTransition]);

  const handleSyncCamera = useCallback(async (axis: AxisId) => {
    const vehicleCount = camCountsRef.current[axis] * 5;
    try {
      await TrafficApi.sendSensorData(axis, vehicleCount);
      await refreshBackendState();
    } catch (error) {
      console.error('Gagal mengirim data kamera:', error);
    }
  }, [refreshBackendState]);

  const handleSendGlitch = useCallback(async (axis: AxisId) => {
    try {
      await TrafficApi.sendSensorData(axis, -99);
      await refreshBackendState();
    } catch (error) {
      console.error('Gagal mengirim simulasi sensor error:', error);
    }
  }, [refreshBackendState]);

  const handleEmergencyDetected = useCallback(async (
    axis: AxisId, type: VehicleType, dir: Direction,
  ) => {
    setEmergencyBanner(`🚨 AI CAMERA (${dir}) DETECTED ${type} — PRIORITAS SIMPANG ${axis}!`);
    if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = window.setTimeout(() => setEmergencyBanner(null), 6500);
    try {
      const response = await TrafficApi.sendEmergencyOverride(axis, type, dir);
      if (response.success) await refreshBackendState();
    } catch (error) {
      console.error('Emergency Override Error:', error);
    }
  }, [refreshBackendState]);

  useEffect(() => {
    void refreshBackendState();
    (['N', 'S', 'W', 'E'] as Direction[]).forEach((direction) => spawnInDirection(direction, 'CAR'));
    return () => {
      if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
    };
  }, [refreshBackendState, spawnInDirection]);

  useEffect(() => {
    if (scenario === 'CUSTOM') return;
    const modes: ScenarioMode[] = ['NORMAL', 'RUSH_HOUR', 'NIGHT'];
    const activeProfile = scenario === 'AUTO_CYCLE'
      ? modes[autoCyclePhase % modes.length]
      : scenario;
    const intervals: Record<string, number> = {
      RUSH_HOUR: 700, NORMAL: 1700, NIGHT: 3800,
    };
    const timer = window.setInterval(() => {
      const dirs: Direction[] = ['N', 'S', 'W', 'E'];
      const randomDir = dirs[Math.floor(Math.random() * dirs.length)];
      const type: VehicleType = Math.random() < 0.18 ? 'TRUCK' : 'CAR';
      spawnInDirection(randomDir, type);
      if (activeProfile === 'RUSH_HOUR' && Math.random() < 0.5) {
        spawnInDirection(Math.random() > 0.4 ? 'N' : 'W', 'CAR');
      }
    }, intervals[activeProfile] || 1700);
    return () => window.clearInterval(timer);
  }, [scenario, autoCyclePhase, spawnInDirection]);

  useEffect(() => {
    const timer = window.setInterval(() => setAutoCyclePhase((phase) => phase + 1), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const nextSyncAxisRef = useRef<AxisId>('A');
  useEffect(() => {
    if (!autoSync) return;
    const timer = window.setInterval(() => {
      void handleSyncCamera(nextSyncAxisRef.current);
      nextSyncAxisRef.current = nextSyncAxisRef.current === 'A' ? 'B' : 'A';
    }, 4000);
    return () => window.clearInterval(timer);
  }, [autoSync, handleSyncCamera]);

  const handleInjectVehicle = (axis: AxisId, dirOption: SpawnDirOption, type: VehicleType) => {
    const dir: Direction = dirOption === 'BOTH'
      ? axis === 'A'
        ? (Math.random() > 0.5 ? 'N' : 'S')
        : (Math.random() > 0.5 ? 'W' : 'E')
      : dirOption;
    spawnInDirection(dir, type);
  };

  const handleInjectBurst = (axis: AxisId, dirOption: SpawnDirOption, count: number) => {
    const dirs: Direction[] = axis === 'A' ? ['N', 'S'] : ['W', 'E'];
    for (let i = 0; i < count; i++) {
      const dir = dirOption === 'BOTH' ? dirs[i % 2] : dirOption;
      spawnInDirection(dir, i % 4 === 0 ? 'TRUCK' : 'CAR');
    }
  };

  const getScenarioStatusLabel = () => {
    if (scenario === 'AUTO_CYCLE') {
      const names = ['Siang Normal', 'Jam Sibuk (Rush Hour)', 'Jam Kosong (Malam)'];
      return `Mode: Siklus Otomatis -> ${names[autoCyclePhase % names.length]}`;
    }
    const labels: Record<ScenarioMode, string> = {
      NORMAL: 'Mode: Siang Normal',
      RUSH_HOUR: 'Mode: Jam Sibuk / Rush Hour',
      NIGHT: 'Mode: Jam Kosong / Malam',
      AUTO_CYCLE: '',
      CUSTOM: 'Mode: Custom Scenario (Trafik Otomatis Nonaktif — Manual)',
    };
    return labels[scenario];
  };

  return (
    <div className="p-3 md:p-5 min-h-screen flex flex-col gap-4">
      <GuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />

      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b border-slate-800 pb-3 gap-3">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="bg-amber-500 text-slate-950 font-black px-2.5 py-0.5 rounded text-xs font-mono">DL-2121RM x AI VISION</span>
            <h1 className="text-lg md:text-2xl font-bold text-sky-400">4-Way Adaptive Traffic Light & Camera Supervision Simulator</h1>
          </div>
          <p className="text-[11px] font-mono text-slate-400 mt-0.5">Multi-Agent Coordination + SafetyGuard + Strict 2-Way Lane Discipline (React + TS Modular)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setIsGuideOpen(true)} className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-3 py-1.5 rounded font-mono shadow">📖 Buka Note Panduan</button>
          <label className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-2.5 py-1.5 rounded text-xs font-mono cursor-pointer">
            <input type="checkbox" checked={showBBox} onChange={(e) => setShowBBox(e.target.checked)} className="accent-sky-400" />
            <span>👁️ Bounding Box</span>
          </label>
          <label className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-2.5 py-1.5 rounded text-xs font-mono cursor-pointer">
            <input type="checkbox" checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} className="accent-emerald-400" />
            <span>🤖 Auto-Agent Sync (4d)</span>
          </label>
        </div>
      </header>

      <div className="neon-card rounded-xl p-3 flex flex-col lg:flex-row justify-between items-center gap-3">
        <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
          <span className="text-xs font-mono text-slate-400 mr-1">🎬 Mode Skenario:</span>
          {([
            { id: 'NORMAL', label: '☀️ Siang Normal' },
            { id: 'RUSH_HOUR', label: '🌅 Rush Hour (Macet)' },
            { id: 'NIGHT', label: '🌙 Jam Kosong' },
            { id: 'AUTO_CYCLE', label: '🔄 Siklus Otomatis' },
            { id: 'CUSTOM', label: '🛠️ Custom Scenario (Manual)' },
          ] as { id: ScenarioMode; label: string }[]).map((item) => (
            <button key={item.id} onClick={() => setScenario(item.id)}
              className={`text-xs font-mono px-3 py-1.5 rounded border transition ${
                scenario === item.id
                  ? 'bg-sky-600 text-white border-sky-400 shadow-md'
                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}>{item.label}</button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto justify-end font-mono text-xs">
          <span className="text-slate-400">🔍 Zoom Kamera:</span>
          <button onClick={() => setCamZoom((zoom) => Math.max(0.35, Number((zoom - 0.12).toFixed(2))))} className="bg-slate-800 hover:bg-slate-700 border border-slate-600 px-2.5 py-1 rounded font-bold">➖ Out</button>
          <input type="range" min="0.35" max="1.4" step="0.05" value={camZoom} onChange={(e) => setCamZoom(parseFloat(e.target.value))} className="w-24 accent-sky-400" />
          <span className="text-sky-400 font-bold w-12 text-center">{Math.round(camZoom * 100)}%</span>
          <button onClick={() => setCamZoom((zoom) => Math.min(1.4, Number((zoom + 0.12).toFixed(2))))} className="bg-slate-800 hover:bg-slate-700 border border-slate-600 px-2.5 py-1 rounded font-bold">➕ In</button>
          <button onClick={() => { camPanRef.current = { x: 0, y: 0 }; setCamZoom(0.55); }} className="bg-slate-800 hover:bg-slate-700 border border-slate-600 px-2.5 py-1 rounded text-sky-300">🎯 Reset</button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <TrafficCanvas
          vehiclesRef={vehiclesRef}
          lightStateRef={lightStateRef}
          camZoom={camZoom}
          onZoomChange={setCamZoom}
          camPanRef={camPanRef}
          showBBox={showBBox}
          scenarioStatusText={getScenarioStatusLabel()}
          emergencyBanner={emergencyBanner}
          onCameraCountChange={(counts) => {
            camCountsRef.current = counts;
            setCamCounts(counts);
          }}
          onEmergencyDetected={handleEmergencyDetected}
        />
        <ControlDeck
          axisState={axisState}
          camCounts={camCounts}
          agentMessages={agentMessages}
          auditLogs={auditLogs}
          onInjectVehicle={handleInjectVehicle}
          onInjectBurst={handleInjectBurst}
          onSyncCamera={handleSyncCamera}
          onSendGlitch={handleSendGlitch}
          onClearVehicles={() => { vehiclesRef.current = []; }}
        />
      </div>
    </div>
  );
};
