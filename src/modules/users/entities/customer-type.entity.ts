import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  OneToMany,
} from 'typeorm';
import { UserCustomerType } from './user-customer-type.entity';

export enum CustomerTypeName {
  INDIVIDUAL = 'individual',
  BUSINESS = 'business',
  HOUSEHOLD_BUSINESS = 'household_business',
  PARTNER = 'partner',
}

@Entity({
  name: 'customer_types',
})
export class CustomerType {
  @PrimaryGeneratedColumn('uuid')
  public id: string;

  @Column({
    type: 'enum',
    enum: CustomerTypeName,
    unique: true,
    nullable: false,
  })
  public name: CustomerTypeName;

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

  @Column({
    name: 'is_active',
    default: true,
  })
  public isActive: boolean;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
  })
  public createdAt: Date;

  // Relations
  @OneToMany(
    () => UserCustomerType,
    (userCustomerType) => userCustomerType.customerType,
  )
  public userCustomerTypes: UserCustomerType[];
}
