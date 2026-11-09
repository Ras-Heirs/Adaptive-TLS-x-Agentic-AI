interface Props {
  connected: boolean;
  mode: "simulasi" | "socket";
}

export default function Header({ connected, mode }: Props) {
  return (
    <header className="relative overflow-hidden bg-gradient-to-br from-[#2E8FE6] via-[#1E6FC2] to-[#174F94] text-white">
      {/* siluet gedung */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-white/5">
        <div className="absolute bottom-0 left-[4%] h-14 w-[70px] bg-white/10" />
        <div className="absolute bottom-0 left-[14%] h-9 w-[50px] bg-white/10" />
        <div className="absolute bottom-0 right-[22%] h-12 w-[55px] bg-white/10" />
        <div className="absolute bottom-0 right-[12%] h-[75px] w-[65px] bg-white/10" />
        <div className="absolute bottom-0 right-[4%] h-16 w-[60px] bg-white/10" />
      </div>

      <div className="relative mx-auto max-w-[1352px] px-4 pb-14 pt-9 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-[46px] w-[46px] place-items-center rounded-xl bg-white/20 text-2xl" aria-hidden>
              🚦
            </div>
            <div>
              <p className="text-xl font-bold leading-tight">Sistem Lalu Lintas Adaptif</p>
              <p className="text-xs text-white/80">Pemantauan simpang · Agentic AI</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span
              className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-semibold"
              role="status"
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-[#4ADE80] shadow-[0_0_0_4px_rgba(74,222,128,0.3)]" : "bg-[#F87171]"}`}
              />
              {connected ? (mode === "socket" ? "Terhubung ke backend" : "Terhubung ke simulator") : "Terputus"}
            </span>
            <div className="flex items-center gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-sun text-xs font-bold">AA</span>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-bold leading-tight">Abram Adrian</p>
                <p className="text-[11px] text-white/80">Operator shift pagi</p>
              </div>
            </div>
          </div>
        </div>

        <h1 className="mt-9 max-w-[520px] font-display text-[32px] font-bold leading-[1.2] sm:text-[34px]">
          Lalu lintas Jakarta Selatan hari ini terpantau lancar
        </h1>
        <p className="mt-3 max-w-[500px] text-sm leading-relaxed text-white/90">
          3 simpang aktif dipantau agent secara real-time. Rata-rata waktu tunggu turun 34% dibanding jadwal tetap.
        </p>
      </div>
    </header>
  );
}
