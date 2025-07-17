import { Injectable, Logger } from '@nestjs/common';
import { ISocketCacheService } from '../interfaces/socket-cache.interface';

interface SocketCacheEntry {
  userId: string;
  socketId: string;
  connectedAt: Date;
  lastActivity: Date;
}

@Injectable()
export class MemorySocketCacheService implements ISocketCacheService {
  private readonly logger = new Logger(MemorySocketCacheService.name);

  // Map socketId -> userId (for fast socket lookup)
  private socketToUser = new Map<string, string>();

  // Map userId -> socketId (for fast user lookup)
  private userToSocket = new Map<string, string>();

  // Map để lưu metadata
  private socketMetadata = new Map<string, SocketCacheEntry>();

  async setSocketUser(socketId: string, userId: string): Promise<void> {
    try {
      // Validation
      if (!socketId?.trim()) {
        throw new Error('socketId không được để trống');
      }
      if (!userId?.trim()) {
        throw new Error('userId không được để trống');
      }

      const now = new Date();

      // Xóa mapping cũ nếu có
      const oldUserId = this.socketToUser.get(socketId);
      if (oldUserId) {
        this.userToSocket.delete(oldUserId);
        this.socketMetadata.delete(socketId);
        this.logger.log(
          `Removed old mapping for socket ${socketId}: ${oldUserId}`,
        );
      }

      const oldSocketId = this.userToSocket.get(userId);
      if (oldSocketId) {
        this.socketToUser.delete(oldSocketId);
        this.socketMetadata.delete(oldSocketId);
        this.logger.log(
          `Removed old mapping for user ${userId}: ${oldSocketId}`,
        );
      }

      // Lưu mapping mới
      this.socketToUser.set(socketId, userId);
      this.userToSocket.set(userId, socketId);

      // Lưu metadata
      this.socketMetadata.set(socketId, {
        userId,
        socketId,
        connectedAt: now,
        lastActivity: now,
      });

      this.logger.log(
        `Set socket mapping: ${socketId} -> ${userId} at ${now.toISOString()}`,
      );
    } catch (error) {
      this.logger.error(`Error setting socket mapping:`, error);
      throw error;
    }
  }

  async getUserBySocketId(socketId: string): Promise<string | null> {
    return this.socketToUser.get(socketId) || null;
  }

  async getSocketIdByUserId(userId: string): Promise<string | null> {
    return this.userToSocket.get(userId) || null;
  }

  async removeBySocketId(socketId: string): Promise<void> {
    try {
      if (!socketId?.trim()) {
        return; // Silent ignore for empty socketId
      }

      const userId = this.socketToUser.get(socketId);
      if (userId) {
        this.userToSocket.delete(userId);
        this.socketToUser.delete(socketId);
        this.socketMetadata.delete(socketId);
        this.logger.log(`Removed socket mapping: ${socketId} -> ${userId}`);
      } else {
        this.logger.debug(`Socket ${socketId} not found for removal`);
      }
    } catch (error) {
      this.logger.error(`Error removing socket by socketId:`, error);
      throw error;
    }
  }

  async removeByUserId(userId: string): Promise<void> {
    try {
      if (!userId?.trim()) {
        return; // Silent ignore for empty userId
      }

      const socketId = this.userToSocket.get(userId);
      if (socketId) {
        this.socketToUser.delete(socketId);
        this.userToSocket.delete(userId);
        this.socketMetadata.delete(socketId);
        this.logger.log(`Removed user mapping: ${userId} -> ${socketId}`);
      } else {
        this.logger.debug(`User ${userId} not found for removal`);
      }
    } catch (error) {
      this.logger.error(`Error removing socket by userId:`, error);
      throw error;
    }
  }

  async getAllSocketIds(): Promise<string[]> {
    return Array.from(this.socketToUser.keys());
  }

  async getAllUserIds(): Promise<string[]> {
    return Array.from(this.userToSocket.keys());
  }

