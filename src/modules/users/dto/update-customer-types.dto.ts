import { IsArray, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CustomerTypeName } from '../entities/customer-type.entity';

export class UpdateCustomerTypesDto {
  @ApiProperty({
    description: 'Danh sách loại khách hàng phụ trách',
    enum: CustomerTypeName,
    isArray: true,
    example: [CustomerTypeName.INDIVIDUAL, CustomerTypeName.BUSINESS],
  })
  @IsArray()
  @IsEnum(CustomerTypeName, { each: true })
  customerTypes: CustomerTypeName[];
}
