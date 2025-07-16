/**
 * Enums cho Chat Module
 */

export enum ConversationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  CLOSED = 'closed',
  RESOLVED = 'resolved',
}

export enum SenderType {
  CUSTOMER = 'customer',
  BOT = 'bot',
  REVIEWER = 'reviewer',
}

export enum CustomerType {
  INDIVIDUAL = 'individual',
  BUSINESS = 'business',
  HOUSEHOLD_BUSINESS = 'household_business',
  PARTNER = 'partner',
}

export enum MessageStatus {
  RECEIVED = 'received',
  WAIT_AI_AGENT = 'wait_ai_agent',
  AI_AGENT_DONE_AUTO = 'ai_agent_done_auto',
  AI_AGENT_DONE_NEED_MANUAL = 'ai_agent_done_need_manual',
  SKIP_AI_SENT_TO_REVIEWER = 'skip_ai_sent_to_reviewer',
  SENT_TO_REVIEWER = 'sent_to_reviewer',
  SENT_TO_REVIEWER_SENT_WAITING_MESSAGE = 'sent_to_reviewer_sent_waiting_message',
  REVIEWER_REPLIED = 'reviewer_replied',
  AUTO_RESPONSE_DONE = 'auto_response_done',
  MANUAL_RESPONSE_DONE = 'manual_response_done',
  ESCALATED = 'escalated',
  FAILED_TO_SEND = 'failed_to_send',
}

export enum MessageQueueType {
  AI_PROCESSING = 'ai_processing',
  FACEBOOK_RESPONSE = 'facebook_response',
  MESSAGE_DISTRIBUTION = 'message_distribution',
  TIMEOUT_CHECK = 'timeout_check',
}

export enum MessageQueueStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum ReviewerFeedbackType {
  CORRECT = 'correct',
  INCORRECT = 'incorrect',
  NEEDS_IMPROVEMENT = 'needs_improvement',
}
