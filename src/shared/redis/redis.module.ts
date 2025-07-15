import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule as NestRedisModule } from '@nestjs-modules/ioredis';
import { MessageCacheService } from './services/message-cache.service';
import { ConversationCacheService } from './services/conversation-cache.service';
import { MessageQueueService } from './services/message-queue.service';

@Module({
  imports: [
    NestRedisModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get('REDIS_URL');

        // If Redis URL is provided, use it directly (recommended for Redis Cloud)
        if (redisUrl) {
          return {
            type: 'single',
            url: redisUrl,
            options: {
              keyPrefix: configService.get('REDIS_KEY_PREFIX', 'chatbot:'),
              retryDelayOnFailover: 100,
              enableReadyCheck: true,
              maxRetriesPerRequest: 3,
              lazyConnect: true,
              connectTimeout: 10000, // 10 seconds
              commandTimeout: 5000, // 5 seconds
              // Additional options for Redis Cloud
              family: 4, // IPv4
              keepAlive: 30000, // 30 seconds in milliseconds
              // TLS options for secure connections (uncomment if needed)
              // tls: configService.get('REDIS_TLS') === 'true' ? {} : undefined,
            },
          };
        }

        // Fallback to individual options (for local development)
        return {
          type: 'single',
          options: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get('REDIS_PORT', 6379),
            username: configService.get('REDIS_USERNAME'), // Support Redis Cloud username
            password: configService.get('REDIS_PASSWORD'),
            db: configService.get('REDIS_DB', 0),
            keyPrefix: configService.get('REDIS_KEY_PREFIX', 'chatbot:'),
            retryDelayOnFailover: 100,
            enableReadyCheck: true,
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            connectTimeout: 10000,
            commandTimeout: 5000,
            family: 4,
            keepAlive: 30000, // 30 seconds in milliseconds
          },
        };
      },
    }),
  ],
  providers: [
    MessageCacheService,
    ConversationCacheService,
    MessageQueueService,
  ],
  exports: [MessageCacheService, ConversationCacheService, MessageQueueService],
})
export class RedisModule {}
