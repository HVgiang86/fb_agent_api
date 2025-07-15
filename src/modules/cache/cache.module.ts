import { Module } from '@nestjs/common';
import { CacheController } from './cache.controller';
import { RedisModule } from '../../shared/redis/redis.module';
import { UsersModule } from '../users/user.module';

@Module({
  imports: [
    RedisModule,
    UsersModule, // Import để PermissionsGuard có thể access UsersService
  ],
  controllers: [CacheController],
})
export class CacheModule {}
