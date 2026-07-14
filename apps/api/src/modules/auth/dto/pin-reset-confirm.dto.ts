import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class PinResetConfirmDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @Length(6, 6)
  code!: string;

  @IsString()
  @Matches(/^\d{4}$/, { message: 'newPin must be exactly 4 digits' })
  newPin!: string;
}
