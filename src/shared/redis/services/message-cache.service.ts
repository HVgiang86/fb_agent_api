import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import {
  CachedMessage,
  MessageStatus,
  SenderType,
  MessagePriority,
} from '../../../modules/chat/types/message.types';
import { formatDateToISO } from '../../../utils/date-formatter';

@Injectable()
export class MessageCacheService {
  private readonly logger = new Logger(MessageCacheService.name);
  private readonly MESSAGE_PREFIX = 'message:';
  private readonly PROCESSING_QUEUE_PREFIX = 'processing:';
  private readonly PENDING_FACEBOOK_PREFIX = 'pending_facebook:';
  private readonly DEFAULT_TTL = 24 * 60 * 60; // 24 hours

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * Lưu tin nhắn vào cache với TTL
   */
  async cacheMessage(
    message: CachedMessage,
    ttl: number = this.DEFAULT_TTL,
  ): Promise<void> {
    try {
      const key = this.getMessageKey(message.id);
      await this.redis.setex(key, ttl, JSON.stringify(message));

      this.logger.debug(
        `Cached message ${message.id} with status ${message.status}`,
      );
    } catch (error) {
      this.logger.error(`Error caching message ${message.id}:`, error);
      throw error;
    }
  }

  /**
   * Lấy tin nhắn từ cache
   */
  async getMessage(messageId: string): Promise<CachedMessage | null> {
    try {
      const key = this.getMessageKey(messageId);
      const cached = await this.redis.get(key);

      if (!cached) {
        return null;
      }

      return JSON.parse(cached) as CachedMessage;
    } catch (error) {
      this.logger.error(`Error getting message ${messageId}:`, error);
      return null;
    }
  }

  /**
   * Cập nhật trạng thái tin nhắn
   */
  async updateMessageStatus(
    messageId: string,
    status: MessageStatus,
    additionalData?: Partial<CachedMessage>,
  ): Promise<boolean> {
    try {
      const message = await this.getMessage(messageId);
      if (!message) {
        this.logger.warn(`Message ${messageId} not found for status update`);
        return false;
      }

      const updatedMessage: CachedMessage = {
        ...message,
        ...additionalData,
        status,
        updatedAt: formatDateToISO(new Date()),
      };

      await this.cacheMessage(updatedMessage);
      this.logger.debug(`Updated message ${messageId} status to ${status}`);

      return true;
    } catch (error) {
      this.logger.error(`Error updating message ${messageId} status:`, error);
      return false;
    }
  }

