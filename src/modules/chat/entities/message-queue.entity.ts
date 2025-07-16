import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { Message } from './message.entity';
import { MessageQueueType, MessageQueueStatus } from '../types/enums';

@Entity('message_queue')
@Index(['messageId'])
@Index(['status'])
@Index(['queueType'])
@Index(['scheduledAt'])
export class MessageQueue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'message_id' })
  messageId: string;

  @Column({
    name: 'queue_type',
    type: 'enum',
    enum: MessageQueueType,
  })
  queueType: MessageQueueType;

  @Column({
    type: 'enum',
    enum: MessageQueueStatus,
    default: MessageQueueStatus.PENDING,
  })
  status: MessageQueueStatus;

  @Column({ default: 0 })
  priority: number;

  @Column({ type: 'json', nullable: true })
  payload: any;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ name: 'scheduled_at', type: 'datetime' })
  scheduledAt: Date;

  @Column({ name: 'processed_at', type: 'datetime', nullable: true })
  processedAt: Date;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Message, (message) => message.queues)
  @JoinColumn({ name: 'message_id' })
  message: Message;

  constructor() {
    this.status = MessageQueueStatus.PENDING;
    this.priority = 0;
    this.scheduledAt = new Date();
  }
}
