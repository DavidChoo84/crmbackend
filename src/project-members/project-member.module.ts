import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectMember } from './project-member.entity';
import { ProjectMemberService } from './project-member.service';
import { ProjectMemberController } from './project-member.controller';
import { User } from '../users/user.entity';
import { Project } from '../projects/project.entity'; // ⚠️ adjust path if different

@Module({
  imports: [TypeOrmModule.forFeature([ProjectMember, User, Project])],
  controllers: [ProjectMemberController],
  providers: [ProjectMemberService],
})
export class ProjectMemberModule {}