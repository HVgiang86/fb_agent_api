import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemConfig } from '../system-config/entities/system-config.entity';
import { ConfigService } from './services/config.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forFeature([SystemConfig]),
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class GlobalModule {}
