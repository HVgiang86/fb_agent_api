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
import { CustomerType } from './customer-type.entity';

@Entity({
  name: 'user_customer_types',
})
@Index(['userId', 'customerTypeId'], { unique: true })
export class UserCustomerType {
  @PrimaryGeneratedColumn('uuid')
  public id: string;

  @Column({
    name: 'user_id',
    type: 'uuid',
    nullable: false,
  })
  public userId: string;

  @Column({
    name: 'customer_type_id',
    type: 'uuid',
    nullable: false,
  })
  public customerTypeId: string;

  @CreateDateColumn({
    name: 'assigned_at',
    type: 'datetime',
  })
  public assignedAt: Date;

  @Column({
    name: 'assigned_by',
    type: 'uuid',
    nullable: true,
  })
  public assignedBy?: string;

  // Relations
  @ManyToOne(() => User, (user) => user.userCustomerTypes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  public user: User;

  @ManyToOne(
    () => CustomerType,
    (customerType) => customerType.userCustomerTypes,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'customer_type_id' })
  public customerType: CustomerType;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_by' })
  public assigner?: User;
}
