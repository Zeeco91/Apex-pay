import { IsString, Length } from 'class-validator';

export class RejectWithdrawalDto {
  @IsString()
  @Length(5, 500)
  reason!: string;
}
