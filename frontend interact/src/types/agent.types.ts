export type DecisionSource = 'AGENT' | 'MANUAL_OVERRIDE' | 'FALLBACK_RULE';
export type LightColor = 'RED' | 'YELLOW' | 'GREEN';

export interface SensorInput {
  intersectionId: string;
  vehicleCount: number;
  overrideDuration?: number;
  overrideReason?: string;
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
  source: DecisionSource;
}

export interface TrafficLightStateResult {
  intersectionId: string;
  color: string;
  greenDuration: number;
  updatedAt: Date;
}

export interface AgentProcessResult {
  intersectionId: string;
  vehicleCount: number;
  previousDuration: number;
  newGreenDuration: number;
  lightColor: string;
  congestionLevel: string;
  decisionReason: string;
  decisionSource: DecisionSource;
  neighborNotified: boolean;
  targetNeighborId?: string;
  timestamp: Date;
}