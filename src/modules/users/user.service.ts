import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/users.entity';
import { Permission, PermissionName } from './entities/permission.entity';
import { UserPermission } from './entities/user-permission.entity';
import {
  CustomerType,
  CustomerTypeName,
} from './entities/customer-type.entity';
import { UserCustomerType } from './entities/user-customer-type.entity';
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
    private permissionRepository: Repository<Permission>,
    @InjectRepository(UserPermission)
    private userPermissionRepository: Repository<UserPermission>,
    @InjectRepository(CustomerType)
    private customerTypeRepository: Repository<CustomerType>,
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
    const individualCustomerType = await this.customerTypeRepository.findOne({
      where: { name: CustomerTypeName.INDIVIDUAL },
    });

    if (individualCustomerType) {
      await this.assignCustomerType(newUser.id, individualCustomerType.id);
    }

    return newUser;
  }

  async getById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: {
        id: id,
      },
    });
    if (user) {
      return user;
    }
    throw new HttpException(
      'User with this id does not exist',
      HttpStatus.NOT_FOUND,
    );
  }

  async updateUserInfo(id: string, body: UpdateInfoBody): Promise<boolean> {
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
    const userPermissions = await this.userPermissionRepository.find({
      where: { userId },
      relations: ['permission'],
    });

    return userPermissions.map((up) => up.permission.name);
  }

  async getUserCustomerTypes(userId: string): Promise<CustomerTypeName[]> {
    const userCustomerTypes = await this.userCustomerTypeRepository.find({
      where: { userId },
      relations: ['customerType'],
    });

    return userCustomerTypes.map((uct) => uct.customerType.name);
  }

  async updateUserPermissions(
    userId: string,
    permissions: PermissionName[],
    grantedBy: string,
  ): Promise<void> {
    // Remove existing permissions
    await this.userPermissionRepository.delete({ userId });

    // Add new permissions
    if (permissions.length > 0) {
      const permissionEntities = await this.permissionRepository.find({
        where: permissions.map((name) => ({ name })),
      });

      const userPermissions = permissionEntities.map((permission) =>
        this.userPermissionRepository.create({
          userId,
          permissionId: permission.id,
          grantedBy,
        }),
      );

      await this.userPermissionRepository.save(userPermissions);
    }
  }

  async updateUserCustomerTypes(
    userId: string,
    customerTypes: CustomerTypeName[],
    assignedBy: string,
  ): Promise<void> {
    // Remove existing customer types
    await this.userCustomerTypeRepository.delete({ userId });

    // Add new customer types
    if (customerTypes.length > 0) {
      const customerTypeEntities = await this.customerTypeRepository.find({
        where: customerTypes.map((name) => ({ name })),
      });

      const userCustomerTypes = customerTypeEntities.map((customerType) =>
        this.userCustomerTypeRepository.create({
          userId,
          customerTypeId: customerType.id,
          assignedBy,
        }),
      );

      await this.userCustomerTypeRepository.save(userCustomerTypes);
    }
  }

  async assignCustomerType(
    userId: string,
    customerTypeId: string,
  ): Promise<void> {
    const userCustomerType = this.userCustomerTypeRepository.create({
      userId,
      customerTypeId,
    });

    await this.userCustomerTypeRepository.save(userCustomerType);
  }

  async getUsersWithPermissionsAndCustomerTypes(): Promise<User[]> {
    return await this.usersRepository.find({
      relations: [
        'userPermissions',
        'userPermissions.permission',
        'userCustomerTypes',
        'userCustomerTypes.customerType',
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
      const existing = await this.permissionRepository.findOne({
        where: { name: permissionData.name },
      });

      if (!existing) {
        const permission = this.permissionRepository.create({
          name: permissionData.name,
          displayName: permissionData.displayName,
          description: permissionData.description,
        });
        await this.permissionRepository.save(permission);
      }
    }
  }

  async ensureCustomerTypesExist(): Promise<void> {
    const customerTypes = [
      {
        name: CustomerTypeName.INDIVIDUAL,
        displayName: 'Khách hàng cá nhân',
        description: 'Khách hàng cá nhân',
      },
      {
        name: CustomerTypeName.BUSINESS,
        displayName: 'Khách hàng doanh nghiệp',
        description: 'Khách hàng doanh nghiệp',
      },
      {
        name: CustomerTypeName.HOUSEHOLD_BUSINESS,
        displayName: 'Khách hàng hộ kinh doanh',
        description: 'Khách hàng hộ kinh doanh',
      },
      {
        name: CustomerTypeName.PARTNER,
        displayName: 'Khách hàng đối tác',
        description: 'Khách hàng đối tác',
      },
    ];

    for (const customerTypeData of customerTypes) {
      const existing = await this.customerTypeRepository.findOne({
        where: { name: customerTypeData.name },
      });

      if (!existing) {
        const customerType = this.customerTypeRepository.create({
          name: customerTypeData.name,
          displayName: customerTypeData.displayName,
          description: customerTypeData.description,
          isActive: true,
        });
        await this.customerTypeRepository.save(customerType);
      }
    }
  }

  async assignAllPermissionsToUser(userId: string): Promise<void> {
    const permissions = await this.permissionRepository.find();

    for (const permission of permissions) {
      const existing = await this.userPermissionRepository.findOne({
        where: { userId, permissionId: permission.id },
      });

      if (!existing) {
        const userPermission = this.userPermissionRepository.create({
          userId,
          permissionId: permission.id,
          grantedBy: userId, // Self-granted for admin
        });
        await this.userPermissionRepository.save(userPermission);
      }
    }
  }

  async assignCustomerTypeToUser(
    userId: string,
    customerTypeName: CustomerTypeName,
  ): Promise<void> {
    const customerType = await this.customerTypeRepository.findOne({
      where: { name: customerTypeName },
    });

    if (!customerType) {
      throw new HttpException(
        'Customer type không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    const existing = await this.userCustomerTypeRepository.findOne({
      where: { userId, customerTypeId: customerType.id },
    });

    if (!existing) {
      const userCustomerType = this.userCustomerTypeRepository.create({
        userId,
        customerTypeId: customerType.id,
        assignedBy: userId, // Self-assigned for admin
      });
      await this.userCustomerTypeRepository.save(userCustomerType);
    }
  }
}
