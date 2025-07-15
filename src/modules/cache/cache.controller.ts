import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import JwtAuthenticationGuard from '../auth/jwt-authentication.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PermissionName } from '../users/entities/permission.entity';
import { HttpResponse, BaseResponse } from '../../types/http-response';
import { MessageCacheService } from '../../shared/redis/services/message-cache.service';
import { ConversationCacheService } from '../../shared/redis/services/conversation-cache.service';
import { MessageQueueService } from '../../shared/redis/services/message-queue.service';
import {
  CachedMessage,
  MessageStatus,
  SenderType,
  MessagePriority,
  MessageAction,
} from '../chat/types/message.types';
import { formatDateToISO } from '../../utils/date-formatter';
import { TestMessageDto } from './dto/test-message.dto';

@ApiTags('Cache Management')
@Controller('cache')
@ApiBearerAuth()
@UseGuards(JwtAuthenticationGuard, PermissionsGuard)
@Permissions(PermissionName.PERMISSION) // Chỉ admin có quyền access
export class CacheController {
  constructor(
    private readonly messageCacheService: MessageCacheService,
    private readonly conversationCacheService: ConversationCacheService,
    private readonly messageQueueService: MessageQueueService,
  ) {}

  @ApiOperation({ summary: 'Lấy thống kê tổng quan cache system' })
  @ApiResponse({
    status: 200,
    description: 'Thống kê cache thành công',
  })
  @Get('stats')
  async getCacheStats(): Promise<BaseResponse> {
    try {
      const [messageStats, conversationStats, queueStats] = await Promise.all([
        this.messageCacheService.getCacheStats(),
        this.conversationCacheService.getConversationStats(),
        this.messageQueueService.getQueueStats(),
      ]);

      const stats = {
        messages: messageStats,
        conversations: conversationStats,
        queues: queueStats,
        timestamp: formatDateToISO(new Date()),
      };

      return HttpResponse.success(stats, 'Lấy thống kê cache thành công');
    } catch (error) {
      throw error;
    }
  }

  @ApiOperation({ summary: 'Test tạo message cache' })
  @ApiResponse({
    status: 201,
    description: 'Tạo test message thành công',
  })
  @Post('test/message')
  @HttpCode(201)
  async createTestMessage(
    @Body() testData: TestMessageDto,
  ): Promise<BaseResponse> {
    try {
      const testMessage: CachedMessage = {
        id: `test_${Date.now()}`,
        conversationId: testData.conversationId || `conv_${Date.now()}`,
        customerId: testData.customerId || `customer_${Date.now()}`,
        senderId: testData.senderId || `sender_${Date.now()}`,
        senderType: testData.senderType || SenderType.CUSTOMER,
        content: testData.content || 'Test message content',
        status: testData.status || MessageStatus.RECEIVED,
        confidence: testData.confidence || 75,
        retryCount: 0,
        createdAt: formatDateToISO(new Date()),
        updatedAt: formatDateToISO(new Date()),
      };

      await this.messageCacheService.cacheMessage(testMessage);

      // Thêm vào processing queue nếu cần
      if (testData.addToQueue) {
        await this.messageCacheService.addToProcessingQueue(
          testMessage.id,
          testData.priority || MessagePriority.NORMAL,
        );
      }

      return HttpResponse.created(
        { messageId: testMessage.id },
        'Tạo test message thành công',
      );
    } catch (error) {
      throw error;
    }
  }

  @ApiOperation({ summary: 'Lấy thông tin message từ cache' })
  @ApiResponse({
    status: 200,
    description: 'Lấy message thành công',
  })
  @Get('message/:messageId')
  async getMessage(
    @Param('messageId') messageId: string,
  ): Promise<BaseResponse> {
    try {
      const message = await this.messageCacheService.getMessage(messageId);

      if (!message) {
        return HttpResponse.error('Không tìm thấy message', 404);
      }

      return HttpResponse.success(message, 'Lấy message thành công');
    } catch (error) {
      throw error;
    }
  }

  @ApiOperation({ summary: 'Lấy messages theo conversation' })
  @ApiResponse({
    status: 200,
    description: 'Lấy messages thành công',
  })
  @Get('conversation/:conversationId/messages')
  async getConversationMessages(
    @Param('conversationId') conversationId: string,
    @Query('limit') limit = 50,
  ): Promise<BaseResponse> {
    try {
      const messages = await this.messageCacheService.getMessagesByConversation(
        conversationId,
        limit,
      );

      return HttpResponse.success(
        {
          conversationId,
          messageCount: messages.length,
          messages,
        },
        'Lấy messages thành công',
      );
    } catch (error) {
      throw error;
    }
  }

  @ApiOperation({ summary: 'Lấy messages theo trạng thái' })
  @ApiResponse({
    status: 200,
    description: 'Lấy messages theo trạng thái thành công',
  })
  @Get('messages/status/:status')
  async getMessagesByStatus(
    @Param('status') status: MessageStatus,
  ): Promise<BaseResponse> {
    try {
      const messages = await this.messageCacheService.getMessagesByStatus(
        status,
      );

      return HttpResponse.success(
        {
          status,
          messageCount: messages.length,
          messages,
        },
        'Lấy messages theo trạng thái thành công',
      );
    } catch (error) {
      throw error;
    }
  }

