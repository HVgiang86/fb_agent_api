import {
  Controller,
  Get,
  Post,
  Put,
  Body,
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
  ApiBody,
} from '@nestjs/swagger';
import JwtAuthenticationGuard from '../../auth/jwt-authentication.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { PermissionName } from '../../users/entities/permission.entity';
import RequestWithUser from '../../auth/intefaces/requestWithUser.interface';
import { HttpResponse, BaseResponse } from '../../../types/http-response';
import { CustomerService } from '../services/customer.service';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { UpdateCustomerDto } from '../dto/update-customer.dto';

@ApiTags('Customer')
@Controller('customers')
@ApiBearerAuth()
@UseGuards(JwtAuthenticationGuard, PermissionsGuard)
@Permissions(PermissionName.CHAT)
export class CustomerController {
  private readonly logger = new Logger(CustomerController.name);

  constructor(private readonly customerService: CustomerService) {}

  @ApiOperation({
    summary: 'Tạo customer mới',
    description:
      'Tạo một customer mới từ Facebook integration hoặc manual entry',
  })
  @ApiBody({ type: CreateCustomerDto })
  @ApiResponse({
    status: 201,
    description: 'Tạo customer thành công',
    schema: {
      example: {
        statusCode: 201,
        message: 'Tạo customer thành công',
        data: {
          id: 'uuid-string',
          facebookId: 'fb_123456789',
          facebookName: 'Nguyễn Văn A',
          customerType: 'individual',
          firstInteractionAt: '2024-01-01T10:00:00.000Z',
          lastInteractionAt: '2024-01-01T10:00:00.000Z',
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
        message: 'Facebook ID không được để trống',
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
    status: 409,
    description: 'Customer đã tồn tại',
    schema: {
      example: {
        statusCode: 409,
        message: 'Customer với Facebook ID này đã tồn tại',
      },
    },
  })
  @Post()
  @HttpCode(201)
  async createCustomer(
    @Body() createCustomerDto: CreateCustomerDto,
    @Req() request: RequestWithUser,
  ): Promise<BaseResponse> {
    try {
      const customer = await this.customerService.createCustomer(
        createCustomerDto,
      );

      const formattedCustomer =
        this.customerService.formatCustomerResponse(customer);

      return HttpResponse.created(formattedCustomer, 'Tạo customer thành công');
    } catch (error) {
      this.logger.error('Lỗi khi tạo customer:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Tạo customer thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiOperation({
    summary: 'Lấy thông tin customer theo ID',
    description:
      'Lấy thông tin chi tiết của customer và các conversations liên quan',
  })
  @ApiParam({
    name: 'customerId',
    description: 'UUID của customer',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy thông tin customer thành công',
    schema: {
      example: {
        statusCode: 200,
        message: 'Lấy thông tin customer thành công',
        data: {
          id: 'uuid-string',
          facebookId: 'fb_123456789',
          facebookName: 'Nguyễn Văn A',
          customerType: 'individual',
          totalConversations: 5,
          totalMessages: 50,
          firstInteractionAt: '2024-01-01T10:00:00.000Z',
          lastInteractionAt: '2024-01-01T10:00:00.000Z',
          conversations: [],
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
  @ApiResponse({
    status: 404,
    description: 'Customer không tồn tại',
    schema: {
      example: {
        statusCode: 404,
        message: 'Customer không tồn tại',
      },
    },
  })
  @Get(':customerId')
  async getCustomerById(
    @Param('customerId') customerId: string,
  ): Promise<BaseResponse> {
    try {
      const customer = await this.customerService.getCustomerById(customerId);

      const formattedCustomer =
        this.customerService.formatCustomerResponse(customer);

      return HttpResponse.success(
        formattedCustomer,
        'Lấy thông tin customer thành công',
      );
    } catch (error) {
      this.logger.error(`Lỗi khi lấy customer ${customerId}:`, error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Lấy thông tin customer thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiOperation({
    summary: 'Lấy customer theo Facebook ID',
    description:
      'Tìm customer bằng Facebook ID để check tồn tại hoặc lấy thông tin',
  })
  @ApiParam({
    name: 'facebookId',
    description: 'Facebook ID của customer',
    example: 'fb_123456789',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy thông tin customer thành công',
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
    description: 'Customer không tồn tại',
  })
  @Get('facebook/:facebookId')
  async getCustomerByFacebookId(
    @Param('facebookId') facebookId: string,
  ): Promise<BaseResponse> {
    try {
      const customer = await this.customerService.getCustomerByFacebookId(
        facebookId,
      );

      const formattedCustomer =
        this.customerService.formatCustomerResponse(customer);

      return HttpResponse.success(
        formattedCustomer,
        'Lấy thông tin customer thành công',
      );
    } catch (error) {
      this.logger.error(`Lỗi khi lấy customer ${facebookId}:`, error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Lấy thông tin customer thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiOperation({
    summary: 'Cập nhật thông tin customer',
    description: 'Cập nhật thông tin profile và AI analysis của customer',
  })
  @ApiParam({
    name: 'customerId',
    description: 'UUID của customer',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: UpdateCustomerDto })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật customer thành công',
    schema: {
      example: {
        statusCode: 200,
        message: 'Cập nhật customer thành công',
        data: {
          id: 'uuid-string',
          facebookId: 'fb_123456789',
          facebookName: 'Nguyễn Văn A Updated',
          customerType: 'business',
          totalConversations: 5,
          totalMessages: 50,
          updatedAt: '2024-01-01T11:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ',
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
    description: 'Customer không tồn tại',
  })
  @Put(':customerId')
  async updateCustomer(
    @Param('customerId') customerId: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
  ): Promise<BaseResponse> {
    try {
      const customer = await this.customerService.updateCustomer(
        customerId,
        updateCustomerDto,
      );

      const formattedCustomer =
        this.customerService.formatCustomerResponse(customer);

      return HttpResponse.success(
        formattedCustomer,
        'Cập nhật customer thành công',
      );
    } catch (error) {
      this.logger.error(`Lỗi khi cập nhật customer ${customerId}:`, error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Cập nhật customer thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiOperation({
    summary: 'Lấy danh sách customers',
    description: 'Lấy danh sách customers với pagination, search và filter',
  })
  @ApiQuery({
    name: 'page',
    description: 'Số trang (bắt đầu từ 1)',
    required: false,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Số lượng items mỗi trang (tối đa 100)',
    required: false,
    example: 20,
  })
  @ApiQuery({
    name: 'search',
    description: 'Tìm kiếm theo tên Facebook hoặc Facebook ID',
    required: false,
    example: 'Nguyễn Văn A',
  })
  @ApiQuery({
    name: 'customerType',
    description: 'Lọc theo loại customer',
    required: false,
    enum: ['individual', 'business', 'premium'],
    example: 'individual',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách customers thành công',
    schema: {
      example: {
        statusCode: 200,
        message: 'Lấy danh sách customers thành công',
        data: {
          customers: [
            {
              id: 'uuid-string',
              facebookId: 'fb_123456789',
              facebookName: 'Nguyễn Văn A',
              customerType: 'individual',
              totalConversations: 5,
              totalMessages: 50,
              firstInteractionAt: '2024-01-01T10:00:00.000Z',
              lastInteractionAt: '2024-01-01T10:00:00.000Z',
            },
          ],
          total: 100,
          page: 1,
          limit: 20,
          totalPages: 5,
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
  @Get()
  async getCustomers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('customerType') customerType?: string,
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

      const result = await this.customerService.getCustomers({
        page: pageNum,
        limit: limitNum,
        search,
        customerType,
      });

      return HttpResponse.success(result, 'Lấy danh sách customers thành công');
    } catch (error) {
      this.logger.error('Lỗi khi lấy danh sách customers:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Lấy danh sách customers thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
