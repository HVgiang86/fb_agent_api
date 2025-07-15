import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { ConfigKey, ConfigDataType } from '../entities/system-config.entity';

export class CreateConfigDto {
  @ApiProperty({
    description: 'Key của config (phải unique)',
    enum: ConfigKey,
    example: ConfigKey.AI_CONFIDENCE_THRESHOLD,
  })
  @IsEnum(ConfigKey)
  @IsNotEmpty()
  configKey: ConfigKey;

  @ApiProperty({
    description: 'Giá trị của config (dạng string)',
    example: '80',
  })
  @IsString()
  @IsNotEmpty()
  configValue: string;

  @ApiProperty({
    description: 'Kiểu dữ liệu của config',
    enum: ConfigDataType,
    example: ConfigDataType.NUMBER,
  })
  @IsEnum(ConfigDataType)
  @IsNotEmpty()
  dataType: ConfigDataType;

  @ApiProperty({
    description: 'Mô tả về config',
    required: false,
    example: 'Ngưỡng độ chính xác của AI Agent để quyết định auto response',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Config có đang active không',
    default: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({
    description: 'Đây có phải system config không (không được phép xóa)',
    default: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isSystemConfig?: boolean;
}
