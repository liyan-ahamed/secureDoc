import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import redis from '../config/redis';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    const dbStatus = 'connected';

    // Check Redis connection
    const redisPing = await redis.ping();
    const redisStatus = redisPing === 'PONG' ? 'connected' : 'disconnected';

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      services: {
        database: 'unknown',
        redis: 'unknown',
      },
      message: 'One or more services are unavailable',
    });
  }
});

export default router;
