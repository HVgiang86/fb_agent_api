import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  UseGuards,
  Param,
  Query,
  HttpException,
  HttpStatus,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { UsersService } from './user.service';
import JwtAuthenticationGuard from '../auth/jwt-authentication.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';
import { UpdateCustomerTypesDto } from './dto/update-customer-types.dto';
import { UpdateUserInfoDto } from './dto/update-user-info.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { User } from './entities/users.entity';
import { PermissionName } from './entities/permission.entity';
import { CustomerType } from '../chat/types/enums';
import { HttpResponse, BaseResponse } from '../../types/http-response';
import RequestWithUser from '../auth/intefaces/requestWithUser.interface';
import { formatDateToISO } from '../../utils/date-formatter';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Users')
@Controller('users')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Tạo user mới' })
  @ApiResponse({
    status: 201,
    description: 'Tạo user thành công',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 201 },
        message: { type: 'string', example: 'Tạo user thành công' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            username: { type: 'string' },
            fullName: { type: 'string' },
            email: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthenticationGuard, PermissionsGuard)
  @Permissions(PermissionName.PERMISSION)
  @Post('create')
  public async createUser(
    @Body() createUserData: CreateUserDto,
    @Req() request: RequestWithUser,
  ): Promise<BaseResponse> {
    try {
      const user = await this.usersService.create(
        createUserData,
        request.user.id,
      );

      const result = {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
      };

      return HttpResponse.created(result, 'Tạo user thành công');
    } catch (error) {
      this.logger.error('Create user error:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Tạo user thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiOperation({ summary: 'Lấy danh sách user' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Trang',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Số lượng',
    example: 10,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Tìm kiếm',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách user thành công',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: { type: 'string', example: 'Lấy danh sách user thành công' },
        data: {
          type: 'object',
          properties: {
            users: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  username: { type: 'string' },
                  fullName: { type: 'string' },
                  email: { type: 'string' },
                  phone: { type: 'string' },
                  address: { type: 'string' },
                  dateOfBirth: { type: 'string' },
                  gender: { type: 'string' },
                  isActive: { type: 'boolean' },
                  requireChangePassword: { type: 'boolean' },
                  lastLoginAt: { type: 'string' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                  permissions: {
                    type: 'array',
                    items: {
                      type: 'string',
                      enum: Object.values(PermissionName),
                    },
                  },
                  customerTypes: {
                    type: 'array',
                    items: {
                      type: 'string',
                      enum: Object.values(CustomerType),
                    },
                  },
                },
              },
            },
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthenticationGuard, PermissionsGuard)
  @Permissions(PermissionName.PERMISSION)
  @Get('list')
  public async listUsers(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search?: string,
  ): Promise<BaseResponse> {
    try {
      const users =
        await this.usersService.getUsersWithPermissionsAndCustomerTypes();

      // Filter users based on search
      let filteredUsers = users;
      if (search) {
        const searchLower = search.toLowerCase();
        filteredUsers = users.filter(
          (user) =>
            user.username.toLowerCase().includes(searchLower) ||
            user.fullName.toLowerCase().includes(searchLower) ||
            user.email.toLowerCase().includes(searchLower),
        );
      }

      // Pagination
      const offset = (page - 1) * limit;
      const paginatedUsers = filteredUsers.slice(offset, offset + limit);

      // Format response with permissions and customerTypes
      const formattedUsers = await Promise.all(
        paginatedUsers.map(async (user) => {
          const permissions = await this.usersService.getUserPermissions(
            user.id,
          );
          const customerTypes = await this.usersService.getUserCustomerTypes(
            user.id,
          );

          return {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            email: user.email,
            phone: user.phone,
            address: user.address,
            dateOfBirth: formatDateToISO(user.dateOfBirth),
            gender: user.gender,
            isActive: user.isActive,
            requireChangePassword: user.requireChangePassword,
            lastLoginAt: formatDateToISO(user.lastLoginAt),
            createdAt: formatDateToISO(user.createdAt),
            updatedAt: formatDateToISO(user.updatedAt),
            permissions,
            customerTypes,
          };
        }),
      );

      const result = {
        users: formattedUsers,
        total: filteredUsers.length,
        page: Number(page),
        limit: Number(limit),
      };

      return HttpResponse.success(result, 'Lấy danh sách user thành công');
    } catch (error) {
      this.logger.error('List users error:', error);
      throw new HttpException(
        'Lấy danh sách user thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiOperation({ summary: 'Cập nhật phân quyền user' })
  @ApiParam({ name: 'userId', type: 'string', description: 'ID của user' })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật phân quyền thành công',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: { type: 'string', example: 'Cập nhật phân quyền thành công' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User không tồn tại',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthenticationGuard, PermissionsGuard)
  @Permissions(PermissionName.PERMISSION)
  @Put(':userId/permissions')
  public async updatePermissions(
    @Param('userId') userId: string,
    @Body() updatePermissionsData: UpdatePermissionsDto,
    @Req() request: RequestWithUser,
  ): Promise<BaseResponse> {
    try {
      // Validate user exists before updating permissions
      const userExists = await this.usersService.userExists(userId);
      if (!userExists) {
        throw new HttpException('User không tồn tại', HttpStatus.NOT_FOUND);
      }

      await this.usersService.updateUserPermissions(
        userId,
        updatePermissionsData.permissions,
        request.user.id,
      );

      return HttpResponse.success(undefined, 'Cập nhật phân quyền thành công');
    } catch (error) {
      this.logger.error('Update permissions error:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Cập nhật phân quyền thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiOperation({ summary: 'Cập nhật tệp khách hàng phụ trách' })
  @ApiParam({ name: 'userId', type: 'string', description: 'ID của user' })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật tệp khách hàng phụ trách thành công',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: {
          type: 'string',
          example: 'Cập nhật tệp khách hàng phụ trách thành công',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User không tồn tại',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthenticationGuard, PermissionsGuard)
  @Permissions(PermissionName.PERMISSION)
  @Put(':userId/customer-types')
  public async updateCustomerTypes(
    @Param('userId') userId: string,
    @Body() updateCustomerTypesData: UpdateCustomerTypesDto,
    @Req() request: RequestWithUser,
  ): Promise<BaseResponse> {
    try {
      // Validate user exists before updating customer types
      const userExists = await this.usersService.userExists(userId);
      if (!userExists) {
        throw new HttpException('User không tồn tại', HttpStatus.NOT_FOUND);
      }

      // Validate customer types
      const validCustomerTypes = Object.values(CustomerType);
      for (const customerType of updateCustomerTypesData.customerTypes) {
        if (!validCustomerTypes.includes(customerType)) {
          throw new HttpException(
            `Customer type không hợp lệ: ${customerType}`,
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      // Update customer types for user
      await this.usersService.updateUserCustomerTypes(
        userId,
        updateCustomerTypesData.customerTypes,
        request.user.id,
      );

      return HttpResponse.success(
        undefined,
        'Cập nhật tệp khách hàng phụ trách thành công',
      );
    } catch (error) {
      this.logger.error('Update customer types error:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Cập nhật tệp khách hàng phụ trách thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiOperation({ summary: 'Lấy thông tin user hiện tại' })
  @ApiResponse({
    status: 200,
    description: 'Lấy thông tin user thành công',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: { type: 'string', example: 'Lấy thông tin user thành công' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'uuid' },
            username: { type: 'string', example: 'admin' },
            email: { type: 'string', example: 'admin@example.com' },
            fullName: { type: 'string', example: 'Nguyễn Văn A' },
            phone: { type: 'string', example: '0123456789' },
            address: { type: 'string', example: 'Hà Nội, Việt Nam' },
            dateOfBirth: { type: 'string', example: '1990-01-01' },
            gender: { type: 'string', example: 'male' },
            isActive: { type: 'boolean', example: true },
            requireChangePassword: { type: 'boolean', example: false },
            lastLoginAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            permissions: {
              type: 'array',
              items: { type: 'string', enum: Object.values(PermissionName) },
            },
            customerTypes: {
              type: 'array',
              items: { type: 'string', enum: Object.values(CustomerType) },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthenticationGuard)
  @Get('get-info')
  public async getInfo(@Req() request: RequestWithUser): Promise<BaseResponse> {
    console.log('Receive request get-info with payload: ', request.user);
    const user = await this.usersService.getById(request.user.id);

    // Get permissions and customer types
    const permissions = await this.usersService.getUserPermissions(
      request.user.id,
    );
    const customerTypes = await this.usersService.getUserCustomerTypes(
      request.user.id,
    );

    // Format user data with proper date serialization
    const formattedUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      address: user.address,
      dateOfBirth: formatDateToISO(user.dateOfBirth),
      gender: user.gender,
      isActive: user.isActive,
      requireChangePassword: user.requireChangePassword,
      lastLoginAt: formatDateToISO(user.lastLoginAt),
      createdAt: formatDateToISO(user.createdAt),
      updatedAt: formatDateToISO(user.updatedAt),
      permissions,
      customerTypes,
    };

    return HttpResponse.success(formattedUser, 'Lấy thông tin user thành công');
  }

  @ApiOperation({ summary: 'Cập nhật thông tin user hiện tại' })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật thông tin thành công',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: { type: 'string', example: 'Cập nhật thông tin thành công' },
        data: { type: 'object', nullable: true },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthenticationGuard)
  @Post('update-info')
  public async updateInfo(
    @Req() request: RequestWithUser,
    @Body() body: UpdateUserInfoDto,
  ): Promise<BaseResponse> {
    console.log('Receive request update-info with payload: ', request.user);

    // Convert DTO to User entity format
    const updateData: Partial<User> = {
      ...body,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
    };

    const success = await this.usersService.updateUserInfo(
      request.user.id,
      updateData,
    );

    return HttpResponse.success(
      undefined,
      success ? 'Cập nhật thông tin thành công' : 'Cập nhật thông tin thất bại',
    );
  }

  @ApiOperation({ summary: 'Lấy thông tin profile của user bất kỳ' })
  @ApiParam({ name: 'userId', type: 'string', description: 'ID của user' })
  @ApiResponse({
    status: 200,
    description: 'Lấy thông tin profile thành công',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: {
          type: 'string',
          example: 'Lấy thông tin profile thành công',
        },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'uuid' },
            username: { type: 'string', example: 'admin' },
            email: { type: 'string', example: 'admin@example.com' },
            fullName: { type: 'string', example: 'Nguyễn Văn A' },
            phone: { type: 'string', example: '0123456789' },
            address: { type: 'string', example: 'Hà Nội, Việt Nam' },
            dateOfBirth: { type: 'string', example: '1990-01-01' },
            gender: { type: 'string', example: 'male' },
            isActive: { type: 'boolean', example: true },
            requireChangePassword: { type: 'boolean', example: false },
            lastLoginAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            permissions: {
              type: 'array',
              items: { type: 'string', enum: Object.values(PermissionName) },
            },
            customerTypes: {
              type: 'array',
              items: { type: 'string', enum: Object.values(CustomerType) },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User không tồn tại',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthenticationGuard, PermissionsGuard)
  @Permissions(PermissionName.PERMISSION)
  @Get(':userId/profile')
  public async getUserProfile(
    @Param('userId') userId: string,
  ): Promise<BaseResponse> {
    try {
      // Validate user exists
      const userExists = await this.usersService.userExists(userId);
      if (!userExists) {
        throw new HttpException('User không tồn tại', HttpStatus.NOT_FOUND);
      }

      const user = await this.usersService.getById(userId);

      // Get permissions and customer types
      const permissions = await this.usersService.getUserPermissions(userId);
      const customerTypes = await this.usersService.getUserCustomerTypes(
        userId,
      );

      // Format user data with proper date serialization
      const formattedUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        address: user.address,
        dateOfBirth: formatDateToISO(user.dateOfBirth),
        gender: user.gender,
        isActive: user.isActive,
        requireChangePassword: user.requireChangePassword,
        lastLoginAt: formatDateToISO(user.lastLoginAt),
        createdAt: formatDateToISO(user.createdAt),
        updatedAt: formatDateToISO(user.updatedAt),
        permissions,
        customerTypes,
      };

      return HttpResponse.success(
        formattedUser,
        'Lấy thông tin profile thành công',
      );
    } catch (error) {
      this.logger.error('Get user profile error:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Lấy thông tin profile thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiOperation({ summary: 'Cập nhật profile của user bất kỳ' })
  @ApiParam({ name: 'userId', type: 'string', description: 'ID của user' })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật profile thành công',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: { type: 'string', example: 'Cập nhật profile thành công' },
        data: { type: 'object', nullable: true },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User không tồn tại',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthenticationGuard, PermissionsGuard)
  @Permissions(PermissionName.PERMISSION)
  @Put(':userId/profile')
  public async updateUserProfile(
    @Param('userId') userId: string,
    @Body() body: UpdateUserInfoDto,
    @Req() request: RequestWithUser,
  ): Promise<BaseResponse> {
    try {
      // Validate user exists
      const userExists = await this.usersService.userExists(userId);
      if (!userExists) {
        throw new HttpException('User không tồn tại', HttpStatus.NOT_FOUND);
      }

      // Convert DTO to User entity format
      const updateData: Partial<User> = {
        ...body,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
        updatedBy: request.user.id,
      };

      const success = await this.usersService.updateUserInfo(
        userId,
        updateData,
      );

      return HttpResponse.success(
        undefined,
        success ? 'Cập nhật profile thành công' : 'Cập nhật profile thất bại',
      );
    } catch (error) {
      this.logger.error('Update user profile error:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Cập nhật profile thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiOperation({ summary: 'Cập nhật trạng thái active/deactive của user' })
  @ApiParam({ name: 'userId', type: 'string', description: 'ID của user' })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật trạng thái thành công',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: {
          type: 'string',
          example: 'Cập nhật trạng thái user thành công',
        },
        data: { type: 'object', nullable: true },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User không tồn tại',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthenticationGuard, PermissionsGuard)
  @Permissions(PermissionName.PERMISSION)
  @Put(':userId/status')
  @HttpCode(200)
  public async updateUserStatus(
    @Param('userId') userId: string,
    @Body() updateStatusData: UpdateUserStatusDto,
    @Req() request: RequestWithUser,
  ): Promise<BaseResponse> {
    try {
      // Validate user exists
      const userExists = await this.usersService.userExists(userId);
      if (!userExists) {
        throw new HttpException('User không tồn tại', HttpStatus.NOT_FOUND);
      }

      const success = await this.usersService.updateUserStatus(
        userId,
        updateStatusData.isActive,
        request.user.id,
      );

      const message = updateStatusData.isActive
        ? 'Kích hoạt user thành công'
        : 'Vô hiệu hóa user thành công';

      return HttpResponse.success(
        undefined,
        success ? message : 'Cập nhật trạng thái user thất bại',
      );
    } catch (error) {
      this.logger.error('Update user status error:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Cập nhật trạng thái user thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
