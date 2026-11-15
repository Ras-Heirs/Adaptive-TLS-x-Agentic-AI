// Kota latar untuk peta (TAMPILAN SAJA — tidak dipakai oleh logika simulasi).
// Dibuat sekali dengan seed tetap supaya tampilannya selalu sama.
//
// Tata letak per kuadran (sx, sy = tanda koordinat):
//   timur-laut  : pusat kota, gedung tinggi
//   barat-laut  : campuran gedung tinggi & menengah
//   barat-daya  : perumahan
//   tenggara    : taman berdanau, parkiran, perumahan & gedung menengah

type Pt = [number, number];
type Rect = [number, number, number, number]; // x, y, w, h (dunia)

interface Tower {
  base: Pt[];          // 4 titik dasar (searah jarum jam dari kiri-atas)
  roof: Pt[];          // 4 titik atap (sudah digeser perspektif)
  shadow: Pt[];
  faces: { pts: Pt[]; shade: string; floors: number }[]; // dinding yang terlihat
  roofColor: string;
  roofEdge: string;
  height: number;
  details: { kind: 'ac' | 'heli' | 'garden' | 'tank' | 'crown'; x: number; y: number; s: number }[];
  lit: Pt[];           // jendela menyala (malam) di dinding yang terlihat
  sortKey: number;
}

interface House {
  lot: Rect; body: Rect; horizontal: boolean;
  roofA: string; roofB: string;
  pool?: Rect; drive?: Rect; car?: { x: number; y: number; a: number; c: string };
  lit: Pt[];
}

interface Park { area: Rect; pond: { cx: number; cy: number; rx: number; ry: number }; path: Pt[]; trees: Tree[] }
interface Parking { area: Rect; stalls: { x: number; y: number; w: number; h: number }[]; cars: { x: number; y: number; a: number; c: string }[] }
export interface Tree { x: number; y: number; r: number; tone: number }

export interface City {
  lots: Rect[];
  streets: Rect[];
  streetLines: [Pt, Pt][];
  towers: Tower[];
  houses: House[];
  parks: Park[];
  parkings: Parking[];
  plazas: Rect[];
  trees: Tree[];
}

const CAR_COLORS = ['#7fa7d6', '#d6dbe2', '#5d6878', '#cdb57a', '#8fb59a', '#b98585', '#9aa6cf', '#2f3742'];
const TOWER_ROOFS: [string, string][] = [
  ['#2c3440', '#3b4555'], ['#313a48', '#434e60'], ['#283240', '#37445a'], ['#2f3b45', '#3e5260'], ['#353c47', '#474f5c'],
];
const HOUSE_ROOFS: [string, string][] = [
  ['#7a4636', '#5e3428'], ['#8a5a40', '#6c4430'], ['#4c5664', '#3a4250'], ['#6b5446', '#523f34'], ['#7d3f35', '#5f2f28'],
];

