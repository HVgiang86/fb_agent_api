import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../global/services/config.service';
import { ConfigKey } from '../entities/system-config.entity';

/**
 * EXAMPLE: Minh họa cách sử dụng ConfigService trong business logic
 *
 * ConfigService đã được import trong GlobalModule và có thể inject vào bất kỳ service nào
 */

@Injectable()
export class MessageProcessingService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Xử lý tin nhắn từ AI Agent - quyết định auto/manual response
   */
  async processAIResponse(
    aiResponse: any,
    confidence: number,
  ): Promise<{ shouldAutoReply: boolean; waitingMessage?: string }> {
    // Lấy config ngưỡng confidence từ database với caching
    const confidenceThreshold =
      await this.configService.getAiConfidenceThreshold();

    const shouldAutoReply = confidence >= confidenceThreshold;

    if (!shouldAutoReply) {
      // Nếu không auto reply, kiểm tra có gửi waiting message không
      const enableWaitingMessage =
        await this.configService.isWaitingMessageEnabled();

      if (enableWaitingMessage) {
        const waitingMessage =
          await this.configService.getWaitingMessageContent();
        return { shouldAutoReply: false, waitingMessage };
      }
    }

    return { shouldAutoReply };
  }

  /**
   * Phân phối tin nhắn đến reviewer
   */
  async assignToReviewer(
    messageId: string,
    customerType: string,
  ): Promise<string> {
    // Lấy strategy phân phối từ config
    const assignStrategy = await this.configService.getAutoAssignStrategy();

    switch (assignStrategy) {
      case 'round_robin':
        return this.assignRoundRobin(customerType);
      case 'load_based':
        return this.assignLoadBased(customerType);
      case 'expertise_based':
        return this.assignExpertiseBased(customerType);
      default:
        return this.assignRoundRobin(customerType);
    }
  }

  /**
   * Kiểm tra timeout reviewer
   */
  async checkReviewerTimeout(assignedAt: Date): Promise<boolean> {
    const timeoutMinutes = await this.configService.getReviewerTimeoutMinutes();
    const timeoutMs = timeoutMinutes * 60 * 1000;

    return Date.now() - assignedAt.getTime() > timeoutMs;
  }

  /**
   * Retry logic cho reviewer
   */
  async shouldRetryAssignment(currentRetryCount: number): Promise<boolean> {
    const maxRetryCount = await this.configService.getMaxRetryCount();
    return currentRetryCount < maxRetryCount;
  }

  /**
   * Sử dụng config với default value
   */
  async getSessionTimeout(): Promise<number> {
    // Có thể sử dụng method generic với default value
    return this.configService.getConfig(ConfigKey.SESSION_TIMEOUT_MINUTES, 480);
  }

  /**
   * Lấy nhiều config cùng lúc
   */
  async getMultipleConfigs(): Promise<any> {
    const configs = await this.configService.getMultipleConfigs([
      ConfigKey.AI_CONFIDENCE_THRESHOLD,
      ConfigKey.ENABLE_WAITING_MESSAGE,
      ConfigKey.MAX_RETRY_COUNT,
    ]);

    return configs;
  }

  /**
   * Update config động (chỉ có permission mới được)
   */
  async updateAIThreshold(newThreshold: number, userId: string): Promise<void> {
    await this.configService.updateConfig(
      ConfigKey.AI_CONFIDENCE_THRESHOLD,
      newThreshold,
      userId,
    );
  }

  // Private helper methods (placeholder)
  private async assignRoundRobin(customerType: string): Promise<string> {
    // Logic phân phối round robin
    return 'reviewer-id-1';
  }

  private async assignLoadBased(customerType: string): Promise<string> {
    // Logic phân phối dựa trên load
    return 'reviewer-id-2';
  }

  private async assignExpertiseBased(customerType: string): Promise<string> {
    // Logic phân phối dựa trên expertise
    return 'reviewer-id-3';
  }
}

/**
 * EXAMPLE: Sử dụng trong job/worker để xử lý background tasks
 */
@Injectable()
export class MessageProcessorJob {
  constructor(private readonly configService: ConfigService) {}

  async processMessages(): Promise<void> {
    // Kiểm tra hệ thống có đang maintenance không
    const isMaintenanceMode = await this.configService.getConfig(
      ConfigKey.SYSTEM_MAINTENANCE_MODE,
      false,
    );

    if (isMaintenanceMode) {
      console.log('System is in maintenance mode, skipping message processing');
      return;
    }

    // Tiến hành xử lý tin nhắn...
    console.log('Processing messages...');
  }
}

/**
 * EXAMPLE: Cache warming - preload configs vào memory
 */
@Injectable()
export class ConfigWarmupService {
  constructor(private readonly configService: ConfigService) {}

  async warmupConfigs(): Promise<void> {
    // Preload các config hay sử dụng vào cache
    const criticalConfigs = [
      ConfigKey.AI_CONFIDENCE_THRESHOLD,
      ConfigKey.ENABLE_WAITING_MESSAGE,
      ConfigKey.WAITING_MESSAGE_CONTENT,
      ConfigKey.MAX_RETRY_COUNT,
      ConfigKey.REVIEWER_TIMEOUT_MINUTES,
    ];

    await Promise.all(
      criticalConfigs.map((key) => this.configService.getConfig(key)),
    );

    console.log('Config cache warmed up');
  }
}
