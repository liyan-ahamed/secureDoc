import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import prisma from './config/database';
import redis from './config/redis';
import { autoPurgeTrash } from './services/trash';

const app = express();
const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter((origin): origin is string => Boolean(origin));

// Security & parsing middleware
app.use(helmet());
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();
  } catch (error) {
    console.warn('⚠️  PostgreSQL not available — start Docker containers to connect');
  }

  try {
    // Test Redis connection (lazyConnect requires explicit connect)
    await redis.connect();
    await redis.ping();
  } catch (error) {
    console.warn('⚠️  Redis not available — start Docker containers to connect');
  }

  app.listen(config.port, () => {
  });

  const purgeTrash = () => autoPurgeTrash().catch((error) => console.error('Automatic trash purge failed:', error));
  purgeTrash();
  setInterval(purgeTrash, 60 * 60 * 1000);
};

// Graceful shutdown
const gracefulShutdown = async () => {
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

startServer();

export default app;
