import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import {
  CachedConversation,
  ConversationStatus,
  ReviewerAssignment,
} from '../../../modules/chat/types/message.types';
import { formatDateToISO } from '../../../utils/date-formatter';

@Injectable()
export class ConversationCacheService {
  private readonly logger = new Logger(ConversationCacheService.name);
  private readonly CONVERSATION_PREFIX = 'conversation:';
  private readonly CUSTOMER_CONVERSATIONS_PREFIX = 'customer_conversations:';
  private readonly REVIEWER_ASSIGNMENTS_PREFIX = 'reviewer_assignments:';
  private readonly ACTIVE_CONVERSATIONS_SET = 'active_conversations';
  private readonly DEFAULT_TTL = 7 * 24 * 60 * 60; // 7 days

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * Lưu conversation vào cache
   */
  async cacheConversation(
    conversation: CachedConversation,
    ttl: number = this.DEFAULT_TTL,
  ): Promise<void> {
    try {
      const key = this.getConversationKey(conversation.id);
      await this.redis.setex(key, ttl, JSON.stringify(conversation));

      // Thêm vào set active conversations nếu đang active
      if (conversation.status === ConversationStatus.ACTIVE) {
        await this.redis.sadd(this.ACTIVE_CONVERSATIONS_SET, conversation.id);
      }

      // Index theo customer
      await this.addToCustomerConversations(
        conversation.customerId,
        conversation.id,
      );

      this.logger.debug(
        `Cached conversation ${conversation.id} for customer ${conversation.customerId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error caching conversation ${conversation.id}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Lấy conversation từ cache
   */
  async getConversation(
    conversationId: string,
  ): Promise<CachedConversation | null> {
    try {
      const key = this.getConversationKey(conversationId);
      const cached = await this.redis.get(key);

      if (!cached) {
        return null;
      }

      return JSON.parse(cached) as CachedConversation;
    } catch (error) {
      this.logger.error(`Error getting conversation ${conversationId}:`, error);
      return null;
    }
  }

  /**
   * Cập nhật trạng thái conversation
   */
  async updateConversationStatus(
    conversationId: string,
    status: ConversationStatus,
    additionalData?: Partial<CachedConversation>,
  ): Promise<boolean> {
    try {
      const conversation = await this.getConversation(conversationId);
      if (!conversation) {
        this.logger.warn(
          `Conversation ${conversationId} not found for status update`,
        );
        return false;
      }

      const updatedConversation: CachedConversation = {
        ...conversation,
        ...additionalData,
        status,
        updatedAt: formatDateToISO(new Date()),
      };

      await this.cacheConversation(updatedConversation);

      // Cập nhật active conversations set
      if (status === ConversationStatus.ACTIVE) {
        await this.redis.sadd(this.ACTIVE_CONVERSATIONS_SET, conversationId);
      } else {
        await this.redis.srem(this.ACTIVE_CONVERSATIONS_SET, conversationId);
      }

      this.logger.debug(
        `Updated conversation ${conversationId} status to ${status}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Error updating conversation ${conversationId} status:`,
        error,
      );
      return false;
    }
  }

  /**
   * Lấy danh sách conversation theo customer
   */
  async getConversationsByCustomer(
    customerId: string,
    limit: number = 20,
  ): Promise<CachedConversation[]> {
    try {
      const conversationIds = await this.getCustomerConversationIds(customerId);
      const conversations: CachedConversation[] = [];

      for (const conversationId of conversationIds.slice(0, limit)) {
        const conversation = await this.getConversation(conversationId);
        if (conversation) {
          conversations.push(conversation);
        }
      }

      // Sắp xếp theo thời gian cập nhật mới nhất
      return conversations.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    } catch (error) {
      this.logger.error(
        `Error getting conversations for customer ${customerId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Lấy danh sách active conversations
   */
  async getActiveConversations(): Promise<CachedConversation[]> {
    try {
      const conversationIds = await this.redis.smembers(
        this.ACTIVE_CONVERSATIONS_SET,
      );
      const conversations: CachedConversation[] = [];

      for (const conversationId of conversationIds) {
        const conversation = await this.getConversation(conversationId);
        if (conversation && conversation.status === ConversationStatus.ACTIVE) {
          conversations.push(conversation);
        } else if (
          conversation &&
          conversation.status !== ConversationStatus.ACTIVE
        ) {
          // Cleanup: remove from active set if status changed
          await this.redis.srem(this.ACTIVE_CONVERSATIONS_SET, conversationId);
        }
      }

      return conversations.sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() -
          new Date(a.lastMessageAt).getTime(),
      );
    } catch (error) {
      this.logger.error('Error getting active conversations:', error);
      return [];
    }
  }

  /**
   * Gán reviewer cho conversation
   */
  async assignReviewer(
    conversationId: string,
    reviewerId: string,
    customerType: string,
    timeoutMinutes: number = 30,
  ): Promise<boolean> {
    try {
      // Cập nhật conversation
      const updated = await this.updateConversationStatus(
        conversationId,
        ConversationStatus.IN_REVIEW,
        { assignedReviewerId: reviewerId },
      );

      if (!updated) {
        return false;
      }

      // Tạo reviewer assignment
      const assignment: ReviewerAssignment = {
        messageId: '', // Sẽ được cập nhật từ message service
        conversationId,
        customerId: '', // Sẽ được lấy từ conversation
        reviewerId,
        customerType,
        assignedAt: formatDateToISO(new Date()),
        timeoutAt: formatDateToISO(
          new Date(Date.now() + timeoutMinutes * 60 * 1000),
        ),
        priority: 2, // Normal priority
      };

      await this.setReviewerAssignment(conversationId, assignment);

      this.logger.debug(
        `Assigned reviewer ${reviewerId} to conversation ${conversationId}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Error assigning reviewer to conversation ${conversationId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Lưu reviewer assignment
   */
  async setReviewerAssignment(
    conversationId: string,
    assignment: ReviewerAssignment,
  ): Promise<void> {
    try {
      const key = this.getReviewerAssignmentKey(conversationId);
      await this.redis.setex(key, 24 * 60 * 60, JSON.stringify(assignment)); // 24h TTL
    } catch (error) {
      this.logger.error(
        `Error setting reviewer assignment for conversation ${conversationId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Lấy reviewer assignment
   */
  async getReviewerAssignment(
    conversationId: string,
  ): Promise<ReviewerAssignment | null> {
    try {
      const key = this.getReviewerAssignmentKey(conversationId);
      const cached = await this.redis.get(key);

      if (!cached) {
        return null;
      }

      return JSON.parse(cached) as ReviewerAssignment;
    } catch (error) {
      this.logger.error(
        `Error getting reviewer assignment for conversation ${conversationId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Lấy danh sách conversation được gán cho reviewer
   */
  async getConversationsByReviewer(
    reviewerId: string,
  ): Promise<CachedConversation[]> {
    try {
      const pattern = `${this.REVIEWER_ASSIGNMENTS_PREFIX}*`;
      const keys = await this.redis.keys(pattern);
      const conversations: CachedConversation[] = [];

      for (const key of keys) {
        const cached = await this.redis.get(key);
        if (cached) {
          const assignment = JSON.parse(cached) as ReviewerAssignment;
          if (assignment.reviewerId === reviewerId) {
            const conversation = await this.getConversation(
              assignment.conversationId,
            );
            if (conversation) {
              conversations.push(conversation);
            }
          }
        }
      }

      return conversations.sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() -
          new Date(a.lastMessageAt).getTime(),
      );
    } catch (error) {
      this.logger.error(
        `Error getting conversations for reviewer ${reviewerId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Kiểm tra reviewer có đang xử lý conversation timeout không
   */
  async checkTimeoutAssignments(): Promise<ReviewerAssignment[]> {
    try {
      const pattern = `${this.REVIEWER_ASSIGNMENTS_PREFIX}*`;
      const keys = await this.redis.keys(pattern);
      const timeoutAssignments: ReviewerAssignment[] = [];
      const now = new Date();

      for (const key of keys) {
        const cached = await this.redis.get(key);
        if (cached) {
          const assignment = JSON.parse(cached) as ReviewerAssignment;
          const timeoutAt = new Date(assignment.timeoutAt);

          if (now > timeoutAt) {
            timeoutAssignments.push(assignment);
          }
        }
      }

      return timeoutAssignments;
    } catch (error) {
      this.logger.error('Error checking timeout assignments:', error);
      return [];
    }
  }

  /**
   * Xóa reviewer assignment
   */
  async removeReviewerAssignment(conversationId: string): Promise<boolean> {
    try {
      const key = this.getReviewerAssignmentKey(conversationId);
      const result = await this.redis.del(key);

      this.logger.debug(
        `Removed reviewer assignment for conversation ${conversationId}`,
      );
      return result > 0;
    } catch (error) {
      this.logger.error(
        `Error removing reviewer assignment for conversation ${conversationId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Cập nhật số lượng tin nhắn trong conversation
   */
  async incrementMessageCount(conversationId: string): Promise<boolean> {
    try {
      const conversation = await this.getConversation(conversationId);
      if (!conversation) {
        return false;
      }

      const updatedConversation: CachedConversation = {
        ...conversation,
        messageCount: conversation.messageCount + 1,
        lastMessageAt: formatDateToISO(new Date()),
        updatedAt: formatDateToISO(new Date()),
      };

      await this.cacheConversation(updatedConversation);
      return true;
    } catch (error) {
      this.logger.error(
        `Error incrementing message count for conversation ${conversationId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Lấy thống kê conversation
   */
  async getConversationStats(): Promise<{
    totalConversations: number;
    activeConversations: number;
    statusBreakdown: Record<ConversationStatus, number>;
    averageMessageCount: number;
  }> {
    try {
      const pattern = `${this.CONVERSATION_PREFIX}*`;
      const keys = await this.redis.keys(pattern);
      const activeCount = await this.redis.scard(this.ACTIVE_CONVERSATIONS_SET);

      const statusBreakdown: Record<ConversationStatus, number> = {} as Record<
        ConversationStatus,
        number
      >;
      let totalMessages = 0;

      // Khởi tạo breakdown với 0
      Object.values(ConversationStatus).forEach((status) => {
        statusBreakdown[status] = 0;
      });

      // Đếm theo status và tổng messages
      for (const key of keys) {
        const cached = await this.redis.get(key);
        if (cached) {
          const conversation = JSON.parse(cached) as CachedConversation;
          statusBreakdown[conversation.status]++;
          totalMessages += conversation.messageCount;
        }
      }

      return {
        totalConversations: keys.length,
        activeConversations: activeCount,
        statusBreakdown,
        averageMessageCount: keys.length > 0 ? totalMessages / keys.length : 0,
      };
    } catch (error) {
      this.logger.error('Error getting conversation stats:', error);
      return {
        totalConversations: 0,
        activeConversations: 0,
        statusBreakdown: {} as Record<ConversationStatus, number>,
        averageMessageCount: 0,
      };
    }
  }

  /**
   * Cleanup expired conversations
   */
  async cleanupExpiredConversations(): Promise<number> {
    try {
      const pattern = `${this.CONVERSATION_PREFIX}*`;
      const keys = await this.redis.keys(pattern);
      let deletedCount = 0;
      const now = new Date();
      const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

      for (const key of keys) {
        const cached = await this.redis.get(key);
        if (cached) {
          const conversation = JSON.parse(cached) as CachedConversation;
          const lastActivity = new Date(conversation.lastMessageAt);
          const age = now.getTime() - lastActivity.getTime();

          if (
            age > maxAge &&
            conversation.status === ConversationStatus.CLOSED
          ) {
            await this.redis.del(key);
            await this.redis.srem(
              this.ACTIVE_CONVERSATIONS_SET,
              conversation.id,
            );
            await this.removeReviewerAssignment(conversation.id);
            deletedCount++;
          }
        }
      }

      this.logger.log(`Cleaned up ${deletedCount} expired conversations`);
      return deletedCount;
    } catch (error) {
      this.logger.error('Error cleaning up expired conversations:', error);
      return 0;
    }
  }

  // Private methods
  private getConversationKey(conversationId: string): string {
    return `${this.CONVERSATION_PREFIX}${conversationId}`;
  }

  private getCustomerConversationsKey(customerId: string): string {
    return `${this.CUSTOMER_CONVERSATIONS_PREFIX}${customerId}`;
  }

  private getReviewerAssignmentKey(conversationId: string): string {
    return `${this.REVIEWER_ASSIGNMENTS_PREFIX}${conversationId}`;
  }

  private async addToCustomerConversations(
    customerId: string,
    conversationId: string,
  ): Promise<void> {
    const key = this.getCustomerConversationsKey(customerId);
    const timestamp = Date.now();
    await this.redis.zadd(key, timestamp, conversationId);
  }

  private async getCustomerConversationIds(
    customerId: string,
  ): Promise<string[]> {
    const key = this.getCustomerConversationsKey(customerId);
    // Lấy theo thời gian mới nhất
    return await this.redis.zrevrange(key, 0, -1);
  }
}
