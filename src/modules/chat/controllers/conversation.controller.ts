import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
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
import { GetConversationsDto } from '../dto/get-conversations.dto';
import { ConversationStatus } from '../types/enums';

@ApiTags('Conversation')
@Controller('conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthenticationGuard, PermissionsGuard)
@Permissions(PermissionName.CHAT)
export class ConversationController {
  private readonly logger = new Logger(ConversationController.name);

  constructor(private readonly conversationService: ConversationService) {}

  @ApiOperation({
    summary: 'Lấy danh sách conversations của reviewer',
    description:
      'Lấy tất cả conversations được phân công cho reviewer hiện tại với filter và pagination',
  })
  @ApiQuery({
    name: 'status',
    description: 'Lọc theo trạng thái conversation',
    required: false,
    enum: ConversationStatus,
    example: ConversationStatus.ACTIVE,
  })
  @ApiQuery({
    name: 'caseResolved',
    description: 'Lọc theo case đã resolved',
    required: false,
    type: 'boolean',
    example: false,
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
    description: 'Số lượng conversations mỗi trang (tối đa 100)',
    required: false,
    type: 'number',
    example: 20,
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
              caseResolved: false,
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
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Tham số không hợp lệ',
    schema: {
      example: {
        statusCode: 400,
        message: 'Page phải lớn hơn 0',
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

      const pageNum = query.page ? parseInt(query.page.toString(), 10) : 1;
      const limitNum = query.limit ? parseInt(query.limit.toString(), 10) : 20;

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

      const result = await this.conversationService.getConversationsByReviewer(
        userId,
        {
          status: query.status,
          caseResolved: query.caseResolved,
          page: pageNum,
          limit: limitNum,
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
    summary: 'Lấy danh sách conversations chưa phân công',
    description:
      'Lấy tất cả conversations chưa được phân công cho reviewer nào (dành cho admin/supervisor)',
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
    description: 'Số lượng conversations mỗi trang (tối đa 100)',
    required: false,
    type: 'number',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách conversations chưa phân công thành công',
    schema: {
      example: {
        statusCode: 200,
        message: 'Lấy danh sách conversations chưa phân công thành công',
        data: {
          conversations: [
            {
              id: 'uuid-string',
              customerId: 'customer-uuid',
              status: 'pending',
              totalMessages: 2,
              startedAt: '2024-01-01T10:00:00.000Z',
              lastMessageAt: '2024-01-01T10:05:00.000Z',
              customer: {
                id: 'customer-uuid',
                facebookName: 'Nguyễn Văn B',
                customerType: 'individual',
              },
            },
          ],
          total: 10,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Tham số không hợp lệ',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Cần đăng nhập',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Không có quyền truy cập',
  })
  @Get('unassigned')
  async getUnassignedConversations(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<BaseResponse> {
    try {
      const pageNum = page ? parseInt(page, 10) : 1;
      const limitNum = limit ? parseInt(limit, 10) : 20;

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

      const result = await this.conversationService.getUnassignedConversations({
        page: pageNum,
        limit: limitNum,
      });

      return HttpResponse.success(
        result,
        'Lấy danh sách conversations chưa phân công thành công',
      );
    } catch (error) {
      this.logger.error('Lỗi khi lấy conversations chưa phân công:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Lấy conversations chưa phân công thất bại',
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
          caseResolved: false,
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
    status: 404,
    description: 'Conversation không tồn tại',
  })
  @Get(':conversationId')
  async getConversationById(
    @Param('conversationId') conversationId: string,
  ): Promise<BaseResponse> {
    try {
      const conversation = await this.conversationService.getConversationById(
        conversationId,
      );

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
    summary: 'Nhận phụ trách conversation',
    description: 'Reviewer assign conversation cho chính mình để bắt đầu xử lý',
  })
  @ApiParam({
    name: 'conversationId',
    description: 'UUID của conversation',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Assign conversation thành công',
    schema: {
      example: {
        statusCode: 200,
        message: 'Đã nhận phụ trách conversation thành công',
        data: {
          id: 'uuid-string',
          status: 'active',
          assignedReviewerId: 'reviewer-uuid',
          assignedAt: '2024-01-01T10:00:00.000Z',
          customer: {
            id: 'customer-uuid',
            facebookName: 'Nguyễn Văn A',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Conversation không thể assign',
    schema: {
      example: {
        statusCode: 400,
        message: 'Conversation đã được assign cho reviewer khác',
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
  @ApiResponse({
    status: 404,
    description: 'Conversation không tồn tại',
  })
  @Post(':conversationId/assign')
  async assignConversation(
    @Param('conversationId') conversationId: string,
    @Req() request: RequestWithUser,
  ): Promise<BaseResponse> {
    try {
      const userId = request.user.id;

      await this.conversationService.assignReviewer(conversationId, userId);

      return HttpResponse.success(
        null,
        'Đã nhận phụ trách conversation thành công',
      );
    } catch (error) {
      this.logger.error(
        `Lỗi khi assign conversation ${conversationId}:`,
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Assign conversation thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiOperation({
    summary: 'Đánh dấu conversation đã resolved',
    description: 'Reviewer đánh dấu conversation đã được giải quyết',
  })
  @ApiParam({
    name: 'conversationId',
    description: 'UUID của conversation',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Đánh dấu conversation resolved thành công',
    schema: {
      example: {
        statusCode: 200,
        message: 'Conversation đã được đánh dấu resolved',
        data: {
          id: 'uuid-string',
          status: 'resolved',
          resolvedAt: '2024-01-01T11:00:00.000Z',
          resolutionNote: 'Case resolved successfully',
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
    description:
      'Forbidden - Không có quyền truy cập hoặc không phải reviewer của conversation này',
  })
  @ApiResponse({
    status: 404,
    description: 'Conversation không tồn tại',
  })
  @Post(':conversationId/resolve')
  async resolveConversation(
    @Param('conversationId') conversationId: string,
    @Req() request: RequestWithUser,
  ): Promise<BaseResponse> {
    try {
      const resolvedBy = request.user.id;

      await this.conversationService.resolveConversation(
        conversationId,
        resolvedBy,
      );

      return HttpResponse.success(
        null,
        'Conversation đã được đánh dấu resolved',
      );
    } catch (error) {
      this.logger.error(
        `Lỗi khi resolve conversation ${conversationId}:`,
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Resolve conversation thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiOperation({
    summary: 'Mở lại conversation',
    description: 'Reviewer mở lại conversation để tiếp tục xử lý',
  })
  @ApiParam({
    name: 'conversationId',
    description: 'UUID của conversation',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Mở lại conversation thành công',
    schema: {
      example: {
        statusCode: 200,
        message: 'Conversation đã được mở lại',
        data: {
          id: 'uuid-string',
          status: 'active',
          reopenedAt: '2024-01-01T12:00:00.000Z',
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
    description:
      'Forbidden - Không có quyền truy cập hoặc không phải reviewer của conversation này',
  })
  @ApiResponse({
    status: 404,
    description: 'Conversation không tồn tại',
  })
  @Post(':conversationId/reopen')
  @HttpCode(200)
  async reopenConversation(
    @Param('conversationId') conversationId: string,
  ): Promise<BaseResponse> {
    try {
      await this.conversationService.reopenConversation(conversationId);

      return HttpResponse.success(null, 'Conversation đã được mở lại');
    } catch (error) {
      this.logger.error(
        `Lỗi khi reopen conversation ${conversationId}:`,
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Reopen conversation thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiOperation({
    summary: 'Cập nhật trạng thái conversation',
    description: 'Cập nhật trạng thái conversation (resolved, escalated, etc.)',
  })
  @ApiParam({
    name: 'conversationId',
    description: 'UUID của conversation',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'status',
    description: 'Trạng thái mới của conversation',
    enum: ConversationStatus,
    example: ConversationStatus.RESOLVED,
  })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật trạng thái conversation thành công',
    schema: {
      example: {
        statusCode: 200,
        message: 'Cập nhật trạng thái conversation thành công',
        data: {
          id: 'uuid-string',
          status: 'resolved',
          resolvedAt: '2024-01-01T11:00:00.000Z',
          resolutionNote: 'Case resolved successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Trạng thái không hợp lệ hoặc không thể thay đổi',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Cần đăng nhập',
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - Không có quyền hoặc không phải reviewer của conversation này',
  })
  @ApiResponse({
    status: 404,
    description: 'Conversation không tồn tại',
  })
  @Put(':conversationId/status/:status')
  async updateConversationStatus(
    @Param('conversationId') conversationId: string,
    @Param('status') status: ConversationStatus,
    @Req() request: RequestWithUser,
  ): Promise<BaseResponse> {
    try {
      await this.conversationService.updateConversationStatus(
        conversationId,
        status,
      );

      return HttpResponse.success(
        null,
        'Cập nhật trạng thái conversation thành công',
      );
    } catch (error) {
      this.logger.error(
        `Lỗi khi cập nhật trạng thái conversation ${conversationId}:`,
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Cập nhật trạng thái conversation thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiOperation({
    summary: 'Lấy thống kê conversations',
    description:
      'Lấy thống kê tổng quan về conversations của reviewer hoặc toàn hệ thống',
  })
  @ApiQuery({
    name: 'global',
    description: 'Lấy thống kê toàn hệ thống (chỉ admin)',
    required: false,
    type: 'boolean',
    example: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy thống kê conversations thành công',
    schema: {
      example: {
        statusCode: 200,
        message: 'Lấy thống kê conversations thành công',
        data: {
          total: 100,
          active: 25,
          pending: 10,
          resolved: 65,
          escalated: 0,
          avgResponseTime: 15.5,
          avgResolutionTime: 45.2,
          todayStats: {
            newConversations: 8,
            resolvedConversations: 12,
            pendingConversations: 3,
          },
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
    description: 'Forbidden - Không có quyền truy cập thống kê global',
  })
  @Get('stats')
  async getConversationStats(
    @Req() request: RequestWithUser,
    @Query('global') global?: string,
  ): Promise<BaseResponse> {
    try {
      const userId = request.user.id;
      const isGlobal = global === 'true';

      const stats = await this.conversationService.getConversationStats(
        isGlobal ? null : userId,
      );

      return HttpResponse.success(
        stats,
        'Lấy thống kê conversations thành công',
      );
    } catch (error) {
      this.logger.error('Lỗi khi lấy thống kê conversations:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Lấy thống kê conversations thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
