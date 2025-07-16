import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { DateTransformer } from '../../../utils/date-transformer';
import { User } from '../../users/entities/users.entity';

export enum ConfigDataType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  JSON = 'json',
}

export enum ConfigKey {
  // AI Agent Config
  AI_CONFIDENCE_THRESHOLD = 'ai_confidence_threshold',

  // Message Config
  ENABLE_WAITING_MESSAGE = 'enable_waiting_message',
  WAITING_MESSAGE_CONTENT = 'waiting_message_content',

  // Reviewer Config
  MAX_RETRY_COUNT = 'max_retry_count',
  REVIEWER_TIMEOUT_MINUTES = 'reviewer_timeout_minutes',
  AUTO_ASSIGN_STRATEGY = 'auto_assign_strategy', // round_robin, load_based, expertise_based

  // System Config
  SYSTEM_MAINTENANCE_MODE = 'system_maintenance_mode',
  MAX_MESSAGES_PER_CONVERSATION = 'max_messages_per_conversation',

  // Frontend Config
  DEFAULT_THEME = 'default_theme', // light, dark
  SESSION_TIMEOUT_MINUTES = 'session_timeout_minutes',

  // Notification Config
  ENABLE_EMAIL_NOTIFICATIONS = 'enable_email_notifications',
  ENABLE_SMS_NOTIFICATIONS = 'enable_sms_notifications',
}

@Entity({
  name: 'system_configs',
})
export class SystemConfig {
  @PrimaryGeneratedColumn('uuid')
  public id: string;

  @Column({
    name: 'config_key',
    type: 'enum',
    enum: ConfigKey,
    unique: true,
    nullable: false,
  })
  public configKey: ConfigKey;

  @Column({
    name: 'config_value',
    type: 'text',
    nullable: false,
  })
  public configValue: string;

  @Column({
    name: 'data_type',
    type: 'enum',
    enum: ConfigDataType,
    default: ConfigDataType.STRING,
  })
  public dataType: ConfigDataType;

  @Column({
    nullable: true,
    type: 'text',
  })
  public description?: string;

  @Column({
    name: 'is_active',
    default: true,
  })
  public isActive: boolean;

  @Column({
    name: 'is_system_config',
    default: false,
    comment: 'System config không được phép xóa',
  })
  public isSystemConfig: boolean;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
    transformer: DateTransformer,
  })
  public createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'datetime',
    transformer: DateTransformer,
  })
  public updatedAt: Date;

  @Column({
    name: 'created_by',
    nullable: true,
    type: 'varchar',
    length: 36,
  })
  public createdBy?: string;

  @Column({
    name: 'updated_by',
    nullable: true,
    type: 'varchar',
    length: 36,
  })
  public updatedBy?: string;

  // Relations
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  public creator?: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  public updater?: User;
}

export default SystemConfig;
