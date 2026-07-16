import { IsString, IsUUID, Length } from 'class-validator';

export class ManualMatchDto {
  @IsUUID()
  payerEntryId!: string;

  @IsUUID()
  payeeEntryId!: string;

  @IsString()
  @Length(5, 500)
  reason!: string;
}
