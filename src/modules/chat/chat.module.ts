import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Entities
import { Customer } from '../users/entities/customer.entity';
import { User } from '../users/entities/users.entity';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { MessageQueue } from './entities/message-queue.entity';
import { ReviewerFeedback } from './entities/reviewer-feedback.entity';

// Services
import { CustomerService } from './services/customer.service';
import { ReviewerSessionService } from './services/reviewer-session.service';
import { ConversationService } from './services/conversation.service';
import { MessageProcessingService } from './services/message-processing.service';

// Controllers
import { CustomerController } from './controllers/customer.controller';
import { ConversationController } from './controllers/conversation.controller';
import { WebhookController } from './controllers/webhook.controller';

// Gateways
import { ChatGateway } from './gateways/chat.gateway';

// Import Redis Module
import { RedisModule } from '../../shared/redis/redis.module';

// Import UserModule for PermissionsGuard dependency
import { UserModule } from '../users/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Customer,
      User,
      Conversation,
      Message,
      MessageQueue,
      ReviewerFeedback,
    ]),
    RedisModule,
    UserModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRATION_TIME'),
        },
      }),
    }),
  ],
  controllers: [CustomerController, ConversationController, WebhookController],
  providers: [
    CustomerService,
    ReviewerSessionService,
    ConversationService,
    MessageProcessingService,
    ChatGateway,
  ],
  exports: [
    CustomerService,
    ReviewerSessionService,
    ConversationService,
    MessageProcessingService,
    ChatGateway,
  ],
})
export class ChatModule {}
