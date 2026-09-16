import { IsNotEmpty, IsString } from 'class-validator';

export class CreateProjectMemberDto {
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @IsString()
  @IsNotEmpty()
  userId: string;
}