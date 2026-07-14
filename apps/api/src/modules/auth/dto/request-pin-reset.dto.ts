import { IsNotEmpty, IsString } from 'class-validator';

export class RequestPinResetDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;
}
