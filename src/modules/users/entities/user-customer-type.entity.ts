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
import { CustomerType } from '../../chat/types/enums';

@Entity({
  name: 'user_customer_types',
})
@Index(['userId', 'customerType'], { unique: true })
export class UserCustomerType {
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
    name: 'customer_type',
    type: 'enum',
    enum: CustomerType,
    nullable: false,
  })
  public customerType: CustomerType;

  @CreateDateColumn({
    name: 'assigned_at',
    type: 'datetime',
  })
  public assignedAt: Date;

  @Column({
    name: 'assigned_by',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  public assignedBy?: string;

  // Relations
  @ManyToOne(() => User, (user) => user.userCustomerTypes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  public user: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_by' })
  public assigner?: User;
}
