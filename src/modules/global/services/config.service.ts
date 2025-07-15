import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SystemConfig,
  ConfigKey,
  ConfigDataType,
} from '../../system-config/entities/system-config.entity';

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);
  private configCache = new Map<ConfigKey, any>();
  private cacheExpiry = new Map<ConfigKey, number>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectRepository(SystemConfig)
    private readonly systemConfigRepository: Repository<SystemConfig>,
  ) {}

  /**
   * Lấy giá trị config theo key với caching
   */
  async getConfig<T = any>(key: ConfigKey, defaultValue?: T): Promise<T> {
    try {
      // Kiểm tra cache
      if (this.isCacheValid(key)) {
        return this.configCache.get(key) as T;
      }

      // Lấy từ database
      const config = await this.systemConfigRepository.findOne({
        where: { configKey: key, isActive: true },
      });

      if (!config) {
        this.logger.warn(`Config key "${key}" not found, using default value`);
        return defaultValue as T;
      }

      // Parse giá trị theo data type
      const parsedValue = this.parseConfigValue(
        config.configValue,
        config.dataType,
      );

      // Lưu vào cache
      this.setCacheValue(key, parsedValue);

      return parsedValue as T;
    } catch (error) {
      this.logger.error(`Error getting config for key "${key}":`, error);
      return defaultValue as T;
    }
  }

  /**
   * Cập nhật config và xóa cache
   */
  async updateConfig(
    key: ConfigKey,
    value: any,
    updatedBy?: string,
  ): Promise<void> {
    try {
      const config = await this.systemConfigRepository.findOne({
        where: { configKey: key },
      });

      if (!config) {
        throw new Error(`Config key "${key}" not found`);
      }

      if (
        config.isSystemConfig &&
        !this.isValidSystemConfigUpdate(key, value)
      ) {
        throw new Error(`Invalid value for system config "${key}"`);
      }

      // Convert value to string for storage
      const stringValue = this.valueToString(value, config.dataType);

      await this.systemConfigRepository.update(
        { configKey: key },
        {
          configValue: stringValue,
          updatedBy: updatedBy,
        },
      );

      // Xóa cache để force reload
      this.clearCacheKey(key);

      this.logger.log(`Config "${key}" updated successfully`);
    } catch (error) {
      this.logger.error(`Error updating config for key "${key}":`, error);
      throw error;
    }
  }

  /**
   * Lấy nhiều config cùng lúc
   */
  async getMultipleConfigs(keys: ConfigKey[]): Promise<Record<string, any>> {
    const result: Record<string, any> = {};

    for (const key of keys) {
      result[key] = await this.getConfig(key);
    }

    return result;
  }

  /**
   * Làm mới toàn bộ cache
   */
  async refreshCache(): Promise<void> {
    this.configCache.clear();
    this.cacheExpiry.clear();
    this.logger.log('Config cache refreshed');
  }

  /**
   * Lấy tất cả config đang active
   */
  async getAllConfigs(): Promise<SystemConfig[]> {
    return this.systemConfigRepository.find({
      where: { isActive: true },
      order: { configKey: 'ASC' },
    });
  }

  // Private helper methods
  private isCacheValid(key: ConfigKey): boolean {
    if (!this.configCache.has(key)) {
      return false;
    }

    const expiry = this.cacheExpiry.get(key);
    return expiry ? Date.now() < expiry : false;
  }

  private setCacheValue(key: ConfigKey, value: any): void {
    this.configCache.set(key, value);
    this.cacheExpiry.set(key, Date.now() + this.CACHE_TTL);
  }

  private clearCacheKey(key: ConfigKey): void {
    this.configCache.delete(key);
    this.cacheExpiry.delete(key);
  }

  private parseConfigValue(value: string, dataType: ConfigDataType): any {
    switch (dataType) {
      case ConfigDataType.BOOLEAN:
        return value.toLowerCase() === 'true';

      case ConfigDataType.NUMBER:
        const parsed = Number(value);
        if (isNaN(parsed)) {
          throw new Error(`Invalid number value: ${value}`);
        }
        return parsed;

      case ConfigDataType.JSON:
        try {
          return JSON.parse(value);
        } catch (error) {
          throw new Error(`Invalid JSON value: ${value}`);
        }

      case ConfigDataType.STRING:
      default:
        return value;
    }
  }

  private valueToString(value: any, dataType: ConfigDataType): string {
    switch (dataType) {
      case ConfigDataType.BOOLEAN:
        return String(Boolean(value));

      case ConfigDataType.NUMBER:
        return String(Number(value));

      case ConfigDataType.JSON:
        return JSON.stringify(value);

      case ConfigDataType.STRING:
      default:
        return String(value);
    }
  }

  private isValidSystemConfigUpdate(key: ConfigKey, value: any): boolean {
    // Validation logic cho các system config quan trọng
    switch (key) {
      case ConfigKey.AI_CONFIDENCE_THRESHOLD:
        const threshold = Number(value);
        return !isNaN(threshold) && threshold >= 0 && threshold <= 100;

      case ConfigKey.MAX_RETRY_COUNT:
        const retryCount = Number(value);
        return !isNaN(retryCount) && retryCount >= 0 && retryCount <= 10;

      case ConfigKey.REVIEWER_TIMEOUT_MINUTES:
        const timeout = Number(value);
        return !isNaN(timeout) && timeout >= 1 && timeout <= 1440; // Max 24 hours

      case ConfigKey.AUTO_ASSIGN_STRATEGY:
        return ['round_robin', 'load_based', 'expertise_based'].includes(
          String(value),
        );

      default:
        return true;
    }
  }

  // Convenient methods for specific configs
  async getAiConfidenceThreshold(): Promise<number> {
    return this.getConfig(ConfigKey.AI_CONFIDENCE_THRESHOLD, 80);
  }

  async isWaitingMessageEnabled(): Promise<boolean> {
    return this.getConfig(ConfigKey.ENABLE_WAITING_MESSAGE, true);
  }

  async getWaitingMessageContent(): Promise<string> {
    return this.getConfig(
      ConfigKey.WAITING_MESSAGE_CONTENT,
      'Cảm ơn bạn đã liên hệ. Chúng tôi sẽ phản hồi trong thời gian sớm nhất.',
    );
  }

  async getMaxRetryCount(): Promise<number> {
    return this.getConfig(ConfigKey.MAX_RETRY_COUNT, 3);
  }

  async getReviewerTimeoutMinutes(): Promise<number> {
    return this.getConfig(ConfigKey.REVIEWER_TIMEOUT_MINUTES, 30);
  }

  async getAutoAssignStrategy(): Promise<string> {
    return this.getConfig(ConfigKey.AUTO_ASSIGN_STRATEGY, 'round_robin');
  }
}
