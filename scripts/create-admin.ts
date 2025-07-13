import { DataSource } from 'typeorm';
import { User } from '../src/modules/users/entities/users.entity';
import {
  Permission,
  PermissionName,
} from '../src/modules/users/entities/permission.entity';
import { UserPermission } from '../src/modules/users/entities/user-permission.entity';
import {
  CustomerType,
  CustomerTypeName,
} from '../src/modules/users/entities/customer-type.entity';
import { UserCustomerType } from '../src/modules/users/entities/user-customer-type.entity';
import { UserSession } from '../src/modules/users/entities/user-session.entity';
import { PasswordResetToken } from '../src/modules/users/entities/password-reset-token.entity';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  username: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DB || 'chatbot_db',
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
  logging: false,
});

async function createAdminUser() {
  try {
    console.log('Initializing database connection...');
    await dataSource.initialize();
    console.log('Database connection established');

    const userRepository = dataSource.getRepository(User);
    const permissionRepository = dataSource.getRepository(Permission);
    const userPermissionRepository = dataSource.getRepository(UserPermission);
    const customerTypeRepository = dataSource.getRepository(CustomerType);
    const userCustomerTypeRepository =
      dataSource.getRepository(UserCustomerType);

    // Check if admin user already exists
    const existingAdmin = await userRepository.findOne({
      where: { username: 'admin' },
    });

    if (existingAdmin) {
      console.log('Admin user already exists');
      await dataSource.destroy();
      process.exit(0);
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash('password123', 10);
    const adminUser = userRepository.create({
      username: 'admin',
      email: 'admin@example.com',
      passwordHash: hashedPassword,
      fullName: 'System Administrator',
      isActive: true,
    });

    await userRepository.save(adminUser);
    console.log('Admin user created successfully');

    // Get all permissions
    const permissions = await permissionRepository.find();
    console.log(`Found ${permissions.length} permissions`);

    // Grant all permissions to admin
    for (const permission of permissions) {
      const userPermission = userPermissionRepository.create({
        userId: adminUser.id,
        permissionId: permission.id,
      });
      await userPermissionRepository.save(userPermission);
      console.log(`Granted permission: ${permission.name}`);
    }

    // Get individual customer type
    const individualCustomerType = await customerTypeRepository.findOne({
      where: { name: CustomerTypeName.INDIVIDUAL },
    });

    if (individualCustomerType) {
      const userCustomerType = userCustomerTypeRepository.create({
        userId: adminUser.id,
        customerTypeId: individualCustomerType.id,
      });
      await userCustomerTypeRepository.save(userCustomerType);
      console.log('Assigned individual customer type to admin');
    }

    console.log('\n=== Admin User Created Successfully ===');
    console.log('Username: admin');
    console.log('Password: password123');
    console.log('Email: admin@example.com');
    console.log('Permissions: All permissions granted');
    console.log('Customer Types: Individual');
    console.log('\nYou can now login with these credentials to test the API');

    await dataSource.destroy();
    console.log('Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error);
    await dataSource.destroy();
    process.exit(1);
  }
}

createAdminUser();
