-- Insert default data for ChatBot Banking API
-- Run this after database schema is created

-- Insert default permissions
INSERT IGNORE INTO permissions (id, name, display_name, description, created_at) VALUES 
(UUID(), 'chat', 'Chat Permission', 'Quyền truy cập trang chat, gửi/nhận tin nhắn', NOW()),
(UUID(), 'kb', 'Knowledge Base', 'Quyền quản lý knowledge base (chưa triển khai)', NOW()),
(UUID(), 'permission', 'Permission Management', 'Quyền quản lý user và phân quyền', NOW()),
(UUID(), 'customer_type', 'Customer Type Management', 'Quyền quản lý phân loại khách hàng', NOW());

-- Insert default customer types
INSERT IGNORE INTO customer_types (id, name, display_name, description, is_active, created_at) VALUES 
(UUID(), 'individual', 'Khách hàng cá nhân', 'Khách hàng cá nhân', 1, NOW()),
(UUID(), 'business', 'Khách hàng doanh nghiệp', 'Khách hàng doanh nghiệp', 1, NOW()),
(UUID(), 'household_business', 'Khách hàng hộ kinh doanh', 'Khách hàng hộ kinh doanh', 1, NOW()),
(UUID(), 'partner', 'Khách hàng đối tác', 'Khách hàng đối tác', 1, NOW());

-- Display success message
SELECT 'Default data inserted successfully!' as message,
       (SELECT COUNT(*) FROM permissions) as total_permissions,
       (SELECT COUNT(*) FROM customer_types) as total_customer_types; 