import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ProjectTargetService } from './project-target.service';
import { UpsertProjectTargetDto } from './dto/upsert-project-target.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // ⚠️ adjust path if different

// Open to any authenticated role (master + cs_pc), matching the "Project
// Target" tile in Project.jsx which isn't restricted to admins only.
@UseGuards(JwtAuthGuard)
@Controller('project-targets')
export class ProjectTargetController {
  constructor(private readonly service: ProjectTargetService) {}

  // GET /project-targets/:projectId — full history for a project
  @Get(':projectId')
  findByProject(@Param('projectId') projectId: string) {
    return this.service.findByProject(projectId);
  }

  // GET /project-targets/:projectId/:year/:month — one specific month
  @Get(':projectId/:year/:month')
  findOne(
    @Param('projectId') projectId: string,
    @Param('year') year: string,
    @Param('month') month: string,
  ) {
    return this.service.findOne(projectId, Number(year), Number(month));
  }

  // POST /project-targets — create or update the target for that month
  @Post()
  upsert(@Body() dto: UpsertProjectTargetDto) {
    return this.service.upsert(dto);
  }
}