// Pencatat status koneksi ke backend (tampilan saja).
// Diisi oleh trafficApi setiap kali sebuah request selesai atau gagal.

export type ConnectionPhase = 'unknown' | 'online' | 'offline';

export interface ConnectionState {
  phase: ConnectionPhase;
  latencyMs: number | null;
  lastOkAt: number | null;
  lastError: string | null;
  lastErrorAt: number | null;
  consecutiveFailures: number;
}

let state: ConnectionState = {
  phase: 'unknown',
  latencyMs: null,
  lastOkAt: null,
  lastError: null,
  lastErrorAt: null,
  consecutiveFailures: 0,
};

const listeners = new Set<() => void>();

export function getConnectionState(): ConnectionState {
  return state;
}

export function subscribeConnection(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** reachable = server menjawab (status < 500). Status 4xx tetap dianggap terhubung. */
export function reportApiResult(reachable: boolean, latencyMs: number, error: string | null) {
  const now = Date.now();
  state = reachable
    ? {
      ...state,
      phase: 'online',
      latencyMs: Math.round(latencyMs),
      lastOkAt: now,
      consecutiveFailures: 0,
      lastError: error ?? state.lastError,
      lastErrorAt: error ? now : state.lastErrorAt,
    }
    : {
      ...state,
      phase: 'offline',
      latencyMs: null,
      lastError: error,
      lastErrorAt: now,
      consecutiveFailures: state.consecutiveFailures + 1,
    };
  listeners.forEach((listener) => listener());
}
