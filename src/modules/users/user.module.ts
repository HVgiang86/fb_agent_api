import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UsersService } from './user.service';
import User from './entities/users.entity';
import { Permission } from './entities/permission.entity';
import { UserPermission } from './entities/user-permission.entity';
import { UserCustomerType } from './entities/user-customer-type.entity';
import { UserSession } from './entities/user-session.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { Customer } from './entities/customer.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Permission,
      UserPermission,
      UserCustomerType,
      UserSession,
      PasswordResetToken,
      Customer,
    ]),
  ],
  controllers: [UserController],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule],
})
export class UserModule {}
