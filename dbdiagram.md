// Database Schema - ChatBot Banking System
// Copy paste this code directly into dbdiagram.io

// Enums
Enum permission_type {
chat
kb
permission
customer_type
}

Enum customer_category {
individual
business
household_business
partner
}

Enum conversation_status {
active
inactive
closed
}

Enum message_status {
received
wait_ai_agent
ai_agent_done_need_manual
ai_agent_done_auto
auto_response_done
sent_to_reviewer
sent_to_reviewer_sent_waiting_message
reviewer_replied
manual_response_done
skip_ai_sent_to_reviewer
}

Enum sender_type {
customer
bot
reviewer
}

Enum queue_status {
pending
processing
completed
failed
}

Enum feedback_type {
correct
incorrect
needs_improvement
}

Enum audit_action {
create
update
delete
login
logout
permission_change
}

// Tables
Table users {
id uuid [pk, default: `gen_random_uuid()`]
username varchar(50) [unique, not null]
email varchar(255) [unique, not null]
password_hash varchar(255) [not null]
full_name varchar(100) [not null]
phone varchar(15)
is_active boolean [default: true]
require_change_password boolean [default: false]
last_login_at timestamp
failed_login_attempts integer [default: 0]
locked_until timestamp
created_at timestamp [default: `now()`]
updated_at timestamp [default: `now()`]
created_by uuid [ref: > users.id]
updated_by uuid [ref: > users.id]

indexes {
username
email
is_active
}

Note: 'Quản lý tài khoản người dùng hệ thống (admin, reviewer)'
}

Table permissions {
id uuid [pk, default: `gen_random_uuid()`]
name permission_type [unique, not null]
display_name varchar(100) [not null]
description text
created_at timestamp [default: `now()`]

Note: 'Định nghĩa các quyền trong hệ thống'
}

Table user_permissions {
id uuid [pk, default: `gen_random_uuid()`]
user_id uuid [not null, ref: > users.id]
permission_id uuid [not null, ref: > permissions.id]
granted_at timestamp [default: `now()`]
granted_by uuid [ref: > users.id]

indexes {
user_id
permission_id
(user_id, permission_id) [unique]
}

Note: 'Phân quyền cho từng user (many-to-many)'
}

Table customer_types {
id uuid [pk, default: `gen_random_uuid()`]
name customer_category [unique, not null]
display_name varchar(100) [not null]
description text
is_active boolean [default: true]
created_at timestamp [default: `now()`]

Note: 'Phân loại khách hàng'
}

Table user_customer_types {
id uuid [pk, default: `gen_random_uuid()`]
user_id uuid [not null, ref: > users.id]
customer_type_id uuid [not null, ref: > customer_types.id]
assigned_at timestamp [default: `now()`]
assigned_by uuid [ref: > users.id]

indexes {
user_id
customer_type_id
(user_id, customer_type_id) [unique]
}

Note: 'Phân công reviewer phụ trách loại khách hàng nào'
}

Table customers {
id uuid [pk, default: `gen_random_uuid()`]
facebook_id varchar(100) [unique, not null]
facebook_name varchar(255)
facebook_profile_url text
facebook_avatar_url text
phone varchar(15)
email varchar(255)
customer_type_id uuid [ref: > customer_types.id]
intent_analysis json
behavior_analysis json
interaction_history json
first_interaction_at timestamp
last_interaction_at timestamp
total_conversations integer [default: 0]
total_messages integer [default: 0]
created_at timestamp [default: `now()`]
updated_at timestamp [default: `now()`]

indexes {
facebook_id
customer_type_id
last_interaction_at
}

Note: 'Lưu trữ thông tin khách hàng từ Facebook và phân tích AI'
}

Table conversations {
id uuid [pk, default: `gen_random_uuid()`]
customer_id uuid [not null, ref: > customers.id]
assigned_reviewer_id uuid [ref: > users.id]
status conversation_status [default: 'active']
case_resolved boolean [default: false]
title varchar(255)
total_messages integer [default: 0]
auto_messages integer [default: 0]
manual_messages integer [default: 0]
started_at timestamp [default: `now()`]
ended_at timestamp
last_message_at timestamp
resolved_at timestamp
resolved_by uuid [ref: > users.id]
created_at timestamp [default: `now()`]
updated_at timestamp [default: `now()`]

indexes {
customer_id
assigned_reviewer_id
status
case_resolved
started_at
}

Note: 'Quản lý cuộc trò chuyện giữa khách hàng và hệ thống'
}

Table messages {
id uuid [pk, default: `gen_random_uuid()`]
conversation_id uuid [not null, ref: > conversations.id]
customer_id uuid [not null, ref: > customers.id]
sender_id uuid
sender_type sender_type [not null]
content text [not null]
auto_response text
confidence_score decimal(5,2)
status message_status [default: 'received']
retry_count integer [default: 0]
max_retries integer [default: 3]
facebook_message_id varchar(100)
processed_at timestamp
responded_at timestamp
skip_ai_reason text
created_at timestamp [default: `now()`]
updated_at timestamp [default: `now()`]

indexes {
conversation_id
customer_id
status
(sender_id, sender_type)
created_at
facebook_message_id
}

Note: 'Lưu trữ tất cả tin nhắn trong hệ thống'
}

