import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import {
  MessageQueueData,
  MessageAction,
  MessagePriority,
  FacebookResponse,
} from '../../../modules/chat/types/message.types';
import { formatDateToISO } from '../../../utils/date-formatter';

@Injectable()
export class MessageQueueService {
  private readonly logger = new Logger(MessageQueueService.name);
  private readonly QUEUE_PREFIX = 'queue:';
  private readonly DELAYED_QUEUE_PREFIX = 'delayed_queue:';
  private readonly RETRY_QUEUE_PREFIX = 'retry_queue:';
  private readonly FACEBOOK_RESPONSE_QUEUE = 'facebook_responses';
  private readonly PROCESSING_QUEUE = 'processing_messages';
  private readonly DEAD_LETTER_QUEUE = 'dead_letter_queue';
  private readonly DEFAULT_MAX_RETRIES = 3;

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * Thêm message vào queue với priority
   */
  async enqueue(
    action: MessageAction,
    messageId: string,
    conversationId: string,
    customerId: string,
    priority: MessagePriority = MessagePriority.NORMAL,
    delaySeconds: number = 0,
    maxRetries: number = this.DEFAULT_MAX_RETRIES,
  ): Promise<void> {
    try {
      const queueData: MessageQueueData = {
        messageId,
        conversationId,
        customerId,
        action,
        priority,
        retryCount: 0,
        maxRetries,
        scheduledAt:
          delaySeconds > 0
            ? formatDateToISO(new Date(Date.now() + delaySeconds * 1000))
            : formatDateToISO(new Date()),
      };

      if (delaySeconds > 0) {
        await this.addToDelayedQueue(queueData, delaySeconds);
      } else {
        await this.addToQueue(action, queueData);
      }

      this.logger.debug(
        `Enqueued ${action} for message ${messageId} with priority ${priority}`,
      );
    } catch (error) {
      this.logger.error(
        `Error enqueuing ${action} for message ${messageId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Lấy message từ queue (theo priority)
   */
  async dequeue(
    action: MessageAction,
    count: number = 1,
  ): Promise<MessageQueueData[]> {
    try {
      const queueKey = this.getQueueKey(action);
      const items = await this.redis.zrevrange(
        queueKey,
        0,
        count - 1,
        'WITHSCORES',
      );
      const queueData: MessageQueueData[] = [];

      // Parse items (format: [value, score, value, score, ...])
      for (let i = 0; i < items.length; i += 2) {
        const data = JSON.parse(items[i]) as MessageQueueData;
        queueData.push(data);
      }

      // Remove processed items từ queue
      if (queueData.length > 0) {
        const values = queueData.map((data) => JSON.stringify(data));
        await this.redis.zrem(queueKey, ...values);
      }

      this.logger.debug(
        `Dequeued ${queueData.length} items from ${action} queue`,
      );
      return queueData;
    } catch (error) {
      this.logger.error(`Error dequeuing from ${action} queue:`, error);
      return [];
    }
  }

  /**
   * Thêm vào retry queue
   */
  async addToRetryQueue(
    queueData: MessageQueueData,
    error: string,
    retryDelaySeconds: number = 60,
  ): Promise<void> {
    try {
      const retryData: MessageQueueData = {
        ...queueData,
        retryCount: queueData.retryCount + 1,
        lastError: error,
        scheduledAt: formatDateToISO(
          new Date(Date.now() + retryDelaySeconds * 1000),
        ),
      };

      if (retryData.retryCount >= retryData.maxRetries) {
        // Chuyển vào dead letter queue
        await this.addToDeadLetterQueue(retryData);
        this.logger.warn(
          `Message ${queueData.messageId} exceeded max retries, moved to dead letter queue`,
        );
      } else {
        // Thêm vào retry queue
        await this.addToDelayedQueue(retryData, retryDelaySeconds);
        this.logger.debug(
          `Added message ${queueData.messageId} to retry queue (attempt ${retryData.retryCount})`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error adding message ${queueData.messageId} to retry queue:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Xử lý delayed/scheduled messages
   */
  async processDelayedMessages(): Promise<number> {
    try {
      const now = Date.now();
      const delayedKey = this.getDelayedQueueKey();

      // Lấy messages đã đến thời gian xử lý
      const items = await this.redis.zrangebyscore(
        delayedKey,
        0,
        now,
        'WITHSCORES',
      );
      let processedCount = 0;

      for (let i = 0; i < items.length; i += 2) {
        const queueData = JSON.parse(items[i]) as MessageQueueData;

        // Chuyển vào queue chính
        await this.addToQueue(queueData.action, queueData);

        // Xóa khỏi delayed queue
        await this.redis.zrem(delayedKey, items[i]);

        processedCount++;
      }

      if (processedCount > 0) {
        this.logger.debug(`Processed ${processedCount} delayed messages`);
      }

      return processedCount;
    } catch (error) {
      this.logger.error('Error processing delayed messages:', error);
      return 0;
    }
  }

  /**
   * Thêm Facebook response vào queue
   */
  async enqueueFacebookResponse(response: FacebookResponse): Promise<void> {
    try {
      const queueKey = this.getFacebookResponseQueueKey();
      const timestamp = Date.now();

      await this.redis.zadd(queueKey, timestamp, JSON.stringify(response));
      this.logger.debug(
        `Enqueued Facebook response for message ${response.messageId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error enqueuing Facebook response for message ${response.messageId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Lấy Facebook responses để gửi
   */
  async dequeueFacebookResponses(
    count: number = 10,
  ): Promise<FacebookResponse[]> {
    try {
      const queueKey = this.getFacebookResponseQueueKey();
      const items = await this.redis.zrange(queueKey, 0, count - 1);
      const responses: FacebookResponse[] = [];

      for (const item of items) {
        const response = JSON.parse(item) as FacebookResponse;
        responses.push(response);
      }

      // Remove processed items
      if (responses.length > 0) {
        const values = responses.map((r) => JSON.stringify(r));
        await this.redis.zrem(queueKey, ...values);
      }

      this.logger.debug(`Dequeued ${responses.length} Facebook responses`);
      return responses;
    } catch (error) {
      this.logger.error('Error dequeuing Facebook responses:', error);
      return [];
    }
  }

  /**
   * Lấy thống kê queue
   */
  async getQueueStats(): Promise<{
    queueSizes: Record<MessageAction, number>;
    delayedCount: number;
    retryCount: number;
    deadLetterCount: number;
    facebookResponseCount: number;
  }> {
    try {
      const queueSizes: Record<MessageAction, number> = {} as Record<
        MessageAction,
        number
      >;

      // Đếm size của từng queue
      for (const action of Object.values(MessageAction)) {
        const queueKey = this.getQueueKey(action);
        queueSizes[action] = await this.redis.zcard(queueKey);
      }

      const delayedCount = await this.redis.zcard(this.getDelayedQueueKey());
      const retryCount = await this.redis.zcard(this.getRetryQueueKey());
      const deadLetterCount = await this.redis.zcard(
        this.getDeadLetterQueueKey(),
      );
      const facebookResponseCount = await this.redis.zcard(
        this.getFacebookResponseQueueKey(),
      );

      return {
        queueSizes,
        delayedCount,
        retryCount,
        deadLetterCount,
        facebookResponseCount,
      };
    } catch (error) {
      this.logger.error('Error getting queue stats:', error);
      return {
        queueSizes: {} as Record<MessageAction, number>,
        delayedCount: 0,
        retryCount: 0,
        deadLetterCount: 0,
        facebookResponseCount: 0,
      };
    }
  }

  /**
   * Lấy dead letter queue items
   */
  async getDeadLetterQueue(
    offset: number = 0,
    limit: number = 50,
  ): Promise<MessageQueueData[]> {
    try {
      const queueKey = this.getDeadLetterQueueKey();
      const items = await this.redis.zrange(
        queueKey,
        offset,
        offset + limit - 1,
      );

      return items.map((item) => JSON.parse(item) as MessageQueueData);
    } catch (error) {
      this.logger.error('Error getting dead letter queue:', error);
      return [];
    }
  }

  /**
   * Retry message từ dead letter queue
   */
  async retryFromDeadLetter(messageId: string): Promise<boolean> {
    try {
      const queueKey = this.getDeadLetterQueueKey();
      const items = await this.redis.zrange(queueKey, 0, -1);

      for (const item of items) {
        const queueData = JSON.parse(item) as MessageQueueData;
        if (queueData.messageId === messageId) {
          // Reset retry count và thêm lại vào queue chính
          const resetData: MessageQueueData = {
            ...queueData,
            retryCount: 0,
            lastError: undefined,
            scheduledAt: formatDateToISO(new Date()),
          };

          await this.addToQueue(queueData.action, resetData);
          await this.redis.zrem(queueKey, item);

          this.logger.log(
            `Retried message ${messageId} from dead letter queue`,
          );
          return true;
        }
      }

      return false;
    } catch (error) {
      this.logger.error(
        `Error retrying message ${messageId} from dead letter queue:`,
        error,
      );
      return false;
    }
  }

  /**
   * Cleanup old queue items
   */
  async cleanupOldQueueItems(): Promise<number> {
    try {
      let cleanedCount = 0;
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      const cutoffTime = Date.now() - maxAge;

      // Cleanup dead letter queue
      const deadLetterKey = this.getDeadLetterQueueKey();
      const deadLetterCleaned = await this.redis.zremrangebyscore(
        deadLetterKey,
        0,
        cutoffTime,
      );
      cleanedCount += deadLetterCleaned;

      // Cleanup delayed queue
      const delayedKey = this.getDelayedQueueKey();
      const delayedCleaned = await this.redis.zremrangebyscore(
        delayedKey,
        0,
        cutoffTime,
      );
      cleanedCount += delayedCleaned;

      this.logger.log(`Cleaned up ${cleanedCount} old queue items`);
      return cleanedCount;
    } catch (error) {
      this.logger.error('Error cleaning up old queue items:', error);
      return 0;
    }
  }

  // Private methods
  private async addToQueue(
    action: MessageAction,
    queueData: MessageQueueData,
  ): Promise<void> {
    const queueKey = this.getQueueKey(action);
    const score = this.calculateQueueScore(queueData.priority);

    await this.redis.zadd(queueKey, score, JSON.stringify(queueData));
  }

  private async addToDelayedQueue(
    queueData: MessageQueueData,
    delaySeconds: number,
  ): Promise<void> {
    const delayedKey = this.getDelayedQueueKey();
    const executeAt = Date.now() + delaySeconds * 1000;

    await this.redis.zadd(delayedKey, executeAt, JSON.stringify(queueData));
  }

  private async addToDeadLetterQueue(
    queueData: MessageQueueData,
  ): Promise<void> {
    const deadLetterKey = this.getDeadLetterQueueKey();
    const timestamp = Date.now();

    await this.redis.zadd(deadLetterKey, timestamp, JSON.stringify(queueData));
  }

  private getQueueKey(action: MessageAction): string {
    return `${this.QUEUE_PREFIX}${action}`;
  }

  private getDelayedQueueKey(): string {
    return `${this.DELAYED_QUEUE_PREFIX}messages`;
  }

  private getRetryQueueKey(): string {
    return `${this.RETRY_QUEUE_PREFIX}messages`;
  }

  private getDeadLetterQueueKey(): string {
    return this.DEAD_LETTER_QUEUE;
  }

  private getFacebookResponseQueueKey(): string {
    return this.FACEBOOK_RESPONSE_QUEUE;
  }

  private calculateQueueScore(priority: MessagePriority): number {
    // Kết hợp priority với timestamp để đảm bảo FIFO trong cùng priority
    const now = Date.now();
    return priority * 1000000000000 + now; // Priority ở hàng nghìn tỷ, timestamp ở hàng tỷ
  }
}
