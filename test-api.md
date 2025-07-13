# Test API Guide

## 1. Setup Environment

Trước khi test, cần setup database và seed dữ liệu:

```bash
# 1. Install dependencies
yarn install

# 2. Seed database (tạo permissions và customer types)
yarn seed

# 3. Start application
yarn start:dev
```

Application sẽ chạy tại: `http://localhost:3000`
Swagger docs: `http://localhost:3000/api/docs`

## 2. Tạo Admin User (Master)

Vì hệ thống cần có admin master để tạo user khác, bạn cần tạo user đầu tiên bằng cách:

1. Connect trực tiếp vào database
2. Hoặc tạm thời disable auth guard để tạo user đầu tiên

### Option 1: Tạo user qua database

```sql
-- Connect to MySQL
USE chatbot_db;

-- Insert admin user
INSERT INTO users (
  id,
  username,
  email,
  password_hash,
  full_name,
  is_active,
  created_at,
  updated_at
) VALUES (
  UUID(),
  'admin',
  'admin@example.com',
  '$2b$10$hash_of_password_123', -- bcrypt hash of 'password123'
  'System Administrator',
  1,
  NOW(),
  NOW()
);

-- Get user ID
SET @admin_user_id = (SELECT id FROM users WHERE username = 'admin');

-- Get permission IDs
SET @permission_id = (SELECT id FROM permissions WHERE name = 'permission');
SET @chat_id = (SELECT id FROM permissions WHERE name = 'chat');
SET @kb_id = (SELECT id FROM permissions WHERE name = 'kb');
SET @customer_type_id = (SELECT id FROM permissions WHERE name = 'customer_type');

-- Grant all permissions to admin
INSERT INTO user_permissions (id, user_id, permission_id, granted_at) VALUES
(UUID(), @admin_user_id, @permission_id, NOW()),
(UUID(), @admin_user_id, @chat_id, NOW()),
(UUID(), @admin_user_id, @kb_id, NOW()),
(UUID(), @admin_user_id, @customer_type_id, NOW());

-- Get individual customer type ID
SET @individual_type_id = (SELECT id FROM customer_types WHERE name = 'individual');

-- Assign individual customer type
INSERT INTO user_customer_types (id, user_id, customer_type_id, assigned_at) VALUES
(UUID(), @admin_user_id, @individual_type_id, NOW());
```

### Option 2: Tạo script seed admin

```bash
# Create a one-time admin creation script
node -e "
const bcrypt = require('bcrypt');
console.log('Password hash for admin:', bcrypt.hashSync('password123', 10));
"
```

## 3. Test APIs với cURL/Postman

### 3.1 Test Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "password123"
  }'
```

**Expected Response:**

```json
{
  "statusCode": 200,
  "message": "Đăng nhập thành công",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "userId": "uuid-string",
    "permissions": ["chat", "kb", "permission", "customer_type"],
    "customerTypes": ["individual"]
  }
}
```

### 3.2 Test Create User

```bash
# Save the access token from login response
TOKEN="your_access_token_here"

curl -X POST http://localhost:3000/api/users/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "username": "john_doe",
    "password": "password123",
    "fullName": "Nguyễn Văn A",
    "email": "john.doe@example.com",
    "phone": "0123456789",
    "address": "Hà Nội, Việt Nam",
    "dateOfBirth": "1990-01-01",
    "gender": "male"
  }'
```

**Expected Response:**

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

### 3.3 Test List Users

```bash
curl -X GET "http://localhost:3000/api/users/list?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

### 3.4 Test Update Permissions

```bash
# Get user ID from list users response
USER_ID="user_uuid_here"

curl -X PUT http://localhost:3000/api/users/$USER_ID/permissions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "permissions": ["chat", "customer_type"]
  }'
```

### 3.5 Test Update Customer Types

```bash
curl -X PUT http://localhost:3000/api/users/$USER_ID/customer-types \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "customerTypes": ["individual", "business"]
  }'
```

### 3.6 Test Change Password

```bash
curl -X POST http://localhost:3000/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "currentPassword": "password123",
    "newPassword": "newpassword123"
  }'
```

## 4. Test Error Cases

### 4.1 Test Unauthorized Access

```bash
# Without token
curl -X GET http://localhost:3000/api/users/list

# Expected: 401 Unauthorized
```

### 4.2 Test Insufficient Permissions

```bash
# Login as a user without 'permission' privilege
# Try to create user - should get 403 Forbidden
```

### 4.3 Test Validation Errors

```bash
# Invalid email format
curl -X POST http://localhost:3000/api/users/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "username": "test",
    "password": "123",
    "fullName": "Test User",
    "email": "invalid-email"
  }'

# Expected: 400 Bad Request with validation errors
```

### 4.4 Test Duplicate User

```bash
# Try to create user with existing username/email
# Expected: 409 Conflict
```

## 5. Check Swagger Documentation

Truy cập: `http://localhost:3000/api/docs`

Swagger UI sẽ hiển thị:

- All API endpoints
- Request/response schemas
- Try-it-out functionality
- Authentication setup

## 6. Verify Database Changes

```sql
-- Check users table
SELECT id, username, email, full_name, is_active, created_at FROM users;

-- Check user permissions
SELECT
  u.username,
  p.name as permission_name,
  up.granted_at
FROM users u
JOIN user_permissions up ON u.id = up.user_id
JOIN permissions p ON up.permission_id = p.id;

-- Check user customer types
SELECT
  u.username,
  ct.name as customer_type_name,
  uct.assigned_at
FROM users u
JOIN user_customer_types uct ON u.id = uct.user_id
JOIN customer_types ct ON uct.customer_type_id = ct.id;
```

## 7. Troubleshooting

### Common Issues:

1. **Database Connection Error**

   - Check MySQL is running
   - Verify .env configuration
   - Check database exists

2. **JWT Secret Missing**

   - Set JWT_SECRET in .env file
   - Example: `JWT_SECRET=your_super_secret_key_here`

3. **Seed Data Missing**

   - Run `yarn seed` to create permissions and customer types
   - Check database has required tables

4. **CORS Errors**
   - Application already configured for CORS
   - Set CORS_ORIGIN in .env if needed

### Logs to Check:

```bash
# Application logs
yarn start:dev

# Database queries (if enabled)
# Set QUERY_LOG_ENABLE=true in .env
```

## 8. Performance Testing

```bash
# Install ab (Apache Bench) for load testing
# Test login endpoint
ab -n 100 -c 10 -p login.json -T application/json http://localhost:3000/api/auth/login

# login.json content:
{
  "username": "admin",
  "password": "password123"
}
```

## 9. Security Testing

### Test JWT Token Expiration

1. Login to get token
2. Wait for token to expire (default: 1 hour)
3. Try API call - should get 401

### Test Account Lockout

1. Try login with wrong password 5 times
2. Account should be locked for 30 minutes
3. Verify in database: `locked_until` field

### Test Input Validation

- SQL injection attempts
- XSS payload in request body
- Very long strings
- Invalid data types

## 10. Next Steps

After verifying all APIs work:

1. Set up proper admin user
2. Create test users with different permission sets
3. Test the complete user workflow
4. Integrate with frontend application
5. Set up monitoring and logging

---

**Note:** Đây là hệ thống test cơ bản. Trong production cần:

- Comprehensive unit tests
- Integration tests
- E2E tests
- Security auditing
- Performance monitoring
