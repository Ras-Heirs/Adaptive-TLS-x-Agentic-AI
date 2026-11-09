import type { Decision, DecisionStatus } from "@/lib/types";

const BADGE: Record<Decision["intersection"], string> = {
  A: "bg-signal-green",
  B: "bg-signal-red",
  C: "bg-sun",
};

const STATUS: Record<DecisionStatus, { label: string; cls: string }> = {
  approved: { label: "Disetujui", cls: "bg-[#E1F5E9] text-signal-greenDark" },
  fallback: { label: "Fallback", cls: "bg-[#FFF1D6] text-sun-deep" },
  rejected: { label: "Ditolak", cls: "bg-[#FDE4E2] text-signal-redDark" },
};

export default function DecisionLog({ decisions }: { decisions: Decision[] }) {
  return (
    <section aria-labelledby="log-heading">
      <h2 id="log-heading" className="mb-4 text-lg font-bold">Log Keputusan Agent</h2>
      <div className="overflow-x-auto rounded-[20px] bg-white shadow-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-[11px] font-bold text-ink-soft">
              <th className="px-6 py-4 font-bold">Waktu</th>
              <th className="px-3 py-4 font-bold">Simpang</th>
              <th className="px-3 py-4 font-bold">Durasi hijau</th>
              <th className="px-3 py-4 font-bold">Alasan</th>
              <th className="px-6 py-4 font-bold">Status</th>
            </tr>
          </thead>
          <tbody>
            {decisions.map((d) => (
              <tr key={d.id} className="border-b border-line last:border-0">
                <td className="px-6 py-4 font-medium tabular-nums text-ink-soft">{d.time}</td>
                <td className="px-3 py-4">
                  <span
                    className={`grid h-8 w-9 place-items-center rounded-lg font-display text-sm font-bold text-white ${BADGE[d.intersection]}`}
                  >
                    {d.intersection}
                  </span>
                </td>
                <td className="px-3 py-4 font-bold tabular-nums">{d.greenSeconds} dtk</td>
                <td className="px-3 py-4">{d.reason}</td>
                <td className="px-6 py-4">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS[d.status].cls}`}>
                    {STATUS[d.status].label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
