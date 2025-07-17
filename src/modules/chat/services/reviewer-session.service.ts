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
  private readonly SOCKET_CACHE_KEY = 'socket_cache';
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY_MS = 1000; // 1 second

  constructor(@InjectRedis() private readonly redis: Redis) {
    this.logger.log('🔧 ReviewerSessionService initialized');
    this.testRedisConnection();
  }

  /**
   * Test Redis connection khi service khởi tạo
   */
  private async testRedisConnection(): Promise<void> {
    try {
      const pong = await this.redis.ping();
      this.logger.log(`✅ Redis connection test successful: ${pong}`);

      // Test basic operations
      const testKey = `test_connection_${Date.now()}`;
      await this.redis.set(testKey, 'test_value', 'EX', 10);
      const value = await this.redis.get(testKey);
      await this.redis.del(testKey);

      if (value === 'test_value') {
        this.logger.log('✅ Redis read/write operations working correctly');
      } else {
        throw new Error('Redis read/write test failed');
      }
    } catch (error) {
      this.logger.error('❌ Redis connection test failed:', error);
      throw error;
    }
  }

  /**
   * Retry wrapper cho Redis operations
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    retries = this.MAX_RETRY_ATTEMPTS,
  ): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await operation();
        if (attempt > 1) {
          this.logger.log(
            `✅ ${operationName} succeeded on attempt ${attempt}`,
          );
        }
        return result;
      } catch (error) {
        this.logger.warn(
          `⚠️ ${operationName} failed on attempt ${attempt}:`,
          error.message,
        );

        if (attempt === retries) {
          this.logger.error(
            `❌ ${operationName} failed after ${retries} attempts`,
          );
          throw error;
        }

        // Wait before retry
        await new Promise((resolve) =>
          setTimeout(resolve, this.RETRY_DELAY_MS * attempt),
        );
      }
    }
  }

  /**
   * Lưu session của reviewer với retry logic
   */
  async saveSession(userId: string, socketId: string): Promise<void> {
    return this.retryOperation(async () => {
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
        `💾 Saved session for reviewer ${userId} with socket ${socketId}`,
      );
    }, `saveSession(${userId})`);
  }

  /**
   * Lấy session của reviewer với retry logic
   */
  async getSession(userId: string): Promise<ReviewerSession | null> {
    return this.retryOperation(async () => {
      const sessionKey = `${this.SESSION_KEY_PREFIX}${userId}`;
      const sessionData = await this.redis.get(sessionKey);

      if (!sessionData) {
        this.logger.debug(`📭 No session found for reviewer ${userId}`);
        return null;
      }

      const session = JSON.parse(sessionData) as ReviewerSession;
      this.logger.debug(`📄 Retrieved session for reviewer ${userId}`);
      return session;
    }, `getSession(${userId})`);
  }

  /**
   * Cập nhật activity của reviewer
   */
  async updateActivity(userId: string): Promise<void> {
    return this.retryOperation(async () => {
      const session = await this.getSession(userId);
      if (!session) {
        this.logger.warn(
          `⚠️ Cannot update activity: No session found for reviewer ${userId}`,
        );
        return;
      }

      session.lastActivity = new Date().toISOString();

      const sessionKey = `${this.SESSION_KEY_PREFIX}${userId}`;
      await this.redis.setex(
        sessionKey,
        this.SESSION_TTL,
        JSON.stringify(session),
      );

      this.logger.debug(`🔄 Updated activity for reviewer ${userId}`);
    }, `updateActivity(${userId})`);
  }

  /**
   * Xóa session của reviewer
   */
  async removeSession(userId: string): Promise<void> {
    return this.retryOperation(async () => {
      const sessionKey = `${this.SESSION_KEY_PREFIX}${userId}`;

      // Xóa session
      const deleted = await this.redis.del(sessionKey);

      // Xóa khỏi danh sách online reviewers
      const removed = await this.redis.srem(this.ONLINE_REVIEWERS_KEY, userId);

      this.logger.log(
        `🗑️ Removed session for reviewer ${userId} (deleted: ${deleted}, removed from online: ${removed})`,
      );
    }, `removeSession(${userId})`);
  }

  /**
   * Lấy danh sách reviewers đang online
   */
  async getOnlineReviewers(): Promise<string[]> {
    return this.retryOperation(async () => {
      const reviewers = await this.redis.smembers(this.ONLINE_REVIEWERS_KEY);
      this.logger.debug(`👥 Found ${reviewers.length} online reviewers`);
      return reviewers;
    }, 'getOnlineReviewers');
  }

  /**
   * Kiểm tra reviewer có online không
   */
  async isReviewerOnline(userId: string): Promise<boolean> {
    try {
      const session = await this.getSession(userId);
      const isOnline = session !== null && session.isOnline;
      this.logger.debug(`🔍 Reviewer ${userId} online status: ${isOnline}`);
      return isOnline;
    } catch (error) {
      this.logger.error(
        `❌ Failed to check if reviewer ${userId} is online:`,
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
      const socketId = session ? session.socketId : null;
      this.logger.debug(
        `🔌 Socket ID for reviewer ${userId}: ${socketId || 'not found'}`,
      );
      return socketId;
    } catch (error) {
      this.logger.error(
        `❌ Failed to get socket ID for reviewer ${userId}:`,
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
        } else {
          // Cleanup orphaned online reference
          await this.redis.srem(this.ONLINE_REVIEWERS_KEY, userId);
          this.logger.warn(
            `🧹 Cleaned up orphaned online reference for ${userId}`,
          );
        }
      }

      this.logger.debug(
        `📊 Retrieved details for ${sessions.length} online reviewers`,
      );
      return sessions;
    } catch (error) {
      this.logger.error('❌ Failed to get online reviewers details:', error);
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
      let cleanedCount = 0;

      for (const userId of onlineUserIds) {
        const session = await this.getSession(userId);
        if (!session) {
          // Session không tồn tại, xóa khỏi online list
          await this.redis.srem(this.ONLINE_REVIEWERS_KEY, userId);
          cleanedCount++;
          this.logger.debug(
            `🧹 Cleaned up missing session reference for ${userId}`,
          );
          continue;
        }

        const lastActivity = new Date(session.lastActivity).getTime();
        if (now - lastActivity > TIMEOUT_MS) {
          // Session đã timeout, xóa
          await this.removeSession(userId);
          cleanedCount++;
          this.logger.log(
            `🧹 Cleaned up expired session for reviewer ${userId}`,
          );
        }
      }

      if (cleanedCount > 0) {
        this.logger.log(
          `🧹 Cleanup completed: ${cleanedCount} expired sessions removed`,
        );
      }
    } catch (error) {
      this.logger.error('❌ Failed to cleanup expired sessions:', error);
    }
  }

  /**
   * Lấy số lượng reviewers online
   */
  async getOnlineReviewersCount(): Promise<number> {
    try {
      const count = await this.redis.scard(this.ONLINE_REVIEWERS_KEY);
      this.logger.debug(`📊 Online reviewers count: ${count}`);
      return count;
    } catch (error) {
      this.logger.error('❌ Failed to get online reviewers count:', error);
      return 0;
    }
  }

  /**
   * Broadcast message đến tất cả reviewers online
   */
  async getAllOnlineSocketIds(): Promise<string[]> {
    try {
      const sessions = await this.getOnlineReviewersDetails();
      const socketIds = sessions.map((session) => session.socketId);
      this.logger.debug(`🔌 Retrieved ${socketIds.length} online socket IDs`);
      return socketIds;
    } catch (error) {
      this.logger.error('❌ Failed to get all online socket IDs:', error);
      return [];
    }
  }

  /**
   * Set reviewer offline (giữ session nhưng đánh dấu offline)
   */
  async setReviewerOffline(userId: string): Promise<void> {
    return this.retryOperation(async () => {
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

      this.logger.log(`📴 Set reviewer ${userId} offline`);
    }, `setReviewerOffline(${userId})`);
  }

  /**
   * Set reviewer online
   */
  async setReviewerOnline(userId: string, socketId: string): Promise<void> {
    try {
      await this.saveSession(userId, socketId);
      this.logger.log(
        `📱 Set reviewer ${userId} online with socket ${socketId}`,
      );
    } catch (error) {
      this.logger.error(`❌ Failed to set reviewer ${userId} online:`, error);
      throw error;
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
        this.logger.warn('⚠️ No online reviewers available');
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
        `👤 Selected reviewer ${selectedReviewer.reviewerId} with ${selectedReviewer.conversationCount} active conversations`,
      );

      return selectedReviewer;
    } catch (error) {
      this.logger.error(
        '❌ Failed to get reviewer with least conversations:',
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

      this.logger.debug(
        `📊 Workload stats generated for ${workloadStats.length} reviewers`,
      );
      return workloadStats;
    } catch (error) {
      this.logger.error('❌ Failed to get reviewer workload stats:', error);
      return [];
    }
  }

  /**
   * Cache socketId independently (for unauthenticated connections)
   */
  async cacheSocketId(socketId: string): Promise<void> {
    return this.retryOperation(async () => {
      const key = `${this.SOCKET_CACHE_KEY}:${socketId}`;
      await this.redis.setex(
        key,
        this.SESSION_TTL,
        JSON.stringify({
          socketId,
          connectedAt: new Date().toISOString(),
        }),
      );

      this.logger.log(`💾 Cached socket ID: ${socketId}`);
    }, `cacheSocketId(${socketId})`);
  }

  /**
   * Remove socket ID cache (for disconnected unauthenticated sockets)
   */
  async removeSocketIdCache(socketId: string): Promise<void> {
    return this.retryOperation(async () => {
      const key = `${this.SOCKET_CACHE_KEY}:${socketId}`;
      const deleted = await this.redis.del(key);

      this.logger.log(
        `🗑️ Removed socket ID cache: ${socketId} (deleted: ${deleted})`,
      );
    }, `removeSocketIdCache(${socketId})`);
  }

  /**
   * Health check cho Redis connection
   */
  async healthCheck(): Promise<{
    isHealthy: boolean;
    latency: number;
    operations: {
      ping: boolean;
      set: boolean;
      get: boolean;
      del: boolean;
    };
  }> {
    const startTime = Date.now();
    const operations = {
      ping: false,
      set: false,
      get: false,
      del: false,
    };

    try {
      // Test ping
      const pong = await this.redis.ping();
      operations.ping = pong === 'PONG';

      // Test set/get/del
      const testKey = `health_check_${Date.now()}`;
      const testValue = 'health_test';

      await this.redis.set(testKey, testValue, 'EX', 10);
      operations.set = true;

      const retrieved = await this.redis.get(testKey);
      operations.get = retrieved === testValue;

      const deleted = await this.redis.del(testKey);
      operations.del = deleted === 1;

      const latency = Date.now() - startTime;
      const isHealthy = Object.values(operations).every(Boolean);

      this.logger.debug(
        `🏥 Redis health check: ${
          isHealthy ? 'HEALTHY' : 'UNHEALTHY'
        } (${latency}ms)`,
      );

      return {
        isHealthy,
        latency,
        operations,
      };
    } catch (error) {
      this.logger.error('❌ Redis health check failed:', error);
      return {
        isHealthy: false,
        latency: Date.now() - startTime,
        operations,
      };
    }
  }
}
