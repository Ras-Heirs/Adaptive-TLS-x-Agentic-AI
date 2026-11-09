export type AxisId = 'A' | 'B';
export type Direction = 'N' | 'S' | 'W' | 'E';
export type SpawnDirOption = 'BOTH' | Direction;
export type TurnType = 'STRAIGHT' | 'LEFT' | 'RIGHT';
export type VehicleType = 'CAR' | 'TRUCK' | 'AMBULANCE' | 'DAMKAR';
export type LightColor = 'RED' | 'YELLOW' | 'GREEN';
export type ScenarioMode = 'NORMAL' | 'RUSH_HOUR' | 'NIGHT' | 'AUTO_CYCLE' | 'CUSTOM';

export interface Point { x: number; y: number; }

export interface CameraROI {
  x: number; y: number; w: number; h: number;
  axis: AxisId; label: string;
}

export interface Vehicle {
  id: number;
  axis: AxisId;
  dir: Direction;
  laneOffset: number;
  type: VehicleType;
  turnType: TurnType;
  isEmergency: boolean;
  x: number; y: number; angle: number;
  length: number; width: number;
  speed: number; maxSpeed: number;
  waypoints: Point[];
  wpIndex: number;
  passedStopLine: boolean;
  emergencyTriggered: boolean;
  inROI?: boolean;
  confidence: string;
}

export interface SignalAxisState {
  color: LightColor;
  duration: number;
  source: string;
  reason: string;
}

export interface AgentMessageRecord {
  id: string;
  senderId: string;
  receiverId: string;
  messageType: string;
  status: string;
  createdAt: string;
}

export interface AuditLogRecord {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
}
