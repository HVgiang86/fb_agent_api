# Tài liệu cấu trúc Database - Hệ thống ChatBot Banking

## Tổng quan

Database được thiết kế cho hệ thống ChatBot chăm sóc khách hàng trên fanpage Facebook của ngân hàng. Sử dụng MySQL 8.0+ với các tính năng như JSON, UUID functions, và full-text search.

## Kiến trúc Database

### Các nhóm bảng chính:

1. **Authentication & Authorization**: `users`, `permissions`, `user_permissions`, `user_sessions`, `password_reset_tokens`
2. **Customer Management**: `customers`, `customer_types`, `user_customer_types`
3. **Conversation & Messaging**: `conversations`, `messages`, `message_queue`
4. **System**: `system_configs`, `audit_logs`, `reviewer_feedback`

## Chi tiết các bảng

### 1. Bảng Users

**Mục đích**: Quản lý tài khoản người dùng hệ thống (admin, reviewer)

```sql
CREATE TABLE users (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(15) NULL,
    is_active BOOLEAN DEFAULT TRUE,
    require_change_password BOOLEAN DEFAULT FALSE,
    last_login_at DATETIME NULL,
    failed_login_attempts INT DEFAULT 0,
    locked_until DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by CHAR(36) NULL,
    updated_by CHAR(36) NULL,

    INDEX idx_users_username (username),
    INDEX idx_users_email (email),
    INDEX idx_users_is_active (is_active),

    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);
```

**Chức năng chính:**

- Lưu trữ thông tin đăng nhập
- Quản lý trạng thái tài khoản (active/inactive)
- Theo dõi số lần đăng nhập sai
- Hỗ trợ tính năng đổi mật khẩu bắt buộc

### 2. Bảng Permissions

**Mục đích**: Định nghĩa các quyền trong hệ thống

```sql
CREATE TABLE permissions (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name ENUM('chat', 'kb', 'permission', 'customer_type') UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_permissions_name (name)
);
```

**Các quyền:**

- `chat`: Quyền truy cập trang chat, gửi/nhận tin nhắn
- `kb`: Quyền quản lý knowledge base (chưa triển khai)
- `permission`: Quyền quản lý user và phân quyền
- `customer_type`: Quyền quản lý phân loại khách hàng

### 3. Bảng User_Permissions

**Mục đích**: Phân quyền cho từng user (many-to-many relationship)

```sql
CREATE TABLE user_permissions (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    permission_id CHAR(36) NOT NULL,
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    granted_by CHAR(36) NULL,

    INDEX idx_user_permissions_user (user_id),
    INDEX idx_user_permissions_permission (permission_id),
    UNIQUE KEY unique_user_permission (user_id, permission_id),

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
);
```

### 4. Bảng Customer_Types

**Mục đích**: Phân loại khách hàng

```sql
CREATE TABLE customer_types (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name ENUM('individual', 'business', 'household_business', 'partner') UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_customer_types_name (name),
    INDEX idx_customer_types_is_active (is_active)
);
```

**Các loại khách hàng:**

- `individual`: Khách hàng cá nhân
- `business`: Khách hàng doanh nghiệp
- `household_business`: Khách hàng hộ kinh doanh
- `partner`: Khách hàng đối tác

### 5. Bảng User_Customer_Types

**Mục đích**: Phân công reviewer phụ trách loại khách hàng nào

```sql
CREATE TABLE user_customer_types (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    customer_type_id CHAR(36) NOT NULL,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    assigned_by CHAR(36) NULL,

    INDEX idx_user_customer_types_user (user_id),
    INDEX idx_user_customer_types_type (customer_type_id),
    UNIQUE KEY unique_user_customer_type (user_id, customer_type_id),

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_type_id) REFERENCES customer_types(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
);
```

### 6. Bảng Customers

**Mục đích**: Lưu trữ thông tin khách hàng từ Facebook và phân tích AI

