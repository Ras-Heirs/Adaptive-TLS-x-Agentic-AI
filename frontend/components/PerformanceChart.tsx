import type { WaitMetric } from "@/lib/types";

const TOP = 80; // skala sumbu-y (detik)
const TICKS = [80, 40, 0];

export default function PerformanceChart({ metrics }: { metrics: WaitMetric[] }) {
  return (
    <section aria-labelledby="perf-heading">
      <h2 id="perf-heading" className="mb-4 text-lg font-bold">Evaluasi Performa</h2>
      <div className="rounded-[20px] bg-white p-6 shadow-card">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold">Rata-rata waktu tunggu per simpang (detik)</h3>
          <ul className="flex gap-4 text-xs font-semibold text-ink-soft">
            <li className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-[3px] bg-[#CBD8E8]" /> Jadwal tetap
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-[3px] bg-sky" /> Sistem agent
            </li>
          </ul>
        </div>

        <div className="flex gap-3">
          <div className="flex h-[150px] flex-col justify-between text-[11px] font-semibold text-ink-soft" aria-hidden>
            {TICKS.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
          <div className="flex-1">
            <div className="relative flex h-[150px] items-end justify-around border-b border-line">
              {TICKS.slice(0, 2).map((t) => (
                <div
                  key={t}
                  aria-hidden
                  className="absolute inset-x-0 border-t border-dashed border-line"
                  style={{ bottom: `${(t / TOP) * 100}%` }}
                />
              ))}
              {metrics.map((m) => (
                <div
                  key={m.intersection}
                  className="relative z-10 flex h-full items-end gap-1.5"
                  role="img"
                  aria-label={`Simpang ${m.intersection}: jadwal tetap ${m.fixed} detik, sistem agent ${m.agent} detik`}
                >
                  <div className="w-[30px] rounded-t-md bg-[#CBD8E8]" style={{ height: `${(m.fixed / TOP) * 100}%`, minHeight: 4 }} />
                  <div
                    className="w-[30px] rounded-t-md bg-gradient-to-b from-sky to-sky-deep"
                    style={{ height: `${(m.agent / TOP) * 100}%`, minHeight: 4 }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-around text-xs font-semibold text-ink-soft">
              {metrics.map((m) => (
                <span key={m.intersection}>Simpang {m.intersection}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
