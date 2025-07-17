import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from '../entities/conversation.entity';
import { Customer } from '../../users/entities/customer.entity';
import { User } from '../../users/entities/users.entity';
import { ConversationStatus } from '../types/enums';
import { formatDateToISO } from '../../../utils/date-formatter';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Tìm hoặc tạo conversation cho customer
   */
  async findOrCreateConversation(
    customerId: string,
    conversationId?: string,
  ): Promise<Conversation> {
    try {
      // Nếu có conversationId, tìm conversation đó
      if (conversationId) {
        const existing = await this.conversationRepository.findOne({
          where: { id: conversationId },
          relations: ['customer', 'assignedReviewer'],
        });
        if (existing) {
          return existing;
        }
      }

      // Tìm conversation active gần nhất của customer
      const activeConversation = await this.conversationRepository.findOne({
        where: {
          customerId,
          status: ConversationStatus.ACTIVE,
          caseResolved: false,
        },
        relations: ['customer', 'assignedReviewer'],
        order: { startedAt: 'DESC' },
      });

      if (activeConversation) {
        // Cập nhật last message time
        await this.updateLastMessageTime(activeConversation.id);
        return activeConversation;
      }

      // Tạo conversation mới
      const customer = await this.customerRepository.findOne({
        where: { id: customerId },
      });

      if (!customer) {
        throw new HttpException('Customer không tồn tại', HttpStatus.NOT_FOUND);
      }

      const newConversation = this.conversationRepository.create({
        customerId,
        status: ConversationStatus.ACTIVE,
        caseResolved: false,
        startedAt: new Date(),
        lastMessageAt: new Date(),
        totalMessages: 0,
        autoMessages: 0,
        manualMessages: 0,
      });

      const savedConversation = await this.conversationRepository.save(
        newConversation,
      );

      // Cập nhật total conversations của customer
      await this.customerRepository.increment(
        { id: customerId },
        'totalConversations',
        1,
      );

      this.logger.log(
        `Created new conversation ${savedConversation.id} for customer ${customerId}`,
      );

      return await this.conversationRepository.findOne({
        where: { id: savedConversation.id },
        relations: ['customer', 'assignedReviewer'],
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Lỗi khi tìm hoặc tạo conversation:', error);
      throw new HttpException(
        'Tìm hoặc tạo conversation thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Lấy conversation theo ID
   */
  async getConversationById(conversationId: string): Promise<Conversation> {
    try {
      const conversation = await this.conversationRepository.findOne({
        where: { id: conversationId },
        relations: ['customer', 'assignedReviewer', 'resolver'],
      });

      if (!conversation) {
        throw new HttpException(
          'Conversation không tồn tại',
          HttpStatus.NOT_FOUND,
        );
      }

      return conversation;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Lỗi khi lấy conversation ${conversationId}:`, error);
      throw new HttpException(
        'Lấy conversation thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Phân công reviewer cho conversation
   */
  async assignReviewer(
    conversationId: string,
    reviewerId: string,
  ): Promise<void> {
    try {
      // Kiểm tra reviewer tồn tại
      const reviewer = await this.userRepository.findOne({
        where: { id: reviewerId },
      });

      if (!reviewer) {
        throw new HttpException('Reviewer không tồn tại', HttpStatus.NOT_FOUND);
      }

      await this.conversationRepository.update(conversationId, {
        assignedReviewerId: reviewerId,
      });

      this.logger.log(
        `Assigned reviewer ${reviewerId} to conversation ${conversationId}`,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        `Lỗi khi phân công reviewer cho conversation ${conversationId}:`,
        error,
      );
      throw new HttpException(
        'Phân công reviewer thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Bỏ phân công reviewer
   */
  async unassignReviewer(conversationId: string): Promise<void> {
    try {
      await this.conversationRepository.update(conversationId, {
        assignedReviewerId: null,
      });

      this.logger.log(
        `Unassigned reviewer from conversation ${conversationId}`,
      );
    } catch (error) {
      this.logger.error(
        `Lỗi khi bỏ phân công reviewer cho conversation ${conversationId}:`,
        error,
      );
    }
  }

  /**
   * Cập nhật thời gian tin nhắn cuối
   */
  async updateLastMessageTime(conversationId: string): Promise<void> {
    try {
      await this.conversationRepository.update(conversationId, {
        lastMessageAt: new Date(),
      });
    } catch (error) {
      this.logger.error(
        `Lỗi khi cập nhật last message time cho conversation ${conversationId}:`,
        error,
      );
    }
  }

  /**
   * Tăng số lượng tin nhắn
   */
  async incrementMessageCount(
    conversationId: string,
    messageType: 'auto' | 'manual' = 'manual',
  ): Promise<void> {
    try {
      const updateData: any = {
        totalMessages: () => 'total_messages + 1',
        lastMessageAt: new Date(),
      };

      if (messageType === 'auto') {
        updateData.autoMessages = () => 'auto_messages + 1';
      } else {
        updateData.manualMessages = () => 'manual_messages + 1';
      }

      await this.conversationRepository
        .createQueryBuilder()
        .update(Conversation)
        .set(updateData)
        .where('id = :id', { id: conversationId })
        .execute();
    } catch (error) {
      this.logger.error(
        `Lỗi khi tăng message count cho conversation ${conversationId}:`,
        error,
      );
    }
  }

  /**
   * Đánh dấu conversation đã resolved
   */
  async resolveConversation(
    conversationId: string,
    resolvedBy: string,
  ): Promise<void> {
    try {
      await this.conversationRepository.update(conversationId, {
        caseResolved: true,
        resolvedAt: new Date(),
        resolvedBy,
        status: ConversationStatus.DEACTIVE,
      });

      this.logger.log(
        `Conversation ${conversationId} resolved by ${resolvedBy}`,
      );
    } catch (error) {
      this.logger.error(
        `Lỗi khi resolve conversation ${conversationId}:`,
        error,
      );
      throw new HttpException(
        'Resolve conversation thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Mở lại conversation
   */
  async reopenConversation(conversationId: string): Promise<void> {
    try {
      await this.conversationRepository.update(conversationId, {
        caseResolved: false,
        resolvedAt: null,
        resolvedBy: null,
        status: ConversationStatus.ACTIVE,
      });

      this.logger.log(`Conversation ${conversationId} reopened`);
    } catch (error) {
      this.logger.error(
        `Lỗi khi reopen conversation ${conversationId}:`,
        error,
      );
      throw new HttpException(
        'Reopen conversation thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Lấy conversations theo reviewer
   */
  async getConversationsByReviewer(
    reviewerId: string,
    filters: {
      status?: ConversationStatus;
    } = {},
  ) {
    try {
      const { status } = filters;

      const queryBuilder = this.conversationRepository
        .createQueryBuilder('conversation')
        .leftJoinAndSelect('conversation.customer', 'customer')
        .leftJoinAndSelect('conversation.assignedReviewer', 'assignedReviewer')
        .where('conversation.assignedReviewerId = :reviewerId', { reviewerId });

      if (status) {
        queryBuilder.andWhere('conversation.status = :status', { status });
      }

      const conversations = await queryBuilder
        .orderBy('conversation.lastMessageAt', 'DESC')
        .getMany();

      return {
        conversations: conversations.map((conversation) =>
          this.formatConversationResponse(conversation),
        ),
        total: conversations.length,
      };
    } catch (error) {
      this.logger.error(
        `Lỗi khi lấy conversations của reviewer ${reviewerId}:`,
        error,
      );
      throw new HttpException(
        'Lấy conversations thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Lấy conversations active chưa có reviewer
   */
  async getUnassignedConversations(
    params: {
      page?: number;
      limit?: number;
    } = {},
  ) {
    try {
      const { page = 1, limit = 20 } = params;
      const skip = (page - 1) * limit;

      const [conversations, total] = await this.conversationRepository
        .createQueryBuilder('conversation')
        .leftJoinAndSelect('conversation.customer', 'customer')
        .where('conversation.assignedReviewerId IS NULL')
        .andWhere('conversation.status = :status', {
          status: ConversationStatus.ACTIVE,
        })
        .andWhere('conversation.caseResolved = :caseResolved', {
          caseResolved: false,
        })
        .orderBy('conversation.startedAt', 'ASC') // FIFO
        .skip(skip)
        .take(limit)
        .getManyAndCount();

      return {
        conversations: conversations.map((conversation) =>
          this.formatConversationResponse(conversation),
        ),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error('Lỗi khi lấy unassigned conversations:', error);
      throw new HttpException(
        'Lấy unassigned conversations thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Cập nhật trạng thái conversation
   */
  async updateConversationStatus(
    conversationId: string,
    status: ConversationStatus,
  ): Promise<void> {
    try {
      await this.conversationRepository.update(conversationId, { status });
      this.logger.log(
        `Updated conversation ${conversationId} status to ${status}`,
      );
    } catch (error) {
      this.logger.error(
        `Lỗi khi cập nhật status conversation ${conversationId}:`,
        error,
      );
      throw new HttpException(
        'Cập nhật status conversation thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Lấy thống kê conversations
   */
  async getConversationStats(reviewerId?: string) {
    try {
      const queryBuilder =
        this.conversationRepository.createQueryBuilder('conversation');

      if (reviewerId) {
        queryBuilder.where('conversation.assignedReviewerId = :reviewerId', {
          reviewerId,
        });
      }

      const [
        totalConversations,
        activeConversations,
        resolvedConversations,
        averageMessages,
      ] = await Promise.all([
        queryBuilder.getCount(),
        queryBuilder
          .clone()
          .andWhere('conversation.status = :status', {
            status: ConversationStatus.ACTIVE,
          })
          .getCount(),
        queryBuilder
          .clone()
          .andWhere('conversation.caseResolved = :resolved', { resolved: true })
          .getCount(),
        queryBuilder
          .clone()
          .select('AVG(conversation.totalMessages)', 'avg')
          .getRawOne(),
      ]);

      return {
        totalConversations,
        activeConversations,
        resolvedConversations,
        averageMessages: Math.round(averageMessages?.avg || 0),
      };
    } catch (error) {
      this.logger.error('Lỗi khi lấy conversation stats:', error);
      throw new HttpException(
        'Lấy conversation stats thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Format conversation response
   */
  formatConversationResponse(conversation: Conversation): any {
    return {
      ...conversation,
      startedAt: formatDateToISO(conversation.startedAt),
      endedAt: formatDateToISO(conversation.endedAt),
      lastMessageAt: formatDateToISO(conversation.lastMessageAt),
      resolvedAt: formatDateToISO(conversation.resolvedAt),
      createdAt: formatDateToISO(conversation.createdAt),
      updatedAt: formatDateToISO(conversation.updatedAt),
    };
  }
}
