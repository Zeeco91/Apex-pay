import { IsString, Length } from 'class-validator';

export class RejectKycDto {
  @IsString()
  @Length(5, 500)
  reason!: string;
}
