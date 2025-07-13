import { DataSource } from 'typeorm';
import { seedDatabase } from '../src/database/seeds/seed';
import { User } from '../src/modules/users/entities/users.entity';
import { Permission } from '../src/modules/users/entities/permission.entity';
import { UserPermission } from '../src/modules/users/entities/user-permission.entity';
import { CustomerType } from '../src/modules/users/entities/customer-type.entity';
import { UserCustomerType } from '../src/modules/users/entities/user-customer-type.entity';
import { UserSession } from '../src/modules/users/entities/user-session.entity';
import { PasswordResetToken } from '../src/modules/users/entities/password-reset-token.entity';
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

async function runSeed() {
  try {
    console.log('Initializing database connection...');
    await dataSource.initialize();
    console.log('Database connection established');

    console.log('Starting database seeding...');
    await seedDatabase(dataSource);
    console.log('Database seeding completed successfully');

    await dataSource.destroy();
    console.log('Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error during database seeding:', error);
    await dataSource.destroy();
    process.exit(1);
  }
}

runSeed();
