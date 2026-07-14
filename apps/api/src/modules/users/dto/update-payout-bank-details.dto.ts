import { IsString, Length, Matches } from 'class-validator';

export class UpdatePayoutBankDetailsDto {
  @IsString()
  @Length(2, 100)
  bankName!: string;

  @IsString()
  @Matches(/^\d{10}$/, { message: 'accountNumber must be exactly 10 digits' })
  accountNumber!: string;

  @IsString()
  @Length(2, 100)
  accountName!: string;
}
