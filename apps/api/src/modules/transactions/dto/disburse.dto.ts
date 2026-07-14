import { IsString, Length } from 'class-validator';

export class DisburseDto {
  @IsString()
  @Length(2, 100)
  reference!: string;
}
