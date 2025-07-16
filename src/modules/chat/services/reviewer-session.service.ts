import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { ReviewerSession } from '../interfaces/socket-events.interface';

@Injectable()
export class ReviewerSessionService {
  private readonly logger = new Logger(ReviewerSessionService.name);
  private readonly SESSION_KEY_PREFIX = 'reviewer_session:';
  private readonly ONLINE_REVIEWERS_KEY = 'online_reviewers';
  private readonly SESSION_TTL = 86400; // 24 hours

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * Lưu session của reviewer
   */
  async saveSession(userId: string, socketId: string): Promise<void> {
    try {
      const session: ReviewerSession = {
        userId,
        socketId,
        connectedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        isOnline: true,
      };

      const sessionKey = `${this.SESSION_KEY_PREFIX}${userId}`;

      // Lưu session với TTL
      await this.redis.setex(
        sessionKey,
        this.SESSION_TTL,
        JSON.stringify(session),
      );

      // Thêm vào danh sách online reviewers
      await this.redis.sadd(this.ONLINE_REVIEWERS_KEY, userId);

      this.logger.log(
        `Saved session for reviewer ${userId} with socket ${socketId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to save session for reviewer ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Lấy session của reviewer
   */
  async getSession(userId: string): Promise<ReviewerSession | null> {
    try {
      const sessionKey = `${this.SESSION_KEY_PREFIX}${userId}`;
      const sessionData = await this.redis.get(sessionKey);

      if (!sessionData) {
        return null;
      }

      return JSON.parse(sessionData);
    } catch (error) {
      this.logger.error(`Failed to get session for reviewer ${userId}:`, error);
      return null;
    }
  }

  /**
   * Cập nhật activity của reviewer
   */
  async updateActivity(userId: string): Promise<void> {
    try {
      const session = await this.getSession(userId);
      if (!session) {
        return;
      }

      session.lastActivity = new Date().toISOString();

      const sessionKey = `${this.SESSION_KEY_PREFIX}${userId}`;
      await this.redis.setex(
        sessionKey,
        this.SESSION_TTL,
        JSON.stringify(session),
      );
    } catch (error) {
      this.logger.error(
        `Failed to update activity for reviewer ${userId}:`,
        error,
      );
    }
  }

  /**
   * Xóa session của reviewer
   */
  async removeSession(userId: string): Promise<void> {
    try {
      const sessionKey = `${this.SESSION_KEY_PREFIX}${userId}`;

      // Xóa session
      await this.redis.del(sessionKey);

      // Xóa khỏi danh sách online reviewers
      await this.redis.srem(this.ONLINE_REVIEWERS_KEY, userId);

      this.logger.log(`Removed session for reviewer ${userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to remove session for reviewer ${userId}:`,
        error,
      );
    }
  }

  /**
   * Lấy danh sách reviewers đang online
   */
  async getOnlineReviewers(): Promise<string[]> {
    try {
      return await this.redis.smembers(this.ONLINE_REVIEWERS_KEY);
    } catch (error) {
      this.logger.error('Failed to get online reviewers:', error);
      return [];
    }
  }

  /**
   * Kiểm tra reviewer có online không
   */
  async isReviewerOnline(userId: string): Promise<boolean> {
    try {
      const session = await this.getSession(userId);
      return session !== null && session.isOnline;
    } catch (error) {
      this.logger.error(
        `Failed to check if reviewer ${userId} is online:`,
        error,
      );
      return false;
    }
  }

  /**
   * Lấy socket ID của reviewer
   */
  async getSocketId(userId: string): Promise<string | null> {
    try {
      const session = await this.getSession(userId);
      return session ? session.socketId : null;
    } catch (error) {
      this.logger.error(
        `Failed to get socket ID for reviewer ${userId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Lấy thông tin chi tiết của tất cả reviewers online
   */
  async getOnlineReviewersDetails(): Promise<ReviewerSession[]> {
    try {
      const onlineUserIds = await this.getOnlineReviewers();
      const sessions: ReviewerSession[] = [];

      for (const userId of onlineUserIds) {
        const session = await this.getSession(userId);
        if (session) {
          sessions.push(session);
        }
      }

      return sessions;
    } catch (error) {
      this.logger.error('Failed to get online reviewers details:', error);
      return [];
    }
  }

  /**
   * Cleanup sessions hết hạn
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const onlineUserIds = await this.getOnlineReviewers();
      const now = new Date().getTime();
      const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

      for (const userId of onlineUserIds) {
        const session = await this.getSession(userId);
        if (!session) {
          // Session không tồn tại, xóa khỏi online list
          await this.redis.srem(this.ONLINE_REVIEWERS_KEY, userId);
          continue;
        }

        const lastActivity = new Date(session.lastActivity).getTime();
        if (now - lastActivity > TIMEOUT_MS) {
          // Session đã timeout, xóa
          await this.removeSession(userId);
          this.logger.log(`Cleaned up expired session for reviewer ${userId}`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to cleanup expired sessions:', error);
    }
  }

  /**
   * Lấy số lượng reviewers online
   */
  async getOnlineReviewersCount(): Promise<number> {
    try {
      return await this.redis.scard(this.ONLINE_REVIEWERS_KEY);
    } catch (error) {
      this.logger.error('Failed to get online reviewers count:', error);
      return 0;
    }
  }

  /**
   * Broadcast message đến tất cả reviewers online
   */
  async getAllOnlineSocketIds(): Promise<string[]> {
    try {
      const sessions = await this.getOnlineReviewersDetails();
      return sessions.map((session) => session.socketId);
    } catch (error) {
      this.logger.error('Failed to get all online socket IDs:', error);
      return [];
    }
  }

  /**
   * Set reviewer offline (giữ session nhưng đánh dấu offline)
   */
  async setReviewerOffline(userId: string): Promise<void> {
    try {
      const session = await this.getSession(userId);
      if (session) {
        session.isOnline = false;
        session.lastActivity = new Date().toISOString();

        const sessionKey = `${this.SESSION_KEY_PREFIX}${userId}`;
        await this.redis.setex(
          sessionKey,
          this.SESSION_TTL,
          JSON.stringify(session),
        );
      }

      // Xóa khỏi online list nhưng giữ session
      await this.redis.srem(this.ONLINE_REVIEWERS_KEY, userId);

      this.logger.log(`Set reviewer ${userId} offline`);
    } catch (error) {
      this.logger.error(`Failed to set reviewer ${userId} offline:`, error);
    }
  }

  /**
   * Set reviewer online
   */
  async setReviewerOnline(userId: string, socketId: string): Promise<void> {
    try {
      await this.saveSession(userId, socketId);
      this.logger.log(`Set reviewer ${userId} online with socket ${socketId}`);
    } catch (error) {
      this.logger.error(`Failed to set reviewer ${userId} online:`, error);
    }
  }

  /**
   * Lấy reviewer online có ít conversation nhất
   * Kết hợp với ConversationCacheService để đếm conversation
   */
  async getReviewerWithLeastConversations(): Promise<{
    reviewerId: string;
    conversationCount: number;
  } | null> {
    try {
      const onlineReviewerIds = await this.getOnlineReviewers();

      if (onlineReviewerIds.length === 0) {
        this.logger.warn('No online reviewers available');
        return null;
      }

      // Đếm conversation cho mỗi reviewer từ cache
      const reviewerCounts = await Promise.all(
        onlineReviewerIds.map(async (reviewerId) => {
          // Đếm conversation assignments từ Redis
          const pattern = `reviewer_assignments:*`;
          const keys = await this.redis.keys(pattern);

          let conversationCount = 0;
          for (const key of keys) {
            const cached = await this.redis.get(key);
            if (cached) {
              const assignment = JSON.parse(cached);
              if (assignment.reviewerId === reviewerId) {
                conversationCount++;
              }
            }
          }

          return {
            reviewerId,
            conversationCount,
          };
        }),
      );

      // Sắp xếp theo số conversation tăng dần
      reviewerCounts.sort((a, b) => a.conversationCount - b.conversationCount);

      const selectedReviewer = reviewerCounts[0];

      this.logger.debug(
        `Selected reviewer ${selectedReviewer.reviewerId} with ${selectedReviewer.conversationCount} active conversations`,
      );

      return selectedReviewer;
    } catch (error) {
      this.logger.error(
        'Failed to get reviewer with least conversations:',
        error,
      );
      return null;
    }
  }

  /**
   * Lấy thống kê workload của tất cả reviewers online
   */
  async getReviewerWorkloadStats(): Promise<
    Array<{
      reviewerId: string;
      socketId: string;
      conversationCount: number;
      lastActivity: string;
    }>
  > {
    try {
      const onlineReviewers = await this.getOnlineReviewersDetails();

      const workloadStats = await Promise.all(
        onlineReviewers.map(async (reviewer) => {
          // Đếm conversation assignments
          const pattern = `reviewer_assignments:*`;
          const keys = await this.redis.keys(pattern);

          let conversationCount = 0;
          for (const key of keys) {
            const cached = await this.redis.get(key);
            if (cached) {
              const assignment = JSON.parse(cached);
              if (assignment.reviewerId === reviewer.userId) {
                conversationCount++;
              }
            }
          }

          return {
            reviewerId: reviewer.userId,
            socketId: reviewer.socketId,
            conversationCount,
            lastActivity: reviewer.lastActivity,
          };
        }),
      );

      // Sắp xếp theo workload
      workloadStats.sort((a, b) => a.conversationCount - b.conversationCount);

      return workloadStats;
    } catch (error) {
      this.logger.error('Failed to get reviewer workload stats:', error);
      return [];
    }
  }
}