  async isUserOnline(userId: string): Promise<boolean> {
    return this.userToSocket.has(userId);
  }

  async clear(): Promise<void> {
    const count = this.socketToUser.size;
    this.socketToUser.clear();
    this.userToSocket.clear();
    this.socketMetadata.clear();
    this.logger.log(`Cleared all socket mappings (${count} entries)`);
  }

  // Helper methods for debugging và monitoring

  /**
   * Lấy số lượng socket đang connect
   */
  getSocketCount(): number {
    return this.socketToUser.size;
  }

  /**
   * Lấy tất cả mappings với metadata
   */
  getAllMappings(): { socketId: string; userId: string }[] {
    return Array.from(this.socketToUser.entries()).map(
      ([socketId, userId]) => ({
        socketId,
        userId,
      }),
    );
  }

  /**
   * Lấy detailed mappings với metadata
   */
  getDetailedMappings(): SocketCacheEntry[] {
    return Array.from(this.socketMetadata.values());
  }

  /**
   * Lấy thông tin socket specific
   */
  getSocketInfo(socketId: string): SocketCacheEntry | null {
    return this.socketMetadata.get(socketId) || null;
  }

  /**
   * Cập nhật last activity cho socket
   */
  async updateActivity(socketId: string): Promise<void> {
    const entry = this.socketMetadata.get(socketId);
    if (entry) {
      entry.lastActivity = new Date();
      this.logger.debug(`Updated activity for socket ${socketId}`);
    }
  }

  /**
   * Lấy thống kê cache
   */
  getCacheStats(): {
    totalConnections: number;
    uniqueUsers: number;
    oldestConnection: Date | null;
    newestConnection: Date | null;
  } {
    const entries = Array.from(this.socketMetadata.values());

    return {
      totalConnections: entries.length,
      uniqueUsers: new Set(entries.map((e) => e.userId)).size,
      oldestConnection:
        entries.length > 0
          ? new Date(Math.min(...entries.map((e) => e.connectedAt.getTime())))
          : null,
      newestConnection:
        entries.length > 0
          ? new Date(Math.max(...entries.map((e) => e.connectedAt.getTime())))
          : null,
    };
  }

  /**
   * Lấy sockets inactive quá lâu
   */
  getInactiveSockets(inactiveMinutes = 30): SocketCacheEntry[] {
    const cutoffTime = new Date(Date.now() - inactiveMinutes * 60 * 1000);
    return Array.from(this.socketMetadata.values()).filter(
      (entry) => entry.lastActivity < cutoffTime,
    );
  }

  /**
   * Kiểm tra tính toàn vẹn của cache
   */
  validateCacheIntegrity(): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Kiểm tra số lượng entries phải khớp nhau
    if (this.socketToUser.size !== this.userToSocket.size) {
      errors.push('Mismatch between socketToUser and userToSocket size');
    }

    if (this.socketToUser.size !== this.socketMetadata.size) {
      errors.push('Mismatch between socketToUser and socketMetadata size');
    }

    // Kiểm tra mapping consistency
    for (const [socketId, userId] of this.socketToUser.entries()) {
      if (this.userToSocket.get(userId) !== socketId) {
        errors.push(
          `Inconsistent mapping for socket ${socketId} -> user ${userId}`,
        );
      }

      const metadata = this.socketMetadata.get(socketId);
      if (!metadata) {
        errors.push(`Missing metadata for socket ${socketId}`);
      } else if (metadata.userId !== userId) {
        errors.push(`Metadata userId mismatch for socket ${socketId}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Sync methods để cải thiện performance (không async)
   */
  getUserBySocketIdSync(socketId: string): string | null {
    return this.socketToUser.get(socketId) || null;
  }

  getSocketIdByUserIdSync(userId: string): string | null {
    return this.userToSocket.get(userId) || null;
  }

  isUserOnlineSync(userId: string): boolean {
    return this.userToSocket.has(userId);
  }
}
