import type { Intersection, LightState } from "@/lib/types";

const THEME: Record<LightState, { head: string; bar: string; chip: string; label: string }> = {
  green: {
    head: "from-[#34B26B] to-[#1F8A4E]",
    bar: "bg-signal-green",
    chip: "bg-[#E1F5E9] text-signal-greenDark",
    label: "Hijau",
  },
  yellow: {
    head: "from-[#FFB020] to-[#F08A1E]",
    bar: "bg-sun",
    chip: "bg-[#FFF1D6] text-sun-deep",
    label: "Kuning",
  },
  red: {
    head: "from-[#EF4B42] to-[#C73A33]",
    bar: "bg-signal-red",
    chip: "bg-[#FDE4E2] text-signal-redDark",
    label: "Merah",
  },
};

export default function IntersectionCard({ data, frozen }: { data: Intersection; frozen: boolean }) {
  const t = THEME[data.light];
  const pct = Math.round((data.queue / data.maxQueue) * 100);

  return (
    <article className="overflow-hidden rounded-[20px] bg-white shadow-card">
      <div className={`flex items-center justify-between bg-gradient-to-r ${t.head} px-5 py-4 text-white`}>
        <div>
          <h3 className="font-bold leading-tight">{data.name}</h3>
          <p className="text-[11px] text-white/85">{data.street}</p>
        </div>
        <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-white/30" aria-hidden>
          <span className="h-3.5 w-3.5 rounded-full bg-white" />
        </span>
      </div>

      <div className="space-y-4 px-5 pb-5 pt-4">
        <div className="flex items-end justify-between">
          <p className="flex items-baseline gap-1.5">
            <span className="font-display text-4xl font-bold tabular-nums leading-none">{data.secondsLeft}</span>
            <span className="text-xs font-semibold text-ink-soft">dtk tersisa</span>
          </p>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${frozen ? "bg-[#E4ECF6] text-ink-soft" : t.chip}`}>
            {frozen ? "Manual" : t.label}
          </span>
        </div>

        <div>
          <div className="mb-1.5 flex justify-between text-xs">
            <span className="font-medium text-ink-soft">Antrean kendaraan</span>
            <span className="font-bold tabular-nums">{data.queue} mobil</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-[#E9EFF7]"
            role="progressbar"
            aria-valuenow={data.queue}
            aria-valuemin={0}
            aria-valuemax={data.maxQueue}
            aria-label={`Antrean ${data.name}`}
          >
            <div className={`h-full rounded-full transition-all duration-700 ${t.bar}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </article>
  );
}