```sql
CREATE TABLE customers (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    facebook_id VARCHAR(100) UNIQUE NOT NULL,
    facebook_name VARCHAR(255) NULL,
    facebook_profile_url TEXT NULL,
    facebook_avatar_url TEXT NULL,
    phone VARCHAR(15) NULL,
    email VARCHAR(255) NULL,

    -- Thông tin phân tích từ AI
    customer_type_id CHAR(36) NULL,
    intent_analysis JSON NULL,
    behavior_analysis JSON NULL,
    interaction_history JSON NULL,

    -- Metadata
    first_interaction_at DATETIME NULL,
    last_interaction_at DATETIME NULL,
    total_conversations INT DEFAULT 0,
    total_messages INT DEFAULT 0,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_customers_facebook_id (facebook_id),
    INDEX idx_customers_customer_type (customer_type_id),
    INDEX idx_customers_last_interaction (last_interaction_at),
    INDEX idx_customers_email (email),

    FOREIGN KEY (customer_type_id) REFERENCES customer_types(id) ON DELETE SET NULL
);
```

**Dữ liệu JSON:**

- `intent_analysis`: Phân tích ý định khách hàng
- `behavior_analysis`: Phân tích hành vi khách hàng
- `interaction_history`: Lịch sử tương tác (sản phẩm quan tâm, etc.)

### 7. Bảng Conversations

**Mục đích**: Quản lý cuộc trò chuyện giữa khách hàng và hệ thống

```sql
CREATE TABLE conversations (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    customer_id CHAR(36) NOT NULL,
    assigned_reviewer_id CHAR(36) NULL,

    status ENUM('active', 'inactive', 'closed') DEFAULT 'active',
    case_resolved BOOLEAN DEFAULT FALSE,
    title VARCHAR(255) NULL,

    -- Thống kê
    total_messages INT DEFAULT 0,
    auto_messages INT DEFAULT 0,
    manual_messages INT DEFAULT 0,

    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME NULL,
    last_message_at DATETIME NULL,
    resolved_at DATETIME NULL,
    resolved_by CHAR(36) NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_conversations_customer (customer_id),
    INDEX idx_conversations_reviewer (assigned_reviewer_id),
    INDEX idx_conversations_status (status),
    INDEX idx_conversations_case_resolved (case_resolved),
    INDEX idx_conversations_started_at (started_at),

    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_reviewer_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);
```

**Trường quan trọng:**

- `case_resolved`: Đánh dấu case đã xử lý xong chưa (ảnh hưởng đến luồng xử lý tin nhắn)
- `assigned_reviewer_id`: Reviewer được phân công xử lý

### 8. Bảng Messages

**Mục đích**: Lưu trữ tất cả tin nhắn trong hệ thống

```sql
CREATE TABLE messages (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    conversation_id CHAR(36) NOT NULL,
    customer_id CHAR(36) NOT NULL,

    sender_id CHAR(36) NULL,
    sender_type ENUM('customer', 'bot', 'reviewer') NOT NULL,

    content TEXT NOT NULL,
    auto_response TEXT NULL,
    confidence_score DECIMAL(5,2) NULL,

    status ENUM(
        'received',
        'wait_ai_agent',
        'ai_agent_done_need_manual',
        'ai_agent_done_auto',
        'auto_response_done',
        'sent_to_reviewer',
        'sent_to_reviewer_sent_waiting_message',
        'reviewer_replied',
        'manual_response_done',
        'skip_ai_sent_to_reviewer'
    ) DEFAULT 'received',

    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,

    facebook_message_id VARCHAR(100) NULL,
    processed_at DATETIME NULL,
    responded_at DATETIME NULL,
    skip_ai_reason TEXT NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_messages_conversation (conversation_id),
    INDEX idx_messages_customer (customer_id),
    INDEX idx_messages_status (status),
    INDEX idx_messages_sender (sender_id, sender_type),
    INDEX idx_messages_created_at (created_at),
    INDEX idx_messages_facebook_id (facebook_message_id),

    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);
```

**Luồng Status:**

