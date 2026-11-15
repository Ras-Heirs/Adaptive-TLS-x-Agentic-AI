import React, { useState, useRef, useEffect, useCallback } from 'react';
import type {
  AgentMessageRecord, AuditLogRecord, AxisId, Direction, LightColor,
  ScenarioMode, SignalAxisState, SpawnDirOption, Vehicle, VehicleType,
} from './types/simulator';
import { createVehicle } from './utils/laneGeometry';
import { TrafficApi } from './services/trafficApi';
import { GuideModal } from './components/GuideModal';
import { TrafficCanvas } from './components/TrafficCanvas';
import { IntersectionCard, InjectionCard, LogCard } from './components/ControlDeck';
import { ConnectionBadge } from './components/ConnectionBadge';
import { InsightsPanel } from './components/InsightsPanel';
import { ManualControl } from './components/ManualControl';
import type { ManualSession } from './components/ManualControl';
import { Clock } from './components/Clock';
import { Logo } from './components/Logo';
import { toggleStageFullscreen, useShortcuts } from './hooks/useShortcuts';

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
      const names = ['Day', 'Rush Hour', 'Night'];
      return `Mode: Auto Cycle → ${names[autoCyclePhase % names.length]}`;
    }
    const labels: Record<ScenarioMode, string> = {
      NORMAL: 'Mode: Day',
      RUSH_HOUR: 'Mode: Rush Hour',
      NIGHT: 'Mode: Night',
      AUTO_CYCLE: '',
      CUSTOM: 'Mode: Custom (Traffic Generator Off)',
    };
    return labels[scenario];
  };

  // ── tampilan saja (tidak memengaruhi logika di atas) ──
  const [showHeatmap, setShowHeatmap] = useState(false);
  const nightMode = scenario === 'NIGHT' || (scenario === 'AUTO_CYCLE' && autoCyclePhase % 3 === 2);
  useShortcuts({
    zoomIn: () => setCamZoom((zoom) => Math.min(1.4, Number((zoom + 0.12).toFixed(2)))),
    zoomOut: () => setCamZoom((zoom) => Math.max(0.35, Number((zoom - 0.12).toFixed(2)))),
    resetView: () => { camPanRef.current = { x: 0, y: 0 }; setCamZoom(0.55); },
    toggleBBox: () => setShowBBox((v) => !v),
    toggleHeatmap: () => setShowHeatmap((v) => !v),
    toggleFullscreen: toggleStageFullscreen,
    openGuide: () => setIsGuideOpen(true),
  });

  // ── kendali manual operator (frontend saja; memakai endpoint /api/override yang sudah ada) ──
  const [manual, setManual] = useState<ManualSession | null>(null);
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const autoSyncBeforeManualRef = useRef<boolean | null>(null);
  const manualRef = useRef<ManualSession | null>(null);
  manualRef.current = manual;

  const releaseManual = useCallback(() => {
    setManual(null);
    if (autoSyncBeforeManualRef.current !== null) {
      setAutoSync(autoSyncBeforeManualRef.current);
      autoSyncBeforeManualRef.current = null;
    }
  }, []);

  const applyManual = useCallback(async (axis: AxisId, duration: number, reason: string) => {
    setManualBusy(true);
    setManualError(null);
    // jeda sinkron otomatis dulu supaya override tidak langsung tertimpa kiriman sensor
    if (autoSyncBeforeManualRef.current === null) autoSyncBeforeManualRef.current = autoSync;
    setAutoSync(false);
    try {
      const response = await TrafficApi.sendManualOverride(axis, duration, reason);
      if (!response?.success) throw new Error(response?.message || 'Override rejected by the backend');
      const finalDuration = Number(response?.data?.validatedOverride?.finalDuration) || duration;
      const now = Date.now();
      setManual({ axis, duration: finalDuration, reason, startedAt: now, until: now + finalDuration * 1000 });
      await refreshBackendState();
    } catch (error) {
      console.error('Failed to apply manual control:', error);
      setManualError(`Override failed: ${error instanceof Error ? error.message : String(error)}. Check the backend connection.`);
      // kalau belum ada sesi manual yang berjalan, kembalikan sinkron otomatis seperti semula
      if (!manualRef.current && autoSyncBeforeManualRef.current !== null) {
        setAutoSync(autoSyncBeforeManualRef.current);
        autoSyncBeforeManualRef.current = null;
      }
    } finally {
      setManualBusy(false);
    }
  }, [autoSync, refreshBackendState]);

  useEffect(() => {
    if (!manual) return;
    const timer = window.setTimeout(releaseManual, Math.max(0, manual.until - Date.now()));
    return () => window.clearTimeout(timer);
  }, [manual, releaseManual]);

  const scenarioOptions: { id: ScenarioMode; label: string }[] = [
    { id: 'NORMAL', label: 'Day' },
    { id: 'RUSH_HOUR', label: 'Rush Hour' },
    { id: 'NIGHT', label: 'Night' },
    { id: 'AUTO_CYCLE', label: 'Auto Cycle' },
    { id: 'CUSTOM', label: 'Custom' },
  ];

  const scenarioShort: Record<ScenarioMode, string> = {
    NORMAL: 'Day', RUSH_HOUR: 'Rush Hour', NIGHT: 'Night', AUTO_CYCLE: 'Auto Cycle', CUSTOM: 'Custom',
  };

  return (
    <div className="app">
      <GuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />

      <header className="header">
        <div className="brand">
          <Logo size={44} />
          <div>
            <b>Adaptive Traffic Light</b>
            <span>Intersection · 4-Way Simulation</span>
          </div>
        </div>

        <nav className="scenarios" role="group" aria-label="Traffic scenario">
          {scenarioOptions.map((item) => (
            <button key={item.id} aria-pressed={scenario === item.id} onClick={() => setScenario(item.id)}>
              {scenarioShort[item.id]}
            </button>
          ))}
        </nav>

        <div className="header-right">
          <div className="toggles">
            <button className="toggle" aria-pressed={showBBox} onClick={() => setShowBBox((v) => !v)} title="Bounding Boxes (B)">Boxes</button>
            <button className="toggle" aria-pressed={showHeatmap} onClick={() => setShowHeatmap((v) => !v)} title="Heatmap (H)">Heatmap</button>
            <button
              className="toggle" aria-pressed={autoSync} disabled={!!manual}
              onClick={() => setAutoSync((v) => !v)}
              title={manual ? 'Paused while manual control is active' : 'Send camera counts to the agents every 4 seconds'}
            >Auto Sync</button>
            <button className="toggle toggle-icon" onClick={() => setIsGuideOpen(true)} title="Guide (?)" aria-label="Open guide">?</button>
          </div>
          <ConnectionBadge />
          <Clock />
        </div>
      </header>

      <main className="layout">
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
          nightMode={nightMode}
          showHeatmap={showHeatmap}
        />

        <aside className="side">
          <IntersectionCard axis="A" state={axisState.A} inView={camCounts.A} />
          <IntersectionCard axis="B" state={axisState.B} inView={camCounts.B} />
          <ManualControl
            axisState={axisState}
            session={manual}
            busy={manualBusy}
            error={manualError}
            onApply={(axis, duration, reason) => { void applyManual(axis, duration, reason); }}
            onRelease={releaseManual}
          />
        </aside>
      </main>

      <InsightsPanel axisState={axisState} camCounts={camCounts} vehiclesRef={vehiclesRef} />

      <section className="lower">
        <InjectionCard
          camCounts={camCounts}
          onInjectVehicle={handleInjectVehicle}
          onInjectBurst={handleInjectBurst}
          onSyncCamera={handleSyncCamera}
          onSendGlitch={handleSendGlitch}
          onClearVehicles={() => { vehiclesRef.current = []; }}
          syncLocked={!!manual}
        />
        <LogCard agentMessages={agentMessages} auditLogs={auditLogs} />
      </section>

      <footer className="footnote">
        Signal decisions come from the backend agents · Frontend simulation with SafetyGuard limits of 15–90 s
      </footer>
    </div>
  );
};
