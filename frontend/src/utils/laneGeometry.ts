import type {
  CameraROI, Direction, Point, TurnType, Vehicle, VehicleType,
  AxisId, LightColor,
} from '../types/simulator';

export const CAMERA_ROIS: Record<Direction, CameraROI> = {
  N: { x: 8, y: -660, w: 106, h: 520, axis: 'A', label: 'CAM-A1 (UTARA)' },
  S: { x: -114, y: 140, w: 106, h: 520, axis: 'A', label: 'CAM-A2 (SELATAN)' },
  W: { x: -660, y: -114, w: 520, h: 106, axis: 'B', label: 'CAM-B1 (BARAT)' },
  E: { x: 140, y: 8, w: 520, h: 106, axis: 'B', label: 'CAM-B2 (TIMUR)' },
};

export function isInsideBox(x: number, y: number, box: CameraROI): boolean {
  return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
}

export function buildWaypoints(
  dir: Direction,
  turnType: TurnType,
): { laneOffset: number; points: Point[] } {
  const outer = 84;
  const inner = 36;
  const spawnDist = 920;
  const stopDist = 148;

  const subLane = turnType === 'LEFT'
    ? outer
    : turnType === 'RIGHT'
      ? inner
      : Math.random() > 0.5 ? outer : inner;

  if (dir === 'N') {
    const start = { x: subLane, y: -spawnDist };
    const stop = { x: subLane, y: -stopDist };
    if (turnType === 'STRAIGHT') {
      return { laneOffset: subLane, points: [start, stop, { x: subLane, y: 960 }] };
    }
    if (turnType === 'LEFT') {
      return { laneOffset: subLane, points: [start, stop, { x: 92, y: -105 }, { x: 115, y: -88 }, { x: 155, y: -outer }, { x: 960, y: -outer }] };
    }
    return { laneOffset: subLane, points: [start, stop, { x: 32, y: -45 }, { x: 0, y: 12 }, { x: -55, y: 34 }, { x: -155, y: inner }, { x: -960, y: inner }] };
  }

  if (dir === 'S') {
    const start = { x: -subLane, y: spawnDist };
    const stop = { x: -subLane, y: stopDist };
    if (turnType === 'STRAIGHT') {
      return { laneOffset: subLane, points: [start, stop, { x: -subLane, y: -960 }] };
    }
    if (turnType === 'LEFT') {
      return { laneOffset: subLane, points: [start, stop, { x: -92, y: 105 }, { x: -115, y: 88 }, { x: -155, y: outer }, { x: -960, y: outer }] };
    }
    return { laneOffset: subLane, points: [start, stop, { x: -32, y: 45 }, { x: 0, y: -12 }, { x: 55, y: -34 }, { x: 155, y: -inner }, { x: 960, y: -inner }] };
  }

  if (dir === 'W') {
    const start = { x: -spawnDist, y: -subLane };
    const stop = { x: -stopDist, y: -subLane };
    if (turnType === 'STRAIGHT') {
      return { laneOffset: subLane, points: [start, stop, { x: 960, y: -subLane }] };
    }
    if (turnType === 'LEFT') {
      return { laneOffset: subLane, points: [start, stop, { x: -105, y: -92 }, { x: -88, y: -115 }, { x: -outer, y: -155 }, { x: -outer, y: -960 }] };
    }
    return { laneOffset: subLane, points: [start, stop, { x: -45, y: -32 }, { x: 12, y: 0 }, { x: 34, y: 55 }, { x: inner, y: 155 }, { x: inner, y: 960 }] };
  }

  const start = { x: spawnDist, y: subLane };
  const stop = { x: stopDist, y: subLane };
  if (turnType === 'STRAIGHT') {
    return { laneOffset: subLane, points: [start, stop, { x: -960, y: subLane }] };
  }
  if (turnType === 'LEFT') {
    return { laneOffset: subLane, points: [start, stop, { x: 105, y: 92 }, { x: 88, y: 115 }, { x: outer, y: 155 }, { x: outer, y: 960 }] };
  }
  return { laneOffset: subLane, points: [start, stop, { x: 45, y: 32 }, { x: -12, y: 0 }, { x: -34, y: -55 }, { x: -inner, y: -155 }, { x: -inner, y: -960 }] };
}

