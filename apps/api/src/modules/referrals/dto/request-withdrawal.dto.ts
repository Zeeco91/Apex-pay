import { IsUUID } from 'class-validator';

export class RequestWithdrawalDto {
  @IsUUID()
  referralBonusId!: string;
}
