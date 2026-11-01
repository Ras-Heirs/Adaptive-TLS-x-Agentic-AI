/// <reference types="node" />
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[SEED] Starting database seeding...');

  const intersections = [
    { id: 'A', name: 'Simpang A (Utama)' },
    { id: 'B', name: 'Simpang B (Tetangga)' },
  ];

  for (const item of intersections) {
    const intersection = await prisma.intersection.upsert({
      where: { id: item.id },
      update: { name: item.name },
      create: { id: item.id, name: item.name },
    });

    await prisma.trafficLightState.upsert({
      where: { intersectionId: intersection.id },
      update: {},
      create: {
        intersectionId: intersection.id,
        color: item.id === 'A' ? 'GREEN' : 'RED',
        greenDuration: 30,
      },
    });
    console.log(`[SEED] Intersection ${intersection.id} initialized.`);
  }
  console.log('[SEED] Completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });