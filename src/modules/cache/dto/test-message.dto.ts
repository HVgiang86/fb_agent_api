import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import {
  MessageStatus,
  SenderType,
  MessagePriority,
} from '../../chat/types/message.types';

export class TestMessageDto {
  @ApiProperty({
    description: 'ID của conversation',
    example: 'conv_12345',
    required: false,
  })
  @IsString()
  @IsOptional()
  conversationId?: string;

  @ApiProperty({
    description: 'ID của customer',
    example: 'customer_12345',
    required: false,
  })
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiProperty({
    description: 'ID của sender',
    example: 'sender_12345',
    required: false,
  })
  @IsString()
  @IsOptional()
  senderId?: string;

  @ApiProperty({
    description: 'Loại người gửi',
    enum: SenderType,
    example: SenderType.CUSTOMER,
    required: false,
  })
  @IsEnum(SenderType)
  @IsOptional()
  senderType?: SenderType;

  @ApiProperty({
    description: 'Nội dung tin nhắn',
    example: 'Xin chào, tôi cần hỗ trợ về thẻ tín dụng',
    required: false,
  })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiProperty({
    description: 'Trạng thái tin nhắn',
    enum: MessageStatus,
    example: MessageStatus.RECEIVED,
    required: false,
  })
  @IsEnum(MessageStatus)
  @IsOptional()
  status?: MessageStatus;

  @ApiProperty({
    description: 'Độ chính xác AI (0-100)',
    example: 75,
    minimum: 0,
    maximum: 100,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  confidence?: number;

  @ApiProperty({
    description: 'Có thêm vào processing queue không',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  addToQueue?: boolean;

  @ApiProperty({
    description: 'Độ ưu tiên khi thêm vào queue',
    enum: MessagePriority,
    example: MessagePriority.NORMAL,
    required: false,
  })
  @IsEnum(MessagePriority)
  @IsOptional()
  priority?: MessagePriority;
}
