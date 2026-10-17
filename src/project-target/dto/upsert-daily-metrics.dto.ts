import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsInt, IsNotEmpty, IsNumber, IsString, Min, ValidateNested } from 'class-validator';

export class DailyMetricEntryDto {
  @IsDateString()
  date: string; // 'YYYY-MM-DD'

  @IsInt()
  @Min(0)
  leads: number;

  @IsNumber()
  @Min(0)
  adSpend: number;
}

export class UpsertDailyMetricsDto {
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DailyMetricEntryDto)
  days: DailyMetricEntryDto[];
}
