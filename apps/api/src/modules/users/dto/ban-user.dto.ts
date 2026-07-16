import { IsString, Length } from 'class-validator';

export class BanUserDto {
  @IsString()
  @Length(5, 500)
  reason!: string;
}
