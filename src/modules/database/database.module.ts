import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import User from '../users/entities/users.entity';
import { Permission } from '../users/entities/permission.entity';
import { UserPermission } from '../users/entities/user-permission.entity';
import { UserCustomerType } from '../users/entities/user-customer-type.entity';
import { UserSession } from '../users/entities/user-session.entity';
import { PasswordResetToken } from '../users/entities/password-reset-token.entity';
import { SystemConfig } from '../system-config/entities/system-config.entity';
import { Customer } from '../users/entities/customer.entity';
import { Conversation } from '../chat/entities/conversation.entity';
import { Message } from '../chat/entities/message.entity';
import { MessageQueue } from '../chat/entities/message-queue.entity';
import { ReviewerFeedback } from '../chat/entities/reviewer-feedback.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('MYSQL_HOST'),
        port: +configService.get<number>('MYSQL_PORT'),
        username: configService.get('MYSQL_USER'),
        password: configService.get('MYSQL_PASSWORD'),
        database: configService.get('MYSQL_DB'),
        entities: [
          User,
          Permission,
          UserPermission,
          UserCustomerType,
          UserSession,
          PasswordResetToken,
          SystemConfig,
          Customer,
          Conversation,
          Message,
          MessageQueue,
          ReviewerFeedback,
        ],
        synchronize: true, // Enable để TypeORM tự động tạo schema
        timezone: '+07:00',
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
