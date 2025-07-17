export interface ISocketCacheService {
  /**
   * Lưu mapping giữa socketId và userId
   */
  setSocketUser(socketId: string, userId: string): Promise<void>;

  /**
   * Lấy userId từ socketId
   */
  getUserBySocketId(socketId: string): Promise<string | null>;

  /**
   * Lấy socketId từ userId
   */
  getSocketIdByUserId(userId: string): Promise<string | null>;

  /**
   * Xóa mapping của socketId
   */
  removeBySocketId(socketId: string): Promise<void>;

  /**
   * Xóa mapping của userId
   */
  removeByUserId(userId: string): Promise<void>;

  /**
   * Lấy tất cả socketIds đang online
   */
  getAllSocketIds(): Promise<string[]>;

  /**
   * Lấy tất cả userIds đang online
   */
  getAllUserIds(): Promise<string[]>;

  /**
   * Kiểm tra userId có đang online không
   */
  isUserOnline(userId: string): Promise<boolean>;

  /**
   * Clear all cache
   */
  clear(): Promise<void>;

  // Optional enhanced methods
  /**
   * Cập nhật last activity cho socket
   */
  updateActivity?(socketId: string): Promise<void>;

  /**
   * Sync methods để cải thiện performance
   */
  getUserBySocketIdSync?(socketId: string): string | null;
  getSocketIdByUserIdSync?(userId: string): string | null;
  isUserOnlineSync?(userId: string): boolean;
}
