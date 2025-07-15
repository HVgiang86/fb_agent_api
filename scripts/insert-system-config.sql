-- ===================================================================
-- 🔧 INSERT DEFAULT SYSTEM CONFIGURATIONS
-- ===================================================================
-- Script để tạo các default system config cho ChatBot Banking Backend
-- Chạy sau khi đã tạo bảng system_configs

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

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
    1,
    1,
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
    1,
    1,
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
    1,
    1,
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
    1,
    1,
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
    1,
    1,
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
    1,
    1,
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
    1,
    1,
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
    1,
    1,
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
    1,
    1,
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
    1,
    0,
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
    1,
    0,
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
    1,
    0,
    NOW(),
    NOW(),
    'system-sql-setup',
    'system-sql-setup'
);

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Verify the insertion
SELECT 
    COUNT(*) as total_configs,
    SUM(CASE WHEN is_system_config = 1 THEN 1 ELSE 0 END) as system_configs,
    SUM(CASE WHEN is_system_config = 0 THEN 1 ELSE 0 END) as user_configs,
    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_configs
FROM system_configs;

-- Show all created configs
SELECT 
    config_key,
    config_value,
    data_type,
    CASE WHEN is_system_config = 1 THEN 'System' ELSE 'User' END as config_type,
    CASE WHEN is_active = 1 THEN 'Active' ELSE 'Inactive' END as status,
    LEFT(description, 50) as description_preview,
    created_at
FROM system_configs 
ORDER BY is_system_config DESC, config_key ASC;

-- ===================================================================
-- 🎉 SETUP COMPLETED!
-- ===================================================================
-- Đã tạo 12 default system configurations:
-- 
-- 🤖 AI Agent (1):
--    - ai_confidence_threshold = 80
-- 
-- 💬 Message (2):
--    - enable_waiting_message = true
--    - waiting_message_content = "Cảm ơn bạn..."
-- 
-- 👥 Reviewer (3):
--    - max_retry_count = 3
--    - reviewer_timeout_minutes = 30
--    - auto_assign_strategy = round_robin
-- 
-- 🖥️ System (3):
--    - system_maintenance_mode = false
--    - max_messages_per_conversation = 100
--    - session_timeout_minutes = 480
-- 
-- 🎨 Frontend (1):
--    - default_theme = light
-- 
-- 📧 Notifications (2):
--    - enable_email_notifications = true
--    - enable_sms_notifications = false
-- =================================================================== 