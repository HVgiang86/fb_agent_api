# API Documentation - ChatBot Banking System

## Tổng quan

Hệ thống API cho ChatBot Banking hỗ trợ các tính năng:

- Đăng nhập với JWT authentication
- Quản lý users và phân quyền
- Quản lý tệp khách hàng phụ trách
- Swagger documentation tại `/api/docs`

## Base URL

```
http://localhost:3000/api
```

## Authentication

Hệ thống sử dụng JWT Bearer token để xác thực:

```
Authorization: Bearer <your-jwt-token>
```

## API Endpoints

### 1. Authentication

#### 1.1 Đăng nhập

**Endpoint:** `POST /auth/login`

**Request Body:**

```json
{
  "username": "admin",
  "password": "password123"
}
```

**Response:**

```json
{
  "statusCode": 200,
  "message": "Đăng nhập thành công",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "userId": "uuid-string",
    "permissions": ["chat", "permission", "customer_type"],
    "customerTypes": ["individual", "business"]
  }
}
```

#### 1.2 Đổi mật khẩu

**Endpoint:** `POST /auth/change-password`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword123"
}
```

**Response:**

```json
{
  "statusCode": 200,
  "message": "Đổi mật khẩu thành công"
}
```

### 2. User Management

#### 2.1 Tạo user mới

**Endpoint:** `POST /users/create`

**Headers:** `Authorization: Bearer <token>`

**Required Permission:** `permission`

**Request Body:**

```json
{
  "username": "john_doe",
  "password": "password123",
  "fullName": "Nguyễn Văn A",
  "email": "john.doe@example.com",
  "phone": "0123456789",
  "address": "Hà Nội, Việt Nam",
  "dateOfBirth": "1990-01-01",
  "gender": "male"
}
```

**Response:**

```json
{
  "statusCode": 201,
  "message": "Tạo user thành công",
  "data": {
    "id": "uuid-string",
    "username": "john_doe",
    "fullName": "Nguyễn Văn A",
    "email": "john.doe@example.com"
  }
}
```

#### 2.2 Lấy danh sách user

**Endpoint:** `GET /users/list`

**Headers:** `Authorization: Bearer <token>`

**Required Permission:** `permission`

**Query Parameters:**

- `page` (optional): Trang (default: 1)
- `limit` (optional): Số lượng (default: 10)
- `search` (optional): Tìm kiếm theo username, fullName, email

**Response:**

```json
{
  "statusCode": 200,
  "message": "Lấy danh sách user thành công",
  "data": {
    "users": [
      {
        "id": "uuid-string",
        "username": "john_doe",
        "fullName": "Nguyễn Văn A",
        "email": "john.doe@example.com",
        "phone": "0123456789",
        "address": "Hà Nội, Việt Nam",
        "dateOfBirth": "1990-01-01",
        "gender": "male",
        "isActive": true,
        "requireChangePassword": false,
        "lastLoginAt": "2024-01-01T10:00:00Z",
        "createdAt": "2024-01-01T10:00:00Z",
        "updatedAt": "2024-01-01T10:00:00Z",
        "permissions": ["chat", "customer_type"],
        "customerTypes": ["individual", "business"]
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 10
  }
}
```

#### 2.3 Cập nhật phân quyền

**Endpoint:** `PUT /users/:userId/permissions`

**Headers:** `Authorization: Bearer <token>`

**Required Permission:** `permission`

**Request Body:**

```json
{
  "permissions": ["chat", "kb", "permission", "customer_type"]
}
```

**Response:**

```json
{
  "statusCode": 200,
  "message": "Cập nhật phân quyền thành công"
}
```

#### 2.4 Cập nhật tệp khách hàng phụ trách

**Endpoint:** `PUT /users/:userId/customer-types`

**Headers:** `Authorization: Bearer <token>`

**Required Permission:** `permission`

**Request Body:**

```json
{
  "customerTypes": ["individual", "business", "household_business", "partner"]
}
```

**Response:**

```json
{
  "statusCode": 200,
  "message": "Cập nhật tệp khách hàng phụ trách thành công"
}
```

## Enum Values

### Permission Types

- `chat`: Quyền truy cập trang chat, gửi/nhận tin nhắn
- `kb`: Quyền quản lý knowledge base
- `permission`: Quyền quản lý user và phân quyền
- `customer_type`: Quyền quản lý phân loại khách hàng

### Customer Types

- `individual`: Khách hàng cá nhân
- `business`: Khách hàng doanh nghiệp
- `household_business`: Khách hàng hộ kinh doanh
- `partner`: Khách hàng đối tác

### Gender

- `male`: Nam
- `female`: Nữ

## Error Handling

API sử dụng HTTP status codes chuẩn và trả về lỗi theo format:

```json
{
  "statusCode": 400,
  "message": "Tên đăng nhập hoặc mật khẩu không chính xác"
}
```

### Common Error Codes

- `400 Bad Request`: Dữ liệu đầu vào không hợp lệ
- `401 Unauthorized`: Chưa đăng nhập hoặc token hết hạn
- `403 Forbidden`: Không có quyền truy cập
- `404 Not Found`: Không tìm thấy resource
- `409 Conflict`: Xung đột dữ liệu (username/email đã tồn tại)
- `500 Internal Server Error`: Lỗi hệ thống

## Setup và Deployment

### 1. Cài đặt dependencies

```bash
yarn install
```

### 2. Cấu hình environment variables

```env
# Database
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DB=chatbot_db

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRATION_TIME=3600
JWT_REFRESH_EXPIRATION_TIME=7d

# Other
PORT=3000
CORS_ORIGIN=*
```

### 3. Seed database

```bash
yarn seed
```

### 4. Chạy application

```bash
# Development
yarn start:dev

# Production
yarn build
yarn start:prod
```

### 5. Truy cập Swagger documentation

```
http://localhost:3000/api/docs
```

## Database Schema

### Users Table

- `id` (UUID): Primary key
- `username` (VARCHAR 50): Tên đăng nhập (unique)
- `email` (VARCHAR 255): Email (unique)
- `password_hash` (VARCHAR 255): Mật khẩu đã hash
- `full_name` (VARCHAR 100): Họ tên
- `phone` (VARCHAR 15): Số điện thoại
- `address` (TEXT): Địa chỉ
- `date_of_birth` (DATE): Ngày sinh
- `gender` (ENUM): Giới tính
- `is_active` (BOOLEAN): Trạng thái active
- `require_change_password` (BOOLEAN): Yêu cầu đổi mật khẩu
- `last_login_at` (DATETIME): Lần đăng nhập cuối
- `failed_login_attempts` (INT): Số lần đăng nhập sai
- `locked_until` (DATETIME): Khóa tài khoản đến
- `created_at`, `updated_at`: Timestamps
- `created_by`, `updated_by`: Audit fields

### Permissions Table

- `id` (UUID): Primary key
- `name` (ENUM): Tên quyền
- `display_name` (VARCHAR 100): Tên hiển thị
- `description` (TEXT): Mô tả
- `created_at`: Timestamp

### Customer Types Table

- `id` (UUID): Primary key
- `name` (ENUM): Tên loại khách hàng
- `display_name` (VARCHAR 100): Tên hiển thị
- `description` (TEXT): Mô tả
- `is_active` (BOOLEAN): Trạng thái active
- `created_at`: Timestamp

### Junction Tables

- `user_permissions`: Many-to-many giữa Users và Permissions
- `user_customer_types`: Many-to-many giữa Users và Customer Types

## Testing

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

## Security

### Authentication

- JWT tokens với expiration time
- Refresh token mechanism
- Account lockout sau 5 lần đăng nhập sai

### Authorization

- Role-based access control (RBAC)
- Permission-based guards
- Route protection

### Data Validation

- Input validation với class-validator
- SQL injection protection với TypeORM
- XSS protection

### Password Security

- Bcrypt hashing
- Minimum password length
- Password change tracking

## Monitoring và Logging

### Application Logs

- Request/response logging
- Error tracking
- Performance monitoring

### Database Monitoring

- Query performance
- Connection pool monitoring
- Slow query detection

### Health Checks

- Database connectivity
- External service status
- Application health endpoint

## Troubleshooting

### Common Issues

1. **Database Connection Error**

   - Check MySQL service status
   - Verify connection credentials
   - Ensure database exists

2. **JWT Token Issues**

   - Check JWT_SECRET configuration
   - Verify token expiration
   - Validate token format

3. **Permission Denied**

   - Check user permissions
   - Verify guard configuration
   - Ensure proper role assignment

4. **Validation Errors**
   - Check request body format
   - Verify required fields
   - Validate data types

### Logs Location

- Application logs: Console output
- Error logs: Application error handler
- Database logs: MySQL error logs

## API Rate Limiting

Chưa implement, có thể thêm:

- Request rate limiting
- IP-based blocking
- API key authentication

## Versioning

API hiện tại sử dụng version 1.0
Future versions sẽ có prefix `/api/v2/`

## Support

Để được hỗ trợ, vui lòng:

1. Check documentation này
2. Xem Swagger docs tại `/api/docs`
3. Check logs để debug issues
4. Liên hệ development team
