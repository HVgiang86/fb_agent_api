import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

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
import { MemorySocketCacheService } from './services/memory-socket-cache.service';
import { MockAIAgentService } from './services/mock-ai-agent.service';
import { WebhookMessageService } from './services/webhook-message.service';

// Interfaces
import { ISocketCacheService } from './interfaces/socket-cache.interface';

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
  ],
  controllers: [CustomerController, ConversationController, WebhookController],
  providers: [
    CustomerService,
    ReviewerSessionService,
    ConversationService,
    ChatGateway,
    MemorySocketCacheService,
    MockAIAgentService,
    WebhookMessageService,
    {
      provide: 'ISocketCacheService',
      useClass: MemorySocketCacheService,
    },
  ],
  exports: [
    CustomerService,
    ReviewerSessionService,
    ConversationService,
    WebhookMessageService,
  ],
})
export class ChatModule {}
