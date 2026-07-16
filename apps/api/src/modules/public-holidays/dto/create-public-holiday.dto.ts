import { IsDateString, IsString, Length } from 'class-validator';

export class CreatePublicHolidayDto {
  @IsDateString()
  date!: string;

  @IsString()
  @Length(1, 100)
  name!: string;
}
