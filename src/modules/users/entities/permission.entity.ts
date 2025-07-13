import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  OneToMany,
} from 'typeorm';
import { UserPermission } from './user-permission.entity';

export enum PermissionName {
  CHAT = 'chat',
  KB = 'kb',
  PERMISSION = 'permission',
  CUSTOMER_TYPE = 'customer_type',
}

@Entity({
  name: 'permissions',
})
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  public id: string;

  @Column({
    type: 'enum',
    enum: PermissionName,
    unique: true,
    nullable: false,
  })
  public name: PermissionName;

  @Column({
    name: 'display_name',
    nullable: false,
    length: 100,
  })
  public displayName: string;

  @Column({
    nullable: true,
    type: 'text',
  })
  public description?: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
  })
  public createdAt: Date;

  // Relations
  @OneToMany(
    () => UserPermission,
    (userPermission) => userPermission.permission,
  )
  public userPermissions: UserPermission[];
}
