# Adaptive TLS x Agentic AI — Frontend

Frontend simulator persimpangan 4 arah menggunakan React, TypeScript, Vite, dan Tailwind CSS CDN.

## Struktur

```text
Adaptive-TLS-x-Agentic-AI/
├── README.md
└── frontend/
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── types/simulator.ts
        ├── services/trafficApi.ts
        ├── utils/laneGeometry.ts
        └── components/
            ├── GuideModal.tsx
            ├── TrafficCanvas.tsx
            └── ControlDeck.tsx
```

## Menjalankan

1. Pastikan Node.js dan npm sudah terpasang.
2. Masuk ke folder frontend:

   ```bash
   cd frontend
   npm install
   ```

3. Jalankan backend Express di `http://localhost:3000`, lalu jalankan frontend:

   ```bash
   npm run dev
   ```

4. Buka `http://localhost:5173`.

## Build

Dari dalam folder `frontend/`:

```bash
npm run build
```

Hasil build diarahkan ke folder `public/` di root proyek, yaitu `../public`.

## Endpoint backend yang digunakan

- `GET /api/intersections`
- `GET /api/logs`
- `POST /api/sensor`
- `POST /api/override`

Pastikan backend menyediakan endpoint dan format JSON yang sesuai. Frontend ini hanya mencakup sisi frontend; backend Express, database, Prisma, dan skema API tidak dibuat dalam paket ini.

## Catatan teknis

- `vite.config.ts` menggunakan `fileURLToPath(import.meta.url)` agar path output bekerja pada konfigurasi ESM.
- Build menjalankan pemeriksaan TypeScript terlebih dahulu (`tsc --noEmit`).
- Tailwind dimuat melalui CDN pada `index.html`, mengikuti konfigurasi awal yang diberikan.
- Simulasi kendaraan berjalan di browser; keputusan lampu dan audit log diambil dari backend.
