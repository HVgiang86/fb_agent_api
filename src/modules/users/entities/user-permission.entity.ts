import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './users.entity';
import { Permission } from './permission.entity';

@Entity({
  name: 'user_permissions',
})
@Index(['userId', 'permissionId'], { unique: true })
export class UserPermission {
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
    name: 'permission_id',
    type: 'varchar',
    length: 36,
    nullable: false,
  })
  public permissionId: string;

  @CreateDateColumn({
    name: 'granted_at',
    type: 'datetime',
  })
  public grantedAt: Date;

  @Column({
    name: 'granted_by',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  public grantedBy?: string;

  // Relations
  @ManyToOne(() => User, (user) => user.userPermissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  public user: User;

  @ManyToOne(() => Permission, (permission) => permission.userPermissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'permission_id' })
  public permission: Permission;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'granted_by' })
  public granter?: User;
}
