import { IsIn, IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsIn(['REGISTER', 'PIN_RESET'])
  purpose!: 'REGISTER' | 'PIN_RESET';

  @IsString()
  @Length(6, 6)
  code!: string;
}
