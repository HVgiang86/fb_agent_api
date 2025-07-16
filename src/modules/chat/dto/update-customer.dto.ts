import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEmail,
  Length,
  IsUrl,
  IsEnum,
  IsObject,
} from 'class-validator';
import { CustomerType } from '../types/enums';

export class UpdateCustomerDto {
  @ApiProperty({
    description: 'Tên Facebook của khách hàng',
    example: 'Nguyễn Văn A',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Length(1, 255)
  facebookName?: string;

  @ApiProperty({
    description: 'URL profile Facebook',
    example: 'https://facebook.com/profile/123456789',
    required: false,
  })
  @IsUrl()
  @IsOptional()
  facebookProfileUrl?: string;

  @ApiProperty({
    description: 'URL avatar Facebook',
    example: 'https://scontent.xx.fbcdn.net/v/avatar.jpg',
    required: false,
  })
  @IsUrl()
  @IsOptional()
  facebookAvatarUrl?: string;

  @ApiProperty({
    description: 'Số điện thoại khách hàng',
    example: '0123456789',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Length(10, 15)
  phone?: string;

  @ApiProperty({
    description: 'Email khách hàng',
    example: 'customer@example.com',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    description: 'Loại khách hàng',
    enum: CustomerType,
    example: CustomerType.INDIVIDUAL,
    required: false,
  })
  @IsEnum(CustomerType)
  @IsOptional()
  customerType?: CustomerType;

  @ApiProperty({
    description: 'Phân tích ý định khách hàng từ AI',
    example: {
      mainTopic: 'thẻ tín dụng',
      keyInformation: 'hỏi về phí thường niên',
      sentiment: 'positive',
    },
    required: false,
  })
  @IsObject()
  @IsOptional()
  intentAnalysis?: any;

  @ApiProperty({
    description: 'Phân tích hành vi khách hàng từ AI',
    example: {
      frequentTopics: ['thẻ tín dụng', 'vay tiêu dùng'],
      engagementLevel: 'high',
      preferredTime: 'morning',
    },
    required: false,
  })
  @IsObject()
  @IsOptional()
  behaviorAnalysis?: any;

  @ApiProperty({
    description: 'Lịch sử tương tác với khách hàng',
    example: {
      previousProducts: ['thẻ ATM'],
      conversationCount: 5,
      lastTopics: ['transfer', 'balance'],
    },
    required: false,
  })
  @IsObject()
  @IsOptional()
  interactionHistory?: any;
}
