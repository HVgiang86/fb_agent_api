import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
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
}
