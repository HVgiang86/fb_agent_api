import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { DateTransformer } from '../../../utils/date-transformer';
import { UserPermission } from './user-permission.entity';
import { UserCustomerType } from './user-customer-type.entity';
import { UserSession } from './user-session.entity';
import { PasswordResetToken } from './password-reset-token.entity';

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
}

@Entity({
  name: 'users',
})
export class User {
  @PrimaryGeneratedColumn('uuid')
  public id: string;

  @Column({
    unique: true,
    nullable: false,
    length: 50,
  })
  public username: string;

  @Column({
    unique: true,
    nullable: false,
    length: 255,
  })
  public email: string;

  @Column({
    name: 'password_hash',
    nullable: false,
    length: 255,
  })
  public passwordHash: string;

  @Column({
    name: 'full_name',
    nullable: false,
    length: 100,
  })
  public fullName: string;

  @Column({
    nullable: true,
    length: 15,
  })
  public phone?: string;

  @Column({
    nullable: true,
    type: 'text',
  })
  public address?: string;

  @Column({
    name: 'date_of_birth',
    nullable: true,
    type: 'date',
    transformer: DateTransformer,
  })
  public dateOfBirth?: Date;

  @Column({
    type: 'enum',
    enum: Gender,
    nullable: true,
  })
  public gender?: Gender;

  @Column({
    name: 'is_active',
    default: true,
  })
  public isActive: boolean;

  @Column({
    name: 'require_change_password',
    default: false,
  })
  public requireChangePassword: boolean;

  @Column({
    name: 'last_login_at',
    nullable: true,
    type: 'datetime',
    transformer: DateTransformer,
  })
  public lastLoginAt?: Date;

  @Column({
    name: 'failed_login_attempts',
    default: 0,
  })
  public failedLoginAttempts: number;

  @Column({
    name: 'locked_until',
    nullable: true,
    type: 'datetime',
    transformer: DateTransformer,
  })
  public lockedUntil?: Date;

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

  @Column({
    name: 'created_by',
    nullable: true,
    type: 'uuid',
  })
  public createdBy?: string;

  @Column({
    name: 'updated_by',
    nullable: true,
    type: 'uuid',
  })
  public updatedBy?: string;

  // Relations
  @OneToMany(() => UserPermission, (userPermission) => userPermission.user)
  public userPermissions: UserPermission[];

  @OneToMany(
    () => UserCustomerType,
    (userCustomerType) => userCustomerType.user,
  )
  public userCustomerTypes: UserCustomerType[];

  @OneToMany(() => UserSession, (userSession) => userSession.user)
  public userSessions: UserSession[];

  @OneToMany(
    () => PasswordResetToken,
    (passwordResetToken) => passwordResetToken.user,
  )
  public passwordResetTokens: PasswordResetToken[];

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  public creator?: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  public updater?: User;
}

export default User;
