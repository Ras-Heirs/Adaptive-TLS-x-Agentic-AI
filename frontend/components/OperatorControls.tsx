import type { Scenario } from "@/lib/types";

const SCENARIOS: { id: Scenario; icon: string; label: string }[] = [
  { id: "normal", icon: "🚗", label: "Normal" },
  { id: "rush", icon: "🕔", label: "Jam sibuk" },
  { id: "accident", icon: "🚧", label: "Kecelakaan" },
];

interface Props {
  scenario: Scenario;
  override: boolean;
  onScenario: (s: Scenario) => void;
  onOverride: (on: boolean) => void;
}

export default function OperatorControls({ scenario, override, onScenario, onOverride }: Props) {
  return (
    <section aria-labelledby="ctrl-heading">
      <h2 id="ctrl-heading" className="mb-4 text-lg font-bold">Kontrol Operator</h2>
      <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
        <div className="rounded-[20px] bg-white p-6 shadow-card">
          <h3 className="mb-4 font-bold">Skenario simulasi</h3>
          <div role="radiogroup" aria-label="Skenario simulasi" className="grid grid-cols-3 gap-3">
            {SCENARIOS.map((s) => {
              const active = s.id === scenario;
              return (
                <button
                  key={s.id}
                  role="radio"
                  aria-checked={active}
                  onClick={() => onScenario(s.id)}
                  className={`rounded-xl border-2 px-4 py-4 text-left text-sm font-semibold transition-colors ${
                    active
                      ? "border-sky bg-gradient-to-br from-[#EAF3FD] to-[#DCEBFA] text-sky-deep"
                      : "border-transparent bg-[#F4F7FB] text-ink-soft hover:bg-[#EAF0F8]"
                  }`}
                >
                  <span className="mb-2 block text-xl" aria-hidden>{s.icon}</span>
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-[20px] bg-white p-6 shadow-card">
          <h3 className="mb-2 font-bold">Override darurat</h3>
          <p className="mb-5 text-sm leading-relaxed text-ink-soft">
            Ambil alih kendali manual pada seluruh simpang. Keputusan agent dijeda sampai override dimatikan.
          </p>
          <button
            onClick={() => onOverride(!override)}
            aria-pressed={override}
            className={`w-full rounded-xl px-4 py-3.5 text-sm font-bold text-white shadow-[0_8px_18px_-8px_rgba(240,138,30,0.7)] transition-transform active:scale-[0.99] ${
              override
                ? "bg-gradient-to-r from-signal-red to-signal-redDark"
                : "bg-gradient-to-r from-sun to-sun-deep"
            }`}
          >
            {override ? "Matikan override manual" : "Aktifkan override manual"}
          </button>
        </div>
      </div>
    </section>
  );
}
