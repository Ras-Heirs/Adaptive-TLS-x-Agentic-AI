import { TrafficService } from './services/trafficService';
import prisma from './config/database';

async function runPhase7Test() {
  console.log("==========================================");
  console.log(" SYSTEM BOOT: Adaptive-TLS-x-Agentic-AI  ");
  console.log("==========================================");
  console.log("Menguji Phase 7 (Multi-Agent Messenger, AuditLogger & TrafficService)...\n");

  try {
    // 1. Simpang A mengalami kemacetan kritis -> otomatis kirim pesan ke B
    console.log("1️⃣ [SIMPANG A] Kemacetan Kritis (70 Kendaraan)");
    const resA = await TrafficService.handleSensorInput({
      intersectionId: 'A',
      vehicleCount: 70,
    });
    console.log(`>> Durasi A: ${resA.newGreenDuration}s | Kirim Alert ke-${resA.targetNeighborId}: ${resA.neighborNotified}\n`);

    // 2. Simpang B merespons alert dari Simpang A
    console.log("2️⃣ [SIMPANG B] Lalu Lintas Normal (20 Kendaraan) + Menerima Koordinasi dari A");
    const resB = await TrafficService.handleSensorInput({
      intersectionId: 'B',
      vehicleCount: 20,
    });
    console.log(`>> Durasi B: ${resB.newGreenDuration}s | Alasan: ${resB.decisionReason}\n`);

    // 3. Cek Status Sistem & Pesan Antar-Agen melalui TrafficService
    const messages = await TrafficService.getAgentMessages(2);
    console.log("3️⃣ [AGENT MESSAGES] Status pesan terakhir:", messages[0]?.status);

    const logs = await TrafficService.getAuditLogs(2);
    console.log("4️⃣ [AUDIT LOGS] Jumlah log terbaru terambil:", logs.length);
    console.log("------------------------------------------");
  } catch (error) {
    console.error("❌ Error saat pengujian Phase 7:", error);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase7Test();