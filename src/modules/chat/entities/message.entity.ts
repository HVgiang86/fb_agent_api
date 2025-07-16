import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/users.entity';
import { Conversation } from './conversation.entity';
import { MessageStatus, SenderType } from '../types/enums';

@Entity('messages')
@Index(['conversationId'])
@Index(['customerId'])
@Index(['status'])
@Index(['senderType'])
@Index(['createdAt'])
@Index(['facebookMessageId'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'conversation_id',
    type: 'varchar',
    length: 36,
  })
  conversationId: string;

  @Column({
    name: 'customer_id',
    type: 'varchar',
    length: 36,
  })
  customerId: string;

  @Column({
    name: 'sender_id',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  senderId: string;

  @Column({
    name: 'sender_type',
    type: 'enum',
    enum: SenderType,
  })
  senderType: SenderType;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'auto_response', type: 'text', nullable: true })
  autoResponse: string;

  @Column({
    name: 'confidence_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  confidenceScore: number;

  @Column({
    type: 'enum',
    enum: MessageStatus,
    default: MessageStatus.RECEIVED,
  })
  status: MessageStatus;

  @Column({ name: 'retry_count', default: 0 })
  retryCount: number;

  @Column({ name: 'max_retries', default: 3 })
  maxRetries: number;

  @Column({ name: 'facebook_message_id', length: 100, nullable: true })
  facebookMessageId: string;

  @Column({ name: 'processed_at', type: 'datetime', nullable: true })
  processedAt: Date;

  @Column({ name: 'responded_at', type: 'datetime', nullable: true })
  respondedAt: Date;

  @Column({ name: 'skip_ai_reason', type: 'text', nullable: true })
  skipAiReason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Conversation, (conversation) => conversation.messages)
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @OneToMany('MessageQueue', (queue: any) => queue.message)
  queues: any[];

  @OneToMany('ReviewerFeedback', (feedback: any) => feedback.message)
  feedbacks: any[];

  constructor() {
    this.status = MessageStatus.RECEIVED;
    this.retryCount = 0;
    this.maxRetries = 3;
  }
}