  /**
   * Thêm tin nhắn vào queue đang xử lý
   */
  async addToProcessingQueue(
    messageId: string,
    priority: MessagePriority = MessagePriority.NORMAL,
  ): Promise<void> {
    try {
      const key = this.getProcessingQueueKey();
      const score = this.calculatePriorityScore(priority);

      await this.redis.zadd(key, score, messageId);
      this.logger.debug(
        `Added message ${messageId} to processing queue with priority ${priority}`,
      );
    } catch (error) {
      this.logger.error(
        `Error adding message ${messageId} to processing queue:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Lấy tin nhắn từ queue xử lý (theo độ ưu tiên)
   */
  async getFromProcessingQueue(count: number = 1): Promise<string[]> {
    try {
      const key = this.getProcessingQueueKey();
      // Lấy theo thứ tự priority cao nhất (score cao nhất)
      const messageIds = await this.redis.zrevrange(key, 0, count - 1);

      if (messageIds.length > 0) {
        // Xóa các tin nhắn đã lấy ra khỏi queue
        await this.redis.zrem(key, ...messageIds);
        this.logger.debug(
          `Retrieved ${messageIds.length} messages from processing queue`,
        );
      }

      return messageIds;
    } catch (error) {
      this.logger.error('Error getting messages from processing queue:', error);
      return [];
    }
  }

  /**
   * Thêm tin nhắn vào queue gửi Facebook
   */
  async addToPendingFacebook(messageId: string): Promise<void> {
    try {
      const key = this.getPendingFacebookKey();
      const timestamp = Date.now();

      await this.redis.zadd(key, timestamp, messageId);
      this.logger.debug(`Added message ${messageId} to pending Facebook queue`);
    } catch (error) {
      this.logger.error(
        `Error adding message ${messageId} to pending Facebook queue:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Lấy tin nhắn từ queue gửi Facebook
   */
  async getFromPendingFacebook(count: number = 10): Promise<string[]> {
    try {
      const key = this.getPendingFacebookKey();
      // Lấy theo thứ tự thời gian (FIFO)
      const messageIds = await this.redis.zrange(key, 0, count - 1);

      if (messageIds.length > 0) {
        await this.redis.zrem(key, ...messageIds);
        this.logger.debug(
          `Retrieved ${messageIds.length} messages from pending Facebook queue`,
        );
      }

      return messageIds;
    } catch (error) {
      this.logger.error(
        'Error getting messages from pending Facebook queue:',
        error,
      );
      return [];
    }
  }

  /**
   * Lấy danh sách tin nhắn theo conversation
   */
  async getMessagesByConversation(
    conversationId: string,
    limit: number = 50,
  ): Promise<CachedMessage[]> {
    try {
      const pattern = `${this.MESSAGE_PREFIX}*`;
      const keys = await this.redis.keys(pattern);
      const messages: CachedMessage[] = [];

      for (const key of keys) {
        const cached = await this.redis.get(key);
        if (cached) {
          const message = JSON.parse(cached) as CachedMessage;
          if (message.conversationId === conversationId) {
            messages.push(message);
          }
        }
      }

      // Sắp xếp theo thời gian tạo
      return messages
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        )
        .slice(0, limit);
    } catch (error) {
      this.logger.error(
        `Error getting messages for conversation ${conversationId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Lấy danh sách tin nhắn theo trạng thái
   */
  async getMessagesByStatus(status: MessageStatus): Promise<CachedMessage[]> {
    try {
      const pattern = `${this.MESSAGE_PREFIX}*`;
      const keys = await this.redis.keys(pattern);
      const messages: CachedMessage[] = [];

      for (const key of keys) {
        const cached = await this.redis.get(key);
        if (cached) {
          const message = JSON.parse(cached) as CachedMessage;
          if (message.status === status) {
            messages.push(message);
          }
        }
      }

      return messages;
    } catch (error) {
      this.logger.error(`Error getting messages with status ${status}:`, error);
      return [];
    }
  }

  /**
   * Xóa tin nhắn khỏi cache
   */
  async deleteMessage(messageId: string): Promise<boolean> {
    try {
      const key = this.getMessageKey(messageId);
      const result = await this.redis.del(key);

      this.logger.debug(`Deleted message ${messageId} from cache`);
      return result > 0;
    } catch (error) {
      this.logger.error(`Error deleting message ${messageId}:`, error);
      return false;
    }
  }

  /**
   * Xóa tin nhắn cũ (cleanup)
   */
  async cleanupExpiredMessages(): Promise<number> {
    try {
      const pattern = `${this.MESSAGE_PREFIX}*`;
      const keys = await this.redis.keys(pattern);
      let deletedCount = 0;
      const now = new Date();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

      for (const key of keys) {
        const cached = await this.redis.get(key);
        if (cached) {
          const message = JSON.parse(cached) as CachedMessage;
          const messageAge =
            now.getTime() - new Date(message.createdAt).getTime();

          if (messageAge > maxAge) {
            await this.redis.del(key);
            deletedCount++;
          }
        }
      }

      this.logger.log(`Cleaned up ${deletedCount} expired messages`);
      return deletedCount;
    } catch (error) {
      this.logger.error('Error cleaning up expired messages:', error);
      return 0;
    }
  }

  /**
   * Lấy thống kê cache
   */
  async getCacheStats(): Promise<{
    totalMessages: number;
    processingQueue: number;
    pendingFacebook: number;
    statusBreakdown: Record<MessageStatus, number>;
  }> {
    try {
      const pattern = `${this.MESSAGE_PREFIX}*`;
      const keys = await this.redis.keys(pattern);
      const processingQueueSize = await this.redis.zcard(
        this.getProcessingQueueKey(),
      );
      const pendingFacebookSize = await this.redis.zcard(
        this.getPendingFacebookKey(),
      );

      const statusBreakdown: Record<MessageStatus, number> = {} as Record<
        MessageStatus,
        number
      >;

      // Khởi tạo breakdown với 0
      Object.values(MessageStatus).forEach((status) => {
        statusBreakdown[status] = 0;
      });

      // Đếm theo status
      for (const key of keys) {
        const cached = await this.redis.get(key);
        if (cached) {
          const message = JSON.parse(cached) as CachedMessage;
          statusBreakdown[message.status]++;
        }
      }

      return {
        totalMessages: keys.length,
        processingQueue: processingQueueSize,
        pendingFacebook: pendingFacebookSize,
        statusBreakdown,
      };
    } catch (error) {
      this.logger.error('Error getting cache stats:', error);
      return {
        totalMessages: 0,
        processingQueue: 0,
        pendingFacebook: 0,
        statusBreakdown: {} as Record<MessageStatus, number>,
      };
    }
  }

  // Private methods
  private getMessageKey(messageId: string): string {
    return `${this.MESSAGE_PREFIX}${messageId}`;
  }

  private getProcessingQueueKey(): string {
    return `${this.PROCESSING_QUEUE_PREFIX}messages`;
  }

  private getPendingFacebookKey(): string {
    return `${this.PENDING_FACEBOOK_PREFIX}messages`;
  }

  private calculatePriorityScore(priority: MessagePriority): number {
    // Kết hợp priority với timestamp để đảm bảo FIFO trong cùng priority
    const now = Date.now();
    return priority * 1000000000000 + now; // Priority ở hàng nghìn tỷ, timestamp ở hàng tỷ
  }
}
