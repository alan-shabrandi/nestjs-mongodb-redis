import { registerAs } from '@nestjs/config';

export default registerAs('cache', () => ({
  ttl: parseInt(process.env.CACHE_TTL || '60000', 10),
  size: parseInt(process.env.CACHE_SIZE || '5000', 10),
  redisUri: process.env.REDIS_URI || 'redis://localhost:6382',
}));
