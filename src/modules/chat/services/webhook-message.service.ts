import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../entities/message.entity';
import { Conversation } from '../entities/conversation.entity';
import { Customer } from '../../users/entities/customer.entity';
import { CustomerService } from './customer.service';
import { ConversationService } from './conversation.service';
import { MockAIAgentService } from './mock-ai-agent.service';
import { ISocketCacheService } from '../interfaces/socket-cache.interface';
import { ChatGateway } from '../gateways/chat.gateway';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import {
  SenderType as EntitySenderType,
  MessageStatus as EntityMessageStatus,
} from '../types/enums';
import { ReceiveMessagePayload } from '../interfaces/socket-events.interface';

interface FacebookMessageData {
  messageId: string;
  content: string;
  customerInfo: {
    facebookId: string;
    facebookName: string;
    avatarUrl?: string;
    profileUrl?: string;
  };
  timestamp: Date;
}

@Injectable()
export class WebhookMessageService {
  private readonly logger = new Logger(WebhookMessageService.name);

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    private readonly customerService: CustomerService,
    private readonly conversationService: ConversationService,
    private readonly aiAgentService: MockAIAgentService,
    @Inject('ISocketCacheService')
    private readonly socketCacheService: ISocketCacheService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  /**
   * Xử lý tin nhắn từ Facebook webhook theo flow yêu cầu
   */
  async processIncomingMessage(messageData: FacebookMessageData): Promise<{
    success: boolean;
    messageId?: string;
    conversationId?: string;
    customerId?: string;
    assignedUserId?: string;
    botResponseMessageId?: string;
    autoResponse?: boolean;
    confidence?: number;
    error?: string;
  }> {
    try {
      this.logger.log(
        `🔄 Processing Facebook message: ${messageData.messageId}`,
      );

      // Step 1: Tìm hoặc tạo customer
      const customer = await this.findOrCreateCustomer(
        messageData.customerInfo,
      );
      this.logger.log(`👤 Customer resolved: ${customer.id}`);

      // Step 2: Gọi AI agent để phân tích tin nhắn
      const aiAnalysis = await this.aiAgentService.analyzeMessage({
        question: messageData.content,
        api_key: this.aiAgentService.getDefaultApiKey(),
        model_name: this.aiAgentService.getDefaultModelName(),
      });

      // Log full AI analysis
      this.logger.log(
        `🤖 AI Analysis Full Result:`,
        JSON.stringify(aiAnalysis, null, 2),
      );
      this.logger.log(
        `🤖 AI Analysis completed: ${aiAnalysis.main_topic}, confidence: ${(
          aiAnalysis.confidence * 100
        ).toFixed(1)}%`,
      );

      // Step 3: Tạo conversation và lưu message từ customer trước
      const onlineUserIds = await this.socketCacheService.getAllUserIds();
      const assignedUserId = this.selectBestUser(onlineUserIds);

      let conversation: Conversation;
      if (assignedUserId) {
        // Có user online - tạo conversation với assignment
        conversation = await this.findOrCreateConversation(
          customer.id,
          assignedUserId,
        );
      } else {
        // Không có user online - tạo conversation không assignment
        conversation = await this.conversationService.findOrCreateConversation(
          customer.id,
        );
      }
      this.logger.log(`💬 Conversation resolved: ${conversation.id}`);

      // Step 4: Lưu message từ customer
      const customerMessage = await this.createCustomerMessage(
        messageData,
        conversation.id,
        customer.id,
      );
      this.logger.log(`✉️ Customer message created: ${customerMessage.id}`);

      // Step 5: Kiểm tra confidence để quyết định flow xử lý
      if (aiAnalysis.confidence >= 0.9) {
        this.logger.log(
          `🎯 High confidence (${(aiAnalysis.confidence * 100).toFixed(
            1,
          )}%) - Auto responding to Facebook`,
        );

        // Cập nhật customer với thông tin từ AI
        await this.updateCustomerWithAIAnalysis(customer.id, aiAnalysis);

        // Tạo bot response message
        const botMessage = await this.createBotResponseMessage(
          conversation.id,
          customer.id,
          aiAnalysis,
          customerMessage.id,
        );
        this.logger.log(`🤖 Bot response message created: ${botMessage.id}`);

        // Gửi auto response về Facebook
        await this.returnToFacebook({
          facebookId: messageData.customerInfo.facebookId,
          content: aiAnalysis.answer,
        });

        return {
          success: true,
          messageId: customerMessage.id,
          conversationId: conversation.id,
          customerId: customer.id,
          botResponseMessageId: botMessage.id,
          autoResponse: true,
          confidence: aiAnalysis.confidence,
        };
      }

      this.logger.log(
        `⚠️ Low confidence (${(aiAnalysis.confidence * 100).toFixed(
          1,
        )}%) - Routing to human reviewer`,
      );

      // Step 6: Cập nhật customer với thông tin từ AI (cho flow thường)
      await this.updateCustomerWithAIAnalysis(customer.id, aiAnalysis);

      if (!assignedUserId) {
        this.logger.warn('⚠️ No online users available for assignment');
        // Lưu AI response message để reviewer sau này có thể xem
        const aiResponseMessage = await this.createAIResponseMessage(
          conversation.id,
          customer.id,
          aiAnalysis,
          customerMessage.id,
        );
        this.logger.log(
          `🤖 AI response message created for later review: ${aiResponseMessage.id}`,
        );

        return {
          success: true,
          messageId: customerMessage.id,
          conversationId: conversation.id,
          customerId: customer.id,
          botResponseMessageId: aiResponseMessage.id,
          autoResponse: false,
          confidence: aiAnalysis.confidence,
          error: 'No online users available',
        };
      }
      this.logger.log(`👨‍💼 Assigned user: ${assignedUserId}`);

      // Step 7: Lưu AI response message trước khi gửi cho reviewer
      const aiResponseMessage = await this.createAIResponseMessage(
        conversation.id,
        customer.id,
        aiAnalysis,
        customerMessage.id,
      );
      this.logger.log(
        `🤖 AI response message created: ${aiResponseMessage.id}`,
      );

      // Step 8: Gửi socket event đến user với AI response
      await this.sendSocketEventToUser(
        assignedUserId,
        customerMessage,
        conversation,
        customer,
        aiAnalysis,
      );
      this.logger.log(`📡 Socket event sent to user: ${assignedUserId}`);

      return {
        success: true,
        messageId: customerMessage.id,
        conversationId: conversation.id,
        customerId: customer.id,
        assignedUserId,
        botResponseMessageId: aiResponseMessage.id,
        autoResponse: false,
        confidence: aiAnalysis.confidence,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error processing message ${messageData.messageId}:`,
        error,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Tìm hoặc tạo customer từ Facebook info
   */
  private async findOrCreateCustomer(
    customerInfo: FacebookMessageData['customerInfo'],
  ): Promise<Customer> {
    const createCustomerDto: CreateCustomerDto = {
      facebookId: customerInfo.facebookId,
      facebookName: customerInfo.facebookName,
      facebookAvatarUrl: customerInfo.avatarUrl,
      facebookProfileUrl: customerInfo.profileUrl,
    };

    return await this.customerService.findOrCreateCustomer(createCustomerDto);
  }

  /**
   * Cập nhật customer với thông tin từ AI analysis
   */
  private async updateCustomerWithAIAnalysis(
    customerId: string,
    aiAnalysis: any,
  ): Promise<void> {
    try {
      await this.customerService.updateCustomerAnalysis(customerId, {
        customerType: aiAnalysis.customer_type,
        intentAnalysis: {
          mainTopic: aiAnalysis.main_topic,
          keyInformation: aiAnalysis.key_information,
          clarifiedQuery: aiAnalysis.clarified_query,
          confidence: aiAnalysis.confidence,
        },
      });
    } catch (error) {
      this.logger.error(`Error updating customer AI analysis:`, error);
      // Non-blocking error, continue processing
    }
  }

  /**
   * Chọn user tốt nhất để assign (có thể implement logic phức tạp hơn)
   */
  private selectBestUser(onlineUserIds: string[]): string | null {
    if (onlineUserIds.length === 0) {
      return null;
    }

    // Simple: chọn user đầu tiên
    // Có thể implement logic phức tạp hơn như:
    // - Load balancing
    // - Expertise matching
    // - Availability check
    return onlineUserIds[0];
  }

  /**
   * Tìm hoặc tạo conversation giữa customer và user
   */
  private async findOrCreateConversation(
    customerId: string,
    assignedUserId: string,
  ): Promise<Conversation> {
    try {
      // Tìm conversation active của customer
      let conversation = await this.conversationRepository.findOne({
        where: {
          customerId,
          assignedReviewerId: assignedUserId,
          caseResolved: false,
        },
        order: { createdAt: 'DESC' },
      });

      if (!conversation) {
        // Tạo conversation mới
        conversation = await this.conversationService.findOrCreateConversation(
          customerId,
        );

        // Assign user đến conversation
        await this.conversationService.assignReviewer(
          conversation.id,
          assignedUserId,
        );

        // Reload để có assignedReviewerId
        conversation = await this.conversationRepository.findOne({
          where: { id: conversation.id },
          relations: ['customer', 'assignedReviewer'],
        });
      }

      return conversation;
    } catch (error) {
      this.logger.error('Error finding or creating conversation:', error);
      throw error;
    }
  }

  /**
   * Tạo message từ customer
   */
  private async createCustomerMessage(
    messageData: FacebookMessageData,
    conversationId: string,
    customerId: string,
  ): Promise<Message> {
    try {
      const message = this.messageRepository.create({
        conversationId,
        customerId,
        senderId: null, // Customer messages không cần senderId vì senderType = CUSTOMER
        senderType: EntitySenderType.CUSTOMER,
        content: messageData.content,
        status: EntityMessageStatus.RECEIVED,
        facebookMessageId: messageData.messageId,
        processedAt: new Date(),
        retryCount: 0,
        maxRetries: 3,
      });

      const savedMessage = await this.messageRepository.save(message);

      // Cập nhật conversation stats
      await this.conversationRepository.increment(
        { id: conversationId },
        'totalMessages',
        1,
      );

      // Cập nhật customer stats
      await this.customerService.incrementStats(customerId, false);

      this.logger.log(`💬 Customer message saved: ${savedMessage.id}`);
      return savedMessage;
    } catch (error) {
      this.logger.error('Error creating customer message:', error);
      throw error;
    }
  }

  /**
   * Tạo bot response message (cho auto-response flow)
   */
  private async createBotResponseMessage(
    conversationId: string,
    customerId: string,
    aiAnalysis: any,
    replyToMessageId: string,
  ): Promise<Message> {
    try {
      const message = this.messageRepository.create({
        conversationId,
        customerId,
        senderId: null, // Bot responses không cần senderId
        senderType: EntitySenderType.BOT,
        content: aiAnalysis.answer,
        autoResponse: aiAnalysis.answer,
        confidenceScore: aiAnalysis.confidence,
        status: EntityMessageStatus.AI_AGENT_DONE_AUTO,
        processedAt: new Date(),
        respondedAt: new Date(),
        retryCount: 0,
        maxRetries: 0, // Bot responses không retry
      });

      const savedMessage = await this.messageRepository.save(message);

      // Cập nhật conversation stats (auto message)
      await this.conversationRepository.increment(
        { id: conversationId },
        'autoMessages',
        1,
      );
      await this.conversationRepository.increment(
        { id: conversationId },
        'totalMessages',
        1,
      );

      this.logger.log(`🤖 Bot response message saved: ${savedMessage.id}`);
      return savedMessage;
    } catch (error) {
      this.logger.error('Error creating bot response message:', error);
      throw error;
    }
  }

  /**
   * Tạo AI response message (để reviewer xem và chỉnh sửa)
   */
  private async createAIResponseMessage(
    conversationId: string,
    customerId: string,
    aiAnalysis: any,
    replyToMessageId: string,
  ): Promise<Message> {
    try {
      const message = this.messageRepository.create({
        conversationId,
        customerId,
        senderId: null, // AI suggestions không cần senderId
        senderType: EntitySenderType.BOT,
        content: `[AI Suggestion] ${aiAnalysis.answer}`,
        autoResponse: aiAnalysis.answer,
        confidenceScore: aiAnalysis.confidence,
        status: EntityMessageStatus.AI_AGENT_DONE_NEED_MANUAL,
        processedAt: new Date(),
        retryCount: 0,
        maxRetries: 0,
      });

      const savedMessage = await this.messageRepository.save(message);

      // Cập nhật conversation stats
      await this.conversationRepository.increment(
        { id: conversationId },
        'totalMessages',
        1,
      );

      this.logger.log(`🔮 AI suggestion message saved: ${savedMessage.id}`);
      return savedMessage;
    } catch (error) {
      this.logger.error('Error creating AI response message:', error);
      throw error;
    }
  }

  /**
   * Gửi socket event đến user được assign
   */
  private async sendSocketEventToUser(
    userId: string,
    message: Message,
    conversation: Conversation,
    customer: Customer,
    aiAnalysis: any,
  ): Promise<void> {
    try {
      const socketPayload: ReceiveMessagePayload = {
        messageId: message.id,
        conversationId: conversation.id,
        customerId: customer.id,
        senderType: 'customer',
        content: message.content,
        autoResponse: aiAnalysis.answer,
        confidence: aiAnalysis.confidence,
        customerInfo: {
          id: customer.id,
          facebookName: customer.facebookName || 'Unknown',
          customerType: customer.customerType || 'individual',
          facebookAvatarUrl: customer.facebookAvatarUrl,
        },
        createdAt: new Date().toISOString(),
      };

      // Gửi event thông qua ChatGateway
      const success = await this.chatGateway.sendMessageToReviewer(
        userId,
        socketPayload,
      );

      if (!success) {
        this.logger.warn(`Failed to send socket event to user ${userId}`);
      }
    } catch (error) {
      this.logger.error('Error sending socket event:', error);
      // Non-blocking error
    }
  }

  /**
   * Tạo message từ reviewer
   */
  async createReviewerMessage(
    conversationId: string,
    customerId: string,
    reviewerId: string,
    content: string,
  ): Promise<Message> {
    try {
      const message = this.messageRepository.create({
        conversationId,
        customerId,
        senderId: reviewerId, // Reviewer messages có senderId
        senderType: EntitySenderType.REVIEWER,
        content,
        status: EntityMessageStatus.RECEIVED,
        processedAt: new Date(),
        respondedAt: new Date(),
        retryCount: 0,
        maxRetries: 0,
      });

      const savedMessage = await this.messageRepository.save(message);

      // Cập nhật conversation stats (manual message)
      await this.conversationRepository.increment(
        { id: conversationId },
        'manualMessages',
        1,
      );
      await this.conversationRepository.increment(
        { id: conversationId },
        'totalMessages',
        1,
      );

      // Cập nhật lastMessageAt
      await this.conversationRepository.update(conversationId, {
        lastMessageAt: new Date(),
      });

      this.logger.log(`👨‍💼 Reviewer message saved: ${savedMessage.id}`);
      return savedMessage;
    } catch (error) {
      this.logger.error('Error creating reviewer message:', error);
      throw error;
    }
  }

  /**
   * Public method để gửi tin nhắn về Facebook (cho ChatGateway)
   */
  async sendToFacebook(data: {
    facebookId: string;
    content: string;
  }): Promise<void> {
    return this.returnToFacebook(data);
  }

  /**
   * Mock hàm gửi auto response về Facebook (để rỗng theo yêu cầu)
   */
  private async returnToFacebook(data: {
    facebookId: string;
    content: string;
  }): Promise<void> {
    try {
      this.logger.log(`📤 Mock sending message to Facebook:`, {
        facebookId: data.facebookId,
        content: data.content,
      });

      // TODO: Implement actual Facebook API call
      this.logger.log(`************************************************`);
      this.logger.log(
        `✅ Message sent to Facebook for user: ${data.facebookId}`,
      );
    } catch (error) {
      this.logger.error('Error sending response to Facebook:', error);
      // Non-blocking error
    }
  }
}
