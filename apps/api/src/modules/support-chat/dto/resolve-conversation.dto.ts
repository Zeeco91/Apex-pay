import { IsOptional, IsString, Length } from 'class-validator';

export class ResolveConversationDto {
  @IsOptional()
  @IsString()
  @Length(0, 500)
  reason?: string;
}
