import { IsString, Matches, MinLength } from 'class-validator';

export class MfaLoginVerifyDto {
  @IsString()
  @MinLength(10)
  mfaPendingToken!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be exactly 6 digits' })
  code!: string;
}
