import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { sensorInputSchema, overrideInputSchema } from '../validators/traffic.validator';

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

// 2. Terima data sensor baru
export const receiveSensorData = async (req: Request, res: Response): Promise<void> => {
    try {
        const parsed = sensorInputSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                success: false,
                message: 'Validasi input gagal',
                errors: parsed.error.flatten().fieldErrors,
            });
            return;
        }

        const { intersectionId, vehicleCount } = parsed.data;

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

        const sensorRecord = await prisma.sensorData.create({
            data: {
                intersectionId,
                vehicleCount,
            },
        });

        await prisma.auditLog.create({
            data: {
                action: 'SENSOR_DATA_RECEIVED',
                entityType: 'SensorData',
                entityId: sensorRecord.id,
                details: { intersectionId, vehicleCount },
            },
        });

        res.status(201).json({
            success: true,
            message: 'Data sensor berhasil dicatat',
            data: sensorRecord,
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

// 3. Manual Override oleh Operator
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

        const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const overrideRecord = await tx.override.create({
                data: {
                    intersectionId,
                    previousDuration: currentState.greenDuration,
                    newDuration,
                    reason,
                    operatorId,
                },
            });

            const updatedLight = await tx.trafficLightState.update({
                where: { intersectionId },
                data: { greenDuration: newDuration },
            });

            await tx.decision.create({
                data: {
                    intersectionId,
                    greenDuration: newDuration,
                    reason: `[MANUAL OVERRIDE] ${reason}`,
                    source: 'OPERATOR',
                },
            });

            await tx.auditLog.create({
                data: {
                    action: 'MANUAL_OVERRIDE',
                    entityType: 'Override',
                    entityId: overrideRecord.id,
                    details: {
                        intersectionId,
                        previousDuration: currentState.greenDuration,
                        newDuration,
                        operatorId,
                        reason,
                    },
                },
            });

            return { overrideRecord, updatedLight };
        });

        res.status(200).json({
            success: true,
            message: 'Override durasi lampu berhasil diterapkan',
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

// 4. Ambil riwayat Audit Log & Pesan Antar-Agen
export const getSystemLogs = async (_req: Request, res: Response): Promise<void> => {
    try {
        const [auditLogs, agentMessages] = await Promise.all([
            prisma.auditLog.findMany({
                orderBy: { createdAt: 'desc' },
                take: 20,
            }),
            prisma.agentMessage.findMany({
                orderBy: { createdAt: 'desc' },
                take: 20,
            }),
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