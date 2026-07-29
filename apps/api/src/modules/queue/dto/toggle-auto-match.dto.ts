import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class ToggleAutoMatchDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  @Length(5, 500)
  reason?: string;
}
