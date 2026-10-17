import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpsertProjectTargetDto {
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @IsInt()
  year: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsNumber()
  targetOfMonth: number;

  @IsNumber()
  estimateSales: number;

  // Legacy monthly figure — no longer sent by the UI or used by the
  // dashboard (ad spend now comes from the daily entries). Left optional so
  // older clients still validate; the service ignores it.
  @IsOptional()
  @IsNumber()
  adSpend?: number;
}