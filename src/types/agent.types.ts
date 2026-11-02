export interface SensorInput {
  intersectionId: string;
  vehicleCount: number;
}

export interface RawDecision {
  proposedDuration: number;
  reason: string;
  shouldNotifyNeighbor: boolean;
  congestionLevel: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
}

export interface ValidatedDecision {
  finalDuration: number;
  reason: string;
  wasClamped: boolean;
}

export interface AgentProcessResult {
  intersectionId: string;
  vehicleCount: number;
  previousDuration: number;
  newGreenDuration: number;
  lightColor: string;
  congestionLevel: string;
  decisionReason: string;
  neighborNotified: boolean;
  targetNeighborId?: string;
  timestamp: Date;
}