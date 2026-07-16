import { IsString, Length } from 'class-validator';

export class HoldEntryDto {
  @IsString()
  @Length(5, 500)
  reason!: string;
}
