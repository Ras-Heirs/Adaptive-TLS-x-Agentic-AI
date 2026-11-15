// Menerjemahkan alasan keputusan dari backend (bahasa Indonesia) ke bahasa Inggris
// HANYA untuk tampilan. Data asli dari backend tidak diubah; frasa yang tidak
// dikenal ditampilkan apa adanya.

const RULES: [RegExp, string][] = [
  [/Menunggu evaluasi kamera Simpang (\w+)\.*/g, 'Waiting for camera evaluation at Intersection $1'],
  [/Lalu lintas lengang/g, 'Light traffic'],
  [/Lalu lintas normal/g, 'Normal traffic'],
  [/Kepadatan tinggi/g, 'Heavy traffic'],
  [/Kemacetan kritis/g, 'Critical congestion'],
  [/\((\d+) kendaraan\)/g, '($1 vehicles)'],
  [/Durasi maksimal & kirim peringatan ke simpang tetangga\./g, 'Maximum green and alert sent to the neighboring intersection.'],
  [/Durasi dipercepat\./g, 'Green shortened.'],
  [/Durasi standar\./g, 'Standard green.'],
  [/Durasi diperpanjang\./g, 'Green extended.'],
  [/\[Koordinasi Agen: Durasi dikurangi 10s untuk menahan laju kiriman kendaraan ke simpang tetangga yang sedang padat\]\./g,
    '[Agent coordination: green reduced by 10 s to hold traffic flowing into the congested neighbor].'],
  [/\[SafetyGuard: Disesuaikan ke batas minimum (\d+)s\]/g, '[SafetyGuard: raised to the $1 s minimum]'],
  [/\[SafetyGuard: Dibatasi ke batas maksimum (\d+)s\]/g, '[SafetyGuard: capped at the $1 s maximum]'],
  [/: Durasi diatur ke (\d+)s/g, ': green set to $1 s'],
  [/\(Dikunci ke batas aman minimum (\d+)s\)/g, '(locked to the $1 s safe minimum)'],
  [/\(Dikunci ke batas aman maksimum (\d+)s\)/g, '(locked to the $1 s safe maximum)'],
  [/\[FALLBACK RULE AKTIF\]/g, '[FALLBACK RULE ACTIVE]'],
  [/Anomali sensor terdeteksi/g, 'Sensor anomaly detected'],
  [/Mengembalikan durasi ke standar aman \((\d+)s\)\./g, 'Green reset to the $1 s safe default.'],
  [/AI Camera Supervision \((\w)\): Prioritas Darurat AMBULANCE/g, 'AI Camera Supervision ($1): Emergency Priority for Ambulance'],
  [/AI Camera Supervision \((\w)\): Prioritas Darurat DAMKAR/g, 'AI Camera Supervision ($1): Emergency Priority for Fire Truck'],
  [/Prioritas Darurat/g, 'Emergency Priority'],
];

export function toEnglishReason(text: string): string {
  return RULES.reduce((out, [re, rep]) => out.replace(re, rep), text ?? '');
}

/** "AGENT" → "Agent", "OPERATOR" → "Operator" */
export function titleCase(text: string): string {
  return (text ?? '').toLowerCase().replace(/(^|[\s_-])([a-z])/g, (_, p, c) => p + c.toUpperCase());
}