  @ApiOperation({ summary: 'Xử lý processing queue (simulate worker)' })
  @ApiResponse({
    status: 200,
    description: 'Xử lý queue thành công',
  })
  @Post('process/queue')
  async processQueue(@Query('count') count = 5): Promise<BaseResponse> {
    try {
      const messageIds = await this.messageCacheService.getFromProcessingQueue(
        count,
      );
      const processedMessages = [];

      for (const messageId of messageIds) {
        const message = await this.messageCacheService.getMessage(messageId);
        if (message) {
          // Simulate processing: update status
          await this.messageCacheService.updateMessageStatus(
            messageId,
            MessageStatus.AI_AGENT_DONE_AUTO,
            { confidence: 85 },
          );
          processedMessages.push(message);
        }
      }

      return HttpResponse.success(
        {
          processedCount: processedMessages.length,
          processedMessages,
        },
        'Xử lý queue thành công',
      );
    } catch (error) {
      throw error;
    }
  }

  @ApiOperation({ summary: 'Test message queue system' })
  @ApiResponse({
    status: 201,
    description: 'Test queue thành công',
  })
  @Post('test/queue')
  @HttpCode(201)
  async testQueue(): Promise<BaseResponse> {
    try {
      const testMessageId = `test_queue_${Date.now()}`;

      // Test các loại queue khác nhau
      await this.messageQueueService.enqueue(
        MessageAction.PROCESS_AI_RESPONSE,
        testMessageId,
        'test_conv',
        'test_customer',
        MessagePriority.HIGH,
      );

      await this.messageQueueService.enqueue(
        MessageAction.SEND_TO_FACEBOOK,
        testMessageId + '_fb',
        'test_conv',
        'test_customer',
        MessagePriority.NORMAL,
        60, // delay 60s
      );

      return HttpResponse.created({ testMessageId }, 'Test queue thành công');
    } catch (error) {
      throw error;
    }
  }

  @ApiOperation({ summary: 'Xử lý delayed messages' })
  @ApiResponse({
    status: 200,
    description: 'Xử lý delayed messages thành công',
  })
  @Post('process/delayed')
  async processDelayedMessages(): Promise<BaseResponse> {
    try {
      const processedCount =
        await this.messageQueueService.processDelayedMessages();

      return HttpResponse.success(
        { processedCount },
        'Xử lý delayed messages thành công',
      );
    } catch (error) {
      throw error;
    }
  }

  @ApiOperation({ summary: 'Lấy dead letter queue' })
  @ApiResponse({
    status: 200,
    description: 'Lấy dead letter queue thành công',
  })
  @Get('dead-letter')
  async getDeadLetterQueue(
    @Query('offset') offset = 0,
    @Query('limit') limit = 50,
  ): Promise<BaseResponse> {
    try {
      const deadLetterItems = await this.messageQueueService.getDeadLetterQueue(
        offset,
        limit,
      );

      return HttpResponse.success(
        {
          offset,
          limit,
          count: deadLetterItems.length,
          items: deadLetterItems,
        },
        'Lấy dead letter queue thành công',
      );
    } catch (error) {
      throw error;
    }
  }

  @ApiOperation({ summary: 'Retry message từ dead letter queue' })
  @ApiResponse({
    status: 200,
    description: 'Retry message thành công',
  })
  @Post('retry/:messageId')
  async retryFromDeadLetter(
    @Param('messageId') messageId: string,
  ): Promise<BaseResponse> {
    try {
      const success = await this.messageQueueService.retryFromDeadLetter(
        messageId,
      );

      if (!success) {
        return HttpResponse.error(
          'Không tìm thấy message trong dead letter queue',
          404,
        );
      }

      return HttpResponse.success({ messageId }, 'Retry message thành công');
    } catch (error) {
      throw error;
    }
  }

  @ApiOperation({ summary: 'Cleanup expired cache items' })
  @ApiResponse({
    status: 200,
    description: 'Cleanup thành công',
  })
  @Delete('cleanup')
  async cleanupExpiredItems(): Promise<BaseResponse> {
    try {
      const [messagesCleaned, conversationsCleaned, queueCleaned] =
        await Promise.all([
          this.messageCacheService.cleanupExpiredMessages(),
          this.conversationCacheService.cleanupExpiredConversations(),
          this.messageQueueService.cleanupOldQueueItems(),
        ]);

      return HttpResponse.success(
        {
          messagesCleaned,
          conversationsCleaned,
          queueCleaned,
          totalCleaned: messagesCleaned + conversationsCleaned + queueCleaned,
        },
        'Cleanup thành công',
      );
    } catch (error) {
      throw error;
    }
  }

  @ApiOperation({ summary: 'Health check cho Redis connection' })
  @ApiResponse({
    status: 200,
    description: 'Redis connection healthy',
  })
  @Get('health')
  async healthCheck(): Promise<BaseResponse> {
    try {
      // Test basic Redis operations
      const testKey = `health_check_${Date.now()}`;
      const testValue = 'OK';

      // Thực hiện test bằng cách tạo một message test
      const testMessage: CachedMessage = {
        id: testKey,
        conversationId: 'health_conv',
        customerId: 'health_customer',
        senderId: 'health_sender',
        senderType: SenderType.BOT,
        content: 'Health check message',
        status: MessageStatus.RECEIVED,
        createdAt: formatDateToISO(new Date()),
        updatedAt: formatDateToISO(new Date()),
      };

      await this.messageCacheService.cacheMessage(testMessage, 60); // 1 minute TTL
      const retrieved = await this.messageCacheService.getMessage(testKey);
      await this.messageCacheService.deleteMessage(testKey);

      const isHealthy = retrieved !== null && retrieved.id === testKey;

      return HttpResponse.success(
        {
          redis: isHealthy ? 'healthy' : 'unhealthy',
          timestamp: formatDateToISO(new Date()),
          testKey,
        },
        isHealthy ? 'Redis connection healthy' : 'Redis connection issue',
      );
    } catch (error) {
      return HttpResponse.error('Redis connection failed', 500);
    }
  }
}
