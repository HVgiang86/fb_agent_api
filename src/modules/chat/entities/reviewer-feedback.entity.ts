import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { Message } from './message.entity';
import { User } from '../../users/entities/users.entity';
import { ReviewerFeedbackType } from '../types/enums';

@Entity('reviewer_feedback')
@Index(['messageId'])
@Index(['reviewerId'])
@Index(['feedbackType'])
export class ReviewerFeedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'message_id' })
  messageId: string;

  @Column({ name: 'reviewer_id' })
  reviewerId: string;

  @Column({ name: 'original_response', type: 'text' })
  originalResponse: string;

  @Column({ name: 'corrected_response', type: 'text', nullable: true })
  correctedResponse: string;

  @Column({
    name: 'feedback_type',
    type: 'enum',
    enum: ReviewerFeedbackType,
  })
  feedbackType: ReviewerFeedbackType;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({
    name: 'confidence_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  confidenceScore: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relationships
  @ManyToOne(() => Message, (message) => message.feedbacks)
  @JoinColumn({ name: 'message_id' })
  message: Message;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reviewer_id' })
  reviewer: User;
}
