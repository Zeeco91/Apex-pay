import { IsIn, IsString, Length } from 'class-validator';

export class ResolveDisputeDto {
  @IsIn(['CONFIRMED', 'REJECTED'])
  resolution!: 'CONFIRMED' | 'REJECTED';

  @IsString()
  @Length(10, 1000)
  notes!: string;
}
