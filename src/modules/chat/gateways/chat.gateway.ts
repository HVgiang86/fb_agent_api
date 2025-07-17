import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReviewerSessionService } from '../services/reviewer-session.service';
import { ISocketCacheService } from '../interfaces/socket-cache.interface';
import { WebhookMessageService } from '../services/webhook-message.service';
import { ConversationService } from '../services/conversation.service';
import { CustomerService } from '../services/customer.service';
import {
  SendMessagePayload,
  ReceiveMessagePayload,
  MessageSentPayload,
  NotificationPayload,
  ConversationUpdatedPayload,
  TypingPayload,
  OnlineReviewersPayload,
  MessageStatusUpdatePayload,
  StatisticsUpdatePayload,
  SocketErrorPayload,
} from '../interfaces/socket-events.interface';
import { ConnectSocketDto } from '../dto/connect-socket.dto';
import { SendMessageDto } from '../dto/send-message.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly reviewerSessionService: ReviewerSessionService,
    @Inject('ISocketCacheService')
    private readonly socketCacheService: ISocketCacheService,
    @Inject(forwardRef(() => WebhookMessageService))
    private readonly webhookMessageService: WebhookMessageService,
    private readonly conversationService: ConversationService,
    private readonly customerService: CustomerService,
  ) {
    this.logger.log('🔧 ChatGateway constructor called');
  }

  /**
   * Xử lý khi client kết nối - mặc định không xử lý
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      console.log(`🔌 Client connected: ${client.id}`);
      this.logger.log(`Client connected: ${client.id}`);

      client.emit('notice', 'hello');
    } catch (error) {
      this.logger.error(`Connection error for client ${client.id}:`, error);
    }
  }

  /**
   * Xử lý khi client ngắt kết nối
   */
  async handleDisconnect(client: Socket): Promise<void> {
    try {
      console.log(`🔌 Client disconnecting: ${client.id}`);

      // Lấy userId từ socket cache
      const userId = await this.socketCacheService.getUserBySocketId(client.id);

      if (userId) {
        // Xóa mapping khỏi cache
        await this.socketCacheService.removeBySocketId(client.id);

        // Leave rooms
        await client.leave(`user_${userId}`);

        // Broadcast online reviewers update
        await this.broadcastOnlineReviewers();

        this.logger.log(`Socket ${userId} disconnected: ${client.id}`);
      } else {
        this.logger.log(`Socket disconnected: ${client.id}`);
      }
    } catch (error) {
      this.logger.error(`Disconnect error for client ${client.id}:`, error);
    }
  }

  /**
   * Xử lý event connect_socket từ client
   */
  @SubscribeMessage('connect_socket')
  async handleConnectSocket(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ConnectSocketDto | string,
  ): Promise<void> {
    try {
      this.logger.log('🔧 handleConnectSocket called');
      this.logger.log('🔧 payload', payload);
      this.logger.log('🔧 payload type:', typeof payload);

      // Parse payload nếu là string
      let parsedPayload: ConnectSocketDto;
      if (typeof payload === 'string') {
        try {
          parsedPayload = JSON.parse(payload);
          this.logger.log('🔧 parsed payload:', parsedPayload);
        } catch (parseError) {
          this.logger.error('🔧 JSON parse error:', parseError);
          const error: SocketErrorPayload = {
            event: 'connect_socket',
            error: 'Invalid JSON format in payload',
            timestamp: new Date().toISOString(),
          };
          client.emit('error', error);
          return;
        }
      } else {
        parsedPayload = payload;
      }

      const { user_id } = parsedPayload;

      if (!user_id) {
        const error: SocketErrorPayload = {
          event: 'connect_socket',
          error: 'user_id là bắt buộc',
          timestamp: new Date().toISOString(),
        };
        client.emit('error', error);
        return;
      }

      await client.join(`user_${user_id}`);

      client.emit('notice', 'connected');

      // Lưu mapping socketId - userId vào cache
      await this.socketCacheService.setSocketUser(client.id, user_id);

      // Lưu thông tin vào socket data
      client.data.userId = user_id;

      // Emit connection success
      client.emit('socket_connected', {
        success: true,
        socketId: client.id,
        userId: user_id,
        message: 'Socket đã được kết nối với user',
        timestamp: new Date().toISOString(),
      });

      // Broadcast online reviewers update
      await this.broadcastOnlineReviewers();

      this.logger.log(`Socket ${client.id} connected with user ${user_id}`);
    } catch (error) {
      this.logger.error(
        `Error handling connect_socket from ${client.id}:`,
        error,
      );

      const errorPayload: SocketErrorPayload = {
        event: 'connect_socket',
        error: error.message || 'Kết nối socket với user thất bại',
        timestamp: new Date().toISOString(),
      };
      client.emit('error', errorPayload);
    }
  }

  /**
   * Xử lý sự kiện gửi tin nhắn từ client
   */
  @SubscribeMessage('send_mess')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessageDto | string,
  ): Promise<void> {
    try {
      this.logger.log('🔧 handleSendMessage called');
      this.logger.log('🔧 payload', payload);
      this.logger.log('🔧 payload type:', typeof payload);

      // Parse payload nếu là string
      let parsedPayload: SendMessageDto;
      if (typeof payload === 'string') {
        try {
          parsedPayload = JSON.parse(payload);
          this.logger.log('🔧 parsed payload:', parsedPayload);
        } catch (parseError) {
          this.logger.error('🔧 JSON parse error:', parseError);
          const error: SocketErrorPayload = {
            event: 'send_mess',
            error: 'Invalid JSON format in payload',
            timestamp: new Date().toISOString(),
          };
          client.emit('error', error);
          return;
        }
      } else {
        parsedPayload = payload;
      }

      const { conversation_id, sender_id, content } = parsedPayload;

      // Validate payload
      if (!conversation_id || !sender_id || !content) {
        const error: SocketErrorPayload = {
          event: 'send_mess',
          error:
            'Thiếu thông tin cần thiết: conversation_id, sender_id, content',
          timestamp: new Date().toISOString(),
        };
        client.emit('error', error);
        return;
      }

      // Kiểm tra socket có được kết nối với user chưa
      const userId = await this.socketCacheService.getUserBySocketId(client.id);
      if (!userId) {
        const error: SocketErrorPayload = {
          event: 'send_mess',
          error:
            'Socket chưa được kết nối với user. Vui lòng gọi connect_socket trước',
          timestamp: new Date().toISOString(),
        };
        client.emit('error', error);
        return;
      }

      // Kiểm tra sender_id có trùng với userId đã connect không
      if (userId !== sender_id) {
        const error: SocketErrorPayload = {
          event: 'send_mess',
          error: 'sender_id không trùng với user đã connect',
          timestamp: new Date().toISOString(),
        };
        client.emit('error', error);
        return;
      }

      // Lấy conversation và customer info
      let conversation, customer, savedMessage;
      try {
        // Lấy conversation từ conversation_id
        conversation = await this.conversationService.getConversationById(
          conversation_id,
        );
        if (!conversation) {
          const error: SocketErrorPayload = {
            event: 'send_mess',
            error: 'Conversation không tồn tại',
            timestamp: new Date().toISOString(),
          };
          client.emit('error', error);
          return;
        }

        // Lấy customer từ customerId trong conversation
        customer = await this.customerService.getCustomerById(
          conversation.customerId,
        );
        if (!customer) {
          const error: SocketErrorPayload = {
            event: 'send_mess',
            error: 'Customer không tồn tại',
            timestamp: new Date().toISOString(),
          };
          client.emit('error', error);
          return;
        }

        // Lưu message từ reviewer vào database
        savedMessage = await this.webhookMessageService.createReviewerMessage(
          conversation_id,
          customer.id,
          sender_id,
          content,
        );

        this.logger.log(`💾 Reviewer message saved to DB: ${savedMessage.id}`);
      } catch (error) {
        this.logger.error('Error processing reviewer message:', error);
        const errorPayload: SocketErrorPayload = {
          event: 'send_mess',
          error: error.message || 'Xử lý tin nhắn thất bại',
          timestamp: new Date().toISOString(),
        };
        client.emit('error', errorPayload);
        return;
      }

      // Gửi tin nhắn về Facebook qua WebhookMessageService
      try {
        if (customer.facebookId) {
          await this.webhookMessageService.sendToFacebook({
            facebookId: customer.facebookId,
            content: content,
          });
          this.logger.log(
            `📤 Message sent to Facebook for customer: ${customer.facebookId}`,
          );
        } else {
          this.logger.warn(`Customer ${customer.id} không có facebookId`);
        }
      } catch (error) {
        this.logger.error('Error sending message to Facebook:', error);
        // Continue even if Facebook send fails
      }

      // Emit acknowledgment
      const ack: MessageSentPayload = {
        success: true,
        conversationId: conversation_id,
        messageId: savedMessage?.id || `msg_${Date.now()}`,
      };
      client.emit('message_sent', ack);

      // Broadcast message to conversation room
      this.server
        .to(`conversation_${conversation_id}`)
        .emit('receive_message', {
          messageId: savedMessage?.id || `msg_${Date.now()}`,
          conversationId: conversation_id,
          customerId: customer.id,
          senderType: 'reviewer' as const,
          content: content,
          customerInfo: {
            id: customer.id,
            facebookName: customer.facebookName || 'Unknown',
            customerType: customer.customerType || 'individual',
            facebookAvatarUrl: customer.facebookAvatarUrl,
          },
          createdAt: new Date().toISOString(),
        });

      this.logger.log(
        `✅ Message processed: ${sender_id} → ${customer.facebookId} in conversation ${conversation_id}`,
      );
    } catch (error) {
      this.logger.error(`Error handling send_mess from ${client.id}:`, error);

      const errorPayload: SocketErrorPayload = {
        event: 'send_mess',
        error: error.message || 'Gửi tin nhắn thất bại',
        timestamp: new Date().toISOString(),
      };
      client.emit('error', errorPayload);
    }
  }

  /**
   * Public methods để gửi events từ services khác
   */

  /**
   * Gửi tin nhắn mới đến reviewer
   */
  async sendMessageToReviewer(
    reviewerId: string,
    message: ReceiveMessagePayload,
  ): Promise<boolean> {
    try {
      const isOnline = await this.socketCacheService.isUserOnline(reviewerId);

      if (!isOnline) {
        this.logger.warn(
          `Reviewer ${reviewerId} is not online, cannot send message`,
        );
        return false;
      }

      // Gửi đến room của reviewer
      this.server.to(`user_${reviewerId}`).emit('receive_message', message);

      // Join reviewer vào conversation room để nhận typing events
      const socketId = await this.socketCacheService.getSocketIdByUserId(
        reviewerId,
      );
      if (socketId) {
        this.server.sockets.sockets
          .get(socketId)
          ?.join(`conversation_${message.conversationId}`);
      }

      this.logger.log(
        `Message sent to reviewer ${reviewerId} for conversation ${message.conversationId}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Error sending message to reviewer ${reviewerId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Broadcast thông báo đến tất cả reviewers
   */
  async broadcastNotification(
    notification: NotificationPayload,
  ): Promise<void> {
    try {
      const onlineSocketIds = await this.socketCacheService.getAllSocketIds();

      for (const socketId of onlineSocketIds) {
        this.server.to(socketId).emit('notification', notification);
      }

      this.logger.log(`Broadcasted notification: ${notification.title}`);
    } catch (error) {
      this.logger.error(`Error broadcasting notification:`, error);
    }
  }

  /**
   * Cập nhật trạng thái conversation
   */
  async updateConversationStatus(
    update: ConversationUpdatedPayload,
  ): Promise<void> {
    try {
      // Gửi đến conversation room
      this.server
        .to(`conversation_${update.conversationId}`)
        .emit('conversation_updated', update);

      // Nếu có assigned reviewer, gửi riêng cho họ
      if (update.assignedReviewerId) {
        this.server
          .to(`user_${update.assignedReviewerId}`)
          .emit('conversation_updated', update);
      }

      this.logger.log(
        `Conversation ${update.conversationId} status updated to ${update.status}`,
      );
    } catch (error) {
      this.logger.error(`Error updating conversation status:`, error);
    }
  }

  /**
   * Cập nhật trạng thái tin nhắn
   */
  async updateMessageStatus(update: MessageStatusUpdatePayload): Promise<void> {
    try {
      // Gửi đến conversation room
      this.server
        .to(`conversation_${update.conversationId}`)
        .emit('message_status_updated', update);

      this.logger.log(
        `Message ${update.messageId} status updated to ${update.status}`,
      );
    } catch (error) {
      this.logger.error(`Error updating message status:`, error);
    }
  }

  /**
   * Broadcast danh sách reviewers online
   */
  async broadcastOnlineReviewers(): Promise<void> {
    try {
      const onlineUserIds = await this.socketCacheService.getAllUserIds();

      // TODO: Get user details from UserService
      // Tạm thời mock data
      const reviewers = onlineUserIds.map((userId) => ({
        id: userId,
        username: `user_${userId}`,
        fullName: `User ${userId}`,
        isOnline: true,
        connectedAt: new Date().toISOString(),
      }));

      const payload: OnlineReviewersPayload = {
        reviewers,
      };

      this.server.emit('online_reviewers_updated', payload);
    } catch (error) {
      this.logger.error(`Error broadcasting online reviewers:`, error);
    }
  }

  /**
   * Broadcast thống kê real-time
   */
  async broadcastStatistics(stats: StatisticsUpdatePayload): Promise<void> {
    try {
      this.server.emit('statistics_updated', stats);
    } catch (error) {
      this.logger.error(`Error broadcasting statistics:`, error);
    }
  }

  /**
   * Private helper methods
   */

  /**
   * Lấy thông tin user (tạm thời mock data)
   */
  private async getUserInfo(userId: string): Promise<any> {
    try {
      // TODO: Integrate với UserService để lấy thông tin user thật
      // const user = await this.userService.findById(userId);

      // Mock user data cho giờ
      const mockUser = {
        id: userId,
        username: `user_${userId}`,
        fullName: `User ${userId}`,
        permissions: ['chat'], // Mock permission
      };

      return mockUser;
    } catch (error) {
      this.logger.error(`Error getting user info for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Kiểm tra quyền của user
   */
  private hasPermission(user: any, permission: string): boolean {
    return user.permissions && user.permissions.includes(permission);
  }

  /**
   * Lấy số lượng reviewers online
   */
  async getOnlineReviewersCount(): Promise<number> {
    const userIds = await this.socketCacheService.getAllUserIds();
    return userIds.length;
  }

  /**
   * Kiểm tra reviewer có online không
   */
  async isReviewerOnline(reviewerId: string): Promise<boolean> {
    return await this.socketCacheService.isUserOnline(reviewerId);
  }

  /**
   * Clear cache để testing
   */
  async clearCache(): Promise<void> {
    await this.socketCacheService.clear();
  }
}
