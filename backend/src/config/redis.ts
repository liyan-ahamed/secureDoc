import Redis from 'ioredis';
import { config } from './index';

const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    if (times > 3) {
      return null; // Stop retrying
    }
    return Math.min(times * 200, 2000);
  },
  lazyConnect: true,
});

let redisErrorLogged = false;

redis.on('connect', () => {
  redisErrorLogged = false;
  console.log('✅ Redis connected');
});

redis.on('error', (err: Error) => {
  if (!redisErrorLogged) {
    console.error('❌ Redis connection error:', err.message);
    redisErrorLogged = true;
  }
});

export default redis;
