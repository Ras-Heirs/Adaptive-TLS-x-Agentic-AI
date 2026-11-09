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

export function stepVehiclesPhysics(
  vehicles: Vehicle[],
  lightColors: Record<AxisId, LightColor>,
): Vehicle[] {
  const oppositeDir: Record<Direction, Direction> = { N: 'S', S: 'N', W: 'E', E: 'W' };

  vehicles.forEach((v) => {
    const target = v.waypoints[v.wpIndex];
    if (!target) return;

    const dx = target.x - v.x;
    const dy = target.y - v.y;
    const distToWp = Math.hypot(dx, dy);
    let mustStop = false;

    if (!v.passedStopLine && v.wpIndex === 1) {
      const axisColor = lightColors[v.axis];
      if (axisColor !== 'GREEN' && distToWp <= 28) mustStop = true;
      if (axisColor === 'GREEN' && distToWp <= 24) {
        const perpAxis: AxisId = v.axis === 'A' ? 'B' : 'A';
        const perpBlocking = vehicles.some(
          (other) => other.axis === perpAxis &&
            Math.abs(other.x) < 130 && Math.abs(other.y) < 130,
        );
        if (perpBlocking) mustStop = true;
      }
    }

    if (v.turnType === 'RIGHT' && v.passedStopLine &&
      Math.abs(v.x) < 120 && Math.abs(v.y) < 120) {
      const opp = oppositeDir[v.dir];
      const oncomingConflict = vehicles.some(
        (other) => other.dir === opp &&
          other.turnType !== 'RIGHT' &&
          other.passedStopLine &&
          Math.abs(other.x) < 145 && Math.abs(other.y) < 145,
      );
      if (oncomingConflict && v.wpIndex <= 3) mustStop = true;
    }

    for (const other of vehicles) {
      if (other.id === v.id) continue;
      if (!v.passedStopLine &&
        (other.dir !== v.dir || other.laneOffset !== v.laneOffset)) continue;

      const dist = Math.hypot(other.x - v.x, other.y - v.y);
      const minSafeDist = (v.length + other.length) * 0.5 + 14;
      if (dist < minSafeDist) {
        const angleToOther = Math.atan2(other.y - v.y, other.x - v.x);
        let angleDiff = Math.abs(angleToOther - v.angle);
        if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
        if (angleDiff < 0.42) {
          mustStop = true;
          break;
        }
      }
    }

    v.speed = mustStop
      ? Math.max(0, v.speed - 0.35)
      : Math.min(v.maxSpeed, v.speed + 0.14);

    if (v.speed > 0.01) {
      const desiredAngle = Math.atan2(dy, dx);
      let diff = desiredAngle - v.angle;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      v.angle += diff * 0.28;
      v.x += Math.cos(v.angle) * v.speed;
      v.y += Math.sin(v.angle) * v.speed;
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
