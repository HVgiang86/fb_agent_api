-- ===================================================================
-- 🔧 CREATE SYSTEM_CONFIGS TABLE AND INSERT DEFAULT DATA
-- ===================================================================
-- Script hoàn chỉnh để tạo bảng system_configs và insert default configs
-- Dành cho ChatBot Banking Backend System

-- Drop table if exists (optional - uncomment if needed)
-- DROP TABLE IF EXISTS system_configs;

-- ===================================================================
-- 📋 CREATE TABLE system_configs
-- ===================================================================

CREATE TABLE IF NOT EXISTS system_configs (
    id VARCHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    
    -- Config key và value
    config_key ENUM(
        'ai_confidence_threshold',
        'enable_waiting_message', 
        'waiting_message_content',
        'max_retry_count',
        'reviewer_timeout_minutes',
        'auto_assign_strategy',
        'system_maintenance_mode',
        'max_messages_per_conversation',
        'default_theme',
        'session_timeout_minutes',
        'enable_email_notifications',
        'enable_sms_notifications'
    ) NOT NULL UNIQUE,
    
    config_value TEXT NOT NULL,
    
    -- Data type của config value
    data_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    
    -- Mô tả config
    description TEXT,
    
    -- Status flags
    is_active BOOLEAN DEFAULT TRUE,
    is_system_config BOOLEAN DEFAULT FALSE COMMENT 'System config không được phép xóa',
    
    -- Audit fields
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(36),
    updated_by VARCHAR(36),
    
    -- Indexes
    INDEX idx_config_key (config_key),
    INDEX idx_is_active (is_active),
    INDEX idx_is_system_config (is_system_config),
    INDEX idx_created_at (created_at)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================================================================
-- 🌱 INSERT DEFAULT SYSTEM CONFIGURATIONS
-- ===================================================================

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

-- Clear existing data (optional)
-- DELETE FROM system_configs;

-- Insert default system configurations
INSERT IGNORE INTO system_configs (
    id,
    config_key,
    config_value,
    data_type,
    description,
    is_active,
    is_system_config,
    created_at,
    updated_at,
    created_by,
    updated_by
) VALUES

-- 🤖 AI Agent Configuration
(
    UUID(),
    'ai_confidence_threshold',
    '80',
    'number',
    'Ngưỡng độ chính xác của AI Agent để quyết định auto response (0-100%)',
    TRUE,
    TRUE,
    NOW(),
    NOW(),
    'system-sql-setup',
    'system-sql-setup'
),

-- 💬 Message Configuration  
(
    UUID(),
    'enable_waiting_message',
    'true',
    'boolean',
    'Có gửi waiting message khi chuyển tin nhắn sang manual review',
    TRUE,
    TRUE,
    NOW(),
    NOW(),
    'system-sql-setup',
    'system-sql-setup'
),
(
    UUID(),
    'waiting_message_content',
    'Cảm ơn bạn đã liên hệ. Chúng tôi sẽ phản hồi trong thời gian sớm nhất.',
    'string',
    'Nội dung waiting message gửi cho khách hàng',
    TRUE,
    TRUE,
    NOW(),
    NOW(),
    'system-sql-setup',
    'system-sql-setup'
),

-- 👥 Reviewer Configuration
(
    UUID(),
    'max_retry_count',
    '3',
    'number',
    'Số lần retry tối đa khi reviewer không phản hồi',
    TRUE,
    TRUE,
    NOW(),
    NOW(),
    'system-sql-setup',
    'system-sql-setup'
),
(
    UUID(),
    'reviewer_timeout_minutes',
    '30',
    'number',
    'Thời gian timeout cho reviewer (phút)',
    TRUE,
    TRUE,
    NOW(),
    NOW(),
    'system-sql-setup',
    'system-sql-setup'
),
(
    UUID(),
    'auto_assign_strategy',
    'round_robin',
    'string',
    'Chiến lược phân phối tin nhắn đến reviewer (round_robin, load_based, expertise_based)',
    TRUE,
    TRUE,
    NOW(),
    NOW(),
    'system-sql-setup',
    'system-sql-setup'
),

-- 🖥️ System Configuration
(
    UUID(),
    'system_maintenance_mode',
    'false',
    'boolean',
    'Chế độ bảo trì hệ thống',
    TRUE,
    TRUE,
    NOW(),
    NOW(),
    'system-sql-setup',
    'system-sql-setup'
),
(
    UUID(),
    'max_messages_per_conversation',
    '100',
    'number',
    'Số tin nhắn tối đa trong một conversation',
    TRUE,
    TRUE,
    NOW(),
    NOW(),
    'system-sql-setup',
    'system-sql-setup'
),
(
    UUID(),
    'session_timeout_minutes',
    '480',
    'number',
    'Thời gian timeout session (phút) - 8 giờ',
    TRUE,
    TRUE,
    NOW(),
    NOW(),
    'system-sql-setup',
    'system-sql-setup'
),

-- 🎨 Frontend Configuration
(
    UUID(),
    'default_theme',
    'light',
    'string',
    'Theme mặc định cho frontend (light, dark)',
    TRUE,
    FALSE,
    NOW(),
    NOW(),
    'system-sql-setup',
    'system-sql-setup'
),

-- 📧 Notification Configuration
(
    UUID(),
    'enable_email_notifications',
    'true',
    'boolean',
    'Kích hoạt thông báo qua email',
    TRUE,
    FALSE,
    NOW(),
    NOW(),
    'system-sql-setup',
    'system-sql-setup'
),
(
    UUID(),
    'enable_sms_notifications',
    'false',
    'boolean',
    'Kích hoạt thông báo qua SMS',
    TRUE,
    FALSE,
    NOW(),
    NOW(),
    'system-sql-setup',
    'system-sql-setup'
);

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- ===================================================================
-- 🔍 VERIFICATION AND SUMMARY
-- ===================================================================

-- Show table structure
DESCRIBE system_configs;

-- Count records by type
SELECT 
    'Total Configs' as metric,
    COUNT(*) as count
FROM system_configs
UNION ALL
SELECT 
    'System Configs' as metric,
    COUNT(*) as count
FROM system_configs 
WHERE is_system_config = TRUE
UNION ALL
SELECT 
    'User Configs' as metric,
    COUNT(*) as count
FROM system_configs 
WHERE is_system_config = FALSE
UNION ALL
SELECT 
    'Active Configs' as metric,
    COUNT(*) as count
FROM system_configs 
WHERE is_active = TRUE;

-- Show all created configurations
SELECT 
    '🔧 SYSTEM CONFIGURATIONS CREATED' as title;

SELECT 
    CASE 
        WHEN is_system_config = TRUE THEN '🔒 SYSTEM'
        ELSE '👤 USER  '
    END as type,
    config_key,
    config_value,
    data_type,
    CASE 
        WHEN is_active = TRUE THEN '✅ Active'
        ELSE '❌ Inactive'
    END as status,
    SUBSTRING(description, 1, 60) as description_preview
FROM system_configs 
ORDER BY is_system_config DESC, config_key ASC;

-- Show configs by category
SELECT '🤖 AI AGENT CONFIGS' as category;
SELECT config_key, config_value, description 
FROM system_configs 
WHERE config_key IN ('ai_confidence_threshold');

SELECT '💬 MESSAGE CONFIGS' as category;
SELECT config_key, config_value, LEFT(description, 50) as description
FROM system_configs 
WHERE config_key IN ('enable_waiting_message', 'waiting_message_content');

SELECT '👥 REVIEWER CONFIGS' as category;
SELECT config_key, config_value, description
FROM system_configs 
WHERE config_key IN ('max_retry_count', 'reviewer_timeout_minutes', 'auto_assign_strategy');

SELECT '🖥️ SYSTEM CONFIGS' as category;
SELECT config_key, config_value, description
FROM system_configs 
WHERE config_key IN ('system_maintenance_mode', 'max_messages_per_conversation', 'session_timeout_minutes');

SELECT '🎨 FRONTEND CONFIGS' as category;
SELECT config_key, config_value, description
FROM system_configs 
WHERE config_key IN ('default_theme');

SELECT '📧 NOTIFICATION CONFIGS' as category;
SELECT config_key, config_value, description
FROM system_configs 
WHERE config_key IN ('enable_email_notifications', 'enable_sms_notifications');

-- ===================================================================
-- 🎉 SETUP COMPLETED SUCCESSFULLY!
-- ===================================================================
-- 
-- ✅ Table 'system_configs' created with proper structure
-- ✅ 12 default system configurations inserted
-- ✅ Proper indexes added for performance
-- ✅ Data types and constraints configured
-- 
-- 📋 Configuration Categories:
-- 🤖 AI Agent (1): ai_confidence_threshold = 80
-- 💬 Message (2): enable_waiting_message, waiting_message_content  
-- 👥 Reviewer (3): max_retry_count, reviewer_timeout_minutes, auto_assign_strategy
-- 🖥️ System (3): system_maintenance_mode, max_messages_per_conversation, session_timeout_minutes
-- 🎨 Frontend (1): default_theme = light
-- 📧 Notifications (2): enable_email_notifications, enable_sms_notifications
-- 
-- 🚀 Next Steps:
-- 1. Start your NestJS application: yarn start:dev
-- 2. Test API endpoints: GET /system-config  
-- 3. Update configs via admin dashboard or API
-- 
-- =================================================================== 