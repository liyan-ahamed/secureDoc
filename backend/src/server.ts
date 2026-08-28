import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import prisma from './config/database';
import redis from './config/redis';

const app = express();

// Security & parsing middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : ['http://localhost:5173', 'http://localhost:3000'],
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
    console.log('✅ PostgreSQL connected');
  } catch (error) {
    console.warn('⚠️  PostgreSQL not available — start Docker containers to connect');
  }

  try {
    // Test Redis connection (lazyConnect requires explicit connect)
    await redis.connect();
    await redis.ping();
    console.log('✅ Redis connected');
  } catch (error) {
    console.warn('⚠️  Redis not available — start Docker containers to connect');
  }

  app.listen(config.port, () => {
    console.log(`\n🚀 Server running on http://localhost:${config.port}`);
    console.log(`📋 Health check: http://localhost:${config.port}/api/health`);
    console.log(`🌍 Environment: ${config.nodeEnv}\n`);
  });
};

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('\n🔄 Shutting down gracefully...');
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

startServer();

export default app;
