import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../entities/message.entity';
import { Conversation } from '../entities/conversation.entity';
import { formatDateToISO } from '../../../utils/date-formatter';
import { MessageStatus, SenderType } from '../types/enums';

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
  ) {}

  /**
   * Lấy messages theo conversationId với pagination
   */
  async getMessagesByConversationId(
    conversationId: string,
    params: {
      page?: number;
      limit?: number;
      userId?: string; // ID của user để kiểm tra quyền truy cập
    } = {},
  ) {
    try {
      const { page = 1, limit = 50, userId } = params;
      const skip = (page - 1) * limit;

      // Kiểm tra conversation tồn tại và quyền truy cập
      const conversation = await this.conversationRepository.findOne({
        where: { id: conversationId },
        relations: ['customer', 'assignedReviewer'],
      });

      if (!conversation) {
        throw new HttpException(
          'Conversation không tồn tại',
          HttpStatus.NOT_FOUND,
        );
      }

      // Kiểm tra quyền truy cập - chỉ assignedReviewer mới được xem
      if (userId && conversation.assignedReviewerId !== userId) {
        throw new HttpException(
          'Bạn không có quyền truy cập conversation này',
          HttpStatus.FORBIDDEN,
        );
      }

      // Lấy messages với pagination
      const [messages, total] = await this.messageRepository
        .createQueryBuilder('message')
        .leftJoinAndSelect('message.sender', 'sender')
        .where('message.conversationId = :conversationId', { conversationId })
        .orderBy('message.createdAt', 'ASC')
        .skip(skip)
        .take(limit)
        .getManyAndCount();

      const formattedMessages = messages.map((message) =>
        this.formatMessageResponse(message),
      );

      return {
        messages: formattedMessages,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        conversation: {
          id: conversation.id,
          customerId: conversation.customerId,
          status: conversation.status,
          totalMessages: conversation.totalMessages,
          customer: conversation.customer
            ? {
                id: conversation.customer.id,
                facebookName: conversation.customer.facebookName,
                customerType: conversation.customer.customerType,
              }
            : null,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        `Lỗi khi lấy messages của conversation ${conversationId}:`,
        error,
      );
      throw new HttpException(
        'Lấy messages thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Lấy message theo ID với kiểm tra quyền
   */
  async getMessageById(messageId: string, userId?: string): Promise<Message> {
    try {
      const message = await this.messageRepository
        .createQueryBuilder('message')
        .leftJoinAndSelect('message.sender', 'sender')
        .leftJoinAndSelect('message.conversation', 'conversation')
        .leftJoinAndSelect('conversation.assignedReviewer', 'assignedReviewer')
        .where('message.id = :messageId', { messageId })
        .getOne();

      if (!message) {
        throw new HttpException('Message không tồn tại', HttpStatus.NOT_FOUND);
      }

      // Kiểm tra quyền truy cập
      if (userId && message.conversation?.assignedReviewerId !== userId) {
        throw new HttpException(
          'Bạn không có quyền truy cập message này',
          HttpStatus.FORBIDDEN,
        );
      }

      return message;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Lỗi khi lấy message ${messageId}:`, error);
      throw new HttpException(
        'Lấy message thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Lấy messages chưa đọc của conversation
   */
  async getUnreadMessages(conversationId: string, userId?: string) {
    try {
      // Kiểm tra quyền truy cập conversation
      const conversation = await this.conversationRepository.findOne({
        where: { id: conversationId },
      });

      if (!conversation) {
        throw new HttpException(
          'Conversation không tồn tại',
          HttpStatus.NOT_FOUND,
        );
      }

      if (userId && conversation.assignedReviewerId !== userId) {
        throw new HttpException(
          'Bạn không có quyền truy cập conversation này',
          HttpStatus.FORBIDDEN,
        );
      }

      // Lấy messages mới từ customer chưa được reviewer đọc
      const unreadMessages = await this.messageRepository
        .createQueryBuilder('message')
        .where('message.conversationId = :conversationId', { conversationId })
        .andWhere('message.senderType = :senderType', {
          senderType: SenderType.CUSTOMER,
        })
        .andWhere('message.status IN (:...statuses)', {
          statuses: [
            MessageStatus.RECEIVED,
            MessageStatus.WAIT_AI_AGENT,
            MessageStatus.AI_AGENT_DONE_NEED_MANUAL,
            MessageStatus.SENT_TO_REVIEWER,
          ],
        })
        .orderBy('message.createdAt', 'DESC')
        .getMany();

      return {
        unreadCount: unreadMessages.length,
        messages: unreadMessages.map((message) =>
          this.formatMessageResponse(message),
        ),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        `Lỗi khi lấy unread messages của conversation ${conversationId}:`,
        error,
      );
      throw new HttpException(
        'Lấy unread messages thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Đánh dấu messages đã đọc
   */
  async markMessagesAsRead(
    conversationId: string,
    userId?: string,
  ): Promise<void> {
    try {
      // Kiểm tra quyền truy cập
      const conversation = await this.conversationRepository.findOne({
        where: { id: conversationId },
      });

      if (!conversation) {
        throw new HttpException(
          'Conversation không tồn tại',
          HttpStatus.NOT_FOUND,
        );
      }

      if (userId && conversation.assignedReviewerId !== userId) {
        throw new HttpException(
          'Bạn không có quyền truy cập conversation này',
          HttpStatus.FORBIDDEN,
        );
      }

      // Update status của messages từ customer thành đã đọc
      await this.messageRepository
        .createQueryBuilder()
        .update(Message)
        .set({
          status: MessageStatus.REVIEWER_REPLIED, // Tạm dùng status này để đánh dấu đã đọc
        })
        .where('conversationId = :conversationId', { conversationId })
        .andWhere('senderType = :senderType', {
          senderType: SenderType.CUSTOMER,
        })
        .andWhere('status = :status', {
          status: MessageStatus.SENT_TO_REVIEWER,
        })
        .execute();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        `Lỗi khi đánh dấu messages đã đọc conversation ${conversationId}:`,
        error,
      );
      throw new HttpException(
        'Đánh dấu messages đã đọc thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Format message response
   */
  formatMessageResponse(message: Message): any {
    return {
      id: message.id,
      conversationId: message.conversationId,
      customerId: message.customerId,
      senderId: message.senderId,
      senderType: message.senderType,
      content: message.content,
      autoResponse: message.autoResponse,
      confidenceScore: message.confidenceScore,
      status: message.status,
      facebookMessageId: message.facebookMessageId,
      createdAt: formatDateToISO(message.createdAt),
      updatedAt: formatDateToISO(message.updatedAt),
      processedAt: formatDateToISO(message.processedAt),
      respondedAt: formatDateToISO(message.respondedAt),
      sender: message.sender
        ? {
            id: message.sender.id,
            username: message.sender.username,
            fullName: message.sender.fullName,
          }
        : null,
    };
  }
}