1. `received` → Tin nhắn mới nhận từ Facebook
2. `wait_ai_agent` → Đang chờ AI xử lý
3. `ai_agent_done_auto` → AI xử lý xong, tự động trả lời
4. `ai_agent_done_need_manual` → AI xử lý xong, cần manual review
5. `skip_ai_sent_to_reviewer` → Bỏ qua AI, gửi trực tiếp cho reviewer
6. `sent_to_reviewer` → Đã gửi cho reviewer
7. `reviewer_replied` → Reviewer đã trả lời
8. `manual_response_done` → Hoàn thành xử lý manual

### 9. Bảng Message_Queue

**Mục đích**: Quản lý hàng đợi xử lý tin nhắn bất đồng bộ

```sql
CREATE TABLE message_queue (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    message_id CHAR(36) NOT NULL,
    queue_type VARCHAR(50) NOT NULL,

    status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    priority INT DEFAULT 0,

    payload JSON NULL,
    error_message TEXT NULL,

    scheduled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME NULL,
    completed_at DATETIME NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_message_queue_message (message_id),
    INDEX idx_message_queue_status (status),
    INDEX idx_message_queue_type (queue_type),
    INDEX idx_message_queue_scheduled (scheduled_at),

    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);
```

**Các loại queue:**

- `fb_response`: Gửi tin nhắn về Facebook
- `ai_processing`: Xử lý AI
- `manual_review`: Gửi cho reviewer

### 10. Bảng System_Configs

**Mục đích**: Lưu trữ cấu hình hệ thống

```sql
CREATE TABLE system_configs (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    data_type VARCHAR(20) DEFAULT 'string',
    description TEXT NULL,
    category VARCHAR(50) NULL,
    is_active BOOLEAN DEFAULT TRUE,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by CHAR(36) NULL,

    INDEX idx_system_configs_key (config_key),
    INDEX idx_system_configs_category (category),

    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);
```

**Cấu hình quan trọng:**

- `confidence_threshold`: Ngưỡng confidence để auto response (80%)
- `always_generate_ai_response`: Luôn tạo AI response (false)
- `enable_waiting_message`: Bật tin nhắn chờ (true)
- `max_retry_attempts`: Số lần retry tối đa (3)

### 11. Bảng Reviewer_Feedback

**Mục đích**: Lưu trữ phản hồi của reviewer để cải thiện AI

