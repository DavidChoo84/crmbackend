// src/projects/projects.controller.ts
import { Controller, Get, Post, Put, Delete, Param, Body, Header } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { Project } from './project.entity';
import { ProductsService } from '../products/products.service';

@Controller('projects') // your URL: http://localhost:3000/projects
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService,
              private readonly productsService: ProductsService,) {}

  // GET /projects/next-id → returns next projects ID
  @Get('next-id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  async getNextId(): Promise<{ nextId: string }> {
    const nextId = await this.projectsService.generateNextProjectId();
    return { nextId };
  }

  // Return minimal data for sidebar (no nested relations)
  @Get()
  async getAll(): Promise<{ projectId: string; projectName: string }[]> {
    const projects = await this.projectsService.findAll();
    return projects.map((p) => ({
      projectId: p.projectId,
      projectName: p.projectName,
    }));
  }

  @Get('name/:projectName')
  findByName(@Param('projectName') projectName: string) {
    return this.projectsService.findByName(projectName);
  }

  // GET /api/projects/:projectId/products
  @Get(':projectId/products')
  getProductsByProject(@Param('projectId') projectId: string) {
    return this.productsService.findByProject(projectId);
  }
  
  // Full detail endpoint (includes products/packages because service currently returns relations)
  @Get(':id')
  getOne(@Param('id') id: string): Promise<Project> {
    return this.projectsService.findOne(id);
  }

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
