import { IsString, Length } from 'class-validator';

export class MarkWithdrawalPaidDto {
  @IsString()
  @Length(2, 100)
  reference!: string;
}
