import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ReviewerSessionService } from '../services/reviewer-session.service';
import {
  ConnectSocketPayload,
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

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly reviewerSessionService: ReviewerSessionService,
  ) {}

  /**
   * Xử lý khi client kết nối
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      this.logger.log(`Client attempting to connect: ${client.id}`);

      // Validate JWT token từ handshake
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`No token provided by client ${client.id}`);
        client.emit('auth_error', { error: 'No token provided' });
        client.disconnect();
        return;
      }

      const user = await this.validateToken(token);
      if (!user) {
        this.logger.warn(`Invalid token from client ${client.id}`);
        client.emit('auth_error', { error: 'Invalid token' });
        client.disconnect();
        return;
      }

      // Kiểm tra quyền chat
      if (!this.hasPermission(user, 'chat')) {
        this.logger.warn(`User ${user.id} không có quyền chat`);
        client.emit('auth_error', { error: 'Không có quyền truy cập chat' });
        client.disconnect();
        return;
      }

      // Lưu thông tin user vào socket
      client.data.userId = user.id;
      client.data.user = user;

      // Lưu session vào Redis
      await this.reviewerSessionService.saveSession(user.id, client.id);

      // Join user vào room riêng để nhận messages
      await client.join(`user_${user.id}`);

      // Emit connection success
      client.emit('connected', {
        success: true,
        userId: user.id,
        socketId: client.id,
        message: 'Kết nối thành công',
      });

      // Broadcast online reviewers update
      await this.broadcastOnlineReviewers();

      this.logger.log(
        `Reviewer ${user.username} connected successfully: ${client.id}`,
      );
    } catch (error) {
      this.logger.error(`Connection error for client ${client.id}:`, error);
      client.emit('connection_error', { error: 'Connection failed' });
      client.disconnect();
    }
  }

  /**
   * Xử lý khi client ngắt kết nối
   */
  async handleDisconnect(client: Socket): Promise<void> {
    try {
      const userId = client.data?.userId;
      const username = client.data?.user?.username;

      if (userId) {
        // Xóa session khỏi Redis
        await this.reviewerSessionService.removeSession(userId);

        // Leave rooms
        await client.leave(`user_${userId}`);

        // Broadcast online reviewers update
        await this.broadcastOnlineReviewers();

        this.logger.log(
          `Reviewer ${username} (${userId}) disconnected: ${client.id}`,
        );
      } else {
        this.logger.log(`Anonymous client disconnected: ${client.id}`);
      }
    } catch (error) {
      this.logger.error(`Disconnect error for client ${client.id}:`, error);
    }
  }

  /**
   * Xử lý sự kiện gửi tin nhắn từ reviewer
   */
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessagePayload,
  ): Promise<void> {
    try {
      const userId = client.data.userId;
      const user = client.data.user;

      if (!userId || !user) {
        const error: SocketErrorPayload = {
          event: 'send_message',
          error: 'User not authenticated',
          timestamp: new Date().toISOString(),
        };
        client.emit('error', error);
        return;
      }

      // Validate payload
      if (!payload.conversationId || !payload.content) {
        const error: SocketErrorPayload = {
          event: 'send_message',
          error: 'Thiếu thông tin cần thiết: conversationId và content',
          timestamp: new Date().toISOString(),
        };
        client.emit('error', error);
        return;
      }

      // Cập nhật activity
      await this.reviewerSessionService.updateActivity(userId);

      // Emit typing stopped
      await this.handleTypingStop(client, {
        conversationId: payload.conversationId,
        isTyping: false,
        reviewerId: userId,
      });

      // TODO: Process message through MessageService
      // Ở đây sẽ gọi đến MessageService để xử lý tin nhắn
      // const result = await this.messageService.processReviewerMessage({
      //   conversationId: payload.conversationId,
      //   senderId: userId,
      //   content: payload.content,
      //   messageType: payload.messageType || 'text',
      // });

      // Mock response cho giờ
      const mockMessageId = `msg_${Date.now()}`;

      // Emit acknowledgment
      const ack: MessageSentPayload = {
        success: true,
        conversationId: payload.conversationId,
        messageId: mockMessageId,
      };
      client.emit('message_sent', ack);

      this.logger.log(
        `Message sent by reviewer ${user.username} in conversation ${payload.conversationId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling send_message from ${client.id}:`,
        error,
      );

      const errorPayload: SocketErrorPayload = {
        event: 'send_message',
        error: error.message || 'Gửi tin nhắn thất bại',
        timestamp: new Date().toISOString(),
      };
      client.emit('error', errorPayload);
    }
  }

  /**
   * Xử lý typing indicator
   */
  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TypingPayload,
  ): Promise<void> {
    try {
      const userId = client.data.userId;

      if (!userId || !payload.conversationId) {
        return;
      }

      // Cập nhật activity
      await this.reviewerSessionService.updateActivity(userId);

      // Broadcast typing status to conversation room
      this.server
        .to(`conversation_${payload.conversationId}`)
        .emit('user_typing', {
          conversationId: payload.conversationId,
          reviewerId: userId,
          reviewerName:
            client.data.user?.fullName || client.data.user?.username,
          isTyping: payload.isTyping,
          timestamp: new Date().toISOString(),
        });
    } catch (error) {
      this.logger.error(`Error handling typing from ${client.id}:`, error);
    }
  }

  /**
   * Xử lý typing stop
   */
  @SubscribeMessage('typing_stop')
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TypingPayload,
  ): Promise<void> {
    try {
      const userId = client.data.userId;

      if (!userId || !payload.conversationId) {
        return;
      }

      // Broadcast typing stopped to conversation room
      this.server
        .to(`conversation_${payload.conversationId}`)
        .emit('user_typing', {
          conversationId: payload.conversationId,
          reviewerId: userId,
          reviewerName:
            client.data.user?.fullName || client.data.user?.username,
          isTyping: false,
          timestamp: new Date().toISOString(),
        });
    } catch (error) {
      this.logger.error(`Error handling typing_stop from ${client.id}:`, error);
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
      const isOnline = await this.reviewerSessionService.isReviewerOnline(
        reviewerId,
      );

      if (!isOnline) {
        this.logger.warn(
          `Reviewer ${reviewerId} is not online, cannot send message`,
        );
        return false;
      }

      // Gửi đến room của reviewer
      this.server.to(`user_${reviewerId}`).emit('receive_message', message);

      // Join reviewer vào conversation room để nhận typing events
      const socketId = await this.reviewerSessionService.getSocketId(
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
      const onlineSocketIds =
        await this.reviewerSessionService.getAllOnlineSocketIds();

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
      const sessions =
        await this.reviewerSessionService.getOnlineReviewersDetails();

      // TODO: Get user details from UserService
      // Tạm thời mock data
      const reviewers = sessions.map((session) => ({
        id: session.userId,
        username: `user_${session.userId}`,
        fullName: `User ${session.userId}`,
        isOnline: session.isOnline,
        connectedAt: session.connectedAt,
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
   * Validate JWT token
   */
  private async validateToken(token: string): Promise<any> {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get('JWT_SECRET'),
      });

      // TODO: Get full user info from UserService
      return {
        id: payload.sub,
        username: payload.username,
        permissions: payload.permissions,
      };
    } catch (error) {
      this.logger.error('Token validation failed:', error);
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
    return await this.reviewerSessionService.getOnlineReviewersCount();
  }

  /**
   * Kiểm tra reviewer có online không
   */
  async isReviewerOnline(reviewerId: string): Promise<boolean> {
    return await this.reviewerSessionService.isReviewerOnline(reviewerId);
  }

  /**
   * Cleanup expired sessions định kỳ
   */
  async cleanupExpiredSessions(): Promise<void> {
    await this.reviewerSessionService.cleanupExpiredSessions();
  }
}
