import { RawDecision } from '../types/agent.types';

export class DecisionEngine {

  public static evaluate(
    vehicleCount: number, // Jumlah kendaraan yang terdeteksi sensor
    hasNeighborCongestionAlert: boolean //Apakah simpang tetangga sedang mengirim sinyal macet parah
  ): RawDecision {
    let proposedDuration = 30;
    let reason = '';
    let shouldNotifyNeighbor = false;
    let congestionLevel: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL' = 'NORMAL';

    // Evaluasi kepadatan lokal
    if (vehicleCount <= 10) {
      congestionLevel = 'LOW';
      proposedDuration = 20;
      reason = `Lalu lintas lengang (${vehicleCount} kendaraan). Durasi dipercepat.`;
    } else if (vehicleCount <= 25) {
      congestionLevel = 'NORMAL';
      proposedDuration = 35;
      reason = `Lalu lintas normal (${vehicleCount} kendaraan). Durasi standar.`;
    } else if (vehicleCount <= 45) {
      congestionLevel = 'HIGH';
      proposedDuration = 55;
      reason = `Kepadatan tinggi (${vehicleCount} kendaraan). Durasi diperpanjang.`;
    } else {
      congestionLevel = 'CRITICAL';
      proposedDuration = 75;
      shouldNotifyNeighbor = true;
      reason = `Kemacetan kritis (${vehicleCount} kendaraan). Durasi maksimal & kirim peringatan ke simpang tetangga.`;
    }

    // Koordinasi Multi-Agent (Jika simpang tetangga sedang macet parah)
    if (hasNeighborCongestionAlert && congestionLevel !== 'CRITICAL') {
      proposedDuration -= 10;
      reason += ` [Koordinasi Agen: Durasi dikurangi 10s untuk menahan laju kiriman kendaraan ke simpang tetangga yang sedang padat].`;
    }

    return {
      proposedDuration,
      reason,
      shouldNotifyNeighbor,
      congestionLevel,
    };
  }
}