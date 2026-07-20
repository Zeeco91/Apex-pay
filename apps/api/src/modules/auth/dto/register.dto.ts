import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;

  // Required for every new registration — the interim OTP delivery address while SMS is
  // unavailable (see common/email/email.module.ts). Nullable on existing accounts predating
  // this field, but never optional for a new one.
  @IsEmail()
  email!: string;

  @IsString()
  @Length(2, 100)
  fullName!: string;

  @IsString()
  @Matches(/^\d{4}$/, { message: 'pin must be exactly 4 digits' })
  pin!: string;

  @IsOptional()
  @IsString()
  referralCode?: string;
}
