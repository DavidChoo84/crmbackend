import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './project.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}

  async findAll(): Promise<Project[]> {
    return this.projectRepo.find({
      relations: ['products', 'packages'],
      order: { projectName: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Project> {
    const project = await this.projectRepo.findOne({
      where: { projectId: id },
      relations: ['products', 'packages'],
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async create(data: Partial<Project>): Promise<Project> {
    const newProject = this.projectRepo.create(data);
    return this.projectRepo.save(newProject);
  }

  async update(id: string, data: Partial<Project>): Promise<Project> {
    const project = await this.findOne(id);
    Object.assign(project, data);
    return this.projectRepo.save(project);
  }

  async remove(id: string): Promise<void> {
    const project = await this.findOne(id);
    await this.projectRepo.remove(project);
  }

  async findByName(projectName: string): Promise<Project> {
    const clean = projectName.trim();

    const project = await this.projectRepo.findOne({
        where: { projectName: clean },
        relations: ['products', 'packages'],
    });

    if (!project) throw new NotFoundException('Project not found');
    return project;
  }
}
