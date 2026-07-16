import { IsOptional, IsString, Length } from 'class-validator';

export class ReinstateUserDto {
  @IsOptional()
  @IsString()
  @Length(5, 500)
  reason?: string;
}
