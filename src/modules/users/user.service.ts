import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/users.entity';
import { Permission, PermissionName } from './entities/permission.entity';
import { UserPermission } from './entities/user-permission.entity';
import { UserCustomerType } from './entities/user-customer-type.entity';
import { CustomerType } from '../chat/types/enums';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateInfoBody } from './types/update-info-body';
import safeStringify from 'fast-safe-stringify';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Permission)
    private permissionsRepository: Repository<Permission>,
    @InjectRepository(UserPermission)
    private userPermissionsRepository: Repository<UserPermission>,
    @InjectRepository(UserCustomerType)
    private userCustomerTypeRepository: Repository<UserCustomerType>,
  ) {}

  async getByUsername(username: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: {
        username: username,
      },
    });
    if (user) {
      return user;
    }
    throw new HttpException(
      'User with this username does not exist',
      HttpStatus.NOT_FOUND,
    );
  }

  async create(userData: CreateUserDto, createdBy?: string): Promise<User> {
    // Check if username or email already exists
    const existingUser = await this.usersRepository.findOne({
      where: [{ username: userData.username }, { email: userData.email }],
    });

    if (existingUser) {
      throw new HttpException(
        'Username hoặc email đã tồn tại',
        HttpStatus.CONFLICT,
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    // Create user
    const newUser = this.usersRepository.create({
      ...userData,
      passwordHash: hashedPassword,
      dateOfBirth: userData.dateOfBirth ? new Date(userData.dateOfBirth) : null,
      createdBy,
    });

    await this.usersRepository.save(newUser);

    // Assign default individual customer type
    // const individualCustomerType = await this.customerTypeRepository.findOne({
    //   where: { name: CustomerTypeName.INDIVIDUAL },
    // });

    // if (individualCustomerType) {
    //   await this.assignCustomerType(newUser.id, individualCustomerType.id);
    // }

    return newUser;
  }

  async getById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: {
        id: id,
      },
    });
    if (user) {
      // Debug logging to check data types
      this.logger.debug(
        'User dateOfBirth type:',
        typeof user.dateOfBirth,
        user.dateOfBirth,
      );
      this.logger.debug(
        'User lastLoginAt type:',
        typeof user.lastLoginAt,
        user.lastLoginAt,
      );
      this.logger.debug(
        'User createdAt type:',
        typeof user.createdAt,
        user.createdAt,
      );
      return user;
    }
    throw new HttpException(
      'User with this id does not exist',
      HttpStatus.NOT_FOUND,
    );
  }

  async userExists(id: string): Promise<boolean> {
    const count = await this.usersRepository.count({
      where: { id },
    });
    return count > 0;
  }

  async updateUserInfo(id: string, body: Partial<User>): Promise<boolean> {
    try {
      const updateResult = await this.usersRepository.update(id, body);
      if (updateResult.affected > 0) {
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error('Error updating user info:', safeStringify(error));
      return false;
    }
  }

  async getUserPermissions(userId: string): Promise<PermissionName[]> {
    const userPermissions = await this.userPermissionsRepository.find({
      where: { userId },
      relations: ['permission'],
    });

    return userPermissions.map((up) => up.permission.name);
  }

  async getUserCustomerTypes(userId: string): Promise<CustomerType[]> {
    const userCustomerTypes = await this.userCustomerTypeRepository.find({
      where: { userId },
    });

    return userCustomerTypes.map((uct) => uct.customerType);
  }

  async updateUserPermissions(
    userId: string,
    permissions: PermissionName[],
    grantedBy: string,
  ): Promise<void> {
    // Remove existing permissions
    await this.userPermissionsRepository.delete({ userId });

    // Add new permissions
    if (permissions.length > 0) {
      const permissionEntities = await this.permissionsRepository.find({
        where: permissions.map((name) => ({ name })),
      });

      const userPermissions = permissionEntities.map((permission) =>
        this.userPermissionsRepository.create({
          userId,
          permissionId: permission.id,
          grantedBy,
        }),
      );

      await this.userPermissionsRepository.save(userPermissions);
    }
  }

  async updateUserCustomerTypes(
    userId: string,
    customerTypes: CustomerType[],
    assignedBy: string,
  ): Promise<void> {
    // Remove existing customer types
    await this.userCustomerTypeRepository.delete({ userId });

    // Add new customer types
    if (customerTypes.length > 0) {
      const userCustomerTypes = customerTypes.map((customerType) =>
        this.userCustomerTypeRepository.create({
          userId,
          customerType,
          assignedBy,
        }),
      );

      await this.userCustomerTypeRepository.save(userCustomerTypes);
    }
  }

  async assignCustomerType(
    userId: string,
    customerType: CustomerType,
  ): Promise<void> {
    const existingUserCustomerType =
      await this.userCustomerTypeRepository.findOne({
        where: { userId, customerType },
      });

    if (!existingUserCustomerType) {
      const userCustomerType = this.userCustomerTypeRepository.create({
        userId,
        customerType,
        assignedBy: userId, // Self-assigned
      });
      await this.userCustomerTypeRepository.save(userCustomerType);
    }
  }

  async getUsersWithPermissionsAndCustomerTypes(): Promise<User[]> {
    return await this.usersRepository.find({
      relations: [
        'userPermissions',
        'userPermissions.permission',
        'userCustomerTypes',
      ],
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.getById(userId);

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new HttpException(
        'Mật khẩu hiện tại không chính xác',
        HttpStatus.BAD_REQUEST,
      );
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.update(userId, {
      passwordHash: hashedNewPassword,
      requireChangePassword: false,
    });
  }

  async updateLastLogin(userId: string): Promise<void> {
    try {
      await this.usersRepository.update(userId, {
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
    } catch (error) {
      this.logger.error('Error updating last login:', error);
      throw new HttpException(
        'Không thể cập nhật thông tin đăng nhập',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createUser(userData: {
    username: string;
    email: string;
    password: string;
    fullName: string;
  }): Promise<User> {
    try {
      const newUser = this.usersRepository.create({
        username: userData.username,
        email: userData.email,
        passwordHash: userData.password,
        fullName: userData.fullName,
        isActive: true,
        requireChangePassword: false,
        failedLoginAttempts: 0,
      });

      return await this.usersRepository.save(newUser);
    } catch (error) {
      this.logger.error('Error creating user:', error);
      throw new HttpException(
        'Không thể tạo tài khoản',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async ensurePermissionsExist(): Promise<void> {
    const permissions = [
      {
        name: PermissionName.CHAT,
        displayName: 'Chat Permission',
        description: 'Quyền truy cập trang chat, gửi/nhận tin nhắn',
      },
      {
        name: PermissionName.KB,
        displayName: 'Knowledge Base',
        description: 'Quyền quản lý knowledge base (chưa triển khai)',
      },
      {
        name: PermissionName.PERMISSION,
        displayName: 'Permission Management',
        description: 'Quyền quản lý user và phân quyền',
      },
      {
        name: PermissionName.CUSTOMER_TYPE,
        displayName: 'Customer Type Management',
        description: 'Quyền quản lý phân loại khách hàng',
      },
    ];

    for (const permissionData of permissions) {
      const existing = await this.permissionsRepository.findOne({
        where: { name: permissionData.name },
      });

      if (!existing) {
        const permission = this.permissionsRepository.create({
          name: permissionData.name,
          displayName: permissionData.displayName,
          description: permissionData.description,
        });
        await this.permissionsRepository.save(permission);
      }
    }
  }

  async ensureCustomerTypesExist(): Promise<void> {
    // CustomerType is now an enum, no database records needed
    // This function is kept for backward compatibility but does nothing
  }

  async assignAllPermissionsToUser(userId: string): Promise<void> {
    const permissions = await this.permissionsRepository.find();

    for (const permission of permissions) {
      const existing = await this.userPermissionsRepository.findOne({
        where: { userId, permissionId: permission.id },
      });

      if (!existing) {
        const userPermission = this.userPermissionsRepository.create({
          userId,
          permissionId: permission.id,
          grantedBy: userId, // Self-granted for admin
        });
        await this.userPermissionsRepository.save(userPermission);
      }
    }
  }

  async assignCustomerTypeToUser(
    userId: string,
    customerTypeName: CustomerType,
  ): Promise<void> {
    await this.assignCustomerType(userId, customerTypeName);
  }

  async updateUserStatus(
    userId: string,
    isActive: boolean,
    updatedBy: string,
  ): Promise<boolean> {
    try {
      const updateResult = await this.usersRepository.update(userId, {
        isActive,
        updatedBy,
      });

      if (updateResult.affected > 0) {
        this.logger.log(
          `User ${userId} status updated to ${
            isActive ? 'active' : 'inactive'
          } by ${updatedBy}`,
        );
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error('Error updating user status:', safeStringify(error));
      throw new HttpException(
        'Cập nhật trạng thái user thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
