import type { AxisId, VehicleType } from '../types/simulator';
import { reportApiResult } from './connectionStatus';

async function readJson(response: Response) {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

// Sama persis dengan fetch biasa (request & hasil tidak diubah);
// hanya mencatat berhasil/gagal untuk indikator koneksi di tampilan.
async function trackedFetch(url: string, init?: RequestInit): Promise<Response> {
  const startedAt = performance.now();
  try {
    const response = await fetch(url, init);
    const reachable = response.status < 500;
    reportApiResult(
      reachable,
      performance.now() - startedAt,
      response.ok ? null : `HTTP ${response.status} at ${url}`,
    );
    return response;
  } catch (error) {
    reportApiResult(false, performance.now() - startedAt, `Could not reach ${url}`);
    throw error;
  }
}

export const TrafficApi = {
  async fetchSystemState() {
    const [intRes, logRes] = await Promise.all([
      trackedFetch('/api/intersections'),
      trackedFetch('/api/logs'),
    ]);
    const [intJson, logJson] = await Promise.all([
      readJson(intRes),
      readJson(logRes),
    ]);
    return { intJson, logJson };
  },

  async sendSensorData(intersectionId: AxisId, vehicleCount: number) {
    const res = await trackedFetch('/api/sensor', {
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
    const res = await trackedFetch('/api/override', {
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

  // Kendali manual operator: memakai endpoint override yang sama (backend tidak diubah)
  async sendManualOverride(intersectionId: AxisId, newDuration: number, reason: string) {
    const res = await trackedFetch('/api/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intersectionId,
        newDuration,
        reason,
        operatorId: 'OPERATOR_MANUAL',
      }),
    });
    return readJson(res);
  },
};