export function createVehicle(
  id: number,
  dir: Direction,
  type: VehicleType,
  existingVehicles: Vehicle[],
): Vehicle | null {
  const axis: AxisId = dir === 'N' || dir === 'S' ? 'A' : 'B';
  const isEmergency = type === 'AMBULANCE' || type === 'DAMKAR';
  const rand = Math.random();
  const turnType: TurnType = isEmergency
    ? rand < 0.75 ? 'STRAIGHT' : 'LEFT'
    : rand < 0.55 ? 'STRAIGHT' : rand < 0.8 ? 'LEFT' : 'RIGHT';

  const route = buildWaypoints(dir, turnType);
  const waypoints = route.points;
  const laneOffset = route.laneOffset;
  const startPt = { ...waypoints[0] };
  const sameSubLane = existingVehicles.filter(
    (v) => v.dir === dir && v.laneOffset === laneOffset,
  );

  if (sameSubLane.length >= 10 && !isEmergency) return null;

  sameSubLane.forEach((v) => {
    if (dir === 'N') startPt.y = Math.min(startPt.y, v.y - 62);
    if (dir === 'S') startPt.y = Math.max(startPt.y, v.y + 62);
    if (dir === 'W') startPt.x = Math.min(startPt.x, v.x - 62);
    if (dir === 'E') startPt.x = Math.max(startPt.x, v.x + 62);
  });

  const nextPt = waypoints[1];
  const angle = Math.atan2(nextPt.y - startPt.y, nextPt.x - startPt.x);

  return {
    id, axis, dir, laneOffset, type, turnType, isEmergency,
    x: startPt.x, y: startPt.y, angle,
    length: type === 'TRUCK' || type === 'DAMKAR' ? 44 : 36,
    width: 20,
    speed: isEmergency ? 3.1 : 2.2,
    maxSpeed: isEmergency ? 3.2 : type === 'TRUCK' ? 1.85 : 2.3,
    waypoints, wpIndex: 1,
    passedStopLine: false,
    emergencyTriggered: false,
    confidence: (0.92 + Math.random() * 0.07).toFixed(2),
  };
}

// ── Fisika kendaraan ──────────────────────────────────────────────
// Aturan utama: keputusan "boleh masuk simpang" diambil di garis henti, bukan di
// dalam kotak simpang. Kendaraan yang sudah masuk kotak tidak pernah menunggu
// kendaraan lain di dalam kotak, sehingga tidak ada lagi saling tunggu (gridlock).
const ACCEL = 0.14; // px/frame²
const BRAKE = 0.3; // perlambatan yang direncanakan
const MAX_BRAKE = 0.6; // perlambatan maksimum
const FOLLOW_BUFFER = 10; // jarak antar-bumper yang dijaga saat mengikuti
const MIN_BUMPER_GAP = 4; // batas keras: bodi kendaraan tidak pernah lebih dekat dari ini
const GATE_RANGE = 90; // mulai menilai izin masuk simpang dari jarak ini
const STOP_BEFORE = 18; // titik berhenti, sebelum waypoint garis henti
const RIGHT_TURN_PRIORITY_FRAMES = 240; // ±4 detik menunggu saat hijau → arus lawan arah memberi giliran
const COMMIT_RANGE = 45; // di jarak ini kendaraan yang diizinkan masuk "memesan" simpang
const BOX = 175; // area simpang: mencakup garis henti (148 + 16) sampai mulut jalan keluar

const OPPOSITE_DIR: Record<Direction, Direction> = { N: 'S', S: 'N', W: 'E', E: 'W' };

function distToStopLine(v: Vehicle): number {
  const wp = v.waypoints[1];
  return Math.hypot(wp.x - v.x, wp.y - v.y);
}

function isInBox(v: Vehicle): boolean {
  return v.passedStopLine && Math.abs(v.x) < BOX && Math.abs(v.y) < BOX;
}

/**
 * Reservasi simpang: kendaraan yang sudah dekat garis henti dan diizinkan masuk dicatat di sini.
 * Kendaraan lain dengan lintasan berpotongan menunggu sampai reservasi itu keluar dari simpang.
 * Hanya menyimpan id kendaraan; tidak mengubah tipe data Vehicle.
 */
