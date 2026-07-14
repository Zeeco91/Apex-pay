import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class RequestOtpDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsIn(['REGISTER', 'PIN_RESET'])
  purpose!: 'REGISTER' | 'PIN_RESET';
}