export function buildCity(): City {
  let seed = 912_2026;
  const rnd = () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];

  const city: City = { lots: [], streets: [], streetLines: [], towers: [], houses: [], parks: [], parkings: [], plazas: [], trees: [] };

  const EDGE = 172;          // batas kavling (setelah trotoar)
  const FAR = 1100;
  const ST = 640;            // jalan lingkungan di tiap kuadran
  const SW = 34;             // lebar jalan lingkungan
  const CLEAR = 312;         // area dekat simpang dibiarkan lapang (lampu & label)

  // ubah persegi lokal (a = |x|, b = |y|) ke koordinat dunia
  const toWorld = (sx: number, sy: number, a0: number, b0: number, a1: number, b1: number): Rect => {
    const x0 = sx > 0 ? a0 : -a1;
    const y0 = sy > 0 ? b0 : -b1;
    return [x0, y0, a1 - a0, b1 - b0];
  };

  // ── gedung tinggi dengan perspektif udara (condong keluar dari pusat) ──
  const addTower = (r: Rect, height: number) => {
    const [x, y, w, h] = r;
    const cx = x + w / 2; const cy = y + h / 2;
    const k = 0.00024 * height;
    const off: Pt = [cx * k, cy * k];
    const base: Pt[] = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    const roof: Pt[] = base.map(([px, py]) => [px + off[0], py + off[1]]);
    const sl = height * 0.32;
    const sv: Pt = [sl * 0.55, sl * 0.8];
    const shadow: Pt[] = [base[0], base[1], [base[1][0] + sv[0], base[1][1] + sv[1]], [base[2][0] + sv[0], base[2][1] + sv[1]], [base[3][0] + sv[0], base[3][1] + sv[1]], base[3]];
    const [roofColor, edge] = pick(TOWER_ROOFS);
    const normals: Pt[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const faces: Tower['faces'] = [];
    const lit: Pt[] = [];
    const floors = Math.max(3, Math.round(height / 16));
    normals.forEach((n, i) => {
      if (n[0] * off[0] + n[1] * off[1] >= 0) return; // dinding membelakangi kamera
      const a = base[i]; const b = base[(i + 1) % 4];
      const ra = roof[i]; const rb = roof[(i + 1) % 4];
      const horizontal = n[1] !== 0;
      faces.push({ pts: [a, b, rb, ra], shade: horizontal ? '#1d232c' : '#262e39', floors });
      const cols = Math.max(3, Math.round((horizontal ? w : h) / 14));
      for (let f = 1; f < floors; f++) {
        for (let c = 0; c < cols; c++) {
          if (rnd() > 0.38) continue;
          const t = f / floors; const s = (c + 0.5) / cols;
          const p0: Pt = [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s];
          const p1: Pt = [ra[0] + (rb[0] - ra[0]) * s, ra[1] + (rb[1] - ra[1]) * s];
          lit.push([p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t]);
        }
      }
    });
    const details: Tower['details'] = [];
    const rx = x + off[0]; const ry = y + off[1];
    const roll = rnd();
    if (height > 200 && roll < 0.35) details.push({ kind: 'heli', x: rx + w / 2, y: ry + h / 2, s: Math.min(w, h) * 0.32 });
    else if (roll < 0.55) details.push({ kind: 'garden', x: rx + w * 0.18, y: ry + h * 0.18, s: Math.min(w, h) * 0.64 });
    else if (height > 180 && roll < 0.75) details.push({ kind: 'crown', x: rx + w / 2, y: ry + h / 2, s: Math.min(w, h) * 0.42 });
    const units = 1 + Math.floor(rnd() * 3);
    for (let u = 0; u < units; u++) {
      details.push({ kind: rnd() < 0.5 ? 'ac' : 'tank', x: rx + 10 + rnd() * (w - 30), y: ry + 10 + rnd() * (h - 30), s: 8 + rnd() * 7 });
    }
    city.towers.push({ base, roof, shadow, faces, roofColor, roofEdge: edge, height, details, lit, sortKey: Math.hypot(cx, cy) });
  };

  const towersIn = (sx: number, sy: number, a0: number, b0: number, a1: number, b1: number, hMin: number, hMax: number) => {
    const gap = 24;
    for (let a = a0 + 14; a < a1 - 60; ) {
      const w = Math.min(a1 - 14 - a, 96 + rnd() * 54);
      if (w < 60) break;
      for (let b = b0 + 14; b < b1 - 60; ) {
        const h = Math.min(b1 - 14 - b, 92 + rnd() * 58);
        if (h < 60) break;
        if (rnd() < 0.1) {
          // sela kecil: pohon
          city.trees.push({ x: sx * (a + w / 2), y: sy * (b + h / 2), r: 16 + rnd() * 8, tone: rnd() });
        } else {
          addTower(toWorld(sx, sy, a, b, a + w, b + h), hMin + rnd() * (hMax - hMin));
        }
        b += h + gap;
      }
      a += w + gap;
    }
  };

  // ── rumah beratap genteng ─────────────────────────────────────────
  const housesIn = (sx: number, sy: number, a0: number, b0: number, a1: number, b1: number) => {
    const lotW = 78; const lotH = 74;
    for (let a = a0 + 8; a + lotW <= a1 - 6; a += lotW + 6) {
      for (let b = b0 + 8; b + lotH <= b1 - 6; b += lotH + 6) {
        const lot = toWorld(sx, sy, a, b, a + lotW, b + lotH);
        const horizontal = rnd() < 0.5;
        const bw = horizontal ? 50 + rnd() * 10 : 36 + rnd() * 8;
        const bh = horizontal ? 32 + rnd() * 6 : 44 + rnd() * 10;
        const bx = lot[0] + 6 + rnd() * (lotW - bw - 12);
        const by = lot[1] + 6 + rnd() * 6;
        const [ra, rb] = pick(HOUSE_ROOFS);
        const house: House = { lot, body: [bx, by, bw, bh], horizontal, roofA: ra, roofB: rb, lit: [] };
        const freeY = by + bh + 6;
        const freeH = lot[1] + lotH - freeY - 5;
        if (rnd() < 0.3 && freeH > 16) house.pool = [lot[0] + 8 + rnd() * 20, freeY + 2, 30, Math.min(18, freeH - 2)];
        else if (freeH > 14) {
          house.drive = [bx + bw - 18, freeY - 4, 16, freeH + 4];
          if (rnd() < 0.6) house.car = { x: bx + bw - 10, y: freeY + freeH / 2, a: Math.PI / 2, c: pick(CAR_COLORS) };
        }
        if (rnd() < 0.7) house.lit.push([bx + bw * (0.2 + rnd() * 0.6), by + bh + 1]);
        city.houses.push(house);
        if (rnd() < 0.45) city.trees.push({ x: lot[0] + lotW - 10, y: lot[1] + lotH - 12, r: 8 + rnd() * 4, tone: rnd() });
      }
    }
  };

  // ── taman berdanau ────────────────────────────────────────────────
  const parkIn = (sx: number, sy: number, a0: number, b0: number, a1: number, b1: number) => {
    const area = toWorld(sx, sy, a0 + 10, b0 + 10, a1 - 10, b1 - 10);
    const [x, y, w, h] = area;
    const pond = { cx: x + w * 0.58, cy: y + h * 0.55, rx: w * 0.24, ry: h * 0.17 };
    const path: Pt[] = [[x + 10, y + h * 0.2], [x + w * 0.35, y + h * 0.32], [x + w * 0.3, y + h * 0.8], [x + w - 10, y + h * 0.88]];
    const trees: Tree[] = [];
    for (let i = 0; i < 26; i++) {
      const tx = x + 16 + rnd() * (w - 32); const ty = y + 16 + rnd() * (h - 32);
      if (((tx - pond.cx) / (pond.rx + 18)) ** 2 + ((ty - pond.cy) / (pond.ry + 18)) ** 2 < 1) continue;
      trees.push({ x: tx, y: ty, r: 10 + rnd() * 10, tone: rnd() });
    }
    city.parks.push({ area, pond, path, trees });
  };

  // ── lahan parkir ──────────────────────────────────────────────────
  const parkingIn = (sx: number, sy: number, a0: number, b0: number, a1: number, b1: number) => {
    const area = toWorld(sx, sy, a0 + 12, b0 + 12, a1 - 12, b1 - 12);
    const [x, y, w, h] = area;
    const stalls: Parking['stalls'] = [];
    const cars: Parking['cars'] = [];
    for (let row = 0; row < 4; row++) {
      const ry = y + 14 + row * ((h - 28) / 4);
      for (let cx = x + 14; cx + 20 <= x + w - 14; cx += 22) {
        stalls.push({ x: cx, y: ry, w: 20, h: 38 });
        if (rnd() < 0.62) cars.push({ x: cx + 10, y: ry + 19, a: Math.PI / 2 + (rnd() < 0.5 ? 0 : Math.PI), c: pick(CAR_COLORS) });
      }
    }
    city.parkings.push({ area, stalls, cars });
  };

  [[1, -1], [-1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
    city.lots.push(toWorld(sx, sy, EDGE, EDGE, FAR, FAR));
    // jalan lingkungan berbentuk "+" di tiap kuadran
    city.streets.push(toWorld(sx, sy, ST - SW / 2, EDGE, ST + SW / 2, FAR));
    city.streets.push(toWorld(sx, sy, EDGE, ST - SW / 2, FAR, ST + SW / 2));
    city.streetLines.push([[sx * ST, sy * EDGE], [sx * ST, sy * FAR]]);
    city.streetLines.push([[sx * EDGE, sy * ST], [sx * FAR, sy * ST]]);

    const inner: [number, number, number, number][] = [
      [EDGE, EDGE, ST - SW / 2, ST - SW / 2],          // dekat simpang
      [ST + SW / 2, EDGE, FAR, ST - SW / 2],
      [EDGE, ST + SW / 2, ST - SW / 2, FAR],
      [ST + SW / 2, ST + SW / 2, FAR, FAR],
    ];
    const district = sx > 0 && sy < 0 ? 'downtown' : sx < 0 && sy < 0 ? 'mixed' : sx < 0 && sy > 0 ? 'homes' : 'park';

    inner.forEach(([a0, b0, a1, b1], i) => {
      // blok dekat simpang: sisakan alun-alun kecil di sudut
      const parts: [number, number, number, number][] = i === 0
        ? [[CLEAR, EDGE, a1, b1], [EDGE, CLEAR, CLEAR, b1]]
        : [[a0, b0, a1, b1]];
      if (i === 0) city.plazas.push(toWorld(sx, sy, EDGE + 8, EDGE + 8, CLEAR - 8, CLEAR - 8));
      parts.forEach(([p0, q0, p1, q1]) => {
        if (district === 'downtown') towersIn(sx, sy, p0, q0, p1, q1, i === 0 ? 120 : 170, i === 0 ? 220 : 300);
        else if (district === 'mixed') {
          if (i === 3) housesIn(sx, sy, p0, q0, p1, q1);
          else towersIn(sx, sy, p0, q0, p1, q1, 70, i === 1 ? 240 : 170);
        } else if (district === 'homes') {
          if (i === 1) towersIn(sx, sy, p0, q0, p1, q1, 50, 110);
          else housesIn(sx, sy, p0, q0, p1, q1);
        } else {
          if (i === 0) {
            if (p0 === CLEAR) parkIn(sx, sy, p0, q0, p1, q1);
            else housesIn(sx, sy, p0, q0, p1, q1);
          } else if (i === 1) parkingIn(sx, sy, p0, q0, p1, q1);
          else if (i === 2) housesIn(sx, sy, p0, q0, p1, q1);
          else towersIn(sx, sy, p0, q0, p1, q1, 60, 150);
        }
      });
    });

    // pohon di trotoar jalan utama & di alun-alun
    for (let d = 330; d < 1080; d += 95) {
      city.trees.push({ x: sx * 160, y: sy * d, r: 13 + rnd() * 5, tone: rnd() });
      city.trees.push({ x: sx * d, y: sy * 160, r: 13 + rnd() * 5, tone: rnd() });
    }
  });

  city.towers.sort((p, q) => p.sortKey - q.sortKey);
  return city;
}

