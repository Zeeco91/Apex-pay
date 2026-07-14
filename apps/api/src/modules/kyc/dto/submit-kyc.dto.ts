import { IsIn, IsString, Length } from 'class-validator';

const ID_TYPES = [
  'NIN',
  'BVN',
  'VOTERS_CARD',
  'DRIVERS_LICENSE',
  'INTERNATIONAL_PASSPORT',
] as const;

export class SubmitKycDto {
  @IsIn(ID_TYPES)
  idType!: (typeof ID_TYPES)[number];

  @IsString()
  @Length(4, 20)
  idNumber!: string;
}
