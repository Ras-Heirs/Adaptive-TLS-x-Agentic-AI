import type { FC } from 'react';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GuideModal: FC<GuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="neon-card max-w-2xl w-full rounded-2xl p-6 border-2 border-sky-400 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded text-xs font-mono">DL-2121RM</span>
            <h2 className="text-lg md:text-xl font-bold text-sky-400">📖 Panduan Penggunaan Simulator</h2>
          </div>
          <button onClick={onClose} aria-label="Tutup panduan" className="text-slate-400 hover:text-white text-xl font-bold">&times;</button>
        </div>

        <div className="space-y-3 text-xs md:text-sm text-slate-300 leading-relaxed">
          <p className="text-slate-200 font-medium">
            Selamat datang di <b>Adaptive Traffic Light System (Agentic AI) Simulator</b>.
            Simulator memodelkan persimpangan 4 arah dengan dua poros lampu (A dan B),
            zona supervisi kamera AI, serta integrasi backend.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
              <p className="text-sky-400 font-bold mb-1">1. 🔍 Navigasi Peta & Kamera AI</p>
              <p>• Scroll mouse atau tombol zoom untuk memperbesar/memperkecil peta.</p>
              <p>• Klik dan geser kanvas untuk menggeser tampilan.</p>
              <p>• Kotak biru putus-putus menunjukkan zona supervisi kamera AI.</p>
            </div>
            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
              <p className="text-amber-400 font-bold mb-1">2. 🌆 Skenario Dinamis vs Custom</p>
              <p>• Pilih Normal, Rush Hour, atau Jam Kosong untuk trafik otomatis.</p>
              <p>• Kendaraan tetap dapat ditambahkan saat mode otomatis berjalan.</p>
              <p>• Custom Scenario menonaktifkan generator trafik otomatis.</p>
            </div>
            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
              <p className="text-rose-400 font-bold mb-1">3. 🚨 Prioritas Darurat</p>
              <p>• Tambahkan ambulans atau damkar melalui panel Simpang A/B.</p>
              <p>• Saat kendaraan darurat terdeteksi di zona kamera, frontend mengirim permintaan override ke backend.</p>
            </div>
            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
              <p className="text-emerald-400 font-bold mb-1">4. 🛣️ Disiplin Jalan 2 Arah</p>
              <p>• Jalan memiliki lajur masuk dan keluar untuk masing-masing arah.</p>
              <p>• Kendaraan mengikuti waypoint sesuai arah lurus atau belok.</p>
            </div>
          </div>
          <p className="text-amber-300 text-xs">
            Catatan: keputusan lampu lalu lintas berasal dari backend. Pastikan API backend sesuai dengan endpoint yang digunakan frontend.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
          <button onClick={onClose} className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold px-6 py-2 rounded-lg text-sm font-mono shadow-lg transition">
            🚀 Mengerti & Mulai Simulator
          </button>
        </div>
      </div>
    </div>
  );
};
