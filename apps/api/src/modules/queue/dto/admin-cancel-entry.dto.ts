import { IsString, Length } from 'class-validator';

export class AdminCancelEntryDto {
  @IsString()
  @Length(5, 500)
  reason!: string;
}
