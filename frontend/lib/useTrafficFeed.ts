"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { Decision, Scenario, TrafficFeed, TrafficSnapshot } from "./types";
import { seedDecisions, seedIntersections, seedMetrics, tick } from "./simulator";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL;
const MAX_LOG = 8;

const initial = (): TrafficSnapshot => ({
  intersections: seedIntersections(),
  decisions: seedDecisions(),
  metrics: seedMetrics(),
  scenario: "normal",
  override: false,
});

/**
 * Sumber data dashboard.
 * - NEXT_PUBLIC_SOCKET_URL terisi  -> data sungguhan dari backend (Socket.IO).
 * - kosong                         -> simulasi lokal, supaya UI bisa didemokan tanpa backend.
 *
 * Event yang diharapkan dari backend:
 *   "snapshot"  (TrafficSnapshot)  status penuh, dikirim berkala
 *   "decision"  (Decision)         keputusan agent baru
 * Event yang dikirim dashboard:
 *   "scenario:set" (Scenario), "override:set" (boolean)
 */
export function useTrafficFeed(): TrafficFeed {
  const [state, setState] = useState<TrafficSnapshot>(initial);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (SOCKET_URL) {
      const socket = io(SOCKET_URL, { transports: ["websocket"] });
      socketRef.current = socket;
      socket.on("connect", () => setConnected(true));
      socket.on("disconnect", () => setConnected(false));
      socket.on("snapshot", (snap: TrafficSnapshot) => setState(snap));
      socket.on("decision", (d: Decision) =>
        setState((s) => ({ ...s, decisions: [d, ...s.decisions].slice(0, MAX_LOG) })),
      );
      return () => {
        socket.disconnect();
        socketRef.current = null;
      };
    }

    setConnected(true);
    const timer = setInterval(() => {
      setState((s) => {
        const { next, decisions } = tick(s.intersections, s.scenario, s.override);
        return {
          ...s,
          intersections: next,
          decisions: decisions.length ? [...decisions, ...s.decisions].slice(0, MAX_LOG) : s.decisions,
        };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const setScenario = useCallback((scenario: Scenario) => {
    setState((s) => ({ ...s, scenario }));
    socketRef.current?.emit("scenario:set", scenario);
  }, []);

  const setOverride = useCallback((override: boolean) => {
    setState((s) => ({ ...s, override }));
    socketRef.current?.emit("override:set", override);
  }, []);

  return {
    ...state,
    connected,
    mode: SOCKET_URL ? "socket" : "simulasi",
    setScenario,
    setOverride,
  };
}