```sql
CREATE TABLE reviewer_feedback (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    message_id CHAR(36) NOT NULL,
    reviewer_id CHAR(36) NOT NULL,

    original_response TEXT NOT NULL,
    corrected_response TEXT NULL,
    feedback_type ENUM('correct', 'incorrect', 'needs_improvement') NOT NULL,

    notes TEXT NULL,
    confidence_score DECIMAL(5,2) NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_reviewer_feedback_message (message_id),
    INDEX idx_reviewer_feedback_reviewer (reviewer_id),
    INDEX idx_reviewer_feedback_type (feedback_type),

    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 12. Bảng Audit_Logs

**Mục đích**: Theo dõi tất cả hoạt động trong hệ thống

```sql
CREATE TABLE audit_logs (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NULL,
    action ENUM('create', 'update', 'delete', 'login', 'logout', 'permission_change') NOT NULL,
    table_name VARCHAR(100) NULL,
    record_id CHAR(36) NULL,

    old_values JSON NULL,
    new_values JSON NULL,

    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_audit_logs_user (user_id),
    INDEX idx_audit_logs_action (action),
    INDEX idx_audit_logs_table (table_name),
    INDEX idx_audit_logs_created_at (created_at),

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
```

### 13. Bảng User_Sessions

**Mục đích**: Quản lý session đăng nhập

```sql
CREATE TABLE user_sessions (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,

    token_hash VARCHAR(255) NOT NULL,
    refresh_token_hash VARCHAR(255) NULL,

    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,

    expires_at DATETIME NOT NULL,
    last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_user_sessions_user (user_id),
    INDEX idx_user_sessions_token (token_hash),
    INDEX idx_user_sessions_expires (expires_at),

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 14. Bảng Password_Reset_Tokens

**Mục đích**: Quản lý token reset password và OTP

```sql
CREATE TABLE password_reset_tokens (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,

    token_hash VARCHAR(255) NOT NULL,
    otp_code VARCHAR(6) NULL,

    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_password_reset_user (user_id),
    INDEX idx_password_reset_token (token_hash),
    INDEX idx_password_reset_expires (expires_at),

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## Dữ liệu mặc định

### Permissions

```sql
INSERT INTO permissions (id, name, display_name, description) VALUES
(UUID(), 'chat', 'Chat Permission', 'Quyền truy cập trang chat, gửi/nhận tin nhắn'),
(UUID(), 'kb', 'Knowledge Base', 'Quyền quản lý knowledge base (chưa triển khai)'),
(UUID(), 'permission', 'Permission Management', 'Quyền quản lý user và phân quyền'),
(UUID(), 'customer_type', 'Customer Type Management', 'Quyền quản lý phân loại khách hàng');
```

### Customer Types

```sql
INSERT INTO customer_types (id, name, display_name, description) VALUES
(UUID(), 'individual', 'Khách hàng cá nhân', 'Khách hàng cá nhân'),
(UUID(), 'business', 'Khách hàng doanh nghiệp', 'Khách hàng doanh nghiệp'),
(UUID(), 'household_business', 'Khách hàng hộ kinh doanh', 'Khách hàng hộ kinh doanh'),
(UUID(), 'partner', 'Khách hàng đối tác', 'Khách hàng đối tác');
```

### System Configs

```sql
INSERT INTO system_configs (id, config_key, config_value, data_type, description, category) VALUES
(UUID(), 'confidence_threshold', '80', 'number', 'Ngưỡng confidence để auto response', 'ai'),
(UUID(), 'always_generate_ai_response', 'false', 'boolean', 'Luôn tạo AI response cho tin nhắn mới', 'ai'),
(UUID(), 'enable_waiting_message', 'true', 'boolean', 'Bật/tắt tin nhắn chờ', 'messaging'),
(UUID(), 'waiting_message_content', 'Xin chào, chúng tôi đang xử lý yêu cầu của bạn. Vui lòng chờ trong giây lát!', 'string', 'Nội dung tin nhắn chờ', 'messaging'),
(UUID(), 'max_retry_attempts', '3', 'number', 'Số lần retry tối đa', 'system'),
(UUID(), 'session_timeout', '3600', 'number', 'Timeout session (giây)', 'auth');
```

## Quan hệ giữa các bảng

### Mối quan hệ chính:

1. **Users ↔ Permissions** (Many-to-Many): `user_permissions`
2. **Users ↔ Customer_Types** (Many-to-Many): `user_customer_types`
3. **Customers ↔ Conversations** (One-to-Many)
4. **Conversations ↔ Messages** (One-to-Many)
5. **Users ↔ Conversations** (One-to-Many): assigned_reviewer_id
6. **Messages ↔ Reviewer_Feedback** (One-to-Many)
7. **Messages ↔ Message_Queue** (One-to-Many)

### Sơ đồ quan hệ:

```
Users ──┐
        ├─ User_Permissions ─── Permissions
        ├─ User_Customer_Types ─── Customer_Types
        ├─ Conversations (assigned_reviewer_id)
        ├─ Reviewer_Feedback
        └─ User_Sessions

Customers ─── Conversations ─── Messages ──┐
                                           ├─ Message_Queue
                                           └─ Reviewer_Feedback
```

## Triggers và Stored Procedures

### 1. Trigger tự động cập nhật resolved_at

```sql
DELIMITER //
CREATE TRIGGER update_conversation_resolved_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
BEGIN
    IF OLD.case_resolved = FALSE AND NEW.case_resolved = TRUE THEN
        SET NEW.resolved_at = CURRENT_TIMESTAMP;
    ELSEIF OLD.case_resolved = TRUE AND NEW.case_resolved = FALSE THEN
        SET NEW.resolved_at = NULL;
    END IF;
END //
DELIMITER ;
```

### 2. Stored Procedure để lấy reviewer phù hợp

```sql
DELIMITER //
CREATE PROCEDURE GetAvailableReviewers(
    IN p_customer_type_id CHAR(36)
)
BEGIN
    SELECT u.id, u.username, u.full_name
    FROM users u
    JOIN user_permissions up ON u.id = up.user_id
    JOIN permissions p ON up.permission_id = p.id
    JOIN user_customer_types uct ON u.id = uct.user_id
    WHERE p.name = 'chat'
    AND uct.customer_type_id = p_customer_type_id
    AND u.is_active = TRUE
    ORDER BY RAND()
    LIMIT 1;
END //
DELIMITER ;
```

## Luồng xử lý tin nhắn

### Luồng chính:

1. **Nhận tin nhắn mới**:

   ```sql
   INSERT INTO messages (id, conversation_id, customer_id, sender_type, content, status)
   VALUES (UUID(), ?, ?, 'customer', ?, 'received');
   ```

2. **Kiểm tra config và case_resolved**:

   ```sql
   SELECT
       c.case_resolved,
       sc.config_value as always_generate_ai_response
   FROM conversations c
   CROSS JOIN system_configs sc
   WHERE c.id = ? AND sc.config_key = 'always_generate_ai_response';
   ```

3. **Phân luồng xử lý**:

   - Nếu `always_generate_ai_response = false` và `case_resolved = false`
     → `status = 'skip_ai_sent_to_reviewer'`
   - Ngược lại → `status = 'wait_ai_agent'`

4. **Phân phối reviewer**:
   ```sql
   CALL GetAvailableReviewers(?);
   ```

## Queries thường dùng

### 1. Thống kê tin nhắn theo status

```sql
SELECT
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM messages WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)), 2) as percentage
FROM messages
WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
GROUP BY status;
```

### 2. Performance AI Agent

```sql
SELECT
    DATE(created_at) as date,
    AVG(confidence_score) as avg_confidence,
    COUNT(CASE WHEN status = 'ai_agent_done_auto' THEN 1 END) as auto_responses,
    COUNT(CASE WHEN status = 'ai_agent_done_need_manual' THEN 1 END) as manual_responses
