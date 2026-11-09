export type LightState = "green" | "yellow" | "red";
export type Scenario = "normal" | "rush" | "accident";
export type DecisionStatus = "approved" | "fallback" | "rejected";

export interface Intersection {
  id: "A" | "B" | "C";
  name: string;
  street: string;
  light: LightState;
  secondsLeft: number;
  queue: number;
  maxQueue: number;
}

export interface Decision {
  id: string;
  time: string; // HH:MM:SS
  intersection: Intersection["id"];
  greenSeconds: number;
  reason: string;
  status: DecisionStatus;
}

export interface WaitMetric {
  intersection: Intersection["id"];
  fixed: number; // detik, jadwal tetap
  agent: number; // detik, sistem agent
}

/** Kontrak data yang dipakai dashboard. Backend cukup mengirim event ini. */
export interface TrafficSnapshot {
  intersections: Intersection[];
  decisions: Decision[];
  metrics: WaitMetric[];
  scenario: Scenario;
  override: boolean;
}

export interface TrafficFeed extends TrafficSnapshot {
  connected: boolean;
  mode: "simulasi" | "socket";
  setScenario: (s: Scenario) => void;
  setOverride: (on: boolean) => void;
}