// ── menggambar ───────────────────────────────────────────────────────
const poly = (ctx: CanvasRenderingContext2D, pts: Pt[]) => {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
};

/** Lapisan dasar: kavling, jalan lingkungan, taman, parkiran, rumah. */
export function drawCityGround(ctx: CanvasRenderingContext2D, city: City) {
  ctx.save();
  // jalan lingkungan
  ctx.fillStyle = '#1b2026';
  city.streets.forEach(([x, y, w, h]) => ctx.fillRect(x, y, w, h));
  ctx.strokeStyle = 'rgba(232, 236, 242, 0.18)'; ctx.lineWidth = 1.5; ctx.setLineDash([12, 14]);
  city.streetLines.forEach(([[x1, y1], [x2, y2]]) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); });
  ctx.setLineDash([]);

  // alun-alun dekat simpang
  city.plazas.forEach(([x, y, w, h]) => {
    ctx.fillStyle = '#161c22';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
    for (let i = 14; i < w; i += 14) { ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i, y + h); ctx.stroke(); }
  });

  // taman
  city.parks.forEach((p) => {
    const [x, y, w, h] = p.area;
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#1d3325'); g.addColorStop(1, '#16271d');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 22); ctx.fill();
    ctx.strokeStyle = 'rgba(220, 199, 161, 0.35)'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p.path[0][0], p.path[0][1]);
    ctx.bezierCurveTo(p.path[1][0], p.path[1][1], p.path[2][0], p.path[2][1], p.path[3][0], p.path[3][1]); ctx.stroke();
    ctx.lineCap = 'butt';
    const { cx, cy, rx, ry } = p.pond;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(cx + 3, cy + 4, rx + 4, ry + 4, 0, 0, Math.PI * 2); ctx.fill();
    const wg = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.4, 2, cx, cy, Math.max(rx, ry));
    wg.addColorStop(0, '#5a9ac0'); wg.addColorStop(0.6, '#2c6a8f'); wg.addColorStop(1, '#1b4560');
    ctx.fillStyle = wg;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(220, 199, 161, 0.5)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(cx - rx * 0.2, cy - ry * 0.25, rx * 0.45, ry * 0.25, 0, Math.PI * 1.1, Math.PI * 1.8); ctx.stroke();
  });

  // parkiran
  city.parkings.forEach((pk) => {
    const [x, y, w, h] = pk.area;
    ctx.fillStyle = '#20252c';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(232, 236, 242, 0.22)'; ctx.lineWidth = 1;
    pk.stalls.forEach((s) => { ctx.strokeRect(s.x, s.y, s.w, s.h); });
    pk.cars.forEach((c) => drawParkedCar(ctx, c.x, c.y, c.a, c.c));
  });

  // rumah
  city.houses.forEach((hs) => {
    const [lx, ly, lw, lh] = hs.lot;
    ctx.fillStyle = '#17241c';
    ctx.beginPath(); ctx.roundRect(lx, ly, lw, lh, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(220, 199, 161, 0.12)'; ctx.lineWidth = 1; ctx.stroke();
    if (hs.drive) { ctx.fillStyle = '#2a2f36'; const [dx, dy, dw, dh] = hs.drive; ctx.fillRect(dx, dy, dw, dh); }
    if (hs.pool) {
      const [px, py, pw, ph] = hs.pool;
      ctx.fillStyle = '#e8e2d4'; ctx.beginPath(); ctx.roundRect(px - 2, py - 2, pw + 4, ph + 4, 4); ctx.fill();
      const pg = ctx.createLinearGradient(px, py, px + pw, py + ph);
      pg.addColorStop(0, '#5fd0e6'); pg.addColorStop(1, '#2f8fb0');
      ctx.fillStyle = pg; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 3); ctx.fill();
    }
    const [bx, by, bw, bh] = hs.body;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(bx + 4, by + 5, bw, bh);
    // atap pelana: dua sisi dengan warna berbeda + bubungan
    ctx.fillStyle = hs.roofA;
    if (hs.horizontal) {
      ctx.fillRect(bx, by, bw, bh / 2);
      ctx.fillStyle = hs.roofB; ctx.fillRect(bx, by + bh / 2, bw, bh / 2);
      ctx.strokeStyle = 'rgba(255, 235, 210, 0.35)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(bx + 2, by + bh / 2); ctx.lineTo(bx + bw - 2, by + bh / 2); ctx.stroke();
    } else {
      ctx.fillRect(bx, by, bw / 2, bh);
      ctx.fillStyle = hs.roofB; ctx.fillRect(bx + bw / 2, by, bw / 2, bh);
      ctx.strokeStyle = 'rgba(255, 235, 210, 0.35)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(bx + bw / 2, by + 2); ctx.lineTo(bx + bw / 2, by + bh - 2); ctx.stroke();
    }
    // garis genteng halus
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
    ctx.beginPath();
    if (hs.horizontal) for (let i = 5; i < bw; i += 5) { ctx.moveTo(bx + i, by); ctx.lineTo(bx + i, by + bh); }
    else for (let i = 5; i < bh; i += 5) { ctx.moveTo(bx, by + i); ctx.lineTo(bx + bw, by + i); }
    ctx.stroke();
    if (hs.car) drawParkedCar(ctx, hs.car.x, hs.car.y, hs.car.a, hs.car.c);
  });
  ctx.restore();
}

