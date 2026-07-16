import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class UpdateLevelDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  name?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  contributionAmount?: number;

  @IsOptional()
  @Min(0)
  @Max(100)
  feePercent?: number;

  @IsOptional()
  @Min(0)
  @Max(100)
  referralPoolAllocationPercentOfFee?: number;

  @IsOptional()
  @Min(0)
  @Max(100)
  incentivePoolAllocationPercentOfFee?: number;

  @IsOptional()
  @Min(0)
  @Max(100)
  platformRevenuePercentOfFee?: number;

  @IsOptional()
  @Min(0)
  @Max(100)
  incentiveBonusRateOfPrincipal?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  stalledThresholdDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
