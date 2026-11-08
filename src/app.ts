import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { errorHandler } from './middleware/errorHandler';
import trafficRoutes from './routes/traffic.routes';

dotenv.config();

const app = express();

// Nonaktifkan contentSecurityPolicy bawaan helmet agar CDN Tailwind & script dashboard di index.html bisa berjalan
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(cors());
app.use(express.json());

// Sajikan halaman Web Dashboard dari folder public/
app.use(express.static(path.join(process.cwd(), 'public')));

app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Backend API is running healthy',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', trafficRoutes);

// 404 Handler (dieksekusi jika rute tidak ditemukan di public/ maupun di /api)
app.use((req: Request, res: Response, next: NextFunction) => {
  const error: any = new Error(`Endpoint ${req.originalUrl} tidak ditemukan`);
  error.statusCode = 404;
  next(error);
});

app.use(errorHandler);

export default app;