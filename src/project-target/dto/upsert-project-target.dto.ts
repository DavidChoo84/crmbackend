import { IsInt, IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator';

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
  
  @IsNumber()
  adSpend: number;
}