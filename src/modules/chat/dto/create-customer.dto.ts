import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  Length,
  IsUrl,
  IsEnum,
} from 'class-validator';
import { CustomerType } from '../types/enums';

export class CreateCustomerDto {
  @ApiProperty({
    description: 'Facebook ID của khách hàng',
    example: 'fb_123456789',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  facebookId: string;

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
}
