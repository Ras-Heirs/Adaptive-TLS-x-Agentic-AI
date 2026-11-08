import prisma from '../config/database';
import { SensorInput, AgentProcessResult, ValidatedDecision } from '../types/agent.types';
import { DecisionEngine } from './decisionEngine';
import { SafetyGuard } from './safetyGuard';
import { TrafficLight } from '../models/trafficLight';

export class IntersectionAgent {
  public static async processSensorData(input: SensorInput): Promise<AgentProcessResult> {
    const { intersectionId, vehicleCount, overrideDuration, overrideReason } = input;

    // Pastikan simpang terdaftar di database
    const intersection = await prisma.intersection.findUnique({
      where: { id: intersectionId },
      include: { trafficLightState: true },
    });

    if (!intersection) {
      throw new Error(`Intersection dengan ID '${intersectionId}' tidak ditemukan.`);
    }

    const previousDuration = intersection.trafficLightState?.greenDuration ?? 30;

    // Cek apakah ada pesan CONGESTION_ALERT dari simpang tetangga
    const pendingAlerts = await prisma.agentMessage.findMany({
      where: {
        receiverId: intersectionId,
        messageType: 'CONGESTION_ALERT',
        status: 'PENDING',
      },
    });

    const hasNeighborAlert = pendingAlerts.length > 0;

    // Evaluasi Keputusan (Validate / Override / Fallback)
    let validatedDecision: ValidatedDecision;
    let congestionLevel: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL' = 'NORMAL';
    let shouldNotifyNeighbor = false;

    if (overrideDuration !== undefined) {

      // Skenario A: Operator melakukan Manual Override
      validatedDecision = SafetyGuard.override(overrideDuration, overrideReason);
      congestionLevel = vehicleCount > 45 ? 'CRITICAL' : 'NORMAL';

    } else if (SafetyGuard.isSensorAnomalous(vehicleCount)) {
      // Skenario B: Sensor mengirim angka anomali (misal negatif atau > 500) -> Picu Fallback Rule
      validatedDecision = SafetyGuard.fallback(
        `Anomali sensor terdeteksi (vehicleCount: ${vehicleCount}).`
      );

    } else {
      // Skenario C: Alur Normal -> DecisionEngine + SafetyGuard.validate()
      const rawDecision = DecisionEngine.evaluate(vehicleCount, hasNeighborAlert);
      validatedDecision = SafetyGuard.validate(rawDecision);
      congestionLevel = rawDecision.congestionLevel;
      shouldNotifyNeighbor = rawDecision.shouldNotifyNeighbor;
    }

    const targetNeighborId = intersectionId === 'A' ? 'B' : 'A';
    const safeVehicleCount = SafetyGuard.isSensorAnomalous(vehicleCount) ? 0 : vehicleCount;

    // Simpan seluruh perubahan & jalankan TrafficLight.setGreen()
    const updatedLight = await prisma.$transaction(async (tx) => {
      // Simpan data sensor
      const sensorRecord = await tx.sensorData.create({
        data: {
          intersectionId,
          vehicleCount: safeVehicleCount,
        },
      });

      // Simpan riwayat keputusan
      const decisionRecord = await tx.decision.create({
        data: {
          intersectionId,
          greenDuration: validatedDecision.finalDuration,
          reason: validatedDecision.reason,
          source: validatedDecision.source,
        },
      });

      //  Panggil TrafficLight.setGreen() untuk mengubah lampu & mengunci lampu tetangga
      const lightState = await TrafficLight.setGreen(
        intersectionId,
        validatedDecision.finalDuration,
        tx
      );

      // Tandai pesan dari tetangga sudah diproses
      if (hasNeighborAlert) {
        await tx.agentMessage.updateMany({
          where: {
            receiverId: intersectionId,
            status: 'PENDING',
          },
          data: { status: 'PROCESSED' },
        });
      }

      // Kirim pesan ke simpang tetangga jika kemacetan kritis
      if (shouldNotifyNeighbor) {
        await tx.agentMessage.create({
          data: {
            senderId: intersectionId,
            receiverId: targetNeighborId,
            messageType: 'CONGESTION_ALERT',
            payload: {
              vehicleCount: safeVehicleCount,
              congestionLevel,
              recommendedAction: 'REDUCE_OUTFLOW',
            },
            status: 'PENDING',
          },
        });
      }

      // Catat ke Audit Log
      await tx.auditLog.create({
        data: {
          action: `TRAFFIC_LIGHT_${validatedDecision.source}`,
          entityType: 'INTERSECTION',
          entityId: intersectionId,
          details: {
            sensorId: sensorRecord.id,
            decisionId: decisionRecord.id,
            rawVehicleCount: vehicleCount,
            previousDuration,
            newDuration: validatedDecision.finalDuration,
            decisionSource: validatedDecision.source,
            wasClampedBySafetyGuard: validatedDecision.wasClamped,
            coordinatedWithNeighbor: hasNeighborAlert,
          },
        },
      });

      return lightState;
    });

    return {
      intersectionId,
      vehicleCount,
      previousDuration,
      newGreenDuration: updatedLight.greenDuration,
      lightColor: updatedLight.color,
      congestionLevel,
      decisionReason: validatedDecision.reason,
      decisionSource: validatedDecision.source,
      neighborNotified: shouldNotifyNeighbor,
      targetNeighborId: shouldNotifyNeighbor ? targetNeighborId : undefined,
      timestamp: updatedLight.updatedAt,
    };
  }
}