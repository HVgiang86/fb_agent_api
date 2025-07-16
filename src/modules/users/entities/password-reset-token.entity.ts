import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './users.entity';

@Entity({
  name: 'password_reset_tokens',
})
export class PasswordResetToken {
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
    name: 'otp_code',
    nullable: true,
    length: 6,
  })
  public otpCode?: string;

  @Column({
    name: 'expires_at',
    nullable: false,
    type: 'datetime',
  })
  public expiresAt: Date;

  @Column({
    name: 'used_at',
    nullable: true,
    type: 'datetime',
  })
  public usedAt?: Date;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
  })
  public createdAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.passwordResetTokens, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  public user: User;
}
