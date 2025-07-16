/**
 * SocketIO Events Interfaces cho Chat System
 */

// Interface cho connection established event
export interface ConnectionEstablishedPayload {
  socketId: string;
  message: string;
  timestamp: string; // ISO string
}

// Interface cho socket connected event (after authentication)
export interface SocketConnectedPayload {
  success: boolean;
  userId: string;
  socketId: string;
  message: string;
  user: {
    id: string;
    username: string;
    fullName: string;
  };
  timestamp: string; // ISO string
}

// Interface cho connection event từ frontend
export interface ConnectSocketPayload {
  userId: string;
  socketId?: string;
}

// Interface cho send message event từ reviewer
export interface SendMessagePayload {
  conversationId: string;
  content: string;
  messageType?: 'text' | 'image' | 'file';
}

// Interface cho receive message event gửi đến reviewer
export interface ReceiveMessagePayload {
  messageId: string;
  conversationId: string;
  customerId: string;
  senderType: 'customer' | 'bot' | 'reviewer';
  content: string;
  autoResponse?: string;
  confidence?: number;
  customerInfo: {
    id: string;
    facebookName?: string;
    facebookAvatarUrl?: string;
    customerType?: string;
  };
  createdAt: string; // ISO string
}

// Interface cho message sent acknowledgment
export interface MessageSentPayload {
  success: boolean;
  conversationId: string;
  messageId?: string;
  error?: string;
}

// Interface cho notification event
export interface NotificationPayload {
  type: 'message' | 'assignment' | 'timeout' | 'escalation';
  title: string;
  message: string;
  data?: any;
  timestamp: string; // ISO string
}

// Interface cho conversation updated event
export interface ConversationUpdatedPayload {
  conversationId: string;
  status: 'active' | 'inactive' | 'closed';
  caseResolved: boolean;
  assignedReviewerId?: string;
  lastMessageAt: string; // ISO string
}

// Interface cho reviewer session data
export interface ReviewerSession {
  userId: string;
  socketId: string;
  connectedAt: string; // ISO string
  lastActivity: string; // ISO string
  isOnline: boolean;
}

// Interface cho typing indicator
export interface TypingPayload {
  conversationId: string;
  isTyping: boolean;
  reviewerId: string;
}

// Interface cho conversation assignment
export interface ConversationAssignmentPayload {
  conversationId: string;
  customerId: string;
  messageId: string;
  assignedAt: string; // ISO string
  timeoutAt: string; // ISO string
  priority: 'low' | 'medium' | 'high';
}

// Interface cho online reviewers update
export interface OnlineReviewersPayload {
  reviewers: Array<{
    id: string;
    username: string;
    fullName: string;
    isOnline: boolean;
    connectedAt?: string;
  }>;
}

// Interface cho message status update
export interface MessageStatusUpdatePayload {
  messageId: string;
  conversationId: string;
  status: string;
  updatedAt: string; // ISO string
}

// Interface cho real-time statistics
export interface StatisticsUpdatePayload {
  type: 'message_stats' | 'reviewer_stats' | 'ai_stats';
  data: any;
  timestamp: string; // ISO string
}

// Interface cho error handling
export interface SocketErrorPayload {
  event: string;
  error: string;
  details?: any;
  timestamp: string; // ISO string
}
