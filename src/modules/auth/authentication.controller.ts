import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
  Request,
  Get,
} from '@nestjs/common';
import { AuthenticationService } from './authentication.service';
import { LoginDto } from './dto/login.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import JwtAuthenticationGuard from './jwt-authentication.guard';
import { ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { HttpResponse, BaseResponse } from '../../types/http-response';

@ApiTags('Authentication')
@Controller('auth')
export class AuthenticationController {
  constructor(private readonly authenticationService: AuthenticationService) {}

  @Get('runscript')
  @ApiOperation({ summary: 'Test endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Returns test message',
  })
  async runScript(): Promise<BaseResponse<string>> {
    return HttpResponse.success('Authentication module is working!');
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
  })
  async login(@Body() loginDto: LoginDto): Promise<BaseResponse<any>> {
    try {
      const result = await this.authenticationService.login(loginDto);
      return HttpResponse.success(result, 'Đăng nhập thành công');
    } catch (error) {
      return HttpResponse.error(error.message, error.status);
    }
  }

  @Post('create-admin')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create admin account' })
  @ApiResponse({
    status: 201,
    description: 'Admin account created successfully',
  })
  @ApiResponse({
    status: 409,
    description: 'Admin account already exists',
  })
  async createAdmin(
    @Body() createAdminDto: CreateAdminDto,
  ): Promise<BaseResponse<any>> {
    try {
      const result = await this.authenticationService.createAdmin(
        createAdminDto,
      );
      return HttpResponse.success(result, 'Tạo tài khoản admin thành công');
    } catch (error) {
      return HttpResponse.error(error.message, error.status);
    }
  }

  @Post('change-password')
  @UseGuards(JwtAuthenticationGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Change password' })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async changePassword(
    @Request() req: any,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<BaseResponse<null>> {
    try {
      await this.authenticationService.changePassword(
        req.user.id,
        changePasswordDto,
      );
      return HttpResponse.success(null, 'Đổi mật khẩu thành công');
    } catch (error) {
      return HttpResponse.error(error.message, error.status);
    }
  }

  @Post('log-out')
  @UseGuards(JwtAuthenticationGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'User logout' })
  @ApiResponse({
    status: 200,
    description: 'Logout successful',
  })
  async logOut(): Promise<BaseResponse<null>> {
    return HttpResponse.success(null, 'Đăng xuất thành công');
  }
}
