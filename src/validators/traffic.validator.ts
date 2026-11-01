import { z } from 'zod';

export const sensorInputSchema = z.object({
    intersectionId: z.string().min(1, 'Intersection ID wajib diisi (contoh: A atau B)'),
    vehicleCount: z.number().int().min(0, 'Jumlah kendaraan tidak boleh negatif'),
});

export const overrideInputSchema = z.object({
    intersectionId: z.string().min(1, 'Intersection ID wajib diisi'),
    newDuration: z
        .number()
        .int()
        .min(10, 'Durasi hijau minimal 10 detik (Safety Guard)')
        .max(120, 'Durasi hijau maksimal 120 detik (Safety Guard)'),
    reason: z.string().min(3, 'Alasan override wajib diisi'),
    operatorId: z.string().min(1, 'Operator ID wajib diisi'),
});