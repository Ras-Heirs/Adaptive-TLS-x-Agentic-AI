import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import trafficRoutes from './routes/traffic.routes';

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Adaptive TLS x Agentic AI Backend API is running',
    health: '/api/health',
  });
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Backend API is running healthy',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', trafficRoutes);

// 404 Handler
app.use((req: Request, _res: Response, next: NextFunction) => {
  const error: any = new Error(`Endpoint ${req.originalUrl} tidak ditemukan`);
  error.statusCode = 404;
  next(error);
});

app.use(errorHandler);

export default app;