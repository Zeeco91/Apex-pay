import { IsString, Length } from 'class-validator';

export class RaiseDisputeDto {
  @IsString()
  @Length(10, 500)
  reason!: string;
}