function drawParkedCar(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, c: string) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(a);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-14, -6, 30, 14);
  ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(-15, -7.5, 30, 15, 4); ctx.fill();
  ctx.fillStyle = 'rgba(14, 20, 27, 0.85)';
  ctx.fillRect(5, -5.5, 5, 11); ctx.fillRect(-12, -5, 3, 10);
  ctx.restore();
}

/** Gedung tinggi: bayangan, dinding, atap, detail atap. */
export function drawCityTowers(ctx: CanvasRenderingContext2D, city: City) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
  city.towers.forEach((t) => { poly(ctx, t.shadow); ctx.fill(); });
  city.towers.forEach((t) => {
    t.faces.forEach((f) => {
      poly(ctx, f.pts); ctx.fillStyle = f.shade; ctx.fill();
      // garis lantai
      const [a, b, rb, ra] = f.pts;
      ctx.strokeStyle = 'rgba(169, 194, 236, 0.10)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < f.floors; i++) {
        const s = i / f.floors;
        ctx.moveTo(a[0] + (ra[0] - a[0]) * s, a[1] + (ra[1] - a[1]) * s);
        ctx.lineTo(b[0] + (rb[0] - b[0]) * s, b[1] + (rb[1] - b[1]) * s);
      }
      ctx.stroke();
    });
    const g = ctx.createLinearGradient(t.roof[0][0], t.roof[0][1], t.roof[2][0], t.roof[2][1]);
    g.addColorStop(0, t.roofEdge); g.addColorStop(1, t.roofColor);
    poly(ctx, t.roof); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(220, 199, 161, 0.28)'; ctx.lineWidth = 1.2; ctx.stroke();
    // parapet
    const [r0, , r2] = [t.roof[0], t.roof[1], t.roof[2]];
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
    ctx.strokeRect(r0[0] + 5, r0[1] + 5, r2[0] - r0[0] - 10, r2[1] - r0[1] - 10);
    t.details.forEach((d) => {
      if (d.kind === 'heli') {
        ctx.strokeStyle = 'rgba(244, 204, 120, 0.85)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.s, 0, Math.PI * 2); ctx.stroke();
        ctx.font = `800 ${Math.round(d.s * 1.1)}px Inter, sans-serif`; ctx.fillStyle = 'rgba(244, 204, 120, 0.9)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('H', d.x, d.y + 1);
        ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
      } else if (d.kind === 'garden') {
        ctx.fillStyle = '#1f3a28';
        ctx.beginPath(); ctx.roundRect(d.x, d.y, d.s, d.s * 0.55, 6); ctx.fill();
        ctx.fillStyle = '#2f5a3c';
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(d.x + 8 + i * (d.s - 16) / 3, d.y + d.s * 0.27, 5, 0, Math.PI * 2); ctx.fill(); }
      } else if (d.kind === 'crown') {
        ctx.strokeStyle = 'rgba(220, 199, 161, 0.45)'; ctx.lineWidth = 1.5;
        ctx.strokeRect(d.x - d.s / 2, d.y - d.s / 2, d.s, d.s);
        ctx.fillStyle = 'rgba(220, 199, 161, 0.14)'; ctx.fillRect(d.x - d.s / 4, d.y - d.s / 4, d.s / 2, d.s / 2);
      } else if (d.kind === 'tank') {
        ctx.fillStyle = '#4a5462'; ctx.beginPath(); ctx.arc(d.x, d.y, d.s / 2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.stroke();
      } else {
        ctx.fillStyle = '#434c59'; ctx.fillRect(d.x, d.y, d.s, d.s * 0.7);
        ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(d.x + 2, d.y + 2, d.s - 4, 2);
      }
    });
  });
  ctx.restore();
}

