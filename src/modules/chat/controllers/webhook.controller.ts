import {
  Body,
  Controller,
  Post,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FacebookWebhookPayloadDto } from '../dto/facebook-webhook.dto';
import { ReviewerSessionService } from '../services/reviewer-session.service';
import { WebhookMessageService } from '../services/webhook-message.service';
import { HttpResponse, BaseResponse } from '../../../types/http-response';

@ApiTags('Webhook')
@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly reviewerSessionService: ReviewerSessionService,
    private readonly webhookMessageService: WebhookMessageService,
  ) {}

  @ApiOperation({ summary: 'New Facebook message' })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
  })
  @Post('facebook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() webhookData: FacebookWebhookPayloadDto,
  ): Promise<string> {
    try {
      this.logger.log(
        '📨 Received Facebook webhook:',
        JSON.stringify(webhookData, null, 2),
      );

      // Xử lý bất đồng bộ theo flow yêu cầu
      this.processWebhookAsync(webhookData).catch((error) => {
        this.logger.error('❌ Async webhook processing failed:', error);
      });

      // Trả về 200 ngay lập tức cho Facebook
      return 'EVENT_RECEIVED';
    } catch (error) {
      this.logger.error('Error processing Facebook webhook:', error);
      throw error;
    }
  }

  /**
   * Xử lý webhook bất đồng bộ theo flow yêu cầu:
   * 1. Lấy facebookId của customer
   * 2. Tìm/tạo customer trong DB
   * 3. Gọi AI agent để phân tích
   * 4. Tìm user online
   * 5. Tìm/tạo conversation
   * 6. Tạo message
   * 7. Gửi socket event
   */
  private async processWebhookAsync(
    webhookData: FacebookWebhookPayloadDto,
  ): Promise<void> {
    try {
      this.logger.log(
        `🔄 Starting async processing for message: ${webhookData.messageId}`,
      );

      // Extract message data from webhook
      const messageData = {
        messageId: webhookData.messageId,
        content: webhookData.content,
        customerInfo: {
          facebookId: webhookData.customerInfo.facebookId,
          facebookName: webhookData.customerInfo.facebookName,
          avatarUrl: webhookData.customerInfo.avatarUrl,
          profileUrl: webhookData.customerInfo.profileUrl,
        },
        timestamp: new Date(),
      };

      // Xử lý qua WebhookMessageService
      const result = await this.webhookMessageService.processIncomingMessage(
        messageData,
      );

      if (result.success) {
        this.logger.log(
          `✅ Successfully processed message ${webhookData.messageId}:`,
          `Customer: ${result.customerId}, Conversation: ${result.conversationId}, User: ${result.assignedUserId}`,
        );
      } else {
        this.logger.error(
          `❌ Failed to process message ${webhookData.messageId}: ${result.error}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `💥 Critical error in async webhook processing for ${webhookData.messageId}:`,
        error,
      );
    }
  }
}
