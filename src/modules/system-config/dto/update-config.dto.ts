import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsEnum } from 'class-validator';
import { ConfigKey } from '../entities/system-config.entity';

export class UpdateConfigDto {
  @ApiProperty({
    description: 'Key của config cần update',
    enum: ConfigKey,
    example: ConfigKey.AI_CONFIDENCE_THRESHOLD,
  })
  @IsEnum(ConfigKey)
  @IsNotEmpty()
  configKey: ConfigKey;

  @ApiProperty({
    description: 'Giá trị mới của config (sẽ được chuyển đổi theo dataType)',
    example: '80',
  })
  @IsString()
  @IsNotEmpty()
  configValue: string;

  @ApiProperty({
    description: 'Mô tả về config',
    required: false,
    example: 'Ngưỡng độ chính xác của AI Agent để quyết định auto response',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
