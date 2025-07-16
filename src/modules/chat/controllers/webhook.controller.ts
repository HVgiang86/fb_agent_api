import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Get,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiBody,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { HttpResponse, BaseResponse } from '../../../types/http-response';
import { FacebookWebhookPayloadDto } from '../dto/facebook-webhook.dto';
import { MessageProcessingService } from '../services/message-processing.service';

@ApiTags('Webhook')
@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly messageProcessingService: MessageProcessingService,
  ) {}

  @ApiOperation({
    summary: 'Nhận tin nhắn từ Facebook webhook',
    description:
      'Webhook endpoint để nhận tin nhắn mới từ Facebook. Endpoint này xử lý tin nhắn và chuyển tiếp đến AI Agent hoặc reviewer.',
  })
  @ApiBody({
    type: FacebookWebhookPayloadDto,
    description: 'Payload tin nhắn từ Facebook webhook',
  })
  @ApiResponse({
    status: 200,
    description: 'Tin nhắn đã được nhận và xử lý thành công',
    schema: {
      example: {
        statusCode: 200,
        message: 'Tin nhắn đã được nhận thành công',
        data: {
          messageId: 'fb_msg_123456789',
          conversationId: 'conv_uuid',
          customerId: 'customer_uuid',
          status: 'received',
          processedAt: '2024-01-01T10:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ',
    schema: {
      example: {
        statusCode: 400,
        message: 'Dữ liệu tin nhắn không hợp lệ',
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Lỗi server internal',
    schema: {
      example: {
        statusCode: 500,
        message: 'Xử lý tin nhắn thất bại',
      },
    },
  })
  @Post('facebook/message')
  @HttpCode(200)
  async receiveMessage(
    @Body() payload: FacebookWebhookPayloadDto,
  ): Promise<BaseResponse> {
    try {
      this.logger.log(`Received webhook from Facebook: ${payload.messageId}`);

      // 1. Validate payload
      this.validatePayload(payload);

      // 2. Process message
      const result = await this.messageProcessingService.processIncomingMessage(
        payload,
      );

      this.logger.log(`Successfully processed message ${payload.messageId}`);

      return HttpResponse.success(
        {
          messageId: payload.messageId,
          conversationId: result.conversationId,
          customerId: result.customerId,
          status: 'received',
          processedAt: new Date().toISOString(),
        },
        'Tin nhắn đã được nhận thành công',
      );
    } catch (error) {
      this.logger.error(
        `Webhook processing failed for message ${payload?.messageId}:`,
        error,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Xử lý tin nhắn thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiOperation({
    summary: 'Webhook verification cho Facebook',
    description:
      'Endpoint để Facebook verify webhook subscription theo Facebook webhook verification protocol',
  })
  @ApiBody({
    description: 'Verification payload từ Facebook',
    schema: {
      type: 'object',
      properties: {
        hub_mode: {
          type: 'string',
          example: 'subscribe',
        },
        hub_verify_token: {
          type: 'string',
          example: 'your_verify_token',
        },
        hub_challenge: {
          type: 'string',
          example: '1158201444',
        },
      },
    },
  })

  /**
   * Validate webhook payload
   */
  private validatePayload(payload: FacebookWebhookPayloadDto): void {
    if (!payload.messageId) {
      throw new HttpException('messageId is required', HttpStatus.BAD_REQUEST);
    }

    if (!payload.content) {
      throw new HttpException('content is required', HttpStatus.BAD_REQUEST);
    }

    if (!payload.customerInfo?.facebookId) {
      throw new HttpException(
        'customerInfo.facebookId is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate timestamp format
    if (payload.timestamp) {
      const timestamp = new Date(payload.timestamp);
      if (isNaN(timestamp.getTime())) {
        throw new HttpException(
          'Invalid timestamp format',
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }
}
