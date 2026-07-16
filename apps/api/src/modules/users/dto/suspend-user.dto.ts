import { IsString, Length } from 'class-validator';

export class SuspendUserDto {
  @IsString()
  @Length(5, 500)
  reason!: string;
}
