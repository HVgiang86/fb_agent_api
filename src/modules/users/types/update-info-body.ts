import { BankInfo } from './bank-info';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsDate,
  IsBoolean,
} from 'class-validator';

export class UpdateInfoBody {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  bankInfo?: BankInfo;

  @IsOptional()
  @IsNumber()
  failedLoginAttempts?: number;

  @IsOptional()
  @IsDate()
  lockedUntil?: Date;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  requireChangePassword?: boolean;

  @IsOptional()
  @IsDate()
  lastLoginAt?: Date;
}
