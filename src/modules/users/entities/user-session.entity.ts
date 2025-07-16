import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './users.entity';

@Entity({
  name: 'user_sessions',
})
export class UserSession {
  @PrimaryGeneratedColumn('uuid')
  public id: string;

  @Column({
    name: 'user_id',
    type: 'varchar',
    length: 36,
    nullable: false,
  })
  public userId: string;

  @Column({
    name: 'token_hash',
    nullable: false,
    length: 255,
  })
  public tokenHash: string;

  @Column({
    name: 'refresh_token_hash',
    nullable: true,
    length: 255,
  })
  public refreshTokenHash?: string;

  @Column({
    name: 'ip_address',
    nullable: true,
    length: 45,
  })
  public ipAddress?: string;

  @Column({
    name: 'user_agent',
    nullable: true,
    type: 'text',
  })
  public userAgent?: string;

  @Column({
    name: 'expires_at',
    nullable: false,
    type: 'datetime',
  })
  public expiresAt: Date;

  @Column({
    name: 'last_activity_at',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  public lastActivityAt: Date;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
  })
  public createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'datetime',
  })
  public updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.userSessions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  public user: User;
}
