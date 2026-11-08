import prisma from '../config/database';
import { IntersectionAgent } from '../agents/intersectionAgent';
import { AuditLogger } from '../utils/auditLogger';
import { SensorInput, AgentProcessResult } from '../types/agent.types';

export class TrafficService {
    /**
     * Memproses data sensor masuk atau manual override
     */
    public static async handleSensorInput(input: SensorInput): Promise<AgentProcessResult> {
        return IntersectionAgent.processSensorData(input);
    }

    /**
     * Mengambil status terkini dari semua simpang (beserta data sensor & keputusan terakhir)
     */
    public static async getSystemStatus() {
        return prisma.intersection.findMany({
            include: {
                trafficLightState: true,
                sensorData: {
                    orderBy: { timestamp: 'desc' },
                    take: 1,
                },
                decisions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
            orderBy: { id: 'asc' },
        });
    }

    /**
     * Mengambil riwayat komunikasi antar-agen (AgentMessage)
     */
    public static async getAgentMessages(limit: number = 20) {
        return prisma.agentMessage.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }

    /**
     * Mengambil riwayat Audit Log terbaru
     */
    public static async getAuditLogs(limit: number = 20) {
        return AuditLogger.getRecentLogs(limit);
    }
}