import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import * as Joi from '@hapi/joi';
import { DatabaseModule } from '../database/database.module';
import { AuthenticationModule } from '../auth/authentication.module';
import { UserModule } from '../users/user.module';
import { GlobalModule } from '../global/global.module';
import { SystemConfigModule } from '../system-config/system-config.module';
import { RedisModule } from '../../shared/redis/redis.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      validationSchema: Joi.object({
        SERVICE_NAME: Joi.string().required(),
        NODE_ENV: Joi.string().required(),
        PORT: Joi.number().required(),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRATION_TIME: Joi.string().required(),

        MYSQL_HOST: Joi.string().required(),
        MYSQL_PORT: Joi.number().required(),
        MYSQL_USER: Joi.string().required(),
        MYSQL_PASSWORD: Joi.string().required(),
        MYSQL_DB: Joi.string().required(),

        REDIS_HOST: Joi.string().default('localhost'),
        REDIS_PORT: Joi.number().default(6379),
        REDIS_PASSWORD: Joi.string().allow(''),
        REDIS_DB: Joi.number().default(0),
        REDIS_URL: Joi.string().allow(''),
        REDIS_KEY_PREFIX: Joi.string().default('chatbot:'),

        QUERY_LOG_ENABLE: Joi.boolean().required(),
        MAX_QUERY_RETRY: Joi.number().required(),
      }),
    }),
    GlobalModule,
    DatabaseModule,
    AuthenticationModule,
    UserModule,
    SystemConfigModule,
    RedisModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
