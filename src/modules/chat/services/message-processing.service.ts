import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../entities/message.entity';
import { Conversation } from '../entities/conversation.entity';
import { Customer } from '../../users/entities/customer.entity';
import { User } from '../../users/entities/users.entity';
import { PermissionName } from '../../users/entities/permission.entity';
import { FacebookWebhookPayloadDto } from '../dto/facebook-webhook.dto';
import { ConversationService } from './conversation.service';
import { ReviewerSessionService } from './reviewer-session.service';
import { MessageCacheService } from '../../../shared/redis/services/message-cache.service';
import { ConversationCacheService } from '../../../shared/redis/services/conversation-cache.service';
import {
  ConversationStatus,
  MessageStatus as EntityMessageStatus,
  SenderType as EntitySenderType,
  CustomerType,
} from '../types/enums';
import {
  MessageStatus as CacheMessageStatus,
  SenderType as CacheSenderType,
} from '../types/message.types';
import { formatDateToISO } from '../../../utils/date-formatter';

@Injectable()
export class MessageProcessingService {
  private readonly logger = new Logger(MessageProcessingService.name);

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(forwardRef(() => ConversationService))
    private readonly conversationService: ConversationService,
    private readonly reviewerSessionService: ReviewerSessionService,
    private readonly messageCacheService: MessageCacheService,
    private readonly conversationCacheService: ConversationCacheService,
  ) {}

  /**
   * Xử lý tin nhắn từ Facebook webhook
   */
  async processIncomingMessage(payload: FacebookWebhookPayloadDto): Promise<{
    messageId: string;
    conversationId: string;
    customerId: string;
    reviewerId?: string;
    isNewConversation: boolean;
  }> {
    try {
      this.logger.log(`Processing incoming message: ${payload.messageId}`);

      // 1. Tìm hoặc tạo customer
      const customer = await this.findOrCreateCustomer(payload.customerInfo);

      // 2. Tìm hoặc tạo conversation
      const { conversation, isNew: isNewConversation } =
        await this.findOrCreateConversation(customer.id);

      // 3. Tạo message record
      const message = await this.createMessageRecord(
        payload,
        conversation.id,
        customer.id,
      );

      // 4. Cập nhật conversation statistics
      await this.updateConversationStats(conversation.id);

      // 5. Assign reviewer nếu cần
      let assignedReviewerId: string | undefined;
      if (conversation.status === ConversationStatus.ACTIVE) {
        assignedReviewerId = await this.assignReviewerToConversation(
          conversation.id,
          customer.customerType,
        );
      }

      this.logger.log(`Successfully processed message ${payload.messageId}`);

      return {
        messageId: message.id,
        conversationId: conversation.id,
        customerId: customer.id,
        reviewerId: assignedReviewerId,
        isNewConversation,
      };
    } catch (error) {
      this.logger.error(
        `Failed to process message ${payload.messageId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Tìm hoặc tạo customer từ Facebook info
   */
  private async findOrCreateCustomer(
    customerInfo: FacebookWebhookPayloadDto['customerInfo'],
  ): Promise<Customer> {
    try {
      // Tìm customer theo facebookId
      let customer = await this.customerRepository.findOne({
        where: { facebookId: customerInfo.facebookId },
      });

      if (!customer) {
        // Tạo customer mới
        customer = this.customerRepository.create({
          facebookId: customerInfo.facebookId,
          facebookName: customerInfo.facebookName,
          facebookProfileUrl: customerInfo.profileUrl,
          facebookAvatarUrl: customerInfo.avatarUrl,
          customerType: CustomerType.INDIVIDUAL, // Default value
        });

        customer = await this.customerRepository.save(customer);
        this.logger.log(`Created new customer: ${customer.id}`);
      } else {
        // Cập nhật thông tin nếu có thay đổi
        let hasChanges = false;
        if (
          customerInfo.facebookName &&
          customer.facebookName !== customerInfo.facebookName
        ) {
          customer.facebookName = customerInfo.facebookName;
          hasChanges = true;
        }
        if (
          customerInfo.avatarUrl &&
          customer.facebookAvatarUrl !== customerInfo.avatarUrl
        ) {
          customer.facebookAvatarUrl = customerInfo.avatarUrl;
          hasChanges = true;
        }

        if (hasChanges) {
          customer = await this.customerRepository.save(customer);
          this.logger.log(`Updated customer info: ${customer.id}`);
        }
      }

      return customer;
    } catch (error) {
      this.logger.error('Failed to find or create customer:', error);
      throw error;
    }
  }

  /**
   * Tìm hoặc tạo conversation
   */
  private async findOrCreateConversation(
    customerId: string,
  ): Promise<{ conversation: Conversation; isNew: boolean }> {
    try {
      // Tìm conversation active gần nhất
      let conversation = await this.conversationRepository.findOne({
        where: {
          customerId,
          status: ConversationStatus.ACTIVE,
        },
        order: { createdAt: 'DESC' },
      });

      if (!conversation) {
        // Tạo conversation mới
        conversation = this.conversationRepository.create({
          customerId,
          status: ConversationStatus.ACTIVE,
          startedAt: new Date(),
          totalMessages: 0,
          autoMessages: 0,
          manualMessages: 0,
        });

        conversation = await this.conversationRepository.save(conversation);
        this.logger.log(`Created new conversation: ${conversation.id}`);

        return { conversation, isNew: true };
      }

      return { conversation, isNew: false };
    } catch (error) {
      this.logger.error('Failed to find or create conversation:', error);
      throw error;
    }
  }

  /**
   * Tạo message record trong database
   */
  private async createMessageRecord(
    payload: FacebookWebhookPayloadDto,
    conversationId: string,
    customerId: string,
  ): Promise<Message> {
    try {
      const message = this.messageRepository.create({
        conversationId,
        customerId,
        senderId: customerId, // Facebook message từ customer
        senderType: EntitySenderType.CUSTOMER,
        content: payload.content,
        status: EntityMessageStatus.RECEIVED,
        facebookMessageId: payload.messageId,
        processedAt: new Date(),
        retryCount: 0,
        maxRetries: 3,
      });

      const savedMessage = await this.messageRepository.save(message);

      // Cache message vào Redis
      await this.messageCacheService.cacheMessage({
        id: savedMessage.id,
        conversationId,
        customerId,
        senderId: customerId,
        senderType: CacheSenderType.CUSTOMER,
        content: payload.content,
        status: CacheMessageStatus.RECEIVED,
        createdAt: formatDateToISO(savedMessage.createdAt),
        updatedAt: formatDateToISO(savedMessage.updatedAt),
      });

      this.logger.log(`Created message record: ${savedMessage.id}`);
      return savedMessage;
    } catch (error) {
      this.logger.error('Failed to create message record:', error);
      throw error;
    }
  }

  /**
   * Cập nhật statistics của conversation
   */
  private async updateConversationStats(conversationId: string): Promise<void> {
    try {
      await this.conversationRepository.update(conversationId, {
        totalMessages: () => 'total_messages + 1',
        lastMessageAt: new Date(),
      });

      this.logger.debug(`Updated conversation stats: ${conversationId}`);
    } catch (error) {
      this.logger.error('Failed to update conversation stats:', error);
    }
  }

  /**
   * Assign reviewer có ít conversation nhất đến conversation
   */
  private async assignReviewerToConversation(
    conversationId: string,
    customerType: CustomerType,
  ): Promise<string | undefined> {
    try {
      // Tìm reviewer online có ít conversation nhất
      const reviewerId = await this.findReviewerWithLeastConversations(
        customerType,
      );

      if (!reviewerId) {
        this.logger.warn('No online reviewer available for assignment');
        return undefined;
      }

      // Assign reviewer đến conversation
      await this.conversationRepository.update(conversationId, {
        assignedReviewerId: reviewerId,
        status: ConversationStatus.ACTIVE,
      });

      // Cache assignment
      await this.conversationCacheService.assignReviewer(
        conversationId,
        reviewerId,
        customerType,
        30, // 30 minutes timeout
      );

      this.logger.log(
        `Assigned reviewer ${reviewerId} to conversation ${conversationId}`,
      );

      return reviewerId;
    } catch (error) {
      this.logger.error('Failed to assign reviewer to conversation:', error);
      return undefined;
    }
  }

  /**
   * Tìm reviewer online có ít conversation nhất
   */
  private async findReviewerWithLeastConversations(
    customerType: CustomerType,
  ): Promise<string | undefined> {
    try {
      // 1. Lấy danh sách reviewer online
      const onlineReviewerIds =
        await this.reviewerSessionService.getOnlineReviewers();

      if (onlineReviewerIds.length === 0) {
        return undefined;
      }

      // 2. Lấy reviewers từ database với permissions phù hợp
      const reviewers = await this.userRepository
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.userPermissions', 'userPermission')
        .leftJoinAndSelect('userPermission.permission', 'permission')
        .where('user.id IN (:...onlineReviewerIds)', { onlineReviewerIds })
        .andWhere('user.isActive = :isActive', { isActive: true })
        .andWhere('permission.name = :permissionName', {
          permissionName: PermissionName.CHAT, // Permission CHAT cho reviewers
        })
        .getMany();

      if (reviewers.length === 0) {
        return undefined;
      }

      // 3. Đếm conversation đang active cho mỗi reviewer
      const reviewerConversationCounts = await Promise.all(
        reviewers.map(async (reviewer) => {
          const activeConversations = await this.conversationRepository.count({
            where: {
              assignedReviewerId: reviewer.id,
              status: ConversationStatus.ACTIVE,
            },
          });

          return {
            reviewerId: reviewer.id,
            conversationCount: activeConversations,
          };
        }),
      );

      // 4. Sắp xếp theo số conversation tăng dần và chọn reviewer đầu tiên
      reviewerConversationCounts.sort(
        (a, b) => a.conversationCount - b.conversationCount,
      );

      const selectedReviewer = reviewerConversationCounts[0];

      this.logger.debug(
        `Selected reviewer ${selectedReviewer.reviewerId} with ${selectedReviewer.conversationCount} active conversations`,
      );

      return selectedReviewer.reviewerId;
    } catch (error) {
      this.logger.error(
        'Failed to find reviewer with least conversations:',
        error,
      );
      return undefined;
    }
  }
}
