import { Prisma } from '@prisma/client';
import prisma from '../config/database';

export class AgentMessenger {
    // Menentukan ID simpang tetangga (A <-> B)
    public static getNeighborId(intersectionId: string): string {
        return intersectionId === 'A' ? 'B' : 'A';
    }

    // Mengambil daftar pesan peringatan yang masih PENDING dari simpang tetangga
    public static async getPendingAlerts(intersectionId: string) {
        return prisma.agentMessage.findMany({
            where: {
                receiverId: intersectionId,
                messageType: 'CONGESTION_ALERT',
                status: 'PENDING',
            },
            orderBy: { createdAt: 'asc' },
        });
    }

    // Mengirim sinyal peringatan kemacetan (CONGESTION_ALERT) ke simpang tetangga
    public static async sendCongestionAlert(
        senderId: string,
        vehicleCount: number,
        congestionLevel: string,
        tx?: Prisma.TransactionClient
    ) {
        const db = tx ?? prisma;
        const receiverId = this.getNeighborId(senderId);

        return db.agentMessage.create({
            data: {
                senderId,
                receiverId,
                messageType: 'CONGESTION_ALERT',
                payload: {
                    vehicleCount,
                    congestionLevel,
                    recommendedAction: 'REDUCE_OUTFLOW',
                    sentAt: new Date().toISOString(),
                },
                status: 'PENDING',
            },
        });
    }

    // Menandai semua pesan masuk di simpang tersebut sebagai PROCESSED
    public static async acknowledgeAlerts(
        receiverId: string,
        tx?: Prisma.TransactionClient
    ) {
        const db = tx ?? prisma;

        return db.agentMessage.updateMany({
            where: {
                receiverId,
                messageType: 'CONGESTION_ALERT',
                status: 'PENDING',
            },
            data: {
                status: 'PROCESSED',
            },
        });
    }
}