import { IsArray, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PermissionName } from '../entities/permission.entity';

export class UpdatePermissionsDto {
  @ApiProperty({
    description: 'Danh sách quyền',
    enum: PermissionName,
    isArray: true,
    example: [PermissionName.CHAT, PermissionName.CUSTOMER_TYPE],
  })
  @IsArray()
  @IsEnum(PermissionName, { each: true })
  permissions: PermissionName[];
}
