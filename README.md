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

### 6. Chạy ứng dụng

```bash
# Development mode
yarn start:dev
```

Ứng dụng sẽ chạy tại: `http://localhost:3000`
Swagger documentation: `http://localhost:3000/api/docs`

## 🔑 Admin User mặc định

Sau khi chạy `yarn create-admin`:

- **Username**: `admin`
- **Password**: `123456`
- **Email**: `admin@example.com`
- **Permissions**: Tất cả permissions
- **Customer Types**: Individual

### Documentation

**SWAGGER**

- Check Swagger UI tại `/api/docs`

---

### Kết nối cho đầu FACEBOOK

Đầu FB khi có tin nhắn mới sẽ gọi webhook: localhost:3000/api/webhook/facebook
Document swagger: http://localhost:3000/api/docs/#/Webhook/WebhookController_handleWebhook
BODY:
{
"messageId": "id23456789",
"content": "Xin chào, tôi muốn hỏi về sản phẩm thẻ tín dụng",
"timestamp": "2024-01-01T10:00:00.000Z",
"customerInfo": {
"facebookId": "fb_123456789",
"facebookName": "Nguyễn Văn A",
"profileUrl": "https://facebook.com/profile/123456789",
"avatarUrl": "https://scontent.xx.fbcdn.net/v/avatar.jpg"
}
}

Trong đó messageId là id của tin nhắn trên FB (hoặc đầu FB có thể truyền vào customer facebook Id), content là nội dung tin nhắn, timestamp là thời gian tin nhắn, customerInfo là thông tin khách hàng.

Hàm trả kết quả luồng xử lý tin nhắn là hàm returnToFacebook trong file webhook-message.service.ts.
Data trả về hàm này là facebookId: data.facebookId, content: data.content,

**Built with ❤️ using NestJS, TypeORM, and MySQL**
