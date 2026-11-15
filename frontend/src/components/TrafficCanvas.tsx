import React, { useRef, useEffect, useState } from 'react';
import type {
  AxisId, Direction, SignalAxisState, Vehicle, VehicleType,
} from '../types/simulator';
import { CAMERA_ROIS, isInsideBox, stepVehiclesPhysics } from '../utils/laneGeometry';
import { buildCity, drawCityGround, drawCityNightLights, drawCityTowers, drawTrees } from '../utils/cityScenery';

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
  nightMode?: boolean;
  showHeatmap?: boolean;
}

// ── tampilan saja ────────────────────────────────────────────────────
// Lebar dunia acuan (sama dengan kanvas lama 820 px). Kanvas sekarang mengikuti
// lebar kartu dan dirender pada devicePixelRatio agar tajam di layar HD.
const BASE_WIDTH = 820;
const ASPECT = 600 / 820;

const UI_FONT = '"Inter", "Segoe UI", system-ui, sans-serif';
const MONO_FONT = '"Inter", "Segoe UI", system-ui, sans-serif';
const CAR_COLORS = ['#7fa7d6', '#d6dbe2', '#5d6878', '#cdb57a', '#8fb59a', '#b98585', '#9aa6cf', '#2f3742'];
const LAMP_HEX: Record<string, string> = { RED: '#ff5d55', YELLOW: '#f5be3d', GREEN: '#36d68a' };

function makeAsphaltPattern(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 160; c.height = 160;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = '#1f242b';
  g.fillRect(0, 0, 160, 160);
  for (let i = 0; i < 1400; i++) {
    const v = Math.random();
    g.fillStyle = v < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.12)';
    g.fillRect(Math.random() * 160, Math.random() * 160, 1 + Math.random() * 1.5, 1 + Math.random() * 1.5);
  }
  return c;
}

