"use client";

import Header from "@/components/Header";
import IntersectionCard from "@/components/IntersectionCard";
import OperatorControls from "@/components/OperatorControls";
import DecisionLog from "@/components/DecisionLog";
import PerformanceChart from "@/components/PerformanceChart";
import { useTrafficFeed } from "@/lib/useTrafficFeed";

export default function DashboardPage() {
  const feed = useTrafficFeed();

  return (
    <main className="pb-16">
      <Header connected={feed.connected} mode={feed.mode} />

      <div className="mx-auto max-w-[1352px] space-y-10 px-4 pt-8 sm:px-6">
        <section aria-labelledby="status-heading">
          <div className="mb-4 flex items-center gap-3">
            <h2 id="status-heading" className="text-lg font-bold">Status Persimpangan</h2>
            <span className="rounded-full bg-[#E4ECF6] px-2.5 py-0.5 text-xs font-semibold text-ink-soft">
              {feed.intersections.length} simpang aktif
            </span>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {feed.intersections.map((s) => (
              <IntersectionCard key={s.id} data={s} frozen={feed.override} />
            ))}
          </div>
        </section>

        <OperatorControls
          scenario={feed.scenario}
          override={feed.override}
          onScenario={feed.setScenario}
          onOverride={feed.setOverride}
        />

        <DecisionLog decisions={feed.decisions} />
        <PerformanceChart metrics={feed.metrics} />
      </div>
    </main>
  );
}
