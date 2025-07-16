# 💬 Chat Module - Database Entities

## 📋 Tổng quan

Module Chat chứa các entities để quản lý tin nhắn và cuộc trò chuyện trong hệ thống ChatBot Banking.

## 🗃️ Entities

### 1. **Customer Entity** (`src/modules/users/entities/customer.entity.ts`)

Quản lý thông tin khách hàng từ Facebook và AI analysis.

**Các trường chính:**

- `facebookId`: ID duy nhất từ Facebook
- `facebookName`: Tên hiển thị
- `intentAnalysis`: Phân tích ý định từ AI (JSON)
- `behaviorAnalysis`: Phân tích hành vi từ AI (JSON)
- `interactionHistory`: Lịch sử tương tác (JSON)

### 2. **Conversation Entity** (`entities/conversation.entity.ts`)

Quản lý cuộc trò chuyện giữa khách hàng và hệ thống.

**Trạng thái:**

- `active`: Đang hoạt động
- `inactive`: Tạm dừng
- `closed`: Đã đóng

**Các trường thống kê:**

- `totalMessages`: Tổng số tin nhắn
- `autoMessages`: Số tin nhắn tự động
- `manualMessages`: Số tin nhắn thủ công

### 3. **Message Entity** (`entities/message.entity.ts`)

Lưu trữ tất cả tin nhắn trong hệ thống.

**Các trạng thái quan trọng:**

- `received`: Tin nhắn mới nhận từ Facebook
- `wait_ai_agent`: Đang chờ AI xử lý
- `ai_agent_done_auto`: AI xử lý xong, tự động trả lời
- `ai_agent_done_need_manual`: AI xử lý xong, cần manual review
- `sent_to_reviewer`: Đã gửi cho reviewer
- `reviewer_replied`: Reviewer đã trả lời

**Loại người gửi:**

- `customer`: Khách hàng
- `bot`: AI/System
- `reviewer`: Nhân viên ngân hàng

### 4. **MessageQueue Entity** (`entities/message-queue.entity.ts`)

Quản lý hàng đợi xử lý tin nhắn bất đồng bộ.

**Loại queue:**

- `ai_processing`: Xử lý AI
- `facebook_response`: Gửi về Facebook
- `message_distribution`: Phân phối reviewer
- `timeout_check`: Kiểm tra timeout

### 5. **ReviewerFeedback Entity** (`entities/reviewer-feedback.entity.ts`)

Lưu trữ phản hồi của reviewer để cải thiện AI.

**Loại feedback:**

- `correct`: Đúng
- `incorrect`: Sai
- `needs_improvement`: Cần cải thiện

## 🔗 Relationships

```
Customer 1---* Conversation 1---* Message 1---* MessageQueue
    |                               |
    |                               +---* ReviewerFeedback
    |
    *--- CustomerType

User *---* Conversation (assigned_reviewer_id)
User 1---* ReviewerFeedback
```

## 📊 Indexes

Các indexes được tối ưu cho:

- Tìm kiếm theo customerId
- Lọc theo status
- Sắp xếp theo thời gian
- Lookup reviewer assignments

## 🚀 Cách sử dụng

### Tạo conversation mới

```typescript
import { Conversation, ConversationStatus } from '../chat/entities';

const conversation = new Conversation();
conversation.customerId = customer.id;
conversation.status = ConversationStatus.ACTIVE;
await conversationRepository.save(conversation);
```

### Tạo message mới

```typescript
import { Message, MessageStatus, SenderType } from '../chat/entities';

const message = new Message();
message.conversationId = conversation.id;
message.customerId = customer.id;
message.senderType = SenderType.CUSTOMER;
message.content = 'Xin chào, tôi muốn hỏi về sản phẩm thẻ tín dụng';
message.status = MessageStatus.RECEIVED;
await messageRepository.save(message);
```

### Update message status

```typescript
await messageRepository.update(messageId, {
  status: MessageStatus.AI_AGENT_DONE_AUTO,
  autoResponse: 'Cảm ơn bạn đã quan tâm...',
  confidenceScore: 95.5,
  processedAt: new Date(),
});
```

### Tìm conversations của reviewer

```typescript
const conversations = await conversationRepository.find({
  where: {
    assignedReviewerId: reviewerId,
    status: ConversationStatus.ACTIVE,
  },
  relations: ['customer', 'messages'],
  order: { lastMessageAt: 'DESC' },
});
```

## 🔧 Configuration

Sử dụng `ConfigService` để điều khiển behavior:

```typescript
// Ngưỡng confidence AI
const threshold = await configService.getAiConfidenceThreshold(); // 80%

// Có gửi waiting message không
const enableWaiting = await configService.isWaitingMessageEnabled(); // true

// Timeout cho reviewer
const timeout = await configService.getReviewerTimeoutMinutes(); // 30 minutes
```

## 📈 Monitoring

Các queries hữu ích cho monitoring:

```sql
-- Thống kê tin nhắn theo status
SELECT status, COUNT(*)
FROM messages
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY status;

-- Performance AI Agent
SELECT
  AVG(confidence_score) as avg_confidence,
  COUNT(CASE WHEN status = 'ai_agent_done_auto' THEN 1 END) as auto_count,
  COUNT(CASE WHEN status = 'ai_agent_done_need_manual' THEN 1 END) as manual_count
FROM messages
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR);

-- Workload reviewer
SELECT
  assigned_reviewer_id,
  COUNT(*) as active_conversations
FROM conversations
WHERE status = 'active' AND assigned_reviewer_id IS NOT NULL
GROUP BY assigned_reviewer_id;
```

---

## 🚀 Next Steps

1. **Tạo Repositories/Services** cho business logic
2. **Implement Queue Processors** cho background jobs
3. **Setup Redis Cache** cho tin nhắn đang xử lý
4. **Tạo APIs** cho frontend dashboard
5. **Setup SocketIO** cho real-time communication

Xem [Chat Solution Documentation](../../../project_doc/chat_solution.md) để biết chi tiết implementation plan.
