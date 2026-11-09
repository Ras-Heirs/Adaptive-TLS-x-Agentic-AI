import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { TrafficLightStateResult } from '../types/agent.types';

export class TrafficLight {
  // Mengubah status lampu simpang menjadi GREEN dengan durasi tertentu, sekaligus mengunci simpang tetangga menjadi RED (State Management).
  public static async setGreen(
    intersectionId: string,
    duration: number,
    tx?: Prisma.TransactionClient
  ): Promise<TrafficLightStateResult> {
    const db = tx ?? prisma;
    const neighborId = intersectionId === 'A' ? 'B' : 'A';

    // Set simpang aktif menjadi GREEN dengan durasi baru
    const activeLight = await db.trafficLightState.upsert({
      where: { intersectionId },
      update: {
        color: 'GREEN',
        greenDuration: duration,
      },
      create: {
        intersectionId,
        color: 'GREEN',
        greenDuration: duration,
      },
    });

    // Pastikan simpang neighbor berada dalam state RED (jika simpang tetangga sudah ada di DB)
    const neighborExists = await db.intersection.findUnique({
      where: { id: neighborId },
    });

    if (neighborExists) {
      await db.trafficLightState.upsert({
        where: { intersectionId: neighborId },
        update: {
          color: 'RED',
        },
        create: {
          intersectionId: neighborId,
          color: 'RED',
          greenDuration: 30,
        },
      });
    }

    return {
      intersectionId: activeLight.intersectionId,
      color: activeLight.color,
      greenDuration: activeLight.greenDuration,
      updatedAt: activeLight.updatedAt,
    };
  }

  // Mengubah status lampu menjadi RED secara eksplisit
  public static async setRed(
    intersectionId: string,
    tx?: Prisma.TransactionClient
  ): Promise<TrafficLightStateResult> {
    const db = tx ?? prisma;

    const updated = await db.trafficLightState.upsert({
      where: { intersectionId },
      update: { color: 'RED' },
      create: {
        intersectionId,
        color: 'RED',
        greenDuration: 30,
      },
    });

    return {
      intersectionId: updated.intersectionId,
      color: updated.color,
      greenDuration: updated.greenDuration,
      updatedAt: updated.updatedAt,
    };
  }

  // Membaca state lampu lalu lintas saat ini

  public static async getState(intersectionId: string): Promise<TrafficLightStateResult | null> {
    const state = await prisma.trafficLightState.findUnique({
      where: { intersectionId },
    });

    if (!state) return null;

    return {
      intersectionId: state.intersectionId,
      color: state.color,
      greenDuration: state.greenDuration,
      updatedAt: state.updatedAt,
    };
  }
}
