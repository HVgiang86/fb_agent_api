import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { DateTransformer } from '../../../utils/date-transformer';
import { CustomerType } from '../../chat/types/enums';
import { Conversation } from '../../chat/entities/conversation.entity';

@Entity('customers')
@Index(['customerType'])
@Index(['lastInteractionAt'])
@Index(['email'])
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'facebook_id', length: 100, unique: true })
  facebookId: string;

  @Column({ name: 'facebook_name', length: 255, nullable: true })
  facebookName: string;

  @Column({ name: 'facebook_profile_url', type: 'text', nullable: true })
  facebookProfileUrl: string;

  @Column({ name: 'facebook_avatar_url', type: 'text', nullable: true })
  facebookAvatarUrl: string;

  @Column({ length: 15, nullable: true })
  phone: string;

  @Column({ length: 255, nullable: true })
  email: string;

  // Thông tin phân tích từ AI
  @Column({
    name: 'customer_type',
    type: 'enum',
    enum: CustomerType,
    nullable: true,
  })
  customerType: CustomerType;

  @Column({ name: 'intent_analysis', type: 'json', nullable: true })
  intentAnalysis: any;

  @Column({ name: 'behavior_analysis', type: 'json', nullable: true })
  behaviorAnalysis: any;

  @Column({ name: 'interaction_history', type: 'json', nullable: true })
  interactionHistory: any;

  // Metadata
  @Column({
    name: 'first_interaction_at',
    type: 'datetime',
    nullable: true,
    transformer: DateTransformer,
  })
  firstInteractionAt: Date;

  @Column({
    name: 'last_interaction_at',
    type: 'datetime',
    nullable: true,
    transformer: DateTransformer,
  })
  lastInteractionAt: Date;

  @Column({ name: 'total_conversations', default: 0 })
  totalConversations: number;

  @Column({ name: 'total_messages', default: 0 })
  totalMessages: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relationships
  @OneToMany(() => Conversation, (conversation) => conversation.customer)
  conversations: Conversation[];

  constructor() {
    this.totalConversations = 0;
    this.totalMessages = 0;
  }
}