Table message_queue {
id uuid [pk, default: `gen_random_uuid()`]
message_id uuid [not null, ref: > messages.id]
queue_type varchar(50) [not null]
status queue_status [default: 'pending']
priority integer [default: 0]
payload json
error_message text
scheduled_at timestamp [default: `now()`]
processed_at timestamp
completed_at timestamp
created_at timestamp [default: `now()`]
updated_at timestamp [default: `now()`]

indexes {
message_id
status
queue_type
scheduled_at
}

Note: 'Quản lý hàng đợi xử lý tin nhắn bất đồng bộ'
}

Table system_configs {
id uuid [pk, default: `gen_random_uuid()`]
key varchar(100) [unique, not null]
value text [not null]
data_type varchar(20) [default: 'string']
description text
category varchar(50)
is_active boolean [default: true]
created_at timestamp [default: `now()`]
updated_at timestamp [default: `now()`]
updated_by uuid [ref: > users.id]

indexes {
key
category
}

Note: 'Lưu trữ cấu hình hệ thống'
}

Table reviewer_feedback {
id uuid [pk, default: `gen_random_uuid()`]
message_id uuid [not null, ref: > messages.id]
reviewer_id uuid [not null, ref: > users.id]
original_response text [not null]
corrected_response text
feedback_type feedback_type [not null]
notes text
confidence_score decimal(5,2)
created_at timestamp [default: `now()`]

indexes {
message_id
reviewer_id
feedback_type
}

Note: 'Lưu trữ phản hồi của reviewer để cải thiện AI'
}

Table audit_logs {
id uuid [pk, default: `gen_random_uuid()`]
user_id uuid [ref: > users.id]
action audit_action [not null]
table_name varchar(100)
record_id uuid
old_values json
new_values json
ip_address varchar(45)
user_agent text
created_at timestamp [default: `now()`]

indexes {
user_id
action
table_name
created_at
}

Note: 'Theo dõi tất cả hoạt động trong hệ thống'
}

Table user_sessions {
id uuid [pk, default: `gen_random_uuid()`]
user_id uuid [not null, ref: > users.id]
token_hash varchar(255) [not null]
refresh_token_hash varchar(255)
ip_address varchar(45)
user_agent text
expires_at timestamp [not null]
last_activity_at timestamp [default: `now()`]
created_at timestamp [default: `now()`]
updated_at timestamp [default: `now()`]

indexes {
user_id
token_hash
expires_at
}

Note: 'Quản lý session đăng nhập'
}

Table password_reset_tokens {
id uuid [pk, default: `gen_random_uuid()`]
user_id uuid [not null, ref: > users.id]
token_hash varchar(255) [not null]
otp_code varchar(6)
expires_at timestamp [not null]
used_at timestamp
created_at timestamp [default: `now()`]

indexes {
user_id
token_hash
expires_at
}

Note: 'Quản lý token reset password và OTP'
}

// Relationships
Ref: user_permissions.user_id > users.id [delete: cascade]
Ref: user_permissions.permission_id > permissions.id [delete: cascade]
Ref: user_customer_types.user_id > users.id [delete: cascade]
Ref: user_customer_types.customer_type_id > customer_types.id [delete: cascade]
Ref: customers.customer_type_id > customer_types.id
Ref: conversations.customer_id > customers.id [delete: cascade]
Ref: conversations.assigned_reviewer_id > users.id
Ref: conversations.resolved_by > users.id
Ref: messages.conversation_id > conversations.id [delete: cascade]
Ref: messages.customer_id > customers.id [delete: cascade]
Ref: message_queue.message_id > messages.id [delete: cascade]
Ref: reviewer_feedback.message_id > messages.id [delete: cascade]
Ref: reviewer_feedback.reviewer_id > users.id
Ref: user_sessions.user_id > users.id [delete: cascade]
Ref: password_reset_tokens.user_id > users.id [delete: cascade]
Ref: audit_logs.user_id > users.id
Ref: system_configs.updated_by > users.id

// Usage Instructions:
// 1. Copy all the code above
// 2. Go to https://dbdiagram.io/
// 3. Create a new diagram
// 4. Paste the code into the editor
// 5. The diagram will automatically generate

// Features:
// - 14 tables with complete field definitions
// - All ENUMs properly defined
// - Primary keys and foreign key relationships
// - Indexes for performance optimization
// - Table notes explaining each table's purpose
// - Cascade delete relationships where appropriate
// - Default values and constraints

// Table Groups:
// 1. Authentication & Authorization: users, permissions, user_permissions, user_sessions, password_reset_tokens
// 2. Customer Management: customers, customer_types, user_customer_types  
// 3. Conversation & Messaging: conversations, messages, message_queue
// 4. System & Feedback: system_configs, audit_logs, reviewer_feedback