const committed = new Set<number>();

/** Lama (frame) kendaraan belok kanan menunggu di garis henti saat lampunya hijau. */
const greenWaitFrames = new Map<number, number>();

function occupiesBox(v: Vehicle): boolean {
  return isInBox(v) || committed.has(v.id);
}

/** Konflik lintasan yang membuat kendaraan harus menunggu di garis henti. */
function hasConflict(v: Vehicle, vehicles: Vehicle[]): boolean {
  const opp = OPPOSITE_DIR[v.dir];
  for (const o of vehicles) {
    if (o.id === v.id || !occupiesBox(o)) continue;
    // poros tegak lurus masih memakai simpang (misal sisa fase kuning)
    if (o.axis !== v.axis) return true;
    if (o.dir !== opp) continue;
    // belok kanan memotong arus lawan arah: tidak boleh bersamaan dengan kendaraan lawan arah
    if (v.turnType === 'RIGHT' || o.turnType === 'RIGHT') return true;
  }
  // keadilan: kendaraan belok kanan yang sudah lama menunggu mendapat giliran,
  // arus lawan arah yang belum masuk simpang menahan diri sebentar
  if (v.turnType !== 'RIGHT') {
    for (const o of vehicles) {
      if (o.dir === opp && o.turnType === 'RIGHT' &&
        (greenWaitFrames.get(o.id) ?? 0) > RIGHT_TURN_PRIORITY_FRAMES) return true;
    }
  }
  return false;
}

function isAheadOnSameRoute(o: Vehicle, v: Vehicle): boolean {
  if (o.dir !== v.dir || o.laneOffset !== v.laneOffset || o.turnType !== v.turnType) return false;
  if (o.wpIndex !== v.wpIndex) return o.wpIndex > v.wpIndex;
  const wp = v.waypoints[v.wpIndex];
  if (!wp) return false;
  return Math.hypot(wp.x - o.x, wp.y - o.y) < Math.hypot(wp.x - v.x, wp.y - v.y);
}

/** Jarak bumper ke kendaraan terdekat di depan pada jalur yang sama. */
function gapToLeader(v: Vehicle, vehicles: Vehicle[]): number {
  let best = Infinity;
  const cos = Math.cos(v.angle);
  const sin = Math.sin(v.angle);
  for (const o of vehicles) {
    if (o.id === v.id) continue;
    const dx = o.x - v.x;
    const dy = o.y - v.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 220) continue;
    const halfLengths = (v.length + o.length) / 2;
    if (!v.passedStopLine) {
      // sebelum garis henti: hanya antrean di lajur yang sama
      if (o.dir !== v.dir || o.laneOffset !== v.laneOffset) continue;
      const forward = dx * cos + dy * sin;
      if (!o.passedStopLine && forward <= 0) continue;
      best = Math.min(best, dist - halfLengths);
      continue;
    }
    // di dalam/setelah simpang: kendaraan di depan pada rute yang sama (termasuk di tikungan)
    if (isAheadOnSameRoute(o, v)) {
      best = Math.min(best, dist - halfLengths);
      continue;
    }
    // atau kendaraan lain yang juga sudah lewat garis henti dan tepat di depan moncong.
    // Kendaraan yang masih antre di lajur masuk tidak pernah berada di lintasan keluar.
    if (!o.passedStopLine) continue;
    const forward = dx * cos + dy * sin;
    const lateral = -dx * sin + dy * cos;
    if (forward > 0 && Math.abs(lateral) < (v.width + o.width) / 2 + 6) {
      // pengaman terakhir: kalau dua kendaraan saling berhadapan, yang datang lebih dulu tetap jalan
      const oCos = Math.cos(o.angle);
      const oSin = Math.sin(o.angle);
      const oForward = -dx * oCos - dy * oSin;
      const oLateral = dx * oSin - dy * oCos;
      const mutual = oForward > 0 && Math.abs(oLateral) < (v.width + o.width) / 2 + 6;
      if (mutual && v.id < o.id) continue;
      best = Math.min(best, forward - halfLengths);
    }
  }
  return best;
}

