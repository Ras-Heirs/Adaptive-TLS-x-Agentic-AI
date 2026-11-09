import { RawDecision, ValidatedDecision } from '../types/agent.types';

export class SafetyGuard {
  public static readonly MIN_GREEN_DURATION = 15;
  public static readonly MAX_GREEN_DURATION = 90;
  public static readonly FALLBACK_DURATION = 30;
  public static readonly MAX_REALISTIC_VEHICLES = 500;

  //Memvalidasi keputusan murni dari DecisionEngine
  public static validate(rawDecision: RawDecision): ValidatedDecision {
    // Jika nilai durasi korup / bukan angka, jalankan Fallback Rule
    if (
      typeof rawDecision.proposedDuration !== 'number' ||
      Number.isNaN(rawDecision.proposedDuration) ||
      rawDecision.proposedDuration <= 0
    ) {
      return this.fallback('Nilai durasi dari DecisionEngine tidak valid atau korup.');
    }

    let finalDuration = Math.round(rawDecision.proposedDuration);
    let reason = rawDecision.reason;
    let wasClamped = false;

    if (finalDuration < this.MIN_GREEN_DURATION) {
      finalDuration = this.MIN_GREEN_DURATION;
      reason += ` [SafetyGuard: Disesuaikan ke batas minimum ${this.MIN_GREEN_DURATION}s]`;
      wasClamped = true;
    } else if (finalDuration > this.MAX_GREEN_DURATION) {
      finalDuration = this.MAX_GREEN_DURATION;
      reason += ` [SafetyGuard: Dibatasi ke batas maksimum ${this.MAX_GREEN_DURATION}s]`;
      wasClamped = true;
    }

    return {
      finalDuration,
      reason,
      wasClamped,
      source: 'AGENT',
    };
  }

  // Override keputusan agen secara manual (tetap menjaga batas aman)
  public static override(
    manualDuration: number,
    operatorReason: string = 'Intervensi manual operator'
  ): ValidatedDecision {
    if (typeof manualDuration !== 'number' || Number.isNaN(manualDuration)) {
      return this.fallback('Input durasi manual override tidak valid.');
    }

    let finalDuration = Math.round(manualDuration);
    let wasClamped = false;
    let clampNote = '';

    if (finalDuration < this.MIN_GREEN_DURATION) {
      finalDuration = this.MIN_GREEN_DURATION;
      wasClamped = true;
      clampNote = ` (Dikunci ke batas aman minimum ${this.MIN_GREEN_DURATION}s)`;
    } else if (finalDuration > this.MAX_GREEN_DURATION) {
      finalDuration = this.MAX_GREEN_DURATION;
      wasClamped = true;
      clampNote = ` (Dikunci ke batas aman maksimum ${this.MAX_GREEN_DURATION}s)`;
    }

    return {
      finalDuration,
      reason: `[OVERRIDE] ${operatorReason}: Durasi diatur ke ${finalDuration}s${clampNote}.`,
      wasClamped,
      source: 'MANUAL_OVERRIDE',
    };
  }

  //pengaman terakhir saat terjadi anomali sensor atau error sistem
  public static fallback(errorContext: string): ValidatedDecision {
    return {
      finalDuration: this.FALLBACK_DURATION,
      reason: `[FALLBACK RULE AKTIF] ${errorContext} Mengembalikan durasi ke standar aman (${this.FALLBACK_DURATION}s).`,
      wasClamped: true,
      source: 'FALLBACK_RULE',
    };
  }

  //Cek apakah data sensor masuk akal sebelum dihitung
  public static isSensorAnomalous(vehicleCount: number): boolean {
    return (
      typeof vehicleCount !== 'number' ||
      Number.isNaN(vehicleCount) ||
      vehicleCount < 0 ||
      vehicleCount > this.MAX_REALISTIC_VEHICLES
    );
  }
}