import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  ValidateIf,
} from 'class-validator';

export class RequestOtpDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsIn(['REGISTER', 'PIN_RESET'])
  purpose!: 'REGISTER' | 'PIN_RESET';

  // Required for REGISTER only — the account doesn't exist yet, so there's no stored email to
  // send to. PIN_RESET instead uses the requesting account's already-on-file email, looked up
  // server-side (see AuthService.requestPinReset), so it never needs this field.
  @ValidateIf((dto: RequestOtpDto) => dto.purpose === 'REGISTER')
  @IsEmail()
  email?: string;
}
