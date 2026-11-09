import type { AxisId, VehicleType } from '../types/simulator';

async function readJson(response: Response) {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export const TrafficApi = {
  async fetchSystemState() {
    const [intRes, logRes] = await Promise.all([
      fetch('/api/intersections'),
      fetch('/api/logs'),
    ]);
    const [intJson, logJson] = await Promise.all([
      readJson(intRes),
      readJson(logRes),
    ]);
    return { intJson, logJson };
  },

  async sendSensorData(intersectionId: AxisId, vehicleCount: number) {
    const res = await fetch('/api/sensor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intersectionId, vehicleCount }),
    });
    return readJson(res);
  },

  async sendEmergencyOverride(
    intersectionId: AxisId,
    vehicleType: VehicleType,
    dir: string,
  ) {
    const res = await fetch('/api/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intersectionId,
        newDuration: 80,
        reason: `AI Camera Supervision (${dir}): Prioritas Darurat ${vehicleType}`,
        operatorId: 'AI_VISION_SUPERVISOR',
      }),
    });
    return readJson(res);
  },
};
