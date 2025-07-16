import { IsArray, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CustomerType } from '../../chat/types/enums';

export class UpdateCustomerTypesDto {
  @ApiProperty({
    description: 'Danh sách loại khách hàng phụ trách',
    enum: CustomerType,
    isArray: true,
    example: [CustomerType.INDIVIDUAL, CustomerType.BUSINESS],
  })
  @IsArray()
  @IsEnum(CustomerType, { each: true })
  customerTypes: CustomerType[];
}
