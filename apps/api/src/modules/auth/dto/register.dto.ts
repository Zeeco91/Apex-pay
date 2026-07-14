import {
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