/** Kecepatan tertinggi yang masih bisa berhenti dalam jarak `room`. */
function safeSpeed(room: number): number {
  return Math.sqrt(2 * BRAKE * Math.max(0, room));
}

export function stepVehiclesPhysics(
  vehicles: Vehicle[],
  lightColors: Record<AxisId, LightColor>,
): Vehicle[] {
  // bersihkan reservasi kendaraan yang sudah keluar simpang atau sudah hilang
  const alive = new Set(vehicles.map((v) => v.id));
  for (const id of committed) {
    const v = vehicles.find((x) => x.id === id);
    if (!alive.has(id) || (v && v.passedStopLine && !isInBox(v))) committed.delete(id);
  }
  for (const id of greenWaitFrames.keys()) if (!alive.has(id)) greenWaitFrames.delete(id);

  // Tahap 1: rencanakan kecepatan semua kendaraan dari posisi saat ini.
  // Diproses berurutan, jadi reservasi yang dibuat di frame ini langsung terlihat oleh kendaraan berikutnya.
  const plans = vehicles.map((v) => {
    const target = v.waypoints[v.wpIndex];
    if (!target) return { speed: v.speed, maxTravel: 0 };

    let desired = v.maxSpeed;
    let maxTravel = Infinity;

    // garis henti: lampu + konflik lintasan
    if (!v.passedStopLine && v.wpIndex === 1 && !committed.has(v.id)) {
      const d = Math.hypot(target.x - v.x, target.y - v.y);
      if (d < GATE_RANGE) {
        const color = lightColors[v.axis];
        const conflict = hasConflict(v, vehicles);
        let mayEnter = color === 'GREEN' && !conflict;
        if (!mayEnter && color === 'YELLOW' && !conflict) {
          // dilema kuning: kalau sudah tidak sempat berhenti dengan nyaman, lanjut
          const brakingDist = (v.speed * v.speed) / (2 * BRAKE);
          if (d - STOP_BEFORE < brakingDist) mayEnter = true;
        }
        if (v.turnType === 'RIGHT' && !mayEnter && color === 'GREEN' && d < 40) {
          greenWaitFrames.set(v.id, (greenWaitFrames.get(v.id) ?? 0) + 1);
        } else {
          greenWaitFrames.delete(v.id);
        }
        if (mayEnter && d < COMMIT_RANGE) {
          committed.add(v.id);
        } else if (!mayEnter) {
          desired = Math.min(desired, safeSpeed(d - STOP_BEFORE));
          maxTravel = Math.min(maxTravel, Math.max(0, d - 17)); // tidak pernah melewati garis henti
        }
      }
    }

    // kendaraan di depan
    const gap = gapToLeader(v, vehicles);
    if (gap < Infinity) {
      desired = Math.min(desired, safeSpeed(gap - FOLLOW_BUFFER));
      maxTravel = Math.min(maxTravel, Math.max(0, gap - MIN_BUMPER_GAP));
    }

    const speed = desired >= v.speed
      ? Math.min(desired, v.speed + ACCEL)
      : Math.max(desired, v.speed - MAX_BRAKE);
    return { speed, maxTravel };
  });

  // Tahap 2: gerakkan semua kendaraan (setir mengikuti waypoint seperti sebelumnya).
  vehicles.forEach((v, i) => {
    const target = v.waypoints[v.wpIndex];
    if (!target) return;
    const { speed, maxTravel } = plans[i];
    const travel = Math.max(0, Math.min(speed, maxTravel));
    v.speed = travel;

    const dx = target.x - v.x;
    const dy = target.y - v.y;
    const distToWp = Math.hypot(dx, dy);

    if (travel > 0.01) {
      const desiredAngle = Math.atan2(dy, dx);
      let diff = desiredAngle - v.angle;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      v.angle += diff * 0.28;
      v.x += Math.cos(v.angle) * travel;
      v.y += Math.sin(v.angle) * travel;
    }

    if (distToWp < 16) {
      if (v.wpIndex === 1) v.passedStopLine = true;
      v.wpIndex++;
    }
  });

  return vehicles.filter(
    (v) => v.wpIndex < v.waypoints.length &&
      Math.abs(v.x) < 1250 && Math.abs(v.y) < 1250,
  );
}
