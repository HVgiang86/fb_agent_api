import { IsString, IsNotEmpty } from 'class-validator';

export class ConnectSocketDto {
  @IsString()
  @IsNotEmpty()
  user_id: string;
}
