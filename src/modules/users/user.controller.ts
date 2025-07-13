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
  Logger,
} from '@nestjs/common';
import { UsersService } from './user.service';
import JwtAuthenticationGuard from '../auth/jwt-authentication.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { UpdateInfoBody } from './types/update-info-body';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';
import { UpdateCustomerTypesDto } from './dto/update-customer-types.dto';
import { User } from './entities/users.entity';
import { PermissionName } from './entities/permission.entity';
import { HttpResponse, BaseResponse } from '../../types/http-response';
import RequestWithUser from '../auth/intefaces/requestWithUser.interface';
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
            users: { type: 'array', items: { type: 'object' } },
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

      // Format response
      const formattedUsers = paginatedUsers.map((user) => ({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        address: user.address,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        isActive: user.isActive,
        requireChangePassword: user.requireChangePassword,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        permissions:
          user.userPermissions?.map((up) => up.permission.name) || [],
        customerTypes:
          user.userCustomerTypes?.map((uct) => uct.customerType.name) || [],
      }));

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

  @UseGuards(JwtAuthenticationGuard)
  @Get('get-info')
  public async getInfo(@Req() request: RequestWithUser): Promise<User> {
    console.log('Receive request get-info with payload: ', request.user);
    const user = await this.usersService.getById(request.user.id);
    user.passwordHash = undefined;
    return user;
  }

  @UseGuards(JwtAuthenticationGuard)
  @Post('update-info')
  public async updateInfo(
    @Req() request: RequestWithUser,
    @Body() body: UpdateInfoBody,
  ): Promise<BaseResponse> {
    console.log('Receive request update-info with payload: ', request.user);
    const success = await this.usersService.updateUserInfo(
      request.user.id,
      body,
    );

    return HttpResponse.success(
      undefined,
      success ? 'Cập nhật thông tin thành công' : 'Cập nhật thông tin thất bại',
    );
  }
}
