const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;

interface TestSummary {
    name: string;
    passed: boolean;
    latencyMs: number;
    detail: string;
}

const results: TestSummary[] = [];

async function runStep(name: string, fn: () => Promise<string>) {
    const start = performance.now();
    try {
        const detail = await fn();
        const latencyMs = Math.round(performance.now() - start);
        results.push({ name, passed: true, latencyMs, detail });
        console.log(`✅ [PASS] ${name} (${latencyMs} ms) -> ${detail}`);
    } catch (err: any) {
        const latencyMs = Math.round(performance.now() - start);
        results.push({ name, passed: false, latencyMs, detail: err.message });
        console.error(`❌ [FAIL] ${name} (${latencyMs} ms) -> ${err.message}`);
    }
}

async function runPhase9Suite() {
    console.log('==========================================================');
    console.log('🧪 PHASE 9: AUTOMATED E2E & VOLUME TESTING SUITE');
    console.log('==========================================================\n');

    // 1. Health Check
    await runStep('1. API Health Check (GET /api/health)', async () => {
        const res = await fetch(`${BASE_URL}/health`);
        const json: any = await res.json();
        if (!res.ok || !json.success) throw new Error('Health check gagal');
        return json.message;
    });

    // 2. Normal Traffic Input
    await runStep('2. Normal Traffic Evaluation (POST /api/sensor)', async () => {
        const res = await fetch(`${BASE_URL}/sensor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ intersectionId: 'A', vehicleCount: 20 }),
        });
        const json: any = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || 'Gagal proses sensor');
        return `Simpang A -> Durasi: ${json.data.newGreenDuration}s (${json.data.congestionLevel})`;
    });

    // 3. Multi-Agent Coordination (A Critical -> B Reduces Outflow)
    await runStep('3. Multi-Agent Coordination Alert (Simpang A -> Simpang B)', async () => {
        // a. Picu kemacetan kritis di A
        const resA = await fetch(`${BASE_URL}/sensor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ intersectionId: 'A', vehicleCount: 75 }),
        });
        const jsonA: any = await resA.json();
        if (!jsonA.data?.neighborNotified) {
            throw new Error('Agen A gagal mengirim CONGESTION_ALERT ke Agen B');
        }

        // b. Simpang B merespons alert
        const resB = await fetch(`${BASE_URL}/sensor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ intersectionId: 'B', vehicleCount: 20 }),
        });
        const jsonB: any = await resB.json();
        if (jsonB.data?.newGreenDuration !== 25) {
            throw new Error(`Ekspektasi durasi B dipotong ke 25s, tetapi mendapat ${jsonB.data?.newGreenDuration}s`);
        }
        return `Alert A terkirim & direspons B -> Durasi B dipotong menjadi ${jsonB.data.newGreenDuration}s`;
    });

    // 4. SafetyGuard Fallback Rule (Anomali Sensor)
    await runStep('4. SafetyGuard Fallback Rule on Sensor Anomaly (-99)', async () => {
        const res = await fetch(`${BASE_URL}/sensor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ intersectionId: 'A', vehicleCount: -99 }),
        });
        const json: any = await res.json();
        if (!res.ok || json.data?.decisionSource !== 'FALLBACK_RULE') {
            throw new Error(`Fallback tidak aktif. Response: ${JSON.stringify(json)}`);
        }
        return `Source: ${json.data.decisionSource} | Durasi dikembalikan ke: ${json.data.newGreenDuration}s`;
    });

    // 5. Manual Override Endpoint
    await runStep('5. Operator Manual Override (POST /api/override)', async () => {
        const res = await fetch(`${BASE_URL}/override`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                intersectionId: 'B',
                newDuration: 60,
                reason: 'Uji otomatis prioritas darurat Phase 9',
                operatorId: 'QA_AUTOMATION',
            }),
        });
        const json: any = await res.json();
        if (!res.ok || !json.success) {
            throw new Error(`Override gagal: ${json.message || JSON.stringify(json.errors)}`);
        }
        return `Simpang B di-override ke ${json.data.updatedLight.greenDuration}s`;
    });

    // 6. Burst / Mini-Volume Test (10 Sequential Sensor Transactions)
    await runStep('6. Volume & Latency Stress Test (10 Transaksi Beruntun)', async () => {
        const iterations = 10;
        const latencies: number[] = [];

        for (let i = 0; i < iterations; i++) {
            const t0 = performance.now();
            const targetId = i % 2 === 0 ? 'A' : 'B';
            const randomVehicles = Math.floor(Math.random() * 65) + 5;

            const res = await fetch(`${BASE_URL}/sensor`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ intersectionId: targetId, vehicleCount: randomVehicles }),
            });

            if (!res.ok) throw new Error(`Gagal pada iterasi ke-${i + 1}`);
            latencies.push(performance.now() - t0);
        }

        const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / iterations);
        return `${iterations} transaksi sukses | Rata-rata waktu respons DB: ${avgLatency} ms/request`;
    });

    // 7. Verifikasi Audit Logs & State
    await runStep('7. Audit Trail & System State Verification (GET /api/logs)', async () => {
        const res = await fetch(`${BASE_URL}/logs`);
        const json: any = await res.json();
        if (!res.ok || !json.success) throw new Error('Gagal mengambil log');
        return `Tercatat ${json.data.auditLogs.length} Audit Logs & ${json.data.agentMessages.length} Agent Messages terbaru`;
    });

    // Cetak Tabel Ringkasan
    console.log('\n==========================================================');
    console.log('📊 RINGKASAN HASIL PENGUJIAN PHASE 9');
    console.log('==========================================================');
    console.table(results);

    const failedCount = results.filter((r) => !r.passed).length;
    if (failedCount > 0) {
        console.error(`\n⚠️ Terdapat ${failedCount} skenario yang gagal. Periksa pesan error di atas.`);
        process.exit(1);
    } else {
        console.log('\n🎉 SELURUH SKENARIO PHASE 9 LULUS 100%! Sistem siap didemonstrasikan.');
    }
}

runPhase9Suite();