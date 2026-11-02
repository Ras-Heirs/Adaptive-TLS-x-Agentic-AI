import { PrismaClient } from "@prisma/client/extension";
import prisma from "../config/database";
import { SensorInput, AgentProcessResult } from "../types/agent.types";
import { DecisionEngine } from "./decisionEngine";
import { SafetyGuard } from "./safetyGuard";

export class IntersectionAgent {

    public static async processSensorData (input: SensorInput): Promise<AgentProcessResult> {
        const { intersectionId, vehicleCount } = input;
        
        // Pastikan simpang ada di database
        const intersection = await prisma.intersection.findUnique({
            where: { id: intersectionId },
            include: { trafficLightState: true},

        });
        
        if (!intersection){
            throw new Error(`Intersection dengan ID '${intersectionId}' tidak ditemukan.`);

        }

        const previousDuration = intersection.trafficLightState?.greenDuration ?? 30;

        // check ada pesan CONGESTION_ALERT yang belum diproses dari simpang tetangga
        const pendingAlerts = await prisma.agentMessage.findMany({

            where: {
                receiverId: intersectionId,
                messageType: 'CONGESTION_ALERT',
                status: 'PENDING',
            },
        });

        const hasNeighborAlert = pendingAlerts.length > 0;

        // jalankan decision engine dan safety guard
        const rawDecision = DecisionEngine.evaluate(vehicleCount, hasNeighborAlert);
        const validatedDecision = SafetyGuard.validate(rawDecision);

        // tentukan ID simpang tetangga (Jika A maka B, jika B maka A)
        const targetNeighborId = intersectionId == 'A' ? 'B' : 'A';

        // simpan semua perubahan ke database menggunakan Prisma Transaction
        const result = await prisma.$transaction(async (tx) => {
            // simpan data sensor
            const sensorRecord = await tx.sensorData.create({
                data: {
                    intersectionId,
                    vehicleCount,
                },
            });

            // simpan log keputusan agent
            const decisionRecord = await tx.decision.create({
                data: {
                    intersectionId,
                    greenDuration: validatedDecision.finalDuration,
                    reason: validatedDecision.reason,
                    source: 'AGENT',
                },
            });

            // update status lampu lalu lintas
            const updatedLight = await tx.trafficLightState.upsert({
                where: { intersectionId },
                update: {
                    greenDuration: validatedDecision.finalDuration,
                    color: 'GREEN',
                },
                create: {
                    intersectionId,
                    greenDuration: validatedDecision.finalDuration,
                    color: 'GREEN',
                },
            });

           // tandai pesan dari tetangga sudah dibaca (PROCESSED)
           if (hasNeighborAlert) {
                await tx.agentMessage.updateMany({
                    where: {
                        receiverId: intersectionId,
                        status: 'PENDING',
                    },
                    data: { status: 'PROCESSED' },
                });
            }

           // kirim pesan ke simpang tetangga jika terjadi kemacetan kritis
           if (rawDecision.shouldNotifyNeighbor) {
                await tx.agentMessage.create({
                    data: {
                        senderId: intersectionId,
                        receiverId: targetNeighborId,
                        messageType: 'CONGESTION_ALERT',
                        payload: {
                            vehicleCount,
                            congestionLevel: rawDecision.congestionLevel,
                            recommendedAction: 'REDUCE_OUTFLOW',
                        },
                        status: 'PENDING',
                    },
                });
            }

            // catat ke Audit Log
            await tx.auditLog.create({
                data: {
                    action: 'AGENT_DECISION_EXECUTED',
                    entityType: 'INTERSECTION',
                    entityId: intersectionId,
                    details: {
                        sensorId: sensorRecord.id,
                        decisionId: decisionRecord.id,
                        vehicleCount,
                        previousDuration,
                        newDuration: validatedDecision.finalDuration,
                        wasClampedBySafetyGuard: validatedDecision.wasClamped,
                        coordinatedWithNeighbor: hasNeighborAlert,
                    },
                },
            });

            return updatedLight;
        });

        return {
            intersectionId,
            vehicleCount,
            previousDuration,
            newGreenDuration: result.greenDuration,
            lightColor: result.color,
            congestionLevel: rawDecision.congestionLevel,
            decisionReason: validatedDecision.reason,
            neighborNotified: rawDecision.shouldNotifyNeighbor,
            targetNeighborId: rawDecision.shouldNotifyNeighbor ? targetNeighborId : undefined,
            timestamp: new Date(),
        };
    }
}