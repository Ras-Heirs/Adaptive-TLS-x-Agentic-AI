import { IntersectionAgent } from './agents/intersectionAgent';
import { TrafficLight } from './models/trafficLight';
import prisma from './config/database';

async function runPhase5And6Test() {
  console.log("==========================================");
  console.log(" SYSTEM BOOT: MohammadAriqHaqi_2406431271 ");
  console.log("==========================================");
  console.log("Menguji Phase 5 (SafetyGuard) & Phase 6 (TrafficLight)...\n");

  try {
    // 1. Uji Validate Normal & setGreen() pada Simpang A
    console.log("1️⃣ [TEST VALIDATE & SET_GREEN] Simpang A (30 Kendaraan)");
    const res1 = await IntersectionAgent.processSensorData({
      intersectionId: 'A',
      vehicleCount: 30,
    });
    console.log("Hasil A:", res1.newGreenDuration, "detik | Warna:", res1.lightColor, "| Source:", res1.decisionSource);
    const stateB = await TrafficLight.getState('B');
    console.log("State Simpang B otomatis menjadi:", stateB?.color);
    console.log("------------------------------------------");

    // 2. Uji Manual Override (melebihi batas aman 120s -> harus di-clamp ke 90s)
    console.log("2️⃣ [TEST OVERRIDE + CLAMPING] Operator meminta 120 detik di Simpang B");
    const res2 = await IntersectionAgent.processSensorData({
      intersectionId: 'B',
      vehicleCount: 15,
      overrideDuration: 120,
      overrideReason: 'Prioritas iring-iringan ambulans',
    });
    console.log("Hasil Override:", res2.newGreenDuration, "detik | Alasan:", res2.decisionReason);
    const stateA = await TrafficLight.getState('A');
    console.log("State Simpang A otomatis dikunci ke:", stateA?.color);
    console.log("------------------------------------------");

    // 3. Uji Fallback Rule (Sensor Error / Anomali negatif)
    console.log("3️⃣ [TEST FALLBACK RULE] Sensor Simpang A error mengirim -99 kendaraan");
    const res3 = await IntersectionAgent.processSensorData({
      intersectionId: 'A',
      vehicleCount: -99,
    });
    console.log("Hasil Fallback:", res3.newGreenDuration, "detik | Source:", res3.decisionSource);
    console.log("Alasan:", res3.decisionReason);
    console.log("------------------------------------------");

  } catch (error) {
    console.error("❌ Error saat pengujian:", error);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase5And6Test();