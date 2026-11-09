import React, { useRef, useEffect } from 'react';
import type {
  AxisId, Direction, SignalAxisState, Vehicle, VehicleType,
} from '../types/simulator';
import { CAMERA_ROIS, isInsideBox, stepVehiclesPhysics } from '../utils/laneGeometry';

interface TrafficCanvasProps {
  vehiclesRef: React.MutableRefObject<Vehicle[]>;
  lightStateRef: React.MutableRefObject<Record<AxisId, SignalAxisState>>;
  camZoom: number;
  onZoomChange: (newZoom: number) => void;
  camPanRef: React.MutableRefObject<{ x: number; y: number }>;
  showBBox: boolean;
  scenarioStatusText: string;
  emergencyBanner: string | null;
  onCameraCountChange: (counts: Record<AxisId, number>) => void;
  onEmergencyDetected: (axis: AxisId, type: VehicleType, dir: Direction) => void;
}

export const TrafficCanvas: React.FC<TrafficCanvasProps> = ({
  vehiclesRef, lightStateRef, camZoom, onZoomChange, camPanRef,
  showBBox, scenarioStatusText, emergencyBanner,
  onCameraCountChange, onEmergencyDetected,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(camZoom);
  const showBBoxRef = useRef(showBBox);
  const callbacksRef = useRef({ onZoomChange, onCameraCountChange, onEmergencyDetected });

  useEffect(() => { zoomRef.current = camZoom; }, [camZoom]);
  useEffect(() => { showBBoxRef.current = showBBox; }, [showBBox]);
  useEffect(() => {
    callbacksRef.current = { onZoomChange, onCameraCountChange, onEmergencyDetected };
  }, [onZoomChange, onCameraCountChange, onEmergencyDetected]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId = 0;
    let lastCountA = -1;
    let lastCountB = -1;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.06 : -0.06;
      const next = Math.min(1.4, Math.max(0.35, zoomRef.current + delta));
      callbacksRef.current.onZoomChange(next);
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    const drawLaneArrow = (x: number, y: number, rotationRad: number, label: string) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotationRad);
      ctx.fillStyle = 'rgba(226, 232, 240, 0.35)';
      ctx.beginPath();
      ctx.moveTo(14, 0); ctx.lineTo(-6, -8); ctx.lineTo(-6, -3);
      ctx.lineTo(-16, -3); ctx.lineTo(-16, 3); ctx.lineTo(-6, 3);
      ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill();
      if (label) {
        ctx.font = 'bold 9px monospace';
        ctx.fillText(label, -26, 3);
      }
      ctx.restore();
    };

    const drawSignalBox = (x: number, y: number, label: string, activeColor: string, dur: number) => {
      ctx.save();
      ctx.fillStyle = '#14532d';
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(x, y, 38, 84, 7); ctx.fill(); ctx.stroke();
      const lights = [
        { name: 'RED', hex: '#ef4444', cy: y + 18 },
        { name: 'YELLOW', hex: '#eab308', cy: y + 42 },
        { name: 'GREEN', hex: '#10b981', cy: y + 66 },
      ];
      lights.forEach((light) => {
        ctx.beginPath(); ctx.arc(x + 19, light.cy, 8, 0, Math.PI * 2);
        if (activeColor === light.name) {
          ctx.fillStyle = light.hex; ctx.shadowColor = light.hex; ctx.shadowBlur = 16;
        } else {
          ctx.fillStyle = '#0f172a'; ctx.shadowBlur = 0;
        }
        ctx.fill();
      });
      ctx.restore();
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`${label} (${dur}s)`, x - 12, y - 8);
    };

    const renderLoop = () => {
      vehiclesRef.current = stepVehiclesPhysics(vehiclesRef.current, {
        A: lightStateRef.current.A.color,
        B: lightStateRef.current.B.color,
      });

      const counts: Record<AxisId, number> = { A: 0, B: 0 };
      vehiclesRef.current.forEach((vehicle) => {
        const roi = CAMERA_ROIS[vehicle.dir];
        if (!vehicle.passedStopLine && isInsideBox(vehicle.x, vehicle.y, roi)) {
          counts[vehicle.axis]++;
          vehicle.inROI = true;
          if (vehicle.isEmergency && !vehicle.emergencyTriggered) {
            vehicle.emergencyTriggered = true;
            callbacksRef.current.onEmergencyDetected(vehicle.axis, vehicle.type, vehicle.dir);
          }
        } else {
          vehicle.inROI = false;
        }
      });

      if (counts.A !== lastCountA || counts.B !== lastCountB) {
        lastCountA = counts.A; lastCountB = counts.B;
        callbacksRef.current.onCameraCountChange(counts);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2 + camPanRef.current.x, canvas.height / 2 + camPanRef.current.y);
      ctx.scale(zoomRef.current, zoomRef.current);

      ctx.fillStyle = '#0b1324'; ctx.fillRect(-1500, -1500, 3000, 3000);
      ctx.fillStyle = '#334155';
      ctx.fillRect(-120, -1100, 240, 2200);
      ctx.fillRect(-1100, -120, 2200, 240);

      ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2.5;
      [-3, 3].forEach((d) => {
        ctx.beginPath();
        ctx.moveTo(d, -1100); ctx.lineTo(d, -138);
        ctx.moveTo(d, 138); ctx.lineTo(d, 1100);
        ctx.moveTo(-1100, d); ctx.lineTo(-138, d);
        ctx.moveTo(138, d); ctx.lineTo(1100, d);
        ctx.stroke();
      });

      ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.5; ctx.setLineDash([16, 16]);
      [-60, 60].forEach((offset) => {
        ctx.beginPath();
        ctx.moveTo(offset, -1100); ctx.lineTo(offset, -138);
        ctx.moveTo(offset, 138); ctx.lineTo(offset, 1100);
        ctx.moveTo(-1100, offset); ctx.lineTo(-138, offset);
        ctx.moveTo(138, offset); ctx.lineTo(1100, offset);
        ctx.stroke();
      });
      ctx.setLineDash([]);

      [230, 420].forEach((dist) => {
        drawLaneArrow(84, -dist, Math.PI / 2, 'L/S');
        drawLaneArrow(36, -dist, Math.PI / 2, 'R/S');
        drawLaneArrow(-84, -dist, -Math.PI / 2, 'OUT');
        drawLaneArrow(-36, -dist, -Math.PI / 2, 'OUT');
        drawLaneArrow(-84, dist, -Math.PI / 2, 'L/S');
        drawLaneArrow(-36, dist, -Math.PI / 2, 'R/S');
        drawLaneArrow(84, dist, Math.PI / 2, 'OUT');
        drawLaneArrow(36, dist, Math.PI / 2, 'OUT');
        drawLaneArrow(-dist, -84, 0, 'L/S');
        drawLaneArrow(-dist, -36, 0, 'R/S');
        drawLaneArrow(-dist, 84, Math.PI, 'OUT');
        drawLaneArrow(-dist, 36, Math.PI, 'OUT');
        drawLaneArrow(dist, 84, Math.PI, 'L/S');
        drawLaneArrow(dist, 36, Math.PI, 'R/S');
        drawLaneArrow(dist, -84, 0, 'OUT');
        drawLaneArrow(dist, -36, 0, 'OUT');
      });

      ctx.fillStyle = '#e2e8f0';
      for (let i = -110; i <= 100; i += 20) {
        ctx.fillRect(i, -136, 12, 14); ctx.fillRect(i, 122, 12, 14);
        ctx.fillRect(-136, i, 14, 12); ctx.fillRect(122, i, 14, 12);
      }

      Object.values(CAMERA_ROIS).forEach((roi) => {
        ctx.save();
        ctx.strokeStyle = '#38bdf8'; ctx.fillStyle = 'rgba(56, 189, 248, 0.09)';
        ctx.lineWidth = 2; ctx.setLineDash([10, 6]);
        ctx.fillRect(roi.x, roi.y, roi.w, roi.h);
        ctx.strokeRect(roi.x, roi.y, roi.w, roi.h);
        ctx.setLineDash([]); ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 13px monospace';
        ctx.fillText(`📹 ${roi.label}`, roi.x + 8, roi.y + 20);
        ctx.restore();
      });

      const stA = lightStateRef.current.A;
      const stB = lightStateRef.current.B;
      drawSignalBox(140, -230, 'TLS-A (N)', stA.color, stA.duration);
      drawSignalBox(-180, 145, 'TLS-A (S)', stA.color, stA.duration);
      drawSignalBox(-230, -180, 'TLS-B (W)', stB.color, stB.duration);
      drawSignalBox(145, 140, 'TLS-B (E)', stB.color, stB.duration);

      const blink = Math.floor(Date.now() / 140) % 2 === 0;
      vehiclesRef.current.forEach((vehicle) => {
        ctx.save();
        ctx.translate(vehicle.x, vehicle.y); ctx.rotate(vehicle.angle);
        if (vehicle.type === 'AMBULANCE') ctx.fillStyle = '#f8fafc';
        else if (vehicle.type === 'DAMKAR') ctx.fillStyle = '#dc2626';
        else if (vehicle.type === 'TRUCK') ctx.fillStyle = '#f59e0b';
        else ctx.fillStyle = '#38bdf8';

        ctx.beginPath();
        ctx.roundRect(-vehicle.length / 2, -vehicle.width / 2, vehicle.length, vehicle.width, 5);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(vehicle.length / 2 - 10, -vehicle.width / 2 + 3, 6, vehicle.width - 6);
        if (vehicle.isEmergency) {
          ctx.fillStyle = blink ? '#ef4444' : '#3b82f6';
          ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 15;
          ctx.fillRect(-6, -vehicle.width / 2 + 4, 12, vehicle.width - 8);
          ctx.shadowBlur = 0;
        }
        ctx.restore();

        if (showBBoxRef.current) {
          ctx.save();
          const boxColor = vehicle.isEmergency ? '#f43f5e' : vehicle.inROI ? '#10b981' : '#38bdf8';
          ctx.strokeStyle = boxColor; ctx.lineWidth = vehicle.isEmergency ? 2.5 : 1.5;
          ctx.strokeRect(vehicle.x - 22, vehicle.y - 22, 44, 44);
          const tag = `${vehicle.type} ${vehicle.turnType[0]} ${vehicle.confidence}`;
          ctx.fillStyle = vehicle.isEmergency ? '#e11d48' : '#0284c7';
          ctx.fillRect(vehicle.x - 22, vehicle.y - 36, tag.length * 6.6, 13);
          ctx.fillStyle = '#ffffff'; ctx.font = 'bold 10px monospace';
          ctx.fillText(tag, vehicle.x - 19, vehicle.y - 26);
          ctx.restore();
        }
      });

      ctx.restore();
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);
    return () => {
      cancelAnimationFrame(animationFrameId);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [vehiclesRef, lightStateRef, camPanRef]);

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX - camPanRef.current.x,
      y: e.clientY - camPanRef.current.y,
    };
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    camPanRef.current = {
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    };
  };

  const onMouseUp = () => { isDraggingRef.current = false; };

  return (
    <div className="xl:col-span-7 dl-frame bg-amber-500/5 p-2.5 rounded-2xl flex flex-col gap-2">
      <div className="flex flex-wrap justify-between items-center px-2 gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-amber-400">🎥 4-WAY AI CAMERA SUPERVISION</span>
          <span className="text-[11px] font-mono bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-sky-300">{scenarioStatusText}</span>
        </div>
        {emergencyBanner && <span className="bg-rose-600 text-white text-xs font-mono font-bold px-3 py-0.5 rounded animate-pulse">{emergencyBanner}</span>}
      </div>
      <div className="relative overflow-hidden rounded-xl border border-slate-800">
        <canvas
          ref={canvasRef}
          width={820}
          height={600}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        />
        <div className="absolute bottom-2 left-2 bg-slate-950/80 border border-slate-800 px-2.5 py-1 rounded text-[10px] font-mono text-slate-300 pointer-events-none">
          💡 Scroll untuk zoom | Klik dan tahan kanvas untuk menggeser peta
        </div>
      </div>
      <div className="flex flex-wrap justify-between items-center text-[11px] font-mono text-slate-400 px-2">
        <div>🟦 Kotak Biru: <span className="text-sky-300">Zona Kamera AI (Jalur Masuk)</span></div>
        <div>🛣️ Garis Kuning Ganda: <span className="text-amber-300">Pemisah Arus 2 Arah</span></div>
      </div>
    </div>
  );
};