FROM messages
WHERE status IN ('ai_agent_done_auto', 'ai_agent_done_need_manual')
GROUP BY DATE(created_at)
ORDER BY date;
```

### 3. Workload reviewer

```sql
SELECT
    u.full_name,
    COUNT(DISTINCT c.id) as active_conversations,
    COUNT(m.id) as total_messages,
    AVG(TIMESTAMPDIFF(MINUTE, m.created_at, m.responded_at)) as avg_response_time_minutes
FROM users u
JOIN conversations c ON u.id = c.assigned_reviewer_id
JOIN messages m ON c.id = m.conversation_id
WHERE c.status = 'active'
AND m.sender_type = 'reviewer'
GROUP BY u.id, u.full_name;
```

### 4. Customer insights

```sql
SELECT
    ct.display_name,
    COUNT(DISTINCT c.customer_id) as unique_customers,
    COUNT(m.id) as total_messages,
    AVG(c.total_messages) as avg_messages_per_conversation
FROM customer_types ct
JOIN customers cu ON ct.id = cu.customer_type_id
JOIN conversations c ON cu.id = c.customer_id
JOIN messages m ON c.id = m.conversation_id
GROUP BY ct.id, ct.display_name;
```

## Backup và Maintenance

### 1. Backup Strategy

```sql
-- Full backup
mysqldump -u username -p chatbot_db > backup_$(date +%Y%m%d).sql

-- Backup specific tables
mysqldump -u username -p chatbot_db messages conversations customers > messages_backup_$(date +%Y%m%d).sql
```

### 2. Maintenance Tasks

```sql
-- Optimize tables
OPTIMIZE TABLE messages, conversations, customers;

