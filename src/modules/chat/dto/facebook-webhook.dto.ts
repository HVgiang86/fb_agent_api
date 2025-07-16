import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FacebookCustomerInfoDto {
  @ApiProperty({
    description: 'Facebook ID của khách hàng',
    example: 'fb_123456789',
  })
  @IsString()
  @IsNotEmpty()
  facebookId: string;

  @ApiProperty({
    description: 'Tên Facebook của khách hàng',
    example: 'Nguyễn Văn A',
    required: false,
  })
  @IsString()
  @IsOptional()
  facebookName?: string;

  @ApiProperty({
    description: 'URL profile Facebook',
    example: 'https://facebook.com/profile/123456789',
    required: false,
  })
  @IsString()
  @IsOptional()
  profileUrl?: string;

  @ApiProperty({
    description: 'URL avatar Facebook',
    example: 'https://scontent.xx.fbcdn.net/v/avatar.jpg',
    required: false,
  })
  @IsString()
  @IsOptional()
  avatarUrl?: string;
}

export class FacebookWebhookPayloadDto {
  @ApiProperty({
    description: 'ID tin nhắn từ Facebook',
    example: 'fb_msg_123456789',
  })
  @IsString()
  @IsNotEmpty()
  messageId: string;

  @ApiProperty({
    description: 'ID conversation (nếu có)',
    example: 'conv_123456789',
    required: false,
  })
  @IsString()
  @IsOptional()
  conversationId?: string;

  @ApiProperty({
    description: 'ID khách hàng trên fb',
    example: 'fb_123456789',
  })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({
    description: 'Nội dung tin nhắn',
    example: 'Xin chào, tôi muốn hỏi về sản phẩm thẻ tín dụng',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    description: 'Thời gian tin nhắn (ISO 8601)',
    example: '2024-01-01T10:00:00.000Z',
  })
  @IsDateString()
  timestamp: string;

  @ApiProperty({
    description: 'Thông tin khách hàng từ Facebook',
    type: FacebookCustomerInfoDto,
  })
  @ValidateNested()
  @Type(() => FacebookCustomerInfoDto)
  @IsObject()
  customerInfo: FacebookCustomerInfoDto;

  @ApiProperty({
    description: 'Metadata bổ sung',
    example: {
      messageType: 'text',
      platform: 'facebook',
      source: 'page_inbox',
    },
    required: false,
  })
  @IsObject()
  @IsOptional()
  metadata?: any;
}
