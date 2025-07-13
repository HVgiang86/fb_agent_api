# ChatBot Banking System - Backend API

Hệ thống backend cho ChatBot chăm sóc khách hàng trên fanpage Facebook của ngân hàng. Được xây dựng với NestJS, TypeORM, MySQL và JWT authentication.

## 🚀 Tính năng chính

- **Authentication & Authorization**: JWT-based với role và permission management
- **User Management**: Tạo, quản lý user với phân quyền chi tiết
- **Permission System**: 4 loại quyền (chat, kb, permission, customer_type)
- **Customer Type Management**: Phân loại và phân công KH cho reviewer
- **Security**: Account lockout, password hashing, input validation
- **API Documentation**: Swagger UI tự động
- **Database**: MySQL với TypeORM, support UUID và audit fields

## 📋 Yêu cầu hệ thống

- Node.js 16+
- MySQL 8.0+
- Yarn package manager

## 🛠️ Cài đặt và Setup

### 1. Clone repository

```bash
git clone <repository-url>
cd nestjs-typeorm-mysql-jwt-boilerplate
```

### 2. Cài đặt dependencies

```bash
yarn install
```

### 3. Cấu hình environment

Tạo file `.env` từ `.env.example`:

```env
# Database Configuration
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DB=chatbot_db
MYSQL_SSL_REJECT_UNAUTHORIZED=false

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRATION_TIME=3600
JWT_REFRESH_EXPIRATION_TIME=7d

# Application Configuration
PORT=3000
CORS_ORIGIN=*
QUERY_LOG_ENABLE=false
```

### 4. Setup Database

Tạo database MySQL:

```sql
CREATE DATABASE chatbot_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 5. Seed dữ liệu cơ bản

```bash
# Tạo permissions và customer types
yarn seed

# Tạo admin user đầu tiên
yarn create-admin
```

### 6. Chạy ứng dụng

```bash
# Development mode
yarn start:dev

# Production mode
yarn build
yarn start:prod
```

Ứng dụng sẽ chạy tại: `http://localhost:3000`
Swagger documentation: `http://localhost:3000/api/docs`

## 🔑 Admin User mặc định

Sau khi chạy `yarn create-admin`:

- **Username**: `admin`
- **Password**: `password123`
- **Email**: `admin@example.com`
- **Permissions**: Tất cả permissions
- **Customer Types**: Individual

## 📚 API Documentation

### Base URL

```
http://localhost:3000/api
```

### Authentication

Tất cả API (trừ login) cần JWT token trong header:

```
Authorization: Bearer <your-jwt-token>
```

### Main Endpoints

| Method | Endpoint                    | Description           | Permission Required |
| ------ | --------------------------- | --------------------- | ------------------- |
| POST   | `/auth/login`               | Đăng nhập             | -                   |
| POST   | `/auth/change-password`     | Đổi mật khẩu          | Authenticated       |
| POST   | `/users/create`             | Tạo user mới          | `permission`        |
| GET    | `/users/list`               | Danh sách users       | `permission`        |
| PUT    | `/users/:id/permissions`    | Update permissions    | `permission`        |
| PUT    | `/users/:id/customer-types` | Update customer types | `permission`        |

### Swagger Documentation

Truy cập `http://localhost:3000/api/docs` để xem:

- Đầy đủ API documentation
- Try-it-out functionality
- Request/response schemas
- Authentication setup

## 🔧 Testing

### Unit Tests

```bash
yarn test
```

### E2E Tests

```bash
yarn test:e2e
```

### Test Coverage

```bash
yarn test:cov
```

### Manual API Testing

Xem file `test-api.md` để biết chi tiết cách test từng API endpoint.

## 🏗️ Kiến trúc Database

### Core Tables

- `users`: Thông tin user và audit fields
- `permissions`: 4 loại quyền hệ thống
- `customer_types`: 4 loại khách hàng
- `user_permissions`: Junction table user-permissions
- `user_customer_types`: Junction table user-customer_types

### Enum Values

#### Permissions

- `chat`: Quyền truy cập chat và messaging
- `kb`: Quyền quản lý knowledge base
- `permission`: Quyền quản lý user và phân quyền
- `customer_type`: Quyền quản lý loại khách hàng

#### Customer Types

- `individual`: Khách hàng cá nhân
- `business`: Khách hàng doanh nghiệp
- `household_business`: Khách hàng hộ kinh doanh
- `partner`: Khách hàng đối tác

## 🔒 Security Features

- **JWT Authentication**: Access token + refresh token
- **Password Security**: Bcrypt hashing, minimum length validation
- **Account Protection**: Lockout sau 5 lần đăng nhập sai
- **Input Validation**: Class-validator cho tất cả input
- **Authorization**: Permission-based access control
- **Audit Trail**: Created/updated by tracking
- **SQL Injection Protection**: TypeORM parameterized queries

## 📁 Cấu trúc Project

```
src/
├── modules/
│   ├── auth/              # Authentication & JWT
│   ├── users/             # User management
│   ├── database/          # Database configuration
│   └── app/               # Main app module
├── core/
│   └── filters/           # Global exception filter
├── types/                 # Shared types
└── utils/                 # Utilities

scripts/
├── seed-database.ts       # Seed permissions & customer types
└── create-admin.ts        # Create admin user
```

## 🔄 Development Workflow

### 1. Tạo migration (nếu cần)

```bash
yarn typeorm migration:generate -n MigrationName
yarn typeorm migration:run
```

### 2. Seed data mới

```bash
yarn seed
```

### 3. Test changes

```bash
yarn test
yarn start:dev
```

### 4. Check code quality

```bash
yarn lint
yarn format
```

## 🚀 Deployment

### Environment Variables for Production

```env
NODE_ENV=production
JWT_SECRET=very_secure_secret_for_production
MYSQL_SSL_REJECT_UNAUTHORIZED=true
CORS_ORIGIN=https://yourdomain.com
```

### Docker Deployment (Optional)

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN yarn install --production
COPY . .
RUN yarn build
EXPOSE 3000
CMD ["yarn", "start:prod"]
```

## 📊 Monitoring & Logging

- **Application Logs**: Console logging với levels
- **Error Tracking**: Global exception filter
- **Request Logging**: NestJS built-in logger
- **Database Queries**: Configurable query logging

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Tạo Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support & Troubleshooting

### Common Issues

1. **Database Connection Error**

   - Kiểm tra MySQL đang chạy
   - Verify credentials trong .env
   - Đảm bảo database đã được tạo

2. **JWT Errors**

   - Check JWT_SECRET trong .env
   - Verify token format
   - Check token expiration

3. **Permission Denied**
   - Kiểm tra user có đúng permission
   - Verify guard configuration

### Logs & Debugging

```bash
# Enable query logging
QUERY_LOG_ENABLE=true yarn start:dev

# Debug mode
yarn start:debug
```

### Getting Help

- Check `API-DOCUMENTATION.md` cho chi tiết API
- Xem `test-api.md` cho examples
- Check Swagger UI tại `/api/docs`
- Review source code và comments

---

**Built with ❤️ using NestJS, TypeORM, and MySQL**