-- Check table integrity
CHECK TABLE messages, conversations, customers;

-- Clean old audit logs (older than 1 year)
DELETE FROM audit_logs WHERE created_at < DATE_SUB(CURDATE(), INTERVAL 1 YEAR);

-- Clean old sessions
DELETE FROM user_sessions WHERE expires_at < NOW();

-- Clean old password reset tokens
DELETE FROM password_reset_tokens WHERE expires_at < NOW();
```

## Performance Optimization

### 1. Partitioning cho bảng messages

```sql
ALTER TABLE messages
PARTITION BY RANGE (YEAR(created_at)) (
    PARTITION p2023 VALUES LESS THAN (2024),
    PARTITION p2024 VALUES LESS THAN (2025),
    PARTITION p2025 VALUES LESS THAN (2026),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);
```

### 2. Full-text Search

```sql
-- Thêm full-text index cho tìm kiếm tin nhắn
ALTER TABLE messages ADD FULLTEXT(content);

-- Tìm kiếm tin nhắn
SELECT * FROM messages
WHERE MATCH(content) AGAINST('ngân hàng' IN BOOLEAN MODE);
```

## Security Considerations

### 1. Sensitive Data

- Passwords được hash bằng bcrypt
- Session tokens được hash
- Sử dụng SSL/TLS cho connection
- Row-level security cho sensitive data

### 2. Access Control

```sql
-- Tạo user chỉ đọc cho reporting
CREATE USER 'chatbot_readonly'@'%' IDENTIFIED BY 'secure_password';
GRANT SELECT ON chatbot_db.* TO 'chatbot_readonly'@'%';

-- Tạo user cho application
CREATE USER 'chatbot_app'@'%' IDENTIFIED BY 'secure_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON chatbot_db.* TO 'chatbot_app'@'%';
```

### 3. Data Retention

- Message data: 2 years
- Audit logs: 1 year
- Session data: 30 days after expiry
- Feedback data: Permanent (for AI improvement)

## Monitoring

### 1. Performance Metrics

```sql
-- Slow query monitoring
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2;

-- Check index usage
SELECT * FROM sys.schema_unused_indexes WHERE object_schema = 'chatbot_db';

-- Check table sizes
SELECT
    table_name,
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'DB Size in MB'
FROM information_schema.tables
WHERE table_schema = 'chatbot_db'
ORDER BY (data_length + index_length) DESC;
```

### 2. Business Metrics

```sql
-- Daily message statistics
SELECT
    DATE(created_at) as date,
    COUNT(*) as total_messages,
    COUNT(CASE WHEN sender_type = 'customer' THEN 1 END) as customer_messages,
    COUNT(CASE WHEN sender_type = 'bot' THEN 1 END) as bot_messages,
    COUNT(CASE WHEN sender_type = 'reviewer' THEN 1 END) as reviewer_messages
FROM messages
WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY DATE(created_at)
ORDER BY date;
```

## MySQL Configuration

### 1. Recommended MySQL Settings

```sql
-- my.cnf settings for optimal performance
[mysqld]
innodb_buffer_pool_size = 2G
innodb_log_file_size = 256M
innodb_flush_log_at_trx_commit = 2
innodb_flush_method = O_DIRECT
query_cache_size = 256M
max_connections = 500
tmp_table_size = 256M
max_heap_table_size = 256M
```

### 2. Monitoring Queries

```sql
-- Check connection status
SHOW STATUS LIKE 'Threads_connected';

-- Check slow queries
SHOW STATUS LIKE 'Slow_queries';

-- Check InnoDB buffer pool usage
SHOW STATUS LIKE 'Innodb_buffer_pool_read_requests';
SHOW STATUS LIKE 'Innodb_buffer_pool_reads';
```

---

_Tài liệu này được cập nhật lần cuối: 2024-12-19_
_Version: 2.0 - MySQL Edition_
