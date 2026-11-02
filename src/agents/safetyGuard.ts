import { RawDecision, ValidatedDecision } from '../types/agent.types';

export class SafetyGuard {
  // Batas aman dalam satuan detik
  private static readonly MIN_GREEN_DURATION = 15;
  private static readonly MAX_GREEN_DURATION = 90;

  public static validate(rawDecision: RawDecision): ValidatedDecision {
    let finalDuration = rawDecision.proposedDuration;
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
    };
  }
}