import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsEnum,
  IsBooleanString,
  IsNumberString,
} from 'class-validator';
import { ConversationStatus } from '../types/enums';

export class GetConversationsDto {
  @ApiProperty({
    description: 'Trạng thái conversation',
    enum: ConversationStatus,
    required: false,
    example: ConversationStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ConversationStatus)
  status?: ConversationStatus;

  @ApiProperty({
    description: 'Lọc theo case đã resolved',
    required: false,
    example: false,
  })
  @IsOptional()
  @IsBooleanString()
  caseResolved?: boolean;

  @ApiProperty({
    description: 'Số trang',
    required: false,
    example: 1,
  })
  @IsOptional()
  @IsNumberString()
  page?: number;

  @ApiProperty({
    description: 'Số lượng conversations mỗi trang',
    required: false,
    example: 20,
  })
  @IsOptional()
  @IsNumberString()
  limit?: number;
}
