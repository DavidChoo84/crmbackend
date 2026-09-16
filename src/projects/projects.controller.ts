import { Controller, Get, Post, Put, Delete, Param, Body, Header, UseGuards, Request } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { Project } from './project.entity';
import { ProductsService } from '../products/products.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard'; // ⚠️ adjust path if different
import { Roles } from '../auth/roles.decorator'; // ⚠️ adjust path if different
import { UserRole } from '../users/user.entity'; // ⚠️ adjust if the enum member is named differently
import { Request as ExpressRequest } from 'express';

interface AuthenticatedRequest extends ExpressRequest {
  user: {
    userId: string;
    role: string;
  };
}

// 🔒 JwtAuthGuard: every endpoint requires login.
// 🔒 RolesGuard: permissive by default — only enforces a role check on
//    endpoints that carry an explicit @Roles(...) decorator (see below).
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly productsService: ProductsService,
  ) {}

  // GET /projects/next-id — any authenticated role
  @Get('next-id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  async getNextId(): Promise<{ nextId: string }> {
    const nextId = await this.projectsService.generateNextProjectId();
    return { nextId };
  }

  // GET /projects — any authenticated role (filtered per-user in the service)
  @Get()
  async getAll(@Request() req: AuthenticatedRequest) {
    return this.projectsService.findAll(req.user);
  }

  // GET /projects/name/:projectName — any authenticated role
  @Get('name/:projectName')
  findByName(@Param('projectName') projectName: string) {
    return this.projectsService.findByName(projectName);
  }

  // GET /projects/:projectId/products — any authenticated role
  @Get(':projectId/products')
  getProductsByProject(@Param('projectId') projectId: string) {
    return this.productsService.findByProject(projectId);
  }
  
  // GET /projects/:id — any authenticated role
  @Get(':id')
  getOne(@Param('id') id: string): Promise<Project> {
    return this.projectsService.findOne(id);
  }

  // 👑 Admin-only: create/update/delete a project
  @Post()
  @Roles(UserRole.MASTER)
  create(@Body() data: Partial<Project>): Promise<Project> {
    return this.projectsService.create(data);
  }

  @Put(':id')
  @Roles(UserRole.MASTER)
  update(@Param('id') id: string, @Body() data: Partial<Project>): Promise<Project> {
    return this.projectsService.update(id, data);
  }

  @Delete(':id')
  @Roles(UserRole.MASTER)
  remove(@Param('id') id: string): Promise<void> {
    return this.projectsService.remove(id);
  }
}