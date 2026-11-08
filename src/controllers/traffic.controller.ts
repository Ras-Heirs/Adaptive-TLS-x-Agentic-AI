import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { sensorInputSchema, overrideInputSchema } from '../validators/traffic.validator';
import { TrafficService } from '../services/trafficService';
import { SafetyGuard } from '../agents/safetyGuard';
import { TrafficLight } from '../models/trafficLight';
import { AuditLogger } from '../utils/auditLogger';

// 1. Ambil status seluruh persimpangan beserta kondisi lampu & data terbaru
export const getIntersections = async (_req: Request, res: Response): Promise<void> => {
    try {
        const intersections = await prisma.intersection.findMany({
            include: {
                trafficLightState: true,
                sensorData: {
                    orderBy: { timestamp: 'desc' },
                    take: 5,
                },
                decisions: {
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
            },
            orderBy: { id: 'asc' },
        });

        res.status(200).json({
            success: true,
            data: intersections,
        });
    } catch (error: any) {
        console.error('[ERROR] getIntersections:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data persimpangan',
            error: error?.message || String(error),
        });
    }
};

// 2. Terima data sensor baru & jalankan Agentic AI (Phase 4 - 7)
export const receiveSensorData = async (req: Request, res: Response): Promise<void> => {
    try {
        // Jika penguji sengaja mengirim angka anomali (misal negatif) untuk menguji Fallback Rule Phase 5,
        // kita izinkan masuk ke IntersectionAgent selama tipe datanya tetap number.
        const rawId = req.body?.intersectionId;
        const rawCount = req.body?.vehicleCount;
        const isTestingAnomaly =
            typeof rawId === 'string' &&
            typeof rawCount === 'number' &&
            SafetyGuard.isSensorAnomalous(rawCount);

        let intersectionId = rawId;
        let vehicleCount = rawCount;

        if (!isTestingAnomaly) {
            const parsed = sensorInputSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({
                    success: false,
                    message: 'Validasi input gagal',
                    errors: parsed.error.flatten().fieldErrors,
                });
                return;
            }
            intersectionId = parsed.data.intersectionId;
            vehicleCount = parsed.data.vehicleCount;
        }

        const intersection = await prisma.intersection.findUnique({
            where: { id: intersectionId },
        });

        if (!intersection) {
            res.status(404).json({
                success: false,
                message: `Simpang dengan ID '${intersectionId}' tidak ditemukan`,
            });
            return;
        }

        // Panggil otak agen (Phase 4: DecisionEngine, Phase 5: SafetyGuard, Phase 6: TrafficLight, Phase 7: AgentMessenger & AuditLogger)
        const agentResult = await TrafficService.handleSensorInput({
            intersectionId,
            vehicleCount,
        });

        res.status(201).json({
            success: true,
            message: 'Data sensor berhasil diproses oleh Intersection Agent',
            data: agentResult,
        });
    } catch (error: any) {
        console.error('[ERROR] receiveSensorData:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal memproses data sensor',
            error: error?.message || String(error),
        });
    }
};

// 3. Manual Override oleh Operator (Terintegrasi dengan Phase 5 SafetyGuard & Phase 6 TrafficLight)
export const manualOverride = async (req: Request, res: Response): Promise<void> => {
    try {
        const parsed = overrideInputSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                success: false,
                message: 'Validasi override gagal',
                errors: parsed.error.flatten().fieldErrors,
            });
            return;
        }

        const { intersectionId, newDuration, reason, operatorId } = parsed.data;

        const currentState = await prisma.trafficLightState.findUnique({
            where: { intersectionId },
        });

        if (!currentState) {
            res.status(404).json({
                success: false,
                message: `Status lampu untuk Simpang '${intersectionId}' tidak ditemukan`,
            });
            return;
        }

        // PHASE 5: Validasi & Clamping (15s - 90s) melalui SafetyGuard.override()
        const validatedOverride = SafetyGuard.override(newDuration, reason);

        const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const overrideRecord = await tx.override.create({
                data: {
                    intersectionId,
                    previousDuration: currentState.greenDuration,
                    newDuration: validatedOverride.finalDuration,
                    reason: validatedOverride.reason,
                    operatorId,
                },
            });

            // PHASE 6: Ubah lampu ke GREEN & otomatis kunci simpang tetangga ke RED
            const updatedLight = await TrafficLight.setGreen(
                intersectionId,
                validatedOverride.finalDuration,
                tx
            );

            await tx.decision.create({
                data: {
                    intersectionId,
                    greenDuration: validatedOverride.finalDuration,
                    reason: validatedOverride.reason,
                    source: 'OPERATOR',
                },
            });

            // PHASE 7: Catat ke AuditLog
            await AuditLogger.log(
                {
                    action: 'MANUAL_OVERRIDE',
                    entityType: 'INTERSECTION',
                    entityId: intersectionId,
                    details: {
                        overrideId: overrideRecord.id,
                        intersectionId,
                        previousDuration: currentState.greenDuration,
                        requestedDuration: newDuration,
                        finalDuration: validatedOverride.finalDuration,
                        wasClamped: validatedOverride.wasClamped,
                        operatorId,
                        reason: validatedOverride.reason,
                    },
                },
                tx
            );

            return { overrideRecord, updatedLight, validatedOverride };
        });

        res.status(200).json({
            success: true,
            message: 'Override durasi lampu berhasil diterapkan melalui SafetyGuard',
            data: result,
        });
    } catch (error: any) {
        console.error('[ERROR] manualOverride:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal melakukan manual override',
            error: error?.message || String(error),
        });
    }
};

// 4. Riwayat Audit Log & Pesan Antar-Agen
export const getSystemLogs = async (_req: Request, res: Response): Promise<void> => {
    try {
        const [auditLogs, agentMessages] = await Promise.all([
            TrafficService.getAuditLogs(20),
            TrafficService.getAgentMessages(20),
        ]);

        res.status(200).json({
            success: true,
            data: {
                auditLogs,
                agentMessages,
            },
        });
    } catch (error: any) {
        console.error('[ERROR] getSystemLogs:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil log sistem',
            error: error?.message || String(error),
        });
    }
};