import { Controller, Get, Post, Put, Delete, Param, Body, Header, UseGuards, Request } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { Project } from './project.entity';
import { ProductsService } from '../products/products.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request as ExpressRequest } from 'express';

interface AuthenticatedRequest extends ExpressRequest {
  user: {
    userId: string;
    role: string;
  };
}

@UseGuards(JwtAuthGuard) // 🔒 Rule 1: Apply this at the top so ALL endpoints require a user to be logged in!
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly productsService: ProductsService,
  ) {}

  // GET /projects/next-id
  @Get('next-id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  async getNextId(): Promise<{ nextId: string }> {
    const nextId = await this.projectsService.generateNextProjectId();
    return { nextId };
  }

  // GET /projects (Filtered automatically based on assigned user)
  @Get()
  async getAll(@Request() req: AuthenticatedRequest) {
    return this.projectsService.findAll(req.user);
  }

  @Get('name/:projectName')
  findByName(@Param('projectName') projectName: string) {
    return this.projectsService.findByName(projectName);
  }

  // GET /projects/:projectId/products
  @Get(':projectId/products')
  getProductsByProject(@Param('projectId') projectId: string) {
    return this.productsService.findByProject(projectId);
  }
  
  // GET /projects/:id
  @Get(':id')
  getOne(@Param('id') id: string): Promise<Project> {
    return this.projectsService.findOne(id);
  }

  // 👑 Administrative Actions: Consider adding role restriction here later if needed
  @Post()
  create(@Body() data: Partial<Project>): Promise<Project> {
    return this.projectsService.create(data);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: Partial<Project>): Promise<Project> {
    return this.projectsService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.projectsService.remove(id);
  }
}