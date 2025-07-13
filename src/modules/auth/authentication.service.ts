import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { UsersService } from '../users/user.service';
import { JwtPayload } from './intefaces/token-payload.interface';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { PermissionName } from '../users/entities/permission.entity';
import { CustomerTypeName } from '../users/entities/customer-type.entity';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  userId: string;
  permissions: PermissionName[];
  customerTypes: CustomerTypeName[];
}

@Injectable()
export class AuthenticationService {
  private readonly logger = new Logger(AuthenticationService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  public async getAuthenticatedUser(
    username: string,
    originalPassword: string,
  ) {
    try {
      const user = await this.usersService.getByUsername(username);

      // Check if user is active
      if (!user.isActive) {
        throw new HttpException('Tài khoản đã bị khóa', HttpStatus.FORBIDDEN);
      }

      // Check if account is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        throw new HttpException(
          'Tài khoản đã bị khóa tạm thời',
          HttpStatus.FORBIDDEN,
        );
      }

      const isPasswordMatching = await bcrypt.compare(
        originalPassword,
        user.passwordHash,
      );

      if (!isPasswordMatching) {
        // Increment failed login attempts
        await this.handleFailedLogin(user);
        throw new HttpException(
          'Tên đăng nhập hoặc mật khẩu không chính xác',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Update last login
      await this.usersService.updateLastLogin(user.id);

      return user;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Tên đăng nhập hoặc mật khẩu không chính xác',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async handleFailedLogin(user: any): Promise<void> {
    const maxAttempts = 5;
    const lockDuration = 30 * 60 * 1000; // 30 minutes in milliseconds

    const failedAttempts = user.failedLoginAttempts + 1;

    if (failedAttempts >= maxAttempts) {
      const lockedUntil = new Date(Date.now() + lockDuration);
      await this.usersService.updateUserInfo(user.id, {
        failedLoginAttempts: failedAttempts,
        lockedUntil,
      });
    } else {
      await this.usersService.updateUserInfo(user.id, {
        failedLoginAttempts: failedAttempts,
      });
    }
  }

  public async login(loginData: LoginDto): Promise<LoginResponse> {
    const user = await this.getAuthenticatedUser(
      loginData.username,
      loginData.password,
    );

    const payload: JwtPayload = {
      userId: user.id,
      username: user.username,
      name: user.fullName,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION_TIME', '7d'),
    });

    // Get user permissions and customer types
    const permissions = await this.usersService.getUserPermissions(user.id);
    const customerTypes = await this.usersService.getUserCustomerTypes(user.id);

    return {
      accessToken,
      refreshToken,
      userId: user.id,
      permissions,
      customerTypes,
    };
  }

  public async changePassword(
    userId: string,
    changePasswordData: ChangePasswordDto,
  ): Promise<void> {
    await this.usersService.changePassword(
      userId,
      changePasswordData.currentPassword,
      changePasswordData.newPassword,
    );
  }

  public async validateToken(token: string): Promise<JwtPayload> {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new HttpException('Token không hợp lệ', HttpStatus.UNAUTHORIZED);
    }
  }

  public async refreshToken(
    refreshToken: string,
  ): Promise<{ accessToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_TOKEN_SECRET'),
      });

      const accessToken = this.jwtService.sign(
        { userId: payload.userId },
        {
          secret: this.configService.get('JWT_ACCESS_TOKEN_SECRET'),
          expiresIn: this.configService.get('JWT_ACCESS_TOKEN_EXPIRATION'),
        },
      );

      return { accessToken };
    } catch (error) {
      throw new HttpException('Token không hợp lệ', HttpStatus.UNAUTHORIZED);
    }
  }

  public async createAdmin(adminData: {
    username: string;
    email: string;
    password: string;
    fullName: string;
  }): Promise<any> {
    try {
      // Check if admin already exists
      const existingUser = await this.usersService
        .getByUsername(adminData.username)
        .catch(() => null);

      if (existingUser) {
        throw new HttpException(
          'Tài khoản admin đã tồn tại',
          HttpStatus.CONFLICT,
        );
      }

      // Create admin user
      const hashedPassword = await bcrypt.hash(adminData.password, 10);

      const adminUser = await this.usersService.createUser({
        username: adminData.username,
        email: adminData.email,
        password: hashedPassword,
        fullName: adminData.fullName,
      });

      // Ensure all permissions exist
      await this.usersService.ensurePermissionsExist();

      // Ensure customer types exist
      await this.usersService.ensureCustomerTypesExist();

      // Assign all permissions to admin
      await this.usersService.assignAllPermissionsToUser(adminUser.id);

      // Assign individual customer type to admin
      await this.usersService.assignCustomerTypeToUser(
        adminUser.id,
        'individual' as CustomerTypeName,
      );

      this.logger.log(`Admin account created: ${adminData.username}`);

      return {
        id: adminUser.id,
        username: adminUser.username,
        email: adminUser.email,
        fullName: adminUser.fullName,
        permissions: ['chat', 'kb', 'permission', 'customer_type'],
        customerTypes: ['individual'],
      };
    } catch (error) {
      this.logger.error('Error creating admin account:', error);
      throw error;
    }
  }
}