export const TrafficCanvas: React.FC<TrafficCanvasProps> = ({
  vehiclesRef, lightStateRef, camZoom, onZoomChange, camPanRef,
  showBBox, scenarioStatusText, emergencyBanner,
  onCameraCountChange, onEmergencyDetected, nightMode = false, showHeatmap = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const nightRef = useRef(nightMode);
  const heatRef = useRef(showHeatmap);
  const selectedIdRef = useRef<number | null>(null);
  const downPosRef = useRef({ x: 0, y: 0 });
  useEffect(() => { nightRef.current = nightMode; }, [nightMode]);
  useEffect(() => { heatRef.current = showHeatmap; }, [showHeatmap]);
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
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') selectedIdRef.current = null; };
    window.addEventListener('keydown', handleKey);

    // tampilan saja: heatmap kepadatan & waktu tunggu tiap kendaraan
    const HEAT_CELL = 30;
    const heat = new Map<string, number>();
    const waitMs = new Map<number, number>();
    let lastFrameAt = performance.now();
    const STREET_LAMPS: [number, number][] = [];
    [-1, 1].forEach((s) => {
      for (let d = 250; d < 1080; d += 190) {
        STREET_LAMPS.push([s * 136, d], [s * 136, -d], [d, s * 136], [-d, s * 136]);
      }
    });

    // ── tampilan saja: aset & helper menggambar ─────────────────────
    const city = buildCity();
    const asphalt = ctx.createPattern(makeAsphaltPattern(), 'repeat');

    const fitCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const cssW = canvas.clientWidth || BASE_WIDTH;
      const cssH = Math.round(cssW * ASPECT);
      const pxW = Math.round(cssW * dpr);
      const pxH = Math.round(cssH * dpr);
      if (canvas.width !== pxW || canvas.height !== pxH) {
        canvas.width = pxW;
        canvas.height = pxH;
      }
      return { dpr, cssW, cssH };
    };

    const rr = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    };

    const drawScene = () => {
      // tanah
      ctx.fillStyle = '#0c1014'; ctx.fillRect(-1600, -1600, 3200, 3200);

      // blok kota + trotoar di empat sudut
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
        const x0 = sx < 0 ? -1100 : 120;
        const y0 = sy < 0 ? -1100 : 120;
        ctx.fillStyle = '#1a2028'; // trotoar
        rr(x0, y0, 980, 980, 26); ctx.fill();
        ctx.fillStyle = '#12171d'; // kavling
        rr(x0 + (sx < 0 ? 0 : 52), y0 + (sy < 0 ? 0 : 52), 928, 928, 18); ctx.fill();
      });
      // garis kerb
      ctx.strokeStyle = 'rgba(160, 172, 188, 0.22)'; ctx.lineWidth = 1.5;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
        rr(sx < 0 ? -1100 : 120, sy < 0 ? -1100 : 120, 980, 980, 26); ctx.stroke();
      });

      // kota: jalan lingkungan, taman, parkiran, rumah, lalu gedung tinggi
      drawCityGround(ctx, city);
      drawCityTowers(ctx, city);

      // badan jalan
      ctx.fillStyle = asphalt ?? '#1f242b';
      ctx.fillRect(-120, -1100, 240, 2200);
      ctx.fillRect(-1100, -120, 2200, 240);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
      ctx.fillRect(-120, -120, 240, 240);

      // pohon
      drawTrees(ctx, city.trees);
      city.parks.forEach((p) => drawTrees(ctx, p.trees));

      // garis tepi jalan
      ctx.strokeStyle = 'rgba(232, 236, 242, 0.55)'; ctx.lineWidth = 2;
      ctx.beginPath();
      [-114, 114].forEach((e) => {
        ctx.moveTo(e, -1100); ctx.lineTo(e, -150); ctx.moveTo(e, 150); ctx.lineTo(e, 1100);
        ctx.moveTo(-1100, e); ctx.lineTo(-150, e); ctx.moveTo(150, e); ctx.lineTo(1100, e);
      });
      ctx.stroke();

      // garis kuning ganda pemisah arus
      ctx.strokeStyle = '#d9ae3f'; ctx.lineWidth = 2;
      ctx.beginPath();
      [-3, 3].forEach((d) => {
        ctx.moveTo(d, -1100); ctx.lineTo(d, -150);
        ctx.moveTo(d, 150); ctx.lineTo(d, 1100);
        ctx.moveTo(-1100, d); ctx.lineTo(-150, d);
        ctx.moveTo(150, d); ctx.lineTo(1100, d);
      });
      ctx.stroke();

      // pembagi lajur
      ctx.strokeStyle = 'rgba(232, 236, 242, 0.42)'; ctx.lineWidth = 2; ctx.setLineDash([22, 20]);
      ctx.beginPath();
      [-60, 60].forEach((offset) => {
        ctx.moveTo(offset, -1100); ctx.lineTo(offset, -150);
        ctx.moveTo(offset, 150); ctx.lineTo(offset, 1100);
        ctx.moveTo(-1100, offset); ctx.lineTo(-150, offset);
        ctx.moveTo(150, offset); ctx.lineTo(1100, offset);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      // zebra cross
      ctx.fillStyle = 'rgba(236, 240, 245, 0.78)';
      for (let i = -108; i <= 98; i += 18) {
        ctx.fillRect(i, -144, 9, 20); ctx.fillRect(i, 124, 9, 20);
        ctx.fillRect(-144, i, 20, 9); ctx.fillRect(124, i, 20, 9);
      }

      // panah lajur
      [260, 470].forEach((dist) => {
        drawLaneArrow(84, -dist, Math.PI / 2, 'LEFT');
        drawLaneArrow(36, -dist, Math.PI / 2, 'RIGHT');
        drawLaneArrow(-84, dist, -Math.PI / 2, 'LEFT');
        drawLaneArrow(-36, dist, -Math.PI / 2, 'RIGHT');
        drawLaneArrow(-dist, -84, 0, 'LEFT');
        drawLaneArrow(-dist, -36, 0, 'RIGHT');
        drawLaneArrow(dist, 84, Math.PI, 'LEFT');
        drawLaneArrow(dist, 36, Math.PI, 'RIGHT');
      });
    };

    // panah lurus + cabang belok (kiri = sisi -y lokal)
    const drawLaneArrow = (x: number, y: number, rotationRad: number, branch: 'LEFT' | 'RIGHT') => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotationRad);
      ctx.strokeStyle = 'rgba(236, 240, 245, 0.5)';
      ctx.fillStyle = 'rgba(236, 240, 245, 0.5)';
      ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(10, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(8, -8); ctx.lineTo(8, 8); ctx.closePath(); ctx.fill();
      const s = branch === 'LEFT' ? -1 : 1;
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.quadraticCurveTo(-4, 0, -4, s * 12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-4, s * 22); ctx.lineTo(-11, s * 10); ctx.lineTo(3, s * 10); ctx.closePath(); ctx.fill();
      ctx.lineCap = 'butt';
      ctx.restore();
    };

    // garis henti tiap pendekat, diberi pita warna sesuai lampu
    const drawStopLines = (colA: string, colB: string) => {
      const bars: [number, number, number, number, string][] = [
        [4, -152, 110, 5, colA],   // dari utara
        [-114, 147, 110, 5, colA], // dari selatan
        [-152, -114, 5, 110, colB], // dari barat
        [147, 4, 5, 110, colB],    // dari timur
      ];
      bars.forEach(([x, y, w, h, col]) => {
        ctx.fillStyle = 'rgba(240, 243, 247, 0.92)';
        ctx.fillRect(x, y, w, h);
        ctx.save();
        ctx.shadowColor = LAMP_HEX[col]; ctx.shadowBlur = 14;
        ctx.fillStyle = LAMP_HEX[col];
        ctx.globalAlpha = 0.9;
        if (w > h) ctx.fillRect(x, y + (y < 0 ? -3 : h), w, 3);
        else ctx.fillRect(x + (x < 0 ? -3 : w), y, 3, h);
        ctx.restore();
      });
    };

    const drawCameraZone = ([dir, roi]: [string, { x: number; y: number; w: number; h: number; label: string }]) => {
      ctx.save();
      ctx.fillStyle = 'rgba(110, 168, 255, 0.045)';
      ctx.fillRect(roi.x, roi.y, roi.w, roi.h);
      ctx.strokeStyle = 'rgba(120, 175, 255, 0.35)'; ctx.lineWidth = 1.2; ctx.setLineDash([6, 8]);
      ctx.strokeRect(roi.x, roi.y, roi.w, roi.h);
      ctx.setLineDash([]);
      // sudut bidik kamera
      const c = 22;
      ctx.strokeStyle = 'rgba(140, 190, 255, 0.95)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(roi.x, roi.y + c); ctx.lineTo(roi.x, roi.y); ctx.lineTo(roi.x + c, roi.y);
      ctx.moveTo(roi.x + roi.w - c, roi.y); ctx.lineTo(roi.x + roi.w, roi.y); ctx.lineTo(roi.x + roi.w, roi.y + c);
      ctx.moveTo(roi.x + roi.w, roi.y + roi.h - c); ctx.lineTo(roi.x + roi.w, roi.y + roi.h); ctx.lineTo(roi.x + roi.w - c, roi.y + roi.h);
      ctx.moveTo(roi.x + c, roi.y + roi.h); ctx.lineTo(roi.x, roi.y + roi.h); ctx.lineTo(roi.x, roi.y + roi.h - c);
      ctx.stroke();
      ctx.lineCap = 'butt';
      // label kamera
      const EN: Record<string, string> = { UTARA: 'NORTH', SELATAN: 'SOUTH', BARAT: 'WEST', TIMUR: 'EAST' };
      const text = roi.label.replace(/\s*\((.+)\)/, ' · $1').replace(/UTARA|SELATAN|BARAT|TIMUR/g, (m) => EN[m]);
      ctx.font = `600 15px ${MONO_FONT}`;
      const tw = ctx.measureText(text).width;
      // label diletakkan di ujung luar / sisi trotoar supaya tidak menutupi kendaraan
      const lx = dir === 'N' ? 128 : dir === 'S' ? -128 - (tw + 30) : dir === 'E' ? roi.x + roi.w - tw - 30 : roi.x + 8;
      const ly = dir === 'N' ? -430 : dir === 'S' ? 404 : dir === 'W' ? roi.y - 40 : roi.y + roi.h + 14;
      ctx.fillStyle = 'rgba(12, 18, 28, 0.86)';
      rr(lx, ly, tw + 30, 26, 13); ctx.fill();
      ctx.fillStyle = '#ff5d55';
      ctx.beginPath(); ctx.arc(lx + 13, ly + 13, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#cfe0ff';
      ctx.fillText(text, lx + 23, ly + 18);
      ctx.restore();
    };

    const drawNight = () => {
      ctx.save();
      ctx.fillStyle = 'rgba(4, 8, 24, 0.55)';
      ctx.fillRect(-1600, -1600, 3200, 3200);
      // jendela gedung & rumah menyala
      drawCityNightLights(ctx, city);
      // cahaya lampu jalan
      ctx.globalCompositeOperation = 'lighter';
      STREET_LAMPS.forEach(([lx, ly]) => {
        const g = ctx.createRadialGradient(lx, ly, 2, lx, ly, 95);
        g.addColorStop(0, 'rgba(255, 196, 120, 0.22)'); g.addColorStop(1, 'rgba(255, 196, 120, 0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(lx, ly, 95, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#ffe2b0';
      STREET_LAMPS.forEach(([lx, ly]) => { ctx.beginPath(); ctx.arc(lx, ly, 3, 0, Math.PI * 2); ctx.fill(); });
      ctx.restore();
    };

    const updateHeat = (dt: number) => {
      const decay = Math.pow(0.985, dt / 16.7);
      heat.forEach((v, k) => { const n = v * decay; if (n < 0.02) heat.delete(k); else heat.set(k, n); });
      vehiclesRef.current.forEach((v) => {
        if (v.passedStopLine || v.speed > 0.6) return;
        const key = `${Math.floor(v.x / HEAT_CELL)},${Math.floor(v.y / HEAT_CELL)}`;
        heat.set(key, Math.min(1.6, (heat.get(key) ?? 0) + 0.02 * (dt / 16.7)));
      });
    };

    const drawHeat = () => {
      ctx.save();
      heat.forEach((v, k) => {
        if (v < 0.06) return;
        const [cx, cy] = k.split(',').map(Number);
        const a = Math.min(1, v);
        // satu rona (oranye) dari transparan ke pekat = makin padat
        ctx.fillStyle = `rgba(255, ${Math.round(150 - 90 * a)}, 60, ${0.12 + 0.5 * a})`;
        ctx.fillRect(cx * HEAT_CELL + 1, cy * HEAT_CELL + 1, HEAT_CELL - 2, HEAT_CELL - 2);
      });
      ctx.restore();
    };

    const DIR_TEXT: Record<string, string> = { N: 'North', S: 'South', W: 'West', E: 'East' };
    const TURN_TEXT: Record<string, string> = { STRAIGHT: 'Straight', LEFT: 'Left Turn', RIGHT: 'Right Turn' };
    const TYPE_TEXT: Record<string, string> = { CAR: 'Car', TRUCK: 'Truck', AMBULANCE: 'Ambulance', DAMKAR: 'Fire Truck' };

    const drawSelection = (v: Vehicle, sx: number, sy: number, cssW: number, cssH: number) => {
      ctx.save();
      const lines: [string, string][] = [
        ['Route', `From ${DIR_TEXT[v.dir]} · ${TURN_TEXT[v.turnType]}`],
        ['Speed', `${Math.round((v.speed / v.maxSpeed) * 100)}% of Max`],
        ['Waiting', `${((waitMs.get(v.id) ?? 0) / 1000).toFixed(1)} s`],
        ['Status', v.passedStopLine ? 'Past the Stop Line' : v.inROI ? 'In Camera Zone' : 'Approaching'],
        ['Detection', `Confidence ${v.confidence}`],
      ];
      const w = 252; const h = 40 + lines.length * 19;
      let x = sx + 22; let y = sy - h / 2;
      if (x + w > cssW - 10) x = sx - w - 22;
      y = Math.min(Math.max(10, y), cssH - h - 10);
      ctx.fillStyle = 'rgba(10, 13, 18, 0.92)';
      rr(x, y, w, h, 14); ctx.fill();
      ctx.strokeStyle = 'rgba(220, 199, 161, 0.45)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.font = `700 13px ${UI_FONT}`;
      ctx.fillStyle = '#eef1f5';
      ctx.fillText(`${TYPE_TEXT[v.type] ?? v.type} #${v.id}`, x + 14, y + 23);
      ctx.font = `600 10px ${UI_FONT}`;
      ctx.fillStyle = '#dcc7a1';
      ctx.textAlign = 'right';
      ctx.fillText(`INTERSECTION ${v.axis}`, x + w - 14, y + 22);
      ctx.textAlign = 'left';
      lines.forEach(([k, val], i) => {
        const ly = y + 46 + i * 19;
        ctx.font = `500 11.5px ${UI_FONT}`;
        ctx.fillStyle = '#7d8896';
        ctx.fillText(k, x + 14, ly);
        ctx.fillStyle = '#dfe5ec';
        ctx.fillText(val, x + 92, ly);
      });
      ctx.restore();
    };

    const drawSignalBox = (x: number, y: number, label: string, activeColor: string, dur: number) => {
      ctx.save();
      // tiang + bayangan
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      rr(x + 10, y + 10, 32, 80, 9); ctx.fill();
      const housing = ctx.createLinearGradient(x + 4, y, x + 36, y);
      housing.addColorStop(0, '#20262e'); housing.addColorStop(1, '#0d1014');
      ctx.fillStyle = housing;
      rr(x + 4, y + 4, 32, 80, 9); ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)'; ctx.lineWidth = 1.2; ctx.stroke();
      (['RED', 'YELLOW', 'GREEN'] as const).forEach((name, i) => {
        const on = activeColor === name;
        const cx = x + 20; const cy = y + 19 + i * 25;
        if (on) {
          const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 30);
          glow.addColorStop(0, `${LAMP_HEX[name]}88`); glow.addColorStop(1, `${LAMP_HEX[name]}00`);
          ctx.fillStyle = glow;
          ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.fill();
        }
        ctx.beginPath(); ctx.arc(cx, cy, 8.5, 0, Math.PI * 2);
        if (on) {
          const lens = ctx.createRadialGradient(cx - 2.5, cy - 2.5, 1, cx, cy, 8.5);
          lens.addColorStop(0, '#ffffff'); lens.addColorStop(0.35, LAMP_HEX[name]); lens.addColorStop(1, LAMP_HEX[name]);
          ctx.fillStyle = lens;
        } else {
          ctx.fillStyle = '#1b2027';
        }
        ctx.fill();
      });
      // label
      ctx.font = `600 15px ${UI_FONT}`;
      const lw = ctx.measureText(label).width;
      ctx.font = `600 14px ${MONO_FONT}`;
      const durText = `${dur}s`;
      const dw = ctx.measureText(durText).width;
      const px = x - 8; const py = y - 34;
      ctx.fillStyle = 'rgba(12, 16, 22, 0.86)';
      rr(px, py, lw + dw + 34, 26, 13); ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'; ctx.stroke();
      ctx.fillStyle = LAMP_HEX[activeColor] ?? '#9aa4b1';
      ctx.beginPath(); ctx.arc(px + 13, py + 13, 4, 0, Math.PI * 2); ctx.fill();
      ctx.font = `600 15px ${UI_FONT}`;
      ctx.fillStyle = '#e8ecf1';
      ctx.fillText(label, px + 23, py + 18);
      ctx.font = `600 14px ${MONO_FONT}`;
      ctx.fillStyle = '#8b96a5';
      ctx.fillText(durText, px + 23 + lw + 6, py + 18);
      ctx.restore();
    };

    const drawVehicleBody = (vehicle: Vehicle, blink: boolean) => {
      const L = vehicle.length;
      const W = vehicle.width;
      const slow = vehicle.speed < 0.7;

      // bayangan di aspal
      ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
      rr(-L / 2 + 2, -W / 2 + 3, L, W, 5); ctx.fill();

      if (vehicle.isEmergency) {
        const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, L * 1.3);
        const tint = blink ? '255, 80, 72' : '80, 140, 255';
        halo.addColorStop(0, `rgba(${tint}, 0.32)`); halo.addColorStop(1, `rgba(${tint}, 0)`);
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(0, 0, L * 1.3, 0, Math.PI * 2); ctx.fill();
      }

      // lampu depan (sorot tipis)
      const night = nightRef.current;
      const reach = night ? 58 : 22;
      const beam = ctx.createLinearGradient(L / 2, 0, L / 2 + reach, 0);
      beam.addColorStop(0, `rgba(255, 244, 214, ${night ? 0.42 : 0.2})`); beam.addColorStop(1, 'rgba(255, 244, 214, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath(); ctx.moveTo(L / 2, -W / 2 + 2); ctx.lineTo(L / 2 + reach, -W / 2 - (night ? 12 : 4)); ctx.lineTo(L / 2 + reach, W / 2 + (night ? 12 : 4)); ctx.lineTo(L / 2, W / 2 - 2); ctx.closePath(); ctx.fill();

      if (vehicle.type === 'TRUCK') {
        const box = ctx.createLinearGradient(0, -W / 2, 0, W / 2);
        box.addColorStop(0, '#9aa3ae'); box.addColorStop(0.5, '#d3d9e0'); box.addColorStop(1, '#8e97a2');
        ctx.fillStyle = box;
        rr(-L / 2, -W / 2, L - 14, W, 3); ctx.fill();
        ctx.strokeStyle = 'rgba(40, 48, 58, 0.35)'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let k = -L / 2 + 6; k < L / 2 - 16; k += 6) { ctx.moveTo(k, -W / 2 + 1); ctx.lineTo(k, W / 2 - 1); }
        ctx.stroke();
        const cab = ctx.createLinearGradient(0, -W / 2, 0, W / 2);
        cab.addColorStop(0, '#c98a2c'); cab.addColorStop(0.5, '#f0b552'); cab.addColorStop(1, '#b97c24');
        ctx.fillStyle = cab;
        rr(L / 2 - 12, -W / 2 + 0.5, 12, W - 1, 4); ctx.fill();
        ctx.fillStyle = '#121820';
        rr(L / 2 - 6, -W / 2 + 2.5, 4, W - 5, 1.5); ctx.fill();
      } else {
        const base = vehicle.type === 'AMBULANCE' ? '#f1f4f7' : vehicle.type === 'DAMKAR' ? '#d63a31' : CAR_COLORS[vehicle.id % CAR_COLORS.length];
        const body = ctx.createLinearGradient(0, -W / 2, 0, W / 2);
        body.addColorStop(0, shade(base, -0.22)); body.addColorStop(0.5, shade(base, 0.12)); body.addColorStop(1, shade(base, -0.28));
        ctx.fillStyle = body;
        rr(-L / 2, -W / 2, L, W, 5); ctx.fill();
        // kaca depan & belakang
        const glass = ctx.createLinearGradient(0, -W / 2, 0, W / 2);
        glass.addColorStop(0, '#0e141b'); glass.addColorStop(0.5, '#2a3846'); glass.addColorStop(1, '#0e141b');
        ctx.fillStyle = glass;
        rr(L / 2 - 12, -W / 2 + 2, 6, W - 4, 2); ctx.fill();
        rr(-L / 2 + 3, -W / 2 + 2.5, 4, W - 5, 2); ctx.fill();
        // atap
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        rr(-L / 2 + 8, -W / 2 + 2.5, L - 21, W - 5, 3); ctx.fill();

        if (vehicle.type === 'AMBULANCE') {
          ctx.fillStyle = '#e0413b';
          ctx.fillRect(-L / 2 + 8, -1.6, L - 21, 3.2);
          ctx.fillRect(-2.5 - 3, -5, 3.2, 10);
        }
        if (vehicle.type === 'DAMKAR') {
          ctx.strokeStyle = 'rgba(235, 238, 242, 0.75)'; ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(-L / 2 + 6, -3); ctx.lineTo(L / 2 - 15, -3);
          ctx.moveTo(-L / 2 + 6, 3); ctx.lineTo(L / 2 - 15, 3);
          for (let k = -L / 2 + 8; k < L / 2 - 15; k += 5) { ctx.moveTo(k, -3); ctx.lineTo(k, 3); }
          ctx.stroke();
        }
      }

      // lampu depan & belakang (rem menyala saat melambat)
      ctx.fillStyle = '#fff3d6';
      ctx.fillRect(L / 2 - 2, -W / 2 + 1.5, 2, 3); ctx.fillRect(L / 2 - 2, W / 2 - 4.5, 2, 3);
      ctx.save();
      ctx.fillStyle = slow ? '#ff4d45' : '#8a2b28';
      if (slow) { ctx.shadowColor = '#ff4d45'; ctx.shadowBlur = 8; }
      ctx.fillRect(-L / 2, -W / 2 + 1.5, 2, 3.2); ctx.fillRect(-L / 2, W / 2 - 4.7, 2, 3.2);
      ctx.restore();

      if (vehicle.isEmergency) {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = blink ? '#ff5047' : '#4c8dff';
        ctx.fillStyle = blink ? '#ff5047' : '#4c8dff';
        rr(2, -W / 2 + 1.5, 5, W / 2 - 2, 1.5); ctx.fill();
        ctx.shadowColor = blink ? '#4c8dff' : '#ff5047';
        ctx.fillStyle = blink ? '#4c8dff' : '#ff5047';
        rr(2, 0.5, 5, W / 2 - 2, 1.5); ctx.fill();
        ctx.restore();
      }
    };

    // bounding box gaya deteksi kamera (sudut + label)
    const drawDetection = (vehicle: Vehicle) => {
      const color = vehicle.isEmergency ? '#ff5d55' : vehicle.inROI ? '#36d68a' : '#7fb0ff';
      const half = vehicle.length / 2 + 5;
      const x0 = vehicle.x - half; const y0 = vehicle.y - half; const s = half * 2; const c = 6;
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x0, y0 + c); ctx.lineTo(x0, y0); ctx.lineTo(x0 + c, y0);
      ctx.moveTo(x0 + s - c, y0); ctx.lineTo(x0 + s, y0); ctx.lineTo(x0 + s, y0 + c);
      ctx.moveTo(x0 + s, y0 + s - c); ctx.lineTo(x0 + s, y0 + s); ctx.lineTo(x0 + s - c, y0 + s);
      ctx.moveTo(x0 + c, y0 + s); ctx.lineTo(x0, y0 + s); ctx.lineTo(x0, y0 + s - c);
      ctx.stroke();
      ctx.globalAlpha = 0.25; ctx.lineWidth = 1;
      ctx.strokeRect(x0, y0, s, s);
      ctx.globalAlpha = 1;
      const tag = `${vehicle.type} ${vehicle.turnType[0]} ${vehicle.confidence}`;
      ctx.font = `600 10px ${MONO_FONT}`;
      const tw = ctx.measureText(tag).width;
      ctx.fillStyle = color;
      rr(x0, y0 - 15, tw + 8, 13, 3); ctx.fill();
      ctx.fillStyle = '#0a0d12';
      ctx.fillText(tag, x0 + 4, y0 - 5);
      ctx.restore();
    };

    // HUD di pojok kanvas (koordinat layar): jam LIVE & kompas
    const drawHud = (cssW: number) => {
      ctx.save();
      const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
      ctx.font = `700 12px ${UI_FONT}`;
      const liveW = ctx.measureText('LIVE').width;
      ctx.font = `600 12px ${UI_FONT}`;
      const timeW = ctx.measureText(time).width;
      const w = 30 + liveW + 10 + timeW + 16;
      ctx.fillStyle = 'rgba(12, 11, 10, 0.72)';
      rr(22, 22, w, 32, 16); ctx.fill();
      ctx.strokeStyle = 'rgba(220, 199, 161, 0.22)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.save();
      const on = Math.floor(Date.now() / 700) % 2 === 0;
      ctx.fillStyle = on ? '#ff8170' : 'rgba(255, 129, 112, 0.35)';
      if (on) { ctx.shadowColor = '#ff8170'; ctx.shadowBlur = 8; }
      ctx.beginPath(); ctx.arc(39, 38, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.font = `700 12px ${UI_FONT}`;
      ctx.fillStyle = '#f4efe6';
      ctx.fillText('LIVE', 50, 42.5);
      ctx.font = `600 12px ${UI_FONT}`;
      ctx.fillStyle = 'rgba(244, 239, 230, 0.7)';
      ctx.fillText(time, 50 + liveW + 10, 42.5);

      // kompas
      const kx = cssW - 44; const ky = 44;
      ctx.fillStyle = 'rgba(12, 11, 10, 0.72)';
      ctx.beginPath(); ctx.arc(kx, ky, 20, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(220, 199, 161, 0.22)'; ctx.stroke();
      ctx.fillStyle = '#dcc7a1';
      ctx.beginPath(); ctx.moveTo(kx, ky - 12); ctx.lineTo(kx - 4.5, ky + 1); ctx.lineTo(kx + 4.5, ky + 1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(244, 239, 230, 0.25)';
      ctx.beginPath(); ctx.moveTo(kx, ky + 12); ctx.lineTo(kx - 4.5, ky + 1); ctx.lineTo(kx + 4.5, ky + 1); ctx.closePath(); ctx.fill();
      ctx.font = `700 9px ${UI_FONT}`;
      ctx.fillStyle = '#f4efe6';
      ctx.textAlign = 'center';
      ctx.fillText('N', kx - 11, ky - 9);
      ctx.restore();
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

      // ── mulai dari sini hanya menggambar ──
      const { dpr, cssW, cssH } = fitCanvas();
      const fit = cssW / BASE_WIDTH;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.save();
      ctx.translate(cssW / 2 + camPanRef.current.x, cssH / 2 + camPanRef.current.y);
      ctx.scale(zoomRef.current * fit, zoomRef.current * fit);

      const stA = lightStateRef.current.A;
      const stB = lightStateRef.current.B;

      const frameAt = performance.now();
      const dt = Math.min(100, frameAt - lastFrameAt);
      lastFrameAt = frameAt;
      const alive = new Set<number>();
      vehiclesRef.current.forEach((v) => {
        alive.add(v.id);
        const prev = waitMs.get(v.id) ?? 0;
        waitMs.set(v.id, !v.passedStopLine && v.speed < 0.3 ? prev + dt : prev);
      });
      waitMs.forEach((_, id) => { if (!alive.has(id)) waitMs.delete(id); });
      if (selectedIdRef.current !== null && !alive.has(selectedIdRef.current)) selectedIdRef.current = null;
      updateHeat(dt);

      drawScene();
      if (nightRef.current) drawNight();
      if (heatRef.current) drawHeat();
      drawStopLines(stA.color, stB.color);
      Object.entries(CAMERA_ROIS).forEach(drawCameraZone);

      const blink = Math.floor(Date.now() / 140) % 2 === 0;
      vehiclesRef.current.forEach((vehicle) => {
        ctx.save();
        ctx.translate(vehicle.x, vehicle.y); ctx.rotate(vehicle.angle);
        drawVehicleBody(vehicle, blink);
        ctx.restore();
      });
      if (showBBoxRef.current) vehiclesRef.current.forEach(drawDetection);
      const selected = selectedIdRef.current !== null ? vehiclesRef.current.find((v) => v.id === selectedIdRef.current) : undefined;
      if (selected) {
        ctx.save();
        ctx.strokeStyle = '#dcc7a1'; ctx.lineWidth = 2.5; ctx.setLineDash([5, 4]);
        ctx.lineDashOffset = -(frameAt / 40) % 9;
        ctx.beginPath(); ctx.arc(selected.x, selected.y, selected.length / 2 + 12, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }

      drawSignalBox(140, -230, 'A · North', stA.color, stA.duration);
      drawSignalBox(-180, 160, 'A · South', stA.color, stA.duration);
      drawSignalBox(-232, -222, 'B · West', stB.color, stB.duration);
      drawSignalBox(160, 140, 'B · East', stB.color, stB.duration);

      ctx.restore();

      // vignette halus + HUD
      const vg = ctx.createRadialGradient(cssW / 2, cssH / 2, Math.min(cssW, cssH) * 0.45, cssW / 2, cssH / 2, Math.max(cssW, cssH) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, cssW, cssH);
      if (selected) {
        const scale = zoomRef.current * fit;
        drawSelection(selected, cssW / 2 + camPanRef.current.x + selected.x * scale, cssH / 2 + camPanRef.current.y + selected.y * scale, cssW, cssH);
      }
      const hs = Math.min(1, Math.max(0.6, cssW / 760)); // HUD mengecil di layar sempit
      ctx.save(); ctx.scale(hs, hs);
      drawHud(cssW / hs);
      ctx.restore();

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);
    return () => {
      cancelAnimationFrame(animationFrameId);
      canvas.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKey);
    };
  }, [vehiclesRef, lightStateRef, camPanRef]);

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    downPosRef.current = { x: e.clientX, y: e.clientY };
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

  // klik (tanpa menggeser) = pilih kendaraan terdekat untuk ditampilkan detailnya
  const onClickSelect = (e: React.MouseEvent<HTMLCanvasElement>) => {
    onMouseUp();
    const moved = Math.hypot(e.clientX - downPosRef.current.x, e.clientY - downPosRef.current.y);
    if (moved > 4) return;
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width; const cssH = rect.height;
    const scale = zoomRef.current * (cssW / BASE_WIDTH);
    const wx = (e.clientX - rect.left - cssW / 2 - camPanRef.current.x) / scale;
    const wy = (e.clientY - rect.top - cssH / 2 - camPanRef.current.y) / scale;
    let best: Vehicle | null = null; let bestD = Infinity;
    vehiclesRef.current.forEach((v) => {
      const d = Math.hypot(v.x - wx, v.y - wy);
      if (d < v.length / 2 + 10 && d < bestD) { best = v; bestD = d; }
    });
    selectedIdRef.current = best ? (best as Vehicle).id : null;
  };

  const toggleFullscreen = () => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };

  // banner berasal dari logika App; emoji disembunyikan & teks diterjemahkan di tampilan saja
  const bannerText = emergencyBanner
    ?.replace(/^\p{Extended_Pictographic}\s*/u, '')
    .replace('PRIORITAS SIMPANG', 'PRIORITY TO INTERSECTION')
    .replace('DAMKAR', 'FIRE TRUCK') ?? null;

  // jumlah kendaraan untuk chip kamera (dibaca tiap 0,5 detik)
  const [vehicleCount, setVehicleCount] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setVehicleCount(vehiclesRef.current.length), 500);
    return () => window.clearInterval(t);
  }, [vehiclesRef]);

  const setZoom = (z: number) => onZoomChange(Math.min(1.4, Math.max(0.35, Number(z.toFixed(2)))));
  const scenario = scenarioStatusText.replace(/^Mode:\s*/, '');

  return (
    <section className="surface map-card" aria-label="Intersection Camera">
      <div className="stage" id="camera-stage" ref={stageRef}>
        <canvas
          ref={canvasRef}
          width={BASE_WIDTH}
          height={600}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onClickSelect}
          onMouseLeave={onMouseUp}
          aria-label="Top-down view of the intersection and vehicles. Click a vehicle for details."
          title="Click a vehicle for details · Scroll to zoom · Drag to pan"
        />
        <i className="corner c1" aria-hidden /><i className="corner c2" aria-hidden />
        <i className="corner c3" aria-hidden /><i className="corner c4" aria-hidden />
        {bannerText && <div className="alert" role="status">{bannerText}</div>}
        <span className="map-chip" title={scenario}>
          <i aria-hidden />Live Camera · {vehicleCount} Vehicles{nightMode ? ' · Night' : ''}
        </span>
        <div className="map-zoom">
          <button aria-label="Zoom Out" onClick={() => setZoom(camZoom - 0.12)}>−</button>
          <button aria-label="Zoom In" onClick={() => setZoom(camZoom + 0.12)}>+</button>
          <span>{Math.round(camZoom * 100)}%</span>
          <button className="txt" onClick={() => { camPanRef.current = { x: 0, y: 0 }; setZoom(0.55); }} title="Reset View (R)">Reset</button>
          <button className="txt" onClick={toggleFullscreen} title="Fullscreen (F)" aria-label="Fullscreen">⤢</button>
        </div>
      </div>
      <div className="map-legend">
        <span><i className="sw sw-car" />Car</span>
        <span><i className="sw sw-truck" />Truck</span>
        <span><i className="sw sw-emg" />Emergency</span>
        <span><i className="sw sw-roi" />Camera Zone</span>
        <span><i className="sw sw-det" />Detected</span>
        <span><i className="sw sw-brake" />Braking</span>
        {showHeatmap && <span><i className="sw sw-heat" />Queue Density</span>}
        <span className="map-legend-hint">Click a vehicle for details · Scroll to zoom · Drag to pan</span>
      </div>
    </section>
  );
};

// gelap/terangkan warna hex (tampilan saja)
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.round(Math.min(255, Math.max(0, amt >= 0 ? c + (255 - c) * amt : c * (1 + amt))));
  const r = f((n >> 16) & 255); const g = f((n >> 8) & 255); const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
