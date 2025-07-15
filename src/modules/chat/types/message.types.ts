/**
 * Message Types và Interfaces cho hệ thống Chat
 */

// Enum cho các trạng thái của tin nhắn
export enum MessageStatus {
  RECEIVED = 'received',
  WAIT_AI_AGENT = 'wait_ai_agent',
  AI_AGENT_DONE_NEED_MANUAL = 'ai_agent_done_need_manual',
  AI_AGENT_DONE_AUTO = 'ai_agent_done_auto',
  AUTO_RESPONSE_DONE = 'auto_response_done',
  SENT_TO_REVIEWER = 'sent_to_reviewer',
  SENT_TO_REVIEWER_SENT_WAITING_MESSAGE = 'sent_to_reviewer_sent_waiting_message',
  REVIEWER_REPLIED = 'reviewer_replied',
  MANUAL_RESPONSE_DONE = 'manual_response_done',
}

// Enum cho loại người gửi
export enum SenderType {
  CUSTOMER = 'customer',
  BOT = 'bot',
  USER = 'user', // Business Unit reviewer
}

// Interface cho Message trong Redis Cache
export interface CachedMessage {
  id: string;
  conversationId: string;
  customerId: string;
  senderId: string;
  senderType: SenderType;
  content: string;
  status: MessageStatus;
  autoResponse?: string;
  assignedReviewerId?: string;
  retryCount?: number;
  confidence?: number; // Độ chính xác từ AI Agent (0-100)
  aiAnalysis?: {
    customerType?: string;
    intent?: string;
    sentiment?: string;
  };
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  processingTimeout?: string; // ISO string - thời gian timeout xử lý
}

// Interface cho Conversation trong Redis
export interface CachedConversation {
  id: string;
  customerId: string;
  assignedReviewerId?: string;
  status: ConversationStatus;
  lastMessageAt: string; // ISO string
  messageCount: number;
  customerInfo?: {
    name?: string;
    facebookId: string;
    profilePicture?: string;
    customerType?: string;
  };
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

// Enum cho trạng thái conversation
export enum ConversationStatus {
  ACTIVE = 'active',
  WAITING_REVIEW = 'waiting_review',
  IN_REVIEW = 'in_review',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

// Interface cho Message Queue Data
export interface MessageQueueData {
  messageId: string;
  conversationId: string;
  customerId: string;
  action: MessageAction;
  priority: MessagePriority;
  scheduledAt?: string; // ISO string cho delayed processing
  retryCount: number;
  maxRetries: number;
  lastError?: string;
}

// Enum cho các action trong message queue
export enum MessageAction {
  SEND_TO_FACEBOOK = 'send_to_facebook',
  PROCESS_AI_RESPONSE = 'process_ai_response',
  ASSIGN_TO_REVIEWER = 'assign_to_reviewer',
  SEND_WAITING_MESSAGE = 'send_waiting_message',
  RETRY_PROCESSING = 'retry_processing',
}

// Enum cho độ ưu tiên tin nhắn
export enum MessagePriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  URGENT = 4,
}

// Interface cho Response gửi về Facebook
export interface FacebookResponse {
  messageId: string;
  customerId: string;
  content: string;
  type: 'auto' | 'manual';
  timestamp: string; // ISO string
}

// Interface cho Reviewer Assignment Data
export interface ReviewerAssignment {
  messageId: string;
  conversationId: string;
  customerId: string;
  reviewerId: string;
  customerType: string;
  assignedAt: string; // ISO string
  timeoutAt: string; // ISO string
  priority: MessagePriority;
}
