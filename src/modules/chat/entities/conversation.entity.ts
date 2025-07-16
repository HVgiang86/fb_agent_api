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
import { Customer } from '../../users/entities/customer.entity';
import { User } from '../../users/entities/users.entity';
// import { Message } from './message.entity'; // Forward reference to avoid circular dependency
import { ConversationStatus } from '../types/enums';

@Entity('conversations')
@Index(['customerId'])
@Index(['assignedReviewerId'])
@Index(['status'])
@Index(['caseResolved'])
@Index(['startedAt'])
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'customer_id',
    type: 'varchar',
    length: 36,
  })
  customerId: string;

  @Column({
    name: 'assigned_reviewer_id',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  assignedReviewerId: string;

  @Column({
    type: 'enum',
    enum: ConversationStatus,
    default: ConversationStatus.ACTIVE,
  })
  status: ConversationStatus;

  @Column({ name: 'case_resolved', default: false })
  caseResolved: boolean;

  @Column({ length: 255, nullable: true })
  title: string;

  // Thống kê
  @Column({ name: 'total_messages', default: 0 })
  totalMessages: number;

  @Column({ name: 'auto_messages', default: 0 })
  autoMessages: number;

  @Column({ name: 'manual_messages', default: 0 })
  manualMessages: number;

  // Timestamps
  @Column({ name: 'started_at', type: 'datetime' })
  startedAt: Date;

  @Column({ name: 'ended_at', type: 'datetime', nullable: true })
  endedAt: Date;

  @Column({ name: 'last_message_at', type: 'datetime', nullable: true })
  lastMessageAt: Date;

  @Column({ name: 'resolved_at', type: 'datetime', nullable: true })
  resolvedAt: Date;

  @Column({
    name: 'resolved_by',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  resolvedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_reviewer_id' })
  assignedReviewer: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'resolved_by' })
  resolver: User;

  @OneToMany('Message', 'conversation')
  messages: any[];

  constructor() {
    this.startedAt = new Date();
    this.totalMessages = 0;
    this.autoMessages = 0;
    this.manualMessages = 0;
    this.caseResolved = false;
    this.status = ConversationStatus.ACTIVE;
  }
}
