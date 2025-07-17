import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import JwtAuthenticationGuard from '../../auth/jwt-authentication.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { PermissionName } from '../../users/entities/permission.entity';
import RequestWithUser from '../../auth/intefaces/requestWithUser.interface';
import { HttpResponse, BaseResponse } from '../../../types/http-response';
import { ConversationService } from '../services/conversation.service';
import { MessageService } from '../services/message.service';
import { GetConversationsDto } from '../dto/get-conversations.dto';
import { ConversationStatus } from '../types/enums';

@ApiTags('Conversation')
@Controller('conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthenticationGuard, PermissionsGuard)
@Permissions(PermissionName.CHAT)
export class ConversationController {
  private readonly logger = new Logger(ConversationController.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService,
  ) {}

  @ApiOperation({
    summary: 'Lấy danh sách conversations của user',
    description:
      'Lấy tất cả conversations được gắn với user hiện tại với filter status',
  })
  @ApiQuery({
    name: 'status',
    description: 'Lọc theo trạng thái conversation (active hoặc deactive)',
    required: false,
    enum: ConversationStatus,
    example: ConversationStatus.ACTIVE,
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách conversations thành công',
    schema: {
      example: {
        statusCode: 200,
        message: 'Lấy danh sách conversations thành công',
        data: {
          conversations: [
            {
              id: 'uuid-string',
              customerId: 'customer-uuid',
              status: 'active',
              totalMessages: 5,
              autoMessages: 2,
              manualMessages: 3,
              startedAt: '2024-01-01T10:00:00.000Z',
              lastMessageAt: '2024-01-01T10:30:00.000Z',
              customer: {
                id: 'customer-uuid',
                facebookName: 'Nguyễn Văn A',
                customerType: 'individual',
              },
            },
          ],
          total: 1,
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Cần đăng nhập',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Không có quyền truy cập',
  })
  @Get()
  async getConversations(
    @Req() request: RequestWithUser,
    @Query() query: GetConversationsDto,
  ): Promise<BaseResponse> {
    try {
      const userId = request.user.id;

      const result = await this.conversationService.getConversationsByReviewer(
        userId,
        {
          status: query.status,
        },
      );

      return HttpResponse.success(
        result,
        'Lấy danh sách conversations thành công',
      );
    } catch (error) {
      this.logger.error('Lỗi khi lấy danh sách conversations:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Lấy danh sách conversations thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiOperation({
    summary: 'Lấy thông tin chi tiết conversation',
    description: 'Lấy thông tin chi tiết của một conversation theo ID',
  })
  @ApiParam({
    name: 'conversationId',
    description: 'UUID của conversation',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy thông tin conversation thành công',
    schema: {
      example: {
        statusCode: 200,
        message: 'Lấy thông tin conversation thành công',
        data: {
          id: 'uuid-string',
          customerId: 'customer-uuid',
          status: 'active',
          totalMessages: 5,
          autoMessages: 2,
          manualMessages: 3,
          startedAt: '2024-01-01T10:00:00.000Z',
          lastMessageAt: '2024-01-01T10:30:00.000Z',
          customer: {
            id: 'customer-uuid',
            facebookName: 'Nguyễn Văn A',
            customerType: 'individual',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Không có quyền truy cập conversation này',
  })
  @ApiResponse({
    status: 404,
    description: 'Conversation không tồn tại',
  })
  @Get(':conversationId')
  async getConversationById(
    @Param('conversationId') conversationId: string,
    @Req() request: RequestWithUser,
  ): Promise<BaseResponse> {
    try {
      const userId = request.user.id;
      const conversation = await this.conversationService.getConversationById(
        conversationId,
      );

      // Kiểm tra quyền truy cập - chỉ assignedReviewer mới được xem
      if (conversation.assignedReviewerId !== userId) {
        throw new HttpException(
          'Bạn không có quyền truy cập conversation này',
          HttpStatus.FORBIDDEN,
        );
      }

      const formattedConversation =
        this.conversationService.formatConversationResponse(conversation);

      return HttpResponse.success(
        formattedConversation,
        'Lấy thông tin conversation thành công',
      );
    } catch (error) {
      this.logger.error(`Lỗi khi lấy conversation ${conversationId}:`, error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Lấy thông tin conversation thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiOperation({
    summary: 'Lấy danh sách messages trong conversation',
    description: 'Lấy tất cả messages trong conversation với pagination',
  })
  @ApiParam({
    name: 'conversationId',
    description: 'UUID của conversation',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiQuery({
    name: 'page',
    description: 'Số trang (bắt đầu từ 1)',
    required: false,
    type: 'number',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Số lượng messages mỗi trang (tối đa 100)',
    required: false,
    type: 'number',
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách messages thành công',
    schema: {
      example: {
        statusCode: 200,
        message: 'Lấy danh sách messages thành công',
        data: {
          messages: [
            {
              id: 'message-uuid',
              conversationId: 'conversation-uuid',
              customerId: 'customer-uuid',
              senderType: 'customer',
              content: 'Tôi muốn hỏi về thẻ tín dụng',
              status: 'reviewer_replied',
              createdAt: '2024-01-01T10:00:00.000Z',
            },
          ],
          total: 10,
          page: 1,
          limit: 50,
          totalPages: 1,
          conversation: {
            id: 'conversation-uuid',
            customerId: 'customer-uuid',
            status: 'active',
            totalMessages: 10,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Không có quyền truy cập conversation này',
  })
  @ApiResponse({
    status: 404,
    description: 'Conversation không tồn tại',
  })
  @Get(':conversationId/messages')
  async getMessagesByConversationId(
    @Param('conversationId') conversationId: string,
    @Req() request: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<BaseResponse> {
    try {
      const userId = request.user.id;
      const pageNum = page ? parseInt(page, 10) : 1;
      const limitNum = limit ? parseInt(limit, 10) : 50;

      // Validate pagination parameters
      if (pageNum < 1) {
        throw new HttpException('Page phải lớn hơn 0', HttpStatus.BAD_REQUEST);
      }

      if (limitNum < 1 || limitNum > 100) {
        throw new HttpException(
          'Limit phải từ 1 đến 100',
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.messageService.getMessagesByConversationId(
        conversationId,
        {
          page: pageNum,
          limit: limitNum,
          userId,
        },
      );

      return HttpResponse.success(result, 'Lấy danh sách messages thành công');
    } catch (error) {
      this.logger.error(
        `Lỗi khi lấy messages của conversation ${conversationId}:`,
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Lấy danh sách messages thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
