import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ProjectMemberService } from './project-member.service';
import { CreateProjectMemberDto } from './dto/create-project-member.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // ⚠️ adjust path if different
import { RolesGuard } from '../auth/roles.guard'; // ⚠️ adjust path if different
import { Roles } from '../auth/roles.decorator'; // ⚠️ adjust path if different
import { UserRole } from '../users/user.entity'; // ⚠️ adjust if the enum member is named differently

// 🔒 This controller previously had NO guards at all — any unauthenticated
// request could read or modify project-member assignments. Now it requires
// login AND restricts the entire feature to master admins, matching the
// frontend's /members route (which is already master-only).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MASTER)
@Controller('project-members')
export class ProjectMemberController {
  constructor(private readonly service: ProjectMemberService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('members')
  getMembers() {
    return this.service.getMembers();
  }

  @Get('projects')
  getProjects() {
    return this.service.getProjects();
  }

  @Post()
  create(@Body() dto: CreateProjectMemberDto) {
    return this.service.create(dto);
  }

  @Put(':projectId/:userId')
  update(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Body() dto: CreateProjectMemberDto,
  ) {
    return this.service.update(projectId, userId, dto);
  }

  @Delete(':projectId/:userId')
  remove(@Param('projectId') projectId: string, @Param('userId') userId: string) {
    return this.service.remove(projectId, userId);
  }
}