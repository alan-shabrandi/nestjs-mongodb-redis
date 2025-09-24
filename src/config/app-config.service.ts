import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  // --- Server ---
  get port(): number {
    return this.configService.get<number>('PORT', 3000);
  }

  // --- Database ---
  get mongoUri(): string {
    return this.configService.getOrThrow<string>('database.uri');
  }

  // --- Cache ---
  get cacheTtl(): number {
    return this.configService.get<number>('cache.ttl', 60000);
  }

  get cacheSize(): number {
    return this.configService.get<number>('cache.size', 5000);
  }

  get redisUri(): string {
    return this.configService.getOrThrow<string>('cache.redisUri');
  }

  // --- Throttler ---
  get throttleTtl(): number {
    return this.configService.get<number>('throttler.ttl', 60000);
  }

  get throttleLimit(): number {
    return this.configService.get<number>('throttler.limit', 1000);
  }

  // --- Auth ---
  get jwtSecret(): string {
    return this.configService.getOrThrow<string>('auth.jwtSecret');
  }
}
