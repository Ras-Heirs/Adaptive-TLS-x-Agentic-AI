import type { Decision, Intersection, Scenario, WaitMetric } from "./types";

const SEED: Intersection[] = [
  { id: "A", name: "Simpang A", street: "Jl. Margonda – Jl. Juanda", light: "green", secondsLeft: 42, queue: 18, maxQueue: 70 },
  { id: "B", name: "Simpang B", street: "Jl. Margonda – Jl. Raya Bogor", light: "red", secondsLeft: 15, queue: 63, maxQueue: 70 },
  { id: "C", name: "Simpang C", street: "Jl. Juanda – Jl. Raya Bogor", light: "yellow", secondsLeft: 3, queue: 27, maxQueue: 70 },
];

export const seedIntersections = (): Intersection[] => SEED.map((i) => ({ ...i }));

export const seedDecisions = (): Decision[] => [
  { id: "d3", time: "10:42:11", intersection: "C", greenSeconds: 45, reason: "Permintaan koordinasi dari Simpang B", status: "approved" },
  { id: "d2", time: "10:42:05", intersection: "B", greenSeconds: 60, reason: "Fallback — data sensor hilang", status: "fallback" },
  { id: "d1", time: "10:42:03", intersection: "A", greenSeconds: 80, reason: "Antrean melebihi 50 kendaraan", status: "approved" },
];

export const seedMetrics = (): WaitMetric[] => [
  { intersection: "A", fixed: 58, agent: 38 },
  { intersection: "B", fixed: 69, agent: 44 },
  { intersection: "C", fixed: 46, agent: 30 },
];

const DURATION: Record<Intersection["light"], number> = { green: 45, yellow: 4, red: 40 };
const NEXT: Record<Intersection["light"], Intersection["light"]> = {
  green: "yellow",
  yellow: "red",
  red: "green",
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Satu detik waktu simulasi: hitung mundur lampu + antrean bergerak. */
export function tick(list: Intersection[], scenario: Scenario, frozen: boolean) {
  const pressure = scenario === "rush" ? 4 : scenario === "accident" ? 2 : 0;
  const decisions: Decision[] = [];

  const next = list.map((s) => {
    let { light, secondsLeft, queue } = s;
    if (!frozen) secondsLeft -= 1;

    // Hijau mengurangi antrean, merah/kuning menambah.
    const delta = light === "green" ? -rand(1.2, 2.6) : rand(0.2, 1.1) + pressure * 0.15;
    queue = clamp(Math.round(queue + delta), 2, s.maxQueue);

    if (!frozen && secondsLeft <= 0) {
      light = NEXT[light];
      secondsLeft = DURATION[light];
      if (light === "green") {
        // Agent memutuskan durasi hijau dari panjang antrean.
        const greenSeconds = clamp(Math.round(30 + queue * 0.9), 30, 90);
        secondsLeft = greenSeconds;
        decisions.push({
          id: `${Date.now()}-${s.id}`,
          time: new Date().toLocaleTimeString("id-ID", { hour12: false }).replace(/\./g, ":"),
          intersection: s.id,
          greenSeconds,
          reason: queue > 50 ? "Antrean melebihi 50 kendaraan" : "Antrean normal, durasi standar",
          status: "approved",
        });
      }
    }
    return { ...s, light, secondsLeft, queue };
  });

  return { next, decisions };
}
