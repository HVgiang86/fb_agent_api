import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../users/entities/users.entity';
import { Permission } from '../users/entities/permission.entity';
import { UserPermission } from '../users/entities/user-permission.entity';
import { CustomerType } from '../users/entities/customer-type.entity';
import { UserCustomerType } from '../users/entities/user-customer-type.entity';
import { UserSession } from '../users/entities/user-session.entity';
import { PasswordResetToken } from '../users/entities/password-reset-token.entity';
import * as fs from 'fs';
import * as path from 'path';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // Đọc CA certificate file từ thư mục cert
        const caCertPath = path.resolve('cert/mysql-digital-ocean.crt');
        const ssl = fs.existsSync(caCertPath)
          ? {
              ca: fs.readFileSync(caCertPath),
              rejectUnauthorized:
                configService.get('MYSQL_SSL_REJECT_UNAUTHORIZED') !== 'false',
            }
          : false;

        return {
          type: 'mysql',
          host: configService.get('MYSQL_HOST'),
          port: configService.get('MYSQL_PORT'),
          username: configService.get('MYSQL_USER'),
          password: configService.get('MYSQL_PASSWORD'),
          database: configService.get('MYSQL_DB'),
          entities: [
            User,
            Permission,
            UserPermission,
            CustomerType,
            UserCustomerType,
            UserSession,
            PasswordResetToken,
          ],
          synchronize: true,
          logging: configService.get('QUERY_LOG_ENABLE')
            ? ['query', 'error']
            : [],
          ssl: ssl,
          extra: ssl
            ? {
                ssl: ssl,
              }
            : undefined,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
