# Dashboard Sistem Lalu Lintas Adaptif

Next.js 14 (App Router) + Tailwind + Socket.IO client.

## Jalankan
    npm install
    npm run dev        # http://localhost:3000

Tanpa backend, dashboard memakai simulator lokal (`lib/simulator.ts`).
Untuk data sungguhan, salin `.env.example` ke `.env.local` dan isi `NEXT_PUBLIC_SOCKET_URL`.

## Kontrak Socket.IO
Server -> dashboard: `snapshot` (TrafficSnapshot), `decision` (Decision)
Dashboard -> server: `scenario:set` ("normal" | "rush" | "accident"), `override:set` (boolean)
Tipe lengkap ada di `lib/types.ts`.
