import { Prisma } from '@prisma/client';
import prisma from '../config/database';

export interface AuditLogInput {
    action: string;
    entityType: 'INTERSECTION' | 'TRAFFIC_LIGHT' | 'AGENT_MESSAGE' | 'SYSTEM';
    entityId: string;
    details: Record<string, unknown>;
}

// Mencatat aktivitas agen atau sistem ke tabel AuditLog
export class AuditLogger {
    public static async log(
        input: AuditLogInput,
        tx?: Prisma.TransactionClient
    ) {
        const db = tx ?? prisma;

        const record = await db.auditLog.create({
            data: {
                action: input.action,
                entityType: input.entityType,
                entityId: input.entityId,
                details: input.details as Prisma.InputJsonValue,
            },
        });

        console.log(
            `[AUDIT] ${new Date().toISOString()} | ${input.action} | ${input.entityType}:${input.entityId}`
        );

        return record;
    }

    // Mengambil riwayat audit terbaru untuk kebutuhan monitoring / dashboard
    public static async getRecentLogs(limit: number = 20) {
        return prisma.auditLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }
}