/** Lampu malam: jendela gedung & rumah. Dipanggil setelah lapisan gelap. */
export function drawCityNightLights(ctx: CanvasRenderingContext2D, city: City) {
  ctx.save();
  ctx.fillStyle = 'rgba(255, 206, 128, 0.85)';
  city.towers.forEach((t) => t.lit.forEach(([x, y]) => ctx.fillRect(x - 2, y - 1.5, 4, 3)));
  ctx.fillStyle = 'rgba(255, 196, 120, 0.9)';
  city.houses.forEach((h) => h.lit.forEach(([x, y]) => ctx.fillRect(x - 3, y - 1, 6, 2.5)));
  // atap gedung sedikit terang di tepi
  ctx.strokeStyle = 'rgba(255, 206, 128, 0.18)'; ctx.lineWidth = 1;
  city.towers.forEach((t) => { if (t.height > 200) { poly(ctx, t.roof); ctx.stroke(); } });
  ctx.restore();
}

export function drawTrees(ctx: CanvasRenderingContext2D, trees: Tree[]) {
  trees.forEach((t) => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath(); ctx.arc(t.x + 5, t.y + 7, t.r, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(t.x - t.r * 0.35, t.y - t.r * 0.35, 1, t.x, t.y, t.r);
    g.addColorStop(0, t.tone > 0.5 ? '#46744f' : '#3f6b4c'); g.addColorStop(1, t.tone > 0.7 ? '#203a28' : '#1d3325');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
  });
}
