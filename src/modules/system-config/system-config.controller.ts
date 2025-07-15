import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { HttpResponse, BaseResponse } from '../../types/http-response';
import { formatDateToISO } from '../../utils/date-formatter';
import JwtAuthenticationGuard from '../auth/jwt-authentication.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PermissionName } from '../users/entities/permission.entity';
import RequestWithUser from '../auth/intefaces/requestWithUser.interface';
import { SystemConfigService } from './system-config.service';
import { CreateConfigDto } from './dto/create-config.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { ConfigKey } from './entities/system-config.entity';

@ApiTags('System Config')
@Controller('system-config')
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @ApiOperation({ summary: 'Tạo config mới' })
  @ApiResponse({
    status: 201,
    description: 'Tạo config thành công',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Không có quyền',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Config key đã tồn tại',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthenticationGuard, PermissionsGuard)
  @Permissions(PermissionName.PERMISSION)
  @Post()
  @HttpCode(201)
  async createConfig(
    @Body() createConfigDto: CreateConfigDto,
    @Req() request: RequestWithUser,
  ): Promise<BaseResponse> {
    try {
      const config = await this.systemConfigService.createConfig(
        createConfigDto,
        request.user.id,
      );

      const formattedConfig = {
        ...config,
        createdAt: formatDateToISO(config.createdAt),
        updatedAt: formatDateToISO(config.updatedAt),
      };

      return HttpResponse.created(formattedConfig, 'Tạo config thành công');
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Tạo config thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiOperation({ summary: 'Lấy danh sách tất cả config' })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách config thành công',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Không có quyền',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthenticationGuard, PermissionsGuard)
  @Permissions(PermissionName.PERMISSION)
  @Get()
  async getAllConfigs(): Promise<BaseResponse> {
    try {
      const configs = await this.systemConfigService.getAllConfigs();

      const formattedConfigs = configs.map((config) => ({
        ...config,
        createdAt: formatDateToISO(config.createdAt),
        updatedAt: formatDateToISO(config.updatedAt),
        creator: config.creator
          ? {
              id: config.creator.id,
              username: config.creator.username,
              fullName: config.creator.fullName,
            }
          : null,
        updater: config.updater
          ? {
              id: config.updater.id,
              username: config.updater.username,
              fullName: config.updater.fullName,
            }
          : null,
      }));

      return HttpResponse.success(
        formattedConfigs,
        'Lấy danh sách config thành công',
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Lấy danh sách config thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiOperation({ summary: 'Lấy config theo key' })
  @ApiParam({
    name: 'configKey',
    description: 'Key của config cần lấy',
    enum: ConfigKey,
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy config thành công',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Không có quyền',
  })
  @ApiResponse({
    status: 404,
    description: 'Config không tồn tại',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthenticationGuard, PermissionsGuard)
  @Permissions(PermissionName.PERMISSION)
  @Get(':configKey')
  async getConfigByKey(
    @Param('configKey') configKey: ConfigKey,
  ): Promise<BaseResponse> {
    try {
      const config = await this.systemConfigService.getConfigByKey(configKey);

      const formattedConfig = {
        ...config,
        createdAt: formatDateToISO(config.createdAt),
        updatedAt: formatDateToISO(config.updatedAt),
        creator: config.creator
          ? {
              id: config.creator.id,
              username: config.creator.username,
              fullName: config.creator.fullName,
            }
          : null,
        updater: config.updater
          ? {
              id: config.updater.id,
              username: config.updater.username,
              fullName: config.updater.fullName,
            }
          : null,
      };

      return HttpResponse.success(formattedConfig, 'Lấy config thành công');
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Lấy config thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiOperation({ summary: 'Cập nhật config' })
  @ApiParam({
    name: 'configKey',
    description: 'Key của config cần cập nhật',
    enum: ConfigKey,
  })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật config thành công',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Không có quyền',
  })
  @ApiResponse({
    status: 404,
    description: 'Config không tồn tại',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthenticationGuard, PermissionsGuard)
  @Permissions(PermissionName.PERMISSION)
  @Put(':configKey')
  async updateConfig(
    @Param('configKey') configKey: ConfigKey,
    @Body() updateConfigDto: UpdateConfigDto,
    @Req() request: RequestWithUser,
  ): Promise<BaseResponse> {
    try {
      const config = await this.systemConfigService.updateConfig(
        configKey,
        updateConfigDto,
        request.user.id,
      );

      const formattedConfig = {
        ...config,
        createdAt: formatDateToISO(config.createdAt),
        updatedAt: formatDateToISO(config.updatedAt),
      };

      return HttpResponse.success(
        formattedConfig,
        'Cập nhật config thành công',
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Cập nhật config thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiOperation({ summary: 'Xóa config (chỉ áp dụng cho non-system config)' })
  @ApiParam({
    name: 'configKey',
    description: 'Key của config cần xóa',
    enum: ConfigKey,
  })
  @ApiResponse({
    status: 204,
    description: 'Xóa config thành công',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Không có quyền',
  })
  @ApiResponse({
    status: 404,
    description: 'Config không tồn tại',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Không thể xóa system config',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthenticationGuard, PermissionsGuard)
  @Permissions(PermissionName.PERMISSION)
  @Delete(':configKey')
  @HttpCode(204)
  async deleteConfig(
    @Param('configKey') configKey: ConfigKey,
    @Req() request: RequestWithUser,
  ): Promise<void> {
    try {
      await this.systemConfigService.deleteConfig(configKey, request.user.id);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Xóa config thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiOperation({ summary: 'Toggle trạng thái active của config' })
  @ApiParam({
    name: 'configKey',
    description: 'Key của config cần toggle status',
    enum: ConfigKey,
  })
  @ApiResponse({
    status: 200,
    description: 'Toggle status thành công',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Không có quyền',
  })
  @ApiResponse({
    status: 404,
    description: 'Config không tồn tại',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthenticationGuard, PermissionsGuard)
  @Permissions(PermissionName.PERMISSION)
  @Put(':configKey/toggle-status')
  async toggleConfigStatus(
    @Param('configKey') configKey: ConfigKey,
    @Req() request: RequestWithUser,
  ): Promise<BaseResponse> {
    try {
      const config = await this.systemConfigService.toggleConfigStatus(
        configKey,
        request.user.id,
      );

      const formattedConfig = {
        ...config,
        createdAt: formatDateToISO(config.createdAt),
        updatedAt: formatDateToISO(config.updatedAt),
      };

      return HttpResponse.success(
        formattedConfig,
        `Config ${
          config.isActive ? 'đã được kích hoạt' : 'đã được vô hiệu hóa'
        }`,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Toggle status thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiOperation({ summary: 'Refresh config cache' })
  @ApiResponse({
    status: 200,
    description: 'Refresh cache thành công',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Không có quyền',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthenticationGuard, PermissionsGuard)
  @Permissions(PermissionName.PERMISSION)
  @Post('refresh-cache')
  async refreshCache(): Promise<BaseResponse> {
    try {
      await this.systemConfigService.refreshCache();
      return HttpResponse.success(
        null,
        'Config cache đã được refresh thành công',
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Refresh cache thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